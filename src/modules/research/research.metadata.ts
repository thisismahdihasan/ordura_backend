import { EtsyMetadata } from "./research.type.js";

const DEFAULT_TIMEOUT_MS = 4000;

const decodeHtmlEntities = (rawText: string): string => {
  return rawText
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/");
};

export const parseHtmlMetadata = (html: string): EtsyMetadata => {
  let title: string | null = null;
  let referenceImageUrl: string | null = null;

  // 1. Extract og:title or fallback to <title>
  const ogTitleMatch =
    html.match(
      /<meta\s+[^>]*?(?:property|name)=["']og:title["'][^>]*?content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']og:title["']/i
    );

  if (ogTitleMatch && ogTitleMatch[1]) {
    title = decodeHtmlEntities(ogTitleMatch[1].trim());
  } else {
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTagMatch && titleTagMatch[1]) {
      const parsedTitle = decodeHtmlEntities(titleTagMatch[1].trim());
      title = parsedTitle.replace(/\s*\|\s*Etsy.*$/i, "").trim() || parsedTitle;
    }
  }

  // 2. Extract og:image
  const ogImageMatch =
    html.match(
      /<meta\s+[^>]*?(?:property|name)=["']og:image["'][^>]*?content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["']og:image["']/i
    );

  if (ogImageMatch && ogImageMatch[1]) {
    referenceImageUrl = ogImageMatch[1].trim();
  }

  // Sanity check: title must be non-empty string capped at 500 chars
  if (title) {
    title = title.trim();
    if (title.length > 500) {
      title = title.slice(0, 500).trim();
    }
    if (title.length === 0) {
      title = null;
    }
  }

  // Sanity check: referenceImageUrl must be a valid http/https URL
  if (referenceImageUrl) {
    referenceImageUrl = referenceImageUrl.trim();
    try {
      const parsedImgUrl = new URL(referenceImageUrl);
      if (parsedImgUrl.protocol !== "http:" && parsedImgUrl.protocol !== "https:") {
        referenceImageUrl = null;
      }
    } catch {
      referenceImageUrl = null;
    }
  }

  return {
    title: title || null,
    referenceImageUrl: referenceImageUrl || null,
  };
};

export const fetchEtsyMetadata = async (
  url: string,
  customFetch?: typeof fetch
): Promise<EtsyMetadata> => {
  const activeFetch = customFetch ?? fetch;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, DEFAULT_TIMEOUT_MS);

  try {
    const response = await activeFetch(url, {
      signal: abortController.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return { title: null, referenceImageUrl: null };
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return { title: null, referenceImageUrl: null };
    }

    const html = await response.text();
    return parseHtmlMetadata(html);
  } catch {
    // Non-blocking: timeouts, network failures, 403/429/5xx, and parse errors safely return null
    return { title: null, referenceImageUrl: null };
  } finally {
    clearTimeout(timeoutId);
  }
};
