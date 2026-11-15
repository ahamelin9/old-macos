import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_APOD,
  PER_PAGE,
  apodDateUrl,
  apodPageUrl,
  fetchApodDate,
  fetchApodDay,
  fetchApodPage,
  fetchedApodDay,
  mergeDays,
  readApodDay,
  readTotalPages,
  shiftDate,
  smallThumb,
  todayInEastern,
  type ApodDay
} from './apodDays';

// Shaped like science.nasa.gov's list replies (2026-11-15): page 1, page 2 and
// the last page, trimmed to the fields the list asks for
const ASSETS = 'https://assets.science.nasa.gov';
const rendition = (file: string, size: string) => `${ASSETS}/content/dam/science/cds/apod/apod/${file}/jcr:content/renditions/cq5dam.thumbnail.${size}.png`;
const STAND_IN = `${ASSETS}/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png`;

const listPost = (id: number, date: string, title: string, sizes?: Record<string, { source_url: string; width: number; height: number }>, source_url?: string) => ({
  id,
  date: `${date}T00:05:00`,
  link: `https://science.nasa.gov/image-article/apod-${date}/`,
  title: { rendered: title },
  _links: { self: [{ href: `https://science.nasa.gov/wp-json/wp/v2/image-article/${id}` }] },
  _embedded: sizes || source_url ? { 'wp:featuredmedia': [{ id: id + 1, source_url, media_details: { sizes } }] } : undefined
});

const leonids = listPost(1511419, '2026-11-15', 'APOD: 2026 November 15 &#8211; Leonid Meteors Through Orion', {
  'thumbnail-sm': { source_url: rendition('2026/november/Leonids2022_Hongyang_2880.jpg', '140.100'), width: 80, height: 100 },
  thumbnail: { source_url: rendition('2026/november/Leonids2022_Hongyang_2880.jpg', '319.319'), width: 255, height: 319 }
});
const jupiter = listPost(1481216, '2026-10-12', 'APOD: 2026 October 12 &#8211; Jupiter and the Moons', {
  'thumbnail-sm': {
    source_url: `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/october/JupiterMoons_Upreti_3105.jpg?w=0&h=0&fit=clip&crop=faces%2Cfocalpoint`,
    width: 140,
    height: 100
  }
});
const venus = listPost(1505211, '2026-10-29', 'APOD: 29 October 2026 &#8211; The Horns of Venus', {
  thumbnail: { source_url: rendition('2026/october/venus.jpg', '319.319'), width: 319, height: 319 }
});
const pleiades = listPost(1251725, '1995-06-20', 'APOD: 1995 June 20 &#8211; Pleiades Star Cluster', {
  'thumbnail-sm': { source_url: `${STAND_IN}?w=50&h=50`, width: 50, height: 50 }
}, STAND_IN);
const noMedia = listPost(1490000, '2026-10-01', 'APOD: 2026 October 1 &#8211; A Video Day');

const days = (n: number, from: number): ApodDay[] =>
  Array.from({ length: n }, (_, i) => ({ id: from - i, date: '2026-01-01', title: `Day ${from - i}` }));

const listReply = (posts: unknown[], totalPages: string | null, total = '11469') =>
  new Response(JSON.stringify(posts), {
    headers: totalPages === null ? {} : { 'X-WP-Total': total, 'X-WP-TotalPages': totalPages }
  });

