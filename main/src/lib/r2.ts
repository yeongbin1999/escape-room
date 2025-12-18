import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// 1. 환경 변수 로드
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET;

// 2. 환경 변수 유효성 검사
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("Cloudflare R2 환경 변수가 모두 설정되지 않았습니다. 다음 중 하나가 누락되었습니다: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.");
}

// 3. R2 클라이언트 초기화 및 내보내기 (R2는 S3와 호환되므로 S3Client 사용)
export const r2 = new S3Client({
  region: "auto", // Cloudflare R2 사용 시 필수 설정
  // R2 서비스 엔드포인트 URL 지정 (S3Client가 R2에 연결되도록 함)
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  // 인증 정보 설정
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

// 4. R2 객체 삭제 함수 내보내기
export const deleteR2Object = async (key: string): Promise<void> => {
  // 버킷 이름이 설정되지 않았다면 삭제 로직을 건너뜀
  if (!R2_BUCKET_NAME) {
    console.warn("R2_BUCKET_NAME이 정의되지 않았습니다. 키:", key, "에 대한 R2 객체 삭제를 건너뜝니다.");
    return;
  }
  
  try {
    // AWS S3 SDK의 DeleteObjectCommand를 생성
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME, // 삭제할 버킷 이름
      Key: key,                // 삭제할 파일의 키(경로)
    });
    
    // R2 클라이언트를 통해 명령 실행
    await r2.send(command);
    
    console.log(`R2 객체를 성공적으로 삭제했습니다: ${key}`);
  } catch (error) {
    // 삭제 중 오류 발생 시 처리
    console.error(`R2 객체 ${key} 삭제 오류:`, error);
    // 상위 호출자에게 오류를 전달하여 추가 처리 가능하도록 함
    throw error;
  }
};