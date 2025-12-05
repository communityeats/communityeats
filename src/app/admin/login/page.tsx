import AdminLoginForm from './AdminLoginForm'

type SearchParams = Record<string, string | string[] | undefined>

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) ?? {}
  const errorParam = Array.isArray(sp.error) ? sp.error[0] : sp.error

  const initialError =
    errorParam === 'unauthorized' ? 'You must be an admin to access that page.' : null

  return <AdminLoginForm initialError={initialError} />
}
