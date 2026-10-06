"use client";

// ---------------------------------------------------------------------------
// ข้อมูลอะไหล่ (PART-01 / PART-02 / BR-04.1) — ตาราง: รูป · รหัส · ชื่อ (ซ้ำได้) · รุ่นที่ใช้ได้ · ยอดใช้รวม
// ---------------------------------------------------------------------------
// ไม่ใช่หน้าคลัง/เบิกจ่าย (หน้านั้นคือ /stock) — ยอดใช้มาจากที่ Admin บันทึกรายเครื่องในใบงาน
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { partsApi, type PartListRow } from "@/lib/partsApi";
import PartForm from "@/components/PartForm";
import { WomsDataTable, WomsPageHeader, type WomsColumn } from "@/components/woms";

function Thumb({ src, size = 44 }: { src: string; size?: number }) {
  return src ? (
    <Box component="img" src={src} alt="" sx={{ width: size, height: size, objectFit: "cover", borderRadius: 1, border: 1, borderColor: "divider" }} />
  ) : (
    <Box sx={{ width: size, height: size, display: "grid", placeItems: "center", color: "text.disabled", border: 1, borderColor: "divider", borderRadius: 1 }}>
      <ImageNotSupportedIcon fontSize="small" />
    </Box>
  );
}

export default function PartsPage() {
  const router = useRouter();
  const { has } = useAuth();
  const toast = useToast();
  const canManage = has("stock:manage");

  const [rows, setRows] = useState<PartListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await partsApi.list(q.trim());
      setRows(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการอะไหล่ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const exportXlsx = async () => {
    try {
      await partsApi.exportXlsx();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ส่งออกไม่สำเร็จ");
    }
  };

  const columns: WomsColumn<PartListRow>[] = [
    { key: "image", label: "รูป", width: 64, render: (p) => <Thumb src={p.image} /> },
    { key: "code", label: "รหัส", sortValue: (p) => p.code, render: (p) => <span className="mono">{p.code}</span> },
    { key: "name", label: "ชื่ออะไหล่", sortValue: (p) => p.name, render: (p) => p.name },
    {
      key: "models",
      label: "รุ่นที่ใช้ได้",
      hideBelowLg: true,
      render: (p) =>
        p.compatibleModels.length ? (
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {p.compatibleModels.map((m) => (
              <Chip key={m} size="small" label={m} />
            ))}
          </Stack>
        ) : (
          "—"
        ),
    },
    {
      key: "used",
      label: "ใช้ไปแล้ว",
      align: "right",
      sortValue: (p) => p.totalUsedQty,
      render: (p) => (
        <span className="mono">
          {p.totalUsedQty.toLocaleString("th-TH")} {p.unit}
        </span>
      ),
    },
    { key: "machines", label: "จำนวนเครื่อง", align: "right", sortValue: (p) => p.machineCount, render: (p) => <span className="mono">{p.machineCount}</span> },
  ];

  return (
    <>
      <WomsPageHeader
        title="ข้อมูลอะไหล่"
        subtitle="รหัส ชื่อ รุ่นที่ใช้ได้ และประวัติการใช้จริงรายเครื่อง (ชื่อซ้ำได้ แยกด้วยรหัส)"
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportXlsx}>
              ส่งออก Excel
            </Button>
            {canManage ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
                เพิ่มอะไหล่
              </Button>
            ) : null}
          </Stack>
        }
      />

      <TextField
        label="ค้นหา รหัส / ชื่อ / รุ่น"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: 420 }}
      />

      <WomsDataTable
        caption="รายการอะไหล่"
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={load}
        pageSize={20}
        emptyTitle="ยังไม่มีข้อมูลอะไหล่"
        onRowClick={(p) => router.push(`/parts/${p.id}`)}
        renderCard={(p) => (
          <Stack direction="row" spacing={1.5} sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
            <Thumb src={p.image} size={56} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: "text.primary" }}>
                <span className="mono">{p.code}</span> · {p.name}
              </Typography>
              <Typography variant="body2">
                ใช้ไปแล้ว {p.totalUsedQty.toLocaleString("th-TH")} {p.unit} · {p.machineCount} เครื่อง
              </Typography>
              {p.compatibleModels.length ? <Typography variant="body2">รุ่น: {p.compatibleModels.join(", ")}</Typography> : null}
            </Box>
          </Stack>
        )}
      />

      <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="sm" fullWidth>
        <DialogTitle>เพิ่มอะไหล่</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <PartForm
              onCancel={() => setCreating(false)}
              onSaved={(p) => {
                setCreating(false);
                toast.success(`เพิ่มอะไหล่ ${p.code} แล้ว`);
                router.push(`/parts/${p.id}`);
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
