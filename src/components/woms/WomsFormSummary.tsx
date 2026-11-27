"use client";

// ---------------------------------------------------------------------------
// UX Redesign (MOM-02) — ส่วนประกอบกลางของฟอร์มเปิดคิว/เปิดงาน
//   · WomsRequiredLabel   ป้ายช่อง: * (ต้องกรอก) หรือ "(ไม่บังคับ)" — ไม่ใช้สีอย่างเดียว
//   · WomsFormSummary     การ์ดสรุปรายส่วน ทุกแถวเป็นปุ่ม กดแล้วพาไป + focus ช่องแรกที่ยังขาด
//   · WomsValidationSummary  รวมข้อผิดพลาดทุกข้อในครั้งเดียว แต่ละข้อกดไปที่ช่องได้
//   · focusField()        เลื่อนไปและย้าย focus จริง (เคารพ prefers-reduced-motion)
// ยังไม่ผูกกับหน้าใด — ข้อมูลช่องบังคับมาจาก lib/formRequirements.ts (กติกาเดิมของระบบ)
// ---------------------------------------------------------------------------
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { tokens as t } from "@/theme/tokens";
import {
  completionOf,
  sectionSummaries,
  type FormSectionKey,
  type RequirementRow,
  type SectionSummary,
} from "@/lib/formRequirements";

/** สีตัวอักษรบนพื้นส้มอ่อนที่ผ่าน 4.5:1 — ค่าเดียวกับที่ JobSummaryAside ใช้อยู่ */
const OPEN_INK = "#8a5606";

/** เลื่อนไปที่ช่องแล้ว focus จริง ให้ผู้ใช้คีย์บอร์ด/screen reader ไปต่อได้ · คืน false ถ้าไม่พบ element */
export function focusField(id: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  const target: HTMLElement | null =
    el.matches("input, textarea, select, button, [tabindex]") ? el : el.querySelector("input, textarea, select, button, [tabindex]");
  window.setTimeout(() => (target ?? el).focus({ preventScroll: true }), reduce ? 0 : 300);
  return true;
}

