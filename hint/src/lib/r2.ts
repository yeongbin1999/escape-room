/**
 * Cloudflare R2 스토리지 서비스와의 상호작용을 위한 유틸리티 함수들을 제공합니다.
 * AWS S3 SDK를 사용하여 R2 버킷에 파일을 업로드, 다운로드, 삭제하는 등의 작업을 수행합니다.
 * 환경 변수를 통해 R2 인증 정보를 안전하게 관리합니다.
 */
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2 접속을 위한 환경 변수들을 불러옵니다.
// 이 변수들은 .env 파일 또는 배포 환경에서 설정되어야 합니다.
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET;

// 필수 환경 변수가 설정되지 않았을 경우, 에러 메시지를 출력하여 개발자에게 알립니다.
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Cloudflare R2 환경 변수가 완전히 설정되지 않았습니다. 다음 중 하나가 누락되었습니다: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.");
}

/**
 * Cloudflare R2에 접속하기 위한 S3Client 인스턴스입니다.
 * R2는 AWS S3와 호환되므로 S3Client를 사용하여 접근합니다.
 * `region: "auto"`는 Cloudflare R2에서 요구하는 설정이며, `endpoint`는 R2의 특정 계정 URL을 가리킵니다.
 */
export const r2 = new S3Client({
  region: "auto", // Cloudflare R2는 "auto" 리전을 사용해야 합니다.
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

/**
 * R2 버킷에서 지정된 키(파일 경로)에 해당하는 객체를 삭제합니다.
 * 삭제 작업 전, 버킷 이름 환경 변수가 설정되어 있는지 확인하여 안정성을 높입니다.
 * @param key 삭제할 객체의 키 (예: 'images/example.jpg').
 */
export const deleteR2Object = async (key: string): Promise<void> => {
  if (!R2_BUCKET_NAME) {
    console.warn("R2_BUCKET_NAME이 정의되지 않았습니다. R2 객체 삭제를 건너뜝니다 (키:", key, ").");
    return;
  }
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await r2.send(command);
    console.log(`R2 객체 성공적으로 삭제: ${key}`);
  } catch (error) {
    console.error(`R2 객체 ${key} 삭제 중 에러 발생:`, error);
    throw error; // 에러를 상위 호출자에게 다시 던져 처리하도록 합니다.
  }
};
