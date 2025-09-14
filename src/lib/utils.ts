import { getStorage } from '@/lib/firebase/admin'

export const buildImageUrlFromId = async (imageId: string) => {
    const filePath = `listings/${imageId}`
    const [url] = await getStorage().bucket().file(filePath).getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })
    return url
}

