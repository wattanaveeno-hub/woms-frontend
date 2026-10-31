"use client";

// แชทกลุ่ม (CHAT 01–04) — กลุ่มเช็คคิว + กลุ่มงานช่าง (หนึ่งกลุ่มต่อช่าง ใช้ร่วมหลายคิว/หลาย JN)
// ข้อความ รูปภาพ ไฟล์แนบ และ Reply ถึงข้อความหรือการ์ดคิว/JN · การ์ดแสดงสถานะล่าสุดเสมอ
// ข้อความธรรมดา/Reply ไม่เปลี่ยนสถานะคิว — การเปลี่ยนสถานะทำจากปุ่มในหน้ารายละเอียดคิวเท่านั้น
// D-13: แท็กสมาชิก + ส่งพร้อมคีย์กันส่งซ้ำ (clientMessageId) และลองใหม่อัตโนมัติเมื่อเครือข่ายหลุด
// D-14: ยกเลิกข้อความ — ผู้ส่งภายใน 15 นาที · Admin (chat:moderate) ทุกเวลาพร้อมเหตุผล · แสดง placeholder
// WS-01 (31 ต.ค. 69):
//   CHAT-01 แบบ LINE — หัวห้อง/ช่องพิมพ์อยู่กับที่ · เลื่อนเฉพาะรายการ · เปิดห้องที่ข้อความล่าสุด · เลื่อนตามเมื่ออยู่ล่าง
//           · ไม่บังคับเลื่อนเมื่ออ่านย้อน · ตัวแจ้งข้อความใหม่ · โหลดข้อความก่อนหน้าโดยคงตำแหน่ง · หน้าเว็บไม่ scroll ซ้อน
//   CHAT-02 append-only — การ์ดคิวทุกใบคงเป็นเหตุการณ์ ณ เวลานั้น · เฉพาะใบล่าสุดของคิวแสดงสถานะปัจจุบัน/ปุ่ม
//   CHAT-04 ดึงซ้อนย้อนหลัง + ตัดซ้ำด้วย messageId · ไม่รับผลของห้องเดิมหลังสลับห้อง
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import { applyMention, mentionOptions, mentionQueryOf, mentionsToSend } from "@/lib/mentions";
import {
  canCancel,
  cancelErrorMessage,
  cancelledLabel,
  EMPTY_POLL,
  advancePoll,
  appendedMessages,
  compareTimeline,
  eventChangedStatus,
  eventHeadline,
  eventLink,
  eventTransitionText,
  freshMessages,
  hasMoreOlder,
  isAtBottom,
  latestQueueCardIds,
  mergeMessages,
  newMessageCount,
  occurredAtOf,
  olderQuery,
  pollQuery,
  preservedScrollTop,
  type PollState,
  newClientMessageId,
  sendWithRetry,
  type CancelMode,
} from "@/lib/groupChatRules";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
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
import BlockIcon from "@mui/icons-material/Block";
import CloseIcon from "@mui/icons-material/Close";
import GroupIcon from "@mui/icons-material/Group";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import HistoryIcon from "@mui/icons-material/History";
import ReplyIcon from "@mui/icons-material/Reply";
import SendIcon from "@mui/icons-material/Send";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";
import { WomsEmptyState, WomsLoadingState, WomsPageHeader, WomsPermissionGate } from "@/components/woms";
import { QueueCardView } from "@/components/serviceQueue/QueueBits";
import { TECH_NAV_HEIGHT, useTechBottomNavVisible } from "@/components/TechBottomNav";
import {
  chatApi,
  type AttachmentMeta,
  type AttachmentPolicy,
  type ChatGroupSummary,
  type GroupMessage,
  type QueueCard,
} from "@/lib/serviceQueueApi";
import { CHECK_QUEUE_GROUP, SQ_STATUS_LABEL, bangkokTime, checkFiles, fileSizeLabel } from "@/lib/serviceQueueRules";
import { statusLabel } from "@/lib/options";

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

