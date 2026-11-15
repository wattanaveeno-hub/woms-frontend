"use client";
/**
 * แก้ไขข้อกำหนดเพิ่มเติมในสัญญา (UAT2-18) — เพิ่ม / แก้ / ลบ / เลื่อนขึ้น-ลง / หลายบรรทัด / ดูตัวอย่าง
 * ใช้ทั้งหน้าสร้างสัญญาและหน้ารายละเอียด (สัญญาร่าง) · แสดงผลแบบข้อความเสมอ (React escape — ไม่ใช้ innerHTML)
 */
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useState } from "react";
import { CLAUSE_HEADING, CLAUSE_LIMITS, charCount, clauseNumber, normalizeClauseText, validateClauseTexts } from "@/lib/contractClauses";

export function ContractClausesList({ texts, dense }: { texts: string[]; dense?: boolean }) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: dense ? 1 : 1.5 }} data-testid="clauses-list">
      {texts.map((t, i) => (
        <Box component="li" key={i} sx={{ display: "flex", gap: 1 }} data-testid="clause-item">
          <Typography component="span" sx={{ fontWeight: 700, color: "text.primary", minWidth: 28 }}>
            {clauseNumber(i)}.
          </Typography>
          <Typography component="span" sx={{ color: "text.primary", whiteSpace: "pre-wrap", overflowWrap: "anywhere", flex: 1 }}>
            {normalizeClauseText(t)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function ContractClausesEditor({
  value,
  onChange,
  disabled,
  showErrors,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** แสดงข้อผิดพลาดทุกข้อ (หลังกดบันทึก) — ก่อนหน้านั้นแสดงเฉพาะข้อที่แก้แล้ว */
  showErrors?: boolean;
}) {
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState(false);
  const { perItem, overall } = validateClauseTexts(value);
  const set = (i: number, t: string) => onChange(value.map((x, j) => (j === i ? t : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => {
    onChange(value.filter((_, j) => j !== i));
    setTouched(new Set());
  };
  const full = value.length >= CLAUSE_LIMITS.maxClauses;

  return (
    <Stack spacing={1.5} data-testid="clauses-editor">
      <Typography variant="body2" color="text.secondary">
        ไม่บังคับ · พิมพ์ต่อจากข้อ {clauseNumber(0) - 1} ของสัญญา (เริ่มข้อ {clauseNumber(0)}) ก่อนส่วนลงนาม · ข้อความธรรมดา ขึ้นบรรทัดใหม่ได้ ·
        สูงสุด {CLAUSE_LIMITS.maxClauses} ข้อ ข้อละ {CLAUSE_LIMITS.maxChars.toLocaleString("th-TH")} ตัวอักษร / {CLAUSE_LIMITS.maxLines} บรรทัด · แก้ได้เฉพาะสัญญาร่าง
      </Typography>
      {value.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }} data-testid="clauses-empty">
          ไม่มีข้อกำหนดเพิ่มเติม — เอกสารสัญญาพิมพ์ตามแบบฟอร์มเดิม
        </Typography>
      ) : preview ? (
        <Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }} data-testid="clauses-preview">
          <Typography sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>{CLAUSE_HEADING}</Typography>
          <ContractClausesList texts={value} />
        </Box>
      ) : (
        value.map((t, i) => {
          const err = (showErrors || touched.has(i)) && perItem[i] ? perItem[i] : null;
          const n = charCount(normalizeClauseText(t));
          return (
            <Stack key={i} direction="row" spacing={1} alignItems="flex-start" data-testid="clause-row">
              <Typography sx={{ fontWeight: 700, pt: 1.25, minWidth: 30, color: "text.primary" }}>{clauseNumber(i)}.</Typography>
              <TextField
                multiline
                minRows={2}
                maxRows={12}
                value={t}
                disabled={disabled}
                onChange={(e) => set(i, e.target.value)}
                onBlur={() => setTouched((s) => new Set(s).add(i))}
                error={!!err}
                helperText={err ?? `${n.toLocaleString("th-TH")}/${CLAUSE_LIMITS.maxChars.toLocaleString("th-TH")} ตัวอักษร`}
                inputProps={{ "aria-label": `ข้อกำหนดเพิ่มเติม ข้อ ${clauseNumber(i)}`, "data-testid": "clause-input" }}
                sx={{ flex: 1 }}
              />
              <Stack spacing={0.25}>
                <Tooltip title="เลื่อนขึ้น">
                  <span>
                    <IconButton size="small" aria-label={`เลื่อนข้อ ${clauseNumber(i)} ขึ้น`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="เลื่อนลง">
                  <span>
                    <IconButton size="small" aria-label={`เลื่อนข้อ ${clauseNumber(i)} ลง`} disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="ลบข้อนี้">
                  <span>
                    <IconButton size="small" color="error" aria-label={`ลบข้อ ${clauseNumber(i)}`} disabled={disabled} onClick={() => remove(i)} data-testid="clause-delete">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          );
        })
      )}
      {overall ? (
        <Typography variant="body2" color="error" role="alert">
          {overall}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button startIcon={<AddIcon />} variant="outlined" disabled={disabled || full || preview} onClick={() => onChange([...value, ""])} data-testid="clause-add">
          เพิ่มข้อ
        </Button>
        {value.length ? (
          <Button variant="text" onClick={() => setPreview((p) => !p)} aria-pressed={preview} data-testid="clause-preview-toggle">
            {preview ? "กลับไปแก้ไข" : "ดูตัวอย่าง"}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
