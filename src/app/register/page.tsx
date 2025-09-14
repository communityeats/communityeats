import RegisterForm from "./RegisterForm";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const v = sp.redirect;
  const redirect = Array.isArray(v) ? v[0] : v ?? "/dashboard";
  return <RegisterForm redirect={redirect} />;
}