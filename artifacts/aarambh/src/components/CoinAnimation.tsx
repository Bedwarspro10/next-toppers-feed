import { useEffect, useRef, useState } from "react";
import { useCoin } from "@/contexts/CoinContext";

/* ── Floating coin particle ──────────────────────────────── */
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  scale: number;
  rotation: number;
}

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

/* ── Floating coin burst (positioned absolutely near trigger) */
export function CoinBurst({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const { animating, animationDelta } = useCoin();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const prevAnimating = useRef(false);

  useEffect(() => {
    if (animating && !prevAnimating.current && animationDelta > 0) {
      // Find target position
      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        setTargetPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
      const count = Math.min(8, 3 + Math.floor(animationDelta / 2));
      const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: randomBetween(-3, 3),
        vy: randomBetween(-6, -2),
        opacity: 1,
        scale: randomBetween(0.7, 1.3),
        rotation: randomBetween(-30, 30),
      }));
      setParticles(newParticles);
    }
    prevAnimating.current = animating;
  }, [animating, animationDelta, targetRef]);

  useEffect(() => {
    if (particles.length === 0) return;
    const timeout = setTimeout(() => setParticles([]), 2200);
    return () => clearTimeout(timeout);
  }, [particles]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]" style={{ overflow: "hidden" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute text-2xl select-none"
          style={{
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
            animation: `coinFly 2s ease-out forwards`,
            animationDelay: `${Math.random() * 0.2}s`,
            filter: "drop-shadow(0 0 6px #fbbf24)",
          }}
        >
          🪙
        </div>
      ))}
      <style>{`
        @keyframes coinFly {
          0%   { transform: translate(-50%,-50%) scale(1.2); opacity: 1; }
          30%  { opacity: 1; }
          100% { transform: translate(calc(-50% + ${targetPos.x - window.innerWidth/2}px), calc(-50% + ${targetPos.y - window.innerHeight/2}px)) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Coin earned toast ─────────────────────────────────────── */
export function CoinEarnedToast() {
  const { animating, animationDelta } = useCoin();
  const [visible, setVisible] = useState(false);
  const [delta, setDelta] = useState(0);
  const prevAnimating = useRef(false);

  useEffect(() => {
    if (animating && !prevAnimating.current && animationDelta > 0) {
      setDelta(animationDelta);
      setVisible(true);
      setTimeout(() => setVisible(false), 2200);
    }
    prevAnimating.current = animating;
  }, [animating, animationDelta]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-20 right-4 z-[9998] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl"
      style={{
        background: "linear-gradient(135deg, #1a1200 0%, #2d1f00 100%)",
        border: "1.5px solid rgba(251,191,36,0.5)",
        backdropFilter: "blur(12px)",
        animation: "slideInRight 0.3s ease, fadeOut 0.4s ease 1.8s forwards",
      }}
    >
      <span className="text-xl">🪙</span>
      <div>
        <p className="text-xs font-black text-amber-400">+{delta} Coins Earned!</p>
        <div className="w-full h-0.5 rounded-full mt-1" style={{
          background: "linear-gradient(90deg, #fbbf24, transparent)",
          animation: "shrink 2s linear forwards",
        }} />
      </div>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; transform: translateY(-8px); } }
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}

/* ── Full-screen redemption animation ─────────────────────── */
interface RedemptionAnimationProps {
  visible: boolean;
  planLabel: string;
  days: number;
  onDone: () => void;
}

export function RedemptionAnimation({ visible, planLabel, days, onDone }: RedemptionAnimationProps) {
  const [phase, setPhase] = useState<"flip" | "success">("flip");

  useEffect(() => {
    if (!visible) { setPhase("flip"); return; }
    const t1 = setTimeout(() => setPhase("success"), 1800);
    const t2 = setTimeout(() => onDone(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
    >
      {/* Golden particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `particleDrift ${2 + Math.random() * 2}s ease-in-out ${Math.random() * 1}s infinite alternate`,
              opacity: 0.6,
            }}
          >
            ✨
          </div>
        ))}
      </div>

      {phase === "flip" ? (
        <div className="flex flex-col items-center gap-6">
          {/* Spinning coin */}
          <div
            className="text-[100px] select-none"
            style={{
              animation: "coinSpin 0.6s linear infinite",
              filter: "drop-shadow(0 0 32px #fbbf24) drop-shadow(0 0 60px #f59e0b)",
            }}
          >
            🪙
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-amber-400">Activating Premium...</p>
            <p className="text-amber-400/60 text-sm mt-1">{planLabel}</p>
          </div>
          {/* Loading bar */}
          <div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ animation: "loadBar 1.8s linear forwards" }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6" style={{ animation: "scaleIn 0.4s ease" }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", boxShadow: "0 0 48px #fbbf2460" }}>
            <span className="text-5xl">✓</span>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-white mb-1">Premium Activated!</p>
            <p className="text-amber-400 text-lg font-bold">{days} Days Unlocked 🎉</p>
            <p className="text-white/40 text-sm mt-2">{planLabel}</p>
          </div>
          {/* Stars burst */}
          <div className="flex gap-3 text-3xl">
            {["⭐","🌟","✨","🌟","⭐"].map((s, i) => (
              <span key={i} style={{ animation: `starPop 0.3s ease ${i * 0.08}s both` }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes coinSpin {
          0%   { transform: rotateY(0deg) scale(1); }
          50%  { transform: rotateY(180deg) scale(1.1); }
          100% { transform: rotateY(360deg) scale(1); }
        }
        @keyframes loadBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes starPop {
          from { transform: scale(0) rotate(-20deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes particleDrift {
          from { transform: translateY(0) rotate(0deg); opacity: 0.4; }
          to   { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
