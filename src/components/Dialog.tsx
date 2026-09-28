"use client";

/**
 * กล่องโต้ตอบในหน้า — แทน window.prompt() / window.confirm()
 * ---------------------------------------------------------------------------
 * QA BUG-016 / BUG-017 / BUG-019 · Part B ข้อ B-05, B-06, B-10
 *
 * เดิมระบบใช้ `window.prompt()` เป็น "ช่องกรอกข้อมูลจริง" 15 จุด (ลง Serial จริง ·
 * เหตุผลยกเลิก · วันที่นัดใหม่ของแผน PM · ความจุ slot · ยอดใบลดหนี้ · ทีม/โซนของช่าง ·
 * และ **ตั้งรหัสผ่านผู้ใช้ใหม่** ซึ่ง prompt ไม่มีโหมดปิดบัง รหัสผ่านจึงโผล่เป็นข้อความเปิด)
 * ข้อจำกัดของ prompt ที่แก้ที่ต้นทางไม่ได้เลย:
 *   - ไม่มี label ถาวร ไม่มี helper text ไม่มีช่อง error → B-05/B-06 เป็นไปไม่ได้
 *   - บังคับชนิดข้อมูลไม่ได้ (ต้องพิมพ์ YYYY-MM-DD เอง → รับ 2026-13-45 ได้ = BUG-019)
 *   - ผู้ใช้ติ๊ก "ป้องกันไม่ให้หน้านี้สร้างกล่องโต้ตอบเพิ่มเติม" แล้วปุ่มเงียบสนิททั้งหมด
 *
 * ย้ายไป MUI Dialog แล้ว (มาตรฐาน UI ของ WOMS) — focus trap · Esc · คืนโฟกัส ได้จาก MUI
 * API เดิม (prompt/confirm) ไม่เปลี่ยน จุดเรียกเดิมทั้งระบบจึงไม่ต้องแก้
 *
 * API เป็น promise เพื่อให้จุดเรียกเดิมเปลี่ยนน้อยที่สุด:
 *   const v = await dialog.prompt({ ... });  // null = ผู้ใช้ยกเลิก
 *   if (await dialog.confirm({ ... })) { ... }
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

export type PromptInputType = "text" | "textarea" | "date" | "number" | "password";

export interface PromptOptions {
  title: string;
  /** label ถาวรของช่องกรอก (B-05) */
  label: string;
  /** ข้อความอธิบายใต้ช่อง — ใช้ช่องเดียวกับ error จึงไม่ทำให้ความสูงกระตุก */
  help?: string;
  defaultValue?: string;
  type?: PromptInputType;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  /** ปุ่มยืนยันเป็นสีอันตราย (การกระทำที่ย้อนกลับไม่ได้) */
  danger?: boolean;
  /** ข้อความอธิบายเหนือช่องกรอก */
  message?: string;
  /** ตรวจค่าก่อนยืนยัน — คืนข้อความเมื่อผิด, คืน null เมื่อผ่าน */
  validate?: (value: string) => string | null;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogApi {
  prompt: (opts: PromptOptions) => Promise<string | null>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogApi | null>(null);

type State =
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  // มือถือ: กล่องเต็มจอ ปุ่มอยู่ในระยะนิ้ว ไม่หลุดขอบจอ
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const close = useCallback(() => {
    setState(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (!state) return;
    if (state.kind === "prompt") state.resolve(null);
    else state.resolve(false);
    close();
  }, [state, close]);

  const accept = useCallback(() => {
    if (!state) return;
    if (state.kind === "confirm") {
      state.resolve(true);
      close();
      return;
    }
    const raw = value;
    const o = state.opts;
    if (o.required && !raw.trim()) {
      setError(`ต้องระบุ${o.label}`);
      return;
    }
    const msg = o.validate ? o.validate(raw) : null;
    if (msg) {
      // ค่าที่กรอกยังอยู่ในช่อง ผู้ใช้แก้ต่อได้ทันที
      setError(msg);
      return;
    }
    state.resolve(raw);
    close();
  }, [state, value, close]);

  const api = useMemo<DialogApi>(
    () => ({
      prompt: (opts) =>
        new Promise<string | null>((resolve) => {
          setValue(opts.defaultValue ?? "");
          setError(null);
          setState({ kind: "prompt", opts, resolve });
        }),
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          setError(null);
          setState({ kind: "confirm", opts, resolve });
        }),
    }),
    []
  );

  const o = state?.opts;
  const promptOpts = state?.kind === "prompt" ? (state.opts as PromptOptions) : null;
  const inputType = promptOpts?.type ?? "text";

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog
        open={!!state}
        onClose={cancel}
        fullScreen={fullScreen}
        aria-labelledby="dlg-title"
        aria-describedby={o?.message ? "dlg-msg" : undefined}
      >
        {o ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              accept();
            }}
            style={{ display: "contents" }}
          >
            <DialogTitle id="dlg-title">{o.title}</DialogTitle>
            <DialogContent>
              {o.message ? (
                <DialogContentText id="dlg-msg" sx={{ mb: promptOpts ? 2 : 0 }}>
                  {o.message}
                </DialogContentText>
              ) : null}
              {promptOpts ? (
                <TextField
                  autoFocus
                  id="dlg-field"
                  label={promptOpts.label}
                  required={promptOpts.required}
                  type={inputType === "textarea" ? "text" : inputType}
                  multiline={inputType === "textarea"}
                  minRows={inputType === "textarea" ? 3 : undefined}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  error={!!error}
                  helperText={error ?? promptOpts.help ?? " "}
                  FormHelperTextProps={error ? { role: "alert" } as any : undefined}
                  InputLabelProps={inputType === "date" ? { shrink: true } : undefined}
                  inputProps={{ min: promptOpts.min, max: promptOpts.max, step: promptOpts.step }}
                  sx={{ mt: 1 }}
                />
              ) : null}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={cancel}>{o.cancelLabel ?? "ยกเลิก"}</Button>
              <Button type="submit" variant="contained" color={o.danger ? "error" : "primary"}>
                {o.confirmLabel ?? "ตกลง"}
              </Button>
            </DialogActions>
          </form>
        ) : null}
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog ต้องอยู่ภายใต้ <DialogProvider>");
  return ctx;
}
