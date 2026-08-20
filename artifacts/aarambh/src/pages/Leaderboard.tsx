/**
 * Leaderboard — Premium redesign matching reference image
 * Podium top-3, period tabs, your stats, ranked list with YOU badge, insights
 */
import { useEffect, useState, useMemo, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useXP, levelColor, levelTitle } from "@/contexts/XPContext";
import { Layout } from "@/components/layout/Layout";
import { useLocation } from "wouter";
import {
  Trophy, Crown, Zap, Flame, TrendingUp,
  ChevronLeft, Target, Users, BarChart2, ChevronRight,
  X, Star, Award,
} from "lucide-react";

/* ─── Public Profile Modal ───────────────────────────────── */
function PublicProfileModal({ entry, rank, onClose }: { entry: LBEntry; rank: number; onClose: () => void }) {
  const color = levelColor(entry.level);
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const isTop3 = rank <= 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", animation: "fadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Header band with gradient */}
        <div
          className="relative h-24 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color}25, ${color}10)`,
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          {/* Rank badge */}
          {isTop3 && (
            <div
              className="absolute top-3 left-4 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
              style={{
                background: medalColors[rank - 1] + "20",
                border: `1.5px solid ${medalColors[rank - 1]}`,
                color: medalColors[rank - 1],
              }}
            >
              {rank}
            </div>
          )}
          {/* Crown for #1 */}
          {rank === 1 && (
            <Crown
              size={18}
              className="absolute top-2 left-1/2 -translate-x-1/2"
              style={{ color: "#FFD700", filter: "drop-shadow(0 0 8px #FFD70080)" }}
            />
          )}
          {/* Avatar */}
          <Av
            photo={entry.photoURL}
            name={entry.name}
            size={68}
            ring={isTop3 ? medalColors[rank - 1] : color}
          />
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.2)" }}
          >
            <X size={14} className="text-white/70" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <div className="text-center mb-4">
            <h2 className="text-lg font-black text-foreground">{entry.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
              <span
                className="text-xs font-black px-2.5 py-1 rounded-full"
                style={{ background: `${color}18`, color }}
              >
                Level {entry.level} — {levelTitle(entry.level)}
              </span>
              {entry.isPremium && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-1 rounded-full"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  <Star size={8} fill="currentColor" /> Premium
                </span>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: Trophy,  label: "Rank",       value: `#${rank}`,                          color: isTop3 ? medalColors[rank-1] : "#6366f1" },
              { icon: Zap,     label: "XP",          value: fmtXP(entry.xp),                    color: "#818cf8" },
              { icon: Flame,   label: "Streak",      value: `${entry.streak ?? 0}d`,             color: "#f97316" },
              { icon: Target,  label: "Avg Score",   value: `${Math.round(entry.avgScore ?? 0)}%`, color: "#10b981" },
              { icon: Users,   label: "Quizzes",     value: String(entry.totalQuizzes ?? 0),     color: "#8b5cf6" },
              { icon: Award,   label: "Level",       value: String(entry.level),                 color },
            ].map(({ icon: Icon, label, value, color: c }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 p-3 rounded-2xl"
                style={{ background: `${c}0c`, border: `1px solid ${c}20` }}
              >
                <Icon size={14} style={{ color: c }} />
                <p className="font-black text-sm text-foreground">{value}</p>
                <p className="text-[9px] text-muted-foreground text-center">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-muted-foreground border transition-all hover:text-foreground"
            style={{ border: "1px solid hsl(var(--border))" }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

/* ─── types ──────────────────────────────────────────────── */
interface LBEntry {
  uid: string;
  name: string;
  photoURL?: string | null;
  xp: number;
  level: number;
  streak?: number;
  totalQuizzes?: number;
  avgScore?: number;
  isPremium?: boolean;
  weekKey?: string;
  monthKey?: string;
}

type Period = "week" | "month" | "all";

/* ─── helpers ────────────────────────────────────────────── */
function getWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtXP(xp: number) {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return String(xp);
}

/* ─── Avatar ─────────────────────────────────────────────── */
function Av({ photo, name, size = 40, ring }: { photo?: string | null; name: string; size?: number; ring?: string }) {
  const initials = (name ?? "?").charAt(0).toUpperCase();
  const bg = ring ?? "#6366f1";
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center font-black text-white flex-shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${bg}, ${bg}99)`,
        boxShadow: ring ? `0 0 0 2.5px ${ring}, 0 0 12px ${ring}60` : undefined,
        fontSize: size * 0.38,
      }}
    >
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : initials}
    </div>
  );
}

/* ─── Podium ─────────────────────────────────────────────── */
function Podium({ top3, myUid }: { top3: LBEntry[]; myUid?: string }) {
  if (top3.length === 0) return null;
  const [first, second, third] = top3;
  // Order: 2nd, 1st, 3rd
  const order = [second, first, third].filter(Boolean) as LBEntry[];
  const podiumRanks = [2, 1, 3];
  const podiumHeights = [80, 110, 64];
  const medalColors = ["#C0C0C0", "#FFD700", "#CD7F32"];
  const medalOrder = [medalColors[1], medalColors[0], medalColors[2]];

  return (
    <div
      className="relative mx-4 mb-4 rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 100%)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.2) 0%, transparent 65%)" }} />

      {/* Crown for #1 */}
      <div className="flex justify-center pt-5 pb-1 relative z-10">
        <Crown size={22} style={{ color: "#FFD700", filter: "drop-shadow(0 0 10px #FFD70080)" }} />
      </div>

      {/* Podium figures */}
      <div className="flex items-end justify-center gap-2 px-6 relative z-10">
        {order.map((entry, idx) => {
          const rank = podiumRanks[idx];
          const medal = medalOrder[idx];
          const isFirst = rank === 1;
          const isMe = entry.uid === myUid;
          return (
            <div key={entry.uid} className="flex flex-col items-center" style={{ flex: isFirst ? "0 0 38%" : "0 0 28%" }}>
              <Av
                photo={entry.photoURL}
                name={entry.name}
                size={isFirst ? 60 : 46}
                ring={medal}
              />
              {isMe && (
                <span className="mt-1 text-[8px] font-black text-indigo-400 bg-indigo-400/15 px-1.5 py-0.5 rounded-full border border-indigo-400/30">
                  YOU
                </span>
              )}
              <p className="font-bold text-foreground text-[11px] mt-1.5 text-center truncate w-full" title={entry.name}>
                {entry.name.split(" ")[0]}
              </p>
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-lg leading-none"
                style={{ background: `${levelColor(entry.level)}18`, color: levelColor(entry.level) }}
              >
                LVL {entry.level}
              </span>
              <p className="text-[11px] font-black mt-0.5" style={{ color: medal }}>
                {fmtXP(entry.xp)} XP
              </p>
              {/* Podium cylinder */}
              <div
                className="w-full rounded-t-2xl mt-2 flex items-center justify-center font-black text-base"
                style={{
                  height: podiumHeights[idx],
                  background: `linear-gradient(to top, ${medal}25, ${medal}10)`,
                  border: `1.5px solid ${medal}40`,
                  boxShadow: `0 -4px 16px ${medal}30, inset 0 0 20px ${medal}08`,
                  color: medal,
                }}
              >
                {rank}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Student row ─────────────────────────────────────────── */
function StudentRow({ entry, rank, isMe, onClick }: { entry: LBEntry; rank: number; isMe: boolean; onClick?: () => void }) {
  const color = levelColor(entry.level);
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const isTop3 = rank <= 3;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0 transition-colors cursor-pointer hover:bg-secondary/30"
      style={isMe ? {
        background: "rgba(99,102,241,0.06)",
        borderLeft: "3px solid #6366f1",
      } : undefined}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 text-center font-black text-sm"
        style={{ color: isTop3 ? medalColors[rank - 1] : "hsl(var(--muted-foreground))" }}>
        {rank}
      </div>

      {/* Avatar */}
      <Av photo={entry.photoURL} name={entry.name} size={36} ring={isTop3 ? medalColors[rank - 1] : undefined} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-bold text-sm truncate ${isMe ? "text-indigo-400" : "text-foreground"}`}>
            {entry.name}
          </p>
          {isMe && (
            <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded-full border border-indigo-400/25 flex-shrink-0">
              YOU
            </span>
          )}
          {entry.isPremium && <Crown size={9} className="text-amber-500 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${color}18`, color }}>
            LVL {entry.level}
          </span>
          {(entry.totalQuizzes ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground">{entry.totalQuizzes} quizzes</span>
          )}
          {(entry.avgScore ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground">Avg {Math.round(entry.avgScore!)}%</span>
          )}
        </div>
      </div>

      {/* XP */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-black" style={{ color }}>
          {fmtXP(entry.xp)}
        </p>
        <p className="text-[9px] text-muted-foreground">XP</p>
      </div>
    </div>
  );
}

/* ─── Sparkline (mini chart) ──────────────────────────────── */
function Sparkline({ entries }: { entries: LBEntry[] }) {
  // Use XP values to draw a simple SVG line
  const top10 = entries.slice(0, Math.min(10, entries.length));
  if (top10.length < 2) return null;
  const maxXP = Math.max(...top10.map(e => e.xp), 1);
  const points = top10.map((e, i) => {
    const x = (i / (top10.length - 1)) * 260;
    const y = 60 - (e.xp / maxXP) * 50;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width="100%" height="70" viewBox="0 0 260 70" preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="lbGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="#818cf8"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px rgba(129,140,248,0.6))" }}
      />
      {/* Fill below line */}
      <polygon
        points={`0,60 ${points} 260,60`}
        fill="url(#lbGrad)"
        opacity="0.5"
      />
      {/* Last point dot (highest = current user if they're in top) */}
      <circle
        cx="260" cy={60 - (top10[top10.length - 1].xp / maxXP) * 50}
        r="4" fill="#818cf8"
        style={{ filter: "drop-shadow(0 0 6px rgba(129,140,248,0.8))" }}
      />
    </svg>
  );
}

/* ─── Main ────────────────────────────────────────────────── */
export default function Leaderboard() {
  const { user } = useAuth();
  const { xpData } = useXP();
  const [, navigate] = useLocation();
  const [entries, setEntries] = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [showAll, setShowAll] = useState(false);
  const [profileEntry, setProfileEntry] = useState<{ entry: LBEntry; rank: number } | null>(null);
  const myRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    let q;
    if (period === "week") {
      q = query(
        collection(db, "leaderboard"),
        where("weekKey", "==", getWeekKey()),
        orderBy("xp", "desc"),
        limit(100),
      );
    } else if (period === "month") {
      q = query(
        collection(db, "leaderboard"),
        where("monthKey", "==", getMonthKey()),
        orderBy("xp", "desc"),
        limit(100),
      );
    } else {
      q = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(100));
    }
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as LBEntry)));
      setLoading(false);
    }, () => {
      // Fallback without filters
      const fallback = query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(100));
      onSnapshot(fallback, (snap) => {
        setEntries(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as LBEntry)));
        setLoading(false);
      }, () => setLoading(false));
    });
    return unsub;
  }, [period]);

  const myRank = useMemo(() => entries.findIndex(e => e.uid === user?.uid) + 1, [entries, user?.uid]);
  const myEntry = useMemo(() => entries.find(e => e.uid === user?.uid), [entries, user?.uid]);
  const top3 = entries.slice(0, 3);
  const restShown = showAll ? entries.slice(3) : entries.slice(3, 7);
  const avgScoreAll = useMemo(() => {
    const valid = entries.filter(e => (e.avgScore ?? 0) > 0);
    return valid.length > 0 ? Math.round(valid.reduce((s, e) => s + (e.avgScore ?? 0), 0) / valid.length) : 0;
  }, [entries]);

  const PERIOD_TABS: { value: Period; label: string }[] = [
    { value: "week",  label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "all",   label: "All Time" },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto pb-10 w-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-400" />
                <h1 className="text-xl font-black text-foreground">Leaderboard</h1>
              </div>
              <p className="text-xs text-muted-foreground">Top performers this week</p>
            </div>
          </div>
        </div>

        {/* ── Period Tabs ── */}
        <div className="px-4 mb-5">
          <div className="flex gap-1.5 p-1 rounded-2xl bg-secondary/60 border border-border">
            {PERIOD_TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={period === value ? {
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
                } : { color: "hsl(var(--muted-foreground))" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 px-4">
            <Trophy size={36} className="text-muted-foreground/25 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">No rankings yet</p>
            <p className="text-sm text-muted-foreground">Complete quizzes to appear here</p>
          </div>
        ) : (
          <>
            {/* ── Top 3 Podium ── */}
            {top3.length >= 2 && <Podium top3={top3} myUid={user?.uid} />}

            {/* ── Your Stats Row ── */}
            {user && (
              <div className="mx-4 mb-4 grid grid-cols-4 gap-2">
                {[
                  { icon: Trophy,     label: "Your Rank",  value: myRank > 0 ? `#${myRank}` : "—",                   color: "#f59e0b" },
                  { icon: Zap,        label: "Your XP",    value: fmtXP(xpData?.xp ?? myEntry?.xp ?? 0),              color: "#818cf8" },
                  { icon: Target,     label: "Avg Score",  value: `${Math.round(xpData?.avgScore ?? myEntry?.avgScore ?? 0)}%`, color: "#10b981" },
                  { icon: Users,      label: "Quizzes",    value: String(xpData?.totalQuizzes ?? myEntry?.totalQuizzes ?? 0), color: "#f97316" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-2xl"
                    style={{
                      background: `${color}0d`,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <Icon size={14} style={{ color }} />
                    <p className="font-black text-sm text-foreground leading-none">{value}</p>
                    <p className="text-[9px] text-muted-foreground text-center leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Top Students List ── */}
            <div className="mx-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" />
                  <p className="text-sm font-black text-foreground">Top Students</p>
                </div>
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="flex items-center gap-1 text-xs font-bold"
                  style={{ color: "#818cf8" }}
                >
                  {showAll ? "Show less" : "View all"} <ChevronRight size={12} />
                </button>
              </div>

              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              >
                {/* Top 3 */}
                {entries.slice(0, 3).map((entry, i) => {
                  const rank = i + 1;
                  const isMe = entry.uid === user?.uid;
                  return (
                    <div key={entry.uid} ref={isMe ? myRowRef : undefined}>
                      <StudentRow entry={entry} rank={rank} isMe={isMe}
                        onClick={() => setProfileEntry({ entry, rank })} />
                    </div>
                  );
                })}
                {/* Rest */}
                {restShown.map((entry, i) => {
                  const rank = i + 4;
                  const isMe = entry.uid === user?.uid;
                  return (
                    <div key={entry.uid} ref={isMe ? myRowRef : undefined}>
                      <StudentRow entry={entry} rank={rank} isMe={isMe}
                        onClick={() => setProfileEntry({ entry, rank })} />
                    </div>
                  );
                })}
                {/* My rank if outside visible list */}
                {user && myRank > (showAll ? entries.length : 7) && myEntry && (
                  <div ref={myRowRef}
                    className="border-t-2 border-dashed border-indigo-400/30">
                    <StudentRow entry={myEntry} rank={myRank} isMe={true}
                      onClick={() => setProfileEntry({ entry: myEntry, rank: myRank })} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Jump to my rank ── */}
            {user && myRank > 7 && (
              <div className="mx-4 mb-4">
                <button
                  onClick={() => myRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="w-full py-2.5 rounded-xl text-xs font-bold border transition-all"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    borderColor: "rgba(99,102,241,0.25)",
                    color: "#818cf8",
                  }}
                >
                  Jump to my rank (#{myRank})
                </button>
              </div>
            )}

            {/* ── Leaderboard Insights ── */}
            <div className="mx-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={14} className="text-indigo-400" />
                <p className="text-sm font-black text-foreground">Leaderboard Insights</p>
              </div>

              {/* Sparkline chart */}
              <div
                className="rounded-2xl p-4 mb-3"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-semibold">XP Distribution</p>
                  {myEntry && (
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: "#818cf825", color: "#818cf8" }}
                    >
                      {fmtXP(myEntry.xp)} XP — You
                    </span>
                  )}
                </div>
                <Sparkline entries={entries} />
                {/* X-axis labels */}
                <div className="flex justify-between mt-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                    <span key={d} className="text-[9px] text-muted-foreground/60">{d}</span>
                  ))}
                </div>
              </div>

              {/* Top XP + Avg Score cards */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
                      <Trophy size={13} className="text-indigo-400" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top XP</p>
                  </div>
                  <p className="text-xl font-black text-foreground">{fmtXP(entries[0]?.xp ?? 0)} XP</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{entries[0]?.name ?? "—"}</p>
                </div>
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                      <TrendingUp size={13} className="text-emerald-400" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg Score</p>
                  </div>
                  <p className="text-xl font-black text-emerald-400">{avgScoreAll}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">across all students</p>
                </div>
              </div>
            </div>

            {/* Streak info */}
            {myEntry && (myEntry.streak ?? 0) > 0 && (
              <div className="mx-4 mb-4 flex items-center gap-2 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <Flame size={16} className="text-orange-400" fill="currentColor" />
                <p className="text-sm font-bold text-foreground">
                  You have a <span className="text-orange-400">{myEntry.streak}-day</span> streak! Keep going!
                </p>
              </div>
            )}
          </>
        )}

        <div className="h-8" />
      </div>

      {/* Public Profile Modal */}
      {profileEntry && (
        <PublicProfileModal
          entry={profileEntry.entry}
          rank={profileEntry.rank}
          onClose={() => setProfileEntry(null)}
        />
      )}
    </Layout>
  );
}
