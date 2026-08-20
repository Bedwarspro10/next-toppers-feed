import { useEffect, useState } from "react";
import { Zap, TrendingUp, Flame, Trophy } from "lucide-react";
import { levelColor, levelTitle, xpProgressInLevel, xpForLevel } from "@/contexts/XPContext";

interface XPCardProps {
  xp: number;
  level: number;
  streak: number;
  leaderboardRank?: number | null;
}

export function XPCard({ xp, level, streak, leaderboardRank }: XPCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevXP, setPrevXP] = useState(xp);

  useEffect(() => {
    if (xp > prevXP) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1200);
      return () => clearTimeout(timer);
    }
    setPrevXP(xp);
    return undefined;
  }, [xp, prevXP]);

  const color = levelColor(level);
  const title = levelTitle(level);
  const progress = xpProgressInLevel(xp);
  const nextLevelXP = xpForLevel(level + 1);
  const currentLevelXP = xpForLevel(level);
  const xpInCurrentLevel = xp - currentLevelXP;
  const xpNeededInLevel = nextLevelXP - currentLevelXP;

  return (
    <div className="relative group">
      {/* Animated background glow */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none blur-2xl"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${color}40 0%, transparent 70%)`,
        }} />

      {/* Main card */}
      <div className="relative rounded-3xl overflow-hidden backdrop-blur-xl border transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`,
          border: `1.5px solid ${color}25`,
          boxShadow: `0 0 30px ${color}15, inset 0 1px 2px ${color}10`,
        }}>

        {/* Top section: Level badge + XP display */}
        <div className="px-6 py-6">
          <div className="flex items-start justify-between mb-5">
            {/* Level Badge */}
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-lg"
                style={{ background: `${color}30` }} />
              <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl transition-transform group-hover:scale-110 duration-300"
                style={{
                  background: `linear-gradient(135deg, ${color}25, ${color}12)`,
                  border: `2px solid ${color}40`,
                  boxShadow: `0 0 20px ${color}25, inset 0 0 10px ${color}15`,
                  color: color,
                }}>
                {level}
              </div>
            </div>

            {/* XP + Rank info */}
            <div className="text-right space-y-2">
              <div className={`flex items-baseline justify-end gap-1 transition-all duration-500 ${isAnimating ? "scale-110" : "scale-100"}`}>
                <span className="text-3xl font-black" style={{ color }}>{xp.toLocaleString()}</span>
                <span className="text-xs font-bold text-muted-foreground">XP</span>
              </div>
              {leaderboardRank && (
                <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: `rgba(251,191,36,0.12)`, border: `1px solid rgba(251,191,36,0.25)` }}>
                  <Trophy size={12} className="text-amber-500" />
                  <span className="text-xs font-bold text-amber-500">Rank #{leaderboardRank}</span>
                </div>
              )}
            </div>
          </div>

          {/* Title + Description */}
          <div className="mb-5">
            <p className="text-sm font-black tracking-tight" style={{ color }}>{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Level {level} · Next: {(nextLevelXP - xp).toLocaleString()} XP</p>
          </div>

          {/* Premium XP progress bar with animation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={12} style={{ color }} />
                <span className="text-xs font-bold text-foreground">{xpInCurrentLevel.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground/60">of {xpNeededInLevel.toLocaleString()}</span>
              </div>
              <span className="text-xs font-black" style={{ color }}>{Math.round(progress.pct * 100)}%</span>
            </div>

            {/* Animated progress bar */}
            <div className="relative h-3 rounded-full overflow-hidden"
              style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
              <div
                className="h-full rounded-full transition-all duration-1000 relative"
                style={{
                  width: `${Math.round(progress.pct * 100)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  boxShadow: `0 0 12px ${color}60, inset 0 1px 2px ${color}40`,
                }}>
                {/* Shimmer effect on progress */}
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <div className="h-full w-full"
                    style={{
                      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
                      animation: "shimmer 2s infinite",
                    }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 border-t" style={{ borderColor: `${color}15` }}>
          {[
            { icon: Flame, value: streak, label: "Streak", color: "#f97316" },
            { icon: TrendingUp, value: `Lvl ${level}`, label: "Current", color: color },
            { icon: Zap, value: Math.round(progress.pct * 100), label: "Progress", color: color },
            { icon: Trophy, value: leaderboardRank ? `#${leaderboardRank}` : "—", label: "Rank", color: "#f59e0b" },
          ].map(({ icon: Icon, value, label, color: iconColor }) => (
            <div key={label} className="flex flex-col items-center justify-center py-3.5 gap-1 hover:bg-secondary/30 transition-colors"
              style={{ borderRight: `1px solid ${color}10` }}>
              <Icon size={14} style={{ color: iconColor }} />
              <p className="font-black text-sm leading-none" style={{ color: iconColor }}>{value}</p>
              <p className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* XP gain animation floater */}
        {isAnimating && (
          <div className="absolute top-6 right-6 pointer-events-none animate-bounce" style={{ animation: "xpBounce 1.2s ease-out" }}>
            <div className="text-lg font-black" style={{ color }}>
              +{(xp - prevXP).toLocaleString()} XP
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes xpBounce {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-40px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
