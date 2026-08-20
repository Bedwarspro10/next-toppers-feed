import { useEffect, useState, useRef, useCallback, useMemo, forwardRef } from "react";
import {
  collection, query, orderBy, limit, onSnapshot, where,
  addDoc, serverTimestamp, getDocs, deleteDoc, doc, updateDoc,
  setDoc, increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useUnread, markRead } from "@/contexts/UnreadContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { NextToppersLoader } from "@/components/NextToppersLoader";
import {
  Send, MessageSquare, ArrowLeft,
  Trash2, Search, Globe, Reply, Copy,
  X, LogIn, AlertCircle,
  Crown, ShieldCheck, Sparkles, Receipt,
  QrCode, ZoomIn, ZoomOut, CheckCircle2, XCircle, Eye,
  Users, Smile, ChevronDown, MoreHorizontal,
  Lock, Phone, Video, Info, Hash, AtSign,
} from "lucide-react";

/* ─── constants ───────────────────────────────────────────── */
const GROUP_LOGO_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQT4J9OOL_O06CxXyKwkQ2oUYhMEoezos2Xaw&s";

const QR_CODES = {
  day:   { url: "https://res.cloudinary.com/dju83xyco/image/upload/v1779119824/IMG_20260518_212520_fec8tx.png", label: "₹3 – 1 Day Plan",   price: 3  },
  month: { url: "https://res.cloudinary.com/dju83xyco/image/upload/v1779119824/IMG_20260518_212534_ggiuim.png", label: "₹39 – 1 Month Plan", price: 39 },
} as const;

const QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🙏"];

/* ─── big emoji categories ────────────────────────────────── */
const EMOJI_CATS: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Recent", icon: "🕐",
    emojis: ["😀","😂","❤️","👍","🙏","🔥","😍","🥹","😭","🤩"],
  },
  {
    label: "Smileys", icon: "😀",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  },
  {
    label: "People", icon: "👋",
    emojis: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👀","👁️","👅","👄","🫦","💋"],
  },
  {
    label: "Nature", icon: "🌿",
    emojis: ["🌸","🌺","🌻","🌼","🌷","🌱","🌿","🍀","🍁","🍂","🍃","🌾","🍄","🌰","🦔","🐾","🌵","🎄","🌲","🌳","🌴","🪵","🪨","🌊","🌬️","🌀","🌈","🌂","☂️","⛱️","⚡","❄️","☃️","⛄","🔥","💧","🌊"],
  },
  {
    label: "Food", icon: "🍕",
    emojis: ["🍕","🍔","🌮","🍜","🍝","🍛","🍣","🍱","🍦","🎂","🍰","🧁","🍩","🍪","🍫","🍬","🍭","🧃","🥤","☕","🍵","🧋","🍺","🎉","🍾"],
  },
  {
    label: "Objects", icon: "📚",
    emojis: ["📚","📖","📝","✏️","📌","📎","🔖","🏆","🥇","🎯","🎓","📱","💻","⌨️","🖥️","🖨️","📷","📸","🎵","🎶","🎸","🎹","🎺","🎻","🥁","🎮","🕹️","🎲","🧩","🪀","🎯","⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🎳","🏒","🏑","🥍","🏸","🥊","🥋","🎽","🛹","🛷","🛼"],
  },
  {
    label: "Symbols", icon: "💯",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🪯","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🔕","🎵","🎶","💤","🔇","🔈","🔉","🔊","📢","📣","🔔","🔕","🎼","🎵","🎶","⚠️","🚸","⚡","🌟","💫","✨","🔥","💥"],
  },
];

/* ─── types ───────────────────────────────────────────────── */
interface ReplyRef { id: string; message: string; senderName: string; }

interface ProofData {
  requestId: string; uid: string; plan: "day" | "month"; price: number;
  transactionId: string; note?: string; status: "pending" | "approved" | "rejected";
}

interface ChatMessage {
  id: string; senderId: string; senderName: string; senderPhoto?: string | null;
  senderRole?: string; senderIsPremium?: boolean; message: string;
  type?: "text" | "image" | "payment_proof"; imageUrl?: string; imageCaption?: string;
  isPaymentQr?: boolean; qrPlan?: "day" | "month"; proofData?: ProofData;
  createdAt: { seconds: number } | null; deleted?: boolean; deletedByName?: string;
  replyTo?: ReplyRef; reactions?: Record<string, string[]>; pinned?: boolean;
}

interface UserDoc {
  uid: string; name: string; photoURL?: string | null; role?: string;
  email?: string | null; isOnline?: boolean;
}

interface PremiumRequest {
  id: string; uid: string; plan: "day" | "month"; price: number;
  transactionId: string; status: "pending" | "approved" | "rejected";
}

interface RecentChatEntry {
  chatId: string; otherUid: string; otherName: string; otherPhoto: string | null;
  otherRole: string; lastMessage: string; lastMessageAt: { seconds: number } | null;
  unreadCount: number;
}

interface DmItem {
  user: UserDoc; lastMessage: string; lastMessageAt: { seconds: number } | null;
  unreadCount: number;
}

/* ─── helpers ─────────────────────────────────────────────── */
function timeLabel(ts: { seconds: number } | null | undefined): string {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function dateSeparatorLabel(ts: { seconds: number } | null | undefined): string {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return d.toLocaleDateString("en-IN", { weekday: "long" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function sameDay(a: { seconds: number } | null, b: { seconds: number } | null): boolean {
  if (!a || !b) return false;
  const da = new Date(a.seconds * 1000);
  const db2 = new Date(b.seconds * 1000);
  return da.toDateString() === db2.toDateString();
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "linear-gradient(135deg,#6366f1,#8b5cf6)",
  "linear-gradient(135deg,#3b82f6,#06b6d4)",
  "linear-gradient(135deg,#10b981,#34d399)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#14b8a6,#6366f1)",
];
function avatarColor(uid: string): string {
  let h = 0; for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ─── Avatar ──────────────────────────────────────────────── */
function Avatar({ name, photo, uid = "", size = 8, onClick, isOnline, className = "" }: {
  name: string; photo?: string | null; uid?: string; size?: number;
  onClick?: () => void; isOnline?: boolean; className?: string;
}) {
  const px = size * 4;
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: px, height: px }}>
      {photo
        ? <img src={photo} alt={name} referrerPolicy="no-referrer"
            className={`rounded-full object-cover w-full h-full ${onClick ? "cursor-pointer" : ""}`}
            onClick={onClick} />
        : <div className={`rounded-full flex items-center justify-center font-black text-white w-full h-full select-none ${onClick ? "cursor-pointer" : ""}`}
            style={{ background: avatarColor(uid || name), fontSize: px * 0.38 }}
            onClick={onClick}>
            {initials(name)}
          </div>
      }
      {isOnline && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
          style={{ borderColor: "hsl(var(--card))" }} />
      )}
    </div>
  );
}

/* ─── Role & Premium badges ───────────────────────────────── */
function RoleBadge({ role }: { role?: string }) {
  if (!role || role === "student") return null;
  return role === "owner"
    ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase"
        style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
        <Crown size={7} />OWNER
      </span>
    : <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase"
        style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
        <ShieldCheck size={7} />ADMIN
      </span>;
}

function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase"
      style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}>
      <Sparkles size={7} />PRO
    </span>
  );
}

