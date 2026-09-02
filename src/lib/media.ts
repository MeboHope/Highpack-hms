import { supabase } from '@/lib/supabase';

const BUCKET = 'property-media';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function uploadPropertyMedia(ownerId: string, propertyId: string, file: File): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE) {
    console.error('Property media upload error: file exceeds 100 MB limit');
    return null;
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowed.includes(file.type)) {
    console.error(`Property media upload error: unsupported type ${file.type}`);
    return null;
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${ownerId}/${propertyId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    console.error('Property media upload error:', error);
    return null;
  }
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function deletePropertyMedia(publicUrl: string): Promise<boolean> {
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return false;
    const path = decodeURIComponent(publicUrl.slice(index + marker.length));
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) console.error('Property media delete error:', error);
    return !error;
  } catch (error) {
    console.error('Property media path error:', error);
    return false;
  }
}
