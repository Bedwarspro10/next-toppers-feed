import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  collection, getDocs, query, orderBy, limit, onSnapshot, where, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { useSubjectPopup } from "@/contexts/SubjectPopupContext";
import { TopBanner } from "@/components/BannerSystem";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell, ArrowRight, Crown, Sparkles, Shield, Clock, Calendar,
  Sigma, FlaskConical, Globe, Languages, BookOpen, ChevronRight,
  Video, Play, History, Search, X, FileQuestion, Zap, Flame, Trophy, Monitor, Brain,
} from "lucide-react";

interface RecentLecture { id: string; title: string; subject: string; thumbnail?: string; category?: string; }
interface CWItem { lectureId: string; title: string; hlsUrl: string; subject: string; progress: number; lastWatched: number; }

function getCWList(): CWItem[] {
  try { return JSON.parse(localStorage.getItem("nt_cw_list") ?? "[]"); } catch { return []; }
}

interface Announcement {
  id: string; title: string; message: string;
  createdAt: { seconds: number };
}

const SUBJECTS = [
  {
    id: "maths", label: "Maths", sub: "Tap to explore", icon: Sigma,
    gradient: "from-blue-500 to-blue-600",
    text: "text-blue-600 dark:text-blue-400",
    arrowBorder: "border-blue-200 dark:border-blue-800",
    arrowText: "text-blue-500",
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    border: "border-blue-100 dark:border-blue-900/30",
  },
  {
    id: "science", label: "Science", sub: "Tap to explore", icon: FlaskConical,
    gradient: "from-emerald-500 to-teal-500",
    text: "text-emerald-600 dark:text-emerald-400",
    arrowBorder: "border-emerald-200 dark:border-emerald-800",
    arrowText: "text-emerald-500",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    border: "border-emerald-100 dark:border-emerald-900/30",
  },
  {
    id: "sst", label: "SST", sub: "Tap to explore", icon: Globe,
    gradient: "from-violet-500 to-purple-600",
    text: "text-violet-600 dark:text-violet-400",
    arrowBorder: "border-violet-200 dark:border-violet-800",
    arrowText: "text-violet-500",
    bg: "bg-violet-50/50 dark:bg-violet-950/20",
    border: "border-violet-100 dark:border-violet-900/30",
  },
  {
    id: "english", label: "English", sub: "Tap to explore", icon: BookOpen,
    gradient: "from-amber-500 to-orange-500",
    text: "text-amber-600 dark:text-amber-400",
    arrowBorder: "border-amber-200 dark:border-amber-800",
    arrowText: "text-amber-500",
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    border: "border-amber-100 dark:border-amber-900/30",
  },
  {
    id: "hindi", label: "Hindi", sub: "Tap to explore", icon: Languages,
    gradient: "from-rose-500 to-pink-500",
    text: "text-rose-600 dark:text-rose-400",
    arrowBorder: "border-rose-200 dark:border-rose-800",
    arrowText: "text-rose-500",
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    border: "border-rose-100 dark:border-rose-900/30",
  },
  {
    id: "it", label: "Info & Tech", sub: "Tap to explore", icon: Monitor,
    gradient: "from-cyan-500 to-sky-600",
    text: "text-cyan-600 dark:text-cyan-400",
    arrowBorder: "border-cyan-200 dark:border-cyan-800",
    arrowText: "text-cyan-500",
    bg: "bg-cyan-50/50 dark:bg-cyan-950/20",
    border: "border-cyan-100 dark:border-cyan-900/30",
  },
  {
    id: "ai", label: "AI", sub: "Tap to explore", icon: Brain,
    gradient: "from-indigo-500 to-violet-600",
    text: "text-indigo-600 dark:text-indigo-400",
    arrowBorder: "border-indigo-200 dark:border-indigo-800",
    arrowText: "text-indigo-500",
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    border: "border-indigo-100 dark:border-indigo-900/30",
  },
];

