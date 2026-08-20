import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import {
  doc, onSnapshot, runTransaction, collection, addDoc, serverTimestamp,
  query, where, orderBy, limit, getDoc, setDoc, increment, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

/* ── Redemption plans ─────────────────────────────────────── */
export const REDEEM_PLANS = [
  { id: "day1",   coins: 100,  days: 1,  bonus: 0, label: "1 Day Premium",         maxPerMonth: 2 },
  { id: "day3",   coins: 300,  days: 3,  bonus: 1, label: "3 Days + 1 Bonus Day",  maxPerMonth: 2 },
  { id: "day5",   coins: 500,  days: 5,  bonus: 2, label: "5 Days + 2 Bonus Days", maxPerMonth: 1 },
  { id: "month1", coins: 1000, days: 30, bonus: 0, label: "1 Month Premium",        maxPerMonth: 1 },
] as const;
export type RedeemPlanId = typeof REDEEM_PLANS[number]["id"];

/* ── Types ────────────────────────────────────────────────── */
export interface CoinTransaction {
  id: string;
  uid: string;
  amount: number;
  type: "survey" | "test" | "daily_login" | "admin_reward" | "redeem" | "streak_bonus" | "achievement";
  reason: string;
  createdAt: Timestamp | null;
}

export interface CoinWalletData {
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  monthlyRedeems: Record<string, number>;
  lastResetMonth: string;
  loginStreak: number;
  lastLoginDate: string;
}

interface CoinContextType {
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  monthlyRedeems: Record<string, number>;
  loginStreak: number;
  transactions: CoinTransaction[];
  loading: boolean;
  animating: boolean;
  animationDelta: number;
  awardCoins: (amount: number, type: CoinTransaction["type"], reason: string) => Promise<void>;
  awardTestCoins: (testId: string, percentage: number) => Promise<number>;
  awardSurveyCoins: (surveyId: string, coins: number) => Promise<void>;
  awardDailyLogin: () => Promise<{ coins: number; streak: number; bonusCoins: number }>;
  redeemForPremium: (planId: RedeemPlanId, extendFn: (uid: string, days: number) => Promise<void>) => Promise<"success" | "insufficient" | "limit_reached">;
  getRedeemUsed: (planId: RedeemPlanId) => number;
}

const CoinContext = createContext<CoinContextType | null>(null);

export function useCoin() {
  const ctx = useContext(CoinContext);
  if (!ctx) throw new Error("useCoin must be used within CoinProvider");
  return ctx;
}

/* ── Helpers ──────────────────────────────────────────────── */
export function calcTestCoins(percentage: number): number {
  if (percentage >= 95) return 4;
  if (percentage >= 80) return 3;
  if (percentage >= 60) return 2;
  if (percentage >= 40) return 1;
  return 0;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const EMPTY_WALLET: CoinWalletData = {
  balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0,
  monthlyRedeems: {}, lastResetMonth: "", loginStreak: 0, lastLoginDate: "",
};

/* ── Provider ─────────────────────────────────────────────── */
export function CoinProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [walletData, setWalletData] = useState<CoinWalletData>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [animationDelta, setAnimationDelta] = useState(0);

  /* ── Real-time wallet listener ── */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, "coinWallet", uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CoinWalletData;
        const month = currentMonthKey();
        if (data.lastResetMonth && data.lastResetMonth !== month) {
          setWalletData({ ...data, monthlyRedeems: {}, lastResetMonth: month });
        } else {
          setWalletData(data);
        }
      } else {
        setWalletData(EMPTY_WALLET);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  /* ── Transaction listener ── */
  useEffect(() => {
    if (!uid) { setTransactions([]); return; }
    const q = query(
      collection(db, "coinTransactions"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(100),
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoinTransaction)));
    }, () => {});
    return unsub;
  }, [uid]);

  const triggerAnimation = useCallback((delta: number) => {
    setAnimationDelta(delta);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 2500);
  }, []);

  /* ── Award coins ── */
  const awardCoins = useCallback(async (
    amount: number,
    type: CoinTransaction["type"],
    reason: string,
  ) => {
    if (!uid || amount === 0) return;
    const walletRef = doc(db, "coinWallet", uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(walletRef);
      const cur = snap.exists() ? (snap.data() as CoinWalletData) : EMPTY_WALLET;
      const month = currentMonthKey();
      const monthRedeems = cur.lastResetMonth !== month ? {} : (cur.monthlyRedeems ?? {});
      tx.set(walletRef, {
        ...cur,
        balance: (cur.balance ?? 0) + amount,
        lifetimeEarned: amount > 0 ? (cur.lifetimeEarned ?? 0) + amount : (cur.lifetimeEarned ?? 0),
        lifetimeRedeemed: amount < 0 ? (cur.lifetimeRedeemed ?? 0) + Math.abs(amount) : (cur.lifetimeRedeemed ?? 0),
        monthlyRedeems: monthRedeems,
        lastResetMonth: month,
      }, { merge: true });
    });
    await addDoc(collection(db, "coinTransactions"), {
      uid, amount, type, reason, createdAt: serverTimestamp(),
    });
    if (amount > 0) triggerAnimation(amount);
  }, [uid, triggerAnimation]);

  /* ── Award test coins (once per test) ── */
  const awardTestCoins = useCallback(async (testId: string, percentage: number): Promise<number> => {
    if (!uid) return 0;
    const coins = calcTestCoins(percentage);
    if (coins <= 0) return 0;
    const storageKey = `nt_testcoins_${uid}_${testId}`;
    if (localStorage.getItem(storageKey)) return 0;

    // Double-check via Firestore to prevent refresh exploits
    const docRef = doc(db, "testCoinAwarded", `${uid}_${testId}`);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (snap.exists()) throw new Error("already_awarded");
        tx.set(docRef, { uid, testId, coins, awardedAt: serverTimestamp() });
      });
    } catch {
      return 0;
    }

    localStorage.setItem(storageKey, "1");
    await awardCoins(coins, "test", `Practice Test — ${Math.round(percentage)}% Score`);
    return coins;
  }, [uid, awardCoins]);

  /* ── Award survey coins ── */
  const awardSurveyCoins = useCallback(async (surveyId: string, coins: number) => {
    if (!uid || coins <= 0) return;
    await awardCoins(coins, "survey", "Survey Completed 📝");
  }, [uid, awardCoins]);

  /* ── Daily login coins ── */
  const awardDailyLogin = useCallback(async (): Promise<{ coins: number; streak: number; bonusCoins: number }> => {
    if (!uid) return { coins: 0, streak: 0, bonusCoins: 0 };
    const today = new Date().toDateString();
    const storageKey = `nt_dailycoin_${uid}`;
    if (localStorage.getItem(storageKey) === today) return { coins: 0, streak: 0, bonusCoins: 0 };

    const walletRef = doc(db, "coinWallet", uid);
    let newStreak = 1;
    let bonusCoins = 0;

    try {
      const snap = await getDoc(walletRef);
      const data = snap.exists() ? (snap.data() as CoinWalletData) : EMPTY_WALLET;
      const yesterday = new Date(Date.now() - 86_400_000).toDateString();
      newStreak = data.lastLoginDate === yesterday ? (data.loginStreak ?? 0) + 1 : 1;
      if (newStreak % 30 === 0) bonusCoins = 25;
      else if (newStreak % 7 === 0) bonusCoins = 5;
    } catch { /* best-effort */ }

    const baseCoin = 1;
    const total = baseCoin + bonusCoins;
    localStorage.setItem(storageKey, today);

    const month = currentMonthKey();
    try {
      await setDoc(walletRef, {
        lastLoginDate: today,
        loginStreak: newStreak,
        balance: increment(total),
        lifetimeEarned: increment(total),
        lastResetMonth: month,
      }, { merge: true });
      await addDoc(collection(db, "coinTransactions"), {
        uid, amount: baseCoin, type: "daily_login", reason: "Daily Login 🌅", createdAt: serverTimestamp(),
      });
      if (bonusCoins > 0) {
        await addDoc(collection(db, "coinTransactions"), {
          uid, amount: bonusCoins, type: "streak_bonus",
          reason: newStreak % 30 === 0 ? "🔥 30-Day Streak Bonus!" : "⚡ 7-Day Streak Bonus!",
          createdAt: serverTimestamp(),
        });
      }
      triggerAnimation(total);
    } catch { /* best-effort */ }

    return { coins: baseCoin, streak: newStreak, bonusCoins };
  }, [uid, triggerAnimation]);

  /* ── Redeem for premium ── */
  const redeemForPremium = useCallback(async (
    planId: RedeemPlanId,
    extendFn: (uid: string, days: number) => Promise<void>,
  ): Promise<"success" | "insufficient" | "limit_reached"> => {
    if (!uid) return "insufficient";
    const plan = REDEEM_PLANS.find((p) => p.id === planId);
    if (!plan) return "insufficient";

    const month = currentMonthKey();
    const monthRedeems = walletData.lastResetMonth !== month ? {} : (walletData.monthlyRedeems ?? {});
    const used = monthRedeems[planId] ?? 0;
    if (used >= plan.maxPerMonth) return "limit_reached";
    if (walletData.balance < plan.coins) return "insufficient";

    const totalDays = plan.days + plan.bonus;
    const walletRef = doc(db, "coinWallet", uid);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(walletRef);
        const data = snap.exists() ? (snap.data() as CoinWalletData) : EMPTY_WALLET;
        const curMonth = currentMonthKey();
        const curRedeems = data.lastResetMonth !== curMonth ? {} : (data.monthlyRedeems ?? {});
        const curUsed = curRedeems[planId] ?? 0;
        if (curUsed >= plan.maxPerMonth) throw new Error("limit_reached");
        if ((data.balance ?? 0) < plan.coins) throw new Error("insufficient");
        tx.set(walletRef, {
          balance: (data.balance ?? 0) - plan.coins,
          lifetimeRedeemed: (data.lifetimeRedeemed ?? 0) + plan.coins,
          monthlyRedeems: { ...curRedeems, [planId]: curUsed + 1 },
          lastResetMonth: curMonth,
        }, { merge: true });
      });
    } catch (e: any) {
      return e?.message === "limit_reached" ? "limit_reached" : "insufficient";
    }

    await extendFn(uid, totalDays);

    await addDoc(collection(db, "coinTransactions"), {
      uid, amount: -plan.coins, type: "redeem",
      reason: `🎁 Premium Redeemed — ${plan.label}`,
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(db, "redeemHistory"), {
      uid, planId, coins: plan.coins, days: totalDays,
      planLabel: plan.label, redeemedAt: serverTimestamp(),
    });

    return "success";
  }, [uid, walletData]);

  const getRedeemUsed = useCallback((planId: RedeemPlanId) => {
    const month = currentMonthKey();
    if (walletData.lastResetMonth !== month) return 0;
    return walletData.monthlyRedeems?.[planId] ?? 0;
  }, [walletData]);

  return (
    <CoinContext.Provider value={{
      balance: walletData.balance ?? 0,
      lifetimeEarned: walletData.lifetimeEarned ?? 0,
      lifetimeRedeemed: walletData.lifetimeRedeemed ?? 0,
      monthlyRedeems: walletData.monthlyRedeems ?? {},
      loginStreak: walletData.loginStreak ?? 0,
      transactions,
      loading,
      animating,
      animationDelta,
      awardCoins,
      awardTestCoins,
      awardSurveyCoins,
      awardDailyLogin,
      redeemForPremium,
      getRedeemUsed,
    }}>
      {children}
    </CoinContext.Provider>
  );
}
