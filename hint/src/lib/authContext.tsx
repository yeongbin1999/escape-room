"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { autoSignInPlayer } from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthReady: boolean; // Indicates if the initial auth state has been determined
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Initial loading for auth state determination
  const [error, setError] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // New state to track initial auth state determination

  useEffect(() => {
    let isSigningIn = false;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isAuthReady) setIsAuthReady(true); // Mark auth as ready once onAuthStateChanged fires for the first time

      if (currentUser) {
        // User is logged in
        setUser(currentUser);
        setLoading(false);
        setError(null);
      } else if (!isSigningIn) {
        // No user, attempt auto sign-in only if not already in progress
        isSigningIn = true;
        setLoading(true); // Set loading to true while auto-signing in
        setError(null); // Clear previous errors

        try {
          console.log("AuthProvider: No user found, attempting auto sign-in...");
          const signedInUser = await autoSignInPlayer();
          setUser(signedInUser);
          console.log("AuthProvider: Auto sign-in successful.");
        } catch (autoSignInError: any) {
          console.error("AuthProvider: Auto sign-in failed:", autoSignInError);
          setError(autoSignInError.message || "자동 로그인에 실패했습니다. 관리자에게 문의하세요.");
          setUser(null); // Ensure user is null if auto-sign-in fails
        } finally {
          setLoading(false); // Loading is done, whether success or failure
          isSigningIn = false;
        }
      } else {
        // No user, and auto-signin is already in progress, just ensure loading is true
        // This case handles the race condition where onAuthStateChanged might fire
        // multiple times or before autoSignInPlayer resolves.
        setLoading(true); // Keep loading true if auto-signin is still in progress
      }
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  return (
    <AuthContext.Provider value={{ user, loading, error, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
