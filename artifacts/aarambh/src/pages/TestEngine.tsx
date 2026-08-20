/**
 * TestEngine — Advanced Quiz/Exam System
 * Features: KaTeX math, question palette, mark-for-review, auto-resume,
 *            fullscreen exam mode, time-per-question, accuracy analytics,
 *            retry-wrong, XP awards, anti-cheat tab detection.
 */
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  doc, getDoc, addDoc, collection, serverTimestamp,
  query, where, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useXP } from "@/contexts/XPContext";
import { useCoin } from "@/contexts/CoinContext";
import { Layout } from "@/components/layout/Layout";
import { RatingPopup } from "@/components/ContentRating";
import { MathRenderer, hasLatex, parseMathToHtml } from "@/components/MathRenderer";
import type { ParsedQuestion } from "@/lib/parseQuizHtml";
import {
  Clock, FileQuestion, Star, ArrowLeft, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Trophy, LayoutDashboard,
  AlertTriangle, Loader2, Lock, AlertCircle, TrendingUp, Award,
  BookMarked, Zap, RefreshCw, Flag, Maximize, Minimize,
  Eye, EyeOff, BarChart2, Target, Flame, RotateCcw, Shield,
  ChevronDown, ChevronUp,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   QUIZ CONTENT RENDERER — auto-detects LaTeX vs plain HTML
═══════════════════════════════════════════════════════════ */
function QuizContent({ html, className, style }: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hasMath = hasLatex(html);
  const hasHtml = /<[^>]+>/i.test(html);

  if (hasMath) {
    // Render LaTeX (MathRenderer also preserves existing HTML tags via parseMathToHtml)
    return <MathRenderer content={html} className={className} style={style} />;
  }
  if (hasHtml) {
    return (
      <span
        className={`quiz-safe-html${className ? ` ${className}` : ""}`}
        style={{ display: "inline-block", width: "100%", minWidth: 0, ...style }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return <span className={className} style={style}>{html}</span>;
}

/* ─── types ─────────────────────────────────────────────── */
interface TestData {
  id: string;
  title: string;
  subject: string;
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  active: boolean;
  isPremium: boolean;
  parsedQuestions: ParsedQuestion[];
  instructions?: string;
  strictMode?: boolean;
}

type Phase = "loading" | "error" | "locked" | "rules" | "test" | "result" | "submitting" | "previousResult" | "retry";

interface ResultData {
  score: number;
  totalMarks: number;
  percentage: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  timeTaken: number;
  answers: Record<number, number>;
  questionTimes?: Record<number, number>; // ms per question
  markedForReview?: number[];
}

type ConfidenceLevel = "low" | "medium" | "high";

/* ─── localStorage auto-resume ───────────────────────────── */
interface ResumeState {
  testId: string;
  currentQ: number;
  answers: Record<number, number>;
  markedForReview: number[];
  timeLeft: number;
  savedAt: number;
}

function saveResume(state: ResumeState) {
  try { localStorage.setItem(`nt_resume_${state.testId}`, JSON.stringify(state)); } catch {}
}
function loadResume(testId: string): ResumeState | null {
  try {
    const raw = localStorage.getItem(`nt_resume_${testId}`);
    if (!raw) return null;
    const s: ResumeState = JSON.parse(raw);
    // Only resume if saved within last 24h
    if (Date.now() - s.savedAt > 86_400_000) { clearResume(testId); return null; }
    return s;
  } catch { return null; }
}
function clearResume(testId: string) {
  try { localStorage.removeItem(`nt_resume_${testId}`); } catch {}
}

/* ─── helpers ────────────────────────────────────────────── */
function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}
function pctColor(p: number) {
  if (p >= 80) return "#10b981";
  if (p >= 60) return "#3b82f6";
  if (p >= 40) return "#f59e0b";
  return "#ef4444";
}
function perfBadge(p: number): { label: string; icon: typeof Trophy; color: string } {
  if (p >= 90) return { label: "Outstanding!", icon: Trophy, color: "#f59e0b" };
  if (p >= 75) return { label: "Excellent!", icon: Award, color: "#3b82f6" };
  if (p >= 60) return { label: "Good Work!", icon: TrendingUp, color: "#10b981" };
  if (p >= 40) return { label: "Average", icon: BookMarked, color: "#f59e0b" };
  return { label: "Keep Practicing", icon: Zap, color: "#8b5cf6" };
}

/* ─── Circular progress ring ─────────────────────────────── */
function CircleProgress({ pct }: { pct: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pctColor(pct);
  const { label, icon: PerfIcon } = perfBadge(pct);
  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" />
        <circle cx="72" cy="72" r={r} stroke={color} strokeWidth="10" fill="none"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="text-center">
        <p className="text-3xl font-black" style={{ color }}>{Math.round(pct)}%</p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <PerfIcon size={10} style={{ color }} />
          <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RULES SCREEN
═══════════════════════════════════════════════════════════ */
function RulesScreen({ test, onStart, onBack, hasResume }: {
  test: TestData; onStart: () => void; onBack: () => void; hasResume?: boolean;
}) {
  const DEFAULT_INSTRUCTIONS = [
    "Read each question carefully before selecting an answer.",
    "Use the question palette to navigate — answered (green), unanswered (grey), review (amber), current (indigo).",
    "Mark questions for review with the flag button; revisit them before submitting.",
    "Your progress saves automatically — if you close the browser, you can resume.",
    "The timer starts the moment you click Start Test.",
    "Do not switch tabs — the system detects tab changes during strict mode.",
    "Once submitted, this test cannot be retaken without admin reset.",
  ];
  const instructions = test.instructions ? test.instructions.split("\n").filter(Boolean) : DEFAULT_INSTRUCTIONS;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 group">
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Tests
      </button>

      {hasResume && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3 border"
          style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.3)" }}>
          <RotateCcw size={15} className="text-indigo-400 flex-shrink-0" />
          <p className="text-sm text-indigo-300 font-semibold">Resume detected — clicking Start will restore your last session.</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileQuestion size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-semibold capitalize mb-0.5">{test.subject}</p>
            <h1 className="text-lg font-black text-foreground leading-snug break-words">{test.title}</h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: FileQuestion, label: "Questions", value: String(test.totalQuestions), color: "text-blue-500" },
            { icon: Star, label: "Total Marks", value: String(test.totalMarks), color: "text-amber-500" },
            { icon: Clock, label: "Duration", value: `${test.duration} min`, color: "text-violet-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-secondary/50 rounded-xl p-3 text-center">
              <Icon size={16} className={`${color} mx-auto mb-1`} />
              <p className="text-sm font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Palette legend */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Question Palette Legend</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { color: "#6366f1", bg: "rgba(99,102,241,0.15)", label: "Current Question" },
            { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "Answered" },
            { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Marked for Review" },
            { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Not Visited" },
          ].map(({ color, bg, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black"
                style={{ background: bg, border: `1.5px solid ${color}`, color }}>1</div>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <h2 className="font-bold text-foreground text-sm">Instructions</h2>
        </div>
        <ul className="space-y-2">
          {instructions.map((ins, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <span className="break-words">{ins}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
        <Lock size={14} className="text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 dark:text-violet-400 font-semibold">
          One attempt only. Once submitted, you cannot retake without admin reset.
        </p>
      </div>
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
        <Clock size={14} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
          Timer starts only after clicking "Start Test".
        </p>
      </div>

      <button onClick={onStart}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base text-white"
        style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
        {hasResume ? "Resume Test →" : "Start Test →"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACTIVE TEST SCREEN
═══════════════════════════════════════════════════════════ */
function ActiveTest({ test, onSubmit, resumeState }: {
  test: TestData;
  onSubmit: (answers: Record<number, number>, timeTaken: number, questionTimes: Record<number, number>, markedForReview: number[]) => void;
  resumeState?: ResumeState | null;
}) {
  /* Core state */
  const [currentQ, setCurrentQ] = useState(resumeState?.currentQ ?? 0);
  const [answers, setAnswers] = useState<Record<number, number>>(resumeState?.answers ?? {});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(
    new Set(resumeState?.markedForReview ?? []),
  );
  const [timeLeft, setTimeLeft] = useState(resumeState?.timeLeft ?? test.duration * 60);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [tabWarningCount, setTabWarningCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  /* Time-per-question tracking */
  const questionTimes = useRef<Record<number, number>>({});
  const qStartTime = useRef(Date.now());
  const startTime = useRef(Date.now() - ((test.duration * 60 - (resumeState?.timeLeft ?? test.duration * 60)) * 1000));
  const warned = useRef(false);

  const totalQ = test.parsedQuestions.length;
  const answered = Object.keys(answers).length;
  const reviewCount = markedForReview.size;
  const isLowTime = timeLeft <= 120;
  const q = test.parsedQuestions[currentQ];

  /* Pause time tracking when switching questions */
  const goToQuestion = useCallback((idx: number) => {
    const elapsed = Date.now() - qStartTime.current;
    questionTimes.current[currentQ] = (questionTimes.current[currentQ] ?? 0) + elapsed;
    qStartTime.current = Date.now();
    setCurrentQ(idx);
  }, [currentQ]);

  /* Timer */
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1;
        if (next === 60 && !warned.current) {
          warned.current = true;
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 4000);
        }
        if (next <= 0) {
          clearInterval(id);
          const elapsed = Date.now() - qStartTime.current;
          questionTimes.current[currentQ] = (questionTimes.current[currentQ] ?? 0) + elapsed;
          const taken = Math.round((Date.now() - startTime.current) / 1000);
          clearResume(test.id);
          onSubmit(answers, taken, questionTimes.current, Array.from(markedForReview));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Auto-save resume state every 15s */
  useEffect(() => {
    const id = setInterval(() => {
      saveResume({
        testId: test.id,
        currentQ,
        answers,
        markedForReview: Array.from(markedForReview),
        timeLeft,
        savedAt: Date.now(),
      });
    }, 15_000);
    return () => clearInterval(id);
  }, [test.id, currentQ, answers, markedForReview, timeLeft]);

  /* Anti-cheat: tab visibility */
  useEffect(() => {
    if (!test.strictMode) return;
    const handler = () => {
      if (document.hidden) {
        setTabWarningCount((c) => c + 1);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [test.strictMode]);

  /* Fullscreen API */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* Keyboard nav */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showConfirm) { if (e.key === "Escape") setShowConfirm(false); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goToQuestion(Math.min(totalQ - 1, currentQ + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToQuestion(Math.max(0, currentQ - 1));
      if (e.key === "m" || e.key === "M") toggleMark();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, showConfirm, totalQ]);

  const toggleMark = () => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentQ)) next.delete(currentQ);
      else next.add(currentQ);
      return next;
    });
  };

  const selectAnswer = (optIdx: number) => {
    setAnswers((p) => ({ ...p, [currentQ]: optIdx }));
    // Remove from review if answered
    setMarkedForReview((p) => { const n = new Set(p); n.delete(currentQ); return n; });
  };

  const doSubmit = () => {
    const elapsed = Date.now() - qStartTime.current;
    questionTimes.current[currentQ] = (questionTimes.current[currentQ] ?? 0) + elapsed;
    const taken = Math.round((Date.now() - startTime.current) / 1000);
    clearResume(test.id);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    onSubmit(answers, taken, questionTimes.current, Array.from(markedForReview));
    setShowConfirm(false);
  };

  /* Palette state per question */
  const qState = (i: number): "current" | "answered" | "review" | "unanswered" => {
    if (i === currentQ) return "current";
    if (markedForReview.has(i)) return "review";
    if (answers[i] !== undefined) return "answered";
    return "unanswered";
  };

  const paletteStyle = (state: ReturnType<typeof qState>) => {
    switch (state) {
      case "current":    return { background: "#6366f1", color: "#fff", borderColor: "#6366f1" };
      case "answered":   return { background: "#10b981", color: "#fff", borderColor: "#10b981" };
      case "review":     return { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" };
      case "unanswered": return { background: "transparent", color: undefined, borderColor: undefined };
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-32 w-full">

      {/* 1-minute warning */}
      {showWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl"
          style={{ background: "#ef4444", color: "white", maxWidth: "320px" }}>
          <AlertTriangle size={16} /> <span className="font-bold text-sm">1 minute remaining!</span>
        </div>
      )}

      {/* Tab-switch warning */}
      {tabWarningCount > 0 && (
        <div className="mb-3 px-4 py-2.5 rounded-xl flex items-center gap-2 border"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
          <Shield size={13} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-500 font-semibold">
            Tab switch detected ({tabWarningCount}x). This is monitored in strict mode.
          </p>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-semibold truncate">{test.title}</p>
          <p className="text-[11px] text-muted-foreground">{answered}/{totalQ} answered · {reviewCount} for review</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Fullscreen toggle */}
          <button onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm ${isLowTime ? "text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" : "text-foreground bg-secondary"}`}>
            <Clock size={13} /> {fmtTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-secondary rounded-full mb-3 overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentQ + 1) / totalQ) * 100}%` }} />
      </div>

      {/* Question palette (collapsible on mobile) */}
      <div className="mb-3 rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowPalette(!showPalette)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          <span className="flex items-center gap-2">
            <Target size={13} className="text-primary" />
            Question Palette
            <span className="text-xs text-muted-foreground">({answered} done · {reviewCount} review)</span>
          </span>
          {showPalette ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        {showPalette && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-1.5">
              {test.parsedQuestions.map((_, i) => {
                const state = qState(i);
                const style = paletteStyle(state);
                return (
                  <button key={i} onClick={() => goToQuestion(i)}
                    className="w-8 h-8 rounded-lg text-xs font-bold border transition-all"
                    style={{ ...style }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3">
              {[
                { color: "#6366f1", label: "Current" },
                { color: "#10b981", label: "Answered" },
                { color: "#f59e0b", label: "Review" },
                { color: "#6b7280", label: "Pending" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-primary font-bold">Question {currentQ + 1} of {totalQ}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-semibold">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
            {/* Mark for review toggle */}
            <button onClick={toggleMark}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                markedForReview.has(currentQ)
                  ? "border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-950/30"
                  : "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500"
              }`}
              title="Mark for review (M)">
              <Flag size={10} fill={markedForReview.has(currentQ) ? "currentColor" : "none"} />
              {markedForReview.has(currentQ) ? "Marked" : "Mark"}
            </button>
          </div>
        </div>

        <div className="text-foreground font-semibold text-base leading-relaxed mb-4 w-full overflow-hidden">
          <QuizContent html={q.text} className="text-foreground font-semibold text-base leading-relaxed" />
        </div>

        <div className="space-y-2.5">
          {q.options.map((opt, oi) => {
            const selected = answers[currentQ] === oi;
            return (
              <button key={oi} onClick={() => selectAnswer(oi)}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                style={{
                  background: selected ? "rgba(99,102,241,0.1)" : undefined,
                  borderColor: selected ? "#6366f1" : undefined,
                }}>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${selected ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className={`text-sm font-medium min-w-0 flex-1 ${selected ? "text-primary font-semibold" : "text-foreground"}`}>
                  <QuizContent html={opt.text} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky nav bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-background/95 border-t border-border"
        style={{ backdropFilter: "blur(8px)", zIndex: 30 }}>
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Primary nav row */}
          <div className="flex items-center gap-2">
            <button onClick={() => goToQuestion(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-semibold border border-border disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
              <ChevronLeft size={14} /> Prev
            </button>
            <button onClick={toggleMark}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 ${
                markedForReview.has(currentQ)
                  ? "border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-950/30"
                  : "border-border text-muted-foreground"
              }`}>
              <Flag size={11} fill={markedForReview.has(currentQ) ? "currentColor" : "none"} />
              {markedForReview.has(currentQ) ? "Marked" : "Review"}
            </button>
            <button
              onClick={() => {
                if (answers[currentQ] !== undefined) {
                  goToQuestion(Math.min(totalQ - 1, currentQ + 1));
                }
              }}
              disabled={currentQ === totalQ - 1}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}>
              Save & Next <ChevronRight size={14} />
            </button>
            <button onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-black text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
              Submit
            </button>
          </div>
        </div>
      </div>

      {/* Submit confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-amber-500" />
            </div>
            <h3 className="font-black text-foreground text-lg text-center mb-1">Submit Test?</h3>
            <div className="grid grid-cols-3 gap-2 mb-4 mt-3">
              {[
                { label: "Answered", value: answered, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
                { label: "Review", value: reviewCount, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
                { label: "Pending", value: totalQ - answered - (reviewCount - (Array.from(markedForReview).filter((i) => answers[i] !== undefined).length)), color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-2 text-center`}>
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-[9px] text-muted-foreground font-semibold">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-red-500 text-center font-semibold mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold">Cancel</button>
              <button onClick={doSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RESULT SCREEN — with analytics, time breakdown, retry wrong
═══════════════════════════════════════════════════════════ */
function ResultScreen({ test, result, onBack, onRetryWrong, isPrevious, xpEarned, coinsEarned }: {
  test: TestData;
  result: ResultData;
  onBack: () => void;
  onRetryWrong?: () => void;
  isPrevious?: boolean;
  xpEarned?: number;
  coinsEarned?: number;
}) {
  const [reviewFilter, setReviewFilter] = useState<"all" | "correct" | "incorrect" | "skipped">("all");
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "analytics">("overview");
  const perf = perfBadge(result.percentage);
  const PerfIcon = perf.icon;

  const wrongQuestions = test.parsedQuestions.map((_, i) => i).filter((i) => {
    const ans = result.answers[i];
    return ans !== undefined && !test.parsedQuestions[i].options[ans]?.isCorrect;
  });

  const filteredIndices = test.parsedQuestions.map((_, i) => i).filter((i) => {
    if (reviewFilter === "all") return true;
    const answered = result.answers[i] !== undefined;
    const correct = answered && test.parsedQuestions[i].options[result.answers[i]]?.isCorrect;
    if (reviewFilter === "correct") return correct;
    if (reviewFilter === "incorrect") return answered && !correct;
    if (reviewFilter === "skipped") return !answered;
    return true;
  });

  /* Accuracy stats */
  const totalAnswered = result.correctAnswers + result.incorrectAnswers;
  const accuracy = totalAnswered > 0 ? Math.round((result.correctAnswers / totalAnswered) * 100) : 0;
  const avgTimePerQ = result.questionTimes
    ? Object.values(result.questionTimes).reduce((s, t) => s + t, 0) / Math.max(1, Object.keys(result.questionTimes).length) / 1000
    : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 w-full">

      {isPrevious && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <RefreshCw size={14} className="text-indigo-400 flex-shrink-0" />
          <p className="text-xs text-indigo-400 font-semibold">Showing your previously submitted result.</p>
        </div>
      )}

      {/* XP + Coins earned banners */}
      {(xpEarned && xpEarned > 0) || (coinsEarned && coinsEarned > 0) ? (
        <div className="flex gap-2 mb-4 flex-wrap">
          {xpEarned && xpEarned > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
              <Zap size={15} className="text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-foreground">+{xpEarned} XP</p>
                <p className="text-[10px] text-muted-foreground">Leaderboard rank</p>
              </div>
            </div>
          ) : null}
          {coinsEarned && coinsEarned > 0 ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl flex-1"
              style={{
                background: "rgba(251,191,36,0.08)",
                border: "1.5px solid rgba(251,191,36,0.3)",
              }}>
              <span className="text-lg flex-shrink-0">🪙</span>
              <div>
                <p className="text-sm font-black text-amber-500">+{coinsEarned} Coins</p>
                <p className="text-[10px] text-muted-foreground">Added to wallet</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Hero card */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Trophy size={18} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-foreground">Test Completed</h2>
            <p className="text-xs text-muted-foreground truncate">{test.title}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 items-center">
          <CircleProgress pct={result.percentage} />
          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold">Score</p>
              <p className="text-xl font-black text-foreground">{result.score}<span className="text-muted-foreground text-sm font-bold">/{result.totalMarks}</span></p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold">Time Taken</p>
              <p className="font-black text-foreground flex items-center gap-1">
                <Clock size={12} className="text-muted-foreground" />
                {fmtTime(result.timeTaken)}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold"
              style={{ borderColor: perf.color, color: perf.color, background: `${perf.color}15` }}>
              <PerfIcon size={11} /> {perf.label}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Total", value: test.totalQuestions, color: "text-foreground", bg: "bg-secondary/50" },
          { label: "Correct", value: result.correctAnswers, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "Wrong", value: result.incorrectAnswers, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
          { label: "Skipped", value: result.unanswered, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-4 p-1 rounded-2xl bg-secondary/60 border border-border">
        {([
          { value: "overview",   label: "Overview",   icon: Trophy },
          { value: "analytics",  label: "Analytics",  icon: BarChart2 },
          { value: "questions",  label: "Questions",  icon: FileQuestion },
        ] as const).map(({ value, label, icon: Icon }) => (
          <button key={value} onClick={() => setActiveTab(value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Accuracy + speed */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target size={14} className="text-blue-500" />
                <p className="text-xs font-bold text-muted-foreground">Accuracy</p>
              </div>
              <p className="text-3xl font-black text-foreground">{accuracy}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">of {totalAnswered} answered</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame size={14} className="text-orange-500" />
                <p className="text-xs font-bold text-muted-foreground">Avg Speed</p>
              </div>
              <p className="text-3xl font-black text-foreground">{Math.round(avgTimePerQ)}s</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">per question</p>
            </div>
          </div>

          {/* Performance bar */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground mb-3">Performance Breakdown</p>
            {[
              { label: "Correct", count: result.correctAnswers, total: test.totalQuestions, color: "#10b981" },
              { label: "Incorrect", count: result.incorrectAnswers, total: test.totalQuestions, color: "#ef4444" },
              { label: "Skipped", count: result.unanswered, total: test.totalQuestions, color: "#f59e0b" },
            ].map(({ label, count, total, color }) => (
              <div key={label} className="mb-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-muted-foreground">{label}</span>
                  <span className="font-bold" style={{ color }}>{count}/{total}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(count / total) * 100}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Retry wrong */}
          {wrongQuestions.length > 0 && onRetryWrong && (
            <button onClick={onRetryWrong}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
              <RotateCcw size={14} /> Retry {wrongQuestions.length} Wrong Question{wrongQuestions.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* ANALYTICS tab */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          {/* Time per question */}
          {result.questionTimes && Object.keys(result.questionTimes).length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Clock size={13} className="text-primary" /> Time per Question
                </h3>
              </div>
              <div className="divide-y divide-border/50">
                {Object.entries(result.questionTimes)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([qi, ms]) => {
                    const i = Number(qi);
                    const q = test.parsedQuestions[i];
                    if (!q) return null;
                    const secs = Math.round(ms / 1000);
                    const ans = result.answers[i];
                    const isCorrect = ans !== undefined && q.options[ans]?.isCorrect;
                    const wasAnswered = ans !== undefined;
                    return (
                      <div key={qi} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          !wasAnswered ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600" :
                          isCorrect ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" :
                          "bg-red-100 dark:bg-red-900/40 text-red-500"
                        }`}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (secs / 120) * 100)}%`,
                                background: isCorrect ? "#10b981" : !wasAnswered ? "#f59e0b" : "#ef4444",
                              }} />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground flex-shrink-0 w-10 text-right">{secs}s</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground mb-3">Score Analysis</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Raw Score</span>
                <span className="font-black text-foreground">{result.score}/{result.totalMarks}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Percentage</span>
                <span className="font-black" style={{ color: pctColor(result.percentage) }}>{Math.round(result.percentage)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Questions Attempted</span>
                <span className="font-black text-foreground">{totalAnswered}/{test.totalQuestions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Accuracy (of attempted)</span>
                <span className="font-black text-foreground">{accuracy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Time</span>
                <span className="font-black text-foreground">{fmtTime(result.timeTaken)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTIONS tab */}
      {activeTab === "questions" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold text-foreground text-sm mb-3">Question-wise Review</h3>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "correct", "incorrect", "skipped"] as const).map((f) => (
                <button key={f} onClick={() => setReviewFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    reviewFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === "correct" && ` (${result.correctAnswers})`}
                  {f === "incorrect" && ` (${result.incorrectAnswers})`}
                  {f === "skipped" && ` (${result.unanswered})`}
                  {f === "all" && ` (${test.totalQuestions})`}
                </button>
              ))}
            </div>
          </div>
          <div>
            {filteredIndices.map((i) => {
              const q = test.parsedQuestions[i];
              const userAns = result.answers[i];
              const answered = userAns !== undefined;
              const isCorrect = answered && q.options[userAns]?.isCorrect;
              const expanded = expandedQ === i;
              const qTime = result.questionTimes?.[i];
              return (
                <div key={i} className="border-b border-border/50 last:border-b-0">
                  <button onClick={() => setExpandedQ(expanded ? null : i)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/30 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black mt-0.5 ${
                      !answered ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600" :
                      isCorrect ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" :
                      "bg-red-100 dark:bg-red-900/40 text-red-500"
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-sm text-foreground font-medium leading-snug w-full">
                        <QuizContent html={q.text} className="text-sm text-foreground font-medium leading-snug" />
                      </div>
                      {!expanded && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {!answered ? "Not attempted" : isCorrect ? "Correct" : "Incorrect"}
                          {qTime && <span className="ml-2">· {Math.round(qTime / 1000)}s</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {!answered ? (
                        <span className="text-xs font-bold text-amber-600">0 Mark</span>
                      ) : isCorrect ? (
                        <span className="text-xs font-bold text-emerald-600">+{q.marks}</span>
                      ) : (
                        <span className="text-xs font-bold text-red-500">0</span>
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {q.options.map((opt, oi) => {
                        const isUser = userAns === oi;
                        const isAns = opt.isCorrect;
                        return (
                          <div key={oi} className="flex items-start gap-2 px-3 py-2 rounded-xl text-sm"
                            style={{
                              background: isAns ? "rgba(16,185,129,0.1)" : isUser && !isAns ? "rgba(239,68,68,0.1)" : undefined,
                              border: isAns ? "1px solid rgba(16,185,129,0.3)" : isUser && !isAns ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent",
                            }}>
                            {isAns ? <CheckCircle size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" /> :
                              isUser ? <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" /> :
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0 mt-0.5" />}
                            <div className={`min-w-0 flex-1 ${isAns ? "text-emerald-700 dark:text-emerald-400 font-semibold" : isUser && !isAns ? "text-red-600 dark:text-red-400 font-semibold" : "text-muted-foreground"}`}>
                              <QuizContent html={opt.text} />
                            </div>
                            <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                              {isAns && <span className="text-[10px] font-bold text-emerald-600">Correct</span>}
                              {isUser && !isAns && <span className="text-[10px] font-bold text-red-500">Your Answer</span>}
                            </div>
                          </div>
                        );
                      })}
                      {q.explanation && (
                        <div className="mt-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold mb-0.5">Explanation</p>
                          <div className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                            <QuizContent html={q.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="mt-5">
        <button onClick={onBack}
          className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl text-sm font-black text-white"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <LayoutDashboard size={14} /> Back to Tests
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RETRY WRONG QUESTIONS — mini test with wrong answers only
═══════════════════════════════════════════════════════════ */
function RetryTest({ originalTest, wrongIndices, onDone }: {
  originalTest: TestData;
  wrongIndices: number[];
  onDone: () => void;
}) {
  const retryQuestions = wrongIndices.map((i) => originalTest.parsedQuestions[i]);
  const retryTest: TestData = {
    ...originalTest,
    title: `Retry — ${originalTest.title}`,
    totalQuestions: retryQuestions.length,
    parsedQuestions: retryQuestions,
    duration: Math.max(5, Math.ceil(retryQuestions.length * 1.5)),
    totalMarks: retryQuestions.reduce((s, q) => s + q.marks, 0),
    strictMode: false,
  };
  const [retryResult, setRetryResult] = useState<ResultData | null>(null);

  if (retryResult) {
    return (
      <ResultScreen
        test={retryTest}
        result={retryResult}
        onBack={onDone}
        isPrevious={false}
      />
    );
  }
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onDone} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Exit Retry
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Retry Mode</p>
          <p className="text-sm font-black text-foreground truncate">{retryQuestions.length} wrong question{retryQuestions.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <ActiveTest
        test={retryTest}
        onSubmit={(answers, timeTaken, questionTimes, marked) => {
          let score = 0; let correct = 0; let incorrect = 0; let unanswered = 0;
          retryTest.parsedQuestions.forEach((q, i) => {
            const ans = answers[i];
            if (ans === undefined) { unanswered++; return; }
            if (q.options[ans]?.isCorrect) { score += q.marks; correct++; }
            else incorrect++;
          });
          const pct = retryTest.totalMarks > 0 ? (score / retryTest.totalMarks) * 100 : 0;
          setRetryResult({ score, totalMarks: retryTest.totalMarks, percentage: pct, correctAnswers: correct, incorrectAnswers: incorrect, unanswered, timeTaken, answers, questionTimes, markedForReview: marked });
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function TestEngine() {
  const [, params] = useRoute("/tests/:testId");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { awardQuizXP } = useXP();
  const { awardTestCoins } = useCoin();
  const testId = params?.testId ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [test, setTest] = useState<TestData | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [resumeState, setResumeState] = useState<ResumeState | null>(null);
  const [retryIndices, setRetryIndices] = useState<number[]>([]);
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const attemptDocId = useRef<string | null>(null);

  /* Load test */
  useEffect(() => {
    if (!testId) { setPhase("error"); return; }
    if (!user) { navigate("/login"); return; }

    setPhase("loading");
    (async () => {
      try {
        const snap = await getDoc(doc(db, "tests", testId));
        if (!snap.exists()) { setPhase("error"); return; }
        const data = { id: snap.id, ...snap.data() } as TestData;
        if (!data.active) { setPhase("error"); return; }
        if (data.isPremium && !isPremium) { setPhase("locked"); setTest(data); return; }

        /* Check previous locked attempt */
        try {
          const q = query(
            collection(db, "testAttempts"),
            where("userId", "==", user.uid),
            where("testId", "==", snap.id),
            where("attemptLocked", "==", true),
          );
          const attSnap = await getDocs(q);
          if (!attSnap.empty) {
            const att = attSnap.docs[0].data();
            attemptDocId.current = attSnap.docs[0].id;
            setResult({
              score: att.score ?? 0,
              totalMarks: att.totalMarks ?? data.totalMarks,
              percentage: att.percentage ?? 0,
              correctAnswers: att.correctAnswers ?? 0,
              incorrectAnswers: att.incorrectAnswers ?? 0,
              unanswered: att.unanswered ?? 0,
              timeTaken: att.timeTaken ?? 0,
              answers: att.answers ?? {},
              questionTimes: att.questionTimes ?? {},
              markedForReview: att.markedForReview ?? [],
            });
            setTest(data);
            setPhase("previousResult");
            return;
          }
        } catch { /* proceed to rules */ }

        /* Check resume state */
        const resume = loadResume(snap.id);
        setResumeState(resume);
        setTest(data);
        setPhase("rules");
      } catch {
        setPhase("error");
      }
    })();
  }, [testId, isPremium, user, navigate]);

  const handleSubmit = useCallback(async (
    answers: Record<number, number>,
    timeTaken: number,
    questionTimes: Record<number, number>,
    markedForReview: number[],
  ) => {
    if (!test) return;
    setPhase("submitting");

    let score = 0; let correct = 0; let incorrect = 0; let unanswered = 0;
    test.parsedQuestions.forEach((q, i) => {
      const ans = answers[i];
      if (ans === undefined) { unanswered++; return; }
      if (q.options[ans]?.isCorrect) { score += q.marks; correct++; }
      else incorrect++;
    });
    const percentage = test.totalMarks > 0 ? (score / test.totalMarks) * 100 : 0;

    const resultData: ResultData = {
      score, totalMarks: test.totalMarks, percentage,
      correctAnswers: correct, incorrectAnswers: incorrect,
      unanswered, timeTaken, answers, questionTimes, markedForReview,
    };

    /* Save to Firestore */
    if (user) {
      try {
        const docRef = await addDoc(collection(db, "testAttempts"), {
          userId: user.uid,
          userName: user.displayName ?? user.email ?? "Unknown",
          testId: test.id,
          testTitle: test.title,
          subject: test.subject,
          totalQuestions: test.totalQuestions,
          totalMarks: test.totalMarks,
          score, correctAnswers: correct, incorrectAnswers: incorrect,
          unanswered, percentage, timeTaken,
          answers, questionTimes, markedForReview,
          attemptLocked: true,
          submittedAt: serverTimestamp(),
        });
        attemptDocId.current = docRef.id;
      } catch { /* best-effort */ }

      /* Award XP */
      try {
        await awardQuizXP({
          subject: test.subject,
          score,
          totalMarks: test.totalMarks,
          correctAnswers: correct,
          totalQuestions: test.totalQuestions,
        });
        // Estimate XP for display
        const xp = 10 + correct * 2 + (percentage === 100 ? 50 : percentage >= 80 ? 20 : 0);
        setXpEarned(xp);
      } catch { /* best-effort */ }

      /* Award Coins */
      try {
        const coins = await awardTestCoins(test.id, percentage);
        setCoinsEarned(coins);
      } catch { /* best-effort */ }
    }

    await new Promise((r) => setTimeout(r, 1500));
    setResult(resultData);
    setPhase("result");
    // Prompt rating after a short delay so result UI settles first
    setTimeout(() => setShowRatingPopup(true), 3500);
  }, [test, user, awardQuizXP, awardTestCoins]);

  const handleRetryWrong = useCallback(() => {
    if (!test || !result) return;
    const wrong = test.parsedQuestions.map((_, i) => i).filter((i) => {
      const ans = result.answers[i];
      return ans !== undefined && !test.parsedQuestions[i].options[ans]?.isCorrect;
    });
    setRetryIndices(wrong);
    setPhase("retry");
  }, [test, result]);

  return (
    <Layout>
      {phase === "loading" && (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      )}
      {phase === "submitting" && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="font-bold text-foreground">Calculating your performance...</p>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      )}
      {phase === "error" && (
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <AlertCircle size={36} className="text-muted-foreground mb-3" />
          <h2 className="font-black text-foreground text-lg mb-1">Test Not Found</h2>
          <p className="text-sm text-muted-foreground mb-5">This test may have been removed or deactivated.</p>
          <button onClick={() => navigate("/tests")} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Browse Tests
          </button>
        </div>
      )}
      {phase === "locked" && test && (
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
            <Lock size={28} className="text-amber-500" />
          </div>
          <h2 className="font-black text-foreground text-lg mb-1">Premium Test</h2>
          <p className="text-sm text-muted-foreground mb-5 break-words">{test.title} is only available for premium subscribers.</p>
          <button onClick={() => navigate("/tests")} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold">
            Back to Tests
          </button>
        </div>
      )}
      {phase === "rules" && test && (
        <RulesScreen
          test={test}
          hasResume={!!resumeState}
          onStart={() => setPhase("test")}
          onBack={() => navigate("/tests")}
        />
      )}
      {phase === "test" && test && (
        <ActiveTest test={test} resumeState={resumeState} onSubmit={handleSubmit} />
      )}
      {phase === "result" && test && result && (
        <ResultScreen
          test={test} result={result}
          onBack={() => navigate("/tests")}
          onRetryWrong={handleRetryWrong}
          isPrevious={false}
          xpEarned={xpEarned}
          coinsEarned={coinsEarned}
        />
      )}
      {phase === "previousResult" && test && result && (
        <ResultScreen test={test} result={result} onBack={() => navigate("/tests")} isPrevious={true} />
      )}
      {phase === "retry" && test && (
        <RetryTest
          originalTest={test}
          wrongIndices={retryIndices}
          onDone={() => setPhase("result")}
        />
      )}
      {/* Rating popup — appears 3.5s after test result */}
      {showRatingPopup && test && (
        <RatingPopup
          contentId={test.id}
          contentType="test"
          contentName={test.title}
          onClose={() => setShowRatingPopup(false)}
        />
      )}
    </Layout>
  );
}
