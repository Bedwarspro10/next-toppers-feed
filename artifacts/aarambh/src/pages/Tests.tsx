/**
 * Practice Tests — Premium redesign matching reference image
 * Subject filter chips, stats row, premium test cards with ratings, motivational bottom card
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useXP } from "@/contexts/XPContext";
import { Layout } from "@/components/layout/Layout";
import { ContentRating } from "@/components/ContentRating";
import {
  BookOpen, FlaskConical, Globe, Sigma, Languages,
  Clock, FileQuestion, Star, Lock, ChevronRight,
  Loader2, AlertCircle, Trophy, Award, TrendingUp,
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────── */
export interface TestDoc {
  id: string;
  title: string;
  subject: string;
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  active: boolean;
  isPremium: boolean;
  difficulty?: "easy" | "medium" | "hard" | "nightmare";
  createdAt?: { seconds: number };
}

/* ─── constants ──────────────────────────────────────────── */
const SUBJECTS = [
  { id: "all",     label: "All Subjects", icon: BookOpen,     color: "#6366f1",  bg: "rgba(99,102,241,0.1)" },
  { id: "maths",   label: "Maths",        icon: Sigma,        color: "#3b82f6",  bg: "rgba(59,130,246,0.1)" },
  { id: "science", label: "Science",      icon: FlaskConical, color: "#10b981",  bg: "rgba(16,185,129,0.1)" },
  { id: "sst",     label: "SST",          icon: Globe,        color: "#8b5cf6",  bg: "rgba(139,92,246,0.1)" },
  { id: "english", label: "English",      icon: BookOpen,     color: "#f59e0b",  bg: "rgba(245,158,11,0.1)" },
  { id: "hindi",   label: "Hindi",        icon: Languages,    color: "#ef4444",  bg: "rgba(239,68,68,0.1)" },
];

const SUBJECT_COLOR: Record<string, string> = {
  maths: "#3b82f6", science: "#10b981", sst: "#8b5cf6",
  english: "#f59e0b", hindi: "#ef4444",
};

const DIFFICULTY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  easy:      { label: "Easy",      color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  medium:    { label: "Medium",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  hard:      { label: "Hard",      color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  nightmare: { label: "Nightmare", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}m` : ""}`;
}

/* ─── Subject Icon ───────────────────────────────────────── */
function SubjectIcon({ subject }: { subject: string }) {
  const color = SUBJECT_COLOR[subject] ?? "#6b7280";
  const IconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    maths: Sigma, science: FlaskConical, sst: Globe,
    english: BookOpen, hindi: Languages,
  };
  const Icon = IconMap[subject] ?? FileQuestion;
  return (
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        background: `${color}15`,
        border: `1.5px solid ${color}30`,
      }}
    >
      <span style={{ color }}><Icon size={22} /></span>
    </div>
  );
}

