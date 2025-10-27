export interface ConversationDoc {
  id: string
  listing_id: string
  listing_owner_uid: string
  listing_title: string | null
  participant_uids: string[]
  participant_profiles?: Record<string, string | null>
  participant_pair_key: string
  created_at: string | null
  updated_at: string | null
  last_message_preview: string | null
  last_message_at: string | null
  last_message_author_uid: string | null
}

export interface MessageDoc {
  id: string
  conversation_id: string
  author_uid: string
  body: string
  created_at: string | null
  created_at_ms: number | null
}
