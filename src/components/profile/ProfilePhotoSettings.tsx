import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../../utils/constants';
import { removeProfilePhoto, saveProfilePhoto } from '../../lib/profileService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfilePhotoCropper } from './ProfilePhotoCropper';

export function ProfilePhotoSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [candidateUrl, setCandidateUrl] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => () => {
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
  }, [candidateUrl]);

  const initials = (profile?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const clearCandidate = () => {
    setCandidate(null);
    setCandidateUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleChoose = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      showToast('Choose a JPEG, PNG, or WebP image.', 'error');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      showToast('The photo must be under 5 MB.', 'error');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setCandidate(file);
    setCandidateUrl(URL.createObjectURL(file));
  };

  const handleCropSave = async (croppedFile: File) => {
    if (!user) return;
    setBusy(true);
    const result = await saveProfilePhoto(user.id, croppedFile, profile?.avatar_url ?? null);
    setBusy(false);
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    await refreshProfile();
    clearCandidate();
    showToast(
      result.cleanupWarning ? 'Photo updated, but the previous file could not be removed.' : 'Profile photo updated.',
      result.cleanupWarning ? 'info' : 'success'
    );
  };

  const handleRemove = async () => {
    if (!user || !profile?.avatar_url) return;
    setBusy(true);
    const result = await removeProfilePhoto(user.id, profile.avatar_url);
    setBusy(false);
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    await refreshProfile();
    showToast(result.cleanupWarning ? 'Photo removed from your profile.' : 'Profile photo removed.', 'success');
  };

  const closeCropper = () => {
    if (!busy) clearCandidate();
  };

  return (
    <section className="rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-lg font-semibold text-ink">Profile photo</h2>
      <p className="mt-1 text-sm text-slate">This photo is private to your account and appears in your account menu.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => profile?.avatar_url && setViewOpen(true)}
          disabled={!profile?.avatar_url}
          aria-label={profile?.avatar_url ? 'View profile photo' : 'No profile photo uploaded'}
          className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-default"
        >
          <ProfileAvatar path={profile?.avatar_url ?? null} initials={initials} className="h-20 w-20 text-xl" />
        </button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={busy}>
            {profile?.avatar_url ? 'Change photo' : 'Upload photo'}
          </Button>
          {profile?.avatar_url && (
            <Button type="button" size="sm" variant="ghost" onClick={handleRemove} loading={busy}>
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          disabled={busy}
          onChange={(event) => handleChoose(event.target.files?.[0])}
        />
      </div>
      <p className="mt-3 text-xs text-slate-light">JPEG, PNG, or WebP; maximum 5 MB. Click your photo to view it.</p>

      <Modal open={Boolean(candidateUrl && candidate)} onClose={closeCropper} title="Crop profile photo">
        {candidateUrl && candidate && (
          <ProfilePhotoCropper
            src={candidateUrl}
            fileName={candidate.name}
            saving={busy}
            onSave={handleCropSave}
            onCancel={closeCropper}
          />
        )}
      </Modal>

      <Modal open={viewOpen && Boolean(profile?.avatar_url)} onClose={() => setViewOpen(false)} title="Profile photo">
        <div className="flex justify-center">
          <ProfileAvatar path={profile?.avatar_url ?? null} initials={initials} className="h-72 w-72 max-w-full text-5xl" />
        </div>
      </Modal>
    </section>
  );
}
