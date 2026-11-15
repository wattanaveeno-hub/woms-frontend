"use client";
/**
 * ข้อกำหนดเพิ่มเติมในสัญญา (UAT2-18) — หน้ารายละเอียดสัญญาเช่า
 * แสดงตามลำดับที่บันทึก · เลขข้อเดียวกับเอกสารพิมพ์ · หลายบรรทัด
 * แก้ได้เฉพาะสัญญาร่าง + สิทธิ์ contracts:edit (Admin → ส่งคำขออนุมัติ 202 เหมือนการแก้สัญญาอื่น)
 * สัญญาที่ออกแล้ว: แสดงอย่างเดียว — ระบบยังไม่มีขั้นตอนแก้ไขสัญญา (amendment)
 */
import { useState } from "react";
import { api, ApiError, ApprovalPendingError } from "@/lib/api";
import type { Contract } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { WomsFormSection, WomsStatusChip } from "@/components/woms";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import ContractClausesEditor, { ContractClausesList } from "@/components/ContractClausesEditor";
import { CLAUSE_HEADING, clausesOf, toClausePayload, validateClauseTexts } from "@/lib/contractClauses";

export default function ContractClausesCard({ contract: c, canEdit, onSaved }: { contract: Contract; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast();
  const saved = clausesOf(c).map((x) => x.text);
  const [open, setOpen] = useState(false);
  const [texts, setTexts] = useState<string[]>(saved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  if (c.type !== "RENTAL") return null;
  const editable = canEdit && c.status === "DRAFT";

  const start = () => {
    setTexts(saved);
    setErr(null);
    setShowErrors(false);
    setOpen(true);
  };
  const save = async () => {
    const v = validateClauseTexts(texts);
    if (v.overall || v.perItem.some(Boolean)) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.contractEdit(c.id, { additionalClauses: toClausePayload(texts) }, c.updatedAt);
      toast.success(`บันทึกข้อกำหนดเพิ่มเติมของสัญญา ${c.contractNo} แล้ว`);
      setOpen(false);
      onSaved();
    } catch (e) {
      if (e instanceof ApprovalPendingError) {
        toast.info(e.message);
        setOpen(false);
        return;
      }
      setErr(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <WomsFormSection
      title={CLAUSE_HEADING}
      titleAdornment={saved.length ? <WomsStatusChip label={`${saved.length} ข้อ`} tone="info" /> : null}
      actions={
        editable ? (
          <Button onClick={start} data-testid="clauses-edit">
            {saved.length ? "แก้ไข" : "เพิ่มข้อกำหนด"}
          </Button>
        ) : undefined
      }
    >
      <div data-testid="contract-clauses">
        {saved.length ? (
          <ContractClausesList texts={saved} />
        ) : (
          <Typography variant="body2" color="text.secondary" data-testid="clauses-none">
            ไม่มีข้อกำหนดเพิ่มเติม
          </Typography>
        )}
        {!editable && c.status !== "DRAFT" ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }} data-testid="clauses-locked">
            สัญญาออกแล้ว — แก้ไขข้อกำหนดเพิ่มเติมไม่ได้ (แก้ได้เฉพาะสัญญาร่าง)
          </Typography>
        ) : null}
      </div>
      {open ? (
        <Dialog open onClose={() => (busy ? null : setOpen(false))} fullWidth maxWidth="md">
          <DialogTitle>
            {CLAUSE_HEADING} · {c.contractNo}
          </DialogTitle>
          <DialogContent dividers>
            {err ? (
              <Alert severity="error" sx={{ mb: 2 }} role="alert">
                {err}
              </Alert>
            ) : null}
            <ContractClausesEditor value={texts} onChange={setTexts} disabled={busy} showErrors={showErrors} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              ยกเลิก
            </Button>
            <Button variant="contained" onClick={save} disabled={busy} data-testid="clauses-save">
              {busy ? "กำลังบันทึก…" : "บันทึกข้อกำหนด"}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </WomsFormSection>
  );
}
