"use client";

// ---------------------------------------------------------------------------
// ตาราง PM รายเดือนของช่างหนึ่งคน — รายละเอียดและการจัดการ
// ---------------------------------------------------------------------------
// PM-FN-003 "สร้างใบงานจากรายการ PM ได้"  (+ ชีตหลัก: ต้องกันการสร้างซ้ำ)
// ชีตหลัก   "Admin เลือกจัดการงานภายในตาราง PM เดือนนั้นได้ เช่น การเพิ่ม ลด งาน"
// ชีตหลัก   "ส่งตาราง PM ประจำเดือนให้ช่างได้ โดยให้ Admin เป็นคน Aprove"

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import type { PmPlan } from "@/lib/types";
import type { PmPlanItem } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  PmItemStatusChip,
  PmPlanStatusChip,
  WomsDataTable,
  WomsErrorState,
  WomsFormSection,
  WomsLoadingState,
  WomsPageHeader,
  type WomsColumn,
} from "@/components/woms";
import { parseISODate } from "@/components/FieldErrors";

export default function PmPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { has } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const canManage = has("pm:manage");
  const canApprove = has("pm:approve");

  const [plan, setPlan] = useState<PmPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // PM-02: รายการที่ติ๊กไว้เพื่อรวมเป็นใบงานเดียว (ต้องเป็นร้าน/สาขาเดียวกัน — เซิร์ฟเวอร์ตรวจซ้ำ)
  const [picked, setPicked] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlan(await api.getPmPlan(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดตารางไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status: PmPlan["status"]) => {
    let reason = "";
    if (
      status === "CLOSED" &&
      !(await dialog.confirm({
        title: "ปิดรอบเดือนของตารางนี้?",
        message: "ตารางที่ปิดรอบแล้วแก้ไขรายการ เปิดใบงาน หรือเปลี่ยนสถานะต่อไม่ได้",
        confirmLabel: "ปิดรอบเดือน",
      }))
    )
      return;
    if (status === "CANCELLED") {
      const r = await dialog.prompt({
        title: "ยกเลิกตาราง PM นี้?",
        message: "ตารางที่ยกเลิกแล้วเดินสถานะต่อไม่ได้",
        label: "เหตุผลที่ยกเลิก",
        type: "textarea",
        required: true,
        confirmLabel: "ยืนยันยกเลิกตาราง",
        cancelLabel: "ไม่ยกเลิก",
        danger: true,
      });
      if (r === null) return;
      reason = r.trim();
    }
    setBusy(true);
    try {
      setPlan(await api.setPmPlanStatus(id, status, reason));
      toast.success("อัปเดตสถานะแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "อัปเดตไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  const createJob = async (itemId: string) => {
    setBusyItem(itemId);
    try {
      const r = await api.createPmJob(id, itemId);
      setPlan(r.plan);
      toast.success(`เปิดใบงาน ${r.job.jobId} แล้ว`);
    } catch (e) {
      // 409 = มีคนเปิดไปแล้ว (กันซ้ำที่ฐานข้อมูล) — แสดงข้อความจริงจากเซิร์ฟเวอร์
      toast.error(e instanceof ApiError ? e.message : "เปิดใบงานไม่สำเร็จ");
      load();
    } finally {
      setBusyItem(null);
    }
  };

  const storeKey = (it: { siteId?: string; customerId?: string; customerName?: string }) =>
    it.siteId ? `site:${it.siteId}` : `customer:${it.customerId || ""}:${(it.customerName || "").trim()}`;

  const togglePick = (itemId: string) =>
    setPicked((prev) => (prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]));

  const createCombinedJob = async () => {
    if (!plan || picked.length === 0) return;
    const keys = new Set(plan.items.filter((i) => picked.includes(i.id)).map(storeKey));
    if (keys.size > 1) {
      toast.error("รวมเป็นใบงานเดียวได้เฉพาะเครื่องของร้าน/สาขาเดียวกัน");
      return;
    }
    setBusy(true);
    try {
      const r = await api.createPmJobMulti(id, picked);
      setPlan(r.plan);
      setPicked([]);
      toast.success(`เปิดใบงาน ${r.job.jobId} (${picked.length} เครื่อง) แล้ว`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "เปิดใบงานไม่สำเร็จ");
      load();
    } finally {
      setBusy(false);
    }
  };

  const skip = async (itemId: string) => {
    const raw = await dialog.prompt({
      title: "ตัดงานนี้ออกจากแผน",
      label: "เหตุผลที่ตัดออก",
      type: "textarea",
      required: true,
      confirmLabel: "ตัดออกจากแผน",
    });
    if (raw === null) return;
    const reason = raw.trim();
    setBusyItem(itemId);
    try {
      setPlan(await api.skipPmPlanItem(id, itemId, reason));
      toast.success("ตัดออกจากแผนแล้ว");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ตัดออกไม่สำเร็จ");
    } finally {
      setBusyItem(null);
    }
  };

  const reschedule = async (itemId: string, current: string) => {
    // QA BUG-019 — เดิมเป็น prompt() ที่ตรวจแค่รูปแบบสตริง จึงรับ 2026-13-45 (วันที่ที่ไม่มีจริง)
    // ตอนนี้เป็น <input type="date"> ซึ่งเลือกวันที่ที่มีอยู่จริงเท่านั้น
    // และยังตรวจซ้ำด้วย parseISODate เผื่อผู้ใช้พิมพ์เอง
    const raw = await dialog.prompt({
      title: "แก้วันนัดในแผน",
      label: "วันที่นัดใหม่",
      help: "เลือกจากปฏิทิน — ระบบจะใช้วันนี้ตอนเปิดใบงานและตอนแจ้งเตือน",
      type: "date",
      defaultValue: current,
      required: true,
      confirmLabel: "บันทึกวันนัด",
      validate: (v) => {
        const r = parseISODate(v);
        return r.ok ? null : r.message;
      },
    });
    if (raw === null) return;
    const date = raw.trim();
    setBusyItem(itemId);
    try {
      setPlan(await api.schedulePmPlanItem(id, itemId, date));
      toast.success("อัปเดตวันนัดแล้ว");
    } catch (e) {
      // backend ตรวจวันที่อีกชั้น (BUG-019) — ข้อความจากเซิร์ฟเวอร์ต้องถึงผู้ใช้เสมอ
      toast.error(e instanceof ApiError ? e.message : "อัปเดตวันนัดไม่สำเร็จ");
      load();
    } finally {
      setBusyItem(null);
    }
  };

  const back = (
    <Button component={Link} href="/pm" startIcon={<ArrowBackIcon />}>
      ตาราง PM
    </Button>
  );
  if (error) {
    return (
      <>
        <WomsPageHeader title="ตาราง PM" actions={back} />
        <WomsErrorState message={error} onRetry={load} />
      </>
    );
  }
  if (!plan) return <WomsLoadingState rows={5} />;

  const editable = plan.status !== "CLOSED" && plan.status !== "CANCELLED";
  const canJob = (it: PmPlanItem) => !it.jobId && it.status !== "SKIPPED" && plan.status !== "DRAFT" && editable;
  const canAdjust = (it: PmPlanItem) => !it.jobId && it.status !== "SKIPPED" && editable;

  const actions = (it: PmPlanItem) =>
    canManage ? (
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {canJob(it) ? (
          <Button size="small" variant="contained" disabled={busyItem === it.id} onClick={() => createJob(it.id)}>
            {busyItem === it.id ? "กำลังเปิด…" : "เปิดใบงาน"}
          </Button>
        ) : null}
        {canAdjust(it) ? (
          <>
            <Button size="small" disabled={busyItem === it.id} onClick={() => reschedule(it.id, it.plannedDate || it.dueDate)}>
              แก้วันนัด
            </Button>
            <Button size="small" color="error" disabled={busyItem === it.id} onClick={() => skip(it.id)}>
              ตัดออก
            </Button>
          </>
        ) : null}
      </Stack>
    ) : null;

  const serialCell = (it: PmPlanItem) =>
    it.equipmentId ? (
      <Link href={`/equipment/${it.equipmentId}`} className="code">
        {it.serial}
      </Link>
    ) : (
      <span className="code">{it.serial}</span>
    );
  const planned = (it: PmPlanItem) => `${it.plannedDate || "-"}${it.plannedTime ? ` ${it.plannedTime}` : ""}`;

  const columns: WomsColumn<PmPlanItem>[] = [
    { key: "serial", label: "Serial", sortValue: (it) => it.serial, render: serialCell },
    { key: "model", label: "รุ่น", hideBelowLg: true, sortValue: (it) => it.model || "", render: (it) => it.model || "-" },
    {
      key: "cust",
      label: "ลูกค้า / สาขา",
      sortValue: (it) => it.customerName || "",
      render: (it) => (
        <>
          {it.customerName || "-"}
          {it.siteLabel ? <Typography variant="body2">{it.siteLabel}</Typography> : null}
        </>
      ),
    },
    { key: "due", label: "ครบกำหนด", sortValue: (it) => it.dueDate || "", render: (it) => <span className="mono">{it.dueDate || "-"}</span> },
    { key: "plan", label: "วันนัดในแผน", sortValue: (it) => it.plannedDate || "", render: (it) => <span className="mono">{planned(it)}</span> },
    {
      key: "status",
      label: "สถานะ",
      sortValue: (it) => it.status,
      render: (it) => (
        <>
          <PmItemStatusChip status={it.status} />
          {it.skipReason ? <Typography variant="body2">{it.skipReason}</Typography> : null}
        </>
      ),
    },
    { key: "job", label: "ใบงาน", render: (it) => (it.jobId ? <Link href={`/jobs/${it.jobId}`} className="code">{it.jobId}</Link> : "-") },
    ...(canManage ? [{ key: "act", label: "จัดการ", render: actions } as WomsColumn<PmPlanItem>] : []),
  ];

  return (
    <>
      <WomsPageHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center" component="span" flexWrap="wrap" useFlexGap>
            <span>
              PM {plan.month} · {plan.technicianName}
            </span>
            <PmPlanStatusChip status={plan.status} />
          </Stack>
        }
        subtitle={`${plan.team ? `ทีม ${plan.team} · ` : ""}${plan.total} รายการ · ในแผน ${plan.counts.PLANNED} · เปิดใบงาน ${
          plan.counts.JOB_CREATED
        } · ทำแล้ว ${plan.counts.DONE} · ตัดออก ${plan.counts.SKIPPED}${plan.approvedBy ? ` · อนุมัติโดย ${plan.approvedBy}` : ""}`}
        actions={back}
      />

      {plan.status === "DRAFT" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ตารางยังเป็นร่าง — ช่างยังมองไม่เห็น และยังเปิดใบงานจากตารางนี้ไม่ได้ จนกว่าจะอนุมัติ
        </Alert>
      )}
      {plan.status === "APPROVED" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          อนุมัติแล้ว — กด “ส่งให้ช่าง” เพื่อให้ช่างเห็นตารางนี้ในระบบช่าง
        </Alert>
      )}
      {plan.status === "CANCELLED" && plan.cancelReason && (
        <Alert severity="error" sx={{ mb: 2 }}>
          ยกเลิกแล้ว — {plan.cancelReason}
        </Alert>
      )}

      {canManage && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {plan.status === "DRAFT" && canApprove && (
            <Button variant="contained" disabled={busy} onClick={() => setStatus("APPROVED")}>
              อนุมัติตาราง
            </Button>
          )}
          {plan.status === "APPROVED" && canApprove && (
            <>
              <Button variant="contained" disabled={busy} onClick={() => setStatus("SENT")}>
                ส่งให้ช่าง
              </Button>
              <Button variant="outlined" disabled={busy} onClick={() => setStatus("DRAFT")}>
                ถอนการอนุมัติ
              </Button>
            </>
          )}
          {plan.status === "SENT" && (
            <Button variant="outlined" disabled={busy} onClick={() => setStatus("CLOSED")}>
              ปิดรอบเดือน
            </Button>
          )}
          {editable && (
            <Button color="error" variant="outlined" disabled={busy} onClick={() => setStatus("CANCELLED")}>
              ยกเลิกตาราง
            </Button>
          )}
        </Stack>
      )}

      <WomsFormSection
        title="รายการในตาราง"
        actions={
          canManage && editable && plan.status !== "DRAFT" ? (
            <Button variant="contained" disabled={busy || picked.length === 0} onClick={createCombinedJob}>
              เปิดใบงานเดียวจากที่เลือก ({picked.length})
            </Button>
          ) : undefined
        }
      >
        {canManage && editable && plan.status !== "DRAFT" ? (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            ติ๊กเครื่องของร้าน/สาขาเดียวกันเพื่อรวมเป็นใบงานเดียว
          </Typography>
        ) : null}
        <WomsDataTable
          caption="รายการ PM"
          rows={plan.items}
          columns={columns}
          rowKey={(it) => it.id}
          pageSize={25}
          emptyTitle="ยังไม่มีรายการในตารางนี้"
          selection={
            canManage
              ? {
                  isSelected: (it) => picked.includes(it.id),
                  onToggle: (it) => togglePick(it.id),
                  onTogglePage: (rows, all) =>
                    setPicked((prev) => {
                      const ids = rows.map((r) => r.id);
                      return all ? [...new Set([...prev, ...ids])] : prev.filter((x) => !ids.includes(x));
                    }),
                  label: (it) => `เลือก ${it.serial}`,
                  isDisabled: (it) => !canJob(it),
                }
              : undefined
          }
          renderCard={(it) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, opacity: it.status === "SKIPPED" ? 0.6 : 1 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                {serialCell(it)}
                <PmItemStatusChip status={it.status} />
              </Stack>
              <Typography variant="body2">
                {it.model || "-"} · {it.customerName || "-"}
                {it.siteLabel ? ` · ${it.siteLabel}` : ""}
              </Typography>
              <Typography variant="body2">
                ครบกำหนด <span className="mono">{it.dueDate || "-"}</span> · นัด <span className="mono">{planned(it)}</span>
              </Typography>
              {it.jobId ? (
                <Link href={`/jobs/${it.jobId}`} className="code">
                  {it.jobId}
                </Link>
              ) : null}
              {it.skipReason ? <Typography variant="body2">{it.skipReason}</Typography> : null}
              <Box sx={{ mt: 1 }}>{actions(it)}</Box>
            </Box>
          )}
        />
      </WomsFormSection>
    </>
  );
}
