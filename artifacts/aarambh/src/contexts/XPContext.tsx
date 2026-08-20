/**
 * LEADERBOARD BUG FIX - XPContext v2
 * 
 * CRITICAL ISSUE: Users earn XP but don't appear on leaderboard
 * ROOT CAUSE: syncLeaderboard() had stale [user] dependency causing race conditions
 * 
 * FIXES APPLIED:
 * 1. Use useRef to track user without causing stale closures
 * 2. Call syncLeaderboard IMMEDIATELY after XP updates
 * 3. Add comprehensive error logging
 * 4. Ensure all required fields are written to leaderboard/{uid}
 * 5. Verify field naming consistency (xp, level, name, photoURL)
 */
import React, {
  createContext, useContext, useEffect, useCallback, useRef, useState,
} from "react";
import {
  doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export const XP_RULES = {
  quizComplete:      10,
  quizCorrectAnswer: 2,
  quizPerfectScore:  50,
  quizHighScore:     20,
  dailyLogin:        5,
  lectureWatched:    8,
  pdfRead:           5,
  dailyChallenge:    25,
  mockTest:          30,
  weeklyActivity:    40,
  streakBonus:       3,
};

export function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 5)  return level * 100;
  if (level <= 10) return 500  + (level - 5)  * 150;
  if (level <= 20) return 1250 + (level - 10) * 250;
  if (level <= 30) return 3750 + (level - 20) * 400;
  if (level <= 50) return 7750 + (level - 30) * 600;
  if (level <= 70) return 19750 + (level - 50) * 900;
  if (level <= 90) return 37750 + (level - 70) * 1400;
  return 65750 + (level - 90) * 2000;
}