/* ─── Premium Emoji Picker ─────────────────────────────────── */
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState(0);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", fn, true);
    return () => document.removeEventListener("mousedown", fn, true);
  }, [onClose]);

  const current = EMOJI_CATS[cat];

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      style={{
        width: 300, maxHeight: 320,
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
      }}>
      {/* Category tabs */}
      <div className="flex items-center border-b overflow-x-auto scrollbar-none"
        style={{ borderColor: "hsl(var(--border))" }}>
        {EMOJI_CATS.map((c, i) => (
          <button key={c.label} onClick={() => setCat(i)} title={c.label}
            className={`flex-shrink-0 w-10 h-10 text-lg flex items-center justify-center transition-colors ${
              i === cat ? "border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            {c.icon}
          </button>
        ))}
      </div>
      {/* Label */}
      <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {current.label}
      </div>
      {/* Emoji grid */}
      <div className="p-2 grid grid-cols-10 gap-0.5 overflow-y-auto" style={{ maxHeight: 220 }}>
        {current.emojis.map((e, i) => (
          <button key={`${e}-${i}`} onClick={() => onSelect(e)}
            className="w-7 h-7 text-lg flex items-center justify-center rounded-lg hover:bg-secondary transition-colors leading-none active:scale-90"
            type="button">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Fullscreen image viewer ─────────────────────────────── */
function ImageFullscreenViewer({ url, caption, onClose }: { url: string; caption?: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-black/70 flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
          <ArrowLeft size={16} />
        </button>
        <span className="text-white/70 text-sm flex-1 truncate">{caption ?? "Image"}</span>
        <button onClick={() => setScale(s => Math.max(0.5, s - 0.5))} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
          <ZoomOut size={15} />
        </button>
        <span className="text-white/60 text-xs min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.min(8, s + 0.5))} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
          <ZoomIn size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-6">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <NextToppersLoader size={40} />
          </div>
        )}
        <img src={url} alt={caption} onLoad={() => setLoaded(true)} draggable={false}
          style={{ transform: `scale(${scale})`, transformOrigin: "center", transition: "transform 0.15s ease" }}
          className={`max-w-full max-h-full object-contain select-none ${loaded ? "opacity-100" : "opacity-0"}`} />
      </div>
    </div>
  );
}

/* ─── Send QR Confirmation ────────────────────────────────── */
function SendQRConfirmPopup({ defaultPlan, onConfirm, onClose }: {
  defaultPlan?: "day" | "month"; onConfirm: (plan: "day" | "month") => Promise<void>; onClose: () => void;
}) {
  const [plan, setPlan] = useState<"day" | "month">(defaultPlan ?? "month");
  const [sending, setSending] = useState(false);
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] max-w-sm mx-auto">
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <QrCode size={15} className="text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Send Payment QR</h3>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
              <X size={13} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["day", "month"] as const).map((p) => (
                <button key={p} onClick={() => setPlan(p)}
                  className={`px-3 py-3 rounded-xl text-xs font-semibold border transition-all text-left ${plan === p ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground"}`}>
                  <div className="font-bold">{QR_CODES[p].label}</div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
              <img src={QR_CODES[plan].url} alt="QR" className="w-28 h-28 object-contain mx-auto rounded-lg bg-white p-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9 text-xs" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 h-9 gap-1.5 text-xs"
                onClick={async () => { setSending(true); try { await onConfirm(plan); onClose(); } finally { setSending(false); } }}
                disabled={sending}>
                <QrCode size={12} />{sending ? "Sending…" : "Send QR"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Payment Proof Card ──────────────────────────────────── */
function PaymentProofCard({ msg, isAdmin, myUid, onApprove, onReject }: {
  msg: ChatMessage; isAdmin: boolean; myUid: string; chatId: string;
  onApprove: (msg: ChatMessage) => Promise<void>; onReject: (msg: ChatMessage) => Promise<void>;
}) {
  const { proofData } = msg;
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  if (!proofData) return null;
  const isMine = msg.senderId === myUid;
  const planLabel = proofData.plan === "day" ? "₹3 / 1 Day" : "₹39 / 1 Month";
  const submitted = msg.createdAt
    ? new Date(msg.createdAt.seconds * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const statusStyle = proofData.status === "approved"
    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
    : proofData.status === "rejected"
    ? "bg-red-500/10 border-red-500/20 text-red-600"
    : "bg-amber-500/10 border-amber-500/20 text-amber-600";
  const statusLabel = proofData.status === "approved" ? "Approved" : proofData.status === "rejected" ? "Rejected" : "Pending";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-3 px-1`}>
      <div className="w-full max-w-[88%]">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2">
            <Receipt size={13} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs font-bold text-foreground">Payment Proof</p>
            <div className="flex-1" />
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle}`}>{statusLabel}</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {[
              { label: "User", value: msg.senderName, mono: false },
              { label: "Plan", value: planLabel, mono: false },
              { label: "Txn ID", value: proofData.transactionId, mono: true },
              ...(proofData.note ? [{ label: "Note", value: proofData.note, mono: false }] : []),
              ...(submitted ? [{ label: "Submitted", value: submitted, mono: false }] : []),
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{label}</span>
                <span className={`text-[11px] font-semibold text-foreground text-right break-all ${mono ? "font-mono" : ""}`}>{value}</span>
              </div>
            ))}
          </div>
          {isAdmin && proofData.status === "pending" && (
            <div className="px-4 pb-4 flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={async () => { setActing("approve"); try { await onApprove(msg); } finally { setActing(null); } }}
                disabled={acting !== null}>
                <CheckCircle2 size={12} />{acting === "approve" ? "Approving…" : "Approve"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/10"
                onClick={async () => { setActing("reject"); try { await onReject(msg); } finally { setActing(null); } }}
                disabled={acting !== null}>
                <XCircle size={12} />{acting === "reject" ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          )}
          {proofData.status === "approved" && (
            <div className="px-4 pb-3 flex items-center gap-1.5 text-emerald-600 text-xs">
              <CheckCircle2 size={12} /> Approved — premium activates within 1 hour.
            </div>
          )}
          {proofData.status === "rejected" && (
            <div className="px-4 pb-3 flex items-center gap-1.5 text-red-600 text-xs">
              <XCircle size={12} /> Payment verification failed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Payment Proof Form ──────────────────────────────────── */
type ProofStep = "checking" | "already_pending" | "form" | "confirm" | "submitting" | "success";
const PROOF_PLANS = [
  { id: "day" as const, price: 3, label: "₹3 / 1 Day" },
  { id: "month" as const, price: 39, label: "₹39 / 1 Month" },
];

function PaymentProofForm({ myUid, myName, myPhoto, myRole, adminUid, defaultPlan, onClose }: {
  myUid: string; myName: string; myPhoto?: string | null; myRole?: string;
  adminUid: string; defaultPlan?: "day" | "month"; onClose: () => void;
}) {
  const [plan, setPlan] = useState<"day" | "month">(defaultPlan ?? "month");
  const [txnId, setTxnId] = useState(""); const [note, setNote] = useState("");
  const [step, setStep] = useState<ProofStep>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myUid) { setStep("form"); return; }
    getDocs(query(collection(db, "premiumRequests"), where("uid", "==", myUid), where("status", "==", "pending"), where("proofSubmitted", "==", true), limit(1)))
      .then(snap => setStep(snap.empty ? "form" : "already_pending"))
      .catch(() => { setStep("form"); });
  }, [myUid]);

  const submit = async () => {
    if (!txnId.trim()) return;
    setStep("submitting"); setError(null);
    try {
      const chosen = PROOF_PLANS.find(p => p.id === plan)!;
      const chatId = [myUid, adminUid].sort().join("_");
      let requestId = "";
      let updatedExisting = false;
      try {
        const snap = await getDocs(query(collection(db, "premiumRequests"), where("uid", "==", myUid), where("status", "==", "pending"), where("qrSent", "==", true), limit(1)));
        if (!snap.empty) {
          requestId = snap.docs[0].id;
          await updateDoc(doc(db, "premiumRequests", requestId), { transactionId: txnId.trim(), note: note.trim(), plan: chosen.id, price: chosen.price, proofSubmitted: true, updatedAt: serverTimestamp() });
          updatedExisting = true;
        }
      } catch { /* fall through */ }
      if (!updatedExisting) {
        try {
          const r = await addDoc(collection(db, "premiumRequests"), { uid: myUid, userName: myName, userPhoto: myPhoto ?? null, adminUid, plan, price: chosen.price, transactionId: txnId.trim(), note: note.trim(), chatId, status: "pending", qrSent: false, proofSubmitted: true, createdAt: serverTimestamp() });
          requestId = r.id;
        } catch {
          try {
            const r = await addDoc(collection(db, "contactMessages"), { type: "payment_proof", uid: myUid, userName: myName, userPhoto: myPhoto ?? null, adminUid, plan, price: chosen.price, transactionId: txnId.trim(), note: note.trim(), chatId, status: "pending", createdAt: serverTimestamp() });
            requestId = `contact_${r.id}`;
          } catch (e: unknown) { const err = e as {message?: string}; throw new Error(err?.message ?? "Unknown"); }
        }
      }
      try {
        await addDoc(collection(db, "privateChats", chatId, "messages"), { senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "student", message: "Payment proof submitted", type: "payment_proof", proofData: { requestId, uid: myUid, plan, price: chosen.price, transactionId: txnId.trim(), note: note.trim(), status: "pending" }, createdAt: serverTimestamp() });
      } catch { /* non-fatal */ }
      try {
        await setDoc(doc(db, "privateChatMeta", chatId), { participants: [myUid, adminUid], lastMessage: "Payment proof submitted", lastMessageAt: serverTimestamp(), lastSenderId: myUid, [`unread_${adminUid}`]: increment(1) }, { merge: true });
      } catch { /* non-fatal */ }
      setStep("success");
    } catch (e: unknown) { setError((e as {message?: string})?.message ?? "Failed"); setStep("form"); }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[71] max-w-sm mx-auto">
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                <Crown size={15} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-foreground text-sm">Submit Payment Proof</h3>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground"><X size={13} /></button>
          </div>
          <div className="px-5 py-5 space-y-4">
            {step === "checking" && (
              <div className="flex items-center justify-center py-6"><NextToppersLoader size={32} /></div>
            )}
            {step === "already_pending" && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3"><Crown size={22} className="text-amber-500" /></div>
                <p className="font-bold text-foreground mb-1">Proof Already Submitted</p>
                <p className="text-xs text-muted-foreground mb-4">Admin will review and activate premium within 1 hour.</p>
                <Button onClick={onClose} className="w-full h-9 text-xs">Got it</Button>
              </div>
            )}
            {(step === "form" || step === "submitting") && (
              <>
                {error && <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-600"><AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{error}</div>}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">Select Plan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROOF_PLANS.map(p => (
                      <button key={p.id} onClick={() => setPlan(p.id)}
                        className={`px-3 py-3 rounded-xl border text-xs font-semibold text-left transition-all ${plan === p.id ? "bg-amber-500/15 border-amber-500/40 text-amber-600" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        <div className="font-bold">{p.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Transaction / UPI Ref. ID *</label>
                  <input value={txnId} onChange={e => setTxnId(e.target.value)}
                    placeholder="Enter your UPI transaction ID"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm outline-none focus:border-primary/40 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Note (optional)</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="Any additional info for the admin"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/50 text-sm outline-none focus:border-primary/40 resize-none" />
                </div>
                <Button onClick={submit} disabled={!txnId.trim() || step === "submitting"} className="w-full h-10 gap-2">
                  {step === "submitting" ? <><NextToppersLoader size={16} />Submitting…</> : <><Crown size={14} />Submit Proof</>}
                </Button>
              </>
            )}
            {step === "success" && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={28} className="text-emerald-500" /></div>
                <p className="font-bold text-foreground mb-1">Proof Submitted!</p>
                <p className="text-xs text-muted-foreground mb-4">Admin will verify and activate premium within 1 hour.</p>
                <Button onClick={onClose} className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Done</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Date separator ──────────────────────────────────────── */
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
      <span className="text-[11px] font-semibold text-muted-foreground/70 px-2 py-0.5 rounded-full bg-secondary select-none whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
    </div>
  );
}

/* ─── System message ──────────────────────────────────────── */
function SystemBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-center my-2 px-4">
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-muted-foreground max-w-[85%] text-center"
        style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.12)" }}>
        <Sparkles size={10} className="text-indigo-400 flex-shrink-0" />
        <span className="leading-relaxed">{text}</span>
      </div>
    </div>
  );
}

/* ─── Message Bubble ──────────────────────────────────────── */
interface BubbleProps {
  msg: ChatMessage;
  isMine: boolean;
  isGrouped: boolean; /* true = hide avatar, tight spacing */
  isLast: boolean; /* last in group = show tail */
  canDelete: boolean;
  currentUid?: string;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onAvatarClick?: () => void;
  onImageClick?: (url: string, cap?: string) => void;
  onSubmitPayment?: () => void;
}

function MessageBubble({
  msg, isMine, isGrouped, isLast, canDelete, currentUid,
  onReply, onCopy, onDelete, onReact, onAvatarClick,
  onImageClick, onSubmitPayment,
}: BubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = useCallback(() => {
    timerRef.current = setTimeout(() => setShowActions(true), 500);
  }, []);
  const cancelPress = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  if (msg.deleted) {
    return (
      <div className={`flex ${isMine ? "flex-row-reverse" : "flex-row"} gap-2 ${isGrouped ? "mb-0.5" : "mb-3"} px-4`}>
        {!isMine && <div className="w-8 flex-shrink-0" />}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed text-xs italic text-muted-foreground/50 select-none"
          style={{ borderColor: "hsl(var(--border))" }}>
          <AlertCircle size={10} /> Deleted by {msg.deletedByName ?? "unknown"}
        </div>
      </div>
    );
  }

  const reactionEntries = msg.reactions
    ? Object.entries(msg.reactions).filter(([, uids]) => uids.length > 0)
    : [];

  const bubbleRadius = isMine
    ? isLast ? "18px 18px 4px 18px" : "18px 18px 18px 18px"
    : isLast ? "18px 18px 18px 4px" : "18px 18px 18px 18px";

  if (msg.type === "image" && msg.imageUrl) {
    return (
      <div className={`flex ${isMine ? "flex-row-reverse" : "flex-row"} gap-2 items-end ${isGrouped ? "mb-0.5" : "mb-3"} px-4 animate-slide-up`}>
        {!isMine && (
          isGrouped
            ? <div className="w-8 flex-shrink-0" />
            : <Avatar name={msg.senderName} photo={msg.senderPhoto} uid={msg.senderId} size={8} onClick={onAvatarClick} />
        )}
        <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%] min-w-0`}>
          {!isMine && !isGrouped && (
            <div className="flex items-center gap-1.5 mb-1 ml-1 flex-wrap">
              <span className="text-[11px] font-bold" style={{ color: avatarColor(msg.senderId) }}>{msg.senderName}</span>
              <RoleBadge role={msg.senderRole} />
              {msg.senderIsPremium && <PremiumBadge />}
            </div>
          )}
          <button className="rounded-2xl overflow-hidden border shadow-sm active:opacity-90"
            style={{ borderColor: "hsl(var(--border))", borderRadius: bubbleRadius }}
            onClick={() => onImageClick?.(msg.imageUrl!, msg.imageCaption)}
            onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress}
            onContextMenu={e => { e.preventDefault(); setShowActions(true); }}>
            <img src={msg.imageUrl} alt="Image" className="w-52 h-52 object-contain bg-white p-2" loading="lazy" />
            {msg.imageCaption && (
              <div className="px-3 py-1.5 text-xs border-t" style={{ borderColor: "hsl(var(--border))" }}>
                {msg.imageCaption}
              </div>
            )}
          </button>
          {msg.isPaymentQr && onSubmitPayment && (
            <button onClick={onSubmitPayment}
              className="flex items-center gap-1 mt-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-amber-600"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Crown size={10} /> Submit Payment Proof
            </button>
          )}
          <time className="text-[10px] text-muted-foreground/50 mt-1 px-1">{timeLabel(msg.createdAt)}</time>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? "flex-row-reverse" : "flex-row"} gap-2 items-end ${isGrouped ? "mb-0.5" : "mb-3"} px-4 group animate-slide-up`}
      onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress}
      onContextMenu={e => { e.preventDefault(); setShowActions(true); }}>
      {/* Avatar */}
      {!isMine && (
        isGrouped
          ? <div className="w-8 flex-shrink-0" />
          : <Avatar name={msg.senderName} photo={msg.senderPhoto} uid={msg.senderId} size={8} onClick={onAvatarClick} />
      )}

      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%] min-w-0`}>
        {!isMine && !isGrouped && (
          <div className="flex items-center gap-1.5 mb-1 ml-1 flex-wrap">
            <span className="text-[11px] font-bold" style={{ color: avatarColor(msg.senderId) }}>{msg.senderName}</span>
            <RoleBadge role={msg.senderRole} />
            {msg.senderIsPremium && <PremiumBadge />}
          </div>
        )}

        {/* Reply preview */}
        {msg.replyTo && (
          <div className={`px-2.5 py-1.5 mb-1 rounded-xl text-xs max-w-full min-w-0 overflow-hidden ${isMine ? "border-r-[3px]" : "border-l-[3px]"}`}
            style={{
              borderColor: "rgba(99,102,241,0.6)",
              background: isMine ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)",
            }}>
            <p className="font-bold text-[10px] truncate" style={{ color: "#818cf8" }}>{msg.replyTo.senderName}</p>
            <p className="truncate text-muted-foreground text-[11px]">{msg.replyTo.message}</p>
          </div>
        )}

        {/* Main bubble */}
        <div className="relative">
          <div
            className={`relative px-3.5 py-2.5 text-sm leading-relaxed break-words chat-bubble-text select-text max-w-full`}
            style={{
              borderRadius: bubbleRadius,
              ...(isMine ? {
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                color: "#fff",
                boxShadow: "0 2px 12px rgba(99,102,241,0.35)",
              } : {
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }),
            }}>
            {msg.message}
          </div>

          {/* Desktop hover actions */}
          <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? "right-full mr-1" : "left-full ml-1"} hidden group-hover:flex items-center gap-0.5 z-10`}>
            {QUICK_REACTIONS.slice(0, 3).map(e => (
              <button key={e} onClick={() => onReact(e)}
                className="w-7 h-7 rounded-full text-base flex items-center justify-center hover:scale-110 transition-transform active:scale-90 shadow-sm"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                {e}
              </button>
            ))}
            <button onClick={() => onReply()}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-colors"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <Reply size={13} />
            </button>
            <button onClick={() => setShowActions(true)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-colors"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>

        {/* Reaction pills */}
        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 px-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
            {reactionEntries.map(([emoji, uids]) => {
              const myReaction = currentUid && uids.includes(currentUid);
              return (
                <button key={emoji} onClick={() => onReact(emoji)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold transition-transform active:scale-90"
                  style={{
                    background: myReaction ? "rgba(99,102,241,0.2)" : "hsl(var(--secondary))",
                    border: myReaction ? "1px solid rgba(99,102,241,0.4)" : "1px solid hsl(var(--border))",
                  }}>
                  {emoji}{uids.length > 1 && <span className="text-[9px] text-muted-foreground">{uids.length}</span>}
                </button>
              );
            })}
          </div>
        )}

        <time className="text-[10px] text-muted-foreground/50 mt-1 px-0.5">{timeLabel(msg.createdAt)}</time>
      </div>

      {/* Mobile action sheet */}
      {showActions && (
        <ActionSheet
          msg={msg} isMine={isMine} canDelete={canDelete} currentUid={currentUid}
          onReply={() => { onReply(); setShowActions(false); }}
          onCopy={() => { onCopy(); setShowActions(false); }}
          onDelete={() => { onDelete(); setShowActions(false); }}
          onReact={e => { onReact(e); setShowActions(false); }}
          onClose={() => setShowActions(false)} />
      )}
    </div>
  );
}

/* ─── Action Sheet (mobile bottom sheet) ──────────────────── */
function ActionSheet({ msg, isMine, canDelete, currentUid, onReply, onCopy, onDelete, onReact, onClose }: {
  msg: ChatMessage; isMine: boolean; canDelete: boolean; currentUid?: string;
  onReply: () => void; onCopy: () => void; onDelete: () => void;
  onReact: (e: string) => void; onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[81] rounded-t-3xl overflow-hidden animate-slide-up"
        style={{ background: "hsl(var(--card))", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}>
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-2" />
        {/* Quoted message */}
        <div className="mx-4 mb-3 px-3.5 py-2.5 rounded-2xl"
          style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
          <p className="text-[11px] font-bold mb-0.5" style={{ color: avatarColor(msg.senderId) }}>{msg.senderName}</p>
          <p className="text-sm text-foreground/80 line-clamp-2">{msg.type === "image" ? "📷 Image" : msg.message}</p>
        </div>
        {/* Quick reactions */}
        {currentUid && (
          <div className="mx-4 mb-3 flex items-center gap-1.5 p-2 rounded-2xl"
            style={{ background: "hsl(var(--secondary))" }}>
            {QUICK_REACTIONS.map(emoji => {
              const reacted = msg.reactions?.[emoji]?.includes(currentUid);
              return (
                <button key={emoji} onClick={() => onReact(emoji)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all active:scale-90"
                  style={{
                    background: reacted ? "rgba(99,102,241,0.15)" : "transparent",
                    border: reacted ? "1px solid rgba(99,102,241,0.35)" : "1px solid transparent",
                  }}>
                  <span className="text-xl leading-none">{emoji}</span>
                  {msg.reactions?.[emoji]?.length ? (
                    <span className="text-[9px] font-bold" style={{ color: reacted ? "#818cf8" : "hsl(var(--muted-foreground))" }}>
                      {msg.reactions[emoji].length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        {/* Action buttons */}
        <div className="px-4 pb-safe pb-8 space-y-0.5">
          {!msg.deleted && (
            <ActionSheetBtn icon={<Reply size={16} className="text-blue-400" />} label="Reply" onClick={onReply}
              bg="rgba(59,130,246,0.08)" />
          )}
          {!msg.deleted && msg.type !== "image" && msg.type !== "payment_proof" && (
            <ActionSheetBtn icon={<Copy size={16} className="text-violet-400" />} label="Copy text" onClick={onCopy}
              bg="rgba(139,92,246,0.08)" />
          )}
          {canDelete && !msg.deleted && (
            <ActionSheetBtn icon={<Trash2 size={16} className="text-red-400" />} label="Delete message" onClick={onDelete}
              bg="rgba(239,68,68,0.06)" labelClass="text-red-500" />
          )}
        </div>
      </div>
    </>
  );
}

function ActionSheetBtn({ icon, label, onClick, bg, labelClass }: {
  icon: React.ReactNode; label: string; onClick: () => void; bg?: string; labelClass?: string;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-colors text-left"
      style={{ background: bg }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: bg, border: `1px solid ${bg?.replace("0.08", "0.2").replace("0.06", "0.15") ?? "transparent"}` }}>
        {icon}
      </div>
      <span className={`text-sm font-semibold ${labelClass ?? "text-foreground/85"}`}>{label}</span>
    </button>
  );
}

/* ─── Reply bar ───────────────────────────────────────────── */
function ReplyBar({ replyTo, onClear }: { replyTo: ReplyRef; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t flex-shrink-0 animate-fade-in-down"
      style={{ background: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.15)" }}>
      <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: "rgba(99,102,241,0.6)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold truncate" style={{ color: "#818cf8" }}>{replyTo.senderName}</p>
        <p className="text-xs text-muted-foreground truncate">{replyTo.message}</p>
      </div>
      <button onClick={onClear} className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  );
}

/* ─── Auto textarea ───────────────────────────────────────── */
const AutoTextarea = forwardRef<HTMLTextAreaElement, {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; className?: string;
}>(function AutoTextarea({ value, onChange, onKeyDown, placeholder, className }, ref) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ta = (ref as React.RefObject<HTMLTextAreaElement>) ?? innerRef;
  useEffect(() => {
    const el = ta.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [value]);
  return (
    <textarea ref={ta} value={value} onChange={onChange} onKeyDown={onKeyDown}
      placeholder={placeholder} rows={1} className={className}
      style={{ resize: "none", overflowY: "auto" }} />
  );
});

/* ─── Chat Composer ───────────────────────────────────────── */
function ChatComposer({ text, setText, onSend, sending, placeholder, replyTo, onClearReply }: {
  text: string; setText: (t: string) => void; onSend: () => void;
  sending: boolean; placeholder: string; replyTo: ReplyRef | null; onClearReply: () => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = useCallback((emoji: string) => {
    const ta = taRef.current;
    if (!ta) { setText(text + emoji); return; }
    const s = ta.selectionStart ?? text.length;
    const e = ta.selectionEnd ?? text.length;
    const next = text.slice(0, s) + emoji + text.slice(e);
    setText(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + emoji.length; }, 0);
  }, [text, setText]);

  const hasText = text.trim().length > 0;

  return (
    <div className="flex-shrink-0 w-full" style={{ background: "hsl(var(--card))", borderTop: "1px solid hsl(var(--border))" }}>
      {replyTo && <ReplyBar replyTo={replyTo} onClear={onClearReply} />}
      <div className="px-3 py-2.5 flex items-end gap-2 w-full min-w-0 relative">
        {showEmoji && (
          <EmojiPicker onSelect={e => { insertEmoji(e); setShowEmoji(false); }} onClose={() => setShowEmoji(false)} />
        )}
        {/* Emoji button */}
        <button type="button" onClick={() => setShowEmoji(v => !v)}
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all active:scale-90"
          style={{
            background: showEmoji ? "rgba(99,102,241,0.15)" : "hsl(var(--secondary))",
            color: showEmoji ? "#818cf8" : "hsl(var(--muted-foreground))",
            border: showEmoji ? "1px solid rgba(99,102,241,0.3)" : "1px solid hsl(var(--border))",
          }}>
          <Smile size={18} />
        </button>

        {/* Text area */}
        <div className="flex-1 min-w-0 rounded-2xl border flex items-end px-3 py-1.5 transition-all"
          style={{
            background: "hsl(var(--secondary))",
            borderColor: showEmoji ? "rgba(99,102,241,0.4)" : "hsl(var(--border))",
          }}>
          <AutoTextarea ref={taRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={placeholder}
            className="flex-1 min-w-0 min-h-[28px] max-h-[120px] text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground py-1" />
        </div>

        {/* Send button */}
        <button onClick={onSend} disabled={!hasText || sending}
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-90"
          style={{
            background: hasText ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "hsl(var(--secondary))",
            boxShadow: hasText ? "0 4px 14px rgba(99,102,241,0.45)" : "none",
            transform: hasText ? undefined : undefined,
          }}>
          <Send size={15} className={hasText ? "text-white" : "text-muted-foreground"} style={{ transform: "rotate(0deg)" }} />
        </button>
      </div>
    </div>
  );
}

/* ─── Typing indicator ────────────────────────────────────── */
function TypingIndicator({ users }: { users: string[] }) {
  if (!users.length) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t flex-shrink-0"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <div className="flex gap-1 items-end">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 160}ms`, animationDuration: "1.2s" }} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {users.length === 1 ? `${users[0]} is typing…`
          : users.length === 2 ? `${users[0]} and ${users[1]} are typing…`
          : `${users[0]} and ${users.length - 1} others are typing…`}
      </p>
    </div>
  );
}

/* ─── Message list renderer (with grouping + date seps) ───── */
function renderMessages(
  messages: ChatMessage[],
  uid: string | undefined,
  isAdmin: boolean,
  opts: {
    onReply: (m: ChatMessage) => void;
    onCopy: (m: ChatMessage) => void;
    onDelete: (m: ChatMessage) => void;
    onReact: (id: string, emoji: string) => void;
    onAvatarClick?: (m: ChatMessage) => void;
    onImageClick?: (url: string, cap?: string) => void;
    onSubmitPayment?: (m: ChatMessage) => void;
    isPrivate?: boolean;
    myUid?: string;
    chatId?: string;
    onApprove?: (m: ChatMessage) => Promise<void>;
    onReject?: (m: ChatMessage) => Promise<void>;
  }
) {
  const els: React.ReactNode[] = [];
  let lastSenderId = "";
  let lastTs: { seconds: number } | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const next = messages[i + 1];

    /* Date separator */
    if (!sameDay(lastTs, msg.createdAt)) {
      els.push(<DateSeparator key={`sep-${msg.id}`} label={dateSeparatorLabel(msg.createdAt)} />);
    }
    lastTs = msg.createdAt;

    /* System message */
    if (msg.senderRole === "system" || msg.senderId === "system_qr") {
      els.push(<SystemBubble key={msg.id} text={msg.message} />);
      lastSenderId = "";
      continue;
    }

    /* Payment proof card */
    if (msg.type === "payment_proof" && opts.isPrivate && opts.myUid && opts.chatId) {
      els.push(
        <PaymentProofCard key={msg.id} msg={msg} isAdmin={isAdmin} myUid={opts.myUid}
          chatId={opts.chatId}
          onApprove={opts.onApprove ?? (() => Promise.resolve())}
          onReject={opts.onReject ?? (() => Promise.resolve())} />
      );
      lastSenderId = "";
      continue;
    }

    const isMine = msg.senderId === uid;
    const isGrouped = lastSenderId === msg.senderId && !["image", "payment_proof"].includes(msg.type ?? "");
    const isLast = !next || next.senderId !== msg.senderId || ["image", "payment_proof"].includes(next.type ?? "");

    els.push(
      <MessageBubble key={msg.id}
        msg={msg} isMine={isMine} isGrouped={isGrouped} isLast={isLast}
        canDelete={isAdmin || msg.senderId === uid}
        currentUid={uid}
        onReply={() => opts.onReply(msg)}
        onCopy={() => opts.onCopy(msg)}
        onDelete={() => opts.onDelete(msg)}
        onReact={emoji => opts.onReact(msg.id, emoji)}
        onAvatarClick={!isMine && opts.onAvatarClick ? () => opts.onAvatarClick!(msg) : undefined}
        onImageClick={opts.onImageClick}
        onSubmitPayment={msg.isPaymentQr && !isAdmin && opts.onSubmitPayment ? () => opts.onSubmitPayment!(msg) : undefined}
      />
    );

    lastSenderId = msg.senderId;
  }

  return els;
}

/* ─── Community Chat ──────────────────────────────────────── */
function CommunityChat({ uid, name, photo, role, isAdmin, isReadOnly, onAvatarClick }: {
  uid?: string; name?: string; photo?: string | null;
  role?: string; isAdmin: boolean; isReadOnly: boolean;
  onAvatarClick?: (u: UserDoc) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { markCommunityRead } = useUnread();

  const scrollToBottom = useCallback((instant = false) => {
    const el = scrollRef.current; if (!el) return;
    if (instant) el.scrollTop = el.scrollHeight;
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "communityMessages"), orderBy("createdAt", "asc"), limit(200));
    const unsub = onSnapshot(q, snap => {
      // Deduplicate by id
      const seen = new Set<string>();
      const msgs: ChatMessage[] = [];
      for (const d of snap.docs) {
        if (!seen.has(d.id)) { seen.add(d.id); msgs.push({ id: d.id, ...d.data() } as ChatMessage); }
      }
      setMessages(msgs); setLoading(false);
      if (isFirstLoad.current) { isFirstLoad.current = false; requestAnimationFrame(() => scrollToBottom(true)); }
      else {
        const el = scrollRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) requestAnimationFrame(() => scrollToBottom(false));
      }
    }, () => setLoading(false));
    return unsub;
  }, [scrollToBottom]);

  useEffect(() => { markCommunityRead(); markRead("community"); }, []);

  useEffect(() => {
    getDocs(collection(db, "users")).then(s => setMemberCount(s.size)).catch(() => {});
  }, []);

  useEffect(() => {
    const typingRef = doc(db, "chatMeta", "communityTyping");
    const unsub = onSnapshot(typingRef, snap => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, { name: string; at: number }>;
      const now = Date.now();
      setTypingUsers(Object.entries(data).filter(([id, v]) => id !== uid && v.at > now - 8000).map(([, v]) => v.name));
    }, () => {});
    return unsub;
  }, [uid]);

  const broadcastTyping = useCallback(() => {
    if (!uid || !name) return;
    setDoc(doc(db, "chatMeta", "communityTyping"), { [uid]: { name, at: Date.now() } }, { merge: true }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setDoc(doc(db, "chatMeta", "communityTyping"), { [uid]: { name, at: 0 } }, { merge: true }).catch(() => {});
    }, 7000);
  }, [uid, name]);

  const send = async () => {
    const t = text.trim(); if (!t || sending || !uid || !name) return;
    setSending(true); setText("");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setDoc(doc(db, "chatMeta", "communityTyping"), { [uid]: { name, at: 0 } }, { merge: true }).catch(() => {});
    const payload: Record<string, unknown> = { senderId: uid, senderName: name, senderPhoto: photo ?? null, senderRole: role ?? "student", message: t, createdAt: serverTimestamp() };
    if (replyTo) { payload.replyTo = replyTo; setReplyTo(null); }
    try { await addDoc(collection(db, "communityMessages"), payload); }
    finally { setSending(false); }
  };

  const softDelete = async (msg: ChatMessage) => {
    if (!uid) return;
    await updateDoc(doc(db, "communityMessages", msg.id), { deleted: true, deletedByName: isAdmin ? (name ?? "Admin") : msg.senderName, message: "" }).catch(() => {});
  };

  const reactTo = useCallback(async (msgId: string, emoji: string) => {
    if (!uid) return;
    const msgRef = doc(db, "communityMessages", msgId);
    const msg = messages.find(m => m.id === msgId);
    const already = msg?.reactions?.[emoji]?.includes(uid);
    await updateDoc(msgRef, { [`reactions.${emoji}`]: already ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {});
  }, [uid, messages]);

  const clearAll = async () => {
    if (!window.confirm("Delete ALL community messages?")) return;
    setClearing(true);
    try { const s = await getDocs(collection(db, "communityMessages")); await Promise.all(s.docs.map(d => deleteDoc(d.ref))); }
    finally { setClearing(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Admin toolbar */}
      {isAdmin && (
        <div className="flex items-center justify-end px-4 py-1.5 border-b flex-shrink-0"
          style={{ background: "rgba(239,68,68,0.03)", borderColor: "hsl(var(--border))" }}>
          <button onClick={clearAll} disabled={clearing}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition-colors">
            <Trash2 size={11} /> {clearing ? "Clearing…" : "Clear all"}
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-4 w-full min-w-0 min-h-0">
        {loading ? (
          <div className="space-y-4 px-4 py-4">
            {[0,1,2,3,4].map(i => (
              <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                {i % 2 === 0 && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
                <div className="space-y-1.5">
                  <Skeleton className="h-2.5 w-16 rounded" />
                  <Skeleton className={`h-10 ${i % 3 === 0 ? "w-56" : "w-40"} rounded-2xl`} />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <Globe size={28} className="text-indigo-400" />
            </div>
            <p className="font-bold text-foreground mb-1">Community Chat</p>
            <p className="text-sm text-muted-foreground">Be the first to say something! 👋</p>
          </div>
        ) : (
          renderMessages(messages, uid, isAdmin, {
            onReply: m => setReplyTo({ id: m.id, message: m.message, senderName: m.senderName }),
            onCopy: m => navigator.clipboard.writeText(m.message).catch(() => {}),
            onDelete: m => softDelete(m),
            onReact: (id, emoji) => reactTo(id, emoji),
            onAvatarClick: m => onAvatarClick?.({ uid: m.senderId, name: m.senderName, photoURL: m.senderPhoto, role: m.senderRole }),
          })
        )}
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button onClick={() => scrollToBottom(false)}
          className="absolute right-4 z-20 w-9 h-9 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 animate-scale-in"
          style={{ bottom: isReadOnly ? "80px" : "68px", background: "#6366f1", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.45)" }}>
          <ChevronDown size={18} />
        </button>
      )}

      <TypingIndicator users={typingUsers} />

      {/* Composer or sign-in */}
      {isReadOnly ? (
        <div className="border-t flex-shrink-0 px-4 py-4 flex flex-col items-center gap-2 text-center"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
          <p className="text-sm text-muted-foreground">Sign in to join the conversation</p>
          <Link href="/login">
            <Button variant="outline" size="sm" className="gap-1.5 h-9 text-sm">
              <LogIn size={13} /> Sign in
            </Button>
          </Link>
        </div>
      ) : (
        <ChatComposer text={text} setText={t => { setText(t); if (t.trim()) broadcastTyping(); }}
          onSend={send} sending={sending}
          placeholder="Message the community…"
          replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      )}
    </div>
  );
}

/* ─── Private Chat Panel ──────────────────────────────────── */
function PrivateChatPanel({ myUid, myName, myPhoto, myRole, other, isAdmin, onAvatarClick, autoMessage, autoPlan }: {
  myUid: string; myName: string; myPhoto?: string | null; myRole?: string;
  other: UserDoc; isAdmin: boolean; autoMessage?: string; autoPlan?: "day" | "month";
  onAvatarClick?: (u: UserDoc) => void;
}) {
  const chatId = useMemo(() => [myUid, other.uid].sort().join("_"), [myUid, other.uid]);
  const { approvePremiumRequest, rejectPremiumRequest, grantPremium } = usePremium();
  const { resetPrivateUnread } = useUnread();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [proofPlan, setProofPlan] = useState<"day" | "month" | undefined>(undefined);
  const [showQRConfirm, setShowQRConfirm] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{ url: string; caption?: string } | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PremiumRequest[]>([]);
  const [headerActing, setHeaderActing] = useState<"approve" | "reject" | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const autoMsgSent = useRef(false);
  const isOtherAdmin = other.role === "admin" || other.role === "owner";

  const scrollToBottom = useCallback((instant = false) => {
    const el = scrollRef.current; if (!el) return;
    if (instant) el.scrollTop = el.scrollHeight;
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150);
  }, []);

  useEffect(() => {
    resetPrivateUnread(other.uid, chatId);
    const q = query(collection(db, "privateChats", chatId, "messages"), orderBy("createdAt", "asc"), limit(200));
    const unsub = onSnapshot(q, snap => {
      const seen = new Set<string>(); const msgs: ChatMessage[] = [];
      for (const d of snap.docs) { if (!seen.has(d.id)) { seen.add(d.id); msgs.push({ id: d.id, ...d.data() } as ChatMessage); } }
      setMessages(msgs); setLoading(false);
      resetPrivateUnread(other.uid, chatId);
      if (isFirstLoad.current) { isFirstLoad.current = false; requestAnimationFrame(() => scrollToBottom(true)); }
      else {
        const el = scrollRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) requestAnimationFrame(() => scrollToBottom(false));
      }
    }, () => setLoading(false));
    return unsub;
  }, [chatId, other.uid, scrollToBottom]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "premiumRequests"), where("uid", "==", other.uid), where("status", "==", "pending"), orderBy("createdAt", "desc"), limit(5));
    const unsub = onSnapshot(q, snap => {
      setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PremiumRequest)));
    }, () => {});
    return unsub;
  }, [isAdmin, other.uid]);

  const sendPrivateMessage = useCallback(async (payload: Record<string, unknown>) => {
    await addDoc(collection(db, "privateChats", chatId, "messages"), { ...payload, createdAt: serverTimestamp() });
    const recipientUid = (payload.senderId as string) === myUid ? other.uid : myUid;
    const msgPreview = typeof payload.message === "string" ? (payload.message as string).slice(0, 80) : payload.type === "image" ? "📷 QR Image" : "💬 Message";
    setDoc(doc(db, "privateChatMeta", chatId), {
      participants: [myUid, other.uid],
      participantInfo: {
        [myUid]: { name: myName, photoURL: myPhoto ?? null, role: myRole ?? "student" },
        [other.uid]: { name: other.name, photoURL: other.photoURL ?? null, role: other.role ?? "student" },
      },
      [`unread_${recipientUid}`]: increment(1),
      lastMessage: msgPreview, lastMessageAt: serverTimestamp(), lastSenderId: payload.senderId as string,
    }, { merge: true }).catch(() => {});
  }, [chatId, myUid, other.uid, myName, myPhoto, myRole, other.name, other.photoURL, other.role]);

  const sendRaw = useCallback(async (msg: string) => {
    await sendPrivateMessage({ senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "student", message: msg });
  }, [sendPrivateMessage, myUid, myName, myPhoto, myRole]);

  useEffect(() => {
    if (!autoMessage || loading || autoMsgSent.current) return;
    autoMsgSent.current = true;
    const run = async () => {
      try {
        if (autoPlan) {
          const existing = await getDocs(query(collection(db, "premiumRequests"), where("uid", "==", myUid), where("status", "==", "pending"), where("plan", "==", autoPlan), where("qrSent", "==", true), limit(1))).catch(() => null);
          if (existing && !existing.empty) {
            await sendPrivateMessage({ senderId: "system_qr", senderName: "Next Toppers · Feed", senderPhoto: null, senderRole: "system", message: "⚠️ You already have an active premium request for this plan. Tap \"Submit Payment Proof\" to add your transaction ID, or wait — admin will verify soon!" });
            return;
          }
          await sendRaw(autoMessage);
          const qr = QR_CODES[autoPlan];
          await addDoc(collection(db, "premiumRequests"), { uid: myUid, userName: myName, userPhoto: myPhoto ?? null, adminUid: other.uid, plan: autoPlan, price: qr.price, transactionId: "", note: "", chatId, status: "pending", qrSent: true, proofSubmitted: false, createdAt: serverTimestamp() }).catch(() => {});
          await sendPrivateMessage({ senderId: "system_qr", senderName: "Next Toppers · Feed", senderPhoto: null, senderRole: "system", message: `Payment QR — ${qr.label}`, type: "image", imageUrl: qr.url, imageCaption: `Payment QR — ${qr.label}`, isPaymentQr: true, qrPlan: autoPlan });
          await sendPrivateMessage({ senderId: "system_qr", senderName: "Next Toppers · Feed", senderPhoto: null, senderRole: "system", message: "📸 QR sent! Pay via UPI, then tap \"Submit Payment Proof\" to submit your transaction ID. Admin will activate Premium within 1 hour." });
        } else {
          await sendRaw(autoMessage);
        }
      } catch (e) { console.error("Auto flow:", e); sendRaw(autoMessage).catch(() => {}); }
    };
    run();
  }, [loading, autoMessage, autoPlan, sendRaw, sendPrivateMessage, myUid, myName, myPhoto, other.uid, chatId]);

  const send = async () => {
    const t = text.trim(); if (!t || sending) return;
    setSending(true); setText("");
    const payload: Record<string, unknown> = { senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "student", message: t };
    if (replyTo) { payload.replyTo = replyTo; setReplyTo(null); }
    try { await sendPrivateMessage(payload); } finally { setSending(false); }
  };

  const softDelete = async (msg: ChatMessage) => {
    await updateDoc(doc(db, "privateChats", chatId, "messages", msg.id), { deleted: true, deletedByName: isAdmin ? myName : msg.senderName, message: "" }).catch(() => {});
  };

  const reactTo = useCallback(async (msgId: string, emoji: string) => {
    const msgRef = doc(db, "privateChats", chatId, "messages", msgId);
    const msg = messages.find(m => m.id === msgId);
    const already = msg?.reactions?.[emoji]?.includes(myUid);
    await updateDoc(msgRef, { [`reactions.${emoji}`]: already ? arrayRemove(myUid) : arrayUnion(myUid) }).catch(() => {});
  }, [myUid, chatId, messages]);

  const handleSendQR = async (plan: "day" | "month") => {
    const qr = QR_CODES[plan];
    await sendPrivateMessage({ senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "admin", message: `Payment QR — ${qr.label}`, type: "image", imageUrl: qr.url, imageCaption: `Payment QR — ${qr.label}`, isPaymentQr: true, qrPlan: plan });
  };

  const handleApproveFromCard = async (msg: ChatMessage) => {
    const { proofData } = msg; if (!proofData || proofData.status !== "pending") return;
    const { requestId, uid, plan } = proofData;
    try {
      if (requestId.startsWith("contact_")) { await updateDoc(doc(db, "contactMessages", requestId.replace("contact_", "")), { status: "approved" }); await grantPremium(uid, plan, 0); }
      else { await approvePremiumRequest(requestId, uid, plan); }
      await updateDoc(doc(db, "privateChats", chatId, "messages", msg.id), { "proofData.status": "approved" });
      await sendPrivateMessage({ senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "admin", message: "✅ Payment approved! Your premium access will be activated within 1 hour." });
    } catch (e) { console.error("Approve failed:", e); }
  };

  const handleRejectFromCard = async (msg: ChatMessage) => {
    const { proofData } = msg; if (!proofData || proofData.status !== "pending") return;
    try {
      if (proofData.requestId.startsWith("contact_")) { await updateDoc(doc(db, "contactMessages", proofData.requestId.replace("contact_", "")), { status: "rejected" }); }
      else { await rejectPremiumRequest(proofData.requestId); }
      await updateDoc(doc(db, "privateChats", chatId, "messages", msg.id), { "proofData.status": "rejected" });
      await sendPrivateMessage({ senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "admin", message: "❌ Payment verification failed. Please check your transaction details and try again." });
    } catch (e) { console.error("Reject failed:", e); }
  };

  const handleApproveLatest = async () => {
    const latest = pendingRequests[0]; if (!latest) return;
    setHeaderActing("approve");
    try { await approvePremiumRequest(latest.id, latest.uid, latest.plan); await sendPrivateMessage({ senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "admin", message: "✅ Payment approved! Your premium access will be activated within 1 hour." }); }
    finally { setHeaderActing(null); }
  };

  const handleRejectLatest = async () => {
    const latest = pendingRequests[0]; if (!latest) return;
    setHeaderActing("reject");
    try { await rejectPremiumRequest(latest.id); await sendPrivateMessage({ senderId: myUid, senderName: myName, senderPhoto: myPhoto ?? null, senderRole: myRole ?? "admin", message: "❌ Payment verification failed." }); }
    finally { setHeaderActing(null); }
  };

  const clearChat = async () => {
    setShowClearConfirm(false);
    const snap = await getDocs(query(collection(db, "privateChats", chatId, "messages"), limit(200))).catch(() => null);
    if (!snap) return;
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "privateChats", chatId, "messages", d.id)).catch(() => {})));
    await setDoc(doc(db, "privateChatMeta", chatId), { lastMessage: "Chat cleared", lastMessageAt: serverTimestamp() }, { merge: true }).catch(() => {});
  };

  const hasQrPending = !isAdmin && isOtherAdmin && messages.some(m => m.isPaymentQr) && !messages.some(m => m.type === "payment_proof" && m.senderId === myUid);
  const hasPending = pendingRequests.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Admin toolbar */}
      {isAdmin && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b flex-wrap flex-shrink-0"
          style={{ background: "rgba(99,102,241,0.03)", borderColor: "hsl(var(--border))" }}>
          <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-wide mr-1">Admin</span>
          <button onClick={() => setShowQRConfirm(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "rgba(99,102,241,0.2)" }}>
            <QrCode size={11} /> Send QR
          </button>
          <button onClick={handleApproveLatest} disabled={!hasPending || headerActing !== null}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${hasPending ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground/40 cursor-not-allowed"}`}
            style={{ borderColor: hasPending ? "rgba(16,185,129,0.25)" : "hsl(var(--border))" }}>
            <CheckCircle2 size={11} />
            {headerActing === "approve" ? "Approving…" : "Approve"}
            {hasPending && <span className="ml-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">{pendingRequests.length}</span>}
          </button>
          <button onClick={handleRejectLatest} disabled={!hasPending || headerActing !== null}
            className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${hasPending ? "text-red-600 hover:bg-red-500/10" : "text-muted-foreground/40 cursor-not-allowed"}`}
            style={{ borderColor: hasPending ? "rgba(239,68,68,0.25)" : "hsl(var(--border))" }}>
            <XCircle size={11} />
            {headerActing === "reject" ? "Rejecting…" : "Reject"}
          </button>
          <button onClick={() => setShowClearConfirm(true)}
            className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-500/20 transition-colors">
            <Trash2 size={11} /> Clear
          </button>
        </div>
      )}

      {/* Submit payment proof banner */}
      {hasQrPending && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b flex-shrink-0"
          style={{ background: "rgba(245,158,11,0.04)", borderColor: "rgba(245,158,11,0.15)" }}>
          <p className="text-[11px] text-amber-600">Payment QR received!</p>
          <button onClick={() => { setProofPlan(undefined); setShowProof(true); }}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/10 px-2.5 py-1 rounded-lg">
            <Crown size={11} /> Submit Proof
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-4 w-full min-w-0 min-h-0">
        {loading ? (
          <div className="space-y-4 px-4">
            {[0,1,2].map(i => (
              <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}>
                {i % 2 !== 0 && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
                <Skeleton className="h-10 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Avatar name={other.name} photo={other.photoURL} uid={other.uid} size={16} isOnline={other.isOnline} />
            <div className="flex items-center gap-2 mt-4 mb-1 flex-wrap justify-center">
              <p className="font-bold text-foreground">{other.name}</p>
              <RoleBadge role={other.role} />
            </div>
            <p className="text-sm text-muted-foreground mb-4">Start a private conversation</p>
            {isOtherAdmin && !isAdmin && (
              <button onClick={() => { setProofPlan(undefined); setShowProof(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-600"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <Crown size={11} /> Submit Payment Proof
              </button>
            )}
          </div>
        ) : renderMessages(messages, myUid, isAdmin, {
          onReply: m => setReplyTo({ id: m.id, message: m.message, senderName: m.senderName }),
          onCopy: m => navigator.clipboard.writeText(m.message).catch(() => {}),
          onDelete: m => softDelete(m),
          onReact: (id, emoji) => reactTo(id, emoji),
          onAvatarClick: m => onAvatarClick?.({ uid: m.senderId, name: m.senderName, photoURL: m.senderPhoto, role: m.senderRole }),
          onImageClick: (url, cap) => setFullscreenImage({ url, caption: cap }),
          onSubmitPayment: m => { setProofPlan(m.qrPlan); setShowProof(true); },
          isPrivate: true, myUid, chatId,
          onApprove: handleApproveFromCard, onReject: handleRejectFromCard,
        })}
      </div>

      {/* Scroll button */}
      {showScrollBtn && (
        <button onClick={() => scrollToBottom(false)}
          className="absolute right-4 bottom-20 z-20 w-9 h-9 rounded-full shadow-xl flex items-center justify-center animate-scale-in"
          style={{ background: "#6366f1", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.45)" }}>
          <ChevronDown size={18} />
        </button>
      )}

      <ChatComposer text={text} setText={setText} onSend={send} sending={sending}
        placeholder={`Message ${other.name}…`} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />

      {showProof && (
        <PaymentProofForm myUid={myUid} myName={myName} myPhoto={myPhoto} myRole={myRole}
          adminUid={other.uid} defaultPlan={proofPlan} onClose={() => setShowProof(false)} />
      )}
      {showQRConfirm && (
        <SendQRConfirmPopup defaultPlan="month" onConfirm={handleSendQR} onClose={() => setShowQRConfirm(false)} />
      )}
      {fullscreenImage && (
        <ImageFullscreenViewer url={fullscreenImage.url} caption={fullscreenImage.caption} onClose={() => setFullscreenImage(null)} />
      )}
      {showClearConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)} />
          <div className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-[51] max-w-xs mx-auto bg-card border border-border rounded-2xl shadow-2xl p-6 text-center animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-foreground mb-1">Clear conversation?</h3>
            <p className="text-xs text-muted-foreground mb-5">All messages will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 px-4 py-2 rounded-xl border border-border text-sm font-semibold">Cancel</button>
              <button onClick={clearChat} className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">Delete All</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── DM Sidebar Item ─────────────────────────────────────── */
function DmListItem({ item, isActive, onClick }: { item: DmItem; isActive: boolean; onClick: () => void }) {
  const lastTime = item.lastMessageAt
    ? (() => {
        const d = new Date(item.lastMessageAt.seconds * 1000);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      })()
    : "";

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${isActive ? "bg-primary/10" : "hover:bg-secondary"}`}
      style={{ border: isActive ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent" }}>
      <Avatar name={item.user.name} photo={item.user.photoURL} uid={item.user.uid} size={10} isOnline={item.user.isOnline} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-sm font-bold truncate ${isActive ? "text-primary" : "text-foreground"}`}>{item.user.name}</span>
          {lastTime && <span className="text-[10px] text-muted-foreground flex-shrink-0">{lastTime}</span>}
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">{item.lastMessage || <span className="italic opacity-60">Start chatting</span>}</p>
          {item.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-1">
              {item.unreadCount > 99 ? "99+" : item.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Main Chat Page ──────────────────────────────────────── */
type ActiveView = { type: "community" } | { type: "private"; user: UserDoc };

export default function Chat() {
  const { user, isAdmin, role } = useAuth();
  const { communityUnread, markCommunityRead, privateUnread, resetPrivateUnread } = useUnread();
  const [active, setActive] = useState<ActiveView>({ type: "community" });
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<UserDoc | null>(null);
  const [autoMsg, setAutoMsg] = useState<string | undefined>(undefined);
  const [autoPlan, setAutoPlan] = useState<"day" | "month" | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [adminUsers, setAdminUsers] = useState<UserDoc[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChatEntry[]>([]);

  useEffect(() => {
    getDocs(collection(db, "users")).then(s => setMemberCount(s.size)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const dmRaw = sessionStorage.getItem("nt_auto_dm");
    if (dmRaw) {
      sessionStorage.removeItem("nt_auto_dm");
      try {
        const data = JSON.parse(dmRaw) as { adminUid: string; adminName: string; adminPhoto: string | null; adminRole: string; message: string; plan?: "day" | "month" };
        setActive({ type: "private", user: { uid: data.adminUid, name: data.adminName, photoURL: data.adminPhoto, role: data.adminRole } });
        setMobilePanelOpen(true); setAutoMsg(data.message);
        if (data.plan) setAutoPlan(data.plan);
        return;
      } catch { /* ignore */ }
    }
    const chatRaw = sessionStorage.getItem("nt_open_chat");
    if (chatRaw) {
      sessionStorage.removeItem("nt_open_chat");
      try {
        const data = JSON.parse(chatRaw) as { uid: string; name: string; photo: string | null; role: string };
        setActive({ type: "private", user: { uid: data.uid, name: data.name, photoURL: data.photo, role: data.role } });
        setMobilePanelOpen(true);
      } catch { /* ignore */ }
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setAdminUsers([]); return; }
    getDocs(collection(db, "admins"))
      .then(snap => {
        setAdminUsers(snap.docs.filter(d => d.id !== user.uid).map(d => {
          const data = d.data();
          return { uid: d.id, name: data.name ?? data.displayName ?? "Admin", photoURL: data.photoURL ?? null, role: data.role ?? "admin" };
        }));
      }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) { setRecentChats([]); return; }
    const q = query(collection(db, "privateChatMeta"), where("participants", "array-contains", user.uid), orderBy("lastMessageAt", "desc"), limit(50));
    const unsub = onSnapshot(q, snap => {
      const entries: RecentChatEntry[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const parts: string[] = data.participants ?? [];
        const otherUid = parts.find(p => p !== user.uid);
        if (!otherUid) continue;
        const info = data.participantInfo?.[otherUid];
        entries.push({ chatId: d.id, otherUid, otherName: info?.name ?? "User", otherPhoto: info?.photoURL ?? null, otherRole: info?.role ?? "student", lastMessage: data.lastMessage ?? "", lastMessageAt: data.lastMessageAt ?? null, unreadCount: data[`unread_${user.uid}`] ?? 0 });
      }
      setRecentChats(entries);
    }, () => {});
    return unsub;
  }, [user]);

  const dmItems = useMemo((): DmItem[] => {
    const map = new Map<string, DmItem>();
    for (const admin of adminUsers) {
      map.set(admin.uid, { user: admin, lastMessage: "", lastMessageAt: null, unreadCount: privateUnread[admin.uid] ?? 0 });
    }
    for (const chat of recentChats) {
      const existing = map.get(chat.otherUid);
      const user_: UserDoc = existing?.user ?? { uid: chat.otherUid, name: chat.otherName, photoURL: chat.otherPhoto, role: chat.otherRole };
      map.set(chat.otherUid, { user: user_, lastMessage: chat.lastMessage, lastMessageAt: chat.lastMessageAt, unreadCount: chat.unreadCount });
    }
    return Array.from(map.values())
      .filter(item => !search || item.user.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.seconds - a.lastMessageAt.seconds;
        if (a.lastMessageAt) return -1; if (b.lastMessageAt) return 1; return 0;
      });
  }, [adminUsers, recentChats, search, privateUnread]);

  const myName = user?.displayName ?? "Student";
  const myPhoto = user?.photoURL ?? null;

  const openPrivate = (u: UserDoc) => {
    const cId = [user!.uid, u.uid].sort().join("_");
    setActive({ type: "private", user: u }); setMobilePanelOpen(true);
    setAutoMsg(undefined); resetPrivateUnread(u.uid, cId); markRead(`priv_${u.uid}`);
  };

  const openCommunity = () => {
    setActive({ type: "community" }); setMobilePanelOpen(true);
    markCommunityRead(); markRead("community");
  };

  /* Header for current chat */
  const chatHeader = () => {
    if (active.type === "community") {
      return (
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
          <button onClick={() => setMobilePanelOpen(false)} className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary">
            <ArrowLeft size={16} />
          </button>
          <img src={GROUP_LOGO_URL} alt="Community" className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">Community Chat</p>
            <p className="text-[11px] text-muted-foreground">{memberCount !== null ? `${memberCount.toLocaleString()} members` : "All members"}</p>
          </div>
          <Hash size={16} className="text-muted-foreground/50" />
        </div>
      );
    }
    const u = active.user;
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <button onClick={() => setMobilePanelOpen(false)} className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary">
          <ArrowLeft size={16} />
        </button>
        <Avatar name={u.name} photo={u.photoURL} uid={u.uid} size={9} isOnline={u.isOnline}
          onClick={() => setProfileTarget(u)} />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setProfileTarget(u)}>
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-foreground text-sm truncate">{u.name}</p>
            <RoleBadge role={u.role} />
          </div>
          <div className="flex items-center gap-1">
            <Lock size={9} className="text-muted-foreground/50" />
            <p className="text-[11px] text-muted-foreground">Private chat</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <Info size={15} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="w-full max-w-5xl mx-auto flex gap-0 overflow-hidden rounded-none md:rounded-2xl md:m-4 md:border md:shadow-sm"
        style={{
          height: "calc(100dvh - 56px - 64px)",
          minHeight: 0,
          maxWidth: "calc(100vw - 0px)",
          background: "hsl(var(--background))",
          borderColor: "hsl(var(--border))",
        }}>

        {/* ── Sidebar ── */}
        <div className={`w-full md:w-72 flex-shrink-0 flex flex-col border-r ${mobilePanelOpen ? "hidden md:flex" : "flex"}`}
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>

          {/* Sidebar header */}
          <div className="px-4 py-4 border-b flex-shrink-0"
            style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <MessageSquare size={15} className="text-indigo-400" />
              </div>
              <h2 className="font-black text-foreground text-sm">Messages</h2>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-none text-foreground placeholder:text-muted-foreground"
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Community */}
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest px-2 mb-2">Community</p>
              <button onClick={openCommunity}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${active.type === "community" ? "bg-primary/10" : "hover:bg-secondary"}`}
                style={{ border: active.type === "community" ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent" }}>
                <div className="relative flex-shrink-0">
                  <img src={GROUP_LOGO_URL} alt="Community" className="w-10 h-10 rounded-xl object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${active.type === "community" ? "text-primary" : "text-foreground"}`}>Community Chat</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Users size={10} className="text-muted-foreground/50" />
                    <p className="text-[11px] text-muted-foreground">{memberCount !== null ? `${memberCount} members` : "All members"}</p>
                  </div>
                </div>
                {communityUnread > 0 && active.type !== "community" && (
                  <span className="min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-1 flex-shrink-0">
                    {communityUnread > 99 ? "99+" : communityUnread}
                  </span>
                )}
              </button>
            </div>

            {/* DMs */}
            <div className="px-3 pt-3 pb-3">
              <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest px-2 mb-2">Direct Messages</p>
              {user ? (
                dmItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <AtSign size={20} className="text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">{search ? "No results" : "No conversations yet"}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {dmItems.map(item => (
                      <DmListItem key={item.user.uid} item={item}
                        isActive={active.type === "private" && active.user.uid === item.user.uid}
                        onClick={() => openPrivate(item.user)} />
                    ))}
                  </div>
                )
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground mb-3">Sign in to start messaging</p>
                  <Link href="/login">
                    <Button size="sm" className="gap-1.5 h-8 text-xs"><LogIn size={12} /> Sign in</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${mobilePanelOpen ? "flex" : "hidden md:flex"}`}
          style={{ background: "hsl(var(--background))" }}>
          {chatHeader()}
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
            {active.type === "community" ? (
              <CommunityChat uid={user?.uid} name={myName} photo={myPhoto} role={role ?? undefined}
                isAdmin={isAdmin} isReadOnly={!user}
                onAvatarClick={user ? u => { setProfileTarget(u); } : undefined} />
            ) : user ? (
              <PrivateChatPanel key={`${user.uid}_${active.user.uid}`}
                myUid={user.uid} myName={myName} myPhoto={myPhoto} myRole={role ?? undefined}
                other={active.user} isAdmin={isAdmin}
                onAvatarClick={u => setProfileTarget(u)}
                autoMessage={autoMsg} autoPlan={autoPlan} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <Lock size={32} className="text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Sign in to message</p>
                <Link href="/login"><Button size="sm"><LogIn size={13} />Sign in</Button></Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile card */}
      {profileTarget && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setProfileTarget(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] max-w-xs mx-auto animate-scale-in">
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="h-20 w-full" style={{ background: `${avatarColor(profileTarget.uid)}`, opacity: 0.7 }} />
              <div className="px-5 pb-5 -mt-10">
                <Avatar name={profileTarget.name} photo={profileTarget.photoURL} uid={profileTarget.uid} size={20} />
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-foreground text-base">{profileTarget.name}</h3>
                  <RoleBadge role={profileTarget.role} />
                </div>
                {profileTarget.email && <p className="text-xs text-muted-foreground mt-0.5">{profileTarget.email}</p>}
                {user && profileTarget.uid !== user.uid && (
                  <Button className="w-full mt-4 gap-2 h-9 text-sm"
                    onClick={() => { openPrivate(profileTarget); setProfileTarget(null); }}>
                    <MessageSquare size={14} /> Send Message
                  </Button>
                )}
                <button onClick={() => setProfileTarget(null)}
                  className="w-full mt-2 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
