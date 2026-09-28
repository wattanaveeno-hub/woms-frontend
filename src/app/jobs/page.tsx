"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { api, ApiError } from "@/lib/api";
import type { JobDateScope, JobListItem, JobStatus, Options } from "@/lib/types";
import { jobTypeLabel, subTypeLabel, fmtDateTime, statusLabel } from "@/lib/options";
import { useUrlFilters } from "@/lib/urlFilters";
import { FEATURES } from "@/lib/features";
import { JOB_STATUS_FILTER } from "@/lib/uiRules";
import {
  JobStatusChip,
  WomsDataTable,
  WomsFilterPanel,
  WomsPageHeader,
  WomsSearchBar,
  type WomsColumn,
} from "@/components/woms";

const STATUS_OPTIONS: JobStatus[] = JOB_STATUS_FILTER;

function typeText(j: JobListItem) {
  return `${jobTypeLabel[j.jobType]}${
    j.jobSubType ? ` · ${subTypeLabel[j.jobSubType as "PICKUP_REPAIR" | "RETURN"]}` : ""
  }`;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[]>([]); // รายการไม่มีรูป/ลายเซ็น (Phase 9.1)
  const [options, setOptions] = useState<Options | null>(null);
  /*
   * QA BUG-009 — ตัวกรองสะท้อนลง URL แล้ว ทำให้ส่งลิงก์/bookmark/F5/ปุ่ม Back ใช้งานได้จริง
   * `dateScope` ยังเป็นช่วงวันนัดที่เซิร์ฟเวอร์เป็นคนเทียบให้ (ใช้โดยการ์ดบนแดชบอร์ด)
   * ตัวกรองทั้งหมดส่งให้ API กรอง (ไม่ได้กรองเฉพาะฝั่งหน้าเว็บ)
   */
  const [f, setF] = useUrlFilters({ status: "", dateScope: "", team: "", q: "" });
  const status = f.status as JobStatus | "";
  const dateScope = f.dateScope as JobDateScope | "";
  const team = f.team;
  const q = f.q;
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  // หน่วงคำค้น ~350ms กันยิง API ทุกตัวอักษร (ทีม/สถานะยังกรองทันที)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    // กันคำตอบที่มาช้าทับผลลัพธ์ใหม่กว่า — นับรอบไว้ แล้วเช็คก่อน set state
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listJobs({
        status: status || undefined,
        team: team || undefined,
        dateScope: dateScope || undefined,
        q: qDebounced || undefined,
      });
      if (seq !== loadSeqRef.current) return;
      setJobs(res.jobs);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [status, team, dateScope, qDebounced]);

  useEffect(() => {
    api.getOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chatButton = (j: JobListItem) =>
    // HIDE-01: แชทต่องานซ่อนไว้จนกว่าจะเปิดฟังก์ชัน
    FEATURES.chat ? (
      <Tooltip title="เปิดแชท / ส่งงาน">
        <IconButton
          size="small"
          component={Link}
          href={`/jobs/${j.jobId}/chat`}
          aria-label={`เปิดแชทงาน ${j.jobId}`}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <ChatBubbleOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : null;

  const columns: WomsColumn<JobListItem>[] = [
    {
      key: "jobId",
      label: "รหัสงาน",
      sortValue: (j) => j.jobId,
      render: (j) => (
        <Link href={`/jobs/${j.jobId}`} className="code" onClick={(e) => e.stopPropagation()}>
          {j.jobId}
        </Link>
      ),
    },
    {
      key: "type",
      label: "ประเภท",
      sortValue: typeText,
      render: (j) => <Chip size="small" variant="outlined" label={typeText(j)} />,
    },
    { key: "name", label: "ชื่องาน", sortValue: (j) => j.jobName, render: (j) => j.jobName },
    {
      key: "team",
      label: "ทีมช่าง",
      hideBelowLg: true,
      sortValue: (j) => j.technicianTeam || "",
      render: (j) => j.technicianTeam || "—",
    },
    {
      key: "date",
      label: "วัน/เวลา",
      sortValue: (j) => `${j.jobDate ?? ""} ${j.jobTime ?? ""}`,
      render: (j) => (
        <Typography component="span" sx={{ fontFamily: "var(--mono, monospace)", fontSize: 13, color: "text.primary" }}>
          {fmtDateTime(j.jobDate, j.jobTime)}
        </Typography>
      ),
    },
    { key: "status", label: "สถานะ", sortValue: (j) => j.status, render: (j) => <JobStatusChip status={j.status} /> },
    ...(FEATURES.chat
      ? [{ key: "chat", label: "", width: 52, render: chatButton } as WomsColumn<JobListItem>]
      : []),
  ];

  const activeCount = [status, dateScope, team].filter(Boolean).length;

  return (
    <>
      <WomsPageHeader
        title="งานทั้งหมด"
        subtitle={loading ? "กำลังโหลด…" : `${jobs.length} งาน`}
        actions={
          <Button component={Link} href="/jobs/new" variant="contained" startIcon={<AddIcon />}>
            เปิดงาน
          </Button>
        }
      />

      <WomsFilterPanel
        search={
          <WomsSearchBar value={q} onChange={(v) => setF({ q: v })} placeholder="ชื่องาน / ผู้ติดต่อ / รุ่น / รหัสงาน" />
        }
        activeCount={activeCount}
        onClear={() => setF({ status: "", dateScope: "", team: "" })}
      >
        <TextField
          select
          label="สถานะ"
          value={status}
          onChange={(e) => setF({ status: e.target.value })}
          sx={{ minWidth: 150 }}
          fullWidth={false}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {statusLabel[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="ช่วงวันนัด"
          value={dateScope}
          onChange={(e) => {
            const v = e.target.value as JobDateScope | "";
            // นิยามของช่วงวันนัดรวม "ยังเปิดอยู่" อยู่แล้ว
            setF(v ? { dateScope: v, status: "OPEN" } : { dateScope: "" });
          }}
          sx={{ minWidth: 150 }}
          fullWidth={false}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          <MenuItem value="TODAY">นัดวันนี้</MenuItem>
          <MenuItem value="OVERDUE">เลยกำหนดนัด</MenuItem>
        </TextField>
        {options?.teams.length ? (
          <TextField
            select
            label="ทีมช่าง"
            value={team}
            onChange={(e) => setF({ team: e.target.value })}
            sx={{ minWidth: 150 }}
            fullWidth={false}
          >
            <MenuItem value="">ทุกทีม</MenuItem>
            {options.teams.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <TextField
            label="ทีมช่าง"
            value={team}
            onChange={(e) => setF({ team: e.target.value })}
            sx={{ minWidth: 150 }}
            fullWidth={false}
          />
        )}
      </WomsFilterPanel>

      <WomsDataTable
        caption="รายการงาน"
        rows={jobs}
        columns={columns}
        rowKey={(j) => j.jobId}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={10}
        onRowClick={(j) => router.push(`/jobs/${j.jobId}`)}
        emptyTitle="ยังไม่มีงานที่ตรงเงื่อนไข"
        emptyAction={
          <Button component={Link} href="/jobs/new" variant="outlined" startIcon={<AddIcon />}>
            เปิดงานแรก
          </Button>
        }
        renderCard={(j) => (
          <Card>
            <CardActionArea component={Link} href={`/jobs/${j.jobId}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Typography className="code" sx={{ fontWeight: 600 }}>
                    {j.jobId}
                  </Typography>
                  <JobStatusChip status={j.status} />
                </Stack>
                <Typography sx={{ mt: 0.5, fontWeight: 600, color: "text.primary" }}>{j.jobName}</Typography>
                <Typography variant="body2">{typeText(j)}</Typography>
                <Typography variant="body2">
                  {fmtDateTime(j.jobDate, j.jobTime)} · {j.technicianTeam || "ยังไม่ระบุทีม"}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        )}
      />
    </>
  );
}
