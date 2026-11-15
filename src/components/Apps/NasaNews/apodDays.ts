/**
 * Past days of the Astronomy Picture of the Day, for NASA News's sidebar.
 *
 * The list comes 20 days a page from science.nasa.gov's WordPress API, newest
 * first, with only what a row needs (no post text). A day's full post is
 * fetched when its row is picked, and kept for the rest of the visit. The
 * `apis` skill, nasa.md, has the details.
 */
import {
  APOD_CATEGORY,
  IMAGE_ARTICLES,
  TIMEOUT_MS,
  cleanTitle,
  getNasaJson,
  isStandInImage,
  readApodPost,
  type ApodData,
  type WpPost
} from './apod';

/** One row in the sidebar */
export interface ApodDay {
  /** The post's id on science.nasa.gov, for fetching the whole day */
  id: number;
  /** 2026-11-14 */
  date: string;
  title: string;
  /** A small picture (about 140×100), or none for days without one */
  thumb?: string;
  /** The day's page on science.nasa.gov */
  link?: string;
}

export const PER_PAGE = 20;

/** The first Astronomy Picture of the Day */
export const FIRST_APOD = '1995-06-16';

// _fields must keep _links and _embedded, or WordPress drops the picture
const ROW_FIELDS = '&_embed=wp:featuredmedia&_fields=id,date,title,link,_links,_embedded';
const POST_FIELDS = '_embed=wp:featuredmedia&_fields=date,link,title,content,_links,_embedded';

/**
 * A page of days, newest first; or, with words to search for, a page of the
 * days whose title or explanation has them, those with the words in the
 * title first (orderby=relevance). The server can't search titles alone.
 */
export const apodPageUrl = (page: number, search = '') =>
  `${IMAGE_ARTICLES}?categories=${APOD_CATEGORY}&per_page=${PER_PAGE}&page=${page}` +
  (search.trim() ? `&search=${encodeURIComponent(search.trim())}&orderby=relevance` : '') +
  ROW_FIELDS;

export const apodDayUrl = (id: number) => `${IMAGE_ARTICLES}/${id}?${POST_FIELDS}`;

/** 2026-11-15 and a number of days as another date, across months and years */
export const shiftDate = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** The post for one date: anything after the last second of the day before, and before the day after */
export const apodDateUrl = (date: string) =>
  `${IMAGE_ARTICLES}?categories=${APOD_CATEGORY}&per_page=1` +
  `&after=${shiftDate(date, -1)}T23:59:59&before=${shiftDate(date, 1)}T00:00:00&${POST_FIELDS}`;

/** Today's date where APOD is made (US Eastern time), when a new day appears */
export const todayInEastern = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

/**
 * NASA's image server sizes "dynamicimage" pictures from w and h, and some
 * thumbnails ask for w=0&h=0, which is the whole picture (150 KB and more).
 * Ask for the thumbnail size instead (about 3 KB).
 */
export const smallThumb = (url: string) =>
  /^https:\/\/assets\.science\.nasa\.gov\/dynamicimage\//.test(url)
    ? url.replace(/([?&])w=0&h=0(?=&|$)/, '$1w=140&h=100')
    : url;

/**
 * Some pictures list no sizes at all (2025-10-15's sizes are {}). NASA's
 * image server keeps every file in content/dam under dynamicimage/assets too,
 * and sizes it from w and h: ask it for a thumbnail rather than the whole file.
 */
