import { useEffect, useState } from 'react';
import { createProfilePhotoUrl } from '../../lib/profileService';

interface ProfileAvatarProps {
  path: string | null;
  initials: string;
  className: string;
}

export function ProfileAvatar({ path, initials, className }: ProfileAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (path) {
      createProfilePhotoUrl(path).then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <span className={`flex flex-none items-center justify-center overflow-hidden rounded-full bg-beacon text-xs font-bold text-ink ${className}`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}