/* ─── Test Card ──────────────────────────────────────────── */
function TestCard({
  test, onStart, locked,
}: {
  test: TestDoc;
  onStart: () => void;
  locked: boolean;
}) {
  const color = SUBJECT_COLOR[test.subject] ?? "#6366f1";
  const diff = test.difficulty ? DIFFICULTY_STYLE[test.difficulty] : null;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "hsl(var(--card))",
        border: `1px solid hsl(var(--border))`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Left accent bar + content */}
      <div className="flex items-stretch">
        {/* Colored left bar */}
        <div
          className="w-1 flex-shrink-0 rounded-l-2xl"
          style={{ background: `linear-gradient(to bottom, ${color}, ${color}80)` }}
        />

        <div className="flex-1 p-4">
          {/* Top row: subject label + icon */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              {/* Subject label */}
              <p className="text-[11px] font-black mb-1.5 capitalize" style={{ color }}>
                {test.subject.charAt(0).toUpperCase() + test.subject.slice(1)}
              </p>
              {/* Title */}
              <h3 className="font-black text-foreground text-sm leading-snug mb-2">{test.title}</h3>

              {/* Meta row */}
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <FileQuestion size={10} className="flex-shrink-0" />
                  {test.totalQuestions} Questions
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock size={10} className="flex-shrink-0" />
                  {fmtDuration(test.duration)}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star size={10} className="flex-shrink-0" />
                  {test.totalMarks} Marks
                </span>
              </div>

              {/* Rating + difficulty */}
              <div className="flex items-center gap-2 flex-wrap">
                <ContentRating
                  contentId={test.id}
                  contentType="test"
                  compact
                />
                {diff && (
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ color: diff.color, background: diff.bg }}
                  >
                    {diff.label}
                  </span>
                )}
                {test.isPremium && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                  >
                    <Star size={7} fill="currentColor" /> PREMIUM
                  </span>
                )}
              </div>
            </div>

            {/* Subject icon on the right */}
            <SubjectIcon subject={test.subject} />
          </div>

          {/* Start Test button */}
          {locked ? (
            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold opacity-60 cursor-not-allowed"
              style={{
                background: "hsl(var(--secondary))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <Lock size={12} />
              Upgrade to Premium
            </div>
          ) : (
            <button
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
              }}
            >
              Start Test
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function Tests() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { xpData } = useXP();
  const [tests, setTests] = useState<TestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("all");
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);

  /* Fetch tests */
  useEffect(() => {
    setLoading(true);
    const baseConditions = [where("active", "==", true)];
    const conditions = subject !== "all"
      ? [...baseConditions, where("subject", "==", subject)]
      : baseConditions;

    const tryQuery = (withOrder: boolean) => {
      const q = withOrder
        ? query(collection(db, "tests"), ...conditions, orderBy("createdAt", "desc"))
        : query(collection(db, "tests"), ...conditions);
      return onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestDoc));
        setTests(withOrder ? docs : docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)));
        setLoading(false);
      }, withOrder ? () => {
        tryQuery(false);
      } : () => setLoading(false));
    };
    return tryQuery(true);
  }, [subject]);

  /* Fetch leaderboard rank */
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, "leaderboard"), orderBy("xp", "desc"), limit(200)),
      (snap) => {
        const idx = snap.docs.findIndex(d => d.id === user.uid);
        setLeaderboardRank(idx >= 0 ? idx + 1 : null);
      },
      () => {},
    );
    return unsub;
  }, [user]);

  const handleStartTest = (test: TestDoc) => {
    if (test.isPremium && !isPremium) return;
    navigate(`/tests/${test.id}`);
  };

  /* Stats */
  const statsRow = [
    {
      label: "Tests Attempted",
      value: xpData?.totalQuizzes ?? 0,
      icon: FileQuestion,
      color: "#6366f1",
    },
    {
      label: "Avg. Score",
      value: xpData?.avgScore ? `${Math.round(xpData.avgScore)}%` : "—",
      icon: TrendingUp,
      color: "#10b981",
    },
    {
      label: "Best Score",
      value: "—",
      icon: Award,
      color: "#f59e0b",
    },
    {
      label: "Rank",
      value: leaderboardRank ? `#${leaderboardRank}` : "—",
      icon: Trophy,
      color: "#f97316",
    },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 w-full">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.12))",
              border: "1.5px solid rgba(99,102,241,0.3)",
              boxShadow: "0 0 16px rgba(99,102,241,0.15)",
            }}
          >
            <FileQuestion size={22} className="text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground leading-tight">Practice Tests</h1>
            <p className="text-xs text-muted-foreground">Subject-wise mock tests &amp; quizzes</p>
          </div>
          {user && (
            <button
              onClick={() => navigate("/test-history")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}
            >
              <Trophy size={11} /> History
            </button>
          )}
        </div>

        {/* ── Subject filter chips ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: "none" }}>
          {SUBJECTS.map((s) => {
            const Icon = s.icon;
            const active = subject === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSubject(s.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-all"
                style={active ? {
                  background: s.color,
                  color: "white",
                  boxShadow: `0 4px 12px ${s.color}40`,
                } : {
                  background: "hsl(var(--secondary))",
                  color: "hsl(var(--muted-foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Icon size={11} /> {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Stats Row ── */}
        {user && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            {statsRow.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl"
                style={{
                  background: "hsl(var(--card))",
                  border: `1px solid ${color}20`,
                }}
              >
                <Icon size={14} style={{ color }} />
                <p className="font-black text-sm text-foreground leading-none">{value}</p>
                <p className="text-[9px] text-muted-foreground text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── All Tests header ── */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-black text-foreground">All Tests</p>
          <button className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Sort <ChevronRight size={12} />
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
            >
              <AlertCircle size={28} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground mb-1">No tests available</p>
            <p className="text-sm text-muted-foreground">Check back soon — your teachers are adding tests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                locked={test.isPremium && !isPremium}
                onStart={() => handleStartTest(test)}
              />
            ))}

            {/* ── Motivational bottom card ── */}
            {leaderboardRank && (
              <div
                className="rounded-2xl p-4 mt-2"
                style={{
                  background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(249,115,22,0.06))",
                  border: "1.5px solid rgba(245,158,11,0.3)",
                  boxShadow: "0 0 20px rgba(245,158,11,0.1)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #f97316)",
                      boxShadow: "0 4px 12px rgba(245,158,11,0.4)",
                    }}
                  >
                    <Trophy size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-foreground text-sm">
                      You're in the Top {leaderboardRank}!
                    </p>
                    <p className="text-xs text-muted-foreground">Keep practicing to reach the top.</p>
                  </div>
                  <button
                    onClick={() => navigate("/leaderboard")}
                    className="flex items-center gap-1.5 text-xs font-bold flex-shrink-0"
                    style={{ color: "#f59e0b" }}
                  >
                    View Leaderboard <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {!leaderboardRank && tests.length > 0 && (
              <div
                className="rounded-2xl p-4 mt-2"
                style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))",
                  border: "1.5px solid rgba(99,102,241,0.2)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}
                  >
                    <Trophy size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-foreground text-sm">Climb the leaderboard!</p>
                    <p className="text-xs text-muted-foreground">Complete tests to earn XP and rank up.</p>
                  </div>
                  <button
                    onClick={() => navigate("/leaderboard")}
                    className="flex items-center gap-1.5 text-xs font-bold flex-shrink-0"
                    style={{ color: "#818cf8" }}
                  >
                    View Leaderboard <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
