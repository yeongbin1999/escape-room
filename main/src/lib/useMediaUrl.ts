import { useState, useEffect } from 'react';

export function useMediaUrl(key: string | null | undefined): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // key가 유효하지 않으면 URL을 null로 설정
    if (!key) {
      setImageUrl(null);
      return;
    }

    // key가 'default'이면 로컬 public 이미지 경로를 사용
    if (key === 'default') {
      setImageUrl('/default.png');
      return;
    }

    // 그 외의 경우, Presigned URL을 서버에 요청
    let isCancelled = false;

    async function fetchSignedUrl() {
      try {
        const response = await fetch(`/api/signed-url?key=${encodeURIComponent(key)}`);
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
