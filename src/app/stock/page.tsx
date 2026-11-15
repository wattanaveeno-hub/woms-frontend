"use client";

// ---------------------------------------------------------------------------
// ระบบสต๊อกอะไหล่ (STK-FN-001..010)
// ---------------------------------------------------------------------------
// Phase 7 (ENTECH design "Stock"): หัวหน้า 3 ปุ่ม (โอนระหว่างคลัง · เพิ่มอะไหล่ · รับเข้าสต๊อก)
//   แท็บ คงเหลือ / ใกล้หมด / ความเคลื่อนไหว / คลัง · ตารางคงเหลือแยกคอลัมน์ตามคลัง (pivot)
//   ฟังก์ชันเดิมครบ: บันทึกการเคลื่อนไหวทุกชนิด (ตามสิทธิ์) · เพิ่มคลัง · เพิ่มอะไหล่ · ต้นทุน/มูลค่า (parts:cost_view)

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type {
  Part,
  StockBalancesResponse,
  StockLocation,
  StockLocationType,
  StockMove,
  StockTransaction,
} from "@/lib/types";
import { STOCK_MOVE_LABEL } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import { parseMoney, useFieldErrors } from "@/components/FieldErrors";
type StockBalanceRow = StockBalancesResponse["items"][number];
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Link from "next/link";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import {
  WomsDataTable,
  WomsErrorState,
  WomsLinkTabs,
  WomsPageHeader,
  WomsSearchBar,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";
import NumberInput from "@/components/NumberInput";
import { compressPartImage } from "@/lib/partsApi";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import { stockTabs } from "@/lib/stockTabs";

// สิทธิ์ของแต่ละชนิดการเคลื่อนไหว — ตรงกับ MOVE_PERMISSION ของ backend (src/routes/stock.ts)
const MOVE_PERMISSION: Record<StockMove, string> = {
  RECEIVE: "stock:receive",
  ISSUE: "stock:issue",
  TRANSFER: "stock:transfer",
  RETURN: "stock:issue",
  ADJUST: "stock:adjust",
};
const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

// รูปอะไหล่ย่อ — กดเพื่อดูรูปใหญ่ · ไม่มีรูปแสดงกรอบว่าง
function PartThumb({ src, alt, size = 40, onOpen }: { src?: string; alt: string; size?: number; onOpen?: (src: string, alt: string) => void }) {
  const sx = { width: size, height: size, flexShrink: 0, borderRadius: 1, border: 1, borderColor: "divider" } as const;
  if (!src) {
    return (
      <Box sx={{ ...sx, display: "grid", placeItems: "center", color: "text.disabled" }} aria-label="ไม่มีรูป">
        <ImageNotSupportedIcon fontSize="small" />
      </Box>
    );
  }
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen?.(src, alt)}
      aria-label={`ดูรูป ${alt}`}
      data-testid="stock-part-thumb"
      sx={{ ...sx, p: 0, cursor: "zoom-in", overflow: "hidden", bgcolor: "background.paper" }}
    >
      <Box component="img" src={src} alt={alt} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </Box>
  );
}

// ประเภทคลังตรงกับ STOCK_LOCATION_TYPES ของ backend (src/domain/part.ts)
const LOCATION_TYPES: Array<{ value: StockLocationType; label: string }> = [
  { value: "MAIN", label: "คลังหลัก" },
  { value: "TECH", label: "คลังช่าง" },
];

const EMPTY_LOCATION = { code: "", name: "", type: "MAIN" as StockLocationType, ownerUserId: "", ownerName: "", note: "" };

const MOVES: StockMove[] = ["RECEIVE", "ISSUE", "TRANSFER", "RETURN", "ADJUST"];

/** คีย์กันตัดซ้ำ — สร้างใหม่ทุกครั้งที่เปิดฟอร์ม และใช้ค่าเดิมถ้ากดปุ่มซ้ำ */
function newIdemKey(): string {
  return `mv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function StockPage() {
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("stock:manage");
  // เดิมฟอร์มบันทึกการเคลื่อนไหวแสดงให้ทุกคนที่ดูสต๊อกได้ แล้วไปโดน 403 ตอนกดบันทึก
  const allowedMoves = MOVES.filter((m) => has(MOVE_PERMISSION[m]));

  const [balances, setBalances] = useState<StockBalancesResponse | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [txns, setTxns] = useState<StockTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ฟอร์มบันทึกการเคลื่อนไหว
  const [move, setMove] = useState<StockMove>("RECEIVE");
  useEffect(() => {
    if (allowedMoves.length && !allowedMoves.includes(move)) setMove(allowedMoves[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedMoves.join(",")]);
  const [partId, setPartId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [jobId, setJobId] = useState("");
  const [note, setNote] = useState("");
  const [idemKey, setIdemKey] = useState(newIdemKey);
  /*
   * QA BUG-042 — การปรับยอด (ADJUST) ปรับ "ลง" ไม่ได้เลย
   * backend รองรับสองทิศทางมาตลอด (src/mongo/stockRepo.ts):
   *   toLocationId   = ปรับขึ้น · fromLocationId = ปรับลง (ตัดด้วย takeQty จึงไม่ติดลบ)
   *   ส่งมาทั้งสองแห่งพร้อมกัน = ถูกปฏิเสธ เพราะประวัติจะอ่านผิดประเภท
   * แต่ฟอร์มส่ง toLocationId เสมอ ตรวจนับแล้วของขาดจึงบันทึกไม่ได้
   * ต้องเลี่ยงไปใช้ ISSUE ซึ่งทำให้ประวัติผิดประเภท
   *
   * หมายเหตุขอบเขต: ที่นี่แก้ "ทิศทาง" ให้ตรงกับ API ที่มีอยู่แล้วเท่านั้น
   * ส่วน semantics แบบ "กรอกยอดที่นับได้แล้วให้ระบบคิดส่วนต่างให้"
   * ยังไม่ทำ เพราะรอ SA/ธุรกิจชี้ขาด
   */
  const [adjustDir, setAdjustDir] = useState<"UP" | "DOWN">("UP");
  // Phase 7: ฟอร์มการเคลื่อนไหวอยู่ในหน้าต่าง (เปิดจากปุ่มหัวหน้า/แท็บความเคลื่อนไหว พร้อมชนิดตั้งต้น)
  const [moveOpen, setMoveOpen] = useState(false);
  const [tab, setTab] = useState<"balance" | "low" | "moves" | "locations">("balance");
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const moveErr = useFieldErrors("mv");
  const openMove = (m: StockMove) => {
    moveErr.clear();
    setMove(m);
    setMoveOpen(true);
  };
  // Phase 7: ปุ่ม "รับเข้าสต๊อก" จากหน้าข้อมูลอะไหล่ (/stock?receive=<partId>) — เปิดหน้าต่างรับเข้าพร้อมเลือกอะไหล่ไว้
  const [receiveFromUrl, setReceiveFromUrl] = useState<string | null>(null);
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("receive");
    if (pid) setReceiveFromUrl(pid);
  }, []);
  const partErr = useFieldErrors("pt");

  // ฟอร์มเพิ่มคลัง (QA BUG-021 — เดิมไม่มีหน้าจอใดสร้างคลังได้เลย)
  const [showLocForm, setShowLocForm] = useState(false);
  const [newLoc, setNewLoc] = useState(EMPTY_LOCATION);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!showLocForm || techs.length) return;
    api
      .listTechnicians()
      .then((r) => setTechs(r.items.map((u) => ({ id: u.id, name: u.name }))))
      .catch(() => setTechs([]));
  }, [showLocForm, techs.length]);
  const locErr = useFieldErrors("loc");

  // ฟอร์มเพิ่มอะไหล่
  const [showPartForm, setShowPartForm] = useState(false);
  const [newPart, setNewPart] = useState({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0", image: "" });
  const [imgBusy, setImgBusy] = useState(false);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const openPreview = (src: string, alt: string) => setPreview({ src, alt });

  const load = useCallback(async () => {
    setError(null);
    setLocationsLoading(true);
    try {
      const [b, p, l, t] = await Promise.all([
        api.stockBalances(),
        api.listParts({}),
        api.listStockLocations({}),
        api.stockTransactions({ limit: 100 }),
      ]);
      setBalances(b);
      setParts(p.items);
      setLocations(l.items);
      setTxns(t.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลสต๊อกไม่สำเร็จ");
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!receiveFromUrl || !parts.length || !has("stock:receive")) return;
    if (parts.some((p) => p.id === receiveFromUrl)) {
      setPartId(receiveFromUrl);
      openMove("RECEIVE");
    }
    setReceiveFromUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiveFromUrl, parts]);

  const needsFrom = move === "ISSUE" || move === "TRANSFER" || move === "RETURN";
  const needsTo = move === "RECEIVE" || move === "TRANSFER" || move === "RETURN";

  const submitMove = async () => {
    moveErr.clear();
    if (!partId) {
      moveErr.setIssue("partId", "เลือกอะไหล่ก่อน");
      return;
    }
    // จำนวนต้องเป็นจำนวนเต็มบวกจริง ๆ — เดิมรับข้อความอะไรก็ได้แล้วกลายเป็น 0 เงียบ ๆ
    if (!/^\d+$/.test(qty.trim()) || Number(qty) <= 0) {
      moveErr.setIssue("qty", "จำนวนต้องเป็นตัวเลขจำนวนเต็มมากกว่า 0");
      return;
    }
    if (needsFrom && !fromId) {
      moveErr.setIssue("fromLocationId", "ต้องระบุคลังต้นทาง");
      return;
    }
    if (move === "ADJUST") {
      // ปรับยอดระบุคลังได้ครั้งละแห่งเดียว — ช่องบนหน้าจอจึงมีช่องเดียวตามทิศทางที่เลือก
      if (!toId) {
        moveErr.setIssue("toLocationId", "ต้องระบุคลังที่จะปรับยอด");
        return;
      }
    } else if (needsTo && !toId) {
      moveErr.setIssue("toLocationId", "ต้องระบุคลังปลายทาง");
      return;
    }
    let unitCostValue = 0;
    if (move === "RECEIVE") {
      const parsed = parseMoney(unitCost);
      if (!parsed.ok) {
        moveErr.setIssue("unitCost", parsed.message);
        return;
      }
      unitCostValue = parsed.value;
    }
    setBusy(true);
    try {
      await api.stockMove({
        partId,
        move,
        qty: Number(qty) || 0,
        // ADJUST: ปรับลง = ส่ง fromLocationId · ปรับขึ้น = ส่ง toLocationId (ห้ามส่งทั้งคู่)
        fromLocationId: move === "ADJUST" ? (adjustDir === "DOWN" ? toId : "") : needsFrom ? fromId : "",
        toLocationId: move === "ADJUST" ? (adjustDir === "DOWN" ? "" : toId) : needsTo ? toId : "",
        unitCost: unitCostValue,
        jobId: jobId.trim(),
        note,
        idempotencyKey: idemKey,
      });
      toast.success(
        move === "ADJUST"
          ? `ปรับยอด${adjustDir === "DOWN" ? "ลง" : "ขึ้น"} ${qty} แล้ว`
          : "บันทึกการเคลื่อนไหวแล้ว"
      );
      setIdemKey(newIdemKey()); // รายการถัดไปใช้คีย์ใหม่
      setMoveOpen(false);
      setQty("1");
      setNote("");
      setJobId("");
      await load();
    } catch (e) {
      if (!moveErr.fromApi(e, ["partId", "qty", "fromLocationId", "toLocationId", "unitCost", "jobId", "note"])) {
        toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  // QA BUG-021 — สร้างคลัง (POST /api/stock/locations, กันด้วยสิทธิ์ stock:manage)
  const addLocation = async () => {
    locErr.clear();
    const code = newLoc.code.trim();
    if (!code) {
      locErr.setIssue("code", "ต้องระบุรหัสคลัง");
      return;
    }
    if (locations.some((l) => l.code.toLowerCase() === code.toLowerCase())) {
      locErr.setIssue("code", `มีคลังรหัส "${code}" อยู่แล้ว`);
      return;
    }
    // DEF-P7-01: backend ผูกคลังช่างกับบัญชีผู้ใช้ (ownerUserId) — เดิมหน้าเว็บส่งแค่ชื่อ จึงสร้างคลังช่างไม่ได้เลย
    if (newLoc.type === "TECH" && !newLoc.ownerUserId) {
      locErr.setIssue("ownerUserId", "คลังช่างต้องเลือกช่างเจ้าของคลัง");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createStockLocation({
        code,
        name: newLoc.name.trim() || code,
        type: newLoc.type,
        ownerUserId: newLoc.type === "TECH" ? newLoc.ownerUserId : "",
        ownerName: newLoc.type === "TECH" ? newLoc.ownerName.trim() : "",
        note: newLoc.note.trim(),
        active: true,
      });
      toast.success(`เพิ่มคลัง ${created.name || created.code} แล้ว`);
      setShowLocForm(false);
      setNewLoc(EMPTY_LOCATION);
      await load();
    } catch (e) {
      // ข้อความจาก backend ชี้ช่องได้ ก็แปะที่ช่องนั้นแทนการขึ้น toast ลอย ๆ
      if (!locErr.fromApi(e, ["code", "name", "type", "ownerUserId", "note"])) {
        toast.error(e instanceof ApiError ? e.message : "เพิ่มคลังไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  const addPart = async () => {
    partErr.clear();
    if (!newPart.code.trim()) {
      partErr.setIssue("code", "ต้องระบุรหัสอะไหล่");
      return;
    }
    if (!newPart.name.trim()) {
      partErr.setIssue("name", "ต้องระบุชื่ออะไหล่");
      return;
    }
    if (!/^\d+$/.test(newPart.reorderPoint.trim() || "0")) {
      partErr.setIssue("reorderPoint", "จุดสั่งซื้อต้องเป็นจำนวนเต็มไม่ติดลบ");
      return;
    }
    const cost = parseMoney(newPart.standardCost);
    if (!cost.ok) {
      partErr.setIssue("standardCost", cost.message);
      return;
    }
    const sell = parseMoney(newPart.sellPrice);
    if (!sell.ok) {
      partErr.setIssue("sellPrice", sell.message);
      return;
    }
    setBusy(true);
    try {
      await api.createPart({
        code: newPart.code.trim(),
        name: newPart.name.trim(),
        unit: newPart.unit.trim(),
        reorderPoint: Number(newPart.reorderPoint) || 0,
        standardCost: cost.value,
        sellPrice: sell.value,
        ...(newPart.image ? { image: newPart.image } : {}),
      });
      toast.success("เพิ่มอะไหล่แล้ว");
      setShowPartForm(false);
      setNewPart({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0", image: "" });
      await load();
    } catch (e) {
      if (!partErr.fromApi(e, ["code", "name", "unit", "reorderPoint", "standardCost", "sellPrice", "image"])) {
        toast.error(e instanceof ApiError ? e.message : "เพิ่มอะไหล่ไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  const pickPartImage = async (file?: File) => {
    if (!file) return;
    partErr.clear();
    if (!file.type.startsWith("image/")) {
      partErr.setIssue("image", "เลือกได้เฉพาะไฟล์รูปภาพ");
      return;
    }
    setImgBusy(true);
    try {
      const image = await compressPartImage(file);
      setNewPart((p) => ({ ...p, image }));
    } catch (e) {
      partErr.setIssue("image", e instanceof Error ? e.message : "โหลดรูปไม่สำเร็จ");
    } finally {
      setImgBusy(false);
    }
  };

  const lowStock = useMemo(() => (balances?.items ?? []).filter((r) => r.belowReorder), [balances]);
  // BUG-V2-17: ช่างได้ยอดเฉพาะคลังของตัวเอง ไม่มีต้นทุน/มูลค่า (valuation.hidden จาก API)
  const ownScope = !!balances?.valuation?.hidden;

  const locOptions = locations.map((l) => (
    <MenuItem key={l.id} value={l.id}>
      {l.name} ({l.typeLabel})
    </MenuItem>
  ));
  const g = { xs: 12, sm: 6, md: 4 } as const;

  const locCols: WomsColumn<StockLocation>[] = [
    { key: "code", label: "รหัส", sortValue: (l) => l.code, render: (l) => <span className="mono">{l.code}</span> },
    { key: "name", label: "ชื่อคลัง", sortValue: (l) => l.name, render: (l) => l.name || "—" },
    { key: "type", label: "ประเภท", render: (l) => l.typeLabel },
    { key: "owner", label: "เจ้าของ", render: (l) => l.ownerName || "—" },
    { key: "active", label: "สถานะ", render: (l) => <WomsStatusChip label={l.active ? "ใช้งาน" : "ปิดใช้งาน"} tone={l.active ? "success" : "neutral"} /> },
    { key: "note", label: "หมายเหตุ", hideBelowLg: true, render: (l) => l.note || "—" },
  ];
  const balColsAll: WomsColumn<StockBalanceRow>[] = [
    { key: "code", label: "รหัส", sortValue: (r) => r.code, render: (r) => <span className="mono">{r.code}</span> },
    {
      key: "name",
      label: "ชื่อ",
      sortValue: (r) => r.name,
      render: (r) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <PartThumb src={imageOf.get(r.partId)} alt={r.name} size={36} onOpen={openPreview} />
          <span>{r.name}</span>
        </Stack>
      ),
    },
    {
      key: "qty",
      label: "คงเหลือ",
      sortValue: (r) => r.totalQty,
      render: (r) => (
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <span className="mono">
            {r.totalQty} {r.unit}
          </span>
          {r.belowReorder ? <WomsStatusChip label="ต่ำกว่าจุดสั่งซื้อ" tone="warning" /> : null}
        </Stack>
      ),
    },
    { key: "byLoc", label: "แยกตามคลัง", hideBelowLg: true, render: (r) => (r.byLocation.length === 0 ? "—" : r.byLocation.map((l) => `${l.locationName}: ${l.qty}`).join(" · ")) },
    { key: "reorder", label: "จุดสั่งซื้อ", align: "right", render: (r) => <span className="mono">{r.reorderPoint || "—"}</span> },
    { key: "cost", label: "ต้นทุน/หน่วย", align: "right", hideBelowLg: true, render: (r) => <span className="mono">{r.unitCost == null ? "—" : r.unitCost.toLocaleString("th-TH")}</span> },
    { key: "value", label: "มูลค่า", align: "right", sortValue: (r) => r.totalValue ?? -1, render: (r) => <span className="mono">{r.totalValue == null ? "—" : r.totalValue.toLocaleString("th-TH")}</span> },
  ];
  // D-18: ผู้ไม่มี parts:cost_view (CEO / Viewer) ไม่เห็นคอลัมน์ต้นทุน/มูลค่า — API ส่ง null อยู่แล้ว
  const canSeeCost = has("parts:cost_view");
  const balCols = balColsAll.filter(
    (c) => (!ownScope || (c.key !== "cost" && c.key !== "value" && c.key !== "reorder")) && (canSeeCost || (c.key !== "cost" && c.key !== "value"))
  );
  const txCols: WomsColumn<StockTransaction>[] = [
    { key: "at", label: "เวลา", sortValue: (t) => t.at, render: (t) => <span className="mono">{bangkokDateTime(t.at)}</span> },
    { key: "move", label: "ประเภท", sortValue: (t) => t.moveLabel, render: (t) => t.moveLabel },
    { key: "part", label: "อะไหล่", sortValue: (t) => t.partCode, render: (t) => <span className="mono">{t.partCode}</span> },
    { key: "qty", label: "จำนวน", align: "right", render: (t) => <span className="mono">{t.qty}</span> },
    { key: "loc", label: "จาก → เข้า", render: (t) => `${t.fromLocationName || "—"} → ${t.toLocationName || "—"}` },
    { key: "job", label: "ใบงาน", render: (t) => (t.jobId ? <span className="mono">{t.jobId}</span> : "—") },
    { key: "by", label: "ผู้ทำรายการ", hideBelowLg: true, render: (t) => t.byName },
  ];

  // ---- Phase 7: ตารางคงเหลือแบบแยกคอลัมน์ตามคลัง ----
  const sellPriceOf = useMemo(() => new Map(parts.map((p) => [p.id, p.sellPrice])), [parts]);
  const imageOf = useMemo(() => new Map(parts.map((p) => [p.id, p.image ?? ""])), [parts]);
  const pivotLocs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of locations) if (l.active) seen.set(l.id, l.name || l.code);
    for (const r of balances?.items ?? []) for (const b of r.byLocation) if (!seen.has(b.locationId)) seen.set(b.locationId, b.locationName);
    const all = [...seen.entries()].map(([id, name]) => ({ id, name }));
    return locFilter ? all.filter((l) => l.id === locFilter) : all;
  }, [locations, balances, locFilter]);
  const qtyAt = (r: StockBalanceRow, locId: string) => r.byLocation.find((b) => b.locationId === locId)?.qty ?? 0;
  const filterRows = (rows: StockBalanceRow[]) => {
    const k = q.trim().toLowerCase();
    return rows.filter(
      (r) => (!k || r.code.toLowerCase().includes(k) || r.name.toLowerCase().includes(k)) && (!locFilter || r.byLocation.some((b) => b.locationId === locFilter))
    );
  };
  const balanceRows = filterRows(balances?.items ?? []);
  const lowRows = filterRows(lowStock);
  const pivotCols: WomsColumn<StockBalanceRow>[] = [
    {
      key: "part",
      label: "อะไหล่",
      sortValue: (r) => r.name,
      render: (r) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <PartThumb src={imageOf.get(r.partId)} alt={r.name} onOpen={openPreview} />
          <Box sx={{ minWidth: 0 }}>
            <Box component={Link} href={`/parts/${encodeURIComponent(r.partId)}`} sx={{ fontWeight: 600, display: "block" }}>
              {r.name}
            </Box>
            <span className="mono">{r.code}</span>
          </Box>
        </Stack>
      ),
    },
    ...pivotLocs.map((l) => ({
      key: `loc-${l.id}`,
      label: l.name,
      align: "right" as const,
      sortValue: (r: StockBalanceRow) => qtyAt(r, l.id),
      render: (r: StockBalanceRow) => {
        const n = qtyAt(r, l.id);
        return (
          <span className="mono" style={n === 0 ? { color: "#b3261e" } : undefined}>
            {n}
          </span>
        );
      },
    })),
    {
      key: "total",
      label: "รวม",
      align: "right",
      sortValue: (r) => r.totalQty,
      render: (r) => (
        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
          <b className="mono">
            {r.totalQty} {r.unit}
          </b>
          {r.belowReorder ? <WomsStatusChip label="ใกล้หมด" tone="warning" /> : null}
        </Stack>
      ),
    },
    ...(ownScope
      ? []
      : [
          { key: "reorder", label: "จุดสั่งซื้อ", align: "right" as const, render: (r: StockBalanceRow) => <span className="mono">{r.reorderPoint || "—"}</span> },
          {
            key: "sell",
            label: "ราคาขาย",
            align: "right" as const,
            render: (r: StockBalanceRow) => {
              const v = sellPriceOf.get(r.partId);
              return <span className="mono">{v ? `฿${v.toLocaleString("th-TH")}` : "—"}</span>;
            },
          },
        ]),
    ...(canSeeCost && !ownScope
      ? [
          { key: "cost", label: "ต้นทุน/หน่วย", align: "right" as const, hideBelowLg: true, render: (r: StockBalanceRow) => <span className="mono">{r.unitCost == null ? "—" : r.unitCost.toLocaleString("th-TH")}</span> },
          { key: "value", label: "มูลค่า", align: "right" as const, sortValue: (r: StockBalanceRow) => r.totalValue ?? -1, render: (r: StockBalanceRow) => <span className="mono">{r.totalValue == null ? "—" : r.totalValue.toLocaleString("th-TH")}</span> },
        ]
      : []),
  ];
  const locValue = (id: string) => balances?.byLocation.find((b) => b.locationId === id);
  const locColsWithStock: WomsColumn<StockLocation>[] = [
    ...locCols.slice(0, 5),
    { key: "qty", label: "จำนวนคงเหลือ", align: "right", render: (l) => <span className="mono">{locValue(l.id)?.qty ?? 0}</span> },
    ...(canSeeCost && !ownScope
      ? [{ key: "val", label: "มูลค่า", align: "right" as const, render: (l: StockLocation) => { const v = locValue(l.id)?.value; return <span className="mono">{v == null ? "—" : v.toLocaleString("th-TH")}</span>; } }]
      : []),
    locCols[5],
  ];
  const tabCount = (n: number | null, warn = false) =>
    n === null ? null : <Chip size="small" label={n} sx={{ height: 20, fontSize: 12, ...(warn && n > 0 ? { bgcolor: "#fdf3e2", color: "#8a5606" } : {}) }} />;

  const totalValue = balances?.valuation?.totalValue;
  const balanceCard = (r: StockBalanceRow) => (
    <Box sx={cardBox}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <PartThumb src={imageOf.get(r.partId)} alt={r.name} size={44} onOpen={openPreview} />
          <Typography component={Link} href={`/parts/${encodeURIComponent(r.partId)}`} sx={{ fontWeight: 600, color: "text.primary" }}>
            <span className="mono">{r.code}</span> {r.name}
          </Typography>
        </Stack>
        {r.belowReorder ? <WomsStatusChip label="ใกล้หมด" tone="warning" /> : null}
      </Stack>
      <Typography variant="body2">
        คงเหลือ {r.totalQty} {r.unit}
        {ownScope ? "" : ` · จุดสั่งซื้อ ${r.reorderPoint || "—"}`}
        {r.totalValue != null && canSeeCost ? ` · มูลค่า ${r.totalValue.toLocaleString("th-TH")}` : ""}
      </Typography>
      {r.byLocation.length ? <Typography variant="body2">{r.byLocation.map((l) => `${l.locationName}: ${l.qty}`).join(" · ")}</Typography> : null}
    </Box>
  );
  const filtersRow = (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }} data-testid="stock-filters">
      <Box sx={{ flex: "1 1 280px", maxWidth: { sm: 420 } }}>
        <WomsSearchBar value={q} onChange={setQ} placeholder="รหัส ชื่ออะไหล่" label="ค้นหาอะไหล่" />
      </Box>
      {!ownScope ? (
        <TextField select size="small" label="คลัง" value={locFilter} onChange={(e) => setLocFilter(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">ทุกคลัง</MenuItem>
          {locations.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.name || l.code}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
    </Stack>
  );
  const tabLabel = (text: string, badge: React.ReactNode) => (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <span>{text}</span>
      {badge}
    </Stack>
  );

  return (
    <>
      <WomsPageHeader
        title="อะไหล่ & สต๊อก"
        subtitle={
          balances
            ? ownScope
              ? `${balances.count} รายการ · ยอดในคลังของคุณ`
              : `${balances.count} รายการ · ${locations.length} คลัง${canSeeCost && totalValue != null ? ` · มูลค่าคงเหลือ ฿${totalValue.toLocaleString("th-TH")}` : ""} · ใกล้หมด ${balances.belowReorder ?? 0} รายการ`
            : undefined
        }
        actions={
          <>
            {has("stock:transfer") ? (
              <Button variant="outlined" onClick={() => openMove("TRANSFER")} data-testid="stock-transfer">
                โอนระหว่างคลัง
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  partErr.clear();
                  setShowPartForm(true);
                }}
                data-testid="stock-add-part"
              >
                เพิ่มอะไหล่
              </Button>
            ) : null}
            {has("stock:receive") ? (
              <Button variant="contained" onClick={() => openMove("RECEIVE")} data-testid="stock-receive">
                รับเข้าสต๊อก
              </Button>
            ) : null}
          </>
        }
      />
      <WomsLinkTabs ariaLabel="อะไหล่" current="/stock" tabs={stockTabs(has)} />

      {error ? <WomsErrorState message={error} onRetry={load} /> : null}

      {balances && ownScope ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          แสดงยอดเฉพาะคลังของคุณ · ไม่แสดงยอดคลังกลาง คลังของช่างคนอื่น ต้นทุน และมูลค่า
        </Alert>
      ) : null}

      {balances && !ownScope && !balances.valuation.method ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>ยังไม่ได้กำหนดวิธีคิดมูลค่าสต๊อก</AlertTitle>
          {balances.valuation.reason}
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="สต๊อกอะไหล่"
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="balance" sx={{ minHeight: 44, fontWeight: 600 }} label={tabLabel("คงเหลือ", tabCount(balances ? balances.count : null))} />
        <Tab value="low" sx={{ minHeight: 44, fontWeight: 600 }} label={tabLabel("ใกล้หมด", tabCount(balances ? lowStock.length : null, true))} />
        <Tab value="moves" sx={{ minHeight: 44, fontWeight: 600 }} label="ความเคลื่อนไหว" />
        <Tab value="locations" sx={{ minHeight: 44, fontWeight: 600 }} label={tabLabel("คลัง", tabCount(locationsLoading ? null : locations.length))} />
      </Tabs>

      {tab === "balance" || tab === "low" ? (
        <>
          {filtersRow}
          <WomsDataTable
            caption={tab === "low" ? "อะไหล่ใกล้หมด" : "ยอดคงเหลืออะไหล่แยกตามคลัง"}
            rows={tab === "low" ? lowRows : balanceRows}
            loading={!balances && !error}
            columns={pivotCols}
            rowKey={(r) => r.partId}
            pageSize={25}
            emptyTitle={tab === "low" ? "ไม่มีอะไหล่ที่ต่ำกว่าจุดสั่งซื้อ" : q || locFilter ? "ไม่พบอะไหล่ที่ตรงเงื่อนไข" : "ยังไม่มีอะไหล่ในระบบ"}
            renderCard={balanceCard}
          />
        </>
      ) : null}

      {tab === "moves" ? (
        <>
          {allowedMoves.length > 0 ? (
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openMove(allowedMoves.includes("ISSUE") ? "ISSUE" : allowedMoves[0])} data-testid="stock-move-other">
                บันทึกการเคลื่อนไหว (เบิก / คืน / ปรับยอด)
              </Button>
            </Stack>
          ) : null}
          <WomsDataTable
            caption="ประวัติการเคลื่อนไหว"
            rows={txns}
            columns={txCols}
            rowKey={(t) => t.id}
            pageSize={25}
            emptyTitle="ยังไม่มีการเคลื่อนไหว"
            renderCard={(t) => (
              <Box sx={cardBox}>
                <Typography sx={{ color: "text.primary" }}>
                  {t.moveLabel} · <span className="mono">{t.partCode}</span> × {t.qty}
                </Typography>
                <Typography variant="body2">
                  {t.fromLocationName || "—"} → {t.toLocationName || "—"}
                  {t.jobId ? ` · ${t.jobId}` : ""}
                </Typography>
                <Typography variant="body2">
                  {bangkokDateTime(t.at)} · {t.byName}
                </Typography>
              </Box>
            )}
          />
        </>
      ) : null}

      {tab === "locations" ? (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="body2">ทุกการรับเข้า/เบิกจ่าย/โอนย้ายต้องระบุคลัง — ถ้ายังไม่มีคลัง ให้สร้างที่นี่ก่อน</Typography>
            {canManage ? (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  locErr.clear();
                  setShowLocForm(true);
                }}
              >
                เพิ่มคลัง
              </Button>
            ) : null}
          </Stack>
          <WomsDataTable
            caption="คลังอะไหล่"
            rows={locations}
            loading={locationsLoading}
            columns={locColsWithStock}
            rowKey={(l) => l.id}
            pageSize={10}
            emptyTitle="ยังไม่มีคลังในระบบ"
            emptyDescription={`ระบบยังบันทึกการเคลื่อนไหวสต๊อกไม่ได้จนกว่าจะมีคลังอย่างน้อย 1 แห่ง${canManage ? " กด “เพิ่มคลัง” เพื่อเริ่ม" : " กรุณาแจ้งผู้ดูแลระบบให้สร้างคลังให้"}`}
            renderCard={(l) => (
              <Box sx={cardBox}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                    {l.name || l.code} <span className="mono">({l.code})</span>
                  </Typography>
                  <WomsStatusChip label={l.active ? "ใช้งาน" : "ปิดใช้งาน"} tone={l.active ? "success" : "neutral"} />
                </Stack>
                <Typography variant="body2">
                  {l.typeLabel}
                  {l.ownerName ? ` · ${l.ownerName}` : ""} · คงเหลือ {locValue(l.id)?.qty ?? 0}
                  {l.note ? ` · ${l.note}` : ""}
                </Typography>
              </Box>
            )}
          />
        </>
      ) : null}

      {/* ---- หน้าต่างบันทึกการเคลื่อนไหว (ทุกชนิดตามสิทธิ์) ---- */}
      <Dialog open={moveOpen} onClose={() => !busy && setMoveOpen(false)} fullWidth maxWidth="md" aria-labelledby="stock-move-title">
        <DialogTitle id="stock-move-title">{STOCK_MOVE_LABEL[move]}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={g}>
              <TextField
                select
                {...moveErr.mui("move", "เลือกชนิดของรายการก่อน ระบบจะถามเฉพาะช่องที่จำเป็น")}
                label="ประเภท"
                value={move}
                onChange={(e) => setMove(e.target.value as StockMove)}
              >
                {allowedMoves.map((m) => (
                  <MenuItem key={m} value={m}>
                    {STOCK_MOVE_LABEL[m]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={g}>
              <TextField
                select
                required
                {...moveErr.mui("partId", "อะไหล่ที่เคลื่อนไหวในรายการนี้")}
                label="อะไหล่"
                value={partId}
                onChange={(e) => setPartId(e.target.value)}
              >
                <MenuItem value="">— เลือกอะไหล่ —</MenuItem>
                {parts.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={g}>
              <NumberInput
                required
                {...moveErr.mui("qty", "ต้องมากกว่า 0")}
                label="จำนวน"
                integer
                value={qty}
                onValueChange={(t) => setQty(t)}
              />
            </Grid>
            {needsFrom ? (
              <Grid size={g}>
                <TextField
                  select
                  required
                  {...moveErr.mui("fromLocationId", "คลังต้นทางที่ตัดยอดออก")}
                  label="จากคลัง"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  <MenuItem value="">— เลือกคลัง —</MenuItem>
                  {locOptions}
                </TextField>
              </Grid>
            ) : null}
            {/* QA BUG-042 — ปรับยอดต้องเลือกทิศทางได้ ไม่งั้นบันทึก "ของขาด" ไม่ได้เลย */}
            {move === "ADJUST" ? (
              <Grid size={g}>
                <TextField
                  select
                  id={moveErr.fid("adjustDir")}
                  label="ทิศทางการปรับยอด"
                  value={adjustDir}
                  onChange={(e) => setAdjustDir(e.target.value as "UP" | "DOWN")}
                  helperText={adjustDir === "DOWN" ? "ระบบจะตัดยอดออกจากคลังที่เลือก และไม่ยอมให้ยอดติดลบ" : "ระบบจะเพิ่มยอดเข้าคลังที่เลือก"}
                >
                  <MenuItem value="UP">ปรับขึ้น — ของนับได้มากกว่าในระบบ</MenuItem>
                  <MenuItem value="DOWN">ปรับลง — ของนับได้น้อยกว่าในระบบ</MenuItem>
                </TextField>
              </Grid>
            ) : null}
            {needsTo || move === "ADJUST" ? (
              <Grid size={g}>
                <TextField
                  select
                  required
                  {...moveErr.mui(
                    "toLocationId",
                    move === "ADJUST" ? `คลังที่จะปรับยอด${adjustDir === "DOWN" ? "ลง" : "ขึ้น"}` : "คลังปลายทางที่รับยอดเข้า"
                  )}
                  label={move === "ADJUST" ? "คลังที่ปรับยอด" : "เข้าคลัง"}
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                >
                  <MenuItem value="">— เลือกคลัง —</MenuItem>
                  {locOptions}
                </TextField>
              </Grid>
            ) : null}
            {move === "RECEIVE" ? (
              <Grid size={g}>
                <NumberInput
                  {...moveErr.mui("unitCost", "ราคาทุนต่อหน่วยของรอบรับเข้านี้ (บาท)")}
                  label="ราคาทุนต่อหน่วย"
                  value={unitCost}
                  onValueChange={(t) => setUnitCost(t)}
                />
              </Grid>
            ) : null}
            {/* BR-03 — ผูกอะไหล่กับใบงาน (บันทึกการใช้อะไหล่ทางการ) ทำได้เฉพาะ Admin · ช่างระบุในหมายเหตุแทน */}
            {(move === "ISSUE" || move === "RETURN") && has("jobs:edit") ? (
              <Grid size={g}>
                <TextField
                  {...moveErr.mui("jobId", "ใส่เลขใบงานถ้ารายการนี้ผูกกับงาน")}
                  label="ใบงานที่เกี่ยวข้อง"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder="เช่น JN-2026-0001"
                />
              </Grid>
            ) : null}
            <Grid size={12}>
              <TextField {...moveErr.mui("note")} label="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={busy} onClick={submitMove} data-testid="stock-move-submit">
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- ดูรูปอะไหล่ ---- */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="sm" fullWidth aria-labelledby="stock-part-preview-title">
        <DialogTitle id="stock-part-preview-title">{preview?.alt}</DialogTitle>
        <DialogContent dividers sx={{ display: "grid", placeItems: "center" }}>
          {preview ? <Box component="img" src={preview.src} alt={preview.alt} data-testid="stock-part-preview-img" sx={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} /> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* ---- หน้าต่างเพิ่มอะไหล่ ---- */}
      <Dialog open={showPartForm} onClose={() => !busy && setShowPartForm(false)} fullWidth maxWidth="md" aria-labelledby="stock-part-title">
        <DialogTitle id="stock-part-title">เพิ่มอะไหล่</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid size={g}>
                <TextField required {...partErr.mui("code", "ห้ามซ้ำกับอะไหล่อื่น")} label="รหัสอะไหล่" value={newPart.code} onChange={(e) => setNewPart({ ...newPart, code: e.target.value })} />
              </Grid>
              <Grid size={g}>
                <TextField required {...partErr.mui("name")} label="ชื่ออะไหล่" value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} />
              </Grid>
              <Grid size={g}>
                <TextField {...partErr.mui("unit", "หน่วยนับ เช่น ชิ้น ชุด")} label="หน่วย" value={newPart.unit} onChange={(e) => setNewPart({ ...newPart, unit: e.target.value })} />
              </Grid>
              <Grid size={g}>
                <NumberInput
                  {...partErr.mui("reorderPoint", "ยอดต่ำกว่านี้จะขึ้นแจ้งเตือน")}
                  label="จุดสั่งซื้อ"
                  integer
                  value={newPart.reorderPoint}
                  onValueChange={(t) => setNewPart((p) => ({ ...p, reorderPoint: t }))}
                />
              </Grid>
              <Grid size={g}>
                <NumberInput
                  {...partErr.mui("standardCost", "บาทต่อหน่วย")}
                  label="ราคาทุนมาตรฐาน"
                  value={newPart.standardCost}
                  onValueChange={(t) => setNewPart((p) => ({ ...p, standardCost: t }))}
                />
              </Grid>
              <Grid size={g}>
                <NumberInput
                  {...partErr.mui("sellPrice", "บาทต่อหน่วย")}
                  label="ราคาขาย"
                  value={newPart.sellPrice}
                  onValueChange={(t) => setNewPart((p) => ({ ...p, sellPrice: t }))}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  รูปอะไหล่ (ไม่บังคับ)
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                  {newPart.image ? (
                    <Box
                      component="img"
                      src={newPart.image}
                      alt="รูปอะไหล่"
                      data-testid="stock-part-image-preview"
                      sx={{ width: 120, height: 120, objectFit: "cover", borderRadius: 1, border: 1, borderColor: "divider" }}
                    />
                  ) : (
                    <Box sx={{ width: 120, height: 120, display: "grid", placeItems: "center", color: "text.disabled", border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 1 }}>
                      <ImageNotSupportedIcon />
                    </Box>
                  )}
                  <Stack spacing={1} alignItems="flex-start">
                    <Stack direction="row" spacing={1}>
                      <Button component="label" variant="outlined" startIcon={<PhotoCameraIcon />} disabled={imgBusy || busy}>
                        {imgBusy ? "กำลังโหลดรูป…" : newPart.image ? "เปลี่ยนรูป" : "เพิ่มรูป"}
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          data-testid="stock-part-image-input"
                          onChange={(e) => {
                            void pickPartImage(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </Button>
                      {newPart.image ? (
                        <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setNewPart((p) => ({ ...p, image: "" }))} disabled={busy}>
                          ลบรูป
                        </Button>
                      ) : null}
                    </Stack>
                    <Typography variant="caption" color={partErr.mui("image").error ? "error" : "text.secondary"}>
                      {partErr.mui("image").error ? partErr.mui("image").helperText : "ถ่ายรูปหรือเลือกไฟล์ภาพ ระบบย่อขนาดให้อัตโนมัติ"}
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPartForm(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={busy || imgBusy} onClick={addPart}>
            บันทึกอะไหล่
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- หน้าต่างเพิ่มคลัง (QA BUG-021) ---- */}
      <Dialog open={showLocForm} onClose={() => !busy && setShowLocForm(false)} fullWidth maxWidth="md" aria-labelledby="stock-loc-title">
        <DialogTitle id="stock-loc-title">เพิ่มคลังอะไหล่</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid size={g}>
                <TextField
                  required
                  {...locErr.mui("code", "ใช้อ้างอิงภายใน ห้ามซ้ำกับคลังอื่น")}
                  label="รหัสคลัง"
                  value={newLoc.code}
                  onChange={(e) => setNewLoc({ ...newLoc, code: e.target.value })}
                  placeholder="เช่น MAIN-01 หรือ TECH-somchai"
                />
              </Grid>
              <Grid size={g}>
                <TextField
                  {...locErr.mui("name", "ชื่อที่ผู้ใช้เห็นในรายการเลือกคลัง")}
                  label="ชื่อคลัง"
                  value={newLoc.name}
                  onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                  placeholder="เว้นว่างได้ — จะใช้รหัสคลังเป็นชื่อ"
                />
              </Grid>
              <Grid size={g}>
                <TextField
                  select
                  {...locErr.mui("type", "คลังช่าง = สต๊อกติดรถของช่างแต่ละคน")}
                  label="ประเภทคลัง"
                  value={newLoc.type}
                  onChange={(e) => setNewLoc({ ...newLoc, type: e.target.value as StockLocationType })}
                >
                  {LOCATION_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {newLoc.type === "TECH" ? (
                <Grid size={g}>
                  <TextField
                    select
                    required
                    {...locErr.mui("ownerUserId", techs.length ? "ช่างที่ถือสต๊อกคลังนี้" : "ไม่พบรายชื่อช่าง (ต้องมีสิทธิ์ดูคิว)")}
                    label="ช่างเจ้าของคลัง"
                    value={newLoc.ownerUserId}
                    onChange={(e) => {
                      const u = techs.find((x) => x.id === e.target.value);
                      setNewLoc({ ...newLoc, ownerUserId: e.target.value, ownerName: u?.name ?? "" });
                    }}
                  >
                    {techs.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              ) : null}
              <Grid size={12}>
                <TextField {...locErr.mui("note")} label="หมายเหตุ" value={newLoc.note} onChange={(e) => setNewLoc({ ...newLoc, note: e.target.value })} />
              </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLocForm(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button variant="contained" disabled={busy} onClick={addLocation}>
            {busy ? "กำลังบันทึก…" : "บันทึกคลัง"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
