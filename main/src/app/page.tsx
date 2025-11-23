"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import LoginForm from "@/components/LoginForm";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = user.uid;
        const userDoc = await getDoc(doc(db, "users", uid));
        const role = userDoc.data()?.role || "player";
        router.push(role === "admin" ? "/admin" : "/game/select");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return <LoginForm />;
}