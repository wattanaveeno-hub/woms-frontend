"use client";
// CHAT-SR02 ค้นข้อความในห้องแชทแบบ LINE (แทน ChatSearchDialog เดิม)
//   - ช่องค้นหาแทนหัวห้อง · ผลแสดงทับห้องแชท: แท็บ ทั้งหมด / ข้อความ / สมาชิก · รูป ชื่อ วันที่ และไฮไลต์คำที่ค้น
//   - ค้นทั้งประวัติ (โหลดผลเพิ่มทีละหน้าเมื่อเลื่อนถึงท้าย) · กดผล = ไปข้อความนั้นในห้อง (โหลดช่วงรอบข้อความเก่าให้)
//   - อยู่ในห้องแล้วใช้ ▲ (เก่ากว่า) ▼ (ใหม่กว่า) ไล่ผลถัดไป · คำที่ค้นถูกไฮไลต์ในข้อความของห้อง
//   backend ตรวจสมาชิกกลุ่มทุกคำขอ และไม่คืนข้อความที่ถูกยกเลิก
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CancelIcon from "@mui/icons-material/Cancel";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import UserAvatar from "@/components/UserAvatar";
import { ApiError } from "@/lib/api";
import { chatApi, type GroupMessage } from "@/lib/serviceQueueApi";
import {
  filterMembers,
  normalizeTerm,
  positionLabel,
  resultDateLabel,
  searchableTextOf,
  snippetAround,
  splitHighlight,
  stepResult,
} from "@/lib/chatSearchRules";

export type SearchTab = "all" | "messages" | "members";
export interface SearchMember {
  id: string;
  name: string;
  role: string;
}

/** ข้อความที่มีคำค้นถูกไฮไลต์ (ใช้ทั้งในรายการผลและในห้องแชท) */
export function Highlight({ text, term }: { text: string; term: string }) {
  const parts = splitHighlight(text, term);
  if (!term) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <Box key={i} component="mark" data-testid="search-hit" sx={{ bgcolor: "transparent", color: "success.main", fontWeight: 700, p: 0 }}>
            {p.text}
          </Box>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

/** สถานะการค้นหาของห้องหนึ่ง — เปลี่ยนห้อง = ปิดและล้างผล */
export function useChatSearch(groupKey: string) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const term = normalizeTerm(q);
  const [items, setItems] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(-1);
  const [showResults, setShowResults] = useState(true);
  const [tab, setTab] = useState<SearchTab>("all");
  const reqId = useRef(0);
  const moreRef = useRef<Promise<GroupMessage[] | null> | null>(null);

  useEffect(() => {
    setOpen(false);
    setQ("");
  }, [groupKey]);

  useEffect(() => {
    const id = ++reqId.current;
    moreRef.current = null;
    setIndex(-1);
    setShowResults(true);
    if (!open || !term) {
      setItems([]);
      setHasMore(false);
      setCursor(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      chatApi
        .search(groupKey, term)
        .then((r) => {
          if (id !== reqId.current) return;
          setItems(r.items.map((i) => i.message));
          setHasMore(!!r.hasMore);
          setCursor(r.nextCursor ?? null);
          setError(null);
        })
        .catch((e) => id === reqId.current && setError(e instanceof ApiError ? e.message : "ค้นหาไม่สำเร็จ"))
        .finally(() => id === reqId.current && setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, term, groupKey]);

  /** โหลดผลหน้าถัดไป (เก่ากว่า) — คืนรายการทั้งหมดหลังรวม หรือ null ถ้าไม่มี/ล้มเหลว */
  const loadMore = useCallback((): Promise<GroupMessage[] | null> => {
    if (!hasMore || !cursor || !term) return Promise.resolve(null);
    if (moreRef.current) return moreRef.current;
    const id = reqId.current;
    setLoadingMore(true);
    const p = chatApi
      .search(groupKey, term, cursor)
      .then((r) => {
        if (id !== reqId.current) return null;
        let merged: GroupMessage[] = [];
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.messageId));
          merged = [...prev, ...r.items.map((i) => i.message).filter((m) => !seen.has(m.messageId))];
          return merged;
        });
        setHasMore(!!r.hasMore);
        setCursor(r.nextCursor ?? null);
        return merged;
      })
      .catch((e) => {
        if (id === reqId.current) setError(e instanceof ApiError ? e.message : "โหลดผลเพิ่มไม่สำเร็จ");
        return null;
      })
      .finally(() => {
        if (moreRef.current === p) moreRef.current = null;
        setLoadingMore(false);
      });
    moreRef.current = p;
    return p;
  }, [hasMore, cursor, term, groupKey]);

  /** ▲▼ — คืน messageId ของผลที่ต้องไป (null = ไม่มี) */
  const step = useCallback(
    async (dir: "older" | "newer"): Promise<string | null> => {
      const s = stepResult(index, items.length, dir, hasMore);
      if (s.kind === "GO") {
        setIndex(s.index);
        return items[s.index]?.messageId ?? null;
      }
      if (s.kind === "LOAD") {
        const list = await loadMore();
        const next = index + 1;
        if (list && list[next]) {
          setIndex(next);
          return list[next].messageId;
        }
      }
      return null;
    },
    [index, items, hasMore, loadMore]
  );

  return {
    open,
    q,
    term,
    items,
    hasMore,
    loading,
    loadingMore,
    error,
    index,
    showResults,
    tab,
    setQ: (v: string) => setQ(v),
    setTab,
    setShowResults,
    setIndex,
    loadMore,
    step,
    openSearch: () => {
      setOpen(true);
      setShowResults(true);
    },
    close: () => {
      setOpen(false);
      setQ("");
    },
  };
}
export type ChatSearchState = ReturnType<typeof useChatSearch>;

