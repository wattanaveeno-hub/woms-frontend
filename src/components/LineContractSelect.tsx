"use client";

// FB-07 — เลือกสัญญาเช่าให้เครื่องแต่ละเครื่องในใบงาน (หลายเครื่องเห็นว่าแต่ละเครื่องผูกสัญญาใด)
// รายการสัญญามาจากสัญญาของเครื่องนั้น (serial เดียวกัน) เท่านั้น — backend ตรวจซ้ำว่าสัญญาเป็นของเครื่องนี้จริง
import { useEffect, useState } from "react";
import Link from "next/link";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { contractQuoApi } from "@/lib/contractQuoApi";
import { useAuth } from "@/lib/AuthContext";

interface Opt {
  id: string;
  contractNo: string;
  status: string;
  live: boolean;
}

export default function LineContractSelect({
  equipmentId,
  value,
  valueNo,
  disabled,
  onChange,
}: {
  equipmentId: string;
  value: string;
  valueNo?: string;
  disabled?: boolean;
  onChange?: (contractId: string, contractNo: string) => void;
}) {
  const { has } = useAuth();
  const [opts, setOpts] = useState<Opt[] | null>(null);
  useEffect(() => {
    if (!equipmentId || !has("contracts:view")) {
      setOpts([]);
      return;
    }
    let alive = true;
    contractQuoApi
      .byEquipment(equipmentId)
      .then((r) => {
        if (!alive) return;
        setOpts(
          r.contracts
            .filter((c) => c.status !== "CANCELLED" || c.id === value)
            .map((c) => ({ id: c.id, contractNo: c.contractNo, status: c.status, live: r.active?.id === c.id }))
        );
      })
      .catch(() => alive && setOpts([]));
    return () => {
      alive = false;
    };
  }, [equipmentId, value, has]);

  const current = value ? (
    <Link href={`/contracts/${value}`} data-testid="line-contract-link">
      {valueNo || opts?.find((o) => o.id === value)?.contractNo || "เปิดสัญญา"}
    </Link>
  ) : null;

  if (!onChange || disabled) {
    return value ? (
      <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
        สัญญาเช่า: {current}
      </Typography>
    ) : null;
  }
  if (opts === null) return null;
  if (!opts.length && !value) {
    return (
      <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
        สัญญาเช่า: เครื่องนี้ยังไม่มีสัญญาในระบบ
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
      <TextField
        select
        size="small"
        label="สัญญาเช่าของเครื่องนี้"
        value={opts.some((o) => o.id === value) ? value : ""}
        onChange={(e) => {
          const o = opts.find((x) => x.id === e.target.value);
          onChange(o?.id ?? "", o?.contractNo ?? "");
        }}
        sx={{ minWidth: 240 }}
        inputProps={{ "data-testid": "line-contract-select" }}
      >
        <MenuItem value="">— ไม่ผูกสัญญา —</MenuItem>
        {opts.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.contractNo}
            {o.live ? " (มีผลอยู่)" : ` (${o.status})`}
          </MenuItem>
        ))}
      </TextField>
      {current}
    </Stack>
  );
}
