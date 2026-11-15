"use client";

// ที่อยู่สถานที่ติดตั้ง/สาขา ใช้ร่วมกัน: หน้าต่างเพิ่มลูกค้าใหม่ (เปิดคิว/เปิดงาน) และหน้าต่างเพิ่ม/แก้ไขสาขา (หน้าลูกค้า)
//   · วางลิงก์ Google Maps → พิกัดเติมทันทีถ้าลิงก์มีพิกัดในตัว + ดึงตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์จาก backend
//     (ลิงก์ย่อ maps.app.goo.gl ใช้ได้) · วาง/กดปุ่ม = แทนค่าเดิม · ออกจากช่อง/เปิดหน้าต่าง = เติมเฉพาะช่องว่าง
//   · ค้นตำบลหรือรหัสไปรษณีย์ช่องเดียว → เติม 4 ช่อง (ฐานข้อมูลที่อยู่ไทยในระบบ)
//   · ทุกช่องยังแก้เองได้
import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid2";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PlaceIcon from "@mui/icons-material/Place";
import SearchIcon from "@mui/icons-material/Search";
import { api, ApiError } from "@/lib/api";
import type { MapGeoResult, ThaiAddressEntry } from "@/lib/types";
import { addressFromMap, looksLikeMapLink, thaiAddressLabel, type AddressFields } from "@/lib/customerAddress";
import { parseLatLng } from "@/lib/equipmentRules";

export type SiteAddressValues = AddressFields & { mapLink: string };

