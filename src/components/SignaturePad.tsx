"use client";

import { useEffect, useRef } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/theme/tokens";
import { signatureShouldReset } from "@/lib/uiRules";

export interface SignaturePadProps {
  // called with a PNG data URL after each stroke, or "" when cleared
  onChange: (dataUrl: string) => void;
  height?: number;
  /** ข้อความใต้กรอบ — ค่าเริ่มต้นสำหรับลายเซ็นลูกค้า; ลายเซ็นผู้ทำรายการ (ช่าง/ผู้ส่งบิล) ต้องส่งข้อความของตัวเอง */
  hint?: string;
}

export default function SignaturePad({ onChange, height = 180, hint = "ให้ลูกค้าเซ็นในกรอบด้านบน" }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const measureRef = useRef<() => void>(() => {});

  // size the canvas backing store to its displayed size (crisp lines)
  // UX-R3-01: วัดด้วย ResizeObserver (หลังจัดวางจริง) + resize ของหน้าต่าง · ไม่วัดตอนที่ยังไม่มีความกว้าง
  //   เมื่อความกว้างเปลี่ยน (เช่นหมุนจอ หรือวัดครั้งแรกก่อนจัดวางเสร็จ) คงภาพลายเซ็นเดิมโดยย่อ/ขยายตามกรอบใหม่ — ไม่ล้างทิ้ง
  //   แล้วแจ้งฟอร์มด้วยภาพใหม่ (ภาพที่ส่ง = ภาพที่ผู้ใช้เห็นเสมอ)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastWidth = -1;
    const setup = (cssWidth: number) => {
      const dpr = window.devicePixelRatio || 1;
      let snapshot: HTMLCanvasElement | null = null;
      if (dirty.current && canvas.width > 1 && canvas.height > 1) {
        snapshot = document.createElement("canvas");
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
      }
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (snapshot) ctx.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#16202b";
      if (snapshot) onChangeRef.current(canvas.toDataURL("image/png"));
    };
    const measure = () => {
      const w = canvas.getBoundingClientRect().width;
      if (w < 2) return; // ยังไม่ถูกจัดวาง (เช่น อยู่ใน dialog ที่กำลังเปิด)
      // มือถือยิง resize ตอนแถบที่อยู่เลื่อนขึ้นลงด้วย — ทำใหม่เฉพาะเมื่อความกว้างเปลี่ยนจริง
      if (lastWidth >= 0 && !signatureShouldReset(lastWidth, w)) return;
      lastWidth = Math.round(w);
      setup(w);
    };
    measureRef.current = measure;
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    ro?.observe(canvas);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    measureRef.current(); // ให้ขนาดภาพตรงกับกรอบที่เห็นก่อนเริ่มลาก
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (dirty.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="ช่องลายเซ็นลูกค้า"
        style={{
          width: "100%",
          height,
          border: `1px dashed ${tokens.lineStrong}`,
          borderRadius: tokens.radius,
          background: "#fff",
          touchAction: "none",
          cursor: "crosshair",
          display: "block",
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.75 }}>
        <Typography variant="body2">{hint}</Typography>
        <Button size="small" variant="outlined" onClick={clear}>
          ล้างลายเซ็น
        </Button>
      </Stack>
    </div>
  );
}
