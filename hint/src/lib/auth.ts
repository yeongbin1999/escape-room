import { auth } from "@/lib/firebaseConfig";
import { signInWithCustomToken } from "firebase/auth";

/**
 * 서버로부터 커스텀 토큰을 받아 Firebase에 로그인합니다.
 * @returns Firebase User 객체
 */
export async function autoSignInPlayer() {
  try {
    console.log("🔹 커스텀 토큰 요청 중...");

    const response = await fetch('/api/auth/custom-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ 커스텀 토큰 요청 실패:", errorData.message || response.statusText);
      throw new Error(errorData.message || 'Failed to fetch custom token');
    }

    const { customToken } = await response.json();
    console.log("✅ 커스텀 토큰 수신:", customToken?.slice(0, 20) + "...");

    const userCredential = await signInWithCustomToken(auth, customToken);
    console.log("✅ Firebase 로그인 성공:", userCredential.user.email);

    return userCredential.user;
  } catch (error: any) {
    console.error("❌ 커스텀 토큰 자동 로그인 중 에러:", error.message);
    throw error;
  }
}
