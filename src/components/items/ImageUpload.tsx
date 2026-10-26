import { useRef, useState } from 'react';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../../utils/constants';

interface ImageUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

export function ImageUpload({ file, onChange, error }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = (selected: File | null) => {
    setLocalError(null);
    if (!selected) {
      onChange(null);
      setPreview(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setLocalError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE_BYTES) {
      setLocalError('Image must be under 5MB.');
      return;
    }
    onChange(selected);
    setPreview(URL.createObjectURL(selected));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">Photo (optional)</span>
      <div className="flex items-center gap-4">
        {preview ? (
          <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
            <img src={preview} alt="Selected item preview" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border text-slate-light">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="9" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-black/[0.03]"
          >
            {file ? 'Change photo' : 'Upload photo'}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => handleFile(null)}
              className="text-xs text-coral-dark text-left"
            >
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {(localError || error) && <span className="text-xs text-coral-dark">{localError ?? error}</span>}
    </div>
  );
}
