/**
 * 이 파일은 클라이언트 측 인증 로직을 담당합니다.
 * 주로 Firebase Authentication을 사용하여 사용자를 안전하게 인증하고 관리합니다.
 * 서버에서 발급받은 커스텀 토큰을 이용한 자동 로그인 기능을 제공하여
 * 사용자에게 원활한 인증 경험을 제공합니다.
 */
import { auth } from "./firebaseConfig";
import { signInWithCustomToken } from "firebase/auth";

/**
 * 서버로부터 커스텀 인증 토큰을 받아 Firebase에 자동으로 로그인하는 함수입니다.
 * 이 방식은 클라이언트가 직접 사용자 이름과 비밀번호를 입력하는 대신,
 * 서버가 특정 사용자 또는 세션에 대한 인증 토큰을 발급하고,
 * 클라이언트는 이 토큰을 사용하여 Firebase에 인증하는 방식입니다.
 * 이를 통해 서버 측에서 사용자 인증 프로세스를 보다 세밀하게 제어할 수 있습니다.
 *
 * @returns {Promise<User>} 성공적으로 로그인된 Firebase User 객체.
 * @throws {Error} 커스텀 토큰을 가져오거나 Firebase 로그인에 실패할 경우 에러를 발생시킵니다.
 */
export async function autoSignInPlayer() {
  try {
    // '/api/auth/custom-token' 엔드포인트에 요청하여 서버로부터 커스텀 토큰을 받아옵니다.
    // 새로운 보안 설계에 따라 클라이언트에서 민감한 데이터를 전송하지 않습니다.
    const response = await fetch('/api/auth/custom-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch custom token');
    }

    const { customToken } = await response.json();

    // Firebase SDK의 signInWithCustomToken 함수를 사용하여 받아온 커스텀 토큰으로 로그인합니다.
    const userCredential = await signInWithCustomToken(auth, customToken);
    console.log("플레이어가 커스텀 토큰으로 자동 로그인되었습니다:", userCredential.user.email);
    return userCredential.user;
  } catch (error: any) {
    console.error("커스텀 토큰 자동 로그인 중 에러 발생:", error.message);
    throw error;
  }
}
