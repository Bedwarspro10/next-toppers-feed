import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useCoin, REDEEM_PLANS, type RedeemPlanId, type CoinTransaction } from "@/contexts/CoinContext";
import { usePremium } from "@/contexts/PremiumContext";
import { useAuth } from "@/contexts/AuthContext";
import { RedemptionAnimation } from "@/components/CoinAnimation";
import {
  ChevronLeft, Crown, Trophy, History, Gift,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Flame,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

/* ── Helpers ─────────────────────────────────────────────── */
function fmtDate(ts: Timestamp | null) {
  if (!ts) return "—";
  const d = ts.toDate();
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function txIcon(type: CoinTransaction["type"]) {
  const map: Record<CoinTransaction["type"], string> = {
    survey: "📝", test: "🎯", daily_login: "🌅", admin_reward: "🎁",
    redeem: "👑", streak_bonus: "🔥", achievement: "🏆",
  };
  return map[type] ?? "🪙";
}

/* ── Redeem Confirmation Dialog ──────────────────────────── */
function RedeemDialog({
  planId, onCancel, onConfirm, balance,
}: {
  planId: RedeemPlanId;
  onCancel: () => void;
  onConfirm: (planId: RedeemPlanId) => void;
  balance: number;
}) {
  const plan = REDEEM_PLANS.find((p) => p.id === planId)!;
  const totalDays = plan.days + plan.bonus;
  const canAfford = balance >= plan.coins;

  return (
    <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #1a1200 0%, #0d0900 100%)",
          border: "1.5px solid rgba(251,191,36,0.3)",
          boxShadow: "0 0 60px rgba(251,191,36,0.15)",
        }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center" style={{
          background: "linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.08) 100%)",
          borderBottom: "1px solid rgba(251,191,36,0.15)",
        }}>
          <div className="text-5xl mb-3">🪙</div>
          <h2 className="text-xl font-black text-white">Confirm Redemption</h2>
          <p className="text-amber-400/70 text-sm mt-1">{plan.label}</p>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center justify-between py-3 px-4 rounded-2xl"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
            <span className="text-white/60 text-sm">Cost</span>
            <span className="text-amber-400 font-black text-lg">🪙 {plan.coins.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-2xl"
            style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.1)" }}>
            <span className="text-white/60 text-sm">Premium Duration</span>
            <span className="text-white font-bold">{plan.days} Days {plan.bonus > 0 ? `+${plan.bonus} Bonus` : ""}</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-2xl"
            style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.1)" }}>
            <span className="text-white/60 text-sm">Total Premium</span>
            <span className="text-emerald-400 font-black">{totalDays} Days 🎉</span>
          </div>
          <div className="flex items-center justify-between py-3 px-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-white/60 text-sm">Your Balance After</span>
            <span className={`font-bold ${canAfford ? "text-white" : "text-red-400"}`}>
              🪙 {(balance - plan.coins).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(planId)}
            disabled={!canAfford}
            className="flex-1 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: canAfford ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : "rgba(255,255,255,0.1)",
              color: canAfford ? "#000" : "rgba(255,255,255,0.3)",
              boxShadow: canAfford ? "0 4px 20px rgba(251,191,36,0.4)" : "none",
            }}>
            Redeem Now 🎁
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Wallet Page ────────────────────────────────────── */
export default function Wallet() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isPremium, expiryTime, extendPremium } = usePremium();
  const {
    balance, lifetimeEarned, lifetimeRedeemed, transactions,
    loginStreak, loading, getRedeemUsed, redeemForPremium,
  } = useCoin();

  const [tab, setTab] = useState<"wallet" | "history" | "redeem">("wallet");
  const [selectedPlan, setSelectedPlan] = useState<RedeemPlanId | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemAnimation, setRedeemAnimation] = useState(false);
  const [redeemResult, setRedeemResult] = useState<string | null>(null);
  const [redeemPlanDetails, setRedeemPlanDetails] = useState({ label: "", days: 0 });
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="text-6xl mb-4">🪙</div>
          <h2 className="text-xl font-bold">Sign in to access your Wallet</h2>
          <button onClick={() => navigate("/login")} className="mt-4 px-6 py-3 rounded-2xl bg-amber-500 text-black font-bold">Sign In</button>
        </div>
      </Layout>
    );
  }

  const handleConfirmRedeem = async (planId: RedeemPlanId) => {
    setSelectedPlan(null);
    setRedeeming(true);
    setError(null);
    const plan = REDEEM_PLANS.find((p) => p.id === planId)!;
    setRedeemPlanDetails({ label: plan.label, days: plan.days + plan.bonus });

    const result = await redeemForPremium(planId, extendPremium);
    setRedeeming(false);

    if (result === "success") {
      setRedeemAnimation(true);
    } else if (result === "limit_reached") {
      setError("Monthly limit reached for this plan. Try another plan or wait until next month.");
    } else {
      setError("Not enough coins. Earn more through surveys, tests, and daily logins.");
    }
  };

  const planMonthlyLabel = (plan: typeof REDEEM_PLANS[number]) => {
    const used = getRedeemUsed(plan.id);
    return `${used}/${plan.maxPerMonth} used this month`;
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Header ── */}
        <div className="mb-6">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 group transition-colors">
            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </button>
          <h1 className="text-2xl font-display font-black text-foreground flex items-center gap-2">
            🪙 Gold Wallet
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your coins, history & premium rewards</p>
        </div>

        {/* ── Balance Hero Card ── */}
        <div className="relative rounded-3xl overflow-hidden mb-5 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, #1a0f00 0%, #0d0800 50%, #1f1200 100%)",
            border: "1.5px solid rgba(251,191,36,0.3)",
            boxShadow: "0 8px 40px rgba(251,191,36,0.12)",
          }}>
          {/* Glow */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />

          <div className="relative px-6 py-7">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-amber-400/60 text-xs font-semibold uppercase tracking-widest mb-1">Gold Coins</p>
                <div className="flex items-center gap-3">
                  <span className="text-5xl">🪙</span>
                  <span className="text-5xl font-black text-white" style={{ textShadow: "0 0 20px rgba(251,191,36,0.4)" }}>
                    {loading ? "—" : balance.toLocaleString()}
                  </span>
                </div>
              </div>
              {loginStreak > 0 && (
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl"
                  style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-white font-black text-lg leading-none">{loginStreak}</span>
                  <span className="text-amber-400/60 text-[9px] font-bold uppercase">streak</span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Earned", value: lifetimeEarned, icon: "📈" },
                { label: "Redeemed", value: lifetimeRedeemed, icon: "🎁" },
                { label: "Available", value: balance, icon: "🪙" },
              ].map(({ label, value, icon }) => (
                <div key={label} className="text-center py-2 px-1 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-lg mb-0.5">{icon}</p>
                  <p className="text-white font-black text-base">{value.toLocaleString()}</p>
                  <p className="text-amber-400/50 text-[10px] font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Premium Status ── */}
        {isPremium && expiryTime && (
          <div className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.06) 100%)",
              border: "1px solid rgba(251,191,36,0.25)",
            }}>
            <Crown size={22} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-400">Premium Active</p>
              <p className="text-xs text-amber-400/60">
                Expires {expiryTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <CheckCircle2 size={16} className="text-emerald-400 ml-auto flex-shrink-0" />
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3 bg-red-500/10 border border-red-500/20">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-300">✕</button>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-5 bg-muted/40 p-1.5 rounded-2xl border border-border/50">
          {([
            { id: "wallet", label: "Overview", icon: "🪙" },
            { id: "redeem", label: "Redeem", icon: "👑" },
            { id: "history", label: "History", icon: "📋" },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab === id ? {
                background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.12))",
                color: "#fbbf24",
                border: "1px solid rgba(251,191,36,0.3)",
              } : { color: "var(--muted-foreground)" }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "wallet" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Ways to earn */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  <TrendingUp size={15} className="text-amber-400" /> Ways to Earn Coins
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {[
                  { icon: "📝", label: "Complete a Survey", coins: "Varies", desc: "Check active surveys" },
                  { icon: "🎯", label: "Practice Tests", coins: "+1 to +4", desc: "Based on score" },
                  { icon: "🌅", label: "Daily Login", coins: "+1/day", desc: "+5 at 7-day, +25 at 30-day" },
                  { icon: "🎁", label: "Admin Reward", coins: "Varies", desc: "Special events & contests" },
                ].map(({ icon, label, coins, desc }) => (
                  <div key={label} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                      {coins}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* How tests reward */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Trophy size={15} className="text-amber-400" /> Test Score Rewards
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border/30 overflow-hidden rounded-b-2xl">
                {[
                  { range: "95–100%", coins: "+4 Coins", color: "#22c55e" },
                  { range: "80–94%",  coins: "+3 Coins", color: "#3b82f6" },
                  { range: "60–79%",  coins: "+2 Coins", color: "#f59e0b" },
                  { range: "40–59%",  coins: "+1 Coin",  color: "#f97316" },
                  { range: "Below 40%", coins: "0 Coins", color: "#6b7280" },
                  { range: "Retake",  coins: "No Reward", color: "#6b7280" },
                ].map(({ range, coins, color }) => (
                  <div key={range} className="bg-card px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">{range}</span>
                    <span className="text-xs font-black" style={{ color }}>{coins}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Redeem Tab ── */}
        {tab === "redeem" && (
          <div className="space-y-4 animate-fade-in-up">
            <p className="text-sm text-muted-foreground text-center mb-2">
              Trade your coins for Premium membership. Monthly limits apply.
            </p>
            {REDEEM_PLANS.map((plan) => {
              const totalDays = plan.days + plan.bonus;
              const used = getRedeemUsed(plan.id);
              const limitReached = used >= plan.maxPerMonth;
              const canAfford = balance >= plan.coins;

              return (
                <div
                  key={plan.id}
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    background: limitReached
                      ? "rgba(255,255,255,0.02)"
                      : "linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(245,158,11,0.04) 100%)",
                    border: limitReached
                      ? "1px solid rgba(255,255,255,0.08)"
                      : "1.5px solid rgba(251,191,36,0.2)",
                    opacity: limitReached ? 0.6 : 1,
                  }}>
                  {plan.bonus > 0 && !limitReached && (
                    <div className="absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000" }}>
                      +{plan.bonus} BONUS
                    </div>
                  )}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
                        👑
                      </div>
                      <div>
                        <p className="font-black text-foreground">{plan.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {totalDays} days • {planMonthlyLabel(plan)}
                        </p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xl font-black text-amber-500">🪙 {plan.coins.toLocaleString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => !limitReached && setSelectedPlan(plan.id)}
                      disabled={limitReached || redeeming}
                      className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 disabled:cursor-not-allowed"
                      style={
                        limitReached
                          ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                          : !canAfford
                          ? { background: "rgba(251,191,36,0.06)", color: "rgba(251,191,36,0.4)", border: "1px solid rgba(251,191,36,0.15)" }
                          : {
                              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                              color: "#000",
                              boxShadow: "0 4px 16px rgba(251,191,36,0.35)",
                            }
                      }>
                      {limitReached ? "Monthly Limit Reached" : !canAfford ? `Need ${plan.coins - balance} more coins` : "Redeem Now"}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl bg-blue-500/5 border border-blue-500/15 px-5 py-4">
              <p className="text-xs text-blue-400/80 font-medium leading-relaxed">
                💡 Monthly limits reset on the 1st of each month. Redemption extends your current premium expiry.
              </p>
            </div>
          </div>
        )}

        {/* ── History Tab ── */}
        {tab === "history" && (
          <div className="animate-fade-in-up">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <History size={40} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Complete surveys and tests to earn coins!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 bg-card/80">
                    <span className="text-2xl flex-shrink-0">{txIcon(tx.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.reason}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock size={9} /> {fmtDate(tx.createdAt)}
                      </p>
                    </div>
                    <span className={`text-base font-black flex-shrink-0 ${tx.amount > 0 ? "text-amber-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} 🪙
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs & Animations ── */}
      {selectedPlan && (
        <RedeemDialog
          planId={selectedPlan}
          balance={balance}
          onCancel={() => setSelectedPlan(null)}
          onConfirm={handleConfirmRedeem}
        />
      )}

      <RedemptionAnimation
        visible={redeemAnimation}
        planLabel={redeemPlanDetails.label}
        days={redeemPlanDetails.days}
        onDone={() => setRedeemAnimation(false)}
      />
    </Layout>
  );
}