function timeAgo(seconds: number) {
  const d = Math.floor(Date.now() / 1000) - seconds;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

/* ── Premium Crown Illustration ── */
function CrownIllustration() {
  return (
    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 100, height: 90 }}>
      <svg viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 100, height: 90 }}>
        <defs>
          <radialGradient id="crownGlow" cx="50%" cy="60%" r="50%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.3)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="75" rx="38" ry="8" fill="url(#crownGlow)" />
        <polygon points="10,65 22,30 35,50 50,18 65,50 78,30 90,65" fill="url(#crown-grad)" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
        <defs>
          <linearGradient id="crown-grad" x1="50" y1="18" x2="50" y2="65" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="18" r="5" fill="#fbbf24" />
        <circle cx="10" cy="65" r="4" fill="#f59e0b" />
        <circle cx="90" cy="65" r="4" fill="#f59e0b" />
        <circle cx="38" cy="53" r="3.5" fill="#c084fc" stroke="#a855f7" strokeWidth="1" />
        <circle cx="62" cy="53" r="3.5" fill="#60a5fa" stroke="#3b82f6" strokeWidth="1" />
        <circle cx="50" cy="40" r="3.5" fill="#34d399" stroke="#10b981" strokeWidth="1" />
        <rect x="10" y="65" width="80" height="10" rx="4" fill="#b45309" />
        <rect x="10" y="65" width="80" height="5" rx="2" fill="#d97706" />
      </svg>
    </div>
  );
}

interface BoardExamConfig {
  enabled: boolean;
  examName: string;
  targetDate: string; /* ISO string e.g. "2026-03-15" */
  message: string;
}

