import type {
  ExchangeType,
  ListingStatus,
} from '@/lib/types/listing'

export type EditFormState = {
  title: string
  description: string
  exchange_type: ExchangeType | ''
  status: ListingStatus | ''
  location: {
    country: string
    state: string
    suburb: string
    postcode: string
  }
}
