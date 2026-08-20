/**
 * ContentRating — premium star rating system for all content types.
 * Stores: ratings/{contentId}_{contentType}/users/{uid} → { rating, feedback, uid }
 * Aggregate: ratings/{contentId}_{contentType}/meta/aggregate → { avg, count }
 */
import { useState, useEffect, useCallback } from "react";
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Star, X, CheckCircle } from "lucide-react";

export type ContentType = "lecture" | "note" | "test" | "file" | "premium_lecture" | "resource" | "dpp";

interface RatingProps {
  contentId: string;
  contentType: ContentType;
  readOnly?: boolean;
  compact?: boolean;
  onRated?: (rating: number) => void;
}

interface Aggregate { avg: number; count: number; }

/* ─── Compact read-only badge ─────────────────────────────── */
function CompactBadge({ avg, count }: { avg: number; count: number }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Star size={11} fill="#f59e0b" style={{ color: "#f59e0b" }} />
      <span className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>
        {avg > 0 ? avg.toFixed(1) : "—"}
      </span>
      {count > 0 && (
        <span className="text-[10px] text-muted-foreground/70">({count})</span>
      )}
    </div>
  );
}

/* ─── Star row ────────────────────────────────────────────── */
function StarRow({
  value, hovered, onChange, onHover, size = 22, readOnly = false,
}: {
  value: number; hovered: number;
  onChange?: (v: number) => void;
  onHover?: (v: number) => void;
  size?: number; readOnly?: boolean;
}) {
  const display = hovered || value;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(s)}
          onMouseEnter={() => !readOnly && onHover?.(s)}
          onMouseLeave={() => !readOnly && onHover?.(0)}
          className={`transition-all duration-100 ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-115 active:scale-95"}`}
          style={{ lineHeight: 1 }}
        >
          <Star
            size={size}
            fill={s <= display ? "#f59e0b" : "transparent"}
            style={{
              color: s <= display ? "#f59e0b" : "rgba(156,163,175,0.4)",
              filter: s <= display ? "drop-shadow(0 0 4px rgba(245,158,11,0.5))" : "none",
              transition: "all 0.15s ease",
            }}
          />
        </button>
      ))}
    </div>
  );
}

/* ─── ContentRating (inline) ──────────────────────────────── */
export function ContentRating({ contentId, contentType, readOnly, compact, onRated }: RatingProps) {
  const { user } = useAuth();
  const docKey = `${contentId}_${contentType}`;
  const aggRef = doc(db, "ratings", docKey, "meta", "aggregate");
  const userRef = user ? doc(db, "ratings", docKey, "users", user.uid) : null;

  const [agg, setAgg] = useState<Aggregate>({ avg: 0, count: 0 });
  const [myRating, setMyRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(aggRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setAgg({ avg: d.avg ?? 0, count: d.count ?? 0 });
      }
    }, () => {});
    return unsub;
  }, [docKey]);

  useEffect(() => {
    if (!userRef) return;
    getDoc(userRef).then((snap) => {
      if (snap.exists()) setMyRating(snap.data().rating ?? 0);
    }).catch(() => {});
  }, [docKey, user?.uid]);

  const submitRating = useCallback(async (stars: number, feedback?: string) => {
    if (!user || !userRef || saving) return;
    setSaving(true);
    try {
      await setDoc(userRef, { rating: stars, feedback: feedback ?? "", uid: user.uid, updatedAt: serverTimestamp() });
      setMyRating(stars);
      const usersSnap = await getDocs(collection(db, "ratings", docKey, "users"));
      const ratings = usersSnap.docs.map(d => d.data().rating as number).filter(Boolean);
      const count = ratings.length;
      const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : 0;
      await setDoc(aggRef, { avg: Math.round(avg * 10) / 10, count });
      onRated?.(stars);
    } catch { /* silent */ } finally { setSaving(false); }
  }, [user, userRef, docKey, saving, onRated]);

  if (compact) return <CompactBadge avg={agg.avg} count={agg.count} />;

  return (
    <div className="space-y-3">
      <StarRow
        value={readOnly ? agg.avg : myRating}
        hovered={hovered}
        onChange={(v) => submitRating(v)}
        onHover={setHovered}
        readOnly={readOnly || !user}
      />
      <div className="flex items-center gap-2">
        {agg.avg > 0 ? (
          <>
            <span className="text-sm font-black" style={{ color: "#f59e0b" }}>{agg.avg.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">/ 5 from {agg.count.toLocaleString()} ratings</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground/50">No ratings yet</span>
        )}
      </div>
      {!readOnly && user && myRating > 0 && (
        <p className="text-[11px] text-muted-foreground/60">Your rating: {myRating}/5 — tap a star to update</p>
      )}
    </div>
  );
}

