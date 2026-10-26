"use client";

// FB-14 — กล่องลงนามของผู้ทำรายการ (ส่งชุดวางบิล) · ชื่อผู้ลงนามมาจากบัญชีที่เข้าสู่ระบบ เลือกชื่อคนอื่นไม่ได้
// ใช้แบบ promise: const sig = await sign({ title, summary }) → data URL หรือ null (ยกเลิก)
import { useCallback, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import SignaturePad from "@/components/SignaturePad";
import { useAuth } from "@/lib/AuthContext";

interface SignRequest {
  title: string;
  /** ข้อมูลที่ลายเซ็นนี้ครอบคลุม (แสดงให้ผู้ลงนามเห็นก่อนเซ็น) */
  summary: React.ReactNode;
  confirmLabel?: string;
}

export function useSignOff() {
  const { user } = useAuth();
  const [req, setReq] = useState<SignRequest | null>(null);
  const [sig, setSig] = useState("");
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const sign = useCallback((r: SignRequest) => {
    setSig("");
    setReq(r);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: string | null) => {
    resolver.current?.(v);
    resolver.current = null;
    setReq(null);
  };

  const element = (
    <Dialog open={!!req} onClose={() => close(null)} fullWidth maxWidth="sm">
      <DialogTitle>{req?.title}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>{req?.summary}</Box>
        <Alert severity="info" sx={{ mb: 1.5 }}>
          ลงนามในนาม <strong>{user?.name ?? "—"}</strong> (บัญชีที่เข้าสู่ระบบ) — หนึ่งลายเซ็นครอบคลุมรายการและยอดในชุดนี้ ณ เวลาลงนาม
          หากผู้ตรวจปรับราคาภายหลัง ระบบแยกยอดที่ท่านเสนอออกจากยอดอนุมัติ
        </Alert>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          ลายเซ็นผู้ส่ง *
        </Typography>
        {req ? <SignaturePad onChange={setSig} hint="ลงนามในกรอบด้านบน" /> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close(null)}>ยกเลิก</Button>
        <Button variant="contained" disabled={!sig} onClick={() => close(sig)} data-testid="signoff-confirm">
          {req?.confirmLabel ?? "ลงนามและส่ง"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { sign, element };
}
