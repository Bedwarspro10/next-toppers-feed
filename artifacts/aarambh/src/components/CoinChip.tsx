import { useRef } from "react";
import { Link } from "wouter";
import { useCoin } from "@/contexts/CoinContext";
import { CoinBurst, CoinEarnedToast } from "@/components/CoinAnimation";

/* ── Mobile topbar chip ─────────────────────────────────── */
export function CoinChipMobile() {
  const { balance, animating } = useCoin();
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <>
      <Link href="/wallet" ref={ref as any}>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-all select-none"
          style={{
            background: animating
              ? "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))"
              : "rgba(251,191,36,0.1)",
            border: `1.5px solid ${animating ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.25)"}`,
            boxShadow: animating ? "0 0 12px rgba(251,191,36,0.3)" : "none",
            transition: "all 0.3s ease",
          }}
        >
          <span className="text-sm" style={{ filter: animating ? "drop-shadow(0 0 4px #fbbf24)" : "none" }}>🪙</span>
          <span
            className="text-[11px] font-black"
            style={{ color: "#fbbf24", textShadow: animating ? "0 0 8px rgba(251,191,36,0.6)" : "none" }}
          >
            {balance.toLocaleString()}
          </span>
        </div>
      </Link>
      <CoinEarnedToast />
    </>
  );
}

/* ── Desktop sidebar chip ───────────────────────────────── */
export function CoinChipDesktop() {
  const { balance, animating, loginStreak } = useCoin();
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <>
      <Link href="/wallet" ref={ref as any}>
        <div
          className="px-3 py-2.5 rounded-xl cursor-pointer transition-all group"
          style={{
            background: animating
              ? "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1))"
              : "rgba(251,191,36,0.07)",
            border: `1px solid ${animating ? "rgba(251,191,36,0.5)" : "rgba(251,191,36,0.2)"}`,
            boxShadow: animating ? "0 0 16px rgba(251,191,36,0.2)" : "none",
            transition: "all 0.3s ease",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm" style={{ filter: animating ? "drop-shadow(0 0 4px #fbbf24)" : "none" }}>🪙</span>
              <span
                className="text-[12px] font-black"
                style={{ color: "#fbbf24", textShadow: animating ? "0 0 8px rgba(251,191,36,0.5)" : "none" }}
              >
                {balance.toLocaleString()} Coins
              </span>
            </div>
            {loginStreak > 1 && (
              <span className="text-[10px] font-bold text-orange-400 flex items-center gap-0.5">
                🔥{loginStreak}
              </span>
            )}
          </div>
          <div className="text-[9px] text-amber-400/50 font-semibold group-hover:text-amber-400/80 transition-colors">
            Tap to open wallet →
          </div>
        </div>
      </Link>
    </>
  );
}
