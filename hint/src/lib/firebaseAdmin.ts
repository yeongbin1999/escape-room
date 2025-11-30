import * as admin from "firebase-admin";

// 중복 초기화 방지
if (!admin.apps.length) {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing");

  const serviceAccount = JSON.parse(key);

  // private_key 줄바꿈 복구
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAdmin = admin;
export const auth = admin.auth();
export const db = admin.firestore();