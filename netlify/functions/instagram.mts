import type { Config } from "@netlify/functions";
import { getToken } from "../lib/instagram.mts";

type Media = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
};

export default async () => {
  const token = await getToken();
  if (!token) return Response.json({ posts: [] }, { headers: { "Cache-Control": "no-store" } });

  const url = new URL("https://graph.instagram.com/me/media");
  url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink");
  url.searchParams.set("limit", "18");
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Instagram API error", res.status, await res.text());
    return Response.json({ posts: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const { data = [] } = (await res.json()) as { data?: Media[] };
  const posts = data
    .map((m) => ({
      id: m.id,
      caption: m.caption ?? "",
      image: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
      video: m.media_type === "VIDEO",
      permalink: m.permalink,
    }))
    .filter((p) => p.image);

  return Response.json(
    { posts },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        // Cache at the CDN for an hour so we don't hit Instagram on every visit.
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
};

export const config: Config = { path: "/api/instagram" };