/** แถบค้นหา (แทนหัวห้อง) — ← ปิด · ช่องค้นหา · ✕ ล้าง · ลำดับผล · ▲ ▼ */
export function ChatSearchBar(props: { s: ChatSearchState; onGo: (messageId: string) => void; compact?: boolean }) {
  const { s, onGo, compact } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (s.open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [s.open]);
  const nav = s.term && s.items.length > 0;
  const go = async (dir: "older" | "newer") => {
    const id = await s.step(dir);
    if (id) {
      s.setShowResults(false);
      onGo(id);
    }
  };
  const size = compact ? "small" : "medium";
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, minWidth: 0 }} data-testid="chat-search-bar">
      <IconButton aria-label="ปิดการค้นหา" onClick={s.close} size={size}>
        <ArrowBackIcon />
      </IconButton>
      <Paper
        variant="outlined"
        sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", px: 1, py: compact ? 0 : 0.25, borderRadius: 2, bgcolor: "grey.50" }}
      >
        <SearchIcon fontSize="small" color="action" />
        <InputBase
          inputRef={inputRef}
          value={s.q}
          onChange={(e) => s.setQ(e.target.value)}
          onFocus={() => s.term && s.setShowResults(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") s.close();
            if (e.key === "Enter" && s.items.length) {
              e.preventDefault();
              void go(s.index < 0 ? "older" : e.shiftKey ? "newer" : "older");
            }
          }}
          placeholder="ค้นหาข้อความ เลขคิว JN ไฟล์ หรือสมาชิก"
          inputProps={{ "aria-label": "คำค้นในกลุ่ม", maxLength: 100, enterKeyHint: "search" }}
          sx={{ flex: 1, ml: 0.75, fontSize: 15 }}
        />
        {s.q ? (
          <IconButton aria-label="ล้างคำค้น" size="small" onClick={() => s.setQ("")} sx={{ p: 0.25 }}>
            <CancelIcon fontSize="small" sx={{ color: "grey.500" }} />
          </IconButton>
        ) : null}
      </Paper>
      {nav ? (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: "center", whiteSpace: "nowrap" }} data-testid="search-position">
            {s.index < 0 ? `${s.items.length}${s.hasMore ? "+" : ""}` : positionLabel(s.index, s.items.length, s.hasMore)}
          </Typography>
          <IconButton
            aria-label="ผลที่เก่ากว่า"
            size={size}
            disabled={stepResult(s.index, s.items.length, "older", s.hasMore).kind === "NONE" || s.loadingMore}
            onClick={() => void go("older")}
            data-testid="search-older"
          >
            <KeyboardArrowUpIcon />
          </IconButton>
          <IconButton
            aria-label="ผลที่ใหม่กว่า"
            size={size}
            disabled={stepResult(s.index, s.items.length, "newer", s.hasMore).kind === "NONE"}
            onClick={() => void go("newer")}
            data-testid="search-newer"
          >
            <KeyboardArrowDownIcon />
          </IconButton>
        </>
      ) : null}
    </Stack>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" component="div" sx={{ px: 2, pt: 1.5, pb: 0.5, bgcolor: "grey.50" }}>
      {children}
    </Typography>
  );
}

