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
 * กล่องนี้ทำครบตาม B-10 ด้วยตัวเอง: focus trap · ปิดด้วย Esc · คืนโฟกัสกลับที่ปุ่มเดิม
 * และใช้ CSS ชุดเดิมของโปรเจกต์ (ไม่มี UI library ใหม่ ไม่มี dependency ใหม่)
 *
 * API เป็น promise เพื่อให้จุดเรียกเดิมเปลี่ยนน้อยที่สุด:
 *   const v = await dialog.prompt({ ... });  // null = ผู้ใช้ยกเลิก
 *   if (await dialog.confirm({ ... })) { ... }
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setState(null);
    setError(null);
    setValue("");
    // B-10 — คืนโฟกัสกลับที่ element ที่เปิดกล่อง
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    if (back && document.contains(back)) back.focus();
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
      setError(msg);
      return;
    }
    state.resolve(raw);
    close();
  }, [state, value, close]);

  // focus trap + Esc (B-10) — เบราว์เซอร์ให้ฟรีเฉพาะกับ prompt/confirm ของตัวเอง
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    // โฟกัสช่องแรกในกล่องทันทีที่เปิด
    const t = window.setTimeout(() => {
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLElement>("input, textarea, select") ??
        panel?.querySelector<HTMLElement>("button");
      target?.focus();
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.select();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
    };
  }, [state, cancel]);

  const api = useMemo<DialogApi>(
    () => ({
      prompt: (opts) =>
        new Promise<string | null>((resolve) => {
          returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
          setValue(opts.defaultValue ?? "");
          setError(null);
          setState({ kind: "prompt", opts, resolve });
        }),
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
          setError(null);
          setState({ kind: "confirm", opts, resolve });
        }),
    }),
    []
  );

  const o = state?.opts;
  const isPrompt = state?.kind === "prompt";
  const promptOpts = isPrompt ? (o as PromptOptions) : null;
  const inputType = promptOpts?.type ?? "text";
  const fieldId = "dlg-field";
  const errorId = "dlg-field-error";

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state ? (
        <div className="dialog-backdrop" onMouseDown={cancel}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dlg-title"
            ref={panelRef}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="dialog-title" id="dlg-title">
              {o!.title}
            </h2>

            {o!.message ? <p className="dialog-msg">{o!.message}</p> : null}

            {promptOpts ? (
              <div className="field">
                <label htmlFor={fieldId}>
                  {promptOpts.label}
                  {promptOpts.required ? <span className="req">*</span> : null}
                </label>
                {inputType === "textarea" ? (
                  <textarea
                    id={fieldId}
                    className="textarea"
                    value={value}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setError(null);
                    }}
                  />
                ) : (
                  <input
                    id={fieldId}
                    className="input"
                    type={inputType}
                    value={value}
                    min={promptOpts.min}
                    max={promptOpts.max}
                    step={promptOpts.step}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        accept();
                      }
                    }}
                  />
                )}
                {error ? (
                  <span className="field-error" id={errorId} role="alert">
                    {error}
                  </span>
                ) : (
                  <span className="field-hint">{promptOpts.help || " "}</span>
                )}
              </div>
            ) : null}

            <div className="dialog-actions">
              <button className="btn" onClick={cancel}>
                {o!.cancelLabel ?? "ยกเลิก"}
              </button>
              <button
                className={o!.danger ? "btn btn-danger" : "btn btn-primary"}
                onClick={accept}
              >
                {o!.confirmLabel ?? "ตกลง"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog ต้องอยู่ภายใต้ <DialogProvider>");
  return ctx;
}
