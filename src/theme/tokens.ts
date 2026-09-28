// ---------------------------------------------------------------------------
// WOMS design tokens — แหล่งเดียวของสีและขนาดที่ theme ของ MUI และ CSS เดิมใช้ร่วมกัน
// ---------------------------------------------------------------------------
// ค่าชุดนี้ตรงกับตัวแปร :root ใน app/globals.css ทุกค่า (หน้าเดิมที่ยังไม่ย้ายไป MUI
// จึงหน้าตาเหมือนหน้าที่ย้ายแล้ว) — ถ้าจะเปลี่ยนสี ให้เปลี่ยนทั้งสองที่พร้อมกัน
export const tokens = {
  ink: "#16202b",
  slate: "#2e3f4f",
  slate2: "#51626f",
  paper: "#f6f8fa",
  surface: "#ffffff",
  surface2: "#fafcfd",
  line: "#e2e7ec",
  lineStrong: "#cdd6dd",
  accent: "#0e7c86",
  accentInk: "#0a5b63",
  accentBg: "#dff0f1",
  open: "#b5730a",
  openBg: "#fdf3e2",
  closed: "#4f7a52",
  closedBg: "#eef3ec",
  danger: "#b3261e",
  dangerBg: "#fbeceb",
  chip: "#eef2f5",
  info: "#0b6aa2",
  infoBg: "#e6f1f8",
  radius: 8,
  /** เป้าสัมผัสขั้นต่ำ (WCAG 2.5.5) — ปุ่มสำคัญบนมือถือช่างใช้ค่านี้ */
  touch: 44,
  sans: '"Sarabun", "Noto Sans Thai", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Tahoma", sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", "JetBrains Mono", "Consolas", monospace',
} as const;
