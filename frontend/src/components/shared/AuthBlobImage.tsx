import React, { useEffect, useState } from 'react';

export type LoadStatus = 'loading' | 'success' | 'error';

/**
 * Loads an image with ``Authorization: Bearer``; tries ``fallbackSrc`` on 404 from primary.
 */
const AuthBlobImage: React.FC<{
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  onStatus: (status: LoadStatus) => void;
}> = ({ src, fallbackSrc, alt, className, onStatus }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const token = localStorage.getItem('token');
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    onStatus('loading');

    const load = async () => {
      for (const url of [src, ...(fallbackSrc ? [fallbackSrc] : [])]) {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const blob = await res.blob();
          if (!active) return;
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
          onStatus('success');
          return;
        }
        if (res.status !== 404) {
          break;
        }
      }
      if (active) onStatus('error');
    };

    void load();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      setObjectUrl(null);
    };
  }, [src, fallbackSrc, onStatus]);

  if (!objectUrl) return null;
  return <img src={objectUrl} alt={alt} className={className} />;
};

export default AuthBlobImage;
