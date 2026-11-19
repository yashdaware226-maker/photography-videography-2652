import type { Config } from "@netlify/functions";

// Videos for the Films showreel, via YouTube's public RSS feeds (no API key needed).
// The chosen playlists come first; the channel's latest uploads are only a fallback.
const HANDLE = "the_cre8ive_yd";
const PLAYLISTS = [
  "PL5RPYrGhG6p1MlhZIX7j0nrXdkEdww0G3", // cinematic weddings
  "PL5RPYrGhG6p1BhlBcCHec5LRepxOklrVs", // cinematic pre-weddings
];

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function channelId(): Promise<string | null> {
  const fromEnv = Netlify.env.get("YOUTUBE_CHANNEL_ID");
  if (fromEnv) return fromEnv;
  const res = await fetch(`https://www.youtube.com/@${HANDLE}`, {
    headers: { "Accept-Language": "en-US,en;q=0.9", "User-Agent": "Mozilla/5.0 (compatible; TheCre8iveYD/1.0)" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m =
    html.match(/"externalId":"(UC[\w-]{22})"/) ||
    html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/) ||
    html.match(/youtube\.com\/channel\/(UC[\w-]{22})/) ||
    html.match(/"channelId":"(UC[\w-]{22})"/);
  return m ? m[1] : null;
}

export default async () => {
  const fail = (error: string) =>
    Response.json({ videos: [], error }, { status: 502, headers: { "Cache-Control": "no-store" } });

  const feed = async (q: string) => {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?${q}`);
    return r.ok ? r.text() : "";
  };
  // Alternate entries from each playlist so weddings and pre-weddings mix in the showreel.
  const lists = (await Promise.all(PLAYLISTS.map((id) => feed(`playlist_id=${id}`)))).map((x) =>
    [...x.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map((m) => m[0])
  );
  let xml = "";
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) xml += l[i];
  if (!/<entry>/.test(xml)) {
    const id = await channelId();
    if (!id) return fail("Could not find YouTube channel ID");
    xml = await feed(`channel_id=${id}`);
    if (!xml) return fail("YouTube feed unavailable");
  }

  const seen = new Set<string>();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(([, e]) => ({
      id: e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1],
      title: decode(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
      short: /\/shorts\//.test(e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? ""),
    }))
    .filter((v) => v.id && !seen.has(v.id) && seen.add(v.id));

  // Leave Shorts out of the Films showreel. The feed marks most Shorts with a /shorts/ link;
  // as a backup, youtube.com/shorts/ID answers 200 for a Short and redirects for a normal video.
  const isShort = async (v: { id?: string; short: boolean }) => {
    if (v.short) return true;
    try {
      const r = await fetch(`https://www.youtube.com/shorts/${v.id}`, { method: "HEAD", redirect: "manual" });
      return r.status === 200;
    } catch {
      return false;
    }
  };
  const flags = await Promise.all(entries.map(isShort));
  const videos = entries.filter((_, i) => !flags[i]).map(({ id, title }) => ({ id, title }));

  return Response.json(
    { videos },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
};

export const config: Config = { path: "/api/youtube" };