export default function SiteAddressFields({
  value,
  onChange,
  fieldError,
  testIdPrefix = "qc",
  autoLookupKey,
  between,
}: {
  value: SiteAddressValues;
  onChange: (patch: Partial<SiteAddressValues>) => void;
  fieldError?: (field: string) => string | undefined;
  /** คำนำหน้า data-testid ของช่อง (qc = หน้าต่างลูกค้าใหม่ · site = หน้าต่างสาขา) */
  testIdPrefix?: string;
  /** เปลี่ยนค่านี้ (เช่น ตอนเปิดหน้าต่าง) → ดึงจากลิงก์เดิมแบบเติมเฉพาะช่องว่าง 1 ครั้ง */
  autoLookupKey?: string | number;
  /** ช่องที่แสดงระหว่างผลแผนที่กับที่อยู่ (เช่น ชื่อร้าน/รหัสสาขา) */
  between?: React.ReactNode;
}) {
  const [geoBusy, setGeoBusy] = useState(false);
  const [geo, setGeo] = useState<MapGeoResult | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const lastLooked = useRef("");
  const latest = useRef(value);
  latest.current = value;
  const [addrQ, setAddrQ] = useState("");
  const [addrOpts, setAddrOpts] = useState<ThaiAddressEntry[]>([]);
  const fe = (f: string) => fieldError?.(f);
  const tid = (s: string) => `${testIdPrefix}-${s}`;

  const lookupMap = useCallback(
    async (link: string, overwrite: boolean) => {
      const l = link.trim();
      if (!l || !looksLikeMapLink(l) || lastLooked.current === l) return;
      lastLooked.current = l;
      setGeoBusy(true);
      setGeoErr(null);
      try {
        const r = await api.geoMapLink(l);
        setGeo(r);
        onChange(addressFromMap(latest.current, r, overwrite));
      } catch (e) {
        setGeo(null);
        setGeoErr(e instanceof ApiError ? e.message : "ดึงข้อมูลจากแผนที่ไม่สำเร็จ");
      } finally {
        setGeoBusy(false);
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (autoLookupKey === undefined) return;
    setGeo(null);
    setGeoErr(null);
    setAddrQ("");
    lastLooked.current = "";
    const v = latest.current;
    const missing = [v.subdistrict, v.district, v.province, v.postcode, v.lat, v.lng].some((x) => !String(x ?? "").trim());
    if (v.mapLink.trim() && missing) void lookupMap(v.mapLink, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookupKey]);

  useEffect(() => {
    const q = addrQ.trim();
    if (q.length < 2) {
      setAddrOpts([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .geoThaiAddress(q)
        .then((r) => setAddrOpts(r.items))
        .catch(() => setAddrOpts([]));
    }, 250);
    return () => clearTimeout(t);
  }, [addrQ]);

  const setLink = (link: string) => {
    // ลิงก์ที่มีพิกัดในตัว: เติมทันทีโดยไม่ต้องรอ backend
    const pos = parseLatLng(link);
    onChange({ mapLink: link, ...(pos ? { lat: String(pos.lat), lng: String(pos.lng) } : {}) });
  };

  // พิกัดล้วน "13.7563, 100.5018" → เก็บเป็นลิงก์ Google Maps (ช่องลิงก์รับเฉพาะ https://) — ทำตอนวาง/ออกจากช่อง ไม่ทำระหว่างพิมพ์
  const normalizeLink = (raw: string): string => {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw);
    if (!m) return raw;
    const link = `https://www.google.com/maps?q=${m[1]},${m[2]}`;
    onChange({ mapLink: link, lat: m[1], lng: m[2] });
    return link;
  };

  const tf = (k: keyof AddressFields, label: string, extra: Record<string, unknown> = {}) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={value[k]}
      onChange={(e) => onChange({ [k]: e.target.value } as Partial<SiteAddressValues>)}
      error={!!fe(k)}
      helperText={fe(k) ?? " "}
      {...extra}
    />
  );

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
        <TextField
          fullWidth
          size="small"
          label="ลิงก์ Google Maps"
          placeholder="วางลิงก์ เช่น https://maps.app.goo.gl/… หรือพิกัด 13.7563, 100.5018"
          value={value.mapLink}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (t) setTimeout(() => lookupMap(normalizeLink(t), true), 0);
          }}
          onBlur={() => lookupMap(normalizeLink(value.mapLink), false)}
          error={!!fe("mapLink")}
          helperText={fe("mapLink") ?? " "}
          InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon fontSize="small" /></InputAdornment> }}
          inputProps={{ inputMode: "url", "data-testid": tid("maplink") }}
        />
        <Button
          variant="outlined"
          sx={{ flexShrink: 0, minHeight: 40 }}
          disabled={geoBusy || !looksLikeMapLink(value.mapLink)}
          onClick={() => {
            lastLooked.current = "";
            void lookupMap(normalizeLink(value.mapLink), true);
          }}
          startIcon={geoBusy ? <CircularProgress size={16} /> : undefined}
          data-testid={tid("map-lookup")}
        >
          {geoBusy ? "กำลังดึง…" : "ดึงที่อยู่จากแผนที่"}
        </Button>
      </Stack>
      {geo && (geo.subdistrict || geo.lat !== null) ? (
        <Alert severity={geo.matched ? "success" : "info"} sx={{ mb: 1.5 }} data-testid={tid("map-result")}>
          {geo.matched
            ? `เติมจากแผนที่แล้ว: ${thaiAddressLabel(geo)} — ตรวจแล้วแก้ได้`
            : geo.lat !== null
              ? `ได้พิกัด ${geo.lat}, ${geo.lng}${geo.subdistrict || geo.district ? ` · ${[geo.subdistrict, geo.district, geo.province].filter(Boolean).join(" ")}` : ""}`
              : ""}
          {geo.warnings.length ? <Box sx={{ mt: 0.5 }}>{geo.warnings.join(" · ")}</Box> : null}
        </Alert>
      ) : geo?.warnings.length ? (
        <Alert severity="warning" sx={{ mb: 1.5 }} data-testid={tid("map-result")}>
          {geo.warnings.join(" · ")}
        </Alert>
      ) : geoErr ? (
        <Alert severity="warning" sx={{ mb: 1.5 }} data-testid={tid("map-result")}>
          {geoErr} — กรอกที่อยู่เองได้ตามปกติ
        </Alert>
      ) : null}

      <Grid container spacing={1.5}>
        {between}
        <Grid size={12}>{tf("address", "ที่อยู่ (เลขที่ หมู่ ซอย ถนน)", { placeholder: "เช่น 99/1 ม.3 ซ.สุขุมวิท 21 ถ.สุขุมวิท" })}</Grid>
        <Grid size={12}>
          <Autocomplete<ThaiAddressEntry, false, false, false>
            size="small"
            options={addrOpts}
            filterOptions={(x) => x}
            getOptionLabel={thaiAddressLabel}
            isOptionEqualToValue={(a, b) => thaiAddressLabel(a) === thaiAddressLabel(b)}
            inputValue={addrQ}
            onInputChange={(_, val, reason) => reason !== "reset" && setAddrQ(val)}
            value={null}
            onChange={(_, e) => {
              if (!e) return;
              onChange({ subdistrict: e.subdistrict, district: e.district, province: e.province, postcode: e.postcode });
              setAddrQ("");
            }}
            noOptionsText={addrQ.trim().length < 2 ? "พิมพ์อย่างน้อย 2 ตัวอักษร" : "ไม่พบ — กรอกในช่องด้านล่างเองได้"}
            renderInput={(params) => (
              <TextField
                {...params}
                label="ค้นตำบล/แขวง หรือรหัสไปรษณีย์"
                placeholder="เช่น สีลม หรือ 10500"
                helperText="เลือกแล้วเติม ตำบล อำเภอ จังหวัด รหัสไปรษณีย์ ให้ครบ"
                InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                inputProps={{ ...params.inputProps, "data-testid": tid("addr-search") }}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>{tf("subdistrict", "ตำบล/แขวง", { inputProps: { "data-testid": tid("subdistrict") } })}</Grid>
        <Grid size={{ xs: 12, sm: 3 }}>{tf("district", "อำเภอ/เขต", { inputProps: { "data-testid": tid("district") } })}</Grid>
        <Grid size={{ xs: 12, sm: 3 }}>{tf("province", "จังหวัด", { inputProps: { "data-testid": tid("province") } })}</Grid>
        <Grid size={{ xs: 12, sm: 3 }}>{tf("postcode", "รหัสไปรษณีย์", { inputProps: { inputMode: "numeric", maxLength: 5, "data-testid": tid("postcode") } })}</Grid>
        <Grid size={{ xs: 6, sm: 3 }}>{tf("lat", "ละติจูด", { placeholder: "เช่น 13.7563", inputProps: { inputMode: "decimal", "data-testid": tid("lat") } })}</Grid>
        <Grid size={{ xs: 6, sm: 3 }}>{tf("lng", "ลองจิจูด", { placeholder: "เช่น 100.5018", inputProps: { inputMode: "decimal", "data-testid": tid("lng") } })}</Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ display: "flex", alignItems: "flex-start", pt: { sm: 1 } }}>
          {value.lat && value.lng ? (
            <Chip size="small" variant="outlined" icon={<PlaceIcon />} label="พิกัดจากลิงก์แผนที่ — แก้ได้" />
          ) : (
            <Typography variant="caption" color="text.secondary">
              พิกัดเติมให้เองเมื่อวางลิงก์แผนที่
            </Typography>
          )}
        </Grid>
      </Grid>
    </>
  );
}
