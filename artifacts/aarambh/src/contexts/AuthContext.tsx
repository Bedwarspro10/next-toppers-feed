import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "owner" | "admin" | "student";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isOwner: boolean;
  role: UserRole;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isOwner: false,
  role: "student",
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(true);
  const offlineCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Remove any previous offline handler
      if (offlineCleanupRef.current) {
        offlineCleanupRef.current();
        offlineCleanupRef.current = null;
      }

      setUser(currentUser);

      if (currentUser) {
        try {
          const adminDoc = await getDoc(doc(db, "admins", currentUser.uid));
          const adminData = adminDoc.exists() ? adminDoc.data() : null;
          const owner = adminData?.role === "owner";
          const admin = owner || adminData?.role === "admin";
          const r: UserRole = owner ? "owner" : admin ? "admin" : "student";

          setIsOwner(owner);
          setIsAdmin(admin);
          setRole(r);

          const userRef = doc(db, "users", currentUser.uid);
          const existingDoc = await getDoc(userRef);

          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              name: currentUser.displayName ?? "Student",
              photoURL: currentUser.photoURL ?? null,
              email: currentUser.email ?? null,
              role: r,
              lastSeen: serverTimestamp(),
              isOnline: true,
              ...(existingDoc.exists() ? {} : { createdAt: serverTimestamp() }),
            },
            { merge: true },
          );

          const markOffline = () => {
            updateDoc(userRef, {
              isOnline: false,
              lastSeen: serverTimestamp(),
            }).catch(() => {});
          };

          window.addEventListener("beforeunload", markOffline);
          offlineCleanupRef.current = () => {
            window.removeEventListener("beforeunload", markOffline);
          };
        } catch {
          setIsAdmin(false);
          setIsOwner(false);
          setRole("student");
        }
      } else {
        setIsAdmin(false);
        setIsOwner(false);
        setRole("student");
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (offlineCleanupRef.current) {
        offlineCleanupRef.current();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isOwner, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
