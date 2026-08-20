import React, { createContext, useContext, useEffect, useState } from "react";
import {
  doc, onSnapshot, setDoc, deleteDoc, updateDoc,
  serverTimestamp, Timestamp, collection, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";

export const PREMIUM_PLANS = [
  {
    id: "day" as const,
    price: 3,
    duration: "1 Day",
    durationLabel: "Daily Access",
    durMs: 24 * 60 * 60 * 1000,
    features: [
      "Science Lectures 2025–26",
      "Maths Lectures 2025–26",
      "SST Lectures 2025–26",
    ],
    popular: false,
  },
  {
    id: "month" as const,
    price: 39,
    duration: "1 Month",
    durationLabel: "Monthly Access",
    durMs: 30 * 24 * 60 * 60 * 1000,
    features: [
      "Science Lectures 2025–26",
      "Maths Lectures 2025–26",
      "SST Lectures 2025–26",
      "Priority Support",
    ],
    popular: true,
  },
];

export type PremiumPlan = "day" | "month";

export interface PremiumData {
  isPremium: boolean;
  plan: PremiumPlan | null;
  expiryTime: Date | null;
  startTime: Date | null;
}

export interface MembershipRecord {
  uid: string;
  name?: string;
  email?: string;
  photoURL?: string;
  isPremium: boolean;
  planType: PremiumPlan | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  daysRemaining: number;
  updatedByAdmin?: string;
  adminNotes?: string;
  grantedBy?: string;
}

interface PremiumContextType extends PremiumData {
  loading: boolean;
  grantPremium: (uid: string, plan: PremiumPlan, delayHours?: number) => Promise<void>;
  revokePremium: (uid: string) => Promise<void>;
  extendPremium: (uid: string, days: number) => Promise<void>;
  setPremiumWithDates: (uid: string, plan: PremiumPlan, activatedAt: Date, expiresAt: Date, adminNotes?: string, adminUid?: string) => Promise<void>;
  setAdminNotes: (uid: string, notes: string) => Promise<void>;
  approvePremiumRequest: (requestId: string, uid: string, plan: PremiumPlan) => Promise<void>;
  rejectPremiumRequest: (requestId: string) => Promise<void>;
  getAllMembers: () => Promise<MembershipRecord[]>;
}

const PremiumContext = createContext<PremiumContextType>({
  isPremium: false, plan: null, expiryTime: null, startTime: null, loading: true,
  grantPremium: async () => {},
  revokePremium: async () => {},
  extendPremium: async () => {},
  setPremiumWithDates: async () => {},
  setAdminNotes: async () => {},
  approvePremiumRequest: async () => {},
  rejectPremiumRequest: async () => {},
  getAllMembers: async () => [],
});

export const usePremium = () => useContext(PremiumContext);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [plan, setPlan] = useState<PremiumPlan | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false); setPlan(null); setExpiryTime(null);
      setStartTime(null); setLoading(false);
      return;
    }
    if (isAdmin) {
      setIsPremium(true); setPlan("month"); setLoading(false);
      return;
    }

    // Real-time listener — any change in Firestore (expiry, revoke) instantly
    // updates the client. Never cache or trust local state alone.
    const unsub = onSnapshot(
      doc(db, "premiumUsers", user.uid),
      (snap) => {
        if (!snap.exists()) {
          setIsPremium(false); setPlan(null);
          setExpiryTime(null); setStartTime(null);
        } else {
          const data = snap.data();
          const exp: Date | null = data.expiryTime?.toDate?.() ?? data.expiresAt?.toDate?.() ?? null;
          const start: Date | null = data.startTime?.toDate?.() ?? data.activatedAt?.toDate?.() ?? null;
          const now = new Date();
          // CRITICAL FIX: check BOTH the isPremium flag AND the expiry date.
          // If admin sets isPremium:false, user loses access instantly even if
          // expiry date is still in the future.
          const flagActive = data.isPremium !== false;
          const timeActive = exp ? exp > now : false;
          const active = flagActive && timeActive;
          setIsPremium(active);
          setPlan(active ? (data.plan ?? data.planType) as PremiumPlan : null);
          setExpiryTime(exp);
          setStartTime(start);
          // Auto-write expired status back so admin panel shows correct state
          if (!active && data.isPremium === true) {
            updateDoc(doc(db, "premiumUsers", user.uid), { isPremium: false }).catch(() => {});
          }
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user, isAdmin]);

  const grantPremium = async (uid: string, p: PremiumPlan, delayHours = 0) => {
    const meta = PREMIUM_PLANS.find((x) => x.id === p)!;
    const st = new Date(Date.now() + delayHours * 3_600_000);
    const et = new Date(st.getTime() + meta.durMs);
    const daysRemaining = Math.ceil(meta.durMs / (1000 * 60 * 60 * 24));
    await setDoc(doc(db, "premiumUsers", uid), {
      uid, plan: p, planType: p,
      isPremium: true,
      startTime: Timestamp.fromDate(st),
      activatedAt: Timestamp.fromDate(st),
      expiryTime: Timestamp.fromDate(et),
      expiresAt: Timestamp.fromDate(et),
      daysRemaining,
      grantedBy: "admin",
      updatedByAdmin: "admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const revokePremium = async (uid: string) => {
    // Set isPremium:false — the onSnapshot listener on the user's device will
    // fire immediately and strip access without requiring a page reload.
    await updateDoc(doc(db, "premiumUsers", uid), {
      isPremium: false,
      updatedAt: serverTimestamp(),
    }).catch(() => deleteDoc(doc(db, "premiumUsers", uid)));
  };

  const extendPremium = async (uid: string, days: number) => {
    const snap = await getDocs(collection(db, "premiumUsers"));
    const existing = snap.docs.find((d) => d.id === uid);
    let currentExpiry = new Date();
    if (existing) {
      const data = existing.data();
      const exp: Date | null = data.expiryTime?.toDate?.() ?? data.expiresAt?.toDate?.() ?? null;
      if (exp && exp > new Date()) currentExpiry = exp;
    }
    const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((newExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    if (existing) {
      await updateDoc(doc(db, "premiumUsers", uid), {
        isPremium: true,
        expiryTime: Timestamp.fromDate(newExpiry),
        expiresAt: Timestamp.fromDate(newExpiry),
        daysRemaining,
        updatedByAdmin: "admin",
        updatedAt: serverTimestamp(),
      });
    } else {
      await grantPremium(uid, "month");
      await updateDoc(doc(db, "premiumUsers", uid), {
        expiryTime: Timestamp.fromDate(newExpiry),
        expiresAt: Timestamp.fromDate(newExpiry),
        daysRemaining,
      });
    }
  };

  const setPremiumWithDates = async (
    uid: string, p: PremiumPlan,
    activatedAt: Date, expiresAt: Date,
    adminNotes?: string, adminUid?: string,
  ) => {
    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const isPrem = expiresAt > new Date();
    await setDoc(doc(db, "premiumUsers", uid), {
      uid, plan: p, planType: p,
      isPremium: isPrem,
      startTime: Timestamp.fromDate(activatedAt),
      activatedAt: Timestamp.fromDate(activatedAt),
      expiryTime: Timestamp.fromDate(expiresAt),
      expiresAt: Timestamp.fromDate(expiresAt),
      daysRemaining,
      updatedByAdmin: adminUid ?? "admin",
      adminNotes: adminNotes ?? "",
      grantedBy: "admin",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const setAdminNotes = async (uid: string, notes: string) => {
    await updateDoc(doc(db, "premiumUsers", uid), {
      adminNotes: notes,
      updatedAt: serverTimestamp(),
    });
  };

  const approvePremiumRequest = async (requestId: string, uid: string, p: PremiumPlan) => {
    await grantPremium(uid, p, 0);
    await updateDoc(doc(db, "premiumRequests", requestId), {
      status: "approved",
      reviewedAt: serverTimestamp(),
    });
  };

  const rejectPremiumRequest = async (requestId: string, reason?: string) => {
    await updateDoc(doc(db, "premiumRequests", requestId), {
      status: "rejected",
      rejectionReason: reason ?? "",
      reviewedAt: serverTimestamp(),
    });
  };

  const getAllMembers = async (): Promise<MembershipRecord[]> => {
    const [usersSnap, premiumSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "premiumUsers")),
    ]);
    const premiumMap = new Map<string, ReturnType<typeof premiumSnap.docs[0]['data']>>();
    premiumSnap.docs.forEach((d) => premiumMap.set(d.id, d.data()));

    return usersSnap.docs.map((d) => {
      const userData = d.data();
      const premData = premiumMap.get(d.id);
      const exp: Date | null = premData?.expiryTime?.toDate?.() ?? premData?.expiresAt?.toDate?.() ?? null;
      const start: Date | null = premData?.startTime?.toDate?.() ?? premData?.activatedAt?.toDate?.() ?? null;
      // Same dual-check: isPremium flag AND expiry
      const isPrem = premData?.isPremium === true && exp !== null && exp > new Date();
      const daysRemaining = isPrem && exp ? Math.max(0, Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

      return {
        uid: d.id,
        name: userData.name ?? userData.displayName ?? "Unknown",
        email: userData.email ?? "",
        photoURL: userData.photoURL ?? null,
        isPremium: isPrem,
        planType: isPrem ? (premData?.plan ?? premData?.planType ?? null) : null,
        activatedAt: start,
        expiresAt: exp,
        daysRemaining,
        updatedByAdmin: premData?.updatedByAdmin ?? "",
        adminNotes: premData?.adminNotes ?? "",
        grantedBy: premData?.grantedBy ?? "",
      } as MembershipRecord;
    });
  };

  return (
    <PremiumContext.Provider
      value={{
        isPremium, plan, expiryTime, startTime, loading,
        grantPremium, revokePremium, extendPremium,
        setPremiumWithDates, setAdminNotes,
        approvePremiumRequest, rejectPremiumRequest,
        getAllMembers,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}