/** FB-12/13 การ์ดใบงานในแชท — ปิดงานสำเร็จ / ข้อความอ้างอิงใบงาน · กดเข้าใบงานได้ */
function JobCardView({ card }: { card: NonNullable<GroupMessage["jobCard"]> }) {
  const { user } = useAuth();
  const href = user?.role === "tech" ? `/m/job/${encodeURIComponent(card.jobId)}` : `/jobs/${encodeURIComponent(card.jobId)}`;
  const closed = card.type === "JOB_CLOSED";
  return (
    <Paper variant="outlined" sx={{ p: 1.25, mb: 0.75, borderLeft: 4, borderLeftColor: closed ? "success.main" : "info.main", maxWidth: 420 }} data-testid={closed ? "job-closed-card" : "job-ref-card"}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {closed ? "ปิดงานแล้ว" : "อ้างอิงใบงาน"} · <Link href={href}>{card.jobId}</Link>
      </Typography>
      <Typography variant="body2">{[card.jobName, card.storeName].filter(Boolean).join(" · ") || "—"}</Typography>
      {closed ? (
        <Typography variant="body2" color="text.secondary">
          {card.summary} · โดย {card.byName} · {bangkokTime(card.at)}
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary">
          สถานะใบงาน: {card.summary}
        </Typography>
      )}
      <Button size="small" component={Link} href={href} sx={{ mt: 0.5, px: 0 }}>
        เปิดใบงาน
      </Button>
    </Paper>
  );
}

/**
 * CHAT-02: การ์ดเหตุการณ์คิว (ประวัติ อ่านอย่างเดียว) — ข้อมูลทั้งหมดมาจากข้อความที่ระบบบันทึก ณ เวลานั้น
 * (ข้อความระบบระบุเหตุการณ์ ผู้ดำเนินการ และเวลาเสมอ — serviceQueueNotify.systemText) · ไม่อ่านสถานะปัจจุบันของคิว
 */
function QueueEventCard({ m }: { m: GroupMessage }) {
  const ref = m.ref;
  const no = ref ? (ref.jobId ? `${ref.queueNo} / ${ref.jobId}` : ref.queueNo) : "";
  return (
    <Paper
      variant="outlined"
      data-testid="queue-event-card"
      data-queue-id={ref?.queueId ?? ""}
      sx={{ p: 1.25, maxWidth: 440, bgcolor: "grey.50", borderLeft: 4, borderLeftColor: "grey.400" }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
        <HistoryIcon fontSize="small" color="disabled" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          การ์ดคิว {no}
        </Typography>
        <Chip size="small" variant="outlined" label="ประวัติ" />
      </Stack>
      {m.event ? <EventStatusRow e={m.event} /> : null}
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {m.text || "—"}
      </Typography>
      {ref?.queueId ? (
        <Button size="small" component={Link} href={`/service-queue/${ref.queueId}`} sx={{ mt: 0.25, px: 0 }}>
          เปิดคิว (สถานะล่าสุด)
        </Button>
      ) : null}
    </Paper>
  );
}

/** Phase B: แถวสถานะของเหตุการณ์ — "จาก → เป็น" + ผู้ทำ + เวลาเกิดจริง (snapshot ณ เวลานั้น ไม่เปลี่ยนตามสถานะปัจจุบัน) */
function EventStatusRow({ e }: { e: NonNullable<GroupMessage["event"]> }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.25 }} data-testid="event-status">
      {eventChangedStatus(e) ? (
        <Typography variant="caption" color="text.secondary" data-testid="event-transition">
          {eventTransitionText(e, { job: statusLabel as Record<string, string>, queue: SQ_STATUS_LABEL as Record<string, string> })}
        </Typography>
      ) : null}
      <Chip size="small" color="primary" variant="outlined" label={e.statusLabel || e.toStatus} />
      <Typography variant="caption" color="text.secondary">
        โดย {e.actorName || "ระบบ"} · {bangkokTime(e.at)}
      </Typography>
    </Stack>
  );
}