describe('readApodDay', () => {
  it('reads a row: id, date, a clean title and the small thumbnail', () => {
    expect(readApodDay(leonids)).toEqual({
      id: 1511419,
      date: '2026-11-15',
      title: 'Leonid Meteors Through Orion',
      thumb: rendition('2026/november/Leonids2022_Hongyang_2880.jpg', '140.100'),
      link: 'https://science.nasa.gov/image-article/apod-2026-11-15/'
    });
  });

  it('falls back to the bigger thumbnail', () => {
    expect(readApodDay(venus)).toMatchObject({ title: 'The Horns of Venus', thumb: rendition('2026/october/venus.jpg', '319.319') });
  });

  it("asks NASA's image server for a small picture, not the whole one", () => {
    expect(readApodDay(jupiter)?.thumb).toBe(
      `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/october/JupiterMoons_Upreti_3105.jpg?w=140&h=100&fit=clip&crop=faces%2Cfocalpoint`
    );
    // Other sizes, and other servers, are left alone
    expect(smallThumb(`${STAND_IN}?w=50&h=50`)).toBe(`${STAND_IN}?w=50&h=50`);
    expect(smallThumb('https://example.com/x.jpg?w=0&h=0')).toBe('https://example.com/x.jpg?w=0&h=0');
  });

  it('asks the image server for a thumbnail when the picture lists no sizes', () => {
    // As on 2025-10-15: a 700 KB photo with sizes {}
    const tucson = listPost(1400000, '2025-10-15', 'APOD: 2025 October 15 &#8211; Rocket Launch Plume over Tucson', {},
      `${ASSETS}/content/dam/science/cds/apod/apod/2025/october/TucsonPlume_Showalter_4032.jpg`);
    expect(readApodDay(tucson)?.thumb).toBe(
      `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2025/october/TucsonPlume_Showalter_4032.jpg?w=140&h=100&fit=clip`
    );
    // Only for pictures on NASA's asset server
    const video = listPost(1400001, '2025-10-16', 'A Video', {}, `${ASSETS}/content/dam/science/cds/apod/apod/2025/october/clip.mp4`);
    expect(readApodDay(video)?.thumb).toBeUndefined();
  });

  it("gives no thumbnail for NASA's stand-in picture, or a day with no picture", () => {
    expect(readApodDay(pleiades)).toMatchObject({ date: '1995-06-20', title: 'Pleiades Star Cluster', thumb: undefined });
    expect(readApodDay(noMedia)).toMatchObject({ title: 'A Video Day', thumb: undefined });
  });

  it('skips something that is not a post', () => {
    expect(readApodDay({ date: '2026-11-15T00:05:00' })).toBeNull();
    expect(readApodDay({ id: 1 })).toBeNull();
  });
});

describe('paging', () => {
  it('reads the number of pages from X-WP-TotalPages', () => {
    expect(readTotalPages('574', 1, PER_PAGE)).toBe(574);
    expect(readTotalPages('0', 1, 0)).toBe(0);
  });

  it('without the header, expects another page only while pages come back full', () => {
    expect(readTotalPages(null, 3, PER_PAGE)).toBe(4);
    expect(readTotalPages(null, 574, 9)).toBe(574);
    expect(readTotalPages('junk', 2, 5)).toBe(2);
  });

  it('keeps one of each day when a new day shifts the pages', () => {
    const page1 = days(20, 100); // 100…81
    const page2 = days(20, 81); // 81…62: 81 again, because a new day pushed it down
    const merged = mergeDays(page1, page2);
    expect(merged).toHaveLength(39);
    expect(new Set(merged.map(d => d.id)).size).toBe(39);
    expect(merged.map(d => d.id).slice(18, 21)).toEqual([82, 81, 80]);
  });
});

describe('fetchApodPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for 20 days of the APOD category, with the thumbnails embedded', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(listReply([leonids, jupiter], '574')));
    const result = await fetchApodPage(2);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://science.nasa.gov/wp-json/wp/v2/image-article');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      categories: '22766',
      per_page: '20',
      page: '2',
      _embed: 'wp:featuredmedia',
      _fields: 'id,date,title,link,_links,_embedded'
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(apodPageUrl(2));
    expect(result).toMatchObject({ page: 2, totalPages: 574 });
    expect(result.days.map(d => d.title)).toEqual(['Leonid Meteors Through Orion', 'Jupiter and the Moons']);
  });

  it('pages through to the end and stops where the header says', async () => {
    // Three pages: 20, 20, then the last 9, as the real list ends in 1995
    const pages = [days(20, 1000), days(20, 980), days(9, 960)].map(page =>
      page.map(d => listPost(d.id, '2026-01-01', `APOD: 2026 January 1 &#8211; ${d.title}`, undefined, undefined))
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(url =>
      Promise.resolve(listReply(pages[Number(new URL(String(url)).searchParams.get('page')) - 1], '3'))
    );
    let shown: ApodDay[] = [];
    let loaded = 0;
    let total: number | null = null;
    while (total === null || loaded < total) {
      const result = await fetchApodPage(loaded + 1);
      shown = mergeDays(shown, result.days);
      loaded = result.page;
      total = result.totalPages;
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(shown).toHaveLength(49);
    expect(shown[48].title).toBe('Day 952');
  });

  it("says so when NASA can't be reached, is busy, or answers something else", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(fetchApodPage(1)).rejects.toThrow("Couldn't reach NASA Science. Check the connection and try again.");
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 429 })));
    await expect(fetchApodPage(1)).rejects.toThrow(/too many requests/);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{"code":"rest_no_route"}')));
    await expect(fetchApodPage(1)).rejects.toThrow(/can't read/);
  });

  it('gives up after the time limit, with a message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(fetchApodPage(1, "", 20)).rejects.toThrow(/Couldn't reach NASA Science/);
  });
});