export function WomsRequiredLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required: boolean;
}) {
  return (
    <Typography component="label" htmlFor={htmlFor} variant="body2" sx={{ display: "block", mb: 0.75, fontWeight: 600, color: t.slate }}>
      {children}
      {required ? (
        <>
          <Box component="span" aria-hidden="true" sx={{ color: t.danger, ml: 0.5 }}>
            *
          </Box>
          <Box component="span" sx={visuallyHidden}>
            (ต้องกรอก)
          </Box>
        </>
      ) : (
        <Box component="span" sx={{ color: t.slate2, fontWeight: 400, ml: 0.5 }}>
          (ไม่บังคับ)
        </Box>
      )}
    </Typography>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

export interface FormSummarySectionMeta {
  /** ป้ายส่วน เช่น "ต้องการให้ช่างทำอะไร" */
  label: string;
  /** ค่าที่แสดงเมื่อครบ เช่น ชื่อลูกค้า · จำนวนเครื่อง */
  value?: string;
  /** id ของ element ส่วนนั้น (ใช้เมื่อส่วนครบแล้วหรือไม่บังคับ) */
  anchorId: string;
}

function stateLine(s: SectionSummary, meta: FormSummarySectionMeta): { text: string; icon: string; color: string; strong: boolean } {
  if (s.state === "missing") {
    const names = s.rows.filter((r) => r.required && !r.filled).map((r) => r.label);
    return { text: `ต้องกรอกอีก ${s.missingCount} ช่อง: ${names.join(", ")}`, icon: "!", color: OPEN_INK, strong: true };
  }
  if (s.state === "optional") return { text: meta.value ? meta.value : "ไม่บังคับ · ยังไม่ระบุ", icon: "–", color: t.slate2, strong: false };
  return { text: meta.value || "ครบแล้ว", icon: "✓", color: t.slate2, strong: false };
}

/**
 * การ์ดสรุปของฟอร์ม · ตัวนับ "ครบ x/y" นับเฉพาะช่องบังคับจริง (ช่องไม่บังคับไม่ลด %)
 * fieldId(field) = id ของช่องตาม fid() ของฟอร์มนั้น เช่น (f) => `job-${f}`
 */
export function WomsFormSummary({
  title,
  rows,
  sections,
  fieldId,
  actions,
  footnote,
  order,
}: {
  /** ลำดับส่วนตามหน้าจอ (ค่าเริ่มต้น งาน → ลูกค้า → เครื่อง → นัด) */
  order?: FormSectionKey[];
  title: string;
  rows: RequirementRow[];
  sections: Record<FormSectionKey, FormSummarySectionMeta>;
  fieldId: (field: string) => string;
  /** ปุ่มหลัก/ปุ่มบันทึกร่างของฟอร์ม (คงปุ่มและ data-testid เดิมของหน้า) */
  actions?: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  const c = completionOf(rows);
  const secs = sectionSummaries(rows, order);
  return (
    <Paper variant="outlined" component="aside" aria-label={title} sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, color: t.ink }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: t.slate2 }} data-testid="form-summary-count">
          ช่องบังคับครบ {c.requiredDone}/{c.requiredTotal}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={c.percent}
        aria-label={`ช่องบังคับครบ ${c.percent}%`}
        sx={{ my: 1.5, height: 6, borderRadius: 99, bgcolor: t.line, "& .MuiLinearProgress-bar": { bgcolor: t.accent } }}
      />
      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {secs.map((s, i) => {
          const meta = sections[s.section];
          const line = stateLine(s, meta);
          const go = () => {
            if (s.firstMissing && focusField(fieldId(s.firstMissing.field))) return;
            focusField(meta.anchorId);
          };
          return (
            <li key={s.section}>
              <ButtonBase
                onClick={go}
                data-testid={`form-summary-${s.section}`}
                sx={{
                  width: "100%",
                  minHeight: t.touch,
                  justifyContent: "flex-start",
                  textAlign: "left",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1,
                  bgcolor: s.state === "missing" ? t.openBg : "transparent",
                  "&:focus-visible": { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
                }}
              >
                <Box component="span" aria-hidden="true" sx={{ flex: "0 0 20px", fontWeight: 700, color: s.state === "missing" ? OPEN_INK : s.state === "done" ? t.closed : t.slate2 }}>
                  {line.icon}
                </Box>
                <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                  <Box component="span" sx={{ display: "block", fontSize: 13, fontWeight: 600, color: t.slate }}>
                    {i + 1} {meta.label}
                  </Box>
                  <Box component="span" sx={{ display: "block", fontSize: 13, color: line.color, fontWeight: line.strong ? 600 : 400, overflowWrap: "anywhere" }}>
                    {line.text}
                  </Box>
                </Box>
                <Box component="span" aria-hidden="true" sx={{ color: t.slate2 }}>
                  ›
                </Box>
              </ButtonBase>
            </li>
          );
        })}
      </Box>
      {actions ? <Box sx={{ borderTop: `1px solid ${t.line}`, mt: 1.5, pt: 2, display: "flex", flexDirection: "column", gap: 1 }}>{actions}</Box> : null}
      {footnote ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {footnote}
        </Typography>
      ) : null}
    </Paper>
  );
}

/** รวมข้อผิดพลาดทุกข้อในกล่องเดียว · แต่ละข้อเป็นลิงก์ไปที่ช่อง (แทนการแจ้งทีละข้อ) */
export function WomsValidationSummary({
  issues,
  fieldId,
  title = "ยังส่งไม่ได้ กรุณาแก้ช่องต่อไปนี้",
  testId = "validation-summary",
}: {
  issues: Array<{ field: string; message: string }>;
  fieldId: (field: string) => string;
  title?: string;
  testId?: string;
}) {
  if (!issues.length) return null;
  return (
    <Alert severity="error" role="alert" data-testid={testId} sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
        {title} ({issues.length})
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {issues.map((x, i) => (
          <li key={`${x.field}-${i}`}>
            <Link
              component="button"
              type="button"
              onClick={() => focusField(fieldId(x.field))}
              sx={{ textAlign: "left", font: "inherit", color: "inherit", textDecorationColor: "currentColor" }}
            >
              {x.message}
            </Link>
          </li>
        ))}
      </Box>
    </Alert>
  );
}
