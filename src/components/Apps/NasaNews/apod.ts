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

export const APOD_CATEGORY = 22766;
export const IMAGE_ARTICLES = 'https://science.nasa.gov/wp-json/wp/v2/image-article';
const POSTS =
  `${IMAGE_ARTICLES}?categories=${APOD_CATEGORY}&per_page=1&_embed=wp:featuredmedia` +
  '&_fields=date,link,title,content,_links,_embedded';
export const TIMEOUT_MS = 10_000;

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
    .replace(/\(\s+/g, '(')
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

/**
 * The day's picture from inside the post, for days whose featured image is
 * NASA's stand-in: the first <img> in the APOD folder on assets.science.nasa.gov,
 * and the full-size file its link opens, if it has one.
 */
const findContentImage = (html: string): { url: string; full?: string; alt?: string } | undefined => {
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], 'src');
    if (!src || !/^https:\/\/assets\.science\.nasa\.gov\/.*\/apod\//i.test(src)) continue;
    const link = html.slice(0, m.index).match(/<a\b[^>]*>\s*$/i);
    const href = link ? attr(link[0], 'href') : undefined;
    const full = href && /^https:\/\/assets\.science\.nasa\.gov\/.+\.(jpe?g|png|gif|tiff?)$/i.test(href) ? href : undefined;
    // The old pages' alt text is "See Explanation. Clicking on the picture will…"
    const alt = attr(m[0], 'alt');
    return { url: src, full, alt: alt && !/^See Explanation/i.test(alt) ? alt : undefined };
  }
  return undefined;
};

export interface WpMedia {
  source_url?: string;
  alt_text?: string;
  media_details?: { sizes?: Record<string, { source_url?: string; width?: number }> };
}

export interface WpPost {
  id?: number;
  date?: string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: { 'wp:featuredmedia'?: WpMedia[] };
}

/**
 * NASA's generic "news" picture, which science.nasa.gov gives as the featured
 * image of many older days (GIFs, videos, the 1995 pages). It is not the day's
 * picture, so never show it as one.
 */
export const isStandInImage = (media?: WpMedia) => /\/news-thumbnail\.png(?:\?|$)/i.test(media?.source_url ?? '');

/** "APOD: 2026 November 15 &#8211; Leonid Meteors" (or "15 November 2026") as "Leonid Meteors" */
export const cleanTitle = (rendered = '') =>
  decodeEntities(rendered)
    .replace(/^APOD:\s*(?:\d{4}\s+[A-Za-z]+\s+\d{1,2}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*[–—-]\s*/, '')
    .trim();

/** One APOD post as what NASA News shows; null if it has no picture or video */
export const readApodPost = (post: WpPost): ApodData | null => {
  const html = post.content?.rendered ?? '';
  const text = htmlToText(html);
  const title = cleanTitle(post.title?.rendered);

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
  // Many pages put a bare "Credit" label before NASA's own credit line:
  // "Credit Video Credit & Copyright: Ken Murphy" reads as just the line
  const creditValue = creditMatch?.[2].replace(/^:\s*/, '');
  const credit = !creditMatch
    ? undefined
    : /^(?:(?:Image|Video|Illustration) )?Credit(?: (?:&|and) (?:Copyright|License))?:/.test(creditValue ?? '')
      ? creditValue
      : `${creditMatch[1]}: ${creditValue}`;

  const date = (post.date ?? '').slice(0, 10);
  const video = findVideo(html);
  if (video) {
    return { date, title, explanation, media_type: 'video', url: video, credit, link: post.link };
  }

  const media = post._embedded?.['wp:featuredmedia']?.[0];
  if (media && !isStandInImage(media)) {
    const full = media.source_url;
    const shown = media.media_details?.sizes?.large?.source_url ?? full;
    if (shown) {
      const alt = media.alt_text ? decodeEntities(media.alt_text) : undefined;
      return { date, title, explanation, media_type: 'image', url: shown, hdurl: full, alt, credit, link: post.link };
    }
  }

  const inPost = findContentImage(html);
  if (!inPost) return null;
  return { date, title, explanation, media_type: 'image', url: inPost.url, hdurl: inPost.full, alt: inPost.alt, credit, link: post.link };
};

/**
 * GET a science.nasa.gov URL as JSON, giving up after the time limit. Throws
 * an Error with a message fit to show; notFound words a 404.
 */
export const getNasaJson = async (url: string, timeoutMs = TIMEOUT_MS, notFound?: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const unreachable = () => new Error("Couldn't reach NASA Science. Check the connection and try again.");
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch {
      throw unreachable();
    }
    if (res.status === 404 && notFound) throw new Error(notFound);
    if (res.status === 429) throw new Error('NASA Science is getting too many requests. Try again in a minute.');
    if (!res.ok) throw new Error(`NASA Science is having trouble right now (${res.status}). Try again later.`);
    try {
      return { body: (await res.json()) as unknown, res };
    } catch (err) {
      // The time limit can also run out while the reply is still arriving
      throw err instanceof SyntaxError
        ? new Error("NASA Science sent something NASA News can't read. Try again later.")
        : unreachable();
    }
  } finally {
    clearTimeout(timer);
  }
};

/** The newest APOD. Throws an Error with a message fit to show. */
export const fetchApod = async (timeoutMs = TIMEOUT_MS): Promise<ApodData> => {
  const { body: posts } = await getNasaJson(POSTS, timeoutMs);
  const apod = Array.isArray(posts) && posts[0] ? readApodPost(posts[0] as WpPost) : null;
  if (!apod) throw new Error("Today's picture isn't up on NASA Science yet. Try again later.");
  return apod;
};