/** Phase B: เหตุการณ์ใบงาน (ยกเลิก/พัก/กลับมาทำ/อนุมัติเลื่อน) ใน Job Status Timeline — อ่านอย่างเดียว */
function TimelineEventLine({ m, highlight }: { m: GroupMessage; highlight: boolean }) {
  const e = m.event!;
  const href = eventLink(e, m.ref);
  return (
    <Box id={`msg-${m.messageId}`} sx={{ display: "flex", justifyContent: "center", my: 1 }}>
      <Paper
        variant="outlined"
        data-testid="timeline-event"
        data-action={e.action}
        data-job-id={e.jobId ?? ""}
        sx={{ px: 1.5, py: 0.75, maxWidth: { xs: "92%", md: 520 }, bgcolor: highlight ? "warning.light" : "grey.50", borderLeft: 4, borderLeftColor: "primary.light" }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {eventHeadline(e)}
        </Typography>
        <EventStatusRow e={e} />
        <Typography variant="caption" component="div" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {m.text}
        </Typography>
        {href ? (
          <Button size="small" component={Link} href={href} sx={{ px: 0 }}>
            {e.entity === "JOB" ? "เปิดใบงาน" : "เปิดคิว"}
          </Button>
        ) : null}
      </Paper>
    </Box>
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
  // FB-13: เปิดจากปุ่ม "แจ้ง Admin" ของใบงาน → แนบอ้างอิง JN ไว้ในช่องพิมพ์ (ยังไม่ส่งแทนช่าง)
  const jobParam = params.get("job") ?? "";
  const [jobRef, setJobRef] = useState("");
  useEffect(() => {
    setJobRef(jobParam);
  }, [jobParam, active]);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const messagesRef = useRef<GroupMessage[]>([]);
  messagesRef.current = messages;
  const [cards, setCards] = useState<Record<string, QueueCard>>({});
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [text, setText] = useState("");
  // CHAT-02 v2: ผู้ถูกแท็กอ้างอิงด้วย User ID ที่เลือกจากรายชื่อสมาชิก (ชื่อซ้ำ/คล้ายกันก็แยกได้)
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
  // D-14: ยกเลิกข้อความ
  const [cancelTarget, setCancelTarget] = useState<{ m: GroupMessage; mode: CancelMode } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  // เวลาปัจจุบัน (เดินทุก 30 วินาที) — ซ่อนปุ่มยกเลิกเมื่อพ้น 15 นาที (backend ตรวจซ้ำด้วยเวลา server)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const viewer = useMemo(() => (user ? { id: user.id, canModerate: has("chat:moderate") } : null), [user, has]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  // Phase B (TD-04): จุดดึงต่อ (afterSeq/changedSince จาก backend · backend รุ่นเดิม = เวลาล่าสุดแบบ Phase A)
  const pollRef = useRef<PollState>(EMPTY_POLL);
  // Phase B: cursor ตรงตัวของหน้าที่เก่าที่สุดที่โหลดแล้ว ("createdAt|messageId") — null = backend รุ่นเดิม
  const olderRef = useRef<string | null>(null);
  // CHAT-01: ผู้ใช้อยู่ล่างสุดหรือไม่ (true = เลื่อนตามข้อความใหม่/รูปที่โหลดเสร็จ)
  const stickRef = useRef(true);
  // CHAT-04: ห้องที่เปิดอยู่ — ผลตอบกลับของห้องเดิมหลังสลับห้องต้องไม่ปนเข้าห้องใหม่
  const activeRef = useRef(active);
  activeRef.current = active;
  const [newCount, setNewCount] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderAnchor = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  // เปิดจากแจ้งเตือน (?m=) — เลื่อนไปข้อความนั้นเมื่อรายการพร้อม (รายการกลุ่มอาจโหลดเสร็จทีหลังข้อความ)
  const pendingFocus = useRef<string>("");
  const loadingRef = useRef(false);
  loadingRef.current = loadingMsgs;
  const techNav = useTechBottomNavVisible();
  const [paneHeight, setPaneHeight] = useState<number | null>(null);
  const groupsLoaded = groups !== null;
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

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setNewCount(0);
  }, []);
  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = isAtBottom(el);
    if (stickRef.current) setNewCount(0);
  }, []);

  // CHAT-01: ความสูงพื้นที่แชท = ความสูงจอที่มองเห็นจริง (visualViewport — รวมกรณีคีย์บอร์ดมือถือ)
  //   ลบตำแหน่งบนของพื้นที่ และแถบเมนูล่างของช่าง · หน้าเว็บไม่ scroll ซ้อนกับรายการข้อความ
  useLayoutEffect(() => {
    const measure = () => {
      const el = paneRef.current;
      if (!el) return;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      // ส่วนที่อยู่ใต้พื้นที่แชท (padding ของหน้า · ที่เว้นให้แถบเมนูล่างของช่าง) — วัดจริง ไม่เดาค่า
      const tail = Math.max(0, document.documentElement.scrollHeight - (top + rect.height));
      const reserve = Math.max(tail, techNav ? TECH_NAV_HEIGHT : 0);
      setPaneHeight(Math.max(320, Math.floor(vh - top - reserve)));
    };
    measure();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    window.scrollTo(0, 0);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      html.style.overflow = prevOverflow;
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [techNav, wide, active, groupsLoaded]);

  // CHAT-01: เนื้อหาเปลี่ยนขนาด (รูป/การ์ดโหลดเสร็จ ข้อความใหม่) ขณะอยู่ล่างสุด → คงอยู่ล่างสุด
  //   หลังโหลดข้อความก่อนหน้า → คงข้อความที่กำลังอ่านไว้ที่เดิม
  useEffect(() => {
    const content = contentRef.current;
    const el = listRef.current;
    if (!content || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pendingFocus.current && !loadingRef.current) {
        const target = document.getElementById(`msg-${pendingFocus.current}`);
        pendingFocus.current = "";
        if (target) {
          stickRef.current = false;
          target.scrollIntoView({ block: "center" });
          return;
        }
        // ข้อความเป้าหมายเก่ากว่าช่วงที่โหลด — เปิดที่ข้อความล่าสุดแทน
        stickRef.current = true;
      }
      if (olderAnchor.current) {
        el.scrollTop = preservedScrollTop(olderAnchor.current, el.scrollHeight);
        olderAnchor.current = null;
        return;
      }
      if (stickRef.current) el.scrollTop = el.scrollHeight;
    });
    // observe() เรียก callback ครั้งแรกทันที → เปิดห้องแล้วไปล่างสุด แม้รายการเพิ่ง render หลังข้อความโหลดเสร็จ
    ro.observe(content);
    return () => ro.disconnect();
  }, [active, loadingMsgs, groupsLoaded]);

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
    setNewCount(0);
    setHasOlder(false);
    olderAnchor.current = null;
    stickRef.current = !focusMsg;
    pendingFocus.current = focusMsg;
    pollRef.current = EMPTY_POLL;
    olderRef.current = null;
    Promise.all([chatApi.messages(active), chatApi.group(active)])
      .then(([m, g]) => {
        if (!alive) return;
        const sorted = [...m.messages].sort(compareTimeline);
        setMessages(sorted);
        setCards(m.cards);
        setMembers(g.members);
        setHasOlder(hasMoreOlder(m.messages.length, m.cursor));
        pollRef.current = advancePoll(EMPTY_POLL, sorted, m.cursor);
        olderRef.current = m.cursor?.before ?? null;
        markRead(active);
        requestAnimationFrame(() => {
          const target = focusMsg ? document.getElementById(`msg-${focusMsg}`) : null;
          if (target) {
            pendingFocus.current = "";
            stickRef.current = false;
            target.scrollIntoView({ block: "center" });
          } else if (!focusMsg) scrollToBottom();
        });
      })
      .catch((e) => alive && setMsgError(e instanceof ApiError ? e.message : "โหลดข้อความไม่สำเร็จ"))
      .finally(() => alive && setLoadingMsgs(false));
    return () => {
      alive = false;
    };
  }, [active, focusMsg, markRead, scrollToBottom]);

  // ดึงข้อความใหม่เป็นระยะ (การ์ดได้สถานะล่าสุดทุกครั้งที่มีข้อความใหม่)
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const key = active;
      chatApi
        // Phase B: afterSeq + changedSince (ไม่ตกหล่นแม้ข้อความ commit ช้า) · backend รุ่นเดิม = since + overlap (CHAT-04)
        .messages(key, pollQuery(pollRef.current))
        .then((m) => {
          if (activeRef.current !== key) return;
          pollRef.current = advancePoll(pollRef.current, m.messages, m.cursor);
          if (!m.messages.length) return;
          const stick = stickRef.current;
          // เหตุการณ์ที่ส่งเข้าห้องช้า แทรกตามเวลาจริงด้านบน — ไม่นับเป็น "ข้อความใหม่ด้านล่าง"
          const n = newMessageCount(appendedMessages(messagesRef.current, freshMessages(messagesRef.current, m.messages)), user?.id, stick);
          if (n) setNewCount((c) => c + n);
          // D-14: รอบดึงอาจมีข้อความเดิมที่เพิ่งถูกยกเลิก — แทนที่ของเดิมด้วย placeholder
          setMessages((prev) => mergeMessages(prev, m.messages));
          setCards((c) => ({ ...c, ...m.cards }));
          markRead(key);
          if (stick) requestAnimationFrame(scrollToBottom);
        })
        .catch(() => {});
      loadGroups();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, markRead, loadGroups, user?.id, scrollToBottom]);

  // CHAT-01: โหลดข้อความก่อนหน้า (ทีละหน้า) โดยคงตำแหน่งที่กำลังอ่าน
  const loadOlder = useCallback(() => {
    const key = active;
    const before = olderQuery(olderRef.current, messages);
    if (!key || !before || loadingOlder) return;
    setLoadingOlder(true);
    chatApi
      .messages(key, { before })
      .then((m) => {
        if (activeRef.current !== key) return;
        const el = listRef.current;
        const fresh = freshMessages(messages, m.messages);
        if (m.cursor?.before) olderRef.current = m.cursor.before;
        // backend รุ่นเดิม: หน้าที่ไม่มีข้อความใหม่ = หมดแล้ว · Phase B: ใช้ hasMore (cursor ตรงตัว เดินหน้าเสมอ)
        if (!fresh.length) {
          setHasOlder(m.cursor ? hasMoreOlder(m.messages.length, m.cursor) && !!m.messages.length : false);
          return;
        }
        if (el) olderAnchor.current = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
        stickRef.current = false;
        setMessages((prev) => mergeMessages(prev, m.messages));
        setCards((c) => ({ ...m.cards, ...c }));
        setHasOlder(hasMoreOlder(m.messages.length, m.cursor));
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "โหลดข้อความก่อนหน้าไม่สำเร็จ"))
      .finally(() => setLoadingOlder(false));
  }, [active, messages, loadingOlder, toast]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.messageId, m])), [messages]);
  // CHAT-02: การ์ดคิวใบล่าสุดของแต่ละคิว (ใบอื่นเป็นประวัติเหตุการณ์)
  const liveCardIds = useMemo(() => latestQueueCardIds(messages), [messages]);
  // หลังกดปุ่มบนการ์ด — โหลดสถานะการ์ดล่าสุดของทั้งห้อง (ข้อความระบบใหม่มาตามรอบ poll)
  const refreshCards = useCallback(() => {
    if (!active) return;
    const key = active;
    chatApi
      .messages(key, pollQuery(pollRef.current))
      .then((m) => {
        if (activeRef.current !== key) return;
        setCards((c) => ({ ...c, ...m.cards }));
        setMessages((prev) => mergeMessages(prev, m.messages));
        pollRef.current = advancePoll(pollRef.current, m.messages, m.cursor);
      })
      .catch(() => {});
  }, [active]);
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
      // ส่งเฉพาะผู้ที่ยังมี "@ชื่อ" อยู่ในข้อความ (ผู้ใช้ลบชื่อออกแล้ว = ไม่แท็ก)
      const mentions = mentionsToSend(mentionIds, members, body);
      // D-13: คีย์เดียวต่อการกดส่งหนึ่งครั้ง — ลองใหม่ (เครือข่ายหลุด/5xx) ด้วยคีย์เดิม จึงไม่ได้ข้อความหรือแจ้งเตือนซ้ำ
      const clientMessageId = newClientMessageId();
      const payload = { text: body, replyToId: replyTo?.messageId, attachments, jobRef: jobRef || undefined, mentions: mentions.length ? mentions : undefined, clientMessageId };
      const key = active;
      const r = await sendWithRetry(() => chatApi.send(key, payload), (e) => (e instanceof ApiError ? e.status : null));
      if (activeRef.current !== key) return;
      setMessages((prev) => mergeMessages(prev, [r.message]));
      // ข้อความของตนเองไม่เลื่อน afterSeq (ข้อความผู้อื่นที่ seq น้อยกว่าอาจยังไม่ถูกดึง) — มาซ้ำในรอบถัดไปแล้วตัดซ้ำด้วย messageId
      pollRef.current = advancePoll(pollRef.current, [r.message], null);
      setText("");
      setMentionIds([]);
      setFiles([]);
      setReplyTo(null);
      setJobRef("");
      requestAnimationFrame(scrollToBottom);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  // "@คำ" ท้ายข้อความ → แสดงรายชื่อสมาชิกที่ขึ้นต้นด้วยคำนั้น
  const mentionQuery = mentionQueryOf(text);
  const mentionList = mentionOptions(members, mentionQuery, user?.id);
  const pickMention = (mm: { id: string; name: string }) => {
    setText((t) => applyMention(t, mm.name));
    setMentionIds((ids) => (ids.includes(mm.id) ? ids : [...ids, mm.id]));
  };

  const openCancel = (m: GroupMessage) => {
    const mode = canCancel(m, Date.now(), viewer);
    if (!mode) return toast.error(cancelErrorMessage(403));
    setCancelReason("");
    setCancelTarget({ m, mode });
  };
  const confirmCancel = async () => {
    if (!cancelTarget || !active || cancelling) return;
    const reason = cancelReason.trim();
    if (cancelTarget.mode === "ADMIN" && !reason) return toast.error("กรุณาระบุเหตุผลในการยกเลิกข้อความ");
    setCancelling(true);
    try {
      const r = await chatApi.cancel(active, cancelTarget.m.messageId, reason || undefined);
      setMessages((prev) => mergeMessages(prev, [r.message]));
      setReplyTo((cur) => (cur?.messageId === r.message.messageId ? null : cur));
      setCancelTarget(null);
      toast.success("ยกเลิกข้อความแล้ว");
      loadGroups();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      toast.error(cancelErrorMessage(status, e instanceof ApiError ? e.message : undefined));
      if (status === 409 || status === 403) {
        setCancelTarget(null);
        refreshCards();
      }
    } finally {
      setCancelling(false);
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
                  ? g.lastMessage.cancelled
                    ? `${g.lastMessage.senderName}: ${cancelledLabel(g.lastMessage)}`
                    : `${g.lastMessage.kind === "TEXT" ? g.lastMessage.senderName + ": " : ""}${(g.lastMessage.text || "ไฟล์แนบ").slice(0, 50)}`
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
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }} data-testid="chat-header">
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

      <Box sx={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
      <Box
        ref={listRef}
        onScroll={onListScroll}
        data-testid="chat-scroll"
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", px: 1.5, py: 1, bgcolor: "grey.50" }}
        aria-live="polite"
      >
       <Box ref={contentRef} data-testid="chat-messages">
        {!loadingMsgs && hasOlder ? (
          <Box sx={{ textAlign: "center", mb: 1 }}>
            <Button size="small" variant="outlined" onClick={loadOlder} disabled={loadingOlder} data-testid="load-older">
              {loadingOlder ? "กำลังโหลด…" : "โหลดข้อความก่อนหน้า"}
            </Button>
          </Box>
        ) : null}
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
          if (m.cancelled) {
            // D-14: placeholder — ไม่มีข้อความ ไฟล์แนบ หรือผู้ถูกแท็ก (backend ไม่ส่งมาอยู่แล้ว)
            return (
              <Stack
                id={`msg-${m.messageId}`}
                key={m.messageId}
                direction="row"
                justifyContent={mine ? "flex-end" : "flex-start"}
                sx={{ my: 1, borderRadius: 1, outline: highlight ? "2px solid" : "none", outlineColor: "warning.main" }}
                data-testid="cancelled-message"
              >
                <Box sx={{ maxWidth: { xs: "92%", md: "75%" } }}>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: mine ? "right" : "left" }}>
                    {`${m.senderName} · ${ROLE_LABEL[m.senderRole] ?? m.senderRole}`} · {bangkokTime(m.createdAt)}
                  </Typography>
                  <Paper elevation={0} sx={{ p: 1.25, bgcolor: "grey.100", border: 1, borderStyle: "dashed", borderColor: "divider" }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <BlockIcon fontSize="small" color="disabled" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                        {cancelledLabel(m)}
                      </Typography>
                    </Stack>
                    {m.cancelReason || m.cancelledBy ? (
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                        {m.cancelledBy ? `ยกเลิกโดย ${m.cancelledBy}` : ""}
                        {m.cancelledAt ? ` · ${bangkokTime(m.cancelledAt)}` : ""}
                        {m.cancelReason ? ` · เหตุผล: ${m.cancelReason}` : ""}
                      </Typography>
                    ) : null}
                  </Paper>
                </Box>
              </Stack>
            );
          }
          const cancelMode = canCancel(m, nowMs, viewer);
          if (m.kind === "SYSTEM" && m.event) {
            return <TimelineEventLine key={m.messageId} m={m} highlight={highlight} />;
          }
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
                  {m.kind === "CARD" ? "ระบบ" : `${m.senderName} · ${ROLE_LABEL[m.senderRole] ?? m.senderRole}`} · {bangkokTime(occurredAtOf(m))}
                </Typography>
                {m.jobCard ? (
                  <JobCardView card={m.jobCard} />
                ) : null}
                {m.jobCard?.type === "JOB_CLOSED" ? (
                  m.attachments?.length ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                      {m.attachments.map((a) => (
                        <Attachment key={a.fileId} a={a} onPreview={(src, name) => setPreview({ src, name })} />
                      ))}
                    </Stack>
                  ) : null
                ) : m.kind === "CARD" && m.ref ? (
                  liveCardIds.has(m.messageId) ? (
                    // CHAT-02: ใบล่าสุดของคิว — เหตุการณ์นี้ + สถานะปัจจุบันและปุ่ม (backend ตรวจ version ทุกปุ่ม)
                    <Box data-testid="queue-live-card" data-queue-id={m.ref.queueId}>
                      {m.text ? (
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5, maxWidth: 440, whiteSpace: "pre-wrap" }}>
                          {m.text}
                        </Typography>
                      ) : null}
                      <QueueCardView card={cards[m.ref.queueId]} fallback={m.ref} onChanged={refreshCards} />
                    </Box>
                  ) : (
                    <QueueEventCard m={m} />
                  )
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
                        <Typography variant="caption" component="div" color="text.secondary" sx={m.replyTo.cancelled ? { fontStyle: "italic" } : undefined}>
                          {m.replyTo.cancelled ? "ข้อความนี้ถูกยกเลิก" : m.replyTo.excerpt}
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
                    {m.mentions?.length ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }} aria-label="ผู้ถูกแท็ก">
                        {m.mentions.map((mm) => (
                          <Chip
                            key={mm.userId}
                            size="small"
                            color={mm.userId === user?.id ? "warning" : "default"}
                            label={`@${mm.name} · ${ROLE_LABEL[mm.role] ?? mm.role}`}
                            data-user-id={mm.userId}
                          />
                        ))}
                      </Stack>
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
                  {cancelMode ? (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<BlockIcon fontSize="small" />}
                      onClick={() => openCancel(m)}
                      sx={{ minWidth: 0, fontSize: 12, ml: 0.5 }}
                      data-testid="cancel-message"
                    >
                      ยกเลิกข้อความ
                    </Button>
                  ) : null}
                </Box>
              </Box>
            </Stack>
          );
        })}
       </Box>
      </Box>
      {newCount > 0 ? (
        <Button
          variant="contained"
          size="small"
          // กระโดดไปล่างสุดทันที (smooth scroll ระยะไกลถูก scroll event ระหว่างทางตัดสถานะ "อยู่ล่าง" จนหยุดก่อนถึง)
          onClick={scrollToBottom}
          endIcon={<KeyboardArrowDownIcon />}
          data-testid="new-message-indicator"
          sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", borderRadius: 4, boxShadow: 3, zIndex: 1 }}
        >
          ข้อความใหม่ {newCount > 99 ? "99+" : newCount}
        </Button>
      ) : null}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: "divider", p: 1, flexShrink: 0 }} data-testid="chat-composer">
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
        {jobRef ? (
          <Stack direction="row" alignItems="center" sx={{ bgcolor: "info.light", borderRadius: 1, px: 1, py: 0.5, mb: 1 }} data-testid="job-ref-chip">
            <Typography variant="caption" sx={{ flex: 1 }}>
              อ้างอิงใบงาน <strong>{jobRef}</strong> — พิมพ์ข้อความถึง Admin แล้วกดส่ง (ระบบยังไม่ส่งแทนคุณ)
            </Typography>
            <IconButton size="small" aria-label="เอาอ้างอิงใบงานออก" onClick={() => setJobRef("")}>
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
        {mentionQuery !== null && mentionList.length ? (
          <Paper variant="outlined" sx={{ mb: 1, maxHeight: 200, overflowY: "auto" }} role="listbox" aria-label="เลือกผู้ใช้ที่จะแท็ก">
            {mentionList.map((mm) => (
              <Box
                key={mm.id}
                role="option"
                aria-selected={false}
                tabIndex={0}
                onClick={() => pickMention(mm)}
                onKeyDown={(e) => (e.key === "Enter" ? pickMention(mm) : undefined)}
                sx={{ px: 1.5, py: 0.75, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
              >
                <Typography variant="body2">
                  @{mm.name} <Typography component="span" variant="caption" color="text.secondary">· {ROLE_LABEL[mm.role] ?? mm.role}</Typography>
                </Typography>
              </Box>
            ))}
          </Paper>
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
      {/* มือถือขณะเปิดห้อง: ซ่อนหัวหน้า ให้พื้นที่แชทเต็มจอ (หัวห้องมีปุ่มย้อนกลับ) */}
      {wide || !active ? (
        <WomsPageHeader title="แชทกลุ่ม" subtitle="กลุ่มเช็คคิว และกลุ่มงานช่าง (หนึ่งกลุ่มต่อช่าง ใช้ร่วมหลายคิว/หลาย JN)" />
      ) : null}
      <Box ref={paneRef} data-testid="chat-pane" sx={{ height: paneHeight ?? { xs: "calc(100dvh - 170px)", md: "calc(100dvh - 190px)" }, minHeight: 320 }}>
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

      <Dialog open={!!cancelTarget} onClose={() => (cancelling ? undefined : setCancelTarget(null))} fullWidth maxWidth="xs">
        <DialogTitle>ยกเลิกข้อความ</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {cancelTarget?.mode === "ADMIN"
              ? `ยกเลิกข้อความของ ${cancelTarget.m.senderName} ในฐานะผู้ดูแลระบบ — สมาชิกจะเห็นว่า "ข้อความนี้ถูกยกเลิกโดยผู้ดูแลระบบ" และเนื้อหาเดิมเก็บไว้ในประวัติที่ผู้มีสิทธิ์ตรวจสอบเท่านั้น`
              : `ยกเลิกข้อความนี้? สมาชิกจะเห็นว่า "ข้อความนี้ถูกยกเลิก" (ยกเลิกได้ภายใน 15 นาทีหลังส่ง)`}
          </Typography>
          {cancelTarget?.mode === "ADMIN" ? (
            <TextField
              autoFocus
              fullWidth
              required
              multiline
              minRows={2}
              size="small"
              label="เหตุผลในการยกเลิก"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              error={!cancelReason.trim()}
              helperText={!cancelReason.trim() ? "ต้องระบุเหตุผล" : " "}
              inputProps={{ maxLength: 500 }}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling}>
            ไม่ยกเลิก
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void confirmCancel()}
            disabled={cancelling || (cancelTarget?.mode === "ADMIN" && !cancelReason.trim())}
          >
            ยกเลิกข้อความ
          </Button>
        </DialogActions>
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
