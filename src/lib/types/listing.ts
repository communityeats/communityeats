export const LISTING_CATEGORIES = ['home', 'share', 'coop'] as const
export type ListingCategory = (typeof LISTING_CATEGORIES)[number]

export const EXCHANGE_TYPES = ['swap', 'gift'] as const
export type ExchangeType = (typeof EXCHANGE_TYPES)[number]

export const LISTING_STATUSES = ['available', 'claimed', 'removed'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

export interface ListingLocation {
  country: string
  state: string
  suburb: string
  postcode: number
  place_id?: string | null
  label?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type ListingLocationInput = Partial<
  Omit<ListingLocation, 'postcode' | 'latitude' | 'longitude'>
> & {
  postcode?: number | string | null
  latitude?: number | string | null
  longitude?: number | string | null
}

export interface ListingDoc {
  anonymous: boolean
  category: ListingCategory
  contact_info: string | null
  description: string
  exchange_type: ExchangeType
  id: string
  image_ids: string[]
  interested_users_uids: string[]
  location: ListingLocation
  status: ListingStatus
  thumbnail_id: string
  title: string
  user_id: string
  created_at: string
  updated_at: string
  location_place_id?: string | null
  location_label?: string | null

  /**
   * @deprecated Prefer `location.country`. Retained until callers stop relying on it.
   */
  country?: string
  /**
   * @deprecated Prefer `location.state`. Retained until callers stop relying on it.
   */
  state?: string
  /**
   * @deprecated Prefer `location.suburb`. Retained until callers stop relying on it.
   */
  suburb?: string
  /**
   * @deprecated Prefer `location.postcode`. Retained until callers stop relying on it.
   */
  postcode?: number
}

export function isExchangeType(value: unknown): value is ExchangeType {
  return typeof value === 'string' && (EXCHANGE_TYPES as readonly string[]).includes(value)
}

export function isListingStatus(value: unknown): value is ListingStatus {
  return typeof value === 'string' && (LISTING_STATUSES as readonly string[]).includes(value)
}

export function normalizeListingLocation(input: ListingLocationInput): ListingLocation {
  const normalize = (value: unknown) =>
    typeof value === 'string' ? value.trim().toLowerCase() : ''

  const parsePostcode = (value: unknown) => {
    const num = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(num) ? Math.trunc(num) : 0
  }

  const parseCoordinate = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const num = Number(value)
      if (Number.isFinite(num)) return num
    }
    return undefined
  }

  const placeId =
    typeof input.place_id === 'string' && input.place_id.trim() ? input.place_id.trim() : undefined
  const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim() : undefined
  const latitude = parseCoordinate(input.latitude)
  const longitude = parseCoordinate(input.longitude)

  return {
    country: normalize(input.country),
    state: normalize(input.state),
    suburb: normalize(input.suburb),
    postcode: parsePostcode(input.postcode),
    ...(placeId ? { place_id: placeId } : {}),
    ...(label ? { label } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
  }
}

export function thumbnailInImageIds(imageIds: unknown, thumbnailId: unknown): boolean {
  return (
    Array.isArray(imageIds) &&
    typeof thumbnailId === 'string' &&
    imageIds.every((item) => typeof item === 'string') &&
    imageIds.includes(thumbnailId)
  )
}
