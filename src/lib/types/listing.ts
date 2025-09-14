// Enumerations where values look constrained in practice.
// Add more literals as they appear in your data.
export type ListingCategory = 'share'
export type ExchangeType = 'swap'
export type ListingStatus = 'available'

export interface ListingLocation {
  country: string          // e.g., "australia"
  state: string            // e.g., "vic"
  suburb: string           // e.g., "fitzroy"
  postcode: number         // e.g., 3002
}

export interface ListingDoc {
  // Booleans / strings
  anonymous: boolean
  category: ListingCategory
  contact_info: string                     // e.g., "phone number: 0434 530 553"
  country: string                          // duplicated by location.country; consider normalizing to one source
  description: string
  exchange_type: ExchangeType
  id: string                               // often redundant with the Firestore document id
  status: ListingStatus
  thumbnail_id: string
  title: string
  user_id: string

  // Arrays
  image_ids: string[]
  interested_users_uids: string[]

  // Nested map
  location: ListingLocation

  // Timestamps (choose ONE representation; see note below)
  created_at: string                       // ISO string, e.g., "2025-08-24T13:49:13.506Z"
  updated_at: string
}