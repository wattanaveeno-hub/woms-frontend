"use client";

// รหัสลูกค้า ไม่เกิน 8 ตัว (UAT 2026-11-16 · เดิม 8 ตัวพอดี) — กรอกเองได้ · ตรวจรูปแบบทันที · ตรวจซ้ำกับฐานข้อมูลหลังหยุดพิมพ์ · ปุ่มใช้เลขถัดไป
import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { api } from "@/lib/api";
import {
  NEW_CUSTOMER_CODE_LENGTH,
  customerCodeProblemOnSave,
  normalizeCustomerCodeInput,
} from "@/lib/customerCode";

export type CustomerCodeStatus = "idle" | "checking" | "ok" | "taken" | "invalid" | "unchanged";

export interface CustomerCodeFieldProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  /** รหัสเดิมของลูกค้าที่กำลังแก้ ("" = ลูกค้าใหม่) */
  original?: string;
  /** id ลูกค้าที่กำลังแก้ — ไม่นับรหัสของตัวเองว่าซ้ำ */
  partnerId?: string;
  disabled?: boolean;
  size?: "small" | "medium";
  /** ข้อความผิดพลาดจากการบันทึก (API) — แสดงแทนผลตรวจ */
  error?: string;
  onStatus?: (s: CustomerCodeStatus) => void;
  /** แสดง * ที่ป้าย (หน้าเพิ่มลูกค้าบังคับกรอก) */
  required?: boolean;
  /** ป้ายอยู่นอกช่อง (หน้าที่ใช้ป้ายเหนือช่องแบบ DS) — ช่องนี้ไม่แสดงป้ายลอย */
  labelOutside?: boolean;
}

export default function CustomerCodeField({
  id,
  value,
  onChange,
  original = "",
  partnerId,
  disabled,
  size,
  error,
  onStatus,
  required,
  labelOutside,
}: CustomerCodeFieldProps) {
  const [status, setStatus] = useState<CustomerCodeStatus>("idle");
  const [msg, setMsg] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const seq = useRef(0);

  const report = (s: CustomerCodeStatus, m: string) => {
    setStatus(s);
    setMsg(m);
    onStatus?.(s);
  };

  // เลขถัดไป — โหลดครั้งเดียวตอนเปิดฟอร์ม (ไม่ล็อกเลข: ถ้ามีคนใช้ไปก่อน ตอนตรวจ/บันทึกจะแจ้งซ้ำ)
  useEffect(() => {
    if (disabled) return;
    let alive = true;
    api
      .checkCustomerCode("")
      .then((r) => alive && setSuggestion(r.suggestion))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [disabled]);

  useEffect(() => {
    const code = normalizeCustomerCodeInput(value);
    const mySeq = ++seq.current;
    if (!code) return report("idle", "");
    if (code.toLowerCase() === normalizeCustomerCodeInput(original).toLowerCase()) {
      return report("unchanged", code.length <= NEW_CUSTOMER_CODE_LENGTH ? "รหัสเดิม" : `รหัสเดิมในระบบ (ยาวกว่า ${NEW_CUSTOMER_CODE_LENGTH} ตัว) ใช้ต่อได้`);
    }
    const problem = customerCodeProblemOnSave(code, original);
    if (problem) return report("invalid", problem);
    report("checking", "กำลังตรวจรหัสซ้ำ…");
    const t = window.setTimeout(() => {
      api
        .checkCustomerCode(code, partnerId)
        .then((r) => {
          if (mySeq !== seq.current) return;
          if (r.problem) report("invalid", r.problem);
          else if (r.taken) report("taken", r.taken.name ? `รหัสนี้ถูกใช้แล้ว: ${r.taken.name}` : "รหัสนี้ถูกใช้แล้ว");
          else report("ok", "ไม่ซ้ำ ใช้รหัสนี้ได้");
        })
        .catch(() => {
          if (mySeq !== seq.current) return;
          // ตรวจไม่สำเร็จ (เน็ต/สิทธิ์) — ไม่บล็อก ให้ backend ตรวจซ้ำอีกครั้งตอนบันทึก
          report("idle", "ตรวจรหัสซ้ำไม่สำเร็จ ระบบจะตรวจอีกครั้งตอนบันทึก");
        });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, original, partnerId]);

  const bad = Boolean(error) || status === "invalid" || status === "taken";
  const helper =
    error ||
    msg ||
    (required
      ? `กรอกเองได้ ไม่เกิน ${NEW_CUSTOMER_CODE_LENGTH} ตัว (ตัวเลขหรือ A–Z เช่น I1234) · ระบบเช็กซ้ำให้ · สาขาต่อท้าย -00, -01 …`
      : `ไม่เกิน ${NEW_CUSTOMER_CODE_LENGTH} ตัว (ตัวเลขหรือ A-Z) · กรอกเองได้ · ระบบตรวจซ้ำให้ · ไม่ระบุก็ได้`);
  const showNext = !disabled && !!suggestion;

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <TextField
        id={id}
        fullWidth
        size={size}
        disabled={disabled}
        label={labelOutside ? undefined : `รหัสลูกค้า (ไม่เกิน ${NEW_CUSTOMER_CODE_LENGTH} ตัว)${required ? " *" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\s+/g, "").toUpperCase())}
        error={bad}
        helperText={status === "ok" && !error ? `✓ ${helper}` : helper}
        FormHelperTextProps={{ sx: status === "ok" && !error ? { color: "success.main" } : undefined }}
        inputProps={{
          maxLength: Math.max(NEW_CUSTOMER_CODE_LENGTH, normalizeCustomerCodeInput(original).length),
          autoComplete: "off",
          spellCheck: false,
          ...(labelOutside ? {} : {}),
          style: { fontWeight: 600, color: "#14432a", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", letterSpacing: "0.04em" },
          "aria-describedby": id ? `${id}-helper-text` : undefined,
        }}
      />
      {showNext ? (
        <Button
          variant="outlined"
          size={size}
          onClick={() => onChange(suggestion!)}
          sx={{ flex: "none", whiteSpace: "nowrap", minHeight: 40, alignSelf: "flex-start" }}
        >
          ใช้เลขถัดไป
        </Button>
      ) : null}
    </Box>
  );
}
