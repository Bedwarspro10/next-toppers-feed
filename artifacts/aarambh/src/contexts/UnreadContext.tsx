import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  collection, query, orderBy, limit, onSnapshot, where,
  doc, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";

export function getLastRead(chatId: string): number {
  return parseInt(localStorage.getItem(`nt_lr_${chatId}`) ?? "0", 10);
}

export function markRead(chatId: string): void {
  localStorage.setItem(`nt_lr_${chatId}`, Math.floor(Date.now() / 1000).toString());
}

interface UnreadContextType {
  communityUnread: number;
  totalUnread: number;
  privateUnread: Record<string, number>;
  totalPrivateUnread: number;
  markCommunityRead: () => void;
  resetPrivateUnread: (otherUid: string, chatId: string) => void;
}

const UnreadContext = createContext<UnreadContextType>({
  communityUnread: 0,
  totalUnread: 0,
  privateUnread: {},
  totalPrivateUnread: 0,
  markCommunityRead: () => {},
  resetPrivateUnread: () => {},
});

export const useUnread = () => useContext(UnreadContext);

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [communityUnread, setCommunityUnread] = useState(0);
  const [privateUnread, setPrivateUnread] = useState<Record<string, number>>({});

  const markCommunityRead = () => {
    markRead("community");
    setCommunityUnread(0);
  };

  const resetPrivateUnread = useCallback(
    (otherUid: string, chatId: string) => {
      setPrivateUnread((p) => ({ ...p, [otherUid]: 0 }));
      if (user) {
        setDoc(
          doc(db, "privateChatMeta", chatId),
          { [`unread_${user.uid}`]: 0 },
          { merge: true },
        ).catch(() => {});
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) { setCommunityUnread(0); return; }
    const q = query(
      collection(db, "communityMessages"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      const lastRead = getLastRead("community");
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const ts: number = data.createdAt?.seconds ?? 0;
        if (ts > lastRead && data.senderId !== user.uid && !data.deleted) count++;
      }
      setCommunityUnread(count);
    }, () => {});
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) { setPrivateUnread({}); return; }
    const q = query(
      collection(db, "privateChatMeta"),
      where("participants", "array-contains", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, number> = {};
      for (const d of snap.docs) {
        const data = d.data();
        const myUnread: number = data[`unread_${user.uid}`] ?? 0;
        if (myUnread > 0) {
          const participants: string[] = data.participants ?? [];
          const otherUid = participants.find((p) => p !== user.uid);
          if (otherUid) map[otherUid] = myUnread;
        }
      }
      setPrivateUnread(map);
    }, () => {});
    return unsub;
  }, [user]);

  const totalPrivateUnread = Object.values(privateUnread).reduce((a, b) => a + b, 0);

  return (
    <UnreadContext.Provider
      value={{
        communityUnread,
        totalUnread: communityUnread + totalPrivateUnread,
        privateUnread,
        totalPrivateUnread,
        markCommunityRead,
        resetPrivateUnread,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
}
