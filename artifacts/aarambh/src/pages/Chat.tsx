import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";


// ─────────────────────────────────────────────────────────────────────────
// Adjust these two imports to match your existing Firebase setup.
// (Next Toppers Feed already initializes Firebase elsewhere — point these
// at that file instead of creating a second app instance.)
// ─────────────────────────────────────────────────────────────────────────
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useUnread } from "@/contexts/UnreadContext";

/* ════════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════════ */

type ChatCategory = "private" | "community";

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  online?: boolean;
  lastSeen?: Timestamp | null;
}

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: Timestamp | null;
  replyTo?: { id: string; text: string; senderName: string } | null;
  seenBy?: string[];
}

interface PrivateConversation {
  id: string;
  participants: string[];
  otherUser: UserProfile;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  unreadCount: number;
}

/* ════════════════════════════════════════════════════════════════════════
   ICONS  (inline, dependency-free, 1.75px stroke to match a soft neon line)
   ════════════════════════════════════════════════════════════════════════ */

const Icon = {
  Send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  More: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  DoubleCheck: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m1.5 12.5 4 4 4-4" />
      <path d="M8 16 19 5" />
      <path d="m8.5 12.5 4 4L23 6" />
    </svg>
  ),
  Reply: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17 4 12l5-5" />
      <path d="M4 12h11a5 5 0 0 1 5 5v1" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════════════════
   SMALL HOOKS / HELPERS
   ════════════════════════════════════════════════════════════════════════ */

/** Keeps a component mounted for `duration` ms after `show` flips false,
 *  so an exit animation can finish before the node is removed. Prevents the
 *  "pop out instantly" bug and any overlap with the next panel mounting. */
function useDelayedUnmount(show: boolean, duration: number) {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (show) setMounted(true);
    else t = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(t);
  }, [show, duration]);
  return mounted;
}

function chatIdFor(a: string, b: string) {
  return [a, b].sort().join("_");
}

