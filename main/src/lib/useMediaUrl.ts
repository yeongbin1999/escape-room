import { useState, useEffect } from 'react';

export function useMediaUrl(key: string | null | undefined): { url: string | null; loading: boolean } {
  const [media, setMedia] = useState<{ url: string | null; loading: boolean }>({ url: null, loading: false });

  useEffect(() => {
    if (!key) {
      setMedia({ url: null, loading: false });
      return;
    }

    let isCancelled = false;
    const mediaKey: string = key;

    async function fetchSignedUrl() {
      setMedia({ url: null, loading: true }); // Start loading and clear previous URL
      try {
        const response = await fetch(`/api/signed-url?key=${encodeURIComponent(mediaKey)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch signed URL');
        }
        const data = await response.json();
        if (!isCancelled) {
          setMedia({ url: data.signedUrl, loading: false }); // Success
        }
      } catch (error) {
        console.error("Error fetching signed URL for key:", key, error);
        if (!isCancelled) {
          setMedia({ url: null, loading: false }); // Error
        }
      }
    }

    fetchSignedUrl();

    return () => {
      isCancelled = true;
    };
  }, [key]);

  return media;
}
