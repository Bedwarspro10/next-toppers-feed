import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import {
  Crown, Clock, CheckCircle, XCircle, Receipt, Copy,
  CalendarDays, Loader2, AlertCircle, Tag,
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────── */
interface PaymentRecord {
  id: string;
  txnId: string;
  plan: "day" | "month";
  originalAmount: number;
  finalAmount: number;
  couponCode: string;
  couponDiscount: number;
  utr: string;
  status: "pending" | "approved" | "rejected";
  createdAt: { seconds: number; nanoseconds: number } | null;
  reviewedAt?: { seconds: number } | null;
}

/* ─── helpers ───────────────────────────────────────────── */
function fmtDateTime(ts: { seconds: number } | null | undefined) {
  if (!ts?.seconds) return { date: "—", time: "—" };
  const d = new Date(ts.seconds * 1000);
  return {
    date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

/* ─── status badge ──────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase text-emerald-400"
      style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
      <CheckCircle size={9} /> Success
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase text-red-400"
      style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
      <XCircle size={9} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase text-amber-400"
      style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
      <Clock size={9} /> Pending
    </span>
  );
}

/* ─── payment card ──────────────────────────────────────── */
function PaymentCard({ rec }: { rec: PaymentRecord }) {
  const [copied, setCopied] = useState(false);
  const { date, time } = fmtDateTime(rec.createdAt);
  const isMonthly = rec.plan === "month";

  const copyTxn = () => {
    navigator.clipboard.writeText(rec.txnId || "").then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const statusMsg =
    rec.status === "approved" ? "Payment confirmed. Premium activated." :
    rec.status === "rejected" ? "Rejected — payment not confirmed." :
    "Payment not confirmed. Waiting for admin approval.";

  return (
    <div className="relative overflow-hidden rounded-2xl"
      style={{
        background: rec.status === "approved"
          ? "linear-gradient(135deg,rgba(16,185,129,0.07),rgba(6,182,212,0.04))"
          : rec.status === "rejected"
          ? "rgba(239,68,68,0.04)"
          : "rgba(255,255,255,0.03)",
        border: rec.status === "approved"
          ? "1px solid rgba(16,185,129,0.2)"
          : rec.status === "rejected"
          ? "1px solid rgba(239,68,68,0.15)"
          : "1px solid rgba(255,255,255,0.08)",
      }}>
      {/* Top accent bar */}
      <div className="h-0.5 w-full"
        style={{
          background: rec.status === "approved"
            ? "linear-gradient(90deg,#10b981,#06b6d4)"
            : rec.status === "rejected"
            ? "linear-gradient(90deg,#ef4444,#f97316)"
            : "linear-gradient(90deg,#f59e0b,#a78bfa)",
        }} />

      <div className="p-4">
        {/* Header row: TXN ID + status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Receipt size={10} className="text-white/40 flex-shrink-0" />
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">TXN ID</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-white font-mono font-bold text-sm truncate">{rec.txnId || "—"}</code>
              {rec.txnId && (
                <button onClick={copyTxn}
                  className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {copied ? <CheckCircle size={10} className="text-emerald-400" /> : <Copy size={10} className="text-white/50" />}
                </button>
              )}
            </div>
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={rec.status} />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Plan + amount row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mb-0.5">Plan</p>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center"
                style={{ background: isMonthly ? "rgba(245,158,11,0.2)" : "rgba(59,130,246,0.2)" }}>
                <Crown size={10} className={isMonthly ? "text-amber-400" : "text-blue-400"} />
              </div>
              <span className="text-white text-xs font-bold">{isMonthly ? "Monthly Premium" : "Daily Premium"}</span>
            </div>
          </div>
          <div>
            <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mb-0.5">Amount Paid</p>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-base">₹{rec.finalAmount}</span>
              {rec.couponDiscount > 0 && (
                <span className="text-white/30 text-xs line-through">₹{rec.originalAmount}</span>
              )}
            </div>
          </div>
        </div>

        {/* Date + time row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mb-0.5">Date</p>
            <div className="flex items-center gap-1">
              <CalendarDays size={10} className="text-white/40" />
              <span className="text-white/80 text-xs font-semibold">{date}</span>
            </div>
          </div>
          <div>
            <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mb-0.5">Time</p>
            <div className="flex items-center gap-1">
              <Clock size={10} className="text-white/40" />
              <span className="text-white/80 text-xs font-semibold">{time}</span>
            </div>
          </div>
        </div>

        {/* Coupon row (if used) */}
        {rec.couponCode && (
          <div className="mb-3 flex items-center gap-1.5 px-3 py-2 rounded-xl"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <Tag size={10} className="text-indigo-400 flex-shrink-0" />
            <span className="text-indigo-300 text-[10px] font-semibold">Coupon applied:</span>
            <code className="text-indigo-200 text-[10px] font-mono font-bold">{rec.couponCode}</code>
            <span className="text-indigo-400/60 text-[10px] ml-auto">-₹{rec.couponDiscount}</span>
          </div>
        )}

        {/* Status message */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{
            background: rec.status === "approved"
              ? "rgba(16,185,129,0.08)"
              : rec.status === "rejected"
              ? "rgba(239,68,68,0.08)"
              : "rgba(245,158,11,0.06)",
            border: rec.status === "approved"
              ? "1px solid rgba(16,185,129,0.15)"
              : rec.status === "rejected"
              ? "1px solid rgba(239,68,68,0.15)"
              : "1px solid rgba(245,158,11,0.15)",
          }}>
          {rec.status === "approved"
            ? <CheckCircle size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            : rec.status === "rejected"
            ? <XCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
            : <Clock size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
          }
          <p className={`text-[10px] font-semibold leading-relaxed ${
            rec.status === "approved" ? "text-emerald-300"
            : rec.status === "rejected" ? "text-red-300"
            : "text-amber-300"
          }`}>{statusMsg}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────── */
export default function PaymentHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, "premiumRequests"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q,
      (snap) => {
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord)));
        setLoading(false);
      },
      () => {
        // Fallback: orderBy requires an index, retry without orderBy and sort in JS
        const qFallback = query(
          collection(db, "premiumRequests"),
          where("uid", "==", user.uid),
        );
        onSnapshot(qFallback, (snap) => {
          const docs = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as PaymentRecord))
            .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
          setRecords(docs);
          setLoading(false);
        }, () => setLoading(false));
      },
    );
    return unsub;
  }, [user]);

  const pending  = records.filter(r => r.status === "pending").length;
  const approved = records.filter(r => r.status === "approved").length;
  const rejected = records.filter(r => r.status === "rejected").length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.3)" }}>
              <Receipt size={18} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground">Payment History</h1>
              <p className="text-xs text-muted-foreground">Track all your subscription requests</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        {records.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Pending", count: pending, color: "text-amber-500", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
              { label: "Active", count: approved, color: "text-emerald-500", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" },
              { label: "Rejected", count: rejected, color: "text-red-500", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)" },
            ].map(({ label, count, color, bg, border }) => (
              <div key={label} className="flex flex-col items-center py-3 rounded-2xl"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <span className={`text-2xl font-black ${color}`}>{count}</span>
                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-secondary/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <AlertCircle size={24} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground mb-1">Sign in to view payments</p>
            <p className="text-sm text-muted-foreground">You must be signed in to see your payment history.</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Receipt size={28} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground mb-1">No payment history yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your payment requests will appear here after you subscribe to a premium plan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((rec) => (
              <PaymentCard key={rec.id} rec={rec} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
