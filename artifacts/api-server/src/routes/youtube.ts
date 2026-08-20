import { Router } from "express";
import {
  GetChannelVideosQueryParams,
  SearchYouTubeVideosQueryParams,
} from "@workspace/api-zod";

const router = Router();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YT_BASE = "https://www.googleapis.com/youtube/v3";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }
  return res.json();
}

function extractChannelId(url: string): string | null {
  // handles: /channel/UCxxxx  /c/name  /@handle  plain ID
  const m =
    url.match(/youtube\.com\/channel\/(UC[\w-]+)/) ||
    url.match(/youtube\.com\/@([\w-]+)/) ||
    url.match(/youtube\.com\/c\/([\w-]+)/);
  if (m) return m[1];
  // bare channel ID
  if (/^UC[\w-]{10,}$/.test(url.trim())) return url.trim();
  return null;
}

async function resolveToChannelId(input: string): Promise<string> {
  // If it's already a UC... id
  const direct = extractChannelId(input);
  if (direct && direct.startsWith("UC")) return direct;

  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");

  // handle or custom name — resolve via search
  const handle = direct ?? input.replace(/^@/, "");
  const url = `${YT_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YOUTUBE_API_KEY}`;
  const data = (await fetchJson(url)) as {
    items?: Array<{ id: { channelId: string } }>;
  };
  const id = data.items?.[0]?.id?.channelId;
  if (!id) throw new Error(`Could not resolve channel: ${input}`);
  return id;
}

// GET /api/youtube/channel-videos
router.get("/youtube/channel-videos", async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    res.status(500).json({ error: "YOUTUBE_API_KEY not configured on server" });
    return;
  }

  const parsed = GetChannelVideosQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { channelId: rawId, maxResults = 20 } = parsed.data;

  try {
    const channelId = await resolveToChannelId(rawId);

    // Get uploads playlist id
    const chanUrl = `${YT_BASE}/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const chanData = (await fetchJson(chanUrl)) as {
      items?: Array<{
        contentDetails: { relatedPlaylists: { uploads: string } };
      }>;
    };
    const uploadsId =
      chanData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
      res.status(404).json({ error: "Uploads playlist not found" });
      return;
    }

    // Fetch playlist items
    const plUrl = `${YT_BASE}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const plData = (await fetchJson(plUrl)) as {
      items?: Array<{
        snippet: {
          resourceId: { videoId: string };
          title: string;
          description: string;
          thumbnails: { high?: { url: string }; medium?: { url: string } };
          publishedAt: string;
          channelTitle: string;
        };
      }>;
    };

    const videoIds =
      plData.items?.map((i) => i.snippet.resourceId.videoId).join(",") ?? "";

    // Fetch stats
    let statsMap: Record<
      string,
      { viewCount?: string; duration?: string }
    > = {};
    if (videoIds) {
      const statsUrl = `${YT_BASE}/videos?part=statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
      const statsData = (await fetchJson(statsUrl)) as {
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

    const videos = (plData.items ?? []).map((item) => {
      const vid = item.snippet.resourceId.videoId;
      return {
        id: vid,
        title: item.snippet.title,
        description: item.snippet.description,
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

    res.json(videos);
  } catch (err) {
    req.log.error({ err }, "YouTube channel-videos error");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

// GET /api/youtube/search
router.get("/youtube/search", async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    res.status(500).json({ error: "YOUTUBE_API_KEY not configured on server" });
    return;
  }

  const parsed = SearchYouTubeVideosQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { channelId: rawId, query = "", maxResults = 20 } = parsed.data;

  try {
    const channelId = await resolveToChannelId(rawId);

    const url = `${YT_BASE}/search?part=snippet&channelId=${channelId}&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&order=date&key=${YOUTUBE_API_KEY}`;
    const data = (await fetchJson(url)) as {
      items?: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          description: string;
          thumbnails: { high?: { url: string }; medium?: { url: string } };
          publishedAt: string;
          channelTitle: string;
        };
      }>;
    };

    const videos = (data.items ?? []).map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail:
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      viewCount: null,
      duration: null,
    }));

    res.json(videos);
  } catch (err) {
    req.log.error({ err }, "YouTube search error");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
