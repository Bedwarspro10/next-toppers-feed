import { useEffect, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useAnnouncementNotifications(enabled: boolean) {
  const mountedAt = useRef(Math.floor(Date.now() / 1000));
  const shownIds = useRef<Set<string>>(new Set());
  const permRequested = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (!permRequested.current && "Notification" in window && Notification.permission === "default") {
      permRequested.current = true;
      Notification.requestPermission().catch(() => {});
    }

    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(5),
    );

    const unsub = onSnapshot(q, (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== "added") continue;
        const data = change.doc.data();
        const createdAt = data.createdAt?.seconds ?? 0;
        if (createdAt <= mountedAt.current) continue;
        if (shownIds.current.has(change.doc.id)) continue;
        shownIds.current.add(change.doc.id);

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("📢 New Announcement — NextToppers", {
              body: data.title ?? "A new announcement has been posted!",
              icon: "/nexttoppers-logo.png",
              badge: "/nexttoppers-logo.png",
              tag: change.doc.id,
              requireInteraction: false,
            });
          } catch { /* Safari might throw */ }
        }
      }
    }, () => {});

    return unsub;
  }, [enabled]);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}