function formatTime(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  const d = ts.toDate();
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (x: Date, y: Date) =>
    x.toDateString() === y.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

/* ════════════════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND — ambient neon orbs, pure CSS, GPU-only transforms
   ════════════════════════════════════════════════════════════════════════ */

const AmbientBackground: React.FC = () => (
  <div className="ntf-bg" aria-hidden="true">
    <span className="ntf-orb ntf-orb-a" />
    <span className="ntf-orb ntf-orb-b" />
    <span className="ntf-orb ntf-orb-c" />
    <div className="ntf-grain" />
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   AVATAR
   ════════════════════════════════════════════════════════════════════════ */

const Avatar: React.FC<{
  name: string;
  photo?: string | null;
  size?: number;
  online?: boolean;
}> = ({ name, photo, size = 44, online }) => (
  <div className="ntf-avatar-wrap" style={{ width: size, height: size }}>
    {photo ? (
      <img src={photo} alt={name} className="ntf-avatar-img" />
    ) : (
      <div className="ntf-avatar-fallback" style={{ fontSize: size * 0.38 }}>
        {initialsOf(name) || "?"}
      </div>
    )}
    {online && <span className="ntf-online-dot" />}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   CATEGORY TOGGLE  — Private / Community, sliding pill indicator
   ════════════════════════════════════════════════════════════════════════ */

const CategoryToggle: React.FC<{
  value: ChatCategory;
  onChange: (c: ChatCategory) => void;
}> = ({ value, onChange }) => (
  <div className="ntf-toggle" role="tablist" aria-label="Chat category">
    <div
      className="ntf-toggle-pill"
      style={{ transform: value === "private" ? "translateX(0%)" : "translateX(100%)" }}
    />
    <button
      role="tab"
      aria-selected={value === "private"}
      className={`ntf-toggle-btn ${value === "private" ? "is-active" : ""}`}
      onClick={() => onChange("private")}
    >
      <Icon.Lock />
      <span>Private</span>
    </button>
    <button
      role="tab"
      aria-selected={value === "community"}
      className={`ntf-toggle-btn ${value === "community" ? "is-active" : ""}`}
      onClick={() => onChange("community")}
    >
      <Icon.Users />
      <span>Community</span>
    </button>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   CONVERSATION LIST ITEM (private sidebar)
   ════════════════════════════════════════════════════════════════════════ */

const ConversationItem: React.FC<{
  convo: PrivateConversation;
  active: boolean;
  onClick: () => void;
}> = ({ convo, active, onClick }) => (
  <button
    className={`ntf-convo-item ${active ? "is-active" : ""}`}
    onClick={onClick}
  >
    <Avatar name={convo.otherUser.displayName} photo={convo.otherUser.photoURL} online={convo.otherUser.online} />
    <div className="ntf-convo-meta">
      <div className="ntf-convo-top">
        <span className="ntf-convo-name">{convo.otherUser.displayName}</span>
        <span className="ntf-convo-time">{formatTime(convo.lastMessageAt)}</span>
      </div>
      <div className="ntf-convo-bottom">
        <span className="ntf-convo-preview">{convo.lastMessage || "Say hello 👋"}</span>
        {convo.unreadCount > 0 && (
          <span className="ntf-unread-badge">{convo.unreadCount}</span>
        )}
      </div>
    </div>
  </button>
);

/* ════════════════════════════════════════════════════════════════════════
   MESSAGE BUBBLE
   ════════════════════════════════════════════════════════════════════════ */

const MessageBubble: React.FC<{
  msg: ChatMessage;
  own: boolean;
  showSender: boolean;
  onReply: (m: ChatMessage) => void;
}> = ({ msg, own, showSender, onReply }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`ntf-msg-row ${own ? "is-own" : "is-other"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!own && showSender && (
        <div className="ntf-msg-avatar">
          <Avatar name={msg.senderName} photo={msg.senderPhoto} size={30} />
        </div>
      )}
      <div className={`ntf-bubble-col ${!own && !showSender ? "ntf-bubble-indent" : ""}`}>
        {!own && showSender && <span className="ntf-msg-sender">{msg.senderName}</span>}
        <div className={`ntf-bubble ${own ? "ntf-bubble-own" : "ntf-bubble-other"}`}>
          {msg.replyTo && (
            <div className="ntf-reply-preview">
              <span className="ntf-reply-name">{msg.replyTo.senderName}</span>
              <span className="ntf-reply-text">{msg.replyTo.text}</span>
            </div>
          )}
          <span className="ntf-bubble-text">{msg.text}</span>
          <span className="ntf-bubble-time">
            {formatTime(msg.createdAt)}
            {own && (
              <span className="ntf-bubble-tick">
                {msg.seenBy && msg.seenBy.length > 0 ? <Icon.DoubleCheck /> : <Icon.Check />}
              </span>
            )}
          </span>
        </div>
        <button
          className={`ntf-reply-trigger ${own ? "ntf-reply-trigger-own" : ""} ${showActions ? "is-visible" : ""}`}
          onClick={() => onReply(msg)}
          aria-label="Reply"
        >
          <Icon.Reply />
        </button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════
   TYPING DOTS
   ════════════════════════════════════════════════════════════════════════ */

const TypingDots: React.FC = () => (
  <div className="ntf-typing">
    <span /><span /><span />
  </div>
);

/* ════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

const Chat: React.FC = () => {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { isPremium } = usePremium();
  const { privateUnread, markCommunityRead, resetPrivateUnread } = useUnread();
  const [category, setCategory] = useState<ChatCategory>("community");

  const [conversations, setConversations] = useState<PrivateConversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [activeConvo, setActiveConvo] = useState<PrivateConversation | null>(null);

  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>([]);

  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [convoSearch, setConvoSearch] = useState("");
  const [sending, setSending] = useState(false);

  // Mobile: whether the conversation panel is open over the list.
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const chatPanelMounted = useDelayedUnmount(mobileChatOpen || category === "community", 320);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* — private conversation list — */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "privateChatMeta"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("lastMessageAt", "desc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const rows: PrivateConversation[] = [];
      for (const d of snap.docs) {
        const data = d.data() as any;
        const otherUid = (data.participants as string[]).find((p) => p !== currentUser.uid);
        if (!otherUid) continue;
        let otherUser: UserProfile = { uid: otherUid, displayName: "Student", photoURL: null };
        try {
          const uSnap = await getDoc(doc(db, "users", otherUid));
          if (uSnap.exists()) {
            const ud = uSnap.data() as any;
            otherUser = {
              uid: otherUid,
              displayName: ud.name || ud.displayName || "Student",
              photoURL: ud.photoURL || null,
              online: ud.isOnline ?? ud.online ?? false,
            };
          }
        } catch {
          /* profile fetch best-effort */
        }
        rows.push({
          id: d.id,
          participants: data.participants,
          otherUser,
          lastMessage: data.lastMessage || "",
          lastMessageAt: data.lastMessageAt || null,
          unreadCount: data[`unread_${currentUser.uid}`] || 0,
        });
      }
      setConversations(rows);
    });
    return unsub;
  }, [currentUser]);

  /* — active private conversation's messages — */
  useEffect(() => {
    if (!activeConvoId) {
      setPrivateMessages([]);
      return;
    }
    const q = query(
      collection(db, "privateChats", activeConvoId, "messages"),
      orderBy("createdAt", "asc"),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPrivateMessages(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            text: data.text ?? data.message ?? "",
          };
        }) as ChatMessage[]
      );
    });
    return unsub;
  }, [activeConvoId]);

  /* — community messages — */
  useEffect(() => {
    if (category !== "community") return;
    const q = query(
      collection(db, "communityMessages"),
      orderBy("createdAt", "asc"),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      setCommunityMessages(
        snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            text: data.text ?? data.message ?? "",
          };
        }) as ChatMessage[]
      );
    });
    return unsub;
  }, [category]);

  /* — use the shared unread system — */
  useEffect(() => {
    if (!currentUser) return;
    if (category === "community") {
      markCommunityRead();
      return;
    }
    if (activeConvoId && activeConvo) {
      resetPrivateUnread(activeConvo.otherUser.uid, activeConvoId);
    }
  }, [category, activeConvoId, activeConvo?.otherUser.uid, currentUser?.uid]);

  /* — autoscroll to newest message — */
  const activeList = category === "private" ? privateMessages : communityMessages;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeList.length, activeConvoId, category]);

  /* — auto-grow textarea, capped so the layout never jumps unexpectedly — */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [draft]);

  const openConversation = useCallback((c: PrivateConversation) => {
    setActiveConvoId(c.id);
    setActiveConvo(c);
    setReplyTarget(null);
    resetPrivateUnread(c.otherUser.uid, c.id);
    setMobileChatOpen(true);
  }, []);

  const closeMobileChat = useCallback(() => {
    setMobileChatOpen(false);
    setTimeout(() => {
      setActiveConvoId(null);
      setActiveConvo(null);
    }, 300);
  }, []);

  const handleCategoryChange = useCallback((c: ChatCategory) => {
    setCategory(c);
    setReplyTarget(null);
    if (c === "community") {
      setMobileChatOpen(false);
      markCommunityRead();
    }
  }, []);

  const filteredConversations = useMemo(() => {
    const withLiveUnread = conversations.map((c) => ({
      ...c,
      unreadCount: privateUnread[c.otherUser.uid] ?? c.unreadCount ?? 0,
    }));
    if (!convoSearch.trim()) return withLiveUnread;
    const s = convoSearch.toLowerCase();
    return withLiveUnread.filter((c) => c.otherUser.displayName.toLowerCase().includes(s));
  }, [conversations, privateUnread, convoSearch]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !currentUser || sending) return;
    setSending(true);
    const replyPayload = replyTarget
      ? { id: replyTarget.id, text: replyTarget.text, senderName: replyTarget.senderName }
      : null;

    try {
      if (category === "community") {
        await addDoc(collection(db, "communityMessages"), {
          message: text,
          text,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Student",
          senderPhoto: currentUser.photoURL || null,
          createdAt: serverTimestamp(),
          replyTo: replyPayload,
        });
      } else if (activeConvoId && activeConvo) {
        await addDoc(collection(db, "privateChats", activeConvoId, "messages"), {
          message: text,
          text,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Student",
          senderPhoto: currentUser.photoURL || null,
          createdAt: serverTimestamp(),
          replyTo: replyPayload,
          seenBy: [],
        });
        await setDoc(
          doc(db, "privateChatMeta", activeConvoId),
          {
            participants: activeConvo.participants,
            lastMessage: text,
            lastMessageAt: serverTimestamp(),
            [`unread_${activeConvo.otherUser.uid}`]:
              (activeConvo.unreadCount || 0) + 1,
          },
          { merge: true }
        );
      }
      setDraft("");
      setReplyTarget(null);
    } finally {
      setSending(false);
    }
  }, [draft, currentUser, sending, category, activeConvoId, activeConvo, replyTarget]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* — render helpers — */
  const renderMessages = (list: ChatMessage[]) => {
    let lastDay = "";
    let lastSender = "";
    return list.map((m, i) => {
      const day = formatDayLabel(m.createdAt);
      const showDay = day !== lastDay;
      lastDay = day;
      const showSender = category === "community" && m.senderId !== lastSender;
      lastSender = m.senderId;
      return (
        <React.Fragment key={m.id}>
          {showDay && (
            <div className="ntf-day-divider">
              <span>{day}</span>
            </div>
          )}
          <MessageBubble
            msg={m}
            own={m.senderId === currentUser?.uid}
            showSender={showSender}
            onReply={setReplyTarget}
          />
        </React.Fragment>
      );
    });
  };

  const headerTitle =
    category === "community"
      ? "Community Chat"
      : activeConvo?.otherUser.displayName || "Select a chat";

  const headerSubtitle =
    category === "community"
      ? "Everyone on Next Toppers Feed"
      : activeConvo?.otherUser.online
      ? "Online"
      : "Offline";

  if (authLoading) {
    return (
      <div className="ntf-chat-app" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--ntf-text-muted)", fontSize: 14 }}>Loading chats…</div>
        <ChatStyles />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="ntf-chat-app" data-premium={isPremium ? "true" : "false"}>
      <AmbientBackground />

      <div className="ntf-chat-shell">
        {/* ── LEFT: sidebar (category toggle + conversation list) ── */}
        <aside className={`ntf-sidebar ${mobileChatOpen ? "ntf-sidebar-hidden-mobile" : ""}`}>
          <div className="ntf-sidebar-header">
            <h1 className="ntf-brand">Chats</h1>
          </div>

          <CategoryToggle value={category} onChange={handleCategoryChange} />

          {category === "private" && (
            <>
              <div className="ntf-search">
                <Icon.Search />
                <input
                  placeholder="Search people…"
                  value={convoSearch}
                  onChange={(e) => setConvoSearch(e.target.value)}
                />
              </div>

              <div className="ntf-convo-list">
                {filteredConversations.length === 0 && (
                  <div className="ntf-empty-hint">
                    <Icon.Lock />
                    <p>No private chats yet.<br />Start one from a profile card.</p>
                  </div>
                )}
                {filteredConversations.map((c) => (
                  <ConversationItem
                    key={c.id}
                    convo={c}
                    active={c.id === activeConvoId}
                    onClick={() => openConversation(c)}
                  />
                ))}
              </div>
            </>
          )}

          {category === "community" && (
            <div className="ntf-community-hint">
              <Icon.Users />
              <p>One shared room. Everyone on the platform can see and send messages here.</p>
            </div>
          )}
        </aside>

        {/* ── RIGHT: active chat panel ── */}
        {chatPanelMounted && (
          <section
            className={`ntf-panel ${
              category === "community" || mobileChatOpen ? "ntf-panel-open" : "ntf-panel-closed"
            }`}
          >
            {(category === "community" || activeConvo) ? (
              <>
                <header className="ntf-panel-header">
                  <button className="ntf-icon-btn ntf-back-btn" onClick={closeMobileChat} aria-label="Back">
                    <Icon.Back />
                  </button>
                  <Avatar
                    name={category === "community" ? "Community" : activeConvo!.otherUser.displayName}
                    photo={category === "community" ? null : activeConvo!.otherUser.photoURL}
                    online={category === "private" ? activeConvo!.otherUser.online : undefined}
                    size={40}
                  />
                  <div className="ntf-panel-title">
                    <span className="ntf-panel-name">{headerTitle}</span>
                    <span className="ntf-panel-status">{headerSubtitle}</span>
                  </div>
                  <button className="ntf-icon-btn" aria-label="More options">
                    <Icon.More />
                  </button>
                </header>

                <div className="ntf-messages" ref={scrollRef}>
                  {activeList.length === 0 ? (
                    <div className="ntf-empty-hint ntf-empty-hint-center">
                      <p>No messages yet — say hi 👋</p>
                    </div>
                  ) : (
                    renderMessages(activeList)
                  )}
                  <TypingDotsSlot />
                </div>

                <footer className="ntf-composer">
                  {replyTarget && (
                    <div className="ntf-replying-bar">
                      <div className="ntf-replying-info">
                        <Icon.Reply />
                        <div>
                          <span className="ntf-replying-name">{replyTarget.senderName}</span>
                          <span className="ntf-replying-text">{replyTarget.text}</span>
                        </div>
                      </div>
                      <button
                        className="ntf-icon-btn ntf-replying-close"
                        onClick={() => setReplyTarget(null)}
                        aria-label="Cancel reply"
                      >
                        <Icon.Close />
                      </button>
                    </div>
                  )}
                  <div className="ntf-composer-row">
                    <button className="ntf-icon-btn ntf-add-btn" aria-label="Add attachment">
                      <Icon.Plus />
                    </button>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      placeholder={
                        category === "community" ? "Message everyone…" : `Message ${activeConvo?.otherUser.displayName}…`
                      }
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      className={`ntf-send-btn ${draft.trim() ? "is-ready" : ""}`}
                      onClick={handleSend}
                      disabled={!draft.trim() || sending}
                      aria-label="Send message"
                    >
                      <Icon.Send />
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="ntf-panel-placeholder">
                <div className="ntf-placeholder-icon">
                  <Icon.Lock />
                </div>
                <h3>Your private chats</h3>
                <p>Pick a conversation from the list to start messaging.</p>
              </div>
            )}
          </section>
        )}
      </div>

      <ChatStyles />
    </div>
  );
};

/** Placeholder slot — wire up a `typing/{uid}` doc per chat and swap this
 *  for <TypingDots /> when someone else is actively typing. Kept separate
 *  so the animation doesn't re-run on every message render. */
const TypingDotsSlot: React.FC = () => null;

export default Chat;

/* ════════════════════════════════════════════════════════════════════════
   STYLES
   HyperOS-style motion: soft spring-ish cubic-beziers, blur-in transitions,
   nothing snaps — everything eases in and out symmetrically.
   ════════════════════════════════════════════════════════════════════════ */

const ChatStyles: React.FC = () => (
  <style>{`
  :root {
    --ntf-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --ntf-ease-soft: cubic-bezier(0.4, 0, 0.2, 1);
    --ntf-bg-void: #08050f;
    --ntf-bg-deep: #100a1e;
    --ntf-surface: rgba(255,255,255,0.045);
    --ntf-surface-2: rgba(255,255,255,0.075);
    --ntf-border: rgba(255,255,255,0.09);
    --ntf-border-soft: rgba(255,255,255,0.055);
    --ntf-violet: #8b5cf6;
    --ntf-violet-2: #a78bfa;
    --ntf-pink: #f472b6;
    --ntf-cyan: #22d3ee;
    --ntf-text: #f3eefc;
    --ntf-text-muted: #a89bc4;
    --ntf-text-faint: #6f6489;
    --ntf-radius-lg: 22px;
    --ntf-radius-md: 16px;
    --ntf-radius-sm: 12px;
  }

  .ntf-chat-app {
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    background: radial-gradient(120% 120% at 15% 0%, #180f2b 0%, var(--ntf-bg-deep) 45%, var(--ntf-bg-void) 100%);
    font-family: 'Nunito', system-ui, -apple-system, sans-serif;
    color: var(--ntf-text);
  }

  /* ── ambient background ── */
  .ntf-bg { position: absolute; inset: 0; overflow: hidden; z-index: 0; pointer-events: none; }
  .ntf-orb {
    position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.35;
    will-change: transform;
  }
  .ntf-orb-a {
    width: 480px; height: 480px; top: -180px; left: -120px;
    background: radial-gradient(circle, var(--ntf-violet), transparent 70%);
    animation: ntf-float-a 22s ease-in-out infinite;
  }
  .ntf-orb-b {
    width: 420px; height: 420px; bottom: -160px; right: -100px;
    background: radial-gradient(circle, var(--ntf-pink), transparent 70%);
    animation: ntf-float-b 26s ease-in-out infinite;
  }
  .ntf-orb-c {
    width: 360px; height: 360px; top: 40%; left: 55%;
    background: radial-gradient(circle, var(--ntf-cyan), transparent 72%);
    opacity: 0.18;
    animation: ntf-float-c 30s ease-in-out infinite;
  }
  @keyframes ntf-float-a {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(60px, 50px) scale(1.12); }
  }
  @keyframes ntf-float-b {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-50px, -40px) scale(1.08); }
  }
  @keyframes ntf-float-c {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-45%, -55%) scale(1.15); }
  }
  .ntf-grain { position: absolute; inset: 0; opacity: 0.03; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

  @media (prefers-reduced-motion: reduce) {
    .ntf-orb { animation: none !important; }
  }

  /* ── shell layout ── */
  .ntf-chat-shell {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: 340px 1fr;
    height: 100%; max-width: 1280px; margin: 0 auto;
  }
  @media (max-width: 860px) {
    .ntf-chat-shell { grid-template-columns: 1fr; }
  }

  /* ── sidebar ── */
  .ntf-sidebar {
    display: flex; flex-direction: column; min-height: 0;
    border-right: 1px solid var(--ntf-border-soft);
    padding: 20px 14px;
    transition: transform 0.36s var(--ntf-ease), opacity 0.28s var(--ntf-ease-soft);
  }
  @media (max-width: 860px) {
    .ntf-sidebar { position: absolute; inset: 0; z-index: 3; background: var(--ntf-bg-void); }
    .ntf-sidebar-hidden-mobile { transform: translateX(-6%); opacity: 0; pointer-events: none; }
  }

  .ntf-sidebar-header { padding: 4px 8px 14px; }
  .ntf-brand {
    font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 0;
    background: linear-gradient(120deg, var(--ntf-violet-2), var(--ntf-pink));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  /* ── category toggle ── */
  .ntf-toggle {
    position: relative; display: grid; grid-template-columns: 1fr 1fr;
    background: var(--ntf-surface); border: 1px solid var(--ntf-border);
    border-radius: 999px; padding: 4px; margin: 6px 6px 16px;
  }
  .ntf-toggle-pill {
    position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px);
    border-radius: 999px;
    background: linear-gradient(120deg, var(--ntf-violet), #7c3aed);
    box-shadow: 0 4px 18px rgba(139, 92, 246, 0.45);
    transition: transform 0.42s var(--ntf-ease);
    will-change: transform;
  }
  .ntf-toggle-btn {
    position: relative; z-index: 1; display: flex; align-items: center; justify-content: center;
    gap: 7px; padding: 9px 10px; border: none; background: transparent; cursor: pointer;
    font-family: inherit; font-weight: 700; font-size: 13.5px; color: var(--ntf-text-muted);
    border-radius: 999px; transition: color 0.28s var(--ntf-ease-soft), transform 0.18s var(--ntf-ease-soft);
  }
  .ntf-toggle-btn svg { width: 15px; height: 15px; transition: transform 0.3s var(--ntf-ease); }
  .ntf-toggle-btn.is-active { color: #fff; }
  .ntf-toggle-btn:active { transform: scale(0.96); }
  .ntf-toggle-btn:hover:not(.is-active) { color: var(--ntf-text); }

  /* ── search ── */
  .ntf-search {
    display: flex; align-items: center; gap: 9px;
    background: var(--ntf-surface); border: 1px solid var(--ntf-border-soft);
    border-radius: var(--ntf-radius-md); padding: 10px 13px; margin: 0 4px 10px;
    transition: border-color 0.25s var(--ntf-ease-soft), background 0.25s var(--ntf-ease-soft);
  }
  .ntf-search:focus-within { border-color: rgba(167, 139, 250, 0.55); background: var(--ntf-surface-2); }
  .ntf-search svg { width: 16px; height: 16px; color: var(--ntf-text-faint); flex-shrink: 0; }
  .ntf-search input {
    background: transparent; border: none; outline: none; color: var(--ntf-text);
    font-family: inherit; font-size: 14px; width: 100%;
  }
  .ntf-search input::placeholder { color: var(--ntf-text-faint); }

  /* ── conversation list ── */
  .ntf-convo-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; padding: 2px; }
  .ntf-convo-list::-webkit-scrollbar { width: 5px; }
  .ntf-convo-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 8px; }

  .ntf-convo-item {
    display: flex; align-items: center; gap: 12px; padding: 10px; border: none;
    background: transparent; border-radius: var(--ntf-radius-md); cursor: pointer;
    text-align: left; font-family: inherit; width: 100%;
    transition: background 0.25s var(--ntf-ease-soft), transform 0.15s var(--ntf-ease-soft);
  }
  .ntf-convo-item:hover { background: var(--ntf-surface); }
  .ntf-convo-item:active { transform: scale(0.985); }
  .ntf-convo-item.is-active { background: var(--ntf-surface-2); box-shadow: inset 0 0 0 1px var(--ntf-border); }

  .ntf-convo-meta { flex: 1; min-width: 0; }
  .ntf-convo-top { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
  .ntf-convo-name { font-weight: 700; font-size: 14.5px; color: var(--ntf-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ntf-convo-time { font-size: 11px; color: var(--ntf-text-faint); flex-shrink: 0; }
  .ntf-convo-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 2px; }
  .ntf-convo-preview { font-size: 12.5px; color: var(--ntf-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ntf-unread-badge {
    background: linear-gradient(120deg, var(--ntf-pink), var(--ntf-violet));
    color: #fff; font-size: 10.5px; font-weight: 800; min-width: 18px; height: 18px;
    border-radius: 999px; display: flex; align-items: center; justify-content: center; padding: 0 5px;
    flex-shrink: 0;
  }

  .ntf-empty-hint, .ntf-community-hint {
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
    color: var(--ntf-text-faint); padding: 28px 18px; font-size: 13px; line-height: 1.5;
  }
  .ntf-empty-hint svg, .ntf-community-hint svg { width: 26px; height: 26px; opacity: 0.5; }
  .ntf-empty-hint-center { flex: 1; justify-content: center; }

  /* ── avatar ── */
  .ntf-avatar-wrap { position: relative; border-radius: 50%; flex-shrink: 0; }
  .ntf-avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
  .ntf-avatar-fallback {
    width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, var(--ntf-violet), #6d28d9); color: #fff; font-weight: 800;
  }
  .ntf-online-dot {
    position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%;
    background: #34d399; border: 2px solid var(--ntf-bg-void);
  }

  /* ── chat panel ── */
  .ntf-panel {
    display: flex; flex-direction: column; min-height: 0; min-width: 0;
    opacity: 0; transform: scale(0.985) translateY(8px);
    filter: blur(6px);
    transition: opacity 0.32s var(--ntf-ease), transform 0.36s var(--ntf-ease), filter 0.32s var(--ntf-ease);
  }
  .ntf-panel-open { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
  .ntf-panel-closed { opacity: 0; transform: scale(0.985) translateY(8px); filter: blur(6px); pointer-events: none; }
  @media (max-width: 860px) {
    .ntf-panel { position: absolute; inset: 0; z-index: 4; background: var(--ntf-bg-deep); }
  }

  .ntf-panel-placeholder {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; color: var(--ntf-text-faint); padding: 30px; text-align: center;
  }
  .ntf-placeholder-icon {
    width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--ntf-surface); border: 1px solid var(--ntf-border); margin-bottom: 6px;
  }
  .ntf-placeholder-icon svg { width: 24px; height: 24px; }
  .ntf-panel-placeholder h3 { margin: 0; color: var(--ntf-text-muted); font-size: 16px; }
  .ntf-panel-placeholder p { margin: 0; font-size: 13px; max-width: 220px; }

  /* ── panel header ── */
  .ntf-panel-header {
    display: flex; align-items: center; gap: 12px; padding: 14px 18px;
    border-bottom: 1px solid var(--ntf-border-soft);
    background: rgba(255,255,255,0.02); backdrop-filter: blur(18px);
  }
  .ntf-back-btn { display: none; }
  @media (max-width: 860px) {
    .ntf-back-btn { display: inline-flex; }
  }
  .ntf-panel-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .ntf-panel-name { font-weight: 800; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ntf-panel-status { font-size: 11.5px; color: var(--ntf-text-faint); }

  .ntf-icon-btn {
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 50%; border: 1px solid transparent;
    background: transparent; color: var(--ntf-text-muted); cursor: pointer;
    transition: background 0.22s var(--ntf-ease-soft), transform 0.16s var(--ntf-ease-soft), color 0.22s var(--ntf-ease-soft);
  }
  .ntf-icon-btn svg { width: 18px; height: 18px; }
  .ntf-icon-btn:hover { background: var(--ntf-surface); color: var(--ntf-text); }
  .ntf-icon-btn:active { transform: scale(0.88); }

  /* ── messages ── */
  .ntf-messages {
    flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 3px;
    scroll-behavior: smooth;
  }
  .ntf-messages::-webkit-scrollbar { width: 6px; }
  .ntf-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 8px; }

  .ntf-day-divider { display: flex; justify-content: center; margin: 16px 0 10px; }
  .ntf-day-divider span {
    font-size: 11px; font-weight: 700; color: var(--ntf-text-faint);
    background: var(--ntf-surface); border: 1px solid var(--ntf-border-soft);
    padding: 4px 12px; border-radius: 999px;
  }

  .ntf-msg-row {
    display: flex; align-items: flex-end; gap: 8px; margin: 3px 0;
    animation: ntf-msg-in 0.34s var(--ntf-ease) both;
  }
  @keyframes ntf-msg-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .ntf-msg-row.is-own { justify-content: flex-end; }
  .ntf-msg-row.is-other { justify-content: flex-start; }
  .ntf-msg-avatar { flex-shrink: 0; }

  .ntf-bubble-col { display: flex; flex-direction: column; max-width: 68%; position: relative; }
  .ntf-bubble-indent { margin-left: 38px; }
  .ntf-msg-sender { font-size: 11.5px; font-weight: 800; color: var(--ntf-violet-2); margin: 0 0 3px 4px; }

  .ntf-bubble {
    position: relative; padding: 9px 13px 7px; border-radius: var(--ntf-radius-md);
    font-size: 14px; line-height: 1.42; word-break: break-word;
    display: flex; flex-direction: column;
    transition: transform 0.18s var(--ntf-ease-soft);
  }
  .ntf-bubble-own {
    background: linear-gradient(135deg, var(--ntf-violet), #6d28d9);
    color: #fff; border-bottom-right-radius: 6px;
    box-shadow: 0 6px 18px rgba(124, 58, 237, 0.28);
  }
  .ntf-bubble-other {
    background: var(--ntf-surface-2); color: var(--ntf-text);
    border: 1px solid var(--ntf-border-soft); border-bottom-left-radius: 6px;
  }

  .ntf-reply-preview {
    display: flex; flex-direction: column; gap: 1px; padding: 6px 9px; margin-bottom: 6px;
    border-left: 2.5px solid rgba(255,255,255,0.5); border-radius: 8px; background: rgba(0,0,0,0.14);
  }
  .ntf-reply-name { font-size: 11px; font-weight: 800; opacity: 0.9; }
  .ntf-reply-text { font-size: 11.5px; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .ntf-bubble-text { white-space: pre-wrap; }
  .ntf-bubble-time {
    align-self: flex-end; display: flex; align-items: center; gap: 3px;
    font-size: 10px; opacity: 0.65; margin-top: 3px;
  }
  .ntf-bubble-tick svg { width: 13px; height: 13px; }

  .ntf-reply-trigger {
    position: absolute; top: 50%; transform: translateY(-50%) scale(0.7);
    width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--ntf-border);
    background: var(--ntf-surface-2); color: var(--ntf-text-muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none;
    transition: opacity 0.2s var(--ntf-ease-soft), transform 0.2s var(--ntf-ease);
    right: -34px;
  }
  .ntf-reply-trigger-own { right: auto; left: -34px; }
  .ntf-reply-trigger.is-visible { opacity: 1; pointer-events: auto; transform: translateY(-50%) scale(1); }
  .ntf-reply-trigger svg { width: 13px; height: 13px; }
  .ntf-reply-trigger:hover { background: var(--ntf-violet); color: #fff; }

  .ntf-typing { display: flex; gap: 4px; padding: 8px 12px; }
  .ntf-typing span {
    width: 6px; height: 6px; border-radius: 50%; background: var(--ntf-text-faint);
    animation: ntf-bounce 1.1s ease-in-out infinite;
  }
  .ntf-typing span:nth-child(2) { animation-delay: 0.15s; }
  .ntf-typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes ntf-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-5px); opacity: 1; } }

  /* ── composer ── */
  .ntf-composer {
    border-top: 1px solid var(--ntf-border-soft); background: rgba(255,255,255,0.02);
    backdrop-filter: blur(18px); padding: 12px 16px 14px;
  }

  .ntf-replying-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    background: var(--ntf-surface); border: 1px solid var(--ntf-border-soft);
    border-radius: var(--ntf-radius-sm); padding: 8px 10px; margin-bottom: 8px;
    animation: ntf-slide-up 0.26s var(--ntf-ease) both;
  }
  @keyframes ntf-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .ntf-replying-info { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--ntf-violet-2); }
  .ntf-replying-info svg { width: 15px; height: 15px; flex-shrink: 0; }
  .ntf-replying-info div { display: flex; flex-direction: column; min-width: 0; }
  .ntf-replying-name { font-size: 11.5px; font-weight: 800; }
  .ntf-replying-text { font-size: 12px; color: var(--ntf-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
  .ntf-replying-close { width: 26px; height: 26px; }
  .ntf-replying-close svg { width: 13px; height: 13px; }

  .ntf-composer-row {
    display: flex; align-items: flex-end; gap: 8px;
    background: var(--ntf-surface); border: 1px solid var(--ntf-border);
    border-radius: var(--ntf-radius-lg); padding: 6px 6px 6px 10px;
    transition: border-color 0.25s var(--ntf-ease-soft), box-shadow 0.25s var(--ntf-ease-soft);
  }
  .ntf-composer-row:focus-within {
    border-color: rgba(167, 139, 250, 0.6);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.14);
  }
  .ntf-add-btn { width: 32px; height: 32px; margin-bottom: 2px; }
  .ntf-add-btn svg { width: 16px; height: 16px; }

  .ntf-composer-row textarea {
    flex: 1; resize: none; background: transparent; border: none; outline: none;
    color: var(--ntf-text); font-family: inherit; font-size: 14px; line-height: 1.4;
    padding: 8px 4px; max-height: 140px;
  }
  .ntf-composer-row textarea::placeholder { color: var(--ntf-text-faint); }

  .ntf-send-btn {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer;
    background: var(--ntf-surface-2); color: var(--ntf-text-faint);
    transition: background 0.28s var(--ntf-ease), color 0.28s var(--ntf-ease),
                transform 0.22s var(--ntf-ease), box-shadow 0.28s var(--ntf-ease);
  }
  .ntf-send-btn svg { width: 16px; height: 16px; transform: translateX(-1px); }
  .ntf-send-btn.is-ready {
    background: linear-gradient(135deg, var(--ntf-violet), var(--ntf-pink));
    color: #fff; box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4);
  }
  .ntf-send-btn.is-ready:hover { transform: scale(1.06); }
  .ntf-send-btn:active:not(:disabled) { transform: scale(0.9); }
  .ntf-send-btn:disabled { cursor: not-allowed; }

  /* focus visibility for keyboard users */
  button:focus-visible, input:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--ntf-violet-2); outline-offset: 2px;
  }
  `}</style>
);
