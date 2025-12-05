import { getAuth, DecodedIdToken } from 'firebase-admin/auth'

class AdminAuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const parseAllowlist = (): string[] => {
  const raw =
    process.env.ADMIN_EMAIL_ALLOWLIST ||
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL_WHITELIST ||
    ''

  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

const adminEmails = parseAllowlist()

const isAdmin = (decoded: DecodedIdToken): boolean => {
  if (decoded.admin === true) return true
  if ((decoded as Record<string, unknown>)?.role === 'admin') return true

  const email = typeof decoded.email === 'string' ? decoded.email.toLowerCase() : null
  return email ? adminEmails.includes(email) : false
}

export const verifyAdminToken = async (authHeader: string | null) => {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AdminAuthError('Unauthorized', 401)
  }

  const token = authHeader.split('Bearer ')[1]
  const decoded = await getAuth().verifyIdToken(token)

  if (!isAdmin(decoded)) {
    throw new AdminAuthError('Forbidden', 403)
  }

  return decoded
}

export { AdminAuthError }