/* ─── Premium Rating Popup Modal ─────────────────────────── */
export function RatingPopup({
  contentId, contentType, contentName, onClose,
}: {
  contentId: string;
  contentType: ContentType;
  contentName: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const docKey = `${contentId}_${contentType}`;
  const userRef = user ? doc(db, "ratings", docKey, "users", user.uid) : null;
  const aggRef = doc(db, "ratings", docKey, "meta", "aggregate");

  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  /* Load existing rating */
  useEffect(() => {
    if (!userRef) return;
    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        setSelected(snap.data().rating ?? 0);
        setFeedback(snap.data().feedback ?? "");
      }
    }).catch(() => {});
  }, [docKey, user?.uid]);

  const handleSubmit = async () => {
    if (!user || !userRef || selected === 0 || saving) return;
    setSaving(true);
    try {
      await setDoc(userRef, { rating: selected, feedback, uid: user.uid, updatedAt: serverTimestamp() });
      const usersSnap = await getDocs(collection(db, "ratings", docKey, "users"));
      const ratings = usersSnap.docs.map(d => d.data().rating as number).filter(Boolean);
      const count = ratings.length;
      const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : 0;
      await setDoc(aggRef, { avg: Math.round(avg * 10) / 10, count });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const ratingLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", animation: "fadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {done ? (
          /* Success state */
          <div className="flex flex-col items-center py-10 px-6 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(16,185,129,0.12)", border: "1.5px solid rgba(16,185,129,0.3)" }}
            >
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <p className="text-lg font-black text-foreground mb-1">Thanks for rating!</p>
            <p className="text-sm text-muted-foreground">Your feedback helps others discover great content.</p>
            <div className="mt-4 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={20} fill={s <= selected ? "#f59e0b" : "transparent"}
                  style={{ color: s <= selected ? "#f59e0b" : "rgba(156,163,175,0.3)" }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-border"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04))" }}
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="font-black text-foreground text-sm">Rate this content</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{contentName}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-70 flex-shrink-0"
                style={{ background: "hsl(var(--secondary))" }}
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Stars */}
              <div className="flex flex-col items-center gap-3">
                <StarRow
                  value={selected}
                  hovered={hovered}
                  onChange={setSelected}
                  onHover={setHovered}
                  size={36}
                />
                {(hovered || selected) > 0 && (
                  <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>
                    {ratingLabels[hovered || selected]}
                  </p>
                )}
                {!selected && !hovered && (
                  <p className="text-xs text-muted-foreground">Tap a star to rate</p>
                )}
              </div>

              {/* Feedback */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
                  Feedback (optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What did you think? (e.g. very helpful, needs more examples…)"
                  maxLength={200}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none transition-all"
                  style={{
                    background: "hsl(var(--secondary))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                  onBlur={(e) => (e.target.style.borderColor = "hsl(var(--border))")}
                />
                <p className="text-[10px] text-muted-foreground/40 text-right mt-1">{feedback.length}/200</p>
              </div>

              {/* Submit + Skip */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={selected === 0 || saving}
                  className="w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selected > 0
                      ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                      : "hsl(var(--secondary))",
                    boxShadow: selected > 0 ? "0 4px 16px rgba(99,102,241,0.35)" : "none",
                    color: selected > 0 ? "white" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {saving ? "Saving…" : selected > 0 ? "Submit Rating" : "Select a rating first"}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

/** @deprecated use RatingPopup instead */
export function RatingPrompt({ contentId, contentType, contentName, onClose }: {
  contentId: string;
  contentType: ContentType;
  contentName: string;
  onClose: () => void;
}) {
  return <RatingPopup contentId={contentId} contentType={contentType} contentName={contentName} onClose={onClose} />;
}