/** รายการผล (ทับห้องแชท) */
export function ChatSearchResults(props: {
  s: ChatSearchState;
  members: SearchMember[];
  roleLabel: (role: string) => string;
  onGo: (messageId: string) => void;
}) {
  const { s, members, roleLabel, onGo } = props;
  const listRef = useRef<HTMLDivElement>(null);
  if (!s.open || !s.showResults || !s.term) return null;
  const memberHits = filterMembers(members, s.term);
  const showMsgs = s.tab !== "members";
  const showMembers = s.tab !== "messages";
  const msgCount = `${s.items.length}${s.hasMore ? "+" : ""}`;
  const pick = (i: number) => {
    const m = s.items[i];
    if (!m) return;
    s.setIndex(i);
    s.setShowResults(false);
    onGo(m.messageId);
  };
  const onScroll = () => {
    const el = listRef.current;
    if (el && s.hasMore && !s.loadingMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 120) void s.loadMore();
  };
  const now = new Date();

  return (
    <Box
      sx={{ position: "absolute", inset: 0, zIndex: 3, bgcolor: "background.paper", display: "flex", flexDirection: "column", minHeight: 0 }}
      data-testid="chat-search-results"
    >
      <Tabs value={s.tab} onChange={(_, v) => s.setTab(v)} variant="fullWidth" sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider", flexShrink: 0, "& .MuiTab-root": { minHeight: 40, px: 0.5, whiteSpace: "nowrap" } }}>
        <Tab value="all" label="ทั้งหมด" sx={{ minHeight: 40 }} />
        <Tab value="messages" label={`ข้อความ${s.loading ? "" : ` ${msgCount}`}`} sx={{ minHeight: 40 }} />
        <Tab value="members" label={`สมาชิก ${memberHits.length}`} sx={{ minHeight: 40 }} />
      </Tabs>
      <Box ref={listRef} onScroll={onScroll} sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {s.error ? <Alert severity="error" sx={{ m: 1.5 }}>{s.error}</Alert> : null}
        {showMsgs ? (
          <>
            {s.tab === "all" ? <SectionTitle>ข้อความ {s.loading ? "" : msgCount}</SectionTitle> : null}
            {s.loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : !s.items.length ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                ไม่พบข้อความที่ตรงกับคำค้น
              </Typography>
            ) : (
              <List disablePadding data-testid="chat-search-message-results">
                {s.items.map((m, i) => (
                  <ListItemButton
                    key={m.messageId}
                    onClick={() => pick(i)}
                    selected={i === s.index}
                    divider
                    alignItems="flex-start"
                    sx={{ py: 1 }}
                    data-testid="chat-search-result"
                  >
                    <ListItemAvatar sx={{ minWidth: 56 }}>
                      {m.kind === "TEXT" ? (
                        <UserAvatar userId={m.senderId} name={m.senderName} size={44} />
                      ) : (
                        <Avatar sx={{ width: 44, height: 44, bgcolor: "grey.400" }}>
                          <InfoOutlinedIcon />
                        </Avatar>
                      )}
                    </ListItemAvatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {m.kind === "TEXT" ? m.senderName : "ระบบ"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {resultDateLabel(m.occurredAt ?? m.createdAt, now)}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        <Highlight text={snippetAround(searchableTextOf(m, s.term), s.term)} term={s.term} />
                      </Typography>
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            )}
            {s.hasMore && !s.loading ? (
              <Box sx={{ textAlign: "center", py: 1 }}>
                <Button size="small" onClick={() => void s.loadMore()} disabled={s.loadingMore} data-testid="chat-search-more">
                  {s.loadingMore ? "กำลังโหลด…" : "ดูผลที่เก่ากว่า"}
                </Button>
              </Box>
            ) : null}
          </>
        ) : null}
        {showMembers ? (
          <>
            {s.tab === "all" ? <SectionTitle>สมาชิก {memberHits.length}</SectionTitle> : null}
            {!memberHits.length ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                ไม่พบสมาชิกที่ชื่อตรงกับคำค้น
              </Typography>
            ) : (
              <List disablePadding data-testid="chat-search-member-results">
                {memberHits.map((mm) => (
                  <ListItem key={mm.id} divider sx={{ py: 1 }}>
                    <ListItemAvatar sx={{ minWidth: 56 }}>
                      <UserAvatar userId={mm.id} name={mm.name} size={44} />
                    </ListItemAvatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        <Highlight text={mm.name} term={s.term} />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {roleLabel(mm.role)}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </>
        ) : null}
      </Box>
    </Box>
  );
}
