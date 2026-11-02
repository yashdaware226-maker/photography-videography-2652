import { getStore } from "@netlify/blobs";

const STORE = "instagram";
const TOKEN_KEY = "token";

type StoredToken = { token: string; refreshedAt: string };

// Prefer the auto-refreshed token in Blobs; fall back to the one set as an env var.
export async function getToken(): Promise<string | null> {
  const stored = (await getStore(STORE).get(TOKEN_KEY, { type: "json" })) as StoredToken | null;
  return stored?.token || Netlify.env.get("INSTAGRAM_ACCESS_TOKEN") || null;
}

export async function saveToken(token: string) {
  await getStore(STORE).setJSON(TOKEN_KEY, { token, refreshedAt: new Date().toISOString() });
}
