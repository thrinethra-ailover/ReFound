import { PROFILE_PHOTOS_BUCKET, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../utils/constants';
import { supabase } from './supabase';

export async function createProfilePhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

export async function saveProfilePhoto(
  userId: string,
  file: File,
  oldPath: string | null
): Promise<{ path: string | null; error: string | null; cleanupWarning: boolean }> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { path: null, error: 'Choose a JPEG, PNG, or WebP image.', cleanupWarning: false };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { path: null, error: 'The photo must be under 5 MB.', cleanupWarning: false };
  }

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const storage = supabase.storage.from(PROFILE_PHOTOS_BUCKET);
  const { error: uploadError } = await storage.upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { path: null, error: uploadError.message, cleanupWarning: false };

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: path, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (profileError) {
    await storage.remove([path]);
    return { path: null, error: profileError.message, cleanupWarning: false };
  }

  if (oldPath) {
    const { error: cleanupError } = await storage.remove([oldPath]);
    return { path, error: null, cleanupWarning: Boolean(cleanupError) };
  }
  return { path, error: null, cleanupWarning: false };
}

export async function removeProfilePhoto(
  userId: string,
  path: string
): Promise<{ error: string | null; cleanupWarning: boolean }> {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profileError) return { error: profileError.message, cleanupWarning: false };

  const { error: storageError } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([path]);
  return { error: null, cleanupWarning: Boolean(storageError) };
}