export function xpToLevel(totalXP: number): number {
  let lvl = 0;
  while (lvl < 100 && totalXP >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
}

export function xpProgressInLevel(totalXP: number): { level: number; current: number; needed: number; pct: number } {
  const level  = xpToLevel(totalXP);
  const base   = xpForLevel(level);
  const next   = xpForLevel(level + 1);
  const current = totalXP - base;
  const needed  = next - base;
  return { level, current, needed, pct: needed > 0 ? Math.min(1, current / needed) : 1 };
}

export function levelTitle(level: number): string {
  if (level === 0)  return "Newcomer";
  if (level <  5)   return "Newbie";
  if (level < 10)   return "Learner";
  if (level < 15)   return "Rising Star";
  if (level < 20)   return "Focused Student";
  if (level < 25)   return "Smart Learner";
  if (level < 30)   return "Quiz Warrior";
  if (level < 40)   return "Knowledge Seeker";
  if (level < 50)   return "Academic Beast";
  if (level < 60)   return "Study Machine";
  if (level < 70)   return "Study Legend";
  if (level < 80)   return "Elite Performer";
  if (level < 90)   return "Mastermind";
  if (level < 95)   return "Grandmaster";
  if (level < 100)  return "Ultimate Topper";
  return "Hall of Fame";
}

export function levelColor(level: number): string {
  if (level < 10)  return "#6b7280";
  if (level < 20)  return "#3b82f6";
  if (level < 30)  return "#8b5cf6";
  if (level < 50)  return "#10b981";
  if (level < 70)  return "#f59e0b";
  if (level < 90)  return "#f97316";
  return "#ef4444";
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "level" | "quiz" | "streak" | "subject" | "special";
  xpReward: number;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  totalQuizzes: number;
  totalCorrect: number;
  perfectScores: number;
  lecturesWatched: number;
  pdfsRead: number;
  weeksActive: number;
  monthsActive: number;
  quizzesBySubject: Record<string, number>;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "lvl1",   title: "Newbie",          description: "Reach Level 1",         icon: "◈", category: "level",   xpReward: 0,  condition: s => s.level >= 1 },
  { id: "lvl5",   title: "Learner",         description: "Reach Level 5",         icon: "◈", category: "level",   xpReward: 50, condition: s => s.level >= 5 },
  { id: "lvl10",  title: "Rising Star",     description: "Reach Level 10",        icon: "◈", category: "level",   xpReward: 100, condition: s => s.level >= 10 },
  { id: "lvl15",  title: "Focused Student", description: "Reach Level 15",        icon: "◈", category: "level",   xpReward: 150, condition: s => s.level >= 15 },
  { id: "lvl20",  title: "Smart Learner",   description: "Reach Level 20",        icon: "◈", category: "level",   xpReward: 200, condition: s => s.level >= 20 },
  { id: "lvl30",  title: "Quiz Warrior",    description: "Reach Level 30",        icon: "◈", category: "level",   xpReward: 300, condition: s => s.level >= 30 },
  { id: "lvl50",  title: "Academic Beast",  description: "Reach Level 50",        icon: "◈", category: "level",   xpReward: 500, condition: s => s.level >= 50 },
  { id: "lvl70",  title: "Study Legend",    description: "Reach Level 70",        icon: "◈", category: "level",   xpReward: 700, condition: s => s.level >= 70 },
  { id: "lvl100", title: "Ultimate Topper", description: "Reach Level 100",       icon: "◈", category: "level",   xpReward: 1000, condition: s => s.level >= 100 },
  { id: "quiz1",   title: "First Step",     description: "Complete your first quiz",      icon: "▣", category: "quiz",  xpReward: 20, condition: s => s.totalQuizzes >= 1 },
  { id: "quiz10",  title: "Quiz Taker",     description: "Complete 10 quizzes",          icon: "▣", category: "quiz",  xpReward: 50, condition: s => s.totalQuizzes >= 10 },
  { id: "quiz50",  title: "Quiz Champion",  description: "Complete 50 quizzes",          icon: "▣", category: "quiz",  xpReward: 200, condition: s => s.totalQuizzes >= 50 },
  { id: "quiz100", title: "Quiz Master",    description: "Complete 100 quizzes",         icon: "▣", category: "quiz",  xpReward: 500, condition: s => s.totalQuizzes >= 100 },
  { id: "perfect1","title": "Perfectionist",description: "Score 100% on any quiz",       icon: "✦", category: "quiz",  xpReward: 100, condition: s => s.perfectScores >= 1 },
  { id: "perfect5","title": "Precision Pro",description: "Score 100% on 5 quizzes",      icon: "✦", category: "quiz",  xpReward: 300, condition: s => s.perfectScores >= 5 },
  { id: "accuracy80", title: "Accuracy Expert", description: "Maintain 80%+ accuracy",  icon: "🎯", category: "quiz",  xpReward: 150, condition: s => s.totalCorrect > 0 && (s.totalCorrect / Math.max(1, s.totalQuizzes)) >= 0.8 },
  { id: "streak7",  title: "7-Day Warrior",   description: "Maintain a 7-day streak",   icon: "▲", category: "streak", xpReward: 70,  condition: s => s.streak >= 7 },
  { id: "streak30", title: "30-Day Legend",   description: "Maintain a 30-day streak",  icon: "▲", category: "streak", xpReward: 300, condition: s => s.streak >= 30 },
  { id: "streak60", title: "Marathon Master", description: "Maintain a 60-day streak",  icon: "▲", category: "streak", xpReward: 600, condition: s => s.streak >= 60 },
  { id: "maths10",     title: "Maths Monster",      description: "Complete 10 Maths quizzes",   icon: "∑", category: "subject", xpReward: 100, condition: s => (s.quizzesBySubject.maths ?? 0) >= 10 },
  { id: "maths25",     title: "Maths Savant",       description: "Complete 25 Maths quizzes",  icon: "∑", category: "subject", xpReward: 250, condition: s => (s.quizzesBySubject.maths ?? 0) >= 25 },
  { id: "science10",   title: "Science Champion",   description: "Complete 10 Science quizzes",icon: "⚗", category: "subject", xpReward: 100, condition: s => (s.quizzesBySubject.science ?? 0) >= 10 },
  { id: "science25",   title: "Science Sage",       description: "Complete 25 Science quizzes", icon: "⚗", category: "subject", xpReward: 250, condition: s => (s.quizzesBySubject.science ?? 0) >= 25 },
  { id: "sst10",       title: "SST Strategist",     description: "Complete 10 SST quizzes",     icon: "⊕", category: "subject", xpReward: 100, condition: s => (s.quizzesBySubject.sst ?? 0) >= 10 },
  { id: "sst25",       title: "SST Scholar",        description: "Complete 25 SST quizzes",    icon: "⊕", category: "subject", xpReward: 250, condition: s => (s.quizzesBySubject.sst ?? 0) >= 25 },
  { id: "allSubjects", title: "Polymath",           description: "Master all subjects",         icon: "🌟", category: "subject", xpReward: 500, condition: s => (s.quizzesBySubject.maths ?? 0) >= 10 && (s.quizzesBySubject.science ?? 0) >= 10 && (s.quizzesBySubject.sst ?? 0) >= 10 },
  { id: "firstBrood", title: "First Blood",    description: "Complete your first quiz", icon: "🔥", category: "special", xpReward: 25, condition: s => s.totalQuizzes >= 1 },
  { id: "weekWarrior", title: "Week Warrior", description: "Complete 7 quizzes in a week", icon: "⚡", category: "special", xpReward: 150, condition: s => s.totalQuizzes >= 7 },
];

