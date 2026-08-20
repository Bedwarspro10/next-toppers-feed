import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, orderBy, limit,
  doc, setDoc, serverTimestamp, addDoc, increment, onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { calcTestCoins } from "@/contexts/CoinContext";
import {
  Search, TrendingUp, Gift, Trophy, Users, RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface WalletRow {
  uid: string;
  email?: string;
  displayName?: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  loginStreak: number;
}

interface TxRow {
  id: string;
  uid: string;
  amount: number;
  type: string;
  reason: string;
  createdAt: Timestamp | null;
}

function fmtDate(ts: Timestamp | null) {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CoinManagerTab() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"leaderboard" | "reward" | "transactions">("leaderboard");
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  /* Reward form */
  const [rewardUid, setRewardUid] = useState("");
  const [rewardAmount, setRewardAmount] = useState("10");
  const [rewardReason, setRewardReason] = useState("");
  const [rewarding, setRewarding] = useState(false);

  /* Leaderboard — listen to top wallets */
  useEffect(() => {
    // Firestore doesn't support orderBy on a different field without composite index easily
    // Fetch all wallets and sort client-side (acceptable for admin panel)
    const unsub = onSnapshot(collection(db, "coinWallet"), (snap) => {
      const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as WalletRow));
      rows.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
      setWallets(rows.slice(0, 50));
      setLoadingWallets(false);
    }, () => setLoadingWallets(false));
    return unsub;
  }, []);

  /* Latest 50 transactions */
  useEffect(() => {
    if (tab !== "transactions") return;
    setLoadingTx(true);
    const q = query(collection(db, "coinTransactions"), orderBy("createdAt", "desc"), limit(50));
    getDocs(q).then((snap) => {
      setTxs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TxRow)));
      setLoadingTx(false);
    }).catch(() => setLoadingTx(false));
  }, [tab]);

  const handleReward = async () => {
    const uid = rewardUid.trim();
    const amount = parseInt(rewardAmount, 10);
    if (!uid) { toast({ title: "Enter a UID", variant: "destructive" }); return; }
    if (!amount || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    setRewarding(true);
    try {
      const walletRef = doc(db, "coinWallet", uid);
      await setDoc(walletRef, {
        balance: increment(amount),
        lifetimeEarned: increment(amount),
        lastResetMonth: new Date().toISOString().slice(0, 7),
      }, { merge: true });
      await addDoc(collection(db, "coinTransactions"), {
        uid, amount,
        type: "admin_reward",
        reason: rewardReason.trim() || "🎁 Admin Reward",
        createdAt: serverTimestamp(),
      });
      toast({ title: `✓ ${amount} coins awarded to ${uid}` });
      setRewardUid("");
      setRewardReason("");
      setRewardAmount("10");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setRewarding(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-black text-lg flex items-center gap-2">🪙 Gold Coins Manager</h3>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-xl border border-border">
        {([
          { id: "leaderboard", label: "Leaderboard", icon: Trophy },
          { id: "reward",      label: "Reward",      icon: Gift },
          { id: "transactions",label: "Transactions", icon: TrendingUp },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${tab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* ── Leaderboard ── */}
      {tab === "leaderboard" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={13} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Top 50 wallets by current balance</p>
          </div>
          {loadingWallets ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full w-5 h-5 border-2 border-primary border-t-transparent" /></div>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No wallets yet</p>
          ) : (
            <div className="space-y-2">
              {wallets.map((w, i) => (
                <div key={w.uid} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card">
                  <span className={`text-sm font-black w-6 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{w.displayName || w.uid}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{w.uid}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-amber-500">🪙 {(w.balance ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">🔥 {w.loginStreak ?? 0} streak</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Reward ── */}
      {tab === "reward" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manually award coins to a student by their UID (visible in Firebase Auth or the Members tab).
          </p>
          <div className="space-y-3 p-4 rounded-2xl border border-border bg-card">
            <div className="space-y-1.5">
              <Label>Student UID *</Label>
              <Input value={rewardUid} onChange={(e) => setRewardUid(e.target.value)} placeholder="Firebase Auth UID" />
            </div>
            <div className="space-y-1.5">
              <Label>Coins to Award *</Label>
              <Input type="number" min={1} max={1000} value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input value={rewardReason} onChange={(e) => setRewardReason(e.target.value)} placeholder="e.g. Contest winner, Special reward" />
            </div>
            <Button onClick={handleReward} disabled={rewarding} className="w-full">
              {rewarding ? "Awarding..." : "🪙 Award Coins"}
            </Button>
          </div>

          {/* Score/coin reference */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-bold">📊 Test Score → Coin Formula</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { range: "95–100%", coins: calcTestCoins(95) },
                { range: "80–94%",  coins: calcTestCoins(80) },
                { range: "60–79%",  coins: calcTestCoins(60) },
                { range: "40–59%",  coins: calcTestCoins(40) },
                { range: "Below 40%", coins: 0 },
              ].map(({ range, coins }) => (
                <div key={range} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 text-xs">
                  <span className="text-muted-foreground">{range}</span>
                  <span className="font-bold text-amber-500">+{coins} 🪙</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Coins are awarded once per test, anti-duplicate enforced.</p>
          </div>

          {/* Redemption plan reference */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-bold">👑 Premium Redemption Plans</p>
            {[
              { coins: 100,  days: "1 day",           limit: "2×/month" },
              { coins: 300,  days: "3+1 days",         limit: "2×/month" },
              { coins: 500,  days: "5+2 days",         limit: "1×/month" },
              { coins: 1000, days: "30 days",          limit: "1×/month" },
            ].map(({ coins, days, limit }) => (
              <div key={coins} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 text-xs">
                <span className="font-bold text-amber-500">🪙 {coins}</span>
                <span className="text-foreground font-semibold">{days}</span>
                <span className="text-muted-foreground">{limit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Transactions ── */}
      {tab === "transactions" && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Latest 50 transactions across all users</p>
          {loadingTx ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full w-5 h-5 border-2 border-primary border-t-transparent" /></div>
          ) : txs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {txs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card text-xs">
                  <span className={`font-black text-sm flex-shrink-0 ${tx.amount > 0 ? "text-amber-500" : "text-red-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}🪙
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{tx.reason}</p>
                    <p className="text-muted-foreground truncate">{tx.uid}</p>
                  </div>
                  <span className="text-muted-foreground flex-shrink-0">{fmtDate(tx.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
