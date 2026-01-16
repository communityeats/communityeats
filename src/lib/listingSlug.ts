import type { Firestore } from 'firebase-admin/firestore'

export const normalizeUsername = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '')

  if (normalized.length < 3 || normalized.length > 30) return null
  return normalized
}

export const slugifyTitle = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  return slug || 'listing'
}

export const buildListingSlug = (username: string, title: string): string => {
  return `${username}-${slugifyTitle(title)}`
}

export const ensureUniqueListingSlug = async (
  db: Firestore,
  baseSlug: string,
  ignoreId?: string
): Promise<string> => {
  let candidate = baseSlug
  let suffix = 1

  while (suffix < 50) {
    const existing = await db
      .collection('listings')
      .where('public_slug', '==', candidate)
      .limit(1)
      .get()

    if (existing.empty) return candidate

    const doc = existing.docs[0]
    if (ignoreId && doc.id === ignoreId) return candidate

    suffix += 1
    candidate = `${baseSlug}-${suffix}`
  }

  return `${baseSlug}-${Date.now().toString(36)}`
}
