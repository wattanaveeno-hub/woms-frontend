"use client";
/**
 * ช่องกรอกตัวเลข (Master Execution 14 พ.ย. 2569 — Numeric input UX)
 * - ช่องว่างแสดง placeholder "0" (หรือ placeholder ของช่อง) ไม่ใส่ "0" เป็นข้อความ → พิมพ์ "50000" ได้ "50000"
 * - ค่า 0 ที่เป็นค่าเริ่มต้นแสดงเป็นช่องว่าง (zeroAsEmpty) · ช่องที่ 0 มีความหมายต่างจากว่าง ส่ง zeroAsEmpty={false}
 * - type="text" + inputMode (decimal / numeric) → แป้นตัวเลขบนมือถือ และไม่เกิดอาการ "050000" ของ input type=number
 * - label ยกขึ้นเสมอ (shrink) เพื่อให้เห็น placeholder ตอนช่องว่าง
 * - ไม่แปลงช่องว่างเป็น 0 เอง: onValueChange ส่ง (ข้อความ, ตัวเลขหรือ null) ให้ฟอร์มใช้กติกาเดิมของตัวเอง
 * - รับ value เป็นตัวเลขหรือข้อความ · ซิงก์ใหม่เมื่อค่าจากภายนอกเปลี่ยนจริง (ไม่รบกวนระหว่างพิมพ์ เช่น "13.")
 */
import { useEffect, useRef, useState } from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { numericInitialText, numericTextValue, sanitizeNumericText } from "@/lib/moneyInput";

export type NumberInputProps = Omit<TextFieldProps, "value" | "onChange" | "type" | "defaultValue"> & {
  value: number | string | null | undefined;
  onValueChange: (text: string, value: number | null) => void;
  integer?: boolean;
  allowNegative?: boolean;
  /** ค่า 0 จากภายนอกแสดงเป็นช่องว่าง (ค่าเริ่มต้น true) */
  zeroAsEmpty?: boolean;
};

export default function NumberInput({ value, onValueChange, integer, allowNegative, zeroAsEmpty = true, placeholder, inputProps, InputLabelProps, ...rest }: NumberInputProps) {
  const [text, setText] = useState(() => numericInitialText(value, zeroAsEmpty));
  const last = useRef<string>(text);
  useEffect(() => {
    // ค่าจากภายนอกเปลี่ยน (โหลดข้อมูลใหม่/รีเซ็ตฟอร์ม) และมีค่าตัวเลขต่างจากที่กำลังพิมพ์ → แสดงค่าใหม่
    // ค่าตัวเลขเท่ากัน (เช่น "13." กับ 13 · "0" ที่ผู้ใช้พิมพ์เองกับค่า 0) → คงข้อความที่ผู้ใช้พิมพ์ไว้
    const ext = numericInitialText(value, zeroAsEmpty);
    const raw = value === null || value === undefined ? "" : String(value).trim();
    const extNum = raw === "" ? null : numericTextValue(raw);
    const cur = numericTextValue(last.current);
    if (extNum === cur) return;
    if (extNum === 0 && cur === null && zeroAsEmpty) return;
    last.current = ext;
    setText(ext);
  }, [value, zeroAsEmpty]);
  return (
    <TextField
      {...rest}
      type="text"
      value={text}
      placeholder={placeholder ?? "0"}
      // label ต้องยกขึ้นเสมอ ไม่เช่นนั้น MUI ซ่อน placeholder (opacity 0) ตอนช่องว่างและไม่ได้โฟกัส → ผู้ใช้ไม่เห็น "0"
      InputLabelProps={{ shrink: true, ...(InputLabelProps ?? {}) }}
      inputProps={{ inputMode: integer ? "numeric" : "decimal", ...(inputProps ?? {}) }}
      onChange={(e) => {
        const s = sanitizeNumericText(e.target.value, { integer, allowNegative });
        last.current = s;
        setText(s);
        onValueChange(s, numericTextValue(s));
      }}
    />
  );
}
