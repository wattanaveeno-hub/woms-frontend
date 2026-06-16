"use client";

import { useEffect, useRef } from "react";

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

  // size the canvas backing store to its displayed size (crisp lines)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
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
        style={{
          width: "100%",
          height,
          border: "1px dashed var(--line-strong)",
          borderRadius: "var(--radius)",
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span className="stat-label">ให้ลูกค้าเซ็นในกรอบด้านบน</span>
        <button type="button" className="btn" style={{ padding: "2px 12px" }} onClick={clear}>
          ล้างลายเซ็น
        </button>
      </div>
    </div>
  );
}
