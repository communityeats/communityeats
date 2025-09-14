// src/lib/images-server.ts
import 'server-only';
import { getStorage } from '@/lib/firebase/admin';

export async function getSignedReadUrl(imageId: string) {
  const filePath = `listings/${imageId}`;
  const [url] = await getStorage().bucket().file(filePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}