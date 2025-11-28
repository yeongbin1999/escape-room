import { useState, useEffect } from 'react';

export function useMediaUrl(key: string | null | undefined): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setImageUrl(null);
      return;
    }

    // 그 외의 경우, Presigned URL을 서버에 요청
    let isCancelled = false;
    const mediaKey: string = key; // Ensure key is treated as string for encodeURIComponent

    async function fetchSignedUrl() {
      try {
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
