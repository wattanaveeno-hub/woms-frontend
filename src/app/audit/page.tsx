"use client";

// ---------------------------------------------------------------------------
// ประวัติการใช้งานระบบ (Activity Log / Audit Log)
// ---------------------------------------------------------------------------
// ที่มา: USR-FN-007 "บันทึกประวัติการเข้าใช้งานและการแก้ไขข้อมูลได้" · NFR Audit Log · Activity Log (30 ต.ค. 69)
// สิทธิ์: audit:view (Manager, CEO อ่านอย่างเดียว) หรือ users:manage — บังคับซ้ำที่ backend
// เวลาเก็บเป็น UTC แสดงเป็นเวลาไทย (Asia/Bangkok) · ตัวกรองวันที่คือ "วันไทย"
// แบ่งหน้าที่เซิร์ฟเวอร์ · ส่งออก CSV/Excel ตามตัวกรองเดียวกัน (การส่งออกถูกบันทึก)

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AuditLog, AuthUser } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
  AUDIT_RESULT_OPTIONS,
  auditCompareRows,
  auditHasComparison,
  auditSourceLabel,
  auditTimeText,
  roleLabel,
  type AuditViewerFilters,
} from "@/lib/auditOptions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsDataTable, WomsEmptyState, WomsFilterPanel, WomsPageHeader, WomsSelectFilter, type WomsColumn } from "@/components/woms";

const ENTITY_LABEL = (v: string) => AUDIT_ENTITY_OPTIONS.find((x) => x.value === v)?.label ?? v;
const RESULT_COLOR: Record<string, "success" | "warning" | "error" | "default"> = { SUCCESS: "success", FAILURE: "warning", DENIED: "error" };

