"use client";

// แชทกลุ่ม (CHAT 01–04) — กลุ่มเช็คคิว + กลุ่มงานช่าง (หนึ่งกลุ่มต่อช่าง ใช้ร่วมหลายคิว/หลาย JN)
// ข้อความ รูปภาพ ไฟล์แนบ และ Reply ถึงข้อความหรือการ์ดคิว/JN · การ์ดแสดงสถานะล่าสุดเสมอ
// ข้อความธรรมดา/Reply ไม่เปลี่ยนสถานะคิว — การเปลี่ยนสถานะทำจากปุ่มในหน้ารายละเอียดคิวเท่านั้น
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import GroupIcon from "@mui/icons-material/Group";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import SendIcon from "@mui/icons-material/Send";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { WomsEmptyState, WomsLoadingState, WomsPageHeader, WomsPermissionGate } from "@/components/woms";
import { QueueCardView } from "@/components/serviceQueue/QueueBits";
import {
  chatApi,
  type AttachmentMeta,
  type AttachmentPolicy,
  type ChatGroupSummary,
  type GroupMessage,
  type QueueCard,
} from "@/lib/serviceQueueApi";
import { CHECK_QUEUE_GROUP, bangkokTime, checkFiles, fileSizeLabel } from "@/lib/serviceQueueRules";

const POLL_MS = 5000;
const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Admin", sales: "เซลล์", tech: "ช่าง", system: "ระบบ" };

// ไฟล์แนบต้องดึงผ่าน API ที่แนบ token (img src ธรรมดาส่ง Bearer ไม่ได้) — แคชไว้ในหน่วยความจำของหน้า
const fileCache = new Map<string, Promise<{ name: string; mime: string; dataUrl: string }>>();
function loadFile(fileId: string) {
  let p = fileCache.get(fileId);
  if (!p) {
    p = chatApi.file(fileId);
    p.catch(() => fileCache.delete(fileId));
    fileCache.set(fileId, p);
  }
  return p;
}

