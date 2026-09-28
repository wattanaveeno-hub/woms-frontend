"use client";

// ---------------------------------------------------------------------------
// เครื่องทั้งหมดที่อยู่ภายใต้ลูกค้ารายหนึ่ง
// ---------------------------------------------------------------------------
// ที่มา: "ระบบจะต้องสามารถแสดงรายการเครื่องทั้งหมดที่อยู่ภายใต้ลูกค้าแต่ละรายได้"
//        "ระบบจะต้องสามารถระบุได้ว่าเครื่องแต่ละเครื่องอยู่กับลูกค้าและร้านใด"

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Equipment } from "@/lib/types";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { EquipmentStatusBadge, NeedsSerialBadge } from "@/components/EquipmentBadges";
import { WomsDataTable, WomsErrorState, WomsFormSection, type WomsColumn } from "@/components/woms";

export default function PartnerEquipment({ partnerId }: { partnerId: string }) {
  const [items, setItems] = useState<Equipment[] | null>(null);
  const [unlinked, setUnlinked] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.partnerEquipment(partnerId);
      setItems(r.items);
      setUnlinked(r.unlinkedByName);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายการเครื่องไม่สำเร็จ");
      setItems([]);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const serial = (e: Equipment) => (
    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
      <Link href={`/equipment/${e.id}`} className="code">
        {e.serial}
      </Link>
      {e.needsSerial ? <NeedsSerialBadge /> : null}
    </Stack>
  );
  const site = (e: Equipment) => e.siteLabel || (e.customerId ? "-" : "(ผูกด้วยชื่อ)");
  const columns: WomsColumn<Equipment>[] = [
    { key: "serial", label: "Serial", sortValue: (e) => e.serial, render: serial },
    { key: "model", label: "รุ่น", sortValue: (e) => e.model, render: (e) => e.model },
    { key: "status", label: "สถานะ", sortValue: (e) => e.status, render: (e) => <EquipmentStatusBadge status={e.status} /> },
    { key: "site", label: "สาขา/ร้าน", sortValue: site, render: site },
    { key: "addr", label: "ที่อยู่ปัจจุบัน", hideBelowLg: true, render: (e) => e.addressFull || e.location || "-" },
    { key: "pm", label: "PM ครั้งถัดไป", sortValue: (e) => e.nextPmDate || "", render: (e) => <span className="mono">{e.nextPmDate || "-"}</span> },
  ];

  return (
    <WomsFormSection title={`เครื่องของลูกค้ารายนี้${items ? ` (${items.length})` : ""}`}>
      {unlinked > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          มี {unlinked} เครื่องที่ยังผูกกับลูกค้ารายนี้ด้วย “ชื่อ” เท่านั้น ยังไม่ได้ผูกด้วยรหัสลูกค้า — เปลี่ยนชื่อลูกค้าเมื่อไหร่
          เครื่องเหล่านี้จะหลุดจากกัน แก้ได้โดยเปิดเครื่องแล้วเลือกลูกค้าจากรายการ
        </Alert>
      ) : null}
      {error ? (
        <WomsErrorState message={error} onRetry={load} />
      ) : (
        <WomsDataTable
          caption="เครื่องของลูกค้า"
          rows={items ?? []}
          loading={items === null}
          columns={columns}
          rowKey={(e) => e.id}
          pageSize={10}
          emptyTitle="ยังไม่มีเครื่องผูกกับลูกค้ารายนี้"
          renderCard={(e) => (
            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                {serial(e)}
                <EquipmentStatusBadge status={e.status} />
              </Stack>
              <Typography variant="body2">
                {e.model} · {site(e)}
              </Typography>
              <Typography variant="body2">
                {e.addressFull || e.location || "-"}
                {e.nextPmDate ? ` · PM ถัดไป ${e.nextPmDate}` : ""}
              </Typography>
            </Box>
          )}
        />
      )}
    </WomsFormSection>
  );
}
