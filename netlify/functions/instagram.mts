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

  // Fetch every post (page through the API), capped as a safety limit.
  const MAX_POSTS = 500;
  const data: Media[] = [];
  const first = new URL("https://graph.instagram.com/me/media");
  first.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink");
  first.searchParams.set("limit", "100");
  first.searchParams.set("access_token", token);
  let next: string | undefined = first.toString();

  while (next && data.length < MAX_POSTS) {
    const res = await fetch(next);
    if (!res.ok) {
      console.error("Instagram API error", res.status, await res.text());
      if (data.length) break;
      return Response.json({ posts: [] }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const page = (await res.json()) as { data?: Media[]; paging?: { next?: string } };
    data.push(...(page.data ?? []));
    next = page.paging?.next;
  }

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