export default function AuditPage() {
  // QA BUG-035 / B-14 — ไม่มีสิทธิ์ = แสดงข้อความปฏิเสธเท่านั้น ห้ามปนกับ empty state
  const { status, has } = useAuth();
  const canView = has("users:manage") || has("audit:view");
  const canListUsers = has("users:manage") || has("users:view");

  const [items, setItems] = useState<AuditLog[] | null>(null);
  const [total, setTotal] = useState(0);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"" | "csv" | "xlsx">("");

  // ---- ตัวกรอง ----
  const [q, setQ] = useState("");
  const [actorId, setActorId] = useState("");
  const [actor, setActor] = useState("");
  const [moduleFilter, setModule] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0); // MUI นับจาก 0 · API นับจาก 1
  const [pageSize, setPageSize] = useState(25);
  // พิมพ์แล้วรอ 400ms ค่อยค้น (ช่องข้อความ)
  const [deb, setDeb] = useState({ q: "", actor: "", entityId: "" });
  useEffect(() => {
    const t = setTimeout(() => setDeb({ q: q.trim(), actor: actor.trim(), entityId: entityId.trim() }), 400);
    return () => clearTimeout(t);
  }, [q, actor, entityId]);

  const [users, setUsers] = useState<AuthUser[]>([]);
  useEffect(() => {
    if (!canView || !canListUsers) return;
    api
      .listUsers()
      .then((r) => setUsers(r.items))
      .catch(() => setUsers([]));
  }, [canView, canListUsers]);

  const filters: AuditViewerFilters = {
    q: deb.q || undefined,
    actorId: actorId || undefined,
    actor: deb.actor || undefined,
    module: moduleFilter || undefined,
    action: action || undefined,
    // ข้อมูลที่ถูกกระทำ: ประเภท = โมดูลที่เลือก · id/เลขเอกสาร/SN ค้นแบบ entityRef (id ตรงตัว หรือเลขอ้างอิงบางส่วน)
    entityRef: deb.entityId || undefined,
    result: result || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const filterKey = JSON.stringify(filters);
  // เปลี่ยนตัวกรอง → กลับหน้าแรก
  useEffect(() => setPage(0), [filterKey]);

  const [detail, setDetail] = useState<AuditLog | null>(null);
  // หน้าแรกได้ asOf จากเซิร์ฟเวอร์ → หน้าถัดไปส่งกลับ (หน้าไม่เลื่อนแม้มีเหตุการณ์ใหม่ รวมถึงการเปิดดูของเราเอง)
  const asOfRef = useRef<string | undefined>(undefined);
  const reqSeq = useRef(0);
  const load = useCallback(async () => {
    if (!canView) return;
    const seq = ++reqSeq.current;
    setError(null);
    setDenied(false);
    setItems(null);
    try {
      if (page === 0) asOfRef.current = undefined;
      const r = await api.listAudit({ ...(JSON.parse(filterKey) as AuditViewerFilters), page: page + 1, pageSize, asOf: asOfRef.current });
      if (seq !== reqSeq.current) return;
      if (page === 0) asOfRef.current = r.asOf;
      setItems(r.items);
      setTotal(r.total ?? r.items.length);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      if (e instanceof ApiError && e.status === 403) {
        setDenied(true);
        setItems(null);
        return;
      }
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      setItems(null);
    }
  }, [filterKey, page, pageSize, canView]);

  useEffect(() => {
    load();
  }, [load]);

  const doExport = async (format: "csv" | "xlsx") => {
    setExporting(format);
    setNotice(null);
    try {
      await api.exportAudit(JSON.parse(filterKey) as AuditViewerFilters, format);
      setNotice(`ส่งออก ${format === "csv" ? "CSV" : "Excel"} แล้ว — การส่งออกถูกบันทึกในประวัติการใช้งาน`);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setExporting("");
    }
  };

  if (status !== "authed") return null;
  if (!canView || denied) return <WomsEmptyState title="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" />;

  const compareBtn = (a: AuditLog) =>
    auditHasComparison(a) ? (
      <Button size="small" onClick={() => setDetail(a)} data-testid="audit-compare-btn">
        ก่อน/หลัง ({auditCompareRows(a).length})
      </Button>
    ) : (
      <Button size="small" onClick={() => setDetail(a)}>
        รายละเอียด
      </Button>
    );
  const resultChip = (a: AuditLog) =>
    a.result && a.result !== "SUCCESS" ? (
      <Chip size="small" color={RESULT_COLOR[a.result] ?? "default"} label={a.resultLabel ?? a.result} sx={{ ml: 0.5 }} />
    ) : null;

  const columns: WomsColumn<AuditLog>[] = [
    { key: "at", label: "เวลา (ไทย)", render: (a) => <span className="mono">{auditTimeText(a.at)}</span> },
    {
      key: "actor",
      label: "ผู้ดำเนินการ",
      render: (a) => (
        <>
          {a.actorName}
          {a.actorRole ? <Chip size="small" variant="outlined" label={roleLabel(a.actorRole)} sx={{ ml: 0.75 }} /> : null}
        </>
      ),
    },
    {
      key: "action",
      label: "การกระทำ",
      render: (a) => (
        <>
          {a.actionLabel}
          {resultChip(a)}
        </>
      ),
    },
    {
      key: "entity",
      label: "ข้อมูล",
      render: (a) => (
        <>
          <span className="mono">{a.entityLabel || a.entity}</span>
          <Typography variant="body2" component="div">
            {ENTITY_LABEL(a.module || a.entity)}
            {a.entityId ? <span className="mono"> · {a.entityId}</span> : null}
          </Typography>
        </>
      ),
    },
    {
      key: "summary",
      label: "รายละเอียด",
      render: (a) => (
        <>
          {a.summary}
          {a.reason ? <Typography variant="body2">เหตุผล: {a.reason}</Typography> : null}
          {compareBtn(a)}
        </>
      ),
    },
    { key: "ip", label: "IP / ที่มา", hideBelowLg: true, render: (a) => <span className="mono">{(a.ipAddress || a.ip || "-") + " · " + auditSourceLabel(a.source)}</span> },
  ];

  const activeCount = [q, actorId, actor, moduleFilter, action, result, entityId, from, to].filter(Boolean).length;
  const compare = detail ? auditCompareRows(detail) : [];

  return (
    <>
      <WomsPageHeader title="ประวัติการใช้งานระบบ" subtitle="ใคร ทำอะไร กับข้อมูลชิ้นไหน เปลี่ยนอะไร เมื่อไร ผลเป็นอย่างไร — บันทึกอัตโนมัติ แก้ไข/ลบไม่ได้ · เวลาไทย" />

      <WomsFilterPanel
        activeCount={activeCount}
        onClear={() => {
          setQ("");
          setActorId("");
          setActor("");
          setModule("");
          setAction("");
          setResult("");
          setEntityId("");
          setFrom("");
          setTo("");
        }}
      >
        <TextField label="ค้นหา" placeholder="ข้อความ / เลขอ้างอิง / Request ID" value={q} onChange={(e) => setQ(e.target.value)} fullWidth={false} sx={{ minWidth: 220 }} inputProps={{ "data-testid": "audit-q" }} />
        {users.length ? (
          <WomsSelectFilter
            label="ผู้ใช้"
            value={actorId}
            onChange={(v) => setActorId(v)}
            options={users.map((u) => ({ value: u.id, label: `${u.name} (${roleLabel(u.role)})` }))}
            allLabel="ทุกผู้ใช้"
            minWidth={200}
          />
        ) : null}
        <TextField label="ผู้ดำเนินการ (ชื่อ/id)" placeholder="ชื่อหรือ id ผู้ใช้" value={actor} onChange={(e) => setActor(e.target.value)} fullWidth={false} sx={{ minWidth: 170 }} />
        <WomsSelectFilter label="โมดูล / ประเภทข้อมูล" value={moduleFilter} onChange={(v) => setModule(v)} options={AUDIT_ENTITY_OPTIONS} allLabel="ทุกโมดูล" minWidth={190} />
        <WomsSelectFilter label="การกระทำ" value={action} onChange={(v) => setAction(v)} options={AUDIT_ACTION_OPTIONS} allLabel="ทุกการกระทำ" minWidth={170} />
        <WomsSelectFilter label="ผล" value={result} onChange={(v) => setResult(v)} options={AUDIT_RESULT_OPTIONS} allLabel="ทุกผล" minWidth={140} />
        <TextField
          label="ข้อมูลที่ถูกกระทำ"
          placeholder="id / เลขใบงาน / เลขสัญญา / SN"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          fullWidth={false}
          sx={{ minWidth: 200 }}
          inputProps={{ "data-testid": "audit-entity" }}
        />
        <TextField label="ตั้งแต่วันที่ (ไทย)" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} inputProps={{ "data-testid": "audit-from" }} />
        <TextField label="ถึงวันที่ (ไทย)" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth={false} sx={{ minWidth: 160 }} inputProps={{ "data-testid": "audit-to" }} />
      </WomsFilterPanel>

      <Stack direction="row" spacing={1} sx={{ my: 1, flexWrap: "wrap", alignItems: "center" }}>
        <Button variant="outlined" size="small" disabled={!!exporting} onClick={() => doExport("csv")} data-testid="audit-export-csv">
          {exporting === "csv" ? "กำลังส่งออก…" : "ส่งออก CSV"}
        </Button>
        <Button variant="outlined" size="small" disabled={!!exporting} onClick={() => doExport("xlsx")} data-testid="audit-export-xlsx">
          {exporting === "xlsx" ? "กำลังส่งออก…" : "ส่งออก Excel"}
        </Button>
        <Typography variant="body2" sx={{ ml: 1 }} data-testid="audit-total">
          ทั้งหมด {total.toLocaleString("th-TH")} รายการตามตัวกรอง
        </Typography>
        {notice ? (
          <Typography variant="body2" role="status" sx={{ ml: 1 }}>
            {notice}
          </Typography>
        ) : null}
      </Stack>

      {/* B-14 — error กับ empty state ห้ามแสดงปนกัน (WomsDataTable แสดงอย่างใดอย่างหนึ่งเท่านั้น) */}
      <WomsDataTable
        // key = pageSize: ตารางเก็บจำนวนต่อหน้าไว้ภายใน — เปลี่ยนจำนวนต่อหน้าที่เซิร์ฟเวอร์ต้องสร้างตารางใหม่
        key={pageSize}
        caption="ประวัติการใช้งานระบบ"
        rows={items ?? []}
        loading={items === null && !error}
        error={error}
        onRetry={load}
        columns={columns}
        rowKey={(a) => a.id}
        pageSize={pageSize}
        hidePager
        emptyTitle="ไม่พบรายการตามตัวกรองที่เลือก"
        renderCard={(a) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ color: "text.primary", fontWeight: 600 }}>
              {a.actionLabel} · {a.entityLabel || a.entity}
              {resultChip(a)}
            </Typography>
            <Typography variant="body2">
              {auditTimeText(a.at)} · {a.actorName}
              {a.actorRole ? ` (${roleLabel(a.actorRole)})` : ""}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.primary" }}>
              {a.summary}
            </Typography>
            {compareBtn(a)}
          </Box>
        )}
      />
      {/* แบ่งหน้าที่เซิร์ฟเวอร์ — ตารางด้านบนแสดงเฉพาะหน้านี้ */}
      <TablePagination
        component="div"
        count={total}
        page={total === 0 ? 0 : Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1))}
        onPageChange={(_e, p) => setPage(p)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(Number(e.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="ต่อหน้า"
        labelDisplayedRows={({ from: f, to: t, count }) => `${f}–${t} จาก ${count}`}
        data-testid="audit-pagination"
      />

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="md" fullWidth aria-labelledby="audit-changes-title">
        <DialogTitle id="audit-changes-title">รายละเอียดเหตุการณ์ · ก่อน/หลัง</DialogTitle>
        <DialogContent sx={{ overflowX: "auto" }}>
          {detail ? (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {detail.actionLabel} · {detail.summary}
              </Typography>
              <Table size="small" aria-label="ข้อมูลเหตุการณ์" sx={{ mb: 2 }}>
                <TableBody>
                  {[
                    ["เวลา (ไทย)", auditTimeText(detail.at)],
                    ["เวลา (UTC)", detail.at],
                    ["ผู้ดำเนินการ", `${detail.actorName}${detail.actorRole ? ` (${roleLabel(detail.actorRole)})` : ""}${detail.actorId ? ` · ${detail.actorId}` : ""}`],
                    ["ข้อมูล", `${ENTITY_LABEL(detail.module || detail.entity)} · ${detail.entityLabel || "-"}${detail.entityId ? ` · ${detail.entityId}` : ""}`],
                    ["ผล", detail.resultLabel ?? detail.result ?? "สำเร็จ"],
                    ["เหตุผล", detail.reason || "-"],
                    ["ที่มา / IP", `${auditSourceLabel(detail.source)} · ${detail.ipAddress || detail.ip || "-"}`],
                    ["Request ID", detail.requestId || "-"],
                  ].map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell sx={{ width: 160, fontWeight: 600 }}>{k}</TableCell>
                      <TableCell className="mono" sx={{ overflowWrap: "anywhere" }}>
                        {v}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {compare.length ? (
                <Table size="small" aria-label="ข้อมูลที่เปลี่ยน ก่อน/หลัง" data-testid="audit-compare-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>ฟิลด์</TableCell>
                      <TableCell>ก่อน</TableCell>
                      <TableCell>หลัง</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {compare.map((c) => (
                      <TableRow key={c.field} sx={c.changed ? { bgcolor: "action.hover" } : undefined}>
                        <TableCell className="mono">{c.field}</TableCell>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>{c.before || "(ว่าง)"}</TableCell>
                        <TableCell sx={{ overflowWrap: "anywhere" }}>{c.after || "(ว่าง)"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2">เหตุการณ์นี้ไม่มีข้อมูลก่อน/หลัง</Typography>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
