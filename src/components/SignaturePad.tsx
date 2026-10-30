"use client";

import { useEffect, useRef } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { tokens } from "@/theme/tokens";
import { SignatureStroke, renderSignatureStrokes, signatureHasInk, signatureWidthChanged, toCanonicalPoint } from "@/lib/uiRules";

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
  const last = useRef<{ x: number; y: number } | null>(null);
  // ADV11B-04: เก็บเส้นที่วาด (จุดหน่วย CSS px + ความกว้างกรอบตอนวาด) — ภาพบนกรอบวาดใหม่จากเส้นเหล่านี้เสมอ
  const strokes = useRef<SignatureStroke[]>([]);
  const cssWidth = useRef(0);
  // ADV12-05: ความกว้างฐานของพิกัด canonical (กว้างที่สุดที่เคยวาดที่สัดส่วน 1:1)
  const baseWidth = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const measureRef = useRef<() => void>(() => {});

  // size the canvas backing store to its displayed size (crisp lines)
  // UX-R3-01: วัดด้วย ResizeObserver (หลังจัดวางจริง) + resize ของหน้าต่าง · ไม่วัดตอนที่ยังไม่มีความกว้าง
  //   เมื่อความกว้างเปลี่ยน (เช่นหมุนจอ หรือวัดครั้งแรกก่อนจัดวางเสร็จ) คงลายเซ็นเดิม — ไม่ล้างทิ้ง
  // ADV11B-04/ADV12-05: วาดใหม่ทุกเส้นจากพิกัด canonical ด้วยสัดส่วนเดียว (ดู renderSignatureStrokes) — ากจุดเดิม
  //   สัดส่วนเดียวกันทั้งสองแกน scale = min(1, ความกว้างใหม่ / ความกว้างตอนวาด) ต่อเส้น วางชิดซ้ายบน (ไม่ยืด ไม่เบลอ)
  //   หมุนกลับมาความกว้างเดิม = ภาพเดิม · แล้วแจ้งฟอร์มด้วยภาพใหม่ (ภาพที่ส่ง = ภาพที่ผู้ใช้เห็นเสมอ)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastWidth = -1;
    const setup = (w: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      cssWidth.current = w;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#16202b";
      // ADV12-05: วาดทุกเส้นด้วยสัดส่วนเดียวกัน (พิกัด canonical) · เส้นที่กำลังลากอยู่ขณะกรอบเปลี่ยนขนาดต่อในพิกัดเดียวกัน
      if (drawing.current) last.current = null;
      for (const pts of renderSignatureStrokes(strokes.current, baseWidth.current || w, w)) {
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      if (signatureHasInk(strokes.current)) onChangeRef.current(canvas.toDataURL("image/png"));
    };
    const measure = () => {
      const w = canvas.getBoundingClientRect().width;
      if (w < 2) return; // ยังไม่ถูกจัดวาง (เช่น อยู่ใน dialog ที่กำลังเปิด)
      // มือถือยิง resize ตอนแถบที่อยู่เลื่อนขึ้นลงด้วย — ทำใหม่เฉพาะเมื่อความกว้างเปลี่ยนจริง
      if (lastWidth >= 0 && !signatureWidthChanged(lastWidth, w)) return;
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
    const p = pos(e);
    last.current = p;
    const w = cssWidth.current || canvasRef.current!.getBoundingClientRect().width;
    // กรอบกว้างกว่าฐานเดิม (สัดส่วน 1:1 อยู่แล้ว) → ขยายฐาน · ครั้งแรก = ความกว้างปัจจุบัน
    if (!baseWidth.current || w > baseWidth.current) baseWidth.current = w;
    strokes.current.push({ widthAtDraw: baseWidth.current, points: [toCanonicalPoint(p, baseWidth.current, w)] });
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const stroke = strokes.current[strokes.current.length - 1];
    if (!ctx || !stroke) return;
    const p = pos(e);
    stroke.points.push(toCanonicalPoint(p, baseWidth.current || cssWidth.current, cssWidth.current));
    if (last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (signatureHasInk(strokes.current) && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    strokes.current = [];
    baseWidth.current = 0;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
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