const thumbFromFull = (url?: string) => {
  const m = url?.match(/^https:\/\/assets\.science\.nasa\.gov\/content\/dam\/([^?#]+\.(?:jpe?g|png|gif))$/i);
  return m ? `https://assets.science.nasa.gov/dynamicimage/assets/${m[1]}?w=140&h=100&fit=clip` : undefined;
};

/** One post from the list as a sidebar row; null if it isn't a usable post */
export const readApodDay = (post: WpPost): ApodDay | null => {
  if (typeof post.id !== 'number' || !post.date) return null;
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const sizes = media?.media_details?.sizes;
  const thumb = isStandInImage(media)
    ? undefined
    : sizes?.['thumbnail-sm']?.source_url ?? sizes?.thumbnail?.source_url ?? thumbFromFull(media?.source_url);
  return {
    id: post.id,
    date: post.date.slice(0, 10),
    title: cleanTitle(post.title?.rendered) || 'Untitled',
    thumb: thumb ? smallThumb(thumb) : undefined,
    link: post.link
  };
};

/**
 * How many pages there are, from the X-WP-TotalPages header. Without it (a
 * proxy can drop headers), assume there's another page while pages come back full.
 */
export const readTotalPages = (header: string | null, page: number, count: number) => {
  const total = Number.parseInt(header ?? '', 10);
  if (Number.isFinite(total) && total >= 0) return total;
  return count < PER_PAGE ? page : page + 1;
};

/**
 * Add a page to the days already shown. A new day published between two pages
 * shifts every page by one, so the next page can repeat a day: keep one of each.
 */
export const mergeDays = (have: ApodDay[], more: ApodDay[]) => {
  const seen = new Set(have.map(d => d.id));
  return [...have, ...more.filter(d => !seen.has(d.id))];
};

export interface ApodPage {
  days: ApodDay[];
  page: number;
  totalPages: number;
  /** How many days there are in all (X-WP-Total), if NASA said */
  total: number | null;
}

/** One page of past days, or of a search's results. Throws an Error with a message fit to show. */
export const fetchApodPage = async (page: number, search = '', timeoutMs = TIMEOUT_MS): Promise<ApodPage> => {
  const { body, res } = await getNasaJson(apodPageUrl(page, search), timeoutMs);
  if (!Array.isArray(body)) throw new Error("NASA Science sent something NASA News can't read. Try again later.");
  const days = (body as WpPost[]).map(readApodDay).filter((d): d is ApodDay => d !== null);
  const total = Number.parseInt(res.headers.get('X-WP-Total') ?? '', 10);
  return {
    days,
    page,
    totalPages: readTotalPages(res.headers.get('X-WP-TotalPages'), page, body.length),
    total: Number.isFinite(total) ? total : null
  };
};

// Days already fetched this visit, and the ones on their way
const fetched = new Map<number, ApodData>();
const fetching = new Map<number, Promise<ApodData>>();

/** A day fetched earlier this visit, if any */
export const fetchedApodDay = (id: number) => fetched.get(id);

/** One day's whole post, from this visit's cache if it's there. Throws an Error with a message fit to show. */
export const fetchApodDay = (id: number, timeoutMs = TIMEOUT_MS): Promise<ApodData> => {
  const have = fetched.get(id);
  if (have) return Promise.resolve(have);
  const pending = fetching.get(id);
  if (pending) return pending;
  const load = (async () => {
    try {
      const { body } = await getNasaJson(apodDayUrl(id), timeoutMs, "NASA Science doesn't have that day any more.");
      const apod = body && typeof body === 'object' ? readApodPost(body as WpPost) : null;
      if (!apod) throw new Error("NASA News can't show this day's picture.");
      fetched.set(id, apod);
      return apod;
    } finally {
      fetching.delete(id);
    }
  })();
  fetching.set(id, load);
  return load;
};

// Dates looked up this visit: the day, or null for a date with no picture
const byDate = new Map<string, ApodData | null>();

/**
 * The picture for a date (2026-11-15), from this visit's cache if it's there.
 * APOD skipped days in its early years; a date with no post says so rather
 * than showing a neighbour. Throws an Error with a message fit to show.
 */
export const fetchApodDate = async (date: string, timeoutMs = TIMEOUT_MS): Promise<ApodData> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a whole date: year, month and day.');
  if (date < FIRST_APOD) throw new Error(`The first picture of the day was on ${FIRST_APOD}.`);
  if (date > todayInEastern()) throw new Error(`There's no picture for ${date} yet.`);
  if (!byDate.has(date)) {
    const { body } = await getNasaJson(apodDateUrl(date), timeoutMs);
    if (!Array.isArray(body)) throw new Error("NASA Science sent something NASA News can't read. Try again later.");
    const post = body[0] as WpPost | undefined;
    if (post && (post.date ?? '').slice(0, 10) !== date) throw new Error(`No picture on ${date}.`);
    const apod = post ? readApodPost(post) : null;
    if (post && !apod) throw new Error("NASA News can't show this day's picture.");
    byDate.set(date, apod);
  }
  const apod = byDate.get(date);
  if (!apod) throw new Error(`No picture on ${date}.`);
  return apod;
};
