/**
 * NASA's Astronomy Picture of the Day, read from science.nasa.gov.
 *
 * The APOD website moved to science.nasa.gov in 2026, and api.nasa.gov's
 * APOD service still scrapes the old pages: it answers 500 for today and the
 * site's generic header (title "NASA Science", NASA's logo) for every other
 * day. science.nasa.gov is WordPress, and its public REST API serves each
 * day's APOD as an `image-article` post in category 22766, newest first. It
 * answers browsers from any site. The `apis` skill, nasa.md, has the details.
 */
export interface ApodData {
  date: string;
  title: string;
  explanation: string;
  media_type: 'image' | 'video';
  /** The picture to show, or the video (an .mp4, or a YouTube/Vimeo embed) */
  url: string;
  /** The full-size picture */
  hdurl?: string;
  alt?: string;
  /** "Credit & Copyright: Luo Hongyang", as NASA words it */
  credit?: string;
  /** The day's page on science.nasa.gov */
  link?: string;
}

const APOD_CATEGORY = 22766;
const POSTS =
  'https://science.nasa.gov/wp-json/wp/v2/image-article' +
  `?categories=${APOD_CATEGORY}&per_page=1&_embed=wp:featuredmedia` +
  '&_fields=date,link,title,content,_links,_embedded';
const TIMEOUT_MS = 10_000;

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”'
};

/** Turn &amp;, &#8217; and &#x2019; into the characters they stand for */
export const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });

/** Post HTML as plain text: block tags become spaces, inline tags vanish */
export const htmlToText = (html: string) =>
  decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/figcaption)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return m ? decodeEntities(m[1]) : undefined;
};

/** The day's video, if it is one: NASA's own .mp4, or a YouTube or Vimeo embed */
const findVideo = (html: string): string | undefined => {
  for (const tag of html.match(/<(?:source|video)\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'src');
    if (src && /^https:\/\/assets\.science\.nasa\.gov\/.+\.(mp4|webm|mov)(\?|$)/i.test(src)) return src;
  }
  for (const tag of html.match(/<iframe\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'src');
    if (src && /^https:\/\/(www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(src)) return src;
  }
  return undefined;
};

interface WpMedia {
  source_url?: string;
  alt_text?: string;
  media_details?: { sizes?: Record<string, { source_url?: string; width?: number }> };
}

interface WpPost {
  date?: string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: { 'wp:featuredmedia'?: WpMedia[] };
}

/** One APOD post as what NASA News shows; null if it has no picture or video */
export const readApodPost = (post: WpPost): ApodData | null => {
  const html = post.content?.rendered ?? '';
  const text = htmlToText(html);

  // "APOD: 2026 November 15 – Leonid Meteors Through Orion"
  const title = decodeEntities(post.title?.rendered ?? '')
    .replace(/^APOD:\s*(?:\d{4}\s+[A-Za-z]+\s+\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*[–—-]\s*/, '')
    .trim();

  // The text runs "Explanation: … Tomorrow's picture: … Date: November 15,
  // 2026 Credit & Copyright: … Authors & editors: …", give or take a colon
  const explanation =
    text.match(/Explanation:\s*(.*?)\s*(?:Tomorrow.s picture:|Date:?\s+[A-Z][a-z]+ \d{1,2},? \d{4})/)?.[1]
      // some posts say "Explanation:" twice
      .replace(/^Explanation:\s*/, '') ?? '';
  const afterText = text.slice(text.indexOf('Explanation:') + 1);
  const creditMatch = afterText.match(
    /((?:Image |Video |Illustration )?Credit(?: (?:&|and) (?:Copyright|License))?):?\s+(.*?)\s*Authors? (?:&|and) editors/
  );
  // "Credit: Image Credit: NASA, ESA…" reads better as "Image Credit: NASA, ESA…"
  const creditValue = creditMatch?.[2].replace(/^:\s*/, '');
  const credit = !creditMatch
    ? undefined
    : /^(?:Image |Video )Credit:/.test(creditValue ?? '')
      ? creditValue
      : `${creditMatch[1]}: ${creditValue}`;

  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const full = media?.source_url;
  const shown = media?.media_details?.sizes?.large?.source_url ?? full;
  const video = findVideo(html);
  const date = (post.date ?? '').slice(0, 10);

  if (video) {
    return { date, title, explanation, media_type: 'video', url: video, credit, link: post.link };
  }
  if (!shown) return null;
  return { date, title, explanation, media_type: 'image', url: shown, hdurl: full, alt: media?.alt_text, credit, link: post.link };
};

/** The newest APOD. Throws an Error with a message fit to show. */
export const fetchApod = async (timeoutMs = TIMEOUT_MS): Promise<ApodData> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(POSTS, { signal: controller.signal });
  } catch {
    throw new Error("Couldn't reach NASA Science. Check the connection and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new Error('NASA Science is getting too many requests. Try again in a minute.');
  if (!res.ok) throw new Error(`NASA Science is having trouble right now (${res.status}). Try again later.`);
  const posts = (await res.json()) as WpPost[];
  const apod = Array.isArray(posts) && posts[0] ? readApodPost(posts[0]) : null;
  if (!apod) throw new Error("Today's picture isn't up on NASA Science yet. Try again later.");
  return apod;
};
