import type { InterestedUser } from '@/lib/api/listings'

type Props = {
  interestedUsers: InterestedUser[] | null
  fallbackInterestedIds: string[]
  loading: boolean
  error: string | null
  onStartConversation?: (userUid: string) => void
  startingConversationUid?: string | null
}

export function InterestedUsersPanel({
  interestedUsers,
  fallbackInterestedIds,
  loading,
  error,
  onStartConversation,
  startingConversationUid,
}: Props) {
  return (
    <div className="border rounded p-4">
      <h2 className="text-lg font-semibold">Interest</h2>
      <p className="text-sm text-gray-700 mt-1">
        Interested users:{' '}
        <span className="font-medium">
          {interestedUsers?.length ?? fallbackInterestedIds.length}
        </span>
      </p>

      {loading ? (
        <div className="mt-3 text-xs text-gray-500">Loading interested users…</div>
      ) : error ? (
        <div className="mt-3 text-xs text-red-600">{error}</div>
      ) : interestedUsers && interestedUsers.length ? (
        <div className="mt-3 space-y-2">
          {interestedUsers.map(({ uid, name, email }) => (
            <div
              key={uid}
              className="flex flex-col gap-2 bg-white border rounded p-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{name || 'Unnamed user'}</div>
                  <div className="text-xs text-gray-500">{email || `UID: ${uid}`}</div>
                </div>
                {onStartConversation ? (
                  <button
                    type="button"
                    onClick={() => onStartConversation(uid)}
                    disabled={startingConversationUid === uid}
                    className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {startingConversationUid === uid ? 'Opening…' : 'Message'}
                  </button>
                ) : (
                  <div className="text-xs text-gray-500">interested</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : fallbackInterestedIds.length ? (
        <div className="mt-3 space-y-2">
          {fallbackInterestedIds.map((uid) => (
            <div
              key={uid}
              className="flex items-center justify-between bg-white border rounded p-2 text-sm"
            >
              <div className="font-medium">{uid}</div>
              {onStartConversation ? (
                <button
                  type="button"
                  onClick={() => onStartConversation(uid)}
                  disabled={startingConversationUid === uid}
                  className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {startingConversationUid === uid ? 'Opening…' : 'Message'}
                </button>
              ) : (
                <div className="text-xs text-gray-500">interested</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-500">No interest yet.</div>
      )}
    </div>
  )
}

export default InterestedUsersPanel
