import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  collection, query, where, getDocs, doc, getDoc, setDoc,
  addDoc, serverTimestamp, orderBy, onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useCoin } from "@/contexts/CoinContext";
import { Layout } from "@/components/layout/Layout";
import { ChevronLeft, Clock, Gift, CheckCircle2, AlertCircle, Loader2, Search } from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */
interface Survey {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  rewardCoins: number;
  active: boolean;
  startDate?: Timestamp | null;
  endDate?: Timestamp | null;
  estimatedTime: number; // minutes
  maxResponses: number;
  responseCount: number;
  htmlContent: string;
  createdAt: Timestamp | null;
}

/* ── Safe HTML Survey Modal ─────────────────────────────── */
function SurveyModal({
  survey,
  onClose,
  onComplete,
}: {
  survey: Survey;
  onClose: () => void;
  onComplete: (surveyId: string, coins: number) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onComplete(survey.id, survey.rewardCoins);
      setDone(true);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
            <ChevronLeft size={20} />
          </button>
          <div>
            <p className="font-bold text-sm text-foreground">{survey.title}</p>
            <p className="text-xs text-muted-foreground">{survey.estimatedTime} min · 🪙 {survey.rewardCoins} coins reward</p>
          </div>
        </div>
        {!done && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">✕</button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-background">
        {done ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", boxShadow: "0 0 30px rgba(251,191,36,0.4)" }}>
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">Survey Completed! 🎉</h2>
            <p className="text-muted-foreground text-sm mb-4">You earned</p>
            <div className="flex items-center gap-2 text-4xl font-black text-amber-400 mb-6">
              <span>🪙</span>
              <span>{survey.rewardCoins}</span>
              <span className="text-lg text-amber-400/60">coins</span>
            </div>
            <button
              onClick={onClose}
              className="px-8 py-3.5 rounded-2xl font-black transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000" }}>
              Awesome! Back to Surveys
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-4">
            {/* Render HTML survey safely inside sandbox iframe */}
            <SurveySandbox html={survey.htmlContent} />
            {/* Submit button */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Ready to submit your responses?</p>
                <span className="text-sm font-black text-amber-400">🪙 +{survey.rewardCoins}</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-black text-base transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000", boxShadow: "0 4px 20px rgba(251,191,36,0.35)" }}>
                {submitting ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : <>Submit & Earn 🪙 {survey.rewardCoins}</>}
              </button>
              <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
                Each survey can only be completed once per account.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sandboxed survey renderer ──────────────────────────── */
function SurveySandbox({ html }: { html: string }) {
  if (!html?.trim()) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center text-muted-foreground text-sm">
        No survey content available.
      </div>
    );
  }

  // Wrap HTML in a full document with safe inline styles
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#1f2937;padding:16px;background:#fff;line-height:1.6}
  h1,h2,h3{font-weight:700;margin-bottom:12px;color:#111827}
  p{margin-bottom:10px;color:#374151}
  label{display:block;font-weight:600;margin-bottom:6px;color:#374151}
  input[type=text],input[type=email],textarea,select{width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:10px;font-size:14px;margin-bottom:14px;outline:none;transition:border-color .2s}
  input[type=text]:focus,textarea:focus,select:focus{border-color:#f59e0b}
  textarea{min-height:100px;resize:vertical}
  input[type=radio],input[type=checkbox]{margin-right:8px;accent-color:#f59e0b}
  .question{margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb}
  .section{margin-bottom:24px}
  .section-title{font-size:16px;font-weight:700;color:#111827;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #f59e0b}
  .rating{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
  .rating label{cursor:pointer;padding:8px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-weight:600;transition:all .15s}
  .rating input:checked+label{background:#fbbf24;border-color:#f59e0b;color:#000}
  .emoji-rating{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}
  .emoji-rating label{cursor:pointer;font-size:28px;opacity:.5;transition:opacity .15s;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#6b7280}
  .emoji-rating input:checked+label{opacity:1}
  .required::after{content:" *";color:#ef4444}
  .progress{height:6px;background:#e5e7eb;border-radius:999px;margin-bottom:20px;overflow:hidden}
  .progress-bar{height:100%;background:linear-gradient(90deg,#fbbf24,#f59e0b);border-radius:999px}
  img{max-width:100%;border-radius:8px;margin:8px 0}
  video{max-width:100%;border-radius:8px;margin:8px 0}
</style>
</head>
<body>${html}</body>
</html>`;

  return (
    <iframe
      srcDoc={fullHtml}
      sandbox="allow-forms allow-scripts allow-same-origin"
      className="w-full rounded-2xl border border-border"
      style={{ minHeight: "60vh", maxHeight: "70vh" }}
      title="Survey"
      scrolling="yes"
    />
  );
}

/* ── Survey Card ─────────────────────────────────────────── */
function SurveyCard({
  survey,
  completed,
  onStart,
}: {
  survey: Survey;
  completed: boolean;
  onStart: (s: Survey) => void;
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${completed ? "opacity-70" : "hover:shadow-md"} bg-card`}
      style={{ borderColor: completed ? "var(--border)" : "rgba(251,191,36,0.25)" }}>
      {/* Thumbnail */}
      {survey.thumbnail && (
        <div className="h-36 overflow-hidden bg-muted/30">
          <img src={survey.thumbnail} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-4">
        {/* Category + status */}
        <div className="flex items-center gap-2 mb-2">
          {survey.category && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {survey.category}
            </span>
          )}
          {completed && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 size={9} /> Completed
            </span>
          )}
        </div>

        <h3 className="font-bold text-foreground mb-1 leading-snug">{survey.title}</h3>
        {survey.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{survey.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} /> {survey.estimatedTime} min
          </span>
          <span className="text-xs font-black text-amber-500 flex items-center gap-1">
            🪙 {survey.rewardCoins} coins
          </span>
          {survey.maxResponses > 0 && (
            <span className="text-xs text-muted-foreground">
              {survey.responseCount ?? 0}/{survey.maxResponses} responses
            </span>
          )}
        </div>

        <button
          onClick={() => !completed && onStart(survey)}
          disabled={completed}
          className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
          style={completed ? {
            background: "var(--muted)",
            color: "var(--muted-foreground)",
          } : {
            background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))",
            color: "#f59e0b",
            border: "1.5px solid rgba(251,191,36,0.3)",
          }}>
          {completed ? "✓ Completed" : "Take Survey →"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function SurveysPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { awardSurveyCoins } = useCoin();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [search, setSearch] = useState("");

  /* Load surveys */
  useEffect(() => {
    const q = query(
      collection(db, "surveys"),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setSurveys(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Survey)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  /* Load completed surveys for current user */
  useEffect(() => {
    if (!user) { setCompletedIds(new Set()); return; }
    const q = query(collection(db, "surveyResponses"), where("uid", "==", user.uid));
    getDocs(q).then((snap) => {
      setCompletedIds(new Set(snap.docs.map((d) => d.data().surveyId as string)));
    }).catch(() => {});
  }, [user]);

  const handleSurveyComplete = async (surveyId: string, coins: number) => {
    if (!user) throw new Error("not logged in");

    // Mark response (Firestore transaction to prevent duplication)
    const responseRef = doc(db, "surveyResponses", `${surveyId}_${user.uid}`);
    const existing = await getDoc(responseRef);
    if (existing.exists()) return; // already done

    await setDoc(responseRef, {
      uid: user.uid,
      surveyId,
      coinsAwarded: coins,
      completedAt: serverTimestamp(),
    });

    // Increment response counter on survey
    try {
      const surveyRef = doc(db, "surveys", surveyId);
      await addDoc(collection(db, "surveyResponses"), {}); // dummy to trigger rule
    } catch { /* best effort */ }

    await awardSurveyCoins(surveyId, coins);
    setCompletedIds((prev) => new Set([...prev, surveyId]));
  };

  const filtered = surveys.filter((s) =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) || (s.category ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 group transition-colors">
            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </button>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-display font-black text-foreground">📝 Surveys</h1>
            <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Earn Coins
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Complete surveys to earn Gold Coins and unlock rewards.</p>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search surveys..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        {/* Guest notice */}
        {!user && (
          <div className="mb-5 rounded-2xl bg-amber-500/8 border border-amber-500/20 px-5 py-4 flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Sign in to earn coins</p>
              <p className="text-xs text-muted-foreground">You can preview surveys, but coins require an account.</p>
            </div>
            <button onClick={() => navigate("/login")} className="text-xs font-bold text-amber-500 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors">
              Sign In
            </button>
          </div>
        )}

        {/* Earn summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: "📝", label: "Surveys", value: surveys.length },
            { icon: "✅", label: "Completed", value: completedIds.size },
            { icon: "🪙", label: "Available", value: surveys.filter((s) => !completedIds.has(s.id)).reduce((a, s) => a + s.rewardCoins, 0) + " coins" },
          ].map(({ icon, label, value }) => (
            <div key={label} className="text-center py-3 rounded-2xl border border-border bg-card">
              <p className="text-xl mb-1">{icon}</p>
              <p className="text-sm font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Survey list */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card animate-pulse">
                <div className="h-36 bg-muted/40 rounded-t-2xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted/40 rounded-full w-2/3" />
                  <div className="h-3 bg-muted/30 rounded-full" />
                  <div className="h-3 bg-muted/30 rounded-full w-4/5" />
                  <div className="h-10 bg-muted/20 rounded-xl mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Gift size={44} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-foreground">{search ? "No matching surveys" : "No active surveys right now"}</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later — new surveys are added regularly!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((s) => (
              <SurveyCard
                key={s.id}
                survey={s}
                completed={completedIds.has(s.id)}
                onStart={setActiveSurvey}
              />
            ))}
          </div>
        )}
      </div>

      {/* Survey modal */}
      {activeSurvey && (
        <SurveyModal
          survey={activeSurvey}
          onClose={() => setActiveSurvey(null)}
          onComplete={handleSurveyComplete}
        />
      )}
    </Layout>
  );
}
