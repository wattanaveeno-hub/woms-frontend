"use client";
// ---------------------------------------------------------------------------
// UAT 2026-11-16 (Owner): ช่องกรอกวันที่ทั้งระบบแสดง/พิมพ์เป็น วว/ดด/ปปปป (ค.ศ.) เช่น 16/11/2026
//   <input type="date"> ของ browser แสดงตามภาษาเครื่อง (เครื่องที่ตั้งภาษาอังกฤษเห็น mm/dd/yyyy) จึงใช้ช่องข้อความแทน
//   + ปุ่มปฏิทินเปิดตัวเลือกวันของ browser เดิม · ค่าที่ส่งออก (onChange) ยังเป็น YYYY-MM-DD เหมือน type="date"
//   ใช้แทน <TextField type="date" …> ได้ตรง ๆ (props เดิมทั้งหมด · inputProps/slotProps.htmlInput min/max ไปที่ตัวเลือกวัน)
//   พิมพ์ YYYY-MM-DD ก็รับ · พิมพ์ปี พ.ศ. แปลงเป็น ค.ศ. · พิมพ์ไม่ครบ/วันที่ไม่มีจริง = ค่าว่าง + แจ้งใต้ช่องเมื่อออกจากช่อง
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import { fmtDate, parseDisplayDate } from "@/lib/date";

type Props = Omit<TextFieldProps, "type" | "value" | "onChange"> & {
  value?: string | null;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};

function fakeEvent(value: string, name?: string): ChangeEvent<HTMLInputElement> {
  const target = { value, name: name ?? "" } as unknown as HTMLInputElement;
  return { target, currentTarget: target } as unknown as ChangeEvent<HTMLInputElement>;
}

export default function DateField({ value, onChange, inputProps, slotProps, InputProps, helperText, error, disabled, name, onBlur, ...rest }: Props) {
  const iso = value ?? "";
  const [text, setText] = useState(fmtDate(iso));
  const [bad, setBad] = useState(false);
  const lastEmitted = useRef(iso);
  const picker = useRef<HTMLInputElement>(null);

  // ค่าจากภายนอกเปลี่ยน (เช่น กดเลือกวันในปฏิทินช่าง / รีเซ็ตฟอร์ม) → แสดงตาม · ไม่ทับข้อความที่กำลังพิมพ์ของตัวเอง
  useEffect(() => {
    if (iso !== lastEmitted.current) {
      lastEmitted.current = iso;
      setText(fmtDate(iso));
      setBad(false);
    }
  }, [iso]);

  const emit = (next: string) => {
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChange?.(fakeEvent(next, name));
  };

  // min/max/data-testid เดิมอยู่ที่ inputProps หรือ slotProps.htmlInput — แยก min/max ไปที่ตัวเลือกวัน
  const html = { ...((slotProps as any)?.htmlInput ?? {}), ...(inputProps ?? {}) } as Record<string, unknown>;
  const { min, max, ...htmlRest } = html;
  const restSlots = { ...((slotProps as any) ?? {}) };
  delete restSlots.htmlInput;
  const label = (slotProps as any)?.inputLabel;

  return (
    <TextField
      {...rest}
      name={name}
      disabled={disabled}
      value={text}
      placeholder="วว/ดด/ปปปป"
      error={Boolean(error) || bad}
      helperText={bad && !error ? "วันที่ไม่ถูกต้อง — พิมพ์เป็น วว/ดด/ปปปป เช่น 16/11/2026" : helperText}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d/.-]/g, "").slice(0, 10);
        setText(t);
        setBad(false);
        if (!t) return emit("");
        const p = parseDisplayDate(t);
        emit(p ?? "");
      }}
      onBlur={(e) => {
        const p = parseDisplayDate(text);
        if (p) setText(fmtDate(p));
        setBad(!!text && !p);
        onBlur?.(e as any);
      }}
      slotProps={{
        ...restSlots,
        inputLabel: { shrink: true, ...(label ?? {}) },
        htmlInput: { inputMode: "numeric", autoComplete: "off", ...htmlRest },
        input: {
          ...((restSlots as any).input ?? {}),
          ...(InputProps ?? {}),
          endAdornment: (
            <InputAdornment position="end" sx={{ position: "relative" }}>
              <IconButton
                size="small"
                edge="end"
                aria-label="เลือกวันจากปฏิทิน"
                disabled={disabled}
                onClick={() => {
                  const el = picker.current;
                  if (!el) return;
                  try {
                    el.showPicker();
                  } catch {
                    el.focus();
                    el.click();
                  }
                }}
              >
                <CalendarMonthIcon fontSize="small" />
              </IconButton>
              <input
                ref={picker}
                type="date"
                tabIndex={-1}
                aria-hidden
                value={parseDisplayDate(text) ?? ""}
                min={min as string | undefined}
                max={max as string | undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setText(fmtDate(v));
                  setBad(false);
                  emit(v);
                }}
                style={{ position: "absolute", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0, padding: 0 }}
              />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