describe('fetchApodDay', () => {
  afterEach(() => vi.restoreAllMocks());

  // A whole post, shaped like science.nasa.gov's (2026-10-28, a video day)
  const occultation = {
    date: '2026-10-28T00:05:00',
    link: 'https://science.nasa.gov/image-article/apod-2026-october-28/',
    title: { rendered: 'APOD: 2026 October 28 &#8211; The Mutual Occultation of Ganymede and Io' },
    content: {
      rendered:
        '<video class="video-js"><source src="https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/2026/october/occultation.mp4" type="video/mp4"></video>' +
        '<p><strong>Explanation:</strong> Ganymede passes in front of Io. <a href="#">Tomorrow&#8217;s picture</a>: horns</p>' +
        '<p>Date: October 28, 2026</p><p>Video Credit &amp; Copyright: Test</p><p>Authors &amp; editors: Test</p>'
    }
  };

  it('fetches a day once, and keeps it for the visit', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify(occultation))));
    expect(fetchedApodDay(1503917)).toBeUndefined();
    // Two picks before the first reply: one request
    const [a, b] = await Promise.all([fetchApodDay(1503917), fetchApodDay(1503917)]);
    expect(a).toBe(b);
    expect(a).toMatchObject({ date: '2026-10-28', title: 'The Mutual Occultation of Ganymede and Io', media_type: 'video' });
    await fetchApodDay(1503917);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://science.nasa.gov/wp-json/wp/v2/image-article/1503917?_embed=wp:featuredmedia&_fields=date,link,title,content,_links,_embedded'
    );
    expect(fetchedApodDay(1503917)).toBe(a);
  });

  it("doesn't keep a failure, so picking the day again tries again", async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.resolve(new Response('{}', { status: 502 })))
      .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify(occultation))));
    await expect(fetchApodDay(1)).rejects.toThrow(/having trouble right now \(502\)/);
    await expect(fetchApodDay(1)).resolves.toMatchObject({ media_type: 'video' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('says when NASA no longer has the day, or it has nothing to show', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{"code":"rest_post_invalid_id"}', { status: 404 })));
    await expect(fetchApodDay(2)).rejects.toThrow("NASA Science doesn't have that day any more.");
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ...occultation, content: { rendered: '<p>Explanation: words</p>' } }))));
    await expect(fetchApodDay(3)).rejects.toThrow("NASA News can't show this day's picture.");
  });
});

describe('search', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds the words, title matches first, to the same list request', () => {
    const url = new URL(apodPageUrl(2, '  saturn rings '));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      categories: '22766',
      per_page: '20',
      page: '2',
      search: 'saturn rings',
      orderby: 'relevance',
      _embed: 'wp:featuredmedia',
      _fields: 'id,date,title,link,_links,_embedded'
    });
    // Words that mean something in a URL are sent as words
    expect(new URL(apodPageUrl(1, 'M&M #1?')).searchParams.get('search')).toBe('M&M #1?');
    // No words: the plain list, newest first
    expect(apodPageUrl(1, '   ')).toBe(apodPageUrl(1));
    expect(apodPageUrl(1)).not.toMatch(/search=|orderby=/);
  });

  it('reads how many days match from X-WP-Total', async () => {
    // As for "rocket" on 2026-11-15: 301 days, 16 pages
    const reply = new Response(JSON.stringify([leonids]), { headers: { 'X-WP-Total': '301', 'X-WP-TotalPages': '16' } });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(reply));
    await expect(fetchApodPage(1, 'rocket')).resolves.toMatchObject({ total: 301, totalPages: 16, page: 1 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('&search=rocket&orderby=relevance');
  });

  it('reads no matches as an empty, finished list', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(listReply([], '0', '0')));
    await expect(fetchApodPage(1, 'zzzxq')).resolves.toEqual({ days: [], page: 1, totalPages: 0, total: 0 });
  });
});

