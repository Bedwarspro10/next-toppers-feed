import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import {
  Trophy, Clock, FileQuestion, ChevronRight,
  Loader2, AlertCircle, RotateCcw, ArrowLeft,
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────── */
interface AttemptDoc {
  id: string;
  testId: string;
  testTitle: string;
  subject: string;
  totalQuestions: number;
  totalMarks: number;
  score: number;
  percentage: number;
  timeTaken: number;  // seconds
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  submittedAt: { seconds: number } | null;
}

/* ─── helpers ────────────────────────────────────────────── */
function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function fmtDate(ts: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function scoreColor(pct: number) {
  if (pct >= 80) return "text-emerald-500";
  if (pct >= 60) return "text-blue-500";
  if (pct >= 40) return "text-amber-500";
  return "text-red-500";
}

function badge(pct: number) {
  if (pct >= 90) return { label: "Excellent!", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800" };
  if (pct >= 75) return { label: "Great Job", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800" };
  if (pct >= 60) return { label: "Good", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" };
  if (pct >= 40) return { label: "Average", color: "text-orange-600 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800" };
  return { label: "Needs Work", color: "text-red-600 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800" };
}

export default function TestHistory() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, "testAttempts"),
      where("userId", "==", user.uid),
      orderBy("submittedAt", "desc"),
    );
    const unsub = onSnapshot(q,
      (snap) => {
        setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttemptDoc)));
        setLoading(false);
      },
      () => {
        const qf = query(collection(db, "testAttempts"), where("userId", "==", user.uid));
        onSnapshot(qf, (snap) => {
          setAttempts(
            snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttemptDoc))
              .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0))
          );
          setLoading(false);
        }, () => setLoading(false));
      },
    );
    return unsub;
  }, [user]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 w-full">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate("/tests")}
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-border hover:bg-secondary transition-colors">
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Trophy size={17} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground">My Test History</h1>
              <p className="text-[11px] text-muted-foreground">All your previous attempts</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle size={32} className="text-muted-foreground mb-3" />
            <p className="font-bold">Sign in to view your history</p>
          </div>
        ) : attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Trophy size={28} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground mb-1">No attempts yet</p>
            <p className="text-sm text-muted-foreground mb-4">Take your first test to see results here.</p>
            <button onClick={() => navigate("/tests")}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-primary bg-primary/10 border border-primary/20">
              Browse Tests
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((a) => {
              const b = badge(a.percentage);
              return (
                <div key={a.id}
                  onClick={() => navigate(`/tests/${a.testId}?attemptId=${a.id}`)}
                  className="border border-border rounded-2xl p-4 bg-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground font-semibold capitalize mb-0.5">{a.subject}</p>
                      <h3 className="font-bold text-foreground text-sm leading-snug">{a.testTitle || "Test"}</h3>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-black ${scoreColor(a.percentage)}`}>{Math.round(a.percentage)}%</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <FileQuestion size={10} /> {a.score}/{a.totalMarks} marks
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock size={10} /> {fmtTime(a.timeTaken)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(a.submittedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-emerald-600 font-semibold">✓ {a.correctAnswers} correct</span>
                    <span className="text-[10px] text-red-500 font-semibold">✗ {a.incorrectAnswers} wrong</span>
                    {a.unanswered > 0 && <span className="text-[10px] text-muted-foreground font-semibold">— {a.unanswered} skipped</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
