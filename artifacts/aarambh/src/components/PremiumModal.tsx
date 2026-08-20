import { useState, useCallback, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc,
  serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { PREMIUM_PLANS, type PremiumPlan } from "@/contexts/PremiumContext";
import {
  Crown, X, Check, Clock, Shield, Zap, HeadphonesIcon,
  Tag, Loader2, CheckCircle, XCircle, Star, CalendarDays,
  Copy, ChevronLeft, BookOpen, GraduationCap, Smartphone, QrCode,
  ArrowRight, CreditCard, Upload, Image as ImageIcon, Receipt,
} from "lucide-react";

/* ─── config ──────────────────────────────────────────────── */
const UPI_ID   = "ujjawal21@fam";
const UPI_NAME = "Next Toppers Feed";

/* ─── TXN ID generator ────────────────────────────────────── */
function generateTxnId(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `NTF-TXN-${date}-${rand}`;
}

/* ─── image compression ───────────────────────────────────── */
async function compressToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const MAX_DIM = 1200;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      let base64 = canvas.toDataURL("image/jpeg", 0.75);
      if (base64.length > 400_000) base64 = canvas.toDataURL("image/jpeg", 0.5);
      if (base64.length > 400_000) base64 = canvas.toDataURL("image/jpeg", 0.35);
      resolve(base64);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

/* ─── types ───────────────────────────────────────────────── */
interface CouponResult {
  valid: boolean; code: string;
  discountType: "percent" | "flat";
  discountValue: number;
  planId: "all" | "day" | "month";
  message: string; docId: string;
  perUserLimit: number;
}
type Step = "plans" | "payment" | "success";

/* ─── helpers ─────────────────────────────────────────────── */
function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/* ─── plan step ───────────────────────────────────────────── */
function PlansStep({
  isPremium, activePlan, expiryTime,
  couponCode, setCouponCode, couponResult, setCouponResult, setCouponError,
  couponValidating, couponError, validateCoupon,
  discountedPrice, onSelect, user, error,
}: {
  isPremium: boolean; activePlan: PremiumPlan | null; expiryTime: Date | null;
  couponCode: string; setCouponCode: (v: string) => void;
  couponResult: CouponResult | null; setCouponResult: (v: CouponResult | null) => void;
  setCouponError: (v: string | null) => void;
  couponValidating: boolean; couponError: string | null;
  validateCoupon: () => void;
  discountedPrice: (price: number, planId: PremiumPlan) => number;
  onSelect: (plan: typeof PREMIUM_PLANS[0]) => void;
  user: { uid: string } | null;
  error: string | null;
}) {
  return (
    <div>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,88,12,0.15))", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Crown size={22} className="text-amber-400" />
          </div>
          <div>
            <p className="text-white/50 text-xs font-medium tracking-wider uppercase">Next Toppers · Feed</p>
            <h1 className="text-2xl font-black tracking-tight" style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Premium</h1>
          </div>
          <div className="flex-shrink-0 ml-auto w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <GraduationCap size={26} className="text-indigo-400" />
          </div>
        </div>
        <p className="text-white/50 text-xs leading-relaxed mb-2">Unlock all lectures and study resources. Pay via UPI — instant manual verification.</p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-blue-300"
          style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <BookOpen size={11} /> Aarambh Batch 2025–26 Lectures
        </div>

        {isPremium && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-400">Active Premium — {activePlan === "day" ? "Daily" : "Monthly"} Plan</p>
              {expiryTime && <p className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5"><Clock size={9} /> Expires {fmtDate(expiryTime)}</p>}
            </div>
          </div>
        )}
        {error && (
          <div className="mt-3 px-4 py-3 rounded-2xl text-xs text-red-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</div>
        )}
      </div>

      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
        {PREMIUM_PLANS.map((plan) => {
          const isActive = isPremium && activePlan === plan.id;
          const isMonthly = plan.id === "month";
          const finalPrice = discountedPrice(plan.price, plan.id);
          const hasDiscount = finalPrice < plan.price;
          return (
            <div key={plan.id} className="relative flex flex-col rounded-2xl overflow-hidden"
              style={isMonthly ? {
                background: "linear-gradient(160deg,rgba(245,158,11,0.12),rgba(234,88,12,0.08))",
                border: "1px solid rgba(245,158,11,0.35)",
              } : { background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
              {isMonthly && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1 px-3 py-1 rounded-b-xl text-[9px] font-black tracking-widest uppercase text-white"
                    style={{ background: "linear-gradient(90deg,#f59e0b,#f97316)" }}>
                    <Star size={8} fill="currentColor" /> MOST POPULAR
                  </div>
                </div>
              )}
              <div className="p-3.5 flex flex-col flex-1" style={{ paddingTop: isMonthly ? "20px" : undefined }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={isMonthly ? { background: "rgba(245,158,11,0.2)" } : { background: "rgba(59,130,246,0.2)" }}>
                    {isMonthly ? <Crown size={12} className="text-amber-400" /> : <CalendarDays size={12} className="text-blue-400" />}
                  </div>
                  <p className={`text-[10px] font-black tracking-wider uppercase ${isMonthly ? "text-amber-400" : "text-blue-400"}`}>
                    {isMonthly ? "Monthly" : "Daily"}
                  </p>
                </div>
                <div className="flex items-end gap-1 mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-3xl font-black text-white">₹{finalPrice}</span>
                  {hasDiscount && <span className="text-white/35 text-sm line-through mb-1">₹{plan.price}</span>}
                  <span className="text-white/40 text-xs mb-1 ml-0.5">/{plan.id === "day" ? "day" : "mo"}</span>
                </div>
                <ul className="space-y-1.5 mb-4 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isMonthly ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
                        <Check size={9} className={isMonthly ? "text-amber-400" : "text-blue-400"} />
                      </div>
                      <span className="text-white/65 text-[10px] leading-tight">{f}</span>
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <div className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-amber-400"
                    style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <Shield size={12} /> Active Plan
                  </div>
                ) : (
                  <button onClick={() => onSelect(plan)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                    style={isMonthly ? { background: "linear-gradient(135deg,#f59e0b,#f97316)" }
                      : { background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
                    <Crown size={11} />
                    {!user ? "Sign in to buy" : isMonthly ? `Get Monthly — ₹${finalPrice}` : `Get Daily — ₹${finalPrice}`}
                    {user && <ArrowRight size={11} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-4">
        <div className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <Tag size={12} className="text-white/50" />
            <p className="text-white/70 text-xs font-semibold">Have a coupon code?</p>
          </div>
          <div className="flex gap-2">
            <input type="text" value={couponCode}
              onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(null); }}
              onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
              placeholder="Enter code"
              className="flex-1 px-3 py-2 rounded-xl text-xs font-mono text-white placeholder-white/30 outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }} />
            <button onClick={validateCoupon} disabled={couponValidating || !couponCode.trim()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-40"
              style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.3)" }}>
              {couponValidating ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
            </button>
          </div>
          {couponResult?.valid && (
            <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
              <CheckCircle size={12} /> {couponResult.message}
            </div>
          )}
          {couponError && (
            <div className="mt-2 flex items-center gap-1.5 text-red-400 text-[11px]">
              <XCircle size={12} /> {couponError}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { icon: Shield, label: "100% Safe", desc: "UPI verified", color: "text-violet-400" },
            { icon: Zap, label: "Fast Approval", desc: "Within hours", color: "text-blue-400" },
            { icon: HeadphonesIcon, label: "Support", desc: "Always here", color: "text-emerald-400" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Icon size={16} className={color} />
              </div>
              <div>
                <p className="text-white/80 text-[10px] font-bold leading-tight">{label}</p>
                <p className="text-white/35 text-[9px] leading-tight mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-3">How it works</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: CreditCard, label: "Pick plan" },
              { icon: QrCode,     label: "Scan QR" },
              { icon: Smartphone, label: "Pay UPI" },
              { icon: Crown,      label: "Activated" },
            ].map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-1.5 relative">
                {i < 3 && <div className="absolute top-4 left-[calc(50%+16px)] right-0 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center relative z-10"
                  style={{ background: `rgba(${i === 0 ? "139,92,246" : i === 1 ? "59,130,246" : i === 2 ? "16,185,129" : "245,158,11"},0.2)`, border: `1px solid rgba(${i === 0 ? "139,92,246" : i === 1 ? "59,130,246" : i === 2 ? "16,185,129" : "245,158,11"},0.3)` }}>
                  <Icon size={14} className={i === 0 ? "text-violet-400" : i === 1 ? "text-blue-400" : i === 2 ? "text-emerald-400" : "text-amber-400"} />
                </div>
                <p className="text-white/50 text-[9px] font-semibold leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── payment step ────────────────────────────────────────── */
function PaymentStep({
  plan, finalAmount, upiUrl,
  utr, setUtr, screenshotBase64, setScreenshotBase64,
  onSubmit, submitting, error, onBack,
}: {
  plan: typeof PREMIUM_PLANS[0]; finalAmount: number; upiUrl: string;
  utr: string; setUtr: (v: string) => void;
  screenshotBase64: string; setScreenshotBase64: (v: string) => void;
  onSubmit: () => void; submitting: boolean; error: string | null;
  onBack: () => void;
}) {
  const [upiCopied, setUpiCopied] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const copyUpi = () => {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
    }).catch(() => {});
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setCompressing(true);
    try {
      const b64 = await compressToBase64(file);
      setScreenshotBase64(b64);
      setPreviewUrl(b64);
    } catch {
      // ignore — screenshot is optional
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <ChevronLeft size={14} className="text-white/70" />
        </button>
        <div>
          <h2 className="text-white font-bold text-base">Complete Payment</h2>
          <p className="text-white/45 text-[11px]">{plan.durationLabel} — <span className="text-white/70 font-bold">₹{finalAmount}</span></p>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex flex-col items-center gap-4 p-5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <div className="p-3 bg-white rounded-2xl shadow-2xl">
            <QRCode value={upiUrl} size={160} fgColor="#000000" bgColor="#FFFFFF" level="M" />
          </div>
          <div className="text-center">
            <p className="text-white/80 text-sm font-bold">Scan to pay ₹{finalAmount}</p>
            <p className="text-white/40 text-[11px] mt-0.5">GPay, PhonePe, Paytm, any UPI app</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl w-full justify-between"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <p className="text-white/40 text-[10px] font-medium">UPI ID</p>
              <p className="text-white font-mono font-bold text-sm">{UPI_ID}</p>
            </div>
            <button onClick={copyUpi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{ background: upiCopied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              {upiCopied ? <CheckCircle size={11} className="text-emerald-400" /> : <Copy size={11} className="text-white/60" />}
              <span className={upiCopied ? "text-emerald-400" : "text-white/60"}>{upiCopied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="space-y-1.5">
          <label className="text-white/70 text-xs font-semibold">UTR / Transaction ID <span className="text-red-400">*</span></label>
          <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)}
            placeholder="e.g. 4234567890123456"
            className="w-full px-3.5 py-3 rounded-xl text-sm text-white font-mono placeholder-white/25 outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${utr.trim() ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.12)"}` }} />
          <p className="text-white/30 text-[10px]">Find UTR in your UPI app's transaction history</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-white/70 text-xs font-semibold flex items-center gap-1.5">
            <ImageIcon size={11} /> Payment Screenshot <span className="text-white/30 font-normal">(optional but recommended)</span>
          </label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-white/10">
              <img src={previewUrl} alt="Screenshot preview" className="w-full max-h-40 object-contain bg-black/20" />
              <button
                onClick={() => { setPreviewUrl(""); setScreenshotBase64(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white">
                <X size={11} />
              </button>
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-emerald-500/80 text-[9px] font-bold text-white">✓ Uploaded</div>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={compressing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold text-white/60 border border-dashed border-white/15 hover:border-white/25 hover:text-white/80 transition-colors">
              {compressing
                ? <><Loader2 size={13} className="animate-spin" /> Compressing…</>
                : <><Upload size={13} /> Upload from Gallery / Files</>
              }
            </button>
          )}
          <p className="text-white/25 text-[10px]">Image is compressed automatically and stored securely.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs text-red-400 flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <XCircle size={13} /> {error}
        </div>
      )}

      <button onClick={onSubmit} disabled={submitting || !utr.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
        {submitting ? "Submitting…" : "Submit Payment Proof"}
      </button>

      <p className="text-center text-white/25 text-[10px] mt-3 leading-relaxed">
        Admin will verify your payment and activate premium within a few hours.
      </p>
    </div>
  );
}

/* ─── success step ────────────────────────────────────────── */
function SuccessStep({ plan, finalAmount, txnId, onClose }: {
  plan: typeof PREMIUM_PLANS[0]; finalAmount: number; txnId: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTxn = () => {
    navigator.clipboard.writeText(txnId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.25),rgba(6,182,212,0.15))", border: "1px solid rgba(16,185,129,0.3)" }}>
        <CheckCircle size={38} className="text-emerald-400" />
      </div>
      <h2 className="text-white font-black text-xl mb-2">Payment Submitted!</h2>
      <p className="text-white/50 text-sm mb-1">
        Your {plan.durationLabel} request for <span className="text-white font-bold">₹{finalAmount}</span> has been sent to admin.
      </p>
      <p className="text-white/35 text-xs mb-5">Premium access will be activated once the admin verifies your payment.</p>

      {/* TXN ID card */}
      <div className="w-full mb-6 px-4 py-3.5 rounded-2xl text-left"
        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Receipt size={12} className="text-indigo-400" />
          <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">Transaction ID</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-white font-mono font-bold text-sm flex-1">{txnId}</code>
          <button onClick={copyTxn}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
            style={{ background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            {copied ? <CheckCircle size={10} className="text-emerald-400" /> : <Copy size={10} className="text-white/60" />}
            <span className={copied ? "text-emerald-400" : "text-white/60"}>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
        <p className="text-white/30 text-[9px] mt-1.5">Save this ID to track your payment in Payment History.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full mb-8">
        {[
          { icon: Shield, label: "Payment logged", color: "text-violet-400", bg: "rgba(139,92,246,0.15)" },
          { icon: Crown, label: "Approval pending", color: "text-amber-400", bg: "rgba(245,158,11,0.15)" },
          { icon: Zap, label: "Activates soon", color: "text-emerald-400", bg: "rgba(16,185,129,0.15)" },
        ].map(({ icon: Icon, label, color, bg }) => (
          <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-2xl" style={{ background: bg, border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon size={18} className={color} />
            <p className="text-white/60 text-[10px] font-semibold leading-tight">{label}</p>
          </div>
        ))}
      </div>
      <button onClick={onClose}
        className="w-full py-3 rounded-2xl font-black text-sm text-white"
        style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
        Done
      </button>
    </div>
  );
}

/* ─── main modal ──────────────────────────────────────────── */
export default function PremiumModal() {
  const { open, setOpen } = usePremiumModal();
  const { user } = useAuth();
  const { isPremium, plan: activePlan, expiryTime } = usePremium();

  const [mounted, setMounted] = useState(open);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setMounted(true);
    } else if (mounted) {
      closeTimer.current = setTimeout(() => setMounted(false), 430);
    }
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [open, mounted]);

  const closeModal = useCallback(() => {
    setOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => reset(), 430);
  }, [setOpen]);

  const [step, setStep] = useState<Step>("plans");
  const [selectedPlan, setSelectedPlan] = useState<typeof PREMIUM_PLANS[0] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false); // prevent duplicate submissions
  const [error, setError] = useState<string | null>(null);
  const [txnId, setTxnId] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [utr, setUtr] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState("");

  const discountedPrice = useCallback((price: number, planId: PremiumPlan): number => {
    if (!couponResult?.valid) return price;
    if (couponResult.planId !== "all" && couponResult.planId !== planId) return price;
    if (couponResult.discountType === "flat") return Math.max(0, price - couponResult.discountValue);
    return Math.max(0, Number((price * (1 - couponResult.discountValue / 100)).toFixed(2)));
  }, [couponResult]);

  const validateCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponValidating(true); setCouponError(null); setCouponResult(null);
    try {
      const snap = await getDocs(query(collection(db, "coupons"), where("code", "==", code)));
      if (snap.empty) { setCouponError("Invalid coupon code."); return; }
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      if (!data.isActive) { setCouponError("This coupon is not active."); return; }
      if (data.expiresAt && data.expiresAt.toDate() < new Date()) { setCouponError("This coupon has expired."); return; }
      if (data.maxUses > 0 && (data.usedCount ?? 0) >= data.maxUses) { setCouponError("Coupon usage limit reached."); return; }
      if (data.perUserLimit > 0 && user) {
        const usageSnap = await getDocs(query(
          collection(db, "couponUsage"),
          where("couponId", "==", docSnap.id),
          where("uid", "==", user.uid),
        ));
        if (usageSnap.size >= data.perUserLimit) { setCouponError("You've already used this coupon the maximum number of times."); return; }
      }
      setCouponResult({
        valid: true, code,
        discountType: data.discountType ?? "percent",
        discountValue: data.discountValue ?? 0,
        planId: data.planId ?? "all",
        message: `${data.discountType === "flat" ? `₹${data.discountValue}` : `${data.discountValue}%`} off applied!`,
        docId: docSnap.id,
        perUserLimit: data.perUserLimit ?? 0,
      });
    } catch (e) {
      console.error("Coupon validation error:", e);
      setCouponError("Could not validate coupon. Try again.");
    } finally { setCouponValidating(false); }
  };

  const handleSelectPlan = (plan: typeof PREMIUM_PLANS[0]) => {
    if (!user) { setError("Please sign in to purchase a plan."); return; }
    setSelectedPlan(plan);
    setStep("payment");
    setError(null);
    setUtr(""); setScreenshotBase64(""); setSubmitted(false);
  };

  const finalAmount = selectedPlan ? discountedPrice(selectedPlan.price, selectedPlan.id) : 0;
  const upiUrl = selectedPlan
    ? `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${finalAmount}&cu=INR`
    : "";

  const handleSubmitPayment = async () => {
    if (!utr.trim()) { setError("Please enter your UTR / Transaction ID."); return; }
    if (!user || !selectedPlan) return;
    // Prevent duplicate submissions (user clicking again after already submitted)
    if (submitted) { setStep("success"); return; }
    setSubmitting(true); setError(null);

    const newTxnId = generateTxnId();

    // ── CRITICAL: save payment request to Firestore ────────────────────────
    // Any error here is a real failure — show error to user.
    let docRef;
    try {
      docRef = await addDoc(collection(db, "premiumRequests"), {
        txnId: newTxnId,
        uid: user.uid,
        userName: user.displayName ?? user.email ?? "Unknown",
        userEmail: user.email ?? "",
        userPhoto: user.photoURL ?? "",
        plan: selectedPlan.id,
        originalAmount: selectedPlan.price,
        finalAmount,
        couponCode: couponResult?.valid ? couponResult.code : "",
        couponDiscount: couponResult?.valid ? Number((selectedPlan.price - finalAmount).toFixed(2)) : 0,
        utr: utr.trim(),
        screenshotBase64: screenshotBase64 || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Payment request save failed:", err);
      setError("Failed to save payment request. Check your internet connection and try again.");
      setSubmitting(false);
      return;
    }

    // ── MAIN DOC SAVED — show success immediately ──────────────────────────
    // Secondary operations (coupon tracking) are best-effort only.
    // Failures here must NEVER show an error to the user.
    setTxnId(newTxnId);
    setSubmitted(true);
    setSubmitting(false);
    setStep("success");

    // Secondary ops — fire-and-forget, completely isolated from success UI
    if (couponResult?.valid && docRef) {
      try {
        await updateDoc(doc(db, "coupons", couponResult.docId), { usedCount: increment(1) });
      } catch (e) { console.warn("Coupon usedCount increment failed (non-critical):", e); }
      try {
        await addDoc(collection(db, "couponUsage"), {
          couponId: couponResult.docId,
          couponCode: couponResult.code,
          uid: user.uid,
          usedAt: serverTimestamp(),
        });
      } catch (e) { console.warn("CouponUsage log failed (non-critical):", e); }
    }
  };

  const reset = () => {
    setStep("plans"); setSelectedPlan(null);
    setCouponCode(""); setCouponResult(null); setCouponError(null);
    setUtr(""); setScreenshotBase64(""); setError(null);
    setSubmitted(false); setTxnId("");
  };

  if (!mounted) return null;

  return (
    <>
      <div className={`hyperos-backdrop ${open ? "open" : ""} !z-[60]`} onClick={closeModal} />
      <div
        className={`hyperos-panel hyperos-panel-center ${open ? "open" : ""} fixed inset-x-3 top-1/2 z-[61] max-w-[480px] mx-auto max-h-[92dvh] overflow-y-auto rounded-3xl` }
        style={{ scrollbarWidth: "none" }}>
        <div className="relative overflow-hidden rounded-3xl"
          style={{
            background: "linear-gradient(160deg,#0d1224 0%,#0a0d1a 50%,#0f0820 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle,rgba(99,102,241,0.4),transparent 70%)", transform: "translate(30%,-30%)" }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
            style={{ background: "radial-gradient(circle,rgba(245,158,11,0.4),transparent 70%)", transform: "translate(-30%,30%)" }} />

          <button onClick={closeModal}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <X size={14} className="text-white/70" />
          </button>

          {step === "plans" && (
            <PlansStep
              isPremium={isPremium} activePlan={activePlan} expiryTime={expiryTime}
              couponCode={couponCode} setCouponCode={setCouponCode}
              couponResult={couponResult} setCouponResult={setCouponResult} setCouponError={setCouponError}
              couponValidating={couponValidating} couponError={couponError} validateCoupon={validateCoupon}
              discountedPrice={discountedPrice} onSelect={handleSelectPlan} user={user} error={error}
            />
          )}
          {step === "payment" && selectedPlan && (
            <PaymentStep
              plan={selectedPlan} finalAmount={finalAmount} upiUrl={upiUrl}
              utr={utr} setUtr={setUtr}
              screenshotBase64={screenshotBase64} setScreenshotBase64={setScreenshotBase64}
              onSubmit={handleSubmitPayment} submitting={submitting} error={error}
              onBack={() => setStep("plans")}
            />
          )}
          {step === "success" && selectedPlan && (
            <SuccessStep plan={selectedPlan} finalAmount={finalAmount} txnId={txnId} onClose={closeModal} />
          )}
        </div>
      </div>
    </>
  );
}