describe('dates', () => {
  afterEach(() => vi.restoreAllMocks());

  it('steps across months, years and leap days', () => {
    expect(shiftDate('1995-06-16', -1)).toBe('1995-06-15');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('asks for the one post between the end of the day before and the start of the day after', () => {
    const url = new URL(apodDateUrl(FIRST_APOD));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      categories: '22766',
      per_page: '1',
      after: '1995-06-15T23:59:59',
      before: '1995-06-17T00:00:00',
      _embed: 'wp:featuredmedia',
      _fields: 'date,link,title,content,_links,_embedded'
    });
    expect(apodDateUrl('2026-11-15')).toContain('&after=2026-11-14T23:59:59&before=2026-11-16T00:00:00&');
  });

  it("knows today's date in US Eastern time, where a new day starts", () => {
    // 03:00 UTC on 16 November is still 15 November in New York
    expect(todayInEastern(new Date('2026-11-16T03:00:00Z'))).toBe('2026-11-15');
    expect(todayInEastern(new Date('2026-11-16T05:30:00Z'))).toBe('2026-11-16');
  });

  // Shaped like science.nasa.gov's reply for 1995-06-20
  const pleiades = {
    date: '1995-06-20T00:00:00',
    link: 'https://science.nasa.gov/image-article/apod-1995-june-20-pleiades-star-cluster/',
    title: { rendered: 'APOD: 1995 June 20 &#8211; Pleiades Star Cluster' },
    content: {
      rendered:
        '<figure><a href="https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/1995/june/pleiades2.gif">' +
        '<img src="https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/1995/june/pleiades2.gif" alt="See Explanation."></a></figure>' +
        '<p>Explanation: The Pleiades star cluster, M45, is one of the brightest star clusters. Date June 20, 1995</p>' +
        '<p>Credit Mount Wilson Observatory</p><p>Authors &amp; editors: Robert Nemiroff</p>'
    },
    _embedded: { 'wp:featuredmedia': [{ source_url: STAND_IN }] }
  };

  it('shows the day picked, with its own picture', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify([pleiades]))));
    await expect(fetchApodDate('1995-06-20')).resolves.toMatchObject({
      date: '1995-06-20',
      title: 'Pleiades Star Cluster',
      url: 'https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/1995/june/pleiades2.gif',
      credit: 'Credit: Mount Wilson Observatory'
    });
    // Picked again: from this visit's cache
    await fetchApodDate('1995-06-20');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks for the first day and for today', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(url => {
      const date = new URL(String(url)).searchParams.get('before')!;
      return Promise.resolve(new Response(JSON.stringify([{ ...pleiades, date: `${shiftDate(date.slice(0, 10), -1)}T00:05:00` }])));
    });
    await expect(fetchApodDate(FIRST_APOD)).resolves.toMatchObject({ date: FIRST_APOD });
    const today = todayInEastern();
    await expect(fetchApodDate(today)).resolves.toMatchObject({ date: today });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('says "No picture on" a day with no post, rather than showing a neighbour', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(listReply([], '0')));
    await expect(fetchApodDate('1995-06-18')).rejects.toThrow('No picture on 1995-06-18.');
    // Even if the server ignored the dates and sent another day
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify([pleiades]))));
    await expect(fetchApodDate('1995-06-19')).rejects.toThrow('No picture on 1995-06-19.');
  });

  it("doesn't ask NASA for a date before the first picture, after today, or half typed", async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(fetchApodDate('1995-06-15')).rejects.toThrow(`The first picture of the day was on ${FIRST_APOD}.`);
    await expect(fetchApodDate(shiftDate(todayInEastern(), 1))).rejects.toThrow(/no picture for .* yet/);
    await expect(fetchApodDate('0199-06-20')).rejects.toThrow(/first picture/);
    await expect(fetchApodDate('2026-11')).rejects.toThrow(/whole date/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
