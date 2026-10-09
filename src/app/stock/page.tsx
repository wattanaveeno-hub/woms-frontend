"use client";

// ---------------------------------------------------------------------------
// ระบบสต๊อกอะไหล่ (STK-FN-001..010)
// ---------------------------------------------------------------------------
// หน้าเดียวรวม: ยอดคงเหลือรายคลัง · Master อะไหล่ · บันทึกการเคลื่อนไหว · ประวัติ

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
import Collapse from "@mui/material/Collapse";
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
  WomsFormSection,
  WomsPageHeader,
  WomsStatCard,
  WomsStatGrid,
  WomsStatusChip,
  type WomsColumn,
} from "@/components/woms";

// สิทธิ์ของแต่ละชนิดการเคลื่อนไหว — ตรงกับ MOVE_PERMISSION ของ backend (src/routes/stock.ts)
const MOVE_PERMISSION: Record<StockMove, string> = {
  RECEIVE: "stock:receive",
  ISSUE: "stock:issue",
  TRANSFER: "stock:transfer",
  RETURN: "stock:issue",
  ADJUST: "stock:adjust",
};
const cardBox = { border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 } as const;

// ประเภทคลังตรงกับ STOCK_LOCATION_TYPES ของ backend (src/domain/part.ts)
const LOCATION_TYPES: Array<{ value: StockLocationType; label: string }> = [
  { value: "MAIN", label: "คลังหลัก" },
  { value: "TECH", label: "คลังช่าง" },
];

