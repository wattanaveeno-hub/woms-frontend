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
}

export default function SignaturePad({ onChange, height = 180 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // size the canvas backing store to its displayed size (crisp lines)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastWidth = -1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // มือถือยิง resize ตอนแถบที่อยู่เลื่อนขึ้นลงด้วย — ล้างเฉพาะเมื่อความกว้างเปลี่ยนจริง (เช่นหมุนจอ)
      const reset = signatureShouldReset(lastWidth, rect.width);
      if (lastWidth >= 0 && !reset) return;
      lastWidth = Math.round(rect.width);
      // การปรับขนาด canvas ล้างภาพเสมอ → แจ้งฟอร์มว่าลายเซ็นหายแล้ว ไม่ให้ส่งลายเซ็นที่ผู้ใช้มองไม่เห็น
      if (reset && dirty.current) {
        dirty.current = false;
        onChangeRef.current("");
      }
      // preserve nothing on resize (clear) — signatures are short-lived
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#16202b";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [height]);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
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
        <Typography variant="body2">ให้ลูกค้าเซ็นในกรอบด้านบน</Typography>
        <Button size="small" variant="outlined" onClick={clear}>
          ล้างลายเซ็น
        </Button>
      </Stack>
    </div>
  );
}
