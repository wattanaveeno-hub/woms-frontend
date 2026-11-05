"use client";
// CR-CH01 / AC16 — ค้นหาข้อความในกลุ่มปัจจุบัน (ข้อความ · เลขคิว · JN · ข้อความที่ Reply)
//   backend ตรวจสมาชิกกลุ่มและไม่คืนข้อความที่ถูกยกเลิก · กดผลลัพธ์ = เลื่อนไปข้อความนั้นถ้าอยู่ในช่วงที่โหลด
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { ApiError } from "@/lib/api";
import { chatApi, type GroupMessage } from "@/lib/serviceQueueApi";
import { bangkokTime } from "@/lib/serviceQueueRules";

export default function ChatSearchDialog(props: {
  open: boolean;
  groupKey: string;
  groupName: string;
  onClose: () => void;
  onPick: (messageId: string) => void;
}) {
  const { open, groupKey, groupName, onClose, onPick } = props;
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GroupMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setItems(null);
    setError(null);
  }, [open, groupKey]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setItems(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      chatApi
        .search(groupKey, term)
        .then((r) => live && (setItems(r.items.map((i) => i.message)), setError(null)))
        .catch((e) => live && setError(e instanceof ApiError ? e.message : "ค้นหาไม่สำเร็จ"))
        .finally(() => live && setBusy(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, open, groupKey]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>ค้นหาในกลุ่ม — {groupName}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="ข้อความ เลขคิว หรือเลข JN (อย่างน้อย 2 ตัวอักษร)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputProps={{ "aria-label": "คำค้นในกลุ่ม", maxLength: 100 }}
          sx={{ mt: 1 }}
        />
        {busy ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : null}
        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        {items && !busy && !items.length ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            ไม่พบข้อความที่ตรงกับคำค้น
          </Typography>
        ) : null}
        {items?.length ? (
          <List dense data-testid="chat-search-results">
            {items.map((m) => (
              <ListItemButton key={m.messageId} onClick={() => onPick(m.messageId)}>
                <ListItemText
                  primary={m.text || m.ref?.queueNo || m.ref?.jobId || "(ไม่มีข้อความ)"}
                  secondary={`${m.senderName ?? ""} · ${bangkokTime(m.createdAt)}${m.ref?.queueNo ? ` · ${m.ref.queueNo}` : ""}`}
                  primaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        ) : null}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          แสดงสูงสุด 50 รายการล่าสุด · ข้อความที่เก่ากว่าช่วงที่แสดงในห้อง จะแสดงเฉพาะในรายการนี้
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
