const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const BASE = "https://www.googleapis.com/youtube/v3";

async function fetchYT(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export function hasYouTubeKey(): boolean {
  return !!(API_KEY && API_KEY.trim());
}

function extractChannelId(url: string): string | null {
  const m =
    url.match(/youtube\.com\/channel\/(UC[\w-]+)/) ||
    url.match(/youtube\.com\/@([\w-]+)/) ||
    url.match(/youtube\.com\/c\/([\w-]+)/);
  if (m) return m[1];
  if (/^UC[\w-]{10,}$/.test(url.trim())) return url.trim();
  return null;
}

async function resolveChannelId(input: string): Promise<string> {
  const direct = extractChannelId(input);
  if (direct?.startsWith("UC")) return direct;

  if (!API_KEY) {
    throw new Error(
      "VITE_YOUTUBE_API_KEY is not configured. Add it to your Cloudflare Pages environment variables.",
    );
  }

  const handle = (direct ?? input)
    .replace(/.*youtube\.com\/@?/, "")
    .replace(/\/.*/, "")
    .trim();

  const data = (await fetchYT(
    `${BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${API_KEY}`,
  )) as { items?: Array<{ id: { channelId: string } }> };

  const id = data.items?.[0]?.id?.channelId;
  if (!id) throw new Error(`Could not resolve YouTube channel: ${input}`);
  return id;
}

export interface YTVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  channelTitle: string;
  viewCount: string | null;
  duration: string | null;
}

export async function getChannelVideos(
  channelIdOrUrl: string,
  maxResults = 8,
): Promise<YTVideo[]> {
  if (!API_KEY) {
    throw new Error(
      "VITE_YOUTUBE_API_KEY is not configured. Add it to your Cloudflare Pages environment variables.",
    );
  }

  const channelId = await resolveChannelId(channelIdOrUrl);

  const chanData = (await fetchYT(
    `${BASE}/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`,
  )) as {
    items?: Array<{
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  };

  const uploadsId =
    chanData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error("Uploads playlist not found for this channel.");

  const plData = (await fetchYT(
    `${BASE}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${maxResults}&key=${API_KEY}`,
  )) as {
    items?: Array<{
      snippet: {
        resourceId: { videoId: string };
        title: string;
        thumbnails: { high?: { url: string }; medium?: { url: string } };
        publishedAt: string;
        channelTitle: string;
      };
    }>;
  };

  const videoIds = (plData.items ?? [])
    .map((i) => i.snippet.resourceId.videoId)
    .join(",");

  let statsMap: Record<string, { viewCount?: string; duration?: string }> = {};
  if (videoIds) {
    const statsData = (await fetchYT(
      `${BASE}/videos?part=statistics,contentDetails&id=${videoIds}&key=${API_KEY}`,
    )) as {
      items?: Array<{
        id: string;
        statistics: { viewCount?: string };
        contentDetails: { duration?: string };
      }>;
    };
    for (const item of statsData.items ?? []) {
      statsMap[item.id] = {
        viewCount: item.statistics?.viewCount,
        duration: item.contentDetails?.duration,
      };
    }
  }

  return (plData.items ?? []).map((item) => {
    const vid = item.snippet.resourceId.videoId;
    return {
      id: vid,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      viewCount: statsMap[vid]?.viewCount ?? null,
      duration: statsMap[vid]?.duration ?? null,
    };
  });
}
