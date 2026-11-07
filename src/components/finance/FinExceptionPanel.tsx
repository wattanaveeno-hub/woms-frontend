"use client";

// FIN-1b — รายการ Financial Exception: Package ที่เปิดสิทธิ์แล้วแต่ยอดยืนยันไม่ครบหลังยกเลิกรายการรับเงิน
//   แสดงเฉพาะเมื่อฟังก์ชันเปิด (FIN_VOID_EXCEPTION_ENABLED) และมีรายการค้าง · สิทธิ์ยังใช้ได้ (ไม่ระงับอัตโนมัติ)
//   ACC / Manager (payments:void) รับผิดชอบ / ปิดเรื่องพร้อมผลการดำเนินการ
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { fmtMoney } from "@/lib/options";
import { financeApi, type FinPackageException } from "@/lib/financeApi";

const LABEL: Record<string, string> = { OPEN: "รอดำเนินการ", IN_PROGRESS: "กำลังติดตาม", RESOLVED: "ปิดเรื่องแล้ว" };

export default function FinExceptionPanel() {
  const { has, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<FinPackageException[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await financeApi.exceptions();
      setItems(r.enabled ? r.items.filter((x) => x.status !== "RESOLVED") : []);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!items.length) return null;
  const canAct = has("payments:void");
  const act = async (x: FinPackageException, body: { status?: "IN_PROGRESS" | "RESOLVED"; ownerId?: string; note?: string }) => {
    setBusy(x.id);
    try {
      await financeApi.updateException(x.id, { ...body, expectedUpdatedAt: x.updatedAt });
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };
  return (
    <Alert severity="warning" sx={{ mb: 2 }} data-testid="fin-exception-panel">
      <Typography sx={{ fontWeight: 700, mb: 1 }}>Package เปิดสิทธิ์แล้วแต่ยอดเงินยืนยันไม่ครบ ({items.length})</Typography>
      <Stack spacing={1.5}>
        {items.map((x) => (
          <Stack key={x.id} spacing={0.5} data-testid="fin-exception-row">
            <Typography variant="body2">
              <Link href={`/quotations/${x.quotationId}?tab=payments`} className="code">{x.quotationNo}</Link> · เครื่อง <span className="code">{x.serial}</span> · ใช้สิทธิ์ {x.roundsUsed}/{x.roundsTotal} รอบ ·
              ยกเลิก {x.voidedPaymentNo} ({fmtMoney(x.voidedAmount)}) · ต้องชำระ {fmtMoney(x.amountDue)} · ยืนยันแล้ว {fmtMoney(x.verifiedTotalAfter)} · <b>ขาด {fmtMoney(x.shortfall)}</b>
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Chip size="small" label={LABEL[x.status] ?? x.status} />
              <Typography variant="body2">ผู้รับผิดชอบ: {x.ownerName || "ยังไม่กำหนด"}</Typography>
              {canAct && user ? (
                <>
                  {x.ownerId !== user.id ? (
                    <Button size="small" disabled={busy === x.id} onClick={() => act(x, { ownerId: user.id, status: "IN_PROGRESS" })}>
                      รับผิดชอบเอง
                    </Button>
                  ) : null}
                  <TextField size="small" label="ผลการดำเนินการ" value={note[x.id] ?? ""} onChange={(e) => setNote({ ...note, [x.id]: e.target.value })} />
                  <Button size="small" variant="outlined" disabled={busy === x.id || !(note[x.id] ?? "").trim()} onClick={() => act(x, { status: "RESOLVED", note: note[x.id] })}>
                    ปิดเรื่อง
                  </Button>
                </>
              ) : null}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}
