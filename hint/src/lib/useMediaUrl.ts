import { useState, useEffect } from 'react';

/**
 * `useMediaUrl` 훅은 클라우드 스토리지에 안전하게 저장된 미디어(예: 이미지, 비디오)의 URL을 가져오는 데 사용됩니다.
 * 미디어 파일에 직접 접근하는 대신, 서버로부터 한정된 시간 동안 유효한 '사전 서명된 URL (presigned URL)'을 받아 사용함으로써 보안을 강화합니다.
 * 이를 통해 클라이언트가 스토리지 접근 권한 없이도 안전하게 미디어를 로드할 수 있게 합니다.
 *
 * @param key 클라우드 스토리지 내 미디어 파일의 고유 키 (경로).
 * @returns 미디어 파일에 접근할 수 있는 URL 문자열 또는 로딩 중이거나 에러 발생 시 `null`.
 */
export function useMediaUrl(key: string | null | undefined): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setImageUrl(null);
      return;
    }

    // 보안상의 이유로 직접적인 스토리지 접근 대신, 서버를 통해 사전 서명된 URL을 요청합니다.
    let isCancelled = false;
    const mediaKey: string = key; 

    async function fetchSignedUrl() {
      try {
        // 미디어 키에 특수 문자가 포함될 수 있으므로, URL 인코딩을 적용하여 안전하게 전달합니다.
        const response = await fetch(`/api/signed-url?key=${encodeURIComponent(mediaKey)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch signed URL');
        }
        const data = await response.json();
        if (!isCancelled) {
          setImageUrl(data.signedUrl);
        }
      } catch (error) {
        console.error("Error fetching signed URL for key:", key, error);
        if (!isCancelled) {
          setImageUrl(null); // 에러 발생 시 URL을 null 처리
        }
      }
    }

    fetchSignedUrl();

    return () => {
      isCancelled = true;
    };
  }, [key]);

  return imageUrl;
}
