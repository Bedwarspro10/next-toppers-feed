/**
 * Premium Profile Page — Phase 2 Redesign
 * Matches uploaded reference with dark/light mode premium styling
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { doc, updateDoc, collection, onSnapshot, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { useXP, xpProgressInLevel, levelTitle, levelColor, ACHIEVEMENTS } from "@/contexts/XPContext";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  Crown, Shield, LogOut, Edit2, Check, X, ChevronRight,
  Flame, TrendingUp, Zap, Trophy, Mail,
  BookOpen, FlaskConical, Globe, Sigma, Lock,
  Star, Target, Award, Gem, ChevronLeft,
  Smartphone, Copy, Eye, EyeOff, RefreshCw, Download,
} from "lucide-react";
import { Link } from "wouter";

interface LeaderboardEntry {
  uid: string;
  name: string;
  photoURL?: string;
  xp: number;
  level: number;
}

/* Achievement icon map — no emojis */
const ACH_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  lvl1: Star, lvl5: Star, lvl10: Award, lvl15: Award, lvl20: Award,
  lvl30: Trophy, lvl50: Trophy, lvl70: Trophy, lvl100: Gem,
  quiz1: BookOpen, quiz10: BookOpen, quiz50: Target, quiz100: Target,
  perfect1: Zap, perfect5: Zap, accuracy80: Zap,
  streak7: Flame, streak30: Flame, streak60: Flame,
  maths10: Sigma, maths25: Sigma,
  science10: FlaskConical, science25: FlaskConical,
  sst10: Globe, sst25: Globe,
  allSubjects: Crown,
  firstBrood: Zap, weekWarrior: Flame,
};

const ACH_COLORS: Record<string, string> = {
  lvl1: "#6b7280", lvl5: "#3b82f6", lvl10: "#8b5cf6", lvl15: "#8b5cf6",
  lvl20: "#8b5cf6", lvl30: "#10b981", lvl50: "#f59e0b", lvl70: "#f97316",
  lvl100: "#ef4444",
  quiz1: "#3b82f6", quiz10: "#3b82f6", quiz50: "#06b6d4", quiz100: "#06b6d4",
  perfect1: "#f59e0b", perfect5: "#f59e0b", accuracy80: "#f59e0b",
  streak7: "#f97316", streak30: "#f97316", streak60: "#ef4444",
  maths10: "#3b82f6", maths25: "#3b82f6",
  science10: "#10b981", science25: "#10b981",
  sst10: "#8b5cf6", sst25: "#8b5cf6",
  allSubjects: "#ec4899",
  firstBrood: "#f97316", weekWarrior: "#06b6d4",
};

/* Hexagonal clip path for achievement badges */
const HEX_CLIP = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

