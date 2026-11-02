import type { Config } from "@netlify/functions";
import { getToken, saveToken } from "../lib/instagram.mts";

// Instagram long-lived tokens expire after 60 days; refresh weekly and store the new one.
export default async () => {
  const token = await getToken();
  if (!token) return;
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Instagram token refresh failed", res.status, await res.text());
    return;
  }
  const { access_token } = (await res.json()) as { access_token?: string };
  if (access_token) await saveToken(access_token);
};

export const config: Config = { schedule: "@weekly" };
