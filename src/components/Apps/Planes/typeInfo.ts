/**
 * What an aircraft type's page shows about it: the opening of its Wikipedia
 * article and a bigger picture (one Wikipedia call), and its dates and sizes
 * from Wikidata (one more). Asked when a card of Spotter's Picks is opened,
 * and kept for the visit. Nothing here is written by hand, so nothing can
 * drift from its source; the page says where each part comes from. The
 * `apis` skill, adsb.md.
 */
import type { PickImage } from './picks';

export interface TypeInfo {
  /** The opening of the article, as paragraphs */
  story: string[];
  image: PickImage | null;
  /** A label and its value, in the order shown */
  facts: [string, string][];
}

interface WikiPage {
  title?: string;
  extract?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
  pageprops?: { wikibase_item?: string };
}

/** About this much of the article's opening is shown: whole sentences, never cut mid-way */
const STORY_LENGTH = 700;

/** The opening of an article, cut to about STORY_LENGTH at the end of a sentence */
export const trimStory = (text: string, limit = STORY_LENGTH): string[] => {
  const story: string[] = [];
  let used = 0;
  for (const paragraph of text.split('\n').map(p => p.trim()).filter(Boolean)) {
    if (used >= limit) break;
    if (used + paragraph.length <= limit || !story.length && paragraph.length <= limit) {
      story.push(paragraph);
      used += paragraph.length;
      continue;
    }
    // Whole sentences of this paragraph, as many as fit (a full stop, then a space and a capital)
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/);
    let kept = '';
    for (const sentence of sentences) {
      if (used + kept.length + sentence.length > limit && (kept || story.length)) break;
      kept += (kept ? ' ' : '') + sentence;
    }
    if (kept) story.push(kept);
    break;
  }
  return story;
};

/** Wikipedia's reply for one article: its story, its picture and its Wikidata id */
export const toArticle = (data: unknown): { story: string[]; image: PickImage | null; item: string | null } => {
  const pages = ((data ?? {}) as { query?: { pages?: Record<string, WikiPage> } }).query?.pages ?? {};
  const page = Object.values(pages)[0];
  const t = page?.thumbnail;
  return {
    story: trimStory(page?.extract ?? ''),
    image: t?.source?.startsWith('https://') ? { src: t.source, width: t.width ?? 500, height: t.height ?? 333 } : null,
    item: page?.pageprops?.wikibase_item ?? null,
  };
};

interface Claim {
  mainsnak?: { datavalue?: { value?: { time?: string; precision?: number; amount?: string; unit?: string } } };
  rank?: string;
}

const METRE = 'Q11573';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A Wikidata date as words: the day when it is known to the day, else the month, else the year */
const dateText = (claim: Claim | undefined): string | null => {
  const value = claim?.mainsnak?.datavalue?.value;
  const match = value?.time?.match(/^\+(\d{4})-(\d{2})-(\d{2})/);
  if (!match || value?.precision === undefined || value.precision < 9) return null;
  const [, year, month, day] = match;
  if (value.precision >= 11 && +month && +day) return `${MONTHS[+month - 1]} ${+day}, ${year}`;
  if (value.precision === 10 && +month) return `${MONTHS[+month - 1]} ${year}`;
  return year;
};

/** A Wikidata length in metres as feet first (US units, as the rest of the app), then metres */
const lengthText = (claim: Claim | undefined): string | null => {
  const value = claim?.mainsnak?.datavalue?.value;
  const metres = Number(value?.amount);
  if (!value?.unit?.endsWith(`/${METRE}`) || !Number.isFinite(metres) || metres <= 0) return null;
  return `${Math.round(metres * 3.28084).toLocaleString('en-US')} ft (${metres.toLocaleString('en-US', { maximumFractionDigits: 1 })} m)`;
};

/** The statement Wikidata prefers, else the first that isn't deprecated */
const best = (claims: Claim[] | undefined): Claim | undefined =>
  claims?.find(c => c.rank === 'preferred') ?? claims?.find(c => c.rank !== 'deprecated');

/**
 * The dates and sizes Wikidata holds for an aircraft. Only facts that don't
 * change: its count of how many were built is left out, as it was 45 short
 * for the 747-8 on 2026-11-16.
 */
export const toFacts = (data: unknown, item: string): [string, string][] => {
  const claims = ((data ?? {}) as { entities?: Record<string, { claims?: Record<string, Claim[]> }> }).entities?.[item]?.claims ?? {};
  const rows: [string, string | null][] = [
    ['First flight', dateText(best(claims.P606))],
    ['Entered service', dateText(best(claims.P729))],
    ['Retired', dateText(best(claims.P730))],
    ['Wingspan', lengthText(best(claims.P2050))],
    ['Length', lengthText(best(claims.P2043))],
    ['Height', lengthText(best(claims.P2048))],
  ];
  return rows.filter((row): row is [string, string] => row[1] !== null);
};

const known = new Map<string, TypeInfo>();

const getJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
};

/** Everything the page shows about a type, by its Wikipedia article. Throws when Wikipedia can't be reached; no facts is not a failure. */
export const fetchTypeInfo = async (wiki: string): Promise<TypeInfo> => {
  const had = known.get(wiki);
  if (had) return had;
  const article = toArticle(await getJson(
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts%7Cpageimages%7Cpageprops'
    + `&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=500&ppprop=wikibase_item&titles=${encodeURIComponent(wiki)}`));
  let facts: [string, string][] = [];
  if (article.item) {
    try {
      facts = toFacts(await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=${article.item}`), article.item);
    } catch {
      // Wikidata is down: the page is whole without its table
    }
  }
  const info = { story: article.story, image: article.image, facts };
  known.set(wiki, info);
  return info;
};