export interface UserXPData {
  uid: string;
  name: string;
  photoURL?: string | null;
  xp: number;
  level: number;
  streak: number;
  lastActive?: string;
  totalQuizzes: number;
  totalCorrect: number;
  totalScore: number;
  perfectScores: number;
  lecturesWatched: number;
  pdfsRead: number;
  avgScore: number;
  quizzesBySubject: Record<string, number>;
  isPremium?: boolean;
  isAdmin?: boolean;
  achievements: string[];
  updatedAt?: Timestamp;
}

interface XPContextType {
  xpData: UserXPData | null;
  loading: boolean;
  awardXP: (amount: number, reason?: string) => Promise<void>;
  awardQuizXP: (opts: { subject: string; score: number; totalMarks: number; correctAnswers: number; totalQuestions: number; }) => Promise<void>;
  awardDailyLogin: () => Promise<void>;
  awardLecture: () => Promise<void>;
  awardPdf: () => Promise<void>;
}

const XPContext = createContext<XPContextType>({
  xpData: null, loading: true,
  awardXP: async () => {}, awardQuizXP: async () => {},
  awardDailyLogin: async () => {}, awardLecture: async () => {}, awardPdf: async () => {},
});

export function useXP() { return useContext(XPContext); }

function canAwardToday(key: string): boolean {
  const last = localStorage.getItem(`nt_xp_${key}`);
  if (!last) return true;
  return new Date().toDateString() !== last;
}

function markAwardedToday(key: string) {
  localStorage.setItem(`nt_xp_${key}`, new Date().toDateString());
}

function getWeekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function getMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function XPProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [xpData, setXpData] = useState<UserXPData | null>(null);
  const [loading, setLoading] = useState(true);
  const writePending = useRef(false);
  const userRef = useRef(user);

  // Keep userRef current
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!user) { setXpData(null); setLoading(false); return; }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setXpData({
          uid: user.uid,
          name: d.name ?? user.displayName ?? "Student",
          photoURL: d.photoURL ?? user.photoURL,
          xp: d.xp ?? 0,
          level: d.level ?? 0,
          streak: d.streak ?? 0,
          lastActive: d.lastActive,
          totalQuizzes: d.totalQuizzes ?? 0,
          totalCorrect: d.totalCorrect ?? 0,
          totalScore: d.totalScore ?? 0,
          perfectScores: d.perfectScores ?? 0,
          lecturesWatched: d.lecturesWatched ?? 0,
          pdfsRead: d.pdfsRead ?? 0,
          avgScore: d.avgScore ?? 0,
          quizzesBySubject: d.quizzesBySubject ?? {},
          isPremium: d.isPremium ?? false,
          isAdmin: isAdmin,
          achievements: d.achievements ?? [],
          updatedAt: d.updatedAt,
        });
      } else {
        const init: Partial<UserXPData> = {
          uid: user.uid,
          name: user.displayName ?? "Student",
          photoURL: user.photoURL,
          xp: 0, level: 0, streak: 0, totalQuizzes: 0, totalCorrect: 0,
          totalScore: 0, perfectScores: 0, lecturesWatched: 0, pdfsRead: 0,
          avgScore: 0, quizzesBySubject: {}, achievements: [],
        };
        setDoc(ref, init, { merge: true }).catch(err => console.error("[XP] Bootstrap error:", err));
      }
      setLoading(false);
    }, err => {
      console.error("[XP] Listener error:", err);
      setLoading(false);
    });
    return unsub;
  }, [user, isAdmin]);

  /* ── CRITICAL FIX: syncLeaderboard without dependency on user ── */
  const syncLeaderboard = useCallback((uid: string) => {
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (!snap.exists()) {
        console.warn(`[Leaderboard] User doc not found: ${uid}`);
        return;
      }
      const d = snap.data();
      const xp = d.xp ?? 0;
      const lbDoc = {
        uid,
        name: d.name ?? userRef.current?.displayName ?? "Student",
        photoURL: d.photoURL ?? userRef.current?.photoURL ?? null,
        xp,
        level: xpToLevel(xp),
        streak: d.streak ?? 0,
        totalQuizzes: d.totalQuizzes ?? 0,
        totalCorrect: d.totalCorrect ?? 0,
        totalScore: d.totalScore ?? 0,
        avgScore: d.avgScore ?? 0,
        perfectScores: d.perfectScores ?? 0,
        isPremium: d.isPremium ?? false,
        updatedAt: serverTimestamp(),
        weekKey: getWeekKey(),
        monthKey: getMonthKey(),
      };
      setDoc(doc(db, "leaderboard", uid), lbDoc, { merge: true }).then(() => {
        console.log(`[Leaderboard] Synced ${uid}: ${xp} XP`);
      }).catch(err => console.error(`[Leaderboard] Write failed for ${uid}:`, err));
    }).catch(err => console.error(`[Leaderboard] Read failed for ${uid}:`, err));
  }, []);

  const checkAchievements = useCallback(async (uid: string, stats: UserStats, existingAchievements: string[]) => {
    const newlyUnlocked = ACHIEVEMENTS.filter(
      (a) => !existingAchievements.includes(a.id) && a.condition(stats),
    );
    if (newlyUnlocked.length === 0) return;
    const bonusXP = newlyUnlocked.reduce((s, a) => s + a.xpReward, 0);
    const newList = [...existingAchievements, ...newlyUnlocked.map((a) => a.id)];
    const ref = doc(db, "users", uid);
    await updateDoc(ref, {
      achievements: newList,
      xp: increment(bonusXP),
    }).catch(err => console.error("[Achievements] Update failed:", err));
    syncLeaderboard(uid);
  }, [syncLeaderboard]);

  const awardXP = useCallback(async (amount: number, _reason?: string) => {
    if (!userRef.current || writePending.current || amount <= 0) return;
    writePending.current = true;
    try {
      const ref = doc(db, "users", userRef.current.uid);
      await updateDoc(ref, { xp: increment(amount), updatedAt: serverTimestamp() });
      syncLeaderboard(userRef.current.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        const newXP = d.xp ?? 0;
        const stats: UserStats = {
          xp: newXP, level: xpToLevel(newXP), streak: d.streak ?? 0,
          totalQuizzes: d.totalQuizzes ?? 0, totalCorrect: d.totalCorrect ?? 0,
          perfectScores: d.perfectScores ?? 0, lecturesWatched: d.lecturesWatched ?? 0,
          pdfsRead: d.pdfsRead ?? 0, weeksActive: 0, monthsActive: 0,
          quizzesBySubject: d.quizzesBySubject ?? {},
        };
        const lvl = xpToLevel(newXP);
        await updateDoc(ref, { level: lvl });
        await checkAchievements(userRef.current.uid, stats, d.achievements ?? []);
      }
    } finally {
      writePending.current = false;
    }
  }, [syncLeaderboard, checkAchievements]);

  const awardQuizXP = useCallback(async (opts: {
    subject: string; score: number; totalMarks: number;
    correctAnswers: number; totalQuestions: number;
  }) => {
    if (!userRef.current) return;
    const { subject, score, totalMarks, correctAnswers } = opts;
    const pct = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
    let xp = XP_RULES.quizComplete + correctAnswers * XP_RULES.quizCorrectAnswer;
    if (pct === 100) xp += XP_RULES.quizPerfectScore;
    else if (pct >= 80) xp += XP_RULES.quizHighScore;

    const ref = doc(db, "users", userRef.current.uid);
    const snap = await getDoc(ref);
    const prev = snap.exists() ? snap.data() : {};
    const prevTotal = prev.totalScore ?? 0;
    const prevCount = prev.totalQuizzes ?? 0;
    const newAvg = prevCount > 0 ? (prevTotal + pct) / (prevCount + 1) : pct;

    await updateDoc(ref, {
      xp: increment(xp),
      level: xpToLevel((prev.xp ?? 0) + xp),
      totalQuizzes: increment(1),
      totalCorrect: increment(correctAnswers),
      totalScore: increment(pct),
      avgScore: newAvg,
      ...(pct === 100 ? { perfectScores: increment(1) } : {}),
      [`quizzesBySubject.${subject}`]: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(err => console.error("[Quiz XP] Update failed:", err));
    
    syncLeaderboard(userRef.current.uid);
    
    const snap2 = await getDoc(ref);
    if (snap2.exists()) {
      const d = snap2.data();
      const newXP = d.xp ?? 0;
      const stats: UserStats = {
        xp: newXP, level: xpToLevel(newXP), streak: d.streak ?? 0,
        totalQuizzes: d.totalQuizzes ?? 0, totalCorrect: d.totalCorrect ?? 0,
        perfectScores: d.perfectScores ?? 0, lecturesWatched: d.lecturesWatched ?? 0,
        pdfsRead: d.pdfsRead ?? 0, weeksActive: 0, monthsActive: 0,
        quizzesBySubject: d.quizzesBySubject ?? {},
      };
      await checkAchievements(userRef.current.uid, stats, d.achievements ?? []);
    }
  }, [syncLeaderboard, checkAchievements]);

  const awardDailyLogin = useCallback(async () => {
    if (!userRef.current || !canAwardToday("dailyLogin")) return;
    markAwardedToday("dailyLogin");
    const ref = doc(db, "users", userRef.current.uid);
    const snap = await getDoc(ref);
    const d = snap.exists() ? snap.data() : {};
    const lastActive = d.lastActive ?? "";
    const today = new Date().toDateString();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const newStreak = lastActive === yesterday.toDateString() ? (d.streak ?? 0) + 1 : 1;
    const streakBonus = Math.min(newStreak, 30) * XP_RULES.streakBonus;
    await updateDoc(ref, {
      xp: increment(XP_RULES.dailyLogin + streakBonus),
      streak: newStreak,
      lastActive: today,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    syncLeaderboard(userRef.current.uid);
  }, [syncLeaderboard]);

  const awardLecture = useCallback(async () => {
    if (!userRef.current || !canAwardToday("lecture")) return;
    markAwardedToday("lecture");
    await awardXP(XP_RULES.lectureWatched, "lecture");
    updateDoc(doc(db, "users", userRef.current.uid), { lecturesWatched: increment(1) }).catch(() => {});
  }, [awardXP]);

  const awardPdf = useCallback(async () => {
    if (!userRef.current || !canAwardToday("pdf")) return;
    markAwardedToday("pdf");
    await awardXP(XP_RULES.pdfRead, "pdf");
    updateDoc(doc(db, "users", userRef.current.uid), { pdfsRead: increment(1) }).catch(() => {});
  }, [awardXP]);

  return (
    <XPContext.Provider value={{ xpData, loading, awardXP, awardQuizXP, awardDailyLogin, awardLecture, awardPdf }}>
      {children}
    </XPContext.Provider>
  );
}
