"use client";

// ---------------------------------------------------------------------------
// แจ้งผลการทำงาน (บันทึกสำเร็จ / ข้อมูลไม่ถูกต้อง / API ผิดพลาด / ไม่มีสิทธิ์ ...)
// ---------------------------------------------------------------------------
// ย้ายไป MUI Snackbar + Alert โดยคง API เดิมทุกตัว (toast.success/error/info/warning/show)
// จุดเรียกเดิมทั้งหมดในระบบจึงไม่ต้องแก้ · แสดงทีละข้อความตามลำดับ (consecutive snackbars)
// ข้อความ error ที่ส่งมาควรเป็นข้อความที่อ่านได้จาก ApiError เท่านั้น ไม่ใช่ stack ของ backend
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { APPROVAL_PENDING_MESSAGES } from "@/lib/api";

type ToastKind = "error" | "success" | "info" | "warning";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  show: (text: string, kind?: ToastKind) => void;
  error: (text: string) => void;
  success: (text: string) => void;
  info: (text: string) => void;
  warning: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION = 4000;
/** error อยู่นานกว่า เพราะผู้ใช้ต้องอ่านสาเหตุ */
const ERROR_DURATION = 7000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [open, setOpen] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    if (queue.length && !current) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
      setOpen(true);
    } else if (queue.length && current && open) {
      // มีข้อความใหม่ระหว่างแสดง → ปิดอันเดิมให้อันใหม่ขึ้นต่อ
      setOpen(false);
    }
  }, [queue, current, open]);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setQueue((q) => [...q, { id, kind, text }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      // VFB แถว 21: "ส่งคำขออนุมัติแล้ว" ไม่ใช่ข้อผิดพลาด — แสดงเป็นข้อมูล (หน้าฟอร์มเดิมส่งมาทาง error)
      error: (text) => {
        if (APPROVAL_PENDING_MESSAGES.has(text)) {
          APPROVAL_PENDING_MESSAGES.delete(text);
          show(text, "info");
        } else show(text, "error");
      },
      success: (text) => show(text, "success"),
      info: (text) => show(text, "info"),
      warning: (text) => show(text, "warning"),
    }),
    [show]
  );

  const handleClose = (_?: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={current?.id}
        open={open}
        autoHideDuration={current?.kind === "error" ? ERROR_DURATION : DURATION}
        onClose={handleClose}
        TransitionProps={{ onExited: () => setCurrent(null) }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {current ? (
          <Alert
            onClose={handleClose}
            severity={current.kind}
            variant="filled"
            role={current.kind === "error" ? "alert" : "status"}
            closeText="ปิด"
            sx={{ width: "100%", maxWidth: 560 }}
          >
            {current.text}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
