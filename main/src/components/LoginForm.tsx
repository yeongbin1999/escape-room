"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleEmailLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Firestore에서 역할 확인
      const userDoc = await getDoc(doc(db, "users", uid));
      const role = userDoc.data()?.role || "player";

      if (role === "admin") router.push("/admin");
      else router.push("/game/select");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;

      // 익명 사용자는 기본적으로 player
      router.push("/game/select");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>ESCAPE ROOM</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="primary" onClick={handleEmailLogin}>
          이메일 로그인
        </button>

        <button className="secondary" onClick={handleAnonymousLogin}>
          익명으로 시작
        </button>

        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>
    </div>
  );
}