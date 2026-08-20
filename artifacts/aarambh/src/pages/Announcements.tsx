import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell, ChevronLeft, Crown, Megaphone, Video, FileText,
  Info, Search, Share2, Pin, Filter, X, ArrowLeft, Calendar,
  ZoomIn,
} from "lucide-react";

const ANN_REACTIONS = ["👍", "❤️", "🔥", "🎉", "😮"];

function AnnReactionRow({ annId, uid }: { annId: string; uid: string | null }) {
  const [reactions, setReactions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "announcements", annId), (snap) => {
      if (snap.exists()) setReactions(snap.data().reactions ?? {});
    }, () => {});
    return unsub;
  }, [annId]);

  const toggle = useCallback(async (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!uid) return;
    const field = `reactions.${emoji}`;
    const already = reactions[emoji]?.includes(uid);
    await updateDoc(doc(db, "announcements", annId), {
      [field]: already ? arrayRemove(uid) : arrayUnion(uid),
    }).catch(() => {});
  }, [annId, uid, reactions]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
      {ANN_REACTIONS.map((emoji) => {
        const uids = reactions[emoji] ?? [];
        const reacted = uid ? uids.includes(uid) : false;
        return (
          <button key={emoji} onClick={(e) => toggle(emoji, e)}
            disabled={!uid}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all active:scale-90"
            style={{
              background: reacted ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
              border: reacted ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: reacted ? "#818cf8" : "rgba(255,255,255,0.5)",
            }}>
            <span>{emoji}</span>
            {uids.length > 0 && <span style={{ fontSize: "9px", fontWeight: 900 }}>{uids.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  type?: "premium" | "update" | "lecture" | "notice";
  isPinned?: boolean;
  createdAt: { seconds: number } | null;
}

type FilterType = "all" | "premium" | "update" | "lecture" | "notice";

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function timeAgo(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatDate(seconds);
}

function inferType(ann: Announcement): "premium" | "update" | "lecture" | "notice" {
  if (ann.type) return ann.type;
  const text = (ann.title + " " + (ann.message ?? "")).toLowerCase();
  if (text.includes("premium") || text.includes("unlock") || text.includes("exclusive")) return "premium";
  if (text.includes("lecture") || text.includes("video") || text.includes("class")) return "lecture";
  if (text.includes("update") || text.includes("schedule") || text.includes("test") || text.includes("exam")) return "update";
  return "notice";
}

const TYPE_CONFIG = {
  premium: {
    label: "PREMIUM",
    icon: Crown,
    chipBg: "bg-amber-500/15 border-amber-500/40",
    chipText: "text-amber-500",
    cardBg: "bg-gradient-to-br from-amber-950/20 to-orange-950/10 border-amber-500/20",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    accentColor: "#f59e0b",
    actionLabel: "View Details",
  },
  update: {
    label: "UPDATE",
    icon: Megaphone,
    chipBg: "bg-blue-500/15 border-blue-500/40",
    chipText: "text-blue-500",
    cardBg: "bg-card border-border",
    iconBg: "bg-gradient-to-br from-blue-500 to-cyan-500",
    accentColor: "#3b82f6",
    actionLabel: "View Notice",
  },
  lecture: {
    label: "LECTURE",
    icon: Video,
    chipBg: "bg-violet-500/15 border-violet-500/40",
    chipText: "text-violet-500",
    cardBg: "bg-card border-border",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    accentColor: "#8b5cf6",
    actionLabel: "Watch Now",
  },
  notice: {
    label: "NOTICE",
    icon: FileText,
    chipBg: "bg-emerald-500/15 border-emerald-500/40",
    chipText: "text-emerald-500",
    cardBg: "bg-card border-border",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
    accentColor: "#10b981",
    actionLabel: "Read More",
  },
};

const FILTER_TABS: { value: FilterType; label: string; icon: React.ElementType }[] = [
  { value: "all",     label: "All",     icon: Filter },
  { value: "premium", label: "Premium", icon: Crown },
  { value: "update",  label: "Updates", icon: Megaphone },
  { value: "lecture", label: "Lectures", icon: Video },
  { value: "notice",  label: "Notices",  icon: Info },
];

/* ═══════════════════════════════════════════════════════════
   FULLSCREEN DETAIL OVERLAY
═══════════════════════════════════════════════════════════ */
function AnnouncementDetail({ ann, onClose }: { ann: Announcement; onClose: () => void }) {
  const type = inferType(ann);
  const cfg = TYPE_CONFIG[type];
  const TypeIcon = cfg.icon;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgZoomed, setImgZoomed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleShare = async () => {
    const text = `${ann.title}\n\n${ann.message}`;
    if (navigator.share) {
      navigator.share({ title: ann.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90]"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", animation: "fadeIn 0.18s ease" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-[91] flex flex-col md:inset-0 md:items-center md:justify-center md:p-4"
        style={{ animation: "slideUpDetail 0.28s cubic-bezier(0.32,0.72,0,1)" }}
      >
        <div
          className="relative flex flex-col bg-background overflow-hidden md:rounded-3xl md:max-w-2xl md:w-full md:max-h-[90vh]"
          style={{
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            maxHeight: "92vh",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle — mobile */}
          <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border ${cfg.chipBg} ${cfg.chipText}`}>
                <TypeIcon size={9} />
                {cfg.label}
              </span>
              {ann.isPinned && (
                <Pin size={11} className="text-blue-500 rotate-45" fill="currentColor" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 size={14} />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            {/* Hero image */}
            {ann.imageUrl && !imgError && (
              <div className="relative w-full bg-muted overflow-hidden" style={{ aspectRatio: "16/9", maxHeight: "300px" }}>
                {!imgLoaded && (
                  <div className="absolute inset-0 animate-pulse bg-muted flex items-center justify-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cfg.iconBg}`}>
                      <TypeIcon size={24} className="text-white" />
                    </div>
                  </div>
                )}
                <img
                  src={ann.imageUrl}
                  alt={ann.title}
                  className={`w-full h-full object-cover transition-opacity duration-300 cursor-pointer ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                  onClick={() => setImgZoomed(true)}
                />
                {imgLoaded && (
                  <button
                    onClick={() => setImgZoomed(true)}
                    className="absolute bottom-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
                  >
                    <ZoomIn size={14} className="text-white" />
                  </button>
                )}
              </div>
            )}

            {/* No image — colored header strip */}
            {(!ann.imageUrl || imgError) && (
              <div
                className="w-full flex items-center justify-center py-8"
                style={{
                  background: `linear-gradient(135deg, ${cfg.accentColor}22, ${cfg.accentColor}08)`,
                  borderBottom: `1px solid ${cfg.accentColor}30`,
                }}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${cfg.iconBg}`}>
                  <TypeIcon size={28} className="text-white" />
                </div>
              </div>
            )}

            <div className="px-5 py-5">
              {/* Date */}
              {ann.createdAt && (
                <div className="flex items-center gap-1.5 mb-3">
                  <Calendar size={12} className="text-muted-foreground" />
                  <time className="text-[11px] text-muted-foreground font-medium">
                    {formatDate(ann.createdAt.seconds)} · {timeAgo(ann.createdAt.seconds)}
                  </time>
                </div>
              )}

              {/* Title */}
              <h2
                className="font-display font-black text-foreground text-xl leading-snug mb-4"
                style={{ wordBreak: "break-word" }}
              >
                {ann.title}
              </h2>

              {/* Divider */}
              <div className="h-px bg-border mb-4" />

              {/* Message */}
              <p
                className="text-foreground/80 text-sm leading-relaxed"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {ann.message}
              </p>
            </div>
          </div>

          {/* Bottom close bar */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-border" style={{ background: "hsl(var(--card))" }}>
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-98"
              style={{
                background: `linear-gradient(135deg, ${cfg.accentColor}, ${cfg.accentColor}cc)`,
                color: "white",
              }}
            >
              <ArrowLeft size={14} />
              Back to Announcements
            </button>
          </div>
        </div>
      </div>

      {/* Zoomed image lightbox */}
      {imgZoomed && ann.imageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)", animation: "fadeIn 0.15s ease" }}
          onClick={() => setImgZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setImgZoomed(false)}
          >
            <X size={18} />
          </button>
          <img
            src={ann.imageUrl}
            alt={ann.title}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANNOUNCEMENT CARD
═══════════════════════════════════════════════════════════ */
function AnnouncementCard({ ann, index, onOpen, uid }: { ann: Announcement; index: number; onOpen: () => void; uid: string | null }) {
  const type = inferType(ann);
  const cfg = TYPE_CONFIG[type];
  const TypeIcon = cfg.icon;
  const hasImage = !!ann.imageUrl;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${ann.title}\n\n${ann.message}`;
    if (navigator.share) {
      navigator.share({ title: ann.title, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] cursor-pointer w-full ${cfg.cardBg}`}
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={onOpen}
    >
      {/* Thumbnail strip if image exists */}
      {hasImage && (
        <div className="relative w-full overflow-hidden" style={{ height: "160px" }}>
          <img
            src={ann.imageUrl}
            alt={ann.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.55) 100%)" }}
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border ${cfg.chipBg} ${cfg.chipText}`}>
              <TypeIcon size={9} />
              {cfg.label}
            </span>
            {ann.isPinned && (
              <Pin size={11} className="text-white" fill="white" />
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        {/* Left icon — only when no image */}
        {!hasImage && (
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${cfg.iconBg}`}>
            <TypeIcon className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {!hasImage && (
            <div className="flex items-start justify-between gap-1.5 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border flex-shrink-0 ${cfg.chipBg} ${cfg.chipText}`}>
                <TypeIcon size={9} />
                {cfg.label}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                {ann.isPinned && (
                  <Pin size={11} className="text-blue-500 rotate-45" fill="currentColor" />
                )}
                <time className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">
                  {ann.createdAt ? timeAgo(ann.createdAt.seconds) : ""}
                </time>
              </div>
            </div>
          )}

          {hasImage && (
            <time className="text-[11px] text-muted-foreground font-medium block mb-1">
              {ann.createdAt ? timeAgo(ann.createdAt.seconds) : ""}
            </time>
          )}

          <h2 className="font-display font-bold text-foreground text-sm leading-snug mb-1 break-words line-clamp-2">
            {ann.title}
          </h2>

          <p className="text-muted-foreground text-xs leading-relaxed break-words line-clamp-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {ann.message}
          </p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 flex-shrink-0 ${
                type === "premium"
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/25 hover:bg-amber-500/20"
                  : "bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15"
              }`}
            >
              {cfg.actionLabel}
            </button>
            <button
              onClick={handleShare}
              className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title="Share"
            >
              <Share2 size={13} />
            </button>
          </div>
          <div className="mt-2">
            <AnnReactionRow annId={ann.id} uid={uid} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function Announcements() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Announcement | null>(null);

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user || !announcements.length) return;
    announcements.forEach((ann) => {
      setDoc(doc(db, "users", user.uid, "seenAnnouncements", ann.id), { seenAt: new Date() }, { merge: true })
        .catch(() => {});
    });
  }, [user, announcements]);

  const counts = {
    all: announcements.length,
    premium: announcements.filter((a) => inferType(a) === "premium").length,
    update:  announcements.filter((a) => inferType(a) === "update").length,
    lecture: announcements.filter((a) => inferType(a) === "lecture").length,
    notice:  announcements.filter((a) => inferType(a) === "notice").length,
  };

  const filtered = announcements.filter((ann) => {
    const matchType = activeFilter === "all" || inferType(ann) === activeFilter;
    const matchSearch = !search || ann.title.toLowerCase().includes(search.toLowerCase()) || ann.message.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const pinned = filtered.filter((a) => a.isPinned);
  const unpinned = filtered.filter((a) => !a.isPinned);
  const sorted = [...pinned, ...unpinned];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-10 overflow-x-hidden w-full">

        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pt-5 pb-4 group transition-colors"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </button>

        {/* Hero Banner */}
        <div
          className="relative rounded-3xl overflow-hidden mb-6 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #0a0f1e 0%, #0d1535 40%, #0a0e2a 70%, #100820 100%)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
            style={{ background: "radial-gradient(circle at 80% 20%, rgba(99,102,241,0.25) 0%, transparent 60%)" }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 pointer-events-none"
            style={{ background: "radial-gradient(circle at 20% 80%, rgba(6,182,212,0.15) 0%, transparent 60%)" }} />

          <div className="relative flex items-center gap-5 px-6 py-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center relative"
                style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(6,182,212,0.1) 100%)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  boxShadow: "0 0 30px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}>
                <Bell className="w-10 h-10 text-indigo-400" strokeWidth={1.5} />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"
                  style={{ boxShadow: "0 0 8px rgba(59,130,246,0.6)" }}>
                  <span className="text-[8px] font-black text-white">{counts.all}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white font-display tracking-tight mb-1">
                Announcements
              </h1>
              <p className="text-white/50 text-sm mb-4">Latest updates, notices and premium news</p>

              <div className="flex items-center gap-4 flex-wrap">
                {[
                  { icon: Bell, label: "Total", count: counts.all, color: "rgba(99,102,241,0.25)", border: "rgba(99,102,241,0.3)", text: "text-indigo-400" },
                  { icon: Megaphone, label: "Updates", count: counts.update, color: "rgba(6,182,212,0.25)", border: "rgba(6,182,212,0.3)", text: "text-cyan-400" },
                  { icon: Crown, label: "Premium", count: counts.premium, color: "rgba(245,158,11,0.25)", border: "rgba(245,158,11,0.3)", text: "text-amber-400" },
                ].map(({ icon: Icon, label, count, color, border, text }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: color, border: `1px solid ${border}` }}>
                      <Icon size={11} className={text} />
                    </div>
                    <div>
                      <p className="text-white font-black text-base leading-none">{count}</p>
                      <p className="text-white/40 text-[9px]">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search announcements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTER_TABS.map(({ value, label, icon: Icon }) => {
            const active = activeFilter === value;
            return (
              <button
                key={value}
                onClick={() => setActiveFilter(value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap transition-all flex-shrink-0 ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon size={11} />
                {label}
                {value !== "all" && counts[value] > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    active ? "bg-white/20" : "bg-secondary"
                  }`}>
                    {counts[value]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Announcement list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <Bell className="w-7 h-7 text-indigo-400/50" />
            </div>
            <p className="font-semibold text-foreground mb-1">
              {search ? "No results found" : "Nothing yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {search ? "Try a different search term" : "Your teachers will post updates here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((ann, i) => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                index={i}
                uid={user?.uid ?? null}
                onOpen={() => setSelected(ann)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen detail overlay */}
      {selected && (
        <AnnouncementDetail
          ann={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        @keyframes slideUpDetail {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (min-width: 768px) {
          @keyframes slideUpDetail {
            from { transform: scale(0.95) translateY(12px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
          }
        }
      `}</style>
    </Layout>
  );
}
