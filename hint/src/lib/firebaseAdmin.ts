/**
 * 이 파일은 Firebase Admin SDK를 초기화하고 내보냅니다.
 * Firebase Admin SDK는 Node.js 환경(서버리스 함수, 백엔드 서버 등)에서만 사용되며,
 * 사용자 관리, 데이터베이스 접근, 푸시 알림 발송 등 Firebase 프로젝트에 대한
 * 높은 권한의 작업을 수행할 수 있도록 해줍니다.
 */
import * as admin from 'firebase-admin';

// Firebase Admin SDK가 이미 초기화되었는지 확인합니다.
// 이는 개발 환경에서 핫 리로딩 시 중복 초기화를 방지하고,
// 여러 서버리스 함수 호출 시 각 인스턴스가 독립적으로 SDK를 초기화하지 않도록 합니다.
if (!admin.apps.length) {
  try {
    // 환경 변수에서 Firebase 서비스 계정 키를 가져옵니다.
    // 이 키는 Firebase 프로젝트에 대한 관리자 권한을 부여하므로 매우 중요하며,
    // 절대 클라이언트 측에 노출되어서는 안 됩니다.
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY 환경 변수가 설정되지 않았습니다.');
    }

    // 환경 변수에 저장된 JSON 형태의 서비스 계정 키를 파싱합니다.
    const serviceAccount = JSON.parse(serviceAccountKey);

    // Firebase Admin SDK를 서비스 계정 자격 증명으로 초기화합니다.
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK가 성공적으로 초기화되었습니다.');
  } catch (error) {
    console.error('Firebase Admin SDK 초기화 중 에러 발생:', error);
  }
}

// 초기화된 Firebase Admin SDK 인스턴스를 내보냅니다.
export const firebaseAdmin = admin;

