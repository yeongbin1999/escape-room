/**
 * 이 파일은 Firebase 클라이언트 SDK를 초기화하고 필요한 Firebase 서비스 인스턴스(인증, Firestore, 스토리지)를 내보냅니다.
 * 클라이언트 측 애플리케이션에서 Firebase 서비스에 접근하기 위한 기본 설정을 담당합니다.
 */
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// .env 파일 또는 환경 변수에서 Firebase 프로젝트 설정을 가져옵니다.
// NEXT_PUBLIC_ 접두사는 이 변수들이 클라이언트 측 코드에서 접근 가능함을 나타냅니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Firebase 앱이 이미 초기화되었는지 확인하고, 초기화되지 않았다면 초기화합니다.
// 이는 Next.js와 같이 SSR 환경에서 앱이 여러 번 초기화되는 것을 방지합니다.
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// 초기화된 Firebase 앱 인스턴스에서 각 서비스의 인스턴스를 가져와 내보냅니다.
export const auth = getAuth(app); // Firebase Authentication 서비스
export const db = getFirestore(app); // Firestore 데이터베이스 서비스
export const storage = getStorage(app); // Firebase Storage 서비스

