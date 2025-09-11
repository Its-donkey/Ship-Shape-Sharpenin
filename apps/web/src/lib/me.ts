export async function fetchMe() {
  const res = await fetch("/api/customers/me", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.customer ?? null;
}