const EMPTY_LOCATION = { code: "", name: "", type: "MAIN" as StockLocationType, ownerName: "", note: "" };

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
  const moveErr = useFieldErrors("mv");
  const partErr = useFieldErrors("pt");

  // ฟอร์มเพิ่มคลัง (QA BUG-021 — เดิมไม่มีหน้าจอใดสร้างคลังได้เลย)
  const [showLocForm, setShowLocForm] = useState(false);
  const [newLoc, setNewLoc] = useState(EMPTY_LOCATION);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const locErr = useFieldErrors("loc");

  // ฟอร์มเพิ่มอะไหล่
  const [showPartForm, setShowPartForm] = useState(false);
  const [newPart, setNewPart] = useState({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0" });

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
    if (newLoc.type === "TECH" && !newLoc.ownerName.trim()) {
      locErr.setIssue("ownerName", "คลังช่างต้องระบุชื่อช่างเจ้าของคลัง");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createStockLocation({
        code,
        name: newLoc.name.trim() || code,
        type: newLoc.type,
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
      if (!locErr.fromApi(e, ["code", "name", "type", "ownerName", "note"])) {
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
      });
      toast.success("เพิ่มอะไหล่แล้ว");
      setShowPartForm(false);
      setNewPart({ code: "", name: "", unit: "ชิ้น", reorderPoint: "0", standardCost: "0", sellPrice: "0" });
      await load();
    } catch (e) {
      if (!partErr.fromApi(e, ["code", "name", "unit", "reorderPoint", "standardCost", "sellPrice"])) {
        toast.error(e instanceof ApiError ? e.message : "เพิ่มอะไหล่ไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  };

  const lowStock = useMemo(() => (balances?.items ?? []).filter((r) => r.belowReorder), [balances]);

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
  const balCols: WomsColumn<StockBalanceRow>[] = [
    { key: "code", label: "รหัส", sortValue: (r) => r.code, render: (r) => <span className="mono">{r.code}</span> },
    { key: "name", label: "ชื่อ", sortValue: (r) => r.name, render: (r) => r.name },
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
    { key: "cost", label: "ต้นทุน/หน่วย", align: "right", hideBelowLg: true, render: (r) => <span className="mono">{r.unitCost === null ? "—" : r.unitCost.toLocaleString("th-TH")}</span> },
    { key: "value", label: "มูลค่า", align: "right", sortValue: (r) => r.totalValue ?? -1, render: (r) => <span className="mono">{r.totalValue === null ? "—" : r.totalValue.toLocaleString("th-TH")}</span> },
  ];
  const txCols: WomsColumn<StockTransaction>[] = [
    { key: "at", label: "เวลา", sortValue: (t) => t.at, render: (t) => <span className="mono">{bangkokDateTime(t.at)}</span> },
    { key: "move", label: "ประเภท", sortValue: (t) => t.moveLabel, render: (t) => t.moveLabel },
    { key: "part", label: "อะไหล่", sortValue: (t) => t.partCode, render: (t) => <span className="mono">{t.partCode}</span> },
    { key: "qty", label: "จำนวน", align: "right", render: (t) => <span className="mono">{t.qty}</span> },
    { key: "loc", label: "จาก → เข้า", render: (t) => `${t.fromLocationName || "—"} → ${t.toLocationName || "—"}` },
    { key: "job", label: "ใบงาน", render: (t) => (t.jobId ? <span className="mono">{t.jobId}</span> : "—") },
    { key: "by", label: "ผู้ทำรายการ", hideBelowLg: true, render: (t) => t.byName },
  ];

  return (
    <>
      <WomsPageHeader
        title="สต๊อกอะไหล่"
        subtitle={balances ? `${balances.count} รายการ · ต่ำกว่าจุดสั่งซื้อ ${balances.belowReorder} รายการ` : undefined}
      />

      {error ? <WomsErrorState message={error} onRetry={load} /> : null}

      {balances && !balances.valuation.method ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>ยังไม่ได้กำหนดวิธีคิดมูลค่าสต๊อก</AlertTitle>
          {balances.valuation.reason}
        </Alert>
      ) : null}

      {lowStock.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          อะไหล่ต่ำกว่าจุดสั่งซื้อ: {lowStock.map((r) => `${r.code} (${r.totalQty}/${r.reorderPoint})`).join(" · ")}
        </Alert>
      ) : null}

      {/* ---- มูลค่ารายคลัง ---- */}
      {balances && balances.byLocation.length > 0 ? (
        <WomsStatGrid>
          {balances.byLocation.map((l) => (
            <WomsStatCard
              key={l.locationId}
              value={l.qty}
              label={l.locationName}
              hint={l.value !== null ? `${l.value.toLocaleString("th-TH")} บาท` : undefined}
            />
          ))}
        </WomsStatGrid>
      ) : null}

      {/* ---- คลังอะไหล่ (QA BUG-021) — วางไว้ "ก่อน" ฟอร์มการเคลื่อนไหว เพราะเป็นข้อมูลที่ต้องมีก่อน ---- */}
      <WomsFormSection
        title="คลังอะไหล่"
        actions={
          canManage ? (
            <Button
              size="small"
              startIcon={showLocForm ? undefined : <AddIcon />}
              onClick={() => {
                setShowLocForm((v) => !v);
                locErr.clear();
              }}
              aria-expanded={showLocForm}
            >
              {showLocForm ? "ปิดฟอร์ม" : "เพิ่มคลัง"}
            </Button>
          ) : undefined
        }
      >
        <Typography variant="body2" sx={{ mb: 2 }}>
          ทุกการรับเข้า/เบิกจ่าย/โอนย้ายต้องระบุคลัง — ถ้ายังไม่มีคลัง ให้สร้างที่นี่ก่อน
        </Typography>
        <Collapse in={showLocForm} unmountOnExit>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
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
                    required
                    {...locErr.mui("ownerName", "ชื่อช่างที่ถือสต๊อกคลังนี้")}
                    label="ช่างเจ้าของคลัง"
                    value={newLoc.ownerName}
                    onChange={(e) => setNewLoc({ ...newLoc, ownerName: e.target.value })}
                  />
                </Grid>
              ) : null}
              <Grid size={12}>
                <TextField {...locErr.mui("note")} label="หมายเหตุ" value={newLoc.note} onChange={(e) => setNewLoc({ ...newLoc, note: e.target.value })} />
              </Grid>
            </Grid>
            <Button variant="contained" sx={{ mt: 2 }} disabled={busy} onClick={addLocation}>
              {busy ? "กำลังบันทึก…" : "บันทึกคลัง"}
            </Button>
          </Paper>
        </Collapse>

        <WomsDataTable
          caption="คลังอะไหล่"
          rows={locations}
          loading={locationsLoading}
          columns={locCols}
          rowKey={(l) => l.id}
          pageSize={10}
          emptyTitle="ยังไม่มีคลังในระบบ"
          emptyDescription={`ระบบยังบันทึกการเคลื่อนไหวสต๊อกไม่ได้จนกว่าจะมีคลังอย่างน้อย 1 แห่ง${
            canManage ? " กด “เพิ่มคลัง” เพื่อเริ่ม" : " กรุณาแจ้งผู้ดูแลระบบให้สร้างคลังให้"
          }`}
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
                {l.ownerName ? ` · ${l.ownerName}` : ""}
                {l.note ? ` · ${l.note}` : ""}
              </Typography>
            </Box>
          )}
        />
      </WomsFormSection>

      {/* ---- บันทึกการเคลื่อนไหว (แสดงเฉพาะผู้มีสิทธิ์อย่างน้อยหนึ่งชนิด) ---- */}
      {allowedMoves.length > 0 ? (
        <WomsFormSection title="บันทึกการเคลื่อนไหว">
          <Grid container spacing={2}>
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
              <TextField
                required
                {...moveErr.mui("qty", "ต้องมากกว่า 0")}
                label="จำนวน"
                type="number"
                inputProps={{ min: 1, step: 1, inputMode: "numeric" }}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
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
                <TextField
                  {...moveErr.mui("unitCost", "ราคาทุนต่อหน่วยของรอบรับเข้านี้ (บาท)")}
                  label="ราคาทุนต่อหน่วย"
                  type="number"
                  inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
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
          {/* B-09 — ขณะที่ฟอร์มย่อย (เพิ่มคลัง/เพิ่มอะไหล่) เปิดอยู่ ปุ่มหลักคือปุ่มของฟอร์มนั้น */}
          <Button variant={showLocForm || showPartForm ? "outlined" : "contained"} sx={{ mt: 2 }} disabled={busy} onClick={submitMove}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </WomsFormSection>
      ) : null}

      {/* ---- ยอดคงเหลือ ---- */}
      <WomsFormSection
        title="ยอดคงเหลือ"
        actions={
          canManage ? (
            <Button size="small" startIcon={showPartForm ? undefined : <AddIcon />} onClick={() => setShowPartForm((v) => !v)} aria-expanded={showPartForm}>
              {showPartForm ? "ปิดฟอร์ม" : "เพิ่มอะไหล่"}
            </Button>
          ) : undefined
        }
      >
        <Collapse in={showPartForm} unmountOnExit>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
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
                <TextField
                  {...partErr.mui("reorderPoint", "ยอดต่ำกว่านี้จะขึ้นแจ้งเตือน")}
                  label="จุดสั่งซื้อ"
                  type="number"
                  inputProps={{ min: 0, step: 1, inputMode: "numeric" }}
                  value={newPart.reorderPoint}
                  onChange={(e) => setNewPart({ ...newPart, reorderPoint: e.target.value })}
                />
              </Grid>
              <Grid size={g}>
                <TextField
                  {...partErr.mui("standardCost", "บาทต่อหน่วย")}
                  label="ราคาทุนมาตรฐาน"
                  type="number"
                  inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
                  value={newPart.standardCost}
                  onChange={(e) => setNewPart({ ...newPart, standardCost: e.target.value })}
                />
              </Grid>
              <Grid size={g}>
                <TextField
                  {...partErr.mui("sellPrice", "บาทต่อหน่วย")}
                  label="ราคาขาย"
                  type="number"
                  inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
                  value={newPart.sellPrice}
                  onChange={(e) => setNewPart({ ...newPart, sellPrice: e.target.value })}
                />
              </Grid>
            </Grid>
            <Button variant="contained" sx={{ mt: 2 }} disabled={busy} onClick={addPart}>
              บันทึกอะไหล่
            </Button>
          </Paper>
        </Collapse>

        <WomsDataTable
          caption="ยอดคงเหลืออะไหล่"
          rows={balances?.items ?? []}
          loading={!balances && !error}
          columns={balCols}
          rowKey={(r) => r.partId}
          pageSize={25}
          emptyTitle="ยังไม่มีอะไหล่ในระบบ"
          renderCard={(r) => (
            <Box sx={cardBox}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                  <span className="mono">{r.code}</span> {r.name}
                </Typography>
                {r.belowReorder ? <WomsStatusChip label="ต่ำกว่าจุดสั่งซื้อ" tone="warning" /> : null}
              </Stack>
              <Typography variant="body2">
                คงเหลือ {r.totalQty} {r.unit} · จุดสั่งซื้อ {r.reorderPoint || "—"}
                {r.totalValue !== null ? ` · มูลค่า ${r.totalValue.toLocaleString("th-TH")}` : ""}
              </Typography>
              {r.byLocation.length ? (
                <Typography variant="body2">{r.byLocation.map((l) => `${l.locationName}: ${l.qty}`).join(" · ")}</Typography>
              ) : null}
            </Box>
          )}
        />
      </WomsFormSection>

      {/* ---- ประวัติการเคลื่อนไหว ---- */}
      <WomsFormSection title="ประวัติการเคลื่อนไหวล่าสุด">
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
      </WomsFormSection>
    </>
  );
}
