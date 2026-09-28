"use client";

// อะไหล่ที่เบิกใช้กับใบงานนี้ (STK-FN-005) + ปุ่มเบิกจากคลังของช่างเอง
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import type { Part, StockLocation, StockTransaction } from "@/lib/types";
import { bangkokDateTime } from "@/lib/date";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid2";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WomsDataTable, WomsFormSection, type WomsColumn } from "@/components/woms";

function newIdemKey(): string {
  return `job-issue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function JobPartsCard({ jobId, closed }: { jobId: string; closed: boolean }) {
  const { user, has } = useAuth();
  const toast = useToast();
  const canIssue = has("stock:issue") && !closed;

  const [items, setItems] = useState<StockTransaction[] | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [partId, setPartId] = useState("");
  const [fromId, setFromId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [idemKey, setIdemKey] = useState(newIdemKey);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.jobParts(jobId);
      setItems(r.items);
    } catch (e) {
      // ผู้ใช้ที่ไม่มีสิทธิ์ดูสต๊อกจะได้ 403 — ซ่อนการ์ดไปเลย
      setItems([]);
      if (e instanceof ApiError && e.status !== 403) setError(e.message);
    }
    if (canIssue) {
      try {
        const [p, l] = await Promise.all([
          api.listParts({ activeOnly: true }),
          api.listStockLocations({}),
        ]);
        setParts(p.items);
        // ช่างเบิกจากคลังของตัวเองเป็นหลัก — เรียงคลังตัวเองขึ้นก่อน
        const mine = l.items.filter((x) => x.ownerUserId === user?.id);
        setLocations([...mine, ...l.items.filter((x) => x.ownerUserId !== user?.id)]);
        if (mine[0]) setFromId(mine[0].id);
      } catch {
        /* ไม่มีสิทธิ์ดู master — ปล่อยว่าง */
      }
    }
  }, [jobId, canIssue, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const issue = async () => {
    if (!partId || !fromId) {
      toast.error("เลือกอะไหล่และคลังก่อน");
      return;
    }
    setBusy(true);
    try {
      await api.stockMove({
        partId,
        move: "ISSUE",
        qty: Number(qty) || 0,
        fromLocationId: fromId,
        jobId,
        idempotencyKey: idemKey,
      });
      toast.success("บันทึกการใช้อะไหล่แล้ว");
      setIdemKey(newIdemKey());
      setQty("1");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (items === null) return null;
  if (items.length === 0 && !canIssue) return null;

  const qtyText = (t: StockTransaction) => `${t.move === "RETURN" ? "+" : "-"}${t.qty}`;
  const columns: WomsColumn<StockTransaction>[] = [
    { key: "at", label: "เวลา", sortValue: (t) => t.at, render: (t) => <span className="mono">{bangkokDateTime(t.at)}</span> },
    {
      key: "part",
      label: "อะไหล่",
      sortValue: (t) => t.partCode,
      render: (t) => (
        <>
          <span className="mono">{t.partCode}</span>{" "}
          <Typography component="span" variant="body2">
            {t.partName}
          </Typography>
        </>
      ),
    },
    { key: "qty", label: "จำนวน", align: "right", render: (t) => <span className="mono">{qtyText(t)}</span> },
    { key: "loc", label: "จากคลัง", render: (t) => t.fromLocationName || t.toLocationName || "—" },
    { key: "by", label: "ผู้เบิก", render: (t) => t.byName },
  ];

  return (
    <WomsFormSection title="อะไหล่ที่ใช้กับใบงานนี้">
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {canIssue ? (
        <Grid container spacing={1.5} sx={{ mb: 2 }} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField select label="อะไหล่" value={partId} onChange={(e) => setPartId(e.target.value)}>
              <MenuItem value="">— เลือกอะไหล่ —</MenuItem>
              {parts.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 8, md: 4 }}>
            <TextField select label="เบิกจากคลัง" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <MenuItem value="">— เลือกคลัง —</MenuItem>
              {locations.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name} ({l.typeLabel})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <TextField label="จำนวน" type="number" inputProps={{ min: 1, inputMode: "numeric" }} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Grid>
          <Grid size={12}>
            <Button variant="contained" disabled={busy} onClick={issue}>
              {busy ? "กำลังบันทึก…" : "บันทึกการใช้"}
            </Button>
          </Grid>
        </Grid>
      ) : null}

      <WomsDataTable
        caption="อะไหล่ที่เบิกใช้"
        rows={items}
        columns={columns}
        rowKey={(t) => t.id}
        pageSize={10}
        emptyTitle="ยังไม่มีการเบิกอะไหล่กับใบงานนี้"
        renderCard={(t) => (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Typography sx={{ color: "text.primary" }}>
              <span className="mono">{t.partCode}</span> {t.partName} · <strong className="mono">{qtyText(t)}</strong>
            </Typography>
            <Typography variant="body2">
              {bangkokDateTime(t.at)} · {t.fromLocationName || t.toLocationName || "—"} · {t.byName}
            </Typography>
          </Box>
        )}
      />
    </WomsFormSection>
  );
}