/* ── Day Streak + Exam Countdown widget ── */
function StatsRibbon() {
  const [dayStreak, setDayStreak] = useState(0);
  const [boardConfig, setBoardConfig] = useState<BoardExamConfig | null>(null);

  useEffect(() => {
    try {
      const lastDate = localStorage.getItem("nt_last_active") ?? "";
      const streak = parseInt(localStorage.getItem("nt_day_streak") ?? "0", 10);
      const today = new Date().toDateString();
      if (lastDate !== today) {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const newStreak = lastDate === yesterday.toDateString() ? streak + 1 : 1;
        localStorage.setItem("nt_day_streak", String(newStreak));
        localStorage.setItem("nt_last_active", today);
        setDayStreak(newStreak);
      } else {
        setDayStreak(streak);
      }
    } catch { setDayStreak(1); }
  }, []);

  /* Live Firestore board exam config */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettings", "boardExam"), (snap) => {
      if (snap.exists()) setBoardConfig(snap.data() as BoardExamConfig);
      else setBoardConfig(null);
    }, () => setBoardConfig(null));
    return unsub;
  }, []);

  /* Calculate days to board exam */
  let daysToExam = 0;
  let examLabel = "days left";
  if (boardConfig?.enabled && boardConfig.targetDate) {
    const examDate = new Date(boardConfig.targetDate + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    daysToExam = Math.ceil((examDate.getTime() - today.getTime()) / 86400000);
    if (daysToExam < 0) examLabel = "exam over";
    else if (daysToExam === 0) examLabel = "Boards Today!";
    else examLabel = "days left";
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Day Streak */}
      <div className="rounded-2xl border overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #431407 0%, #7c2d12 50%, #431407 100%)",
          borderColor: "rgba(234,88,12,0.35)",
          boxShadow: "0 4px 20px rgba(234,88,12,0.15)",
        }}>
        <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
          style={{ background: "radial-gradient(circle at 80% 20%, rgba(251,146,60,0.3) 0%, transparent 65%)" }} />
        <div className="relative px-4 py-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={14} className="text-orange-400" fill="currentColor" />
            <span className="text-[10px] font-black tracking-widest text-orange-400/80 uppercase">Day Streak</span>
          </div>
          <p className="text-3xl font-black text-white leading-none mb-1">{dayStreak}</p>
          <p className="text-[10px] text-orange-200/60 font-medium">
            {dayStreak === 0 ? "Start today!" : dayStreak === 1 ? "Keep going!" : `${dayStreak} days strong`}
          </p>
        </div>
      </div>

      {/* Exam Countdown */}
      {boardConfig?.enabled ? (
        <div className="rounded-2xl border overflow-hidden relative"
          style={{
            background: daysToExam === 0
              ? "linear-gradient(135deg, #1a0520 0%, #3b0764 100%)"
              : "linear-gradient(135deg, #0c1a4f 0%, #1e3a8a 50%, #0c1a4f 100%)",
            borderColor: daysToExam === 0 ? "rgba(168,85,247,0.4)" : "rgba(59,130,246,0.35)",
            boxShadow: daysToExam === 0 ? "0 4px 20px rgba(168,85,247,0.2)" : "0 4px 20px rgba(59,130,246,0.12)",
          }}>
          <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
            style={{ background: "radial-gradient(circle at 80% 20%, rgba(96,165,250,0.25) 0%, transparent 65%)" }} />
          <div className="relative px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy size={14} className={daysToExam === 0 ? "text-purple-400" : "text-blue-400"} />
              <span className={`text-[10px] font-black tracking-widest uppercase truncate ${daysToExam === 0 ? "text-purple-400/80" : "text-blue-400/80"}`}>
                {boardConfig.examName || "Board Exam"}
              </span>
            </div>
            <p className="text-3xl font-black text-white leading-none mb-1">
              {daysToExam < 0 ? "Done" : daysToExam}
            </p>
            <p className={`text-[10px] font-medium ${daysToExam === 0 ? "text-purple-200/70" : "text-blue-200/60"}`}>
              {boardConfig.message || examLabel}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, #0c1a4f 0%, #1e3a8a 50%, #0c1a4f 100%)",
            borderColor: "rgba(59,130,246,0.35)",
            boxShadow: "0 4px 20px rgba(59,130,246,0.12)",
          }}>
          <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
            style={{ background: "radial-gradient(circle at 80% 20%, rgba(96,165,250,0.25) 0%, transparent 65%)" }} />
          <div className="relative px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy size={14} className="text-blue-400" />
              <span className="text-[10px] font-black tracking-widest text-blue-400/80 uppercase">Board Exam</span>
            </div>
            <p className="text-3xl font-black text-white leading-none mb-1">—</p>
            <p className="text-[10px] text-blue-200/40 font-medium">coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { isPremium, plan: memberPlan, startTime, expiryTime } = usePremium();
  const { setOpen: openPremium } = usePremiumModal();
  const { requestNavigation } = useSubjectPopup();
  const [, navigate] = useLocation();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnn, setLoadingAnn] = useState(true);
  const [recentLectures, setRecentLectures] = useState<RecentLecture[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [continueWatching, setContinueWatching] = useState<CWItem[]>([]);
  void startTime;

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(3));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
      setLoadingAnn(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, "lectures"), where("isPremium", "==", false), orderBy("createdAt", "desc"), limit(8)))
      .then((snap) => {
        setRecentLectures(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecentLecture)));
        setLoadingRecent(false);
      }).catch(() => { setLoadingRecent(false); });
  }, []);

  useEffect(() => {
    setContinueWatching(getCWList().slice(0, 5));
  }, []);

  const daysLeft = expiryTime
    ? Math.max(0, Math.ceil((expiryTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const annColors = [
    { badge: "bg-emerald-500", label: "New" },
    { badge: "bg-blue-500",    label: "Update" },
    { badge: "bg-violet-500",  label: "Info" },
  ];

  const [searchQ, setSearchQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQ.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* ── SEARCH BAR ── */}
        <section>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search size={16} className="text-muted-foreground" />
            </div>
            <input
              ref={searchRef}
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Search lectures, notes, DPP, announcements…"
              className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm text-foreground placeholder-muted-foreground outline-none transition-all"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            {searchQ ? (
              <button
                onClick={() => setSearchQ("")}
                className="absolute inset-y-0 right-3 flex items-center justify-center w-8">
                <X size={14} className="text-muted-foreground" />
              </button>
            ) : (
              <button
                onClick={() => navigate(`/search`)}
                className="absolute inset-y-0 right-3 flex items-center justify-center w-8">
                <ArrowRight size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
          {searchQ.trim() && (
            <button
              onClick={() => navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`)}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-primary"
              style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
              <Search size={14} /> Search for "{searchQ}"
            </button>
          )}
        </section>

        {/* ── TOP BANNER ── */}
        <TopBanner />

        {/* ── DAY STREAK + EXAM COUNTDOWN ── */}
        {user && <StatsRibbon />}

        {/* ── SUBJECTS GRID ── */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.id}
                  onClick={() => requestNavigation(s.id, `/subjects/${s.id}`)}
                  className={`flex items-center gap-3 px-3.5 py-3.5 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${s.bg} ${s.border}`}>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${s.text}`}>{s.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                  </div>
                  <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 ${s.arrowBorder}`}>
                    <ChevronRight size={13} className={s.arrowText} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PRACTICE TESTS CARD ── */}
        <section>
          <div
            className="relative rounded-2xl overflow-hidden cursor-pointer group"
            onClick={() => navigate("/tests")}
            style={{
              background: "linear-gradient(135deg, #0f0c2e 0%, #1a0840 50%, #0c0a24 100%)",
              border: "1px solid rgba(99,102,241,0.25)",
              boxShadow: "0 4px 24px rgba(99,102,241,0.12)",
            }}
          >
            {/* Glow effects */}
            <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
              style={{ background: "radial-gradient(circle at 80% 20%, rgba(99,102,241,0.2) 0%, transparent 60%)" }} />
            <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none"
              style={{ background: "radial-gradient(circle at 20% 90%, rgba(168,85,247,0.15) 0%, transparent 60%)" }} />
            {/* Stars */}
            {[{ top: "20%", left: "6%" }, { top: "60%", left: "14%" }, { top: "25%", right: "28%" }].map((s, i) => (
              <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/20 pointer-events-none" style={s as React.CSSProperties} />
            ))}
            <div className="relative px-5 py-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
                <FileQuestion size={26} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-white font-black text-base">Practice Tests</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
                    style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
                    NEW
                  </span>
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Quizzes, mocks & chapter tests
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 transition-transform"
                style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}>
                <ChevronRight size={16} className="text-indigo-400" />
              </div>
            </div>
          </div>
        </section>

        {/* ── PREMIUM MEMBERSHIP CARD (premium users) ── */}
        {isPremium && (
          <section>
            <div className="relative rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #0f1623 0%, #0d1b3e 50%, #0a1628 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(251,191,36,0.15)",
              }}>
              {/* Background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                style={{ background: "radial-gradient(circle at 70% 20%, rgba(251,191,36,0.12) 0%, transparent 60%)" }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 pointer-events-none"
                style={{ background: "radial-gradient(circle at 20% 80%, rgba(139,92,246,0.1) 0%, transparent 60%)" }} />
              {/* Stars */}
              {[{ top: "15%", left: "8%" }, { top: "40%", left: "18%" }, { top: "70%", left: "10%" }, { top: "20%", right: "35%" }].map((s, i) => (
                <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/30 pointer-events-none"
                  style={s as React.CSSProperties} />
              ))}

              <div className="relative px-5 py-5 flex items-start gap-4">
                {/* Left content */}
                <div className="flex-1 min-w-0">
                  {/* Icon + title */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.4)" }}>
                      <Crown size={22} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-bold text-base">Premium Member</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold tracking-wider uppercase">
                          ACTIVE
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Plan info row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-white/60">
                      <Shield size={11} className="text-amber-400" />
                      <span>{memberPlan === "day" ? "Daily Plan" : "Monthly Plan"}</span>
                    </div>
                    {daysLeft !== null && (
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                        daysLeft === 0 ? "text-red-400" : daysLeft <= 3 ? "text-orange-400" : "text-amber-300"
                      }`}>
                        <Clock size={11} />
                        <span>{daysLeft === 0 ? "Expires today" : `${daysLeft} days left`}</span>
                      </div>
                    )}
                    {expiryTime && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <Calendar size={11} />
                        <span>Until {expiryTime.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                    )}
                  </div>

                  {/* Subjects chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] text-white/40 font-medium">Your premium subjects:</p>
                    {[
                      { label: "Maths",   href: "/subjects/maths",   icon: "✦" },
                      { label: "Science", href: "/subjects/science", icon: "✦" },
                      { label: "SST",     href: "/subjects/sst",     icon: "✦" },
                    ].map(({ label, href }) => (
                      <Link key={label} href={href}>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:brightness-110"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
                          {label}
                        </span>
                      </Link>
                    ))}
                  </div>

                  {/* Renew button if expiring soon */}
                  {daysLeft !== null && daysLeft <= 3 && (
                    <button onClick={() => openPremium(true)}
                      className="mt-3 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", boxShadow: "0 4px 12px rgba(245,158,11,0.4)" }}>
                      <Crown size={11} /> Renew Now
                    </button>
                  )}
                </div>

                {/* Crown illustration */}
                <CrownIllustration />
              </div>
            </div>
          </section>
        )}

        {/* ── PREMIUM CTA (non-premium users) ── */}
        {!isPremium && (
          <section>
            <div className="relative rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #0f1623 0%, #0d1b3e 55%, #0a1628 100%)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              }}>
              {/* Glow effects */}
              <div className="absolute top-0 right-0 w-72 h-72 pointer-events-none"
                style={{ background: "radial-gradient(circle at 75% 25%, rgba(99,102,241,0.18) 0%, transparent 60%)" }} />
              <div className="absolute bottom-0 left-0 w-56 h-56 pointer-events-none"
                style={{ background: "radial-gradient(circle at 20% 80%, rgba(37,99,235,0.12) 0%, transparent 60%)" }} />
              {/* Stars */}
              {[{ top: "12%", left: "5%" }, { top: "35%", left: "15%" }, { top: "65%", left: "8%" }, { top: "18%", right: "30%" }, { top: "75%", right: "25%" }].map((s, i) => (
                <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/25 pointer-events-none" style={s as React.CSSProperties} />
              ))}

              <div className="relative px-5 py-5">
                {/* Top row: icon + price badge + illustration */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                      style={{ background: "linear-gradient(135deg, #b45309, #92400e)", boxShadow: "0 4px 16px rgba(180,83,9,0.4)" }}>
                      <Crown size={22} className="text-amber-300" />
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                      style={{ background: "rgba(180,83,9,0.4)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
                      FROM ₹3
                    </span>
                  </div>
                  <CrownIllustration />
                </div>

                {/* Heading */}
                <h3 className="text-xl font-bold text-white leading-tight mb-1.5">
                  Unlock{" "}
                  <span style={{ background: "linear-gradient(90deg, #fbbf24, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    Premium
                  </span>
                  {" "}Lectures
                </h3>
                <p className="text-white/55 text-sm mb-3 leading-relaxed">
                  Access exclusive 2025–26 Science, Maths &amp; SST lectures — <span className="text-amber-300 font-semibold">₹3/day</span> or <span className="text-amber-300 font-semibold">₹39/month</span>.
                </p>

                {/* Subject chips */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {[
                    { label: "Science Lectures", icon: FlaskConical },
                    { label: "Maths Lectures",   icon: Sigma },
                    { label: "SST Lectures",     icon: Globe },
                  ].map(({ label, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)" }}>
                      <Icon size={11} />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Bottom row: CTA + trust badge */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => openPremium(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #f97316)",
                      boxShadow: "0 6px 20px rgba(245,158,11,0.4)",
                    }}>
                    <Crown size={14} /> Upgrade Now →
                  </button>
                  <div className="flex items-center gap-1.5 text-xs"
                    style={{ color: "rgba(255,255,255,0.45)" }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)" }}>
                      <Shield size={9} className="text-emerald-400" />
                    </div>
                    <span>Safe · Secure · Trusted</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── CONTINUE WATCHING ── */}
        {continueWatching.length > 0 && (
          <section>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
                <History size={14} className="text-blue-500" />
              </div>
              <h2 className="text-base font-bold text-foreground">Continue Watching</h2>
            </div>
            <div className="space-y-2">
              {continueWatching.map((cw) => (
                <div key={cw.lectureId}
                  className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/subjects/${cw.subject}`)}>
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
                    <Video size={15} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{cw.title}</p>
                    <div className="w-full bg-muted rounded-full h-1 mt-1.5">
                      <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${Math.round(cw.progress * 100)}%` }} />
                    </div>
                  </div>
                  <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold flex-shrink-0 hover:bg-primary/15 transition-colors">
                    <Play size={10} /> Resume
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── RECENTLY ADDED LECTURES ── */}
        {(loadingRecent || recentLectures.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center border border-violet-100 dark:border-violet-900/40">
                  <Video size={14} className="text-violet-500" />
                </div>
                <h2 className="text-base font-bold text-foreground">Recently Added</h2>
              </div>
              <Link href="/subjects">
                <span className="text-sm text-blue-500 font-semibold flex items-center gap-1 hover:gap-2 transition-all cursor-pointer">
                  View all <ArrowRight size={13} />
                </span>
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {loadingRecent
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[88px] w-[160px] flex-shrink-0 rounded-xl" />)
                : recentLectures.map((lect) => (
                  <Link key={lect.id} href={`/subjects/${lect.subject}`}>
                    <div className="flex-shrink-0 w-[160px] bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group">
                      <div className="relative h-[80px] bg-gradient-to-br from-violet-500/10 to-blue-500/10 flex items-center justify-center overflow-hidden">
                        {lect.thumbnail
                          ? <img src={lect.thumbnail} alt="" className="w-full h-full object-cover" />
                          : <Video size={24} className="text-violet-400/50" />}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                            <Play size={12} className="text-violet-600 ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="font-semibold text-[11px] text-foreground leading-tight line-clamp-2">{lect.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{lect.subject}</p>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        )}

        {/* ── ANNOUNCEMENTS ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
                <Bell size={14} className="text-blue-500" />
              </div>
              <h2 className="text-base font-bold text-foreground">Latest Announcements</h2>
            </div>
            <Link href="/announcements">
              <span className="text-sm text-blue-500 font-semibold flex items-center gap-1 hover:gap-2 transition-all cursor-pointer">
                View all <ArrowRight size={13} />
              </span>
            </Link>
          </div>
          <div className="space-y-2.5">
            {loadingAnn
              ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)
              : announcements.length === 0
                ? (
                  <div className="bg-card border border-border rounded-2xl px-6 py-10 text-center">
                    <Bell size={28} className="text-muted-foreground/25 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No announcements yet — check back soon.</p>
                  </div>
                )
                : announcements.map((ann, i) => {
                  const c = annColors[i % annColors.length];
                  return (
                    <div key={ann.id}
                      className="bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 cursor-default">
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 ${c.badge} rounded-lg px-2 py-0.5 text-white text-[9px] font-bold tracking-wide mt-0.5`}>
                          {c.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground leading-tight">{ann.title}</p>
                          <p className="text-muted-foreground text-[13px] mt-0.5 line-clamp-1 leading-relaxed">{ann.message}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 flex-shrink-0">
                          {ann.createdAt ? timeAgo(ann.createdAt.seconds) : ""}
                        </span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </section>

        {/* ── QUICK LINKS ── */}
        <section>
          <h2 className="text-base font-bold text-foreground mb-3">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/subjects",      icon: BookOpen,   label: "Study Materials",  desc: "Notes, PDFs & DPPs",   color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/50",   border: "border-blue-100 dark:border-blue-900/40" },
              { href: "/youtube",       icon: Globe,      label: "Video Lectures",   desc: "Watch & learn",         color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-950/50",     border: "border-red-100 dark:border-red-900/40" },
              { href: "/announcements", icon: Bell,       label: "Announcements",    desc: "Latest updates",        color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/50", border: "border-violet-100 dark:border-violet-900/40" },
              { href: "/chat",          icon: Sparkles,   label: "Community Chat",   desc: "Join the discussion",   color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-100 dark:border-amber-900/40" },
            ].map(({ href, icon: Icon, label, desc, color, bg, border }) => (
              <Link key={`${href}-${label}`} href={href}>
                <div className={`bg-card border ${border} rounded-2xl p-4 flex flex-col gap-3 cursor-pointer group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </Layout>
  );
}
