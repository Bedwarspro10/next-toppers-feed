/**
 * Premium Achievement Card Component
 * Displays individual achievement with locked/unlocked states
 * Elegant icons, progress counters, glow effects
 */
import React from "react";

interface AchievementCardProps {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  unlocked: boolean;
  progress?: { current: number; required: number };
  xpReward?: number;
  color: string;
}

export function AchievementCard({
  title,
  icon: Icon,
  unlocked,
  progress,
  xpReward,
  color,
}: AchievementCardProps) {
  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
  
  const progressPct = progress ? Math.min(1, progress.current / progress.required) : 0;
  const showProgress = progress && !unlocked;

  return (
    <div
      className="flex flex-col items-center gap-2.5 p-3.5 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 w-24"
      style={{
        background: unlocked
          ? isDark
            ? `${color}15`
            : `${color}08`
          : isDark
          ? "rgba(255,255,255,0.03)"
          : "rgba(0,0,0,0.02)",
        border: `1.5px solid ${unlocked ? `${color}40` : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
        boxShadow: unlocked && isDark ? `0 0 12px ${color}30` : "none",
        opacity: unlocked ? 1 : 0.5,
      }}
    >
      {/* Icon Box */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
        style={{
          background: unlocked ? `${color}25` : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          border: `1px solid ${unlocked ? `${color}50` : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
          boxShadow: unlocked && isDark ? `0 0 8px ${color}40` : "none",
        }}
      >
        <span style={{ color: unlocked ? color : isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}>
          <Icon size={20} />
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-bold text-center leading-tight line-clamp-2" style={{ color: unlocked ? "currentColor" : "rgba(128,128,128,0.7)" }}>
        {title}
      </p>

      {/* Status Badge */}
      {showProgress ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}20` }}>
          {progress.current}/{progress.required}
        </span>
      ) : (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: unlocked ? color : "rgba(128,128,128,0.5)", background: unlocked ? `${color}20` : "rgba(128,128,128,0.1)" }}>
          {unlocked ? "Unlocked" : "Locked"}
        </span>
      )}

      {/* Progress Bar */}
      {showProgress && (
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct * 100}%`,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              boxShadow: isDark ? `0 0 6px ${color}60` : "none",
            }}
          />
        </div>
      )}

      {/* XP Reward */}
      {unlocked && xpReward ? (
        <span className="text-[8px] font-black" style={{ color }}>
          +{xpReward} XP
        </span>
      ) : null}
    </div>
  );
}