/* ── Achievement badge (used in both the scroll row and the full modal) ── */
function AchBadge({
  ach, unlocked, size = "md",
}: {
  ach: (typeof ACHIEVEMENTS)[0];
  unlocked: boolean;
  size?: "sm" | "md";
}) {
  const Icon = ACH_ICONS[ach.id] ?? Trophy;
  const color = ACH_COLORS[ach.id] ?? "#6b7280";
  const dim = size === "sm" ? { hex: 48, hexH: 54, icon: 18 } : { hex: 56, hexH: 62, icon: 22 };

  return (
    <div
      className={`flex flex-col items-center gap-1.5 flex-shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 ${size === "md" ? "w-[72px]" : "w-[64px]"}`}
    >
      <div className="relative" style={{ width: dim.hex, height: dim.hexH }}>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            clipPath: HEX_CLIP,
            background: unlocked
              ? `linear-gradient(145deg, ${color}ee, ${color}99)`
              : "rgba(128,128,128,0.15)",
            boxShadow: unlocked ? `0 0 14px ${color}45` : "none",
            opacity: unlocked ? 1 : 0.45,
          }}
        >
          {unlocked
            ? <Icon size={dim.icon} className="text-white" />
            : <Lock size={dim.icon - 4} className="opacity-40" />
          }
        </div>
      </div>

      <p
        className="text-[10px] font-bold text-center leading-tight line-clamp-2"
        style={{ color: unlocked ? "hsl(var(--foreground))" : "rgba(128,128,128,0.55)" }}
      >
        {ach.title}
      </p>

      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
        style={{
          color: unlocked ? color : "rgba(128,128,128,0.45)",
          background: unlocked ? `${color}20` : "rgba(128,128,128,0.07)",
        }}
      >
        {unlocked ? "Unlocked" : "Locked"}
      </span>
    </div>
  );
}

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const { isPremium, plan, expiryTime, loading } = usePremium();
  const { setOpen: openPremium } = usePremiumModal();
  const { xpData } = useXP();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [topLeaderboardUsers, setTopLeaderboardUsers] = useState<LeaderboardEntry[]>([]);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  /* ── Android App Login state ── */
  const [appPassword, setAppPassword] = useState<string | null>(null);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [appPasswordLoading, setAppPasswordLoading] = useState(false);
  const [appDownloadUrl, setAppDownloadUrl] = useState<string>("");

  /* ── streak: prefer Firestore, fall back to localStorage ── */
  const firestoreStreak = xpData?.streak ?? 0;
  const localStreak = parseInt(localStorage.getItem("nt_day_streak") ?? "0", 10);
  const streak = Math.max(firestoreStreak, localStreak);

  /* ── achievements: read from xpData.achievements (the correct location) ── */
  const unlockedAchievements: string[] = xpData?.achievements ?? [];

  const xp = xpData?.xp ?? 0;
  const level = xpData?.level ?? 0;
  const lvlColor = levelColor(level);
  const lvlTitle = levelTitle(level);
  const xpProgress = xpProgressInLevel(xp);

  useEffect(() => {
    if (!user && !loading) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "leaderboard"), (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map(d => ({
        uid: d.id,
        name: d.data().name ?? "Unknown",
        photoURL: d.data().photoURL,
        xp: d.data().xp ?? 0,
        level: d.data().level ?? 0,
      }));
      entries.sort((a, b) => b.xp - a.xp);
      const idx = entries.findIndex(e => e.uid === user.uid);
      setLeaderboardRank(idx >= 0 ? idx + 1 : null);
      setTopLeaderboardUsers(entries.slice(0, 3));
    }, () => {});
    return unsub;
  }, [user]);

  const daysLeft = expiryTime
    ? Math.max(0, Math.ceil((expiryTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleSignOut = () => signOut(auth).then(() => navigate("/"));

  /* ── Android App Login helpers ── */
  function generateSecurePassword(): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*";
    const all = upper + lower + digits + symbols;
    const length = 12 + Math.floor(Math.random() * 5); // 12–16
    const arr: string[] = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = arr.length; i < length; i++) {
      arr.push(all[Math.floor(Math.random() * all.length)]);
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join("");
  }

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data();
        if (data?.appPassword) {
          setAppPassword(data.appPassword);
        } else {
          const pwd = generateSecurePassword();
          await updateDoc(ref, { appPassword: pwd });
          setAppPassword(pwd);
        }
        const cfgSnap = await getDoc(doc(db, "settings", "appConfig"));
        setAppDownloadUrl(cfgSnap.data()?.androidAppDownloadUrl ?? "");
      } catch { /* silent */ }
    };
    load();
  }, [user]);

  const refreshAppPassword = async () => {
    if (!user) return;
    setAppPasswordLoading(true);
    try {
      const pwd = generateSecurePassword();
      await updateDoc(doc(db, "users", user.uid), { appPassword: pwd });
      setAppPassword(pwd);
      setShowAppPassword(false);
      toast({ title: "Password refreshed", description: "New app password is ready." });
    } catch {
      toast({ title: "Failed to refresh", variant: "destructive" });
    } finally {
      setAppPasswordLoading(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: `${label} copied` });
    });
  };

  const saveDisplayName = async () => {
    if (!user || !displayName.trim()) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { name: displayName.trim() });
      toast({ title: "Profile updated" });
      setEditing(false);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  if (loading || !user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </Layout>
    );
  }

  const initials = (user.displayName ?? "S").charAt(0).toUpperCase();

  /* ── All Achievements Modal ── */
  if (showAllAchievements) {
    const categories = [
      { key: "level",   label: "Level" },
      { key: "quiz",    label: "Quiz" },
      { key: "streak",  label: "Streak" },
      { key: "subject", label: "Subject" },
      { key: "special", label: "Special" },
    ] as const;

    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setShowAllAchievements(false)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <div>
              <h1 className="text-lg font-black text-foreground leading-tight">All Achievements</h1>
              <p className="text-xs text-muted-foreground">
                <span className="font-bold" style={{ color: lvlColor }}>{unlockedAchievements.length}</span>
                /{ACHIEVEMENTS.length} unlocked
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="p-4 rounded-2xl mb-5"
            style={{ background: "hsl(var(--card))", border: `1px solid ${lvlColor}30` }}
          >
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span style={{ color: lvlColor }}>
                {Math.round((unlockedAchievements.length / ACHIEVEMENTS.length) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((unlockedAchievements.length / ACHIEVEMENTS.length) * 100)}%`,
                  background: `linear-gradient(90deg, ${lvlColor}cc, ${lvlColor})`,
                  boxShadow: `0 0 8px ${lvlColor}60`,
                }}
              />
            </div>
          </div>

          {/* Achievements by category */}
          <div className="space-y-5">
            {categories.map(({ key, label }) => {
              const list = ACHIEVEMENTS.filter(a => a.category === key);
              const unlockedCount = list.filter(a => unlockedAchievements.includes(a.id)).length;
              return (
                <div
                  key={key}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                >
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-sm font-black text-foreground">{label}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${lvlColor}18`, color: lvlColor }}
                    >
                      {unlockedCount}/{list.length}
                    </span>
                  </div>
                  <div className="p-4 flex flex-wrap gap-3">
                    {list.map(ach => (
                      <AchBadge
                        key={ach.id}
                        ach={ach}
                        unlocked={unlockedAchievements.includes(ach.id)}
                        size="sm"
                      />
                    ))}
                  </div>
                  {/* Description tooltips for unlocked */}
                  {list.some(a => unlockedAchievements.includes(a.id)) && (
                    <div className="px-4 pb-3 space-y-1">
                      {list.filter(a => unlockedAchievements.includes(a.id)).map(a => (
                        <div key={a.id} className="flex items-start gap-2 text-[10px]">
                          <Check size={10} className="mt-0.5 flex-shrink-0" style={{ color: ACH_COLORS[a.id] ?? lvlColor }} />
                          <span className="text-muted-foreground">
                            <span className="font-bold text-foreground">{a.title}</span> — {a.description}
                            {a.xpReward > 0 && (
                              <span className="ml-1 font-bold" style={{ color: lvlColor }}>+{a.xpReward} XP</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-4">

        {/* PROFILE HEADER */}
        <div className="flex items-start gap-4 pt-2">
          {/* Avatar with glowing ring */}
          <div className="relative flex-shrink-0">
            <div
              className="w-24 h-24 rounded-full p-[3px] flex items-center justify-center"
              style={{
                background: `conic-gradient(from 0deg, ${lvlColor}, #a78bfa, #06b6d4, ${lvlColor})`,
                boxShadow: `0 0 24px ${lvlColor}50, 0 0 48px ${lvlColor}20`,
                animation: "spin 8s linear infinite",
              }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-2xl font-black"
                    style={{ background: `linear-gradient(135deg, ${lvlColor}40, ${lvlColor}20)`, color: lvlColor }}
                  >
                    {initials}
                  </div>
                )}
              </div>
            </div>
            {/* Edit icon */}
            <button
              onClick={() => setEditing(true)}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-background shadow-lg transition-all hover:scale-110"
              style={{ background: lvlColor }}
            >
              <Edit2 size={12} className="text-white" />
            </button>
            {isPremium && (
              <div
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-background"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 8px #f59e0b60" }}
              >
                <Crown size={11} className="text-white" />
              </div>
            )}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0 pt-1">
            {editing ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm font-bold border border-border bg-card text-foreground outline-none focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDisplayName();
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
                <button onClick={saveDisplayName} className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600">
                  <Check size={14} />
                </button>
                <button onClick={() => { setEditing(false); setDisplayName(user.displayName ?? ""); }} className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <h1 className="text-[22px] font-black text-foreground leading-tight mb-0.5">{user.displayName ?? "Student"}</h1>
            )}

            <div className="flex items-center gap-1.5 mb-2.5 text-xs text-muted-foreground">
              <Mail size={11} className="flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  style={{
                    background: "linear-gradient(135deg, #312e81, #4338ca)",
                    color: "white",
                    border: "1px solid rgba(99,102,241,0.4)",
                    boxShadow: "0 0 8px rgba(99,102,241,0.3)",
                  }}
                >
                  <Shield size={10} /> Admin
                </span>
              )}
              {isPremium && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  style={{
                    background: "linear-gradient(135deg, #78350f, #b45309)",
                    color: "#fcd34d",
                    border: "1px solid rgba(245,158,11,0.4)",
                    boxShadow: "0 0 8px rgba(245,158,11,0.3)",
                  }}
                >
                  <Crown size={10} /> Premium
                </span>
              )}
              {!isPremium && !isAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground">
                  Free Member
                </span>
              )}
            </div>
          </div>
        </div>

        {/* XP / LEVEL CARD */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "hsl(var(--card))",
            border: `2px solid ${lvlColor}50`,
            boxShadow: `0 0 28px ${lvlColor}18`,
          }}
        >
          <div className="p-5 space-y-4">
            {/* Top: Badge + Title + XP */}
            <div className="flex items-center gap-4">
              {/* Hexagonal Shield Badge */}
              <div className="flex-shrink-0 relative" style={{ width: 72, height: 80 }}>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{
                    clipPath: HEX_CLIP,
                    background: `linear-gradient(145deg, ${lvlColor}ee, ${lvlColor}88)`,
                    boxShadow: `0 0 20px ${lvlColor}60`,
                  }}
                >
                  <span className="text-[9px] font-black text-white/80 uppercase tracking-widest leading-none">LEVEL</span>
                  <span className="text-[28px] font-black text-white leading-none">{level}</span>
                </div>
              </div>

              {/* Title + XP */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg font-black text-foreground">{lvlTitle}</span>
                  <span className="text-xs font-bold text-muted-foreground italic">Keep learning!</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Level {level} · Next: {(xpProgress.needed - xpProgress.current).toLocaleString()} XP to Level {level + 1}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-3xl font-black" style={{ color: lvlColor, textShadow: `0 0 16px ${lvlColor}60` }}>
                    {xp.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">XP</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-muted-foreground">{xpProgress.current.toLocaleString()} / {xpProgress.needed.toLocaleString()} XP</span>
                <span style={{ color: lvlColor }}>{Math.round(xpProgress.pct * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                <div
                  className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                  style={{
                    width: `${Math.round(xpProgress.pct * 100)}%`,
                    background: `linear-gradient(90deg, ${lvlColor}cc, ${lvlColor})`,
                    boxShadow: `0 0 12px ${lvlColor}80`,
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </div>
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Flame,      value: streak,                               label: "Streak",   color: "#f97316" },
                { icon: TrendingUp, value: `Lvl ${level}`,                       label: "Current",  color: lvlColor },
                { icon: Zap,        value: `${Math.round(xpProgress.pct * 100)}`, label: "Progress", color: "#06b6d4" },
                { icon: Trophy,     value: leaderboardRank ? `#${leaderboardRank}` : "—", label: "Rank", color: "#f59e0b" },
              ].map(({ icon: Icon, value, label, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl"
                  style={{
                    background: `${color}0d`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  <Icon size={15} style={{ color }} />
                  <p className="font-black text-sm text-foreground leading-none">{value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LEADERBOARD PREVIEW */}
        <Link href="/leaderboard">
          <div
            className="rounded-2xl p-4 cursor-pointer transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "hsl(var(--card))",
              border: "2px solid rgba(245,158,11,0.35)",
              boxShadow: "0 0 20px rgba(245,158,11,0.12)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #f59e0b25, #f59e0b10)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  boxShadow: "0 0 12px rgba(245,158,11,0.2)",
                }}
              >
                <Trophy size={20} className="text-amber-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">Leaderboard</p>
                <p className="text-[11px] text-muted-foreground">See how you rank globally</p>
              </div>

              <div className="flex items-center">
                <div className="flex items-center">
                  {topLeaderboardUsers.slice(0, 3).map((u, i) => (
                    <div
                      key={u.uid}
                      className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                      style={{
                        background: `hsl(${[250, 40, 150][i % 3]}, 70%, 55%)`,
                        marginLeft: i > 0 ? -8 : 0,
                        zIndex: 3 - i,
                        position: "relative",
                      }}
                    >
                      {u.photoURL
                        ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        : u.name.charAt(0).toUpperCase()
                      }
                    </div>
                  ))}
                </div>
                <ChevronRight size={15} className="text-muted-foreground/50 ml-2" />
              </div>
            </div>

            {topLeaderboardUsers.length > 0 && (
              <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "rgba(245,158,11,0.15)" }}>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-bold" style={{ color: "#f59e0b" }}>Top 1:</span>{" "}
                  {topLeaderboardUsers[0].xp.toLocaleString()} XP
                </p>
              </div>
            )}
          </div>
        </Link>

        {/* ACHIEVEMENTS */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        >
          <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
            <p className="text-sm font-black text-foreground">Achievements</p>
            <button
              onClick={() => setShowAllAchievements(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: `${lvlColor}18`, color: lvlColor }}
            >
              View all
            </button>
          </div>

          {/* Horizontal scroll achievement row */}
          <div className="p-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex gap-3 w-max">
              {ACHIEVEMENTS.map((ach) => (
                <AchBadge
                  key={ach.id}
                  ach={ach}
                  unlocked={unlockedAchievements.includes(ach.id)}
                  size="md"
                />
              ))}
            </div>
          </div>

          <div className="px-4 pb-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground">
              <span className="font-bold" style={{ color: lvlColor }}>{unlockedAchievements.length}</span>
              /{ACHIEVEMENTS.length} unlocked · scroll to see all
            </p>
          </div>
        </div>

        {/* PREMIUM MEMBERSHIP */}
        {isPremium ? (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1e1035 0%, #160d2e 50%, #0d1525 100%)",
              border: "2px solid rgba(139,92,246,0.45)",
              boxShadow: "0 0 32px rgba(139,92,246,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      boxShadow: "0 0 20px rgba(124,58,237,0.5)",
                    }}
                  >
                    <Crown size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-white text-sm">Premium Member</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest"
                        style={{ background: "linear-gradient(90deg, #10b981, #059669)", color: "white" }}
                      >
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-300/70">
                      {plan === "day" ? "Daily Plan" : "Monthly Plan"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openPremium(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{
                    background: "rgba(139,92,246,0.25)",
                    border: "1px solid rgba(139,92,246,0.5)",
                    color: "#c4b5fd",
                  }}
                >
                  Manage
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Days Left",
                    value: daysLeft !== null ? daysLeft.toLocaleString() : "—",
                    color: daysLeft === 0 ? "#ef4444" : daysLeft !== null && daysLeft <= 3 ? "#f97316" : "#06b6d4",
                  },
                  {
                    label: "Expires On",
                    value: expiryTime
                      ? expiryTime.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })
                      : "—",
                    color: "#f59e0b",
                  },
                  { label: "Plan", value: plan === "day" ? "Daily" : "Monthly", color: "#06b6d4" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-[9px] text-purple-300/60 font-bold uppercase tracking-wider mb-1">{label}</p>
                    <p className="font-black text-base leading-tight" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Premium Content", icon: Crown, color: "#a78bfa" },
                  { label: "No Ads",           icon: Shield, color: "#34d399" },
                  { label: "Priority Support", icon: Star,   color: "#60a5fa" },
                  { label: "Exclusive Badges", icon: Award,  color: "#fb923c" },
                ].map(({ label, icon: Icon, color }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg"
                    style={{ background: `${color}12`, border: `1px solid ${color}30`, color }}
                  >
                    <Icon size={11} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : !isAdmin ? (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.05) 100%)",
              border: "2px solid rgba(245,158,11,0.3)",
              boxShadow: "0 0 20px rgba(245,158,11,0.1)",
            }}
          >
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    boxShadow: "0 0 16px rgba(245,158,11,0.4)",
                  }}
                >
                  <Crown size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">Upgrade to Premium</p>
                  <p className="text-xs text-muted-foreground">Unlock all subjects and features</p>
                </div>
              </div>
              <button
                onClick={() => openPremium(true)}
                className="px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        ) : null}

        {/* ANDROID APP LOGIN */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(6,182,212,0.04) 100%)",
            border: "1.5px solid rgba(16,185,129,0.3)",
            boxShadow: "0 0 24px rgba(16,185,129,0.08)",
          }}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #10b981, #06b6d4)",
                boxShadow: "0 0 16px rgba(16,185,129,0.4)",
              }}
            >
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <p className="font-black text-sm text-foreground leading-tight">Android App Login</p>
              <p className="text-[11px] text-muted-foreground">Use these credentials to sign in to the app</p>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
            {/* User ID */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">User ID</p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-xs font-mono font-bold text-foreground bg-background/60 rounded-lg px-3 py-2 truncate"
                  style={{ border: "1px solid rgba(16,185,129,0.2)" }}
                >
                  {user.uid}
                </code>
                <button
                  onClick={() => copyText(user.uid, "User ID")}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    boxShadow: "0 4px 12px rgba(16,185,129,0.35)",
                  }}
                >
                  <Copy size={14} className="text-white" />
                </button>
              </div>
            </div>

            {/* App Password */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)" }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">App Password</p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 text-xs font-mono font-bold text-foreground bg-background/60 rounded-lg px-3 py-2 min-h-[36px] flex items-center"
                  style={{ border: "1px solid rgba(6,182,212,0.2)" }}
                >
                  {appPassword
                    ? (showAppPassword ? appPassword : "•".repeat(12))
                    : <span className="text-muted-foreground">Loading…</span>
                  }
                </div>
                <button
                  onClick={() => setShowAppPassword(v => !v)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 active:scale-95"
                  style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}
                >
                  {showAppPassword
                    ? <EyeOff size={14} className="text-cyan-500" />
                    : <Eye size={14} className="text-cyan-500" />
                  }
                </button>
                {appPassword && (
                  <button
                    onClick={() => copyText(appPassword, "App Password")}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 active:scale-95"
                    style={{
                      background: "linear-gradient(135deg, #06b6d4, #0284c7)",
                      boxShadow: "0 4px 12px rgba(6,182,212,0.35)",
                    }}
                  >
                    <Copy size={14} className="text-white" />
                  </button>
                )}
              </div>
              <button
                onClick={refreshAppPassword}
                disabled={appPasswordLoading}
                className="flex items-center gap-1.5 text-[11px] font-bold transition-all hover:opacity-80 active:scale-95 disabled:opacity-50"
                style={{ color: "#06b6d4" }}
              >
                <RefreshCw size={11} className={appPasswordLoading ? "animate-spin" : ""} />
                {appPasswordLoading ? "Refreshing…" : "Refresh Password"}
              </button>
            </div>

            {/* Helper + GET APP */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-foreground">Where to use this?</p>
                <p className="text-[11px] text-muted-foreground">Download our Android app and login there.</p>
              </div>
              <button
                onClick={() => { if (appDownloadUrl) window.open(appDownloadUrl, "_blank"); }}
                disabled={!appDownloadUrl}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:opacity-90 active:scale-95 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #10b981, #06b6d4)",
                  boxShadow: appDownloadUrl ? "0 4px 14px rgba(16,185,129,0.4)" : "none",
                }}
              >
                <Download size={13} />
                GET APP
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="pt-2 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/subjects">
              <div className="p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)" }}>
                <BookOpen size={14} className="text-blue-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground">Browse Subjects</span>
              </div>
            </Link>
            <Link href="/leaderboard">
              <div className="p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <Trophy size={14} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground">Leaderboard</span>
              </div>
            </Link>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              boxShadow: "0 4px 16px rgba(239,68,68,0.25)",
            }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        <div className="pb-4" />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}
