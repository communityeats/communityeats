import type { Firestore } from 'firebase-admin/firestore'

export const slugifyTitle = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  return slug || 'listing'
}

const formatListingDateSlug = (value: Date | string | number): string | null => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const buildListingSlug = (
  title: string,
  createdAt: Date | string | number
): string => {
  const dateSlug = formatListingDateSlug(createdAt)
  const titleSlug = slugifyTitle(title)

  return dateSlug ? `${titleSlug}-${dateSlug}` : titleSlug
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
