import LoginForm from "./LoginForm";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const redirectValue = sp.redirect;
  const redirect =
    Array.isArray(redirectValue) ? redirectValue[0] : redirectValue ?? "/dashboard";

  return <LoginForm redirect={redirect} />;
}