function dataUrlToBlobUrl(dataUrl: string): string {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function Attachment({ a, onPreview }: { a: AttachmentMeta; onPreview: (src: string, name: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const isImage = a.mime.startsWith("image/");
  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    loadFile(a.fileId)
      .then((f) => alive && setSrc(f.dataUrl))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [a.fileId, isImage]);
  if (isImage) {
    if (failed) return <Chip size="small" color="error" label={`เปิดรูปไม่ได้: ${a.name}`} />;
    if (!src) return <Box sx={{ width: 160, height: 100, bgcolor: "grey.100", borderRadius: 1 }} aria-label={`กำลังโหลด ${a.name}`} />;
    return (
      <Box
        component="img"
        src={src}
        alt={a.name}
        onClick={() => onPreview(src, a.name)}
        sx={{ maxWidth: 220, maxHeight: 180, borderRadius: 1, cursor: "zoom-in", display: "block", border: 1, borderColor: "divider" }}
      />
    );
  }
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<InsertDriveFileOutlinedIcon />}
      onClick={async () => {
        try {
          const f = await loadFile(a.fileId);
          const url = dataUrlToBlobUrl(f.dataUrl);
          const link = document.createElement("a");
          link.href = url;
          link.download = f.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (e) {
          setFailed(true);
        }
      }}
      color={failed ? "error" : "primary"}
    >
      {a.name} ({fileSizeLabel(a.size)})
    </Button>
  );
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

function GroupChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, has } = useAuth();
  const toast = useToast();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"));

  const [groups, setGroups] = useState<ChatGroupSummary[] | null>(null);
  const [policy, setPolicy] = useState<AttachmentPolicy | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const active = params.get("g") ?? "";
  const focusMsg = params.get("m") ?? "";

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [cards, setCards] = useState<Record<string, QueueCard>>({});
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastAtRef = useRef<string>("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadGroups = useCallback(() => {
    chatApi
      .groups()
      .then((r) => {
        setGroups(r.items);
        setPolicy(r.attachmentPolicy);
        setGroupsError(null);
      })
      .catch((e) => setGroupsError(e instanceof ApiError ? e.message : "โหลดกลุ่มแชทไม่สำเร็จ"));
  }, []);
  useEffect(loadGroups, [loadGroups]);

  // จอใหญ่: เปิดกลุ่มแรกอัตโนมัติ
  useEffect(() => {
    if (wide && !active && groups?.length) router.replace(`/group-chat?g=${encodeURIComponent(groups[0].groupKey)}`);
  }, [wide, active, groups, router]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  const nearBottom = () => {
    const el = listRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const markRead = useCallback((key: string) => {
    chatApi
      .read(key)
      .then(() => {
        setGroups((g) => g?.map((x) => (x.groupKey === key ? { ...x, unread: 0 } : x)) ?? g);
        window.dispatchEvent(new Event("woms:group-chat-read"));
      })
      .catch(() => {});
  }, []);

  // โหลดข้อความเมื่อเปลี่ยนกลุ่ม
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setLoadingMsgs(true);
    setMessages([]);
    setCards({});
    setReplyTo(null);
    setMsgError(null);
    lastAtRef.current = "";
    Promise.all([chatApi.messages(active), chatApi.group(active)])
      .then(([m, g]) => {
        if (!alive) return;
        setMessages(m.messages);
        setCards(m.cards);
        setMembers(g.members);
        lastAtRef.current = m.messages.at(-1)?.createdAt ?? "";
        markRead(active);
        requestAnimationFrame(() => {
          if (focusMsg) document.getElementById(`msg-${focusMsg}`)?.scrollIntoView({ block: "center" });
          else scrollToBottom();
        });
      })
      .catch((e) => alive && setMsgError(e instanceof ApiError ? e.message : "โหลดข้อความไม่สำเร็จ"))
      .finally(() => alive && setLoadingMsgs(false));
    return () => {
      alive = false;
    };
  }, [active, focusMsg, markRead]);

  // ดึงข้อความใหม่เป็นระยะ (การ์ดได้สถานะล่าสุดทุกครั้งที่มีข้อความใหม่)
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      chatApi
        .messages(active, lastAtRef.current || undefined)
        .then((m) => {
          if (!m.messages.length) return;
          const stick = nearBottom();
          setMessages((prev) => {
            const seen = new Set(prev.map((x) => x.messageId));
            return [...prev, ...m.messages.filter((x) => !seen.has(x.messageId))];
          });
          setCards((c) => ({ ...c, ...m.cards }));
          lastAtRef.current = m.messages.at(-1)!.createdAt;
          markRead(active);
          if (stick) requestAnimationFrame(scrollToBottom);
        })
        .catch(() => {});
      loadGroups();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, markRead, loadGroups]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.messageId, m])), [messages]);
  const current = groups?.find((g) => g.groupKey === active) ?? null;

  const send = async () => {
    if (!active || sending) return;
    const body = text.trim();
    if (!body && !files.length) return;
    if (policy) {
      const problem = checkFiles(files, policy);
      if (problem) return toast.error(problem);
    }
    setSending(true);
    try {
      const attachments = await Promise.all(files.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) })));
      const r = await chatApi.send(active, { text: body, replyToId: replyTo?.messageId, attachments });
      setMessages((prev) => [...prev, r.message]);
      lastAtRef.current = r.message.createdAt;
      setText("");
      setFiles([]);
      setReplyTo(null);
      requestAnimationFrame(scrollToBottom);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate?.([{ backgroundColor: "rgba(25,118,210,0.18)" }, { backgroundColor: "transparent" }], { duration: 1600 });
    } else toast.info("ข้อความต้นทางเก่ากว่าช่วงที่แสดงอยู่");
  };

  if (groupsError && !groups) return <Alert severity="error">{groupsError}</Alert>;
  if (!groups) return <WomsLoadingState />;
  if (!groups.length) return <WomsEmptyState title="คุณยังไม่ได้เป็นสมาชิกกลุ่มใด" />;

  const groupList = (
    <Paper variant="outlined" sx={{ height: "100%", overflowY: "auto" }}>
      <List dense disablePadding>
        {groups.map((g) => (
          <ListItemButton
            key={g.groupKey}
            selected={g.groupKey === active}
            component={Link}
            href={`/group-chat?g=${encodeURIComponent(g.groupKey)}`}
            sx={{ borderBottom: 1, borderColor: "divider", py: 1.25 }}
          >
            <ListItemText
              primary={
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography fontWeight={g.unread ? 700 : 500} noWrap>
                    {g.name}
                  </Typography>
                  {g.unread ? <Badge color="error" badgeContent={g.unread > 99 ? "99+" : g.unread} sx={{ mr: 1.5 }} /> : null}
                </Stack>
              }
              secondary={
                g.lastMessage
                  ? `${g.lastMessage.kind === "TEXT" ? g.lastMessage.senderName + ": " : ""}${(g.lastMessage.text || "ไฟล์แนบ").slice(0, 50)}`
                  : g.type === "CHECK_QUEUE"
                  ? "Sale ทุกคน + Admin"
                  : "ยังไม่มีข้อความ"
              }
              secondaryTypographyProps={{ noWrap: true }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );

  const conversation = active ? (
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
        {!wide ? (
          <IconButton aria-label="กลับไปรายการกลุ่ม" onClick={() => router.push("/group-chat")}>
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>
            {current?.name ?? ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            สมาชิก {members.length} คน
          </Typography>
        </Box>
        <Tooltip title="สมาชิก">
          <IconButton aria-label="ดูสมาชิก" onClick={() => setShowMembers(true)}>
            <GroupIcon />
          </IconButton>
        </Tooltip>
        {active === CHECK_QUEUE_GROUP && (has("svcqueue:request") || has("svcqueue:admin")) ? (
          <Button component={Link} href="/service-queue/new" variant="contained" size="small" startIcon={<AddIcon />}>
            เปิดคิว
          </Button>
        ) : null}
      </Stack>

      <Box ref={listRef} sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1, bgcolor: "grey.50" }} aria-live="polite">
        {loadingMsgs ? <WomsLoadingState rows={3} /> : null}
        {msgError ? <Alert severity="error">{msgError}</Alert> : null}
        {!loadingMsgs && !messages.length && !msgError ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
            ยังไม่มีข้อความในกลุ่มนี้
          </Typography>
        ) : null}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          const highlight = m.messageId === focusMsg;
          if (m.kind === "SYSTEM") {
            return (
              <Box id={`msg-${m.messageId}`} key={m.messageId} sx={{ textAlign: "center", my: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ display: "inline-block", bgcolor: highlight ? "warning.light" : "grey.200", px: 1.5, py: 0.5, borderRadius: 2, maxWidth: "90%" }}
                >
                  {m.text}
                </Typography>
                {m.ref ? (
                  <Button size="small" component={Link} href={`/service-queue/${m.ref.queueId}`} sx={{ ml: 0.5 }}>
                    เปิดคิว
                  </Button>
                ) : null}
              </Box>
            );
          }
          return (
            <Stack
              id={`msg-${m.messageId}`}
              key={m.messageId}
              direction="row"
              justifyContent={mine ? "flex-end" : "flex-start"}
              sx={{ my: 1, borderRadius: 1, outline: highlight ? "2px solid" : "none", outlineColor: "warning.main" }}
            >
              <Box sx={{ maxWidth: { xs: "92%", md: "75%" } }}>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: mine ? "right" : "left" }}>
                  {m.kind === "CARD" ? "ระบบ" : `${m.senderName} · ${ROLE_LABEL[m.senderRole] ?? m.senderRole}`} · {bangkokTime(m.createdAt)}
                </Typography>
                {m.kind === "CARD" && m.ref ? (
                  <QueueCardView card={cards[m.ref.queueId]} fallback={m.ref} />
                ) : (
                  <Paper elevation={0} sx={{ p: 1.25, bgcolor: mine ? "primary.light" : "background.paper", border: 1, borderColor: "divider" }}>
                    {m.replyTo ? (
                      <Box
                        role="button"
                        tabIndex={0}
                        onClick={() => jumpTo(m.replyTo!.messageId)}
                        onKeyDown={(e) => (e.key === "Enter" ? jumpTo(m.replyTo!.messageId) : undefined)}
                        sx={{ borderLeft: 3, borderColor: "primary.main", pl: 1, mb: 0.75, cursor: "pointer", bgcolor: "rgba(0,0,0,0.04)", borderRadius: 0.5 }}
                      >
                        <Typography variant="caption" fontWeight={700} component="div">
                          ตอบกลับ {m.replyTo.kind === "CARD" ? "การ์ดคิว" : m.replyTo.senderName}
                        </Typography>
                        <Typography variant="caption" component="div" color="text.secondary">
                          {m.replyTo.excerpt}
                        </Typography>
                        {m.replyTo.ref ? (
                          <Typography variant="caption" component={Link} href={`/service-queue/${m.replyTo.ref.queueId}`} onClick={(e) => e.stopPropagation()}>
                            {m.replyTo.ref.queueNo}
                            {m.replyTo.ref.jobId ? ` / ${m.replyTo.ref.jobId}` : ""}
                          </Typography>
                        ) : null}
                      </Box>
                    ) : null}
                    {m.text ? (
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.text}
                      </Typography>
                    ) : null}
                    {m.attachments?.length ? (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: m.text ? 1 : 0 }}>
                        {m.attachments.map((a) => (
                          <Attachment key={a.fileId} a={a} onPreview={(src, name) => setPreview({ src, name })} />
                        ))}
                      </Stack>
                    ) : null}
                  </Paper>
                )}
                <Box sx={{ textAlign: mine ? "right" : "left" }}>
                  <Button size="small" startIcon={<ReplyIcon fontSize="small" />} onClick={() => setReplyTo(m)} sx={{ minWidth: 0, fontSize: 12 }}>
                    ตอบกลับ
                  </Button>
                </Box>
              </Box>
            </Stack>
          );
        })}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: "divider", p: 1 }}>
        {replyTo ? (
          <Stack direction="row" alignItems="center" sx={{ bgcolor: "grey.100", borderRadius: 1, px: 1, py: 0.5, mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" fontWeight={700}>
                ตอบกลับ {replyTo.kind === "CARD" ? `การ์ดคิว ${replyTo.ref?.queueNo ?? ""}` : replyTo.senderName}
              </Typography>
              <Typography variant="caption" component="div" noWrap color="text.secondary">
                {replyTo.kind === "CARD" ? replyTo.ref?.jobId ?? "" : replyTo.text || "ไฟล์แนบ"}
              </Typography>
            </Box>
            <IconButton size="small" aria-label="ยกเลิกการตอบกลับ" onClick={() => setReplyTo(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : null}
        {files.length ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {files.map((f, i) => (
              <Chip key={`${f.name}-${i}`} size="small" label={`${f.name} (${fileSizeLabel(f.size)})`} onDelete={() => setFiles(files.filter((_, j) => j !== i))} />
            ))}
          </Stack>
        ) : null}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept={(policy?.mime ?? []).join(",")}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              const next = [...files, ...picked];
              const problem = policy ? checkFiles(next, policy) : null;
              if (problem) toast.error(problem);
              else setFiles(next);
            }}
          />
          <Tooltip title="แนบรูปหรือไฟล์ (JPG/PNG/WEBP/GIF/PDF)">
            <IconButton aria-label="แนบไฟล์" onClick={() => fileInput.current?.click()} disabled={sending}>
              <AttachFileIcon />
            </IconButton>
          </Tooltip>
          <TextField
            fullWidth
            multiline
            maxRows={5}
            size="small"
            placeholder="พิมพ์ข้อความ… (Enter ส่ง · Shift+Enter ขึ้นบรรทัด)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            inputProps={{ "aria-label": "ข้อความ", maxLength: 4000 }}
          />
          <IconButton color="primary" aria-label="ส่งข้อความ" onClick={() => void send()} disabled={sending || (!text.trim() && !files.length)}>
            <SendIcon />
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  ) : (
    <Paper variant="outlined" sx={{ height: "100%", display: "grid", placeItems: "center" }}>
      <Typography color="text.secondary">เลือกกลุ่มทางซ้ายเพื่อเริ่มแชท</Typography>
    </Paper>
  );

  return (
    <>
      <WomsPageHeader title="แชทกลุ่ม" subtitle="กลุ่มเช็คคิว และกลุ่มงานช่าง (หนึ่งกลุ่มต่อช่าง ใช้ร่วมหลายคิว/หลาย JN)" />
      <Box sx={{ height: { xs: "calc(100vh - 170px)", md: "calc(100vh - 190px)" }, minHeight: 420 }}>
        {wide ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 2, height: "100%" }}>
            {groupList}
            {conversation}
          </Box>
        ) : active ? (
          conversation
        ) : (
          groupList
        )}
      </Box>

      <Dialog open={showMembers} onClose={() => setShowMembers(false)} fullWidth maxWidth="xs">
        <DialogTitle>สมาชิก — {current?.name}</DialogTitle>
        <DialogContent>
          <List dense>
            {members.map((m) => (
              <ListItemText key={m.id} primary={m.name} secondary={ROLE_LABEL[m.role] ?? m.role} sx={{ py: 0.5 }} />
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg">
        <DialogTitle>{preview?.name}</DialogTitle>
        <DialogContent>{preview ? <Box component="img" src={preview.src} alt={preview.name} sx={{ maxWidth: "100%", maxHeight: "75vh" }} /> : null}</DialogContent>
      </Dialog>
    </>
  );
}

export default function GroupChatPage() {
  return (
    <WomsPermissionGate anyOf={["chat:check_queue", "chat:tech_groups", "chat:own_tech_group"]}>
      <Suspense fallback={<WomsLoadingState />}>
        <GroupChatInner />
      </Suspense>
    </WomsPermissionGate>
  );
}
