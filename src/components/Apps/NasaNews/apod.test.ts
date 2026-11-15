import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanTitle, decodeEntities, fetchApod, htmlToText, readApodPost } from './apod';

// Shaped like science.nasa.gov's real APOD posts (2026-11-15, 2026-10-28, 2026-10-18)
const page = (media: string, credit = '<strong>Credit &amp; Copyright:</strong> <a href="#">Luo Hongyang</a>') => `
  <div class="nav">Today&#8217;s APOD Archive Submissions</div>
  ${media}
  <p><strong>Explanation:</strong> Where will the next <a href="#">meteor</a> appear? The view is from
  <a href="#">Hainan</a>, China. <a href="#">Tomorrow&#8217;s picture</a>: open space</p>
  <p><strong>Date:</strong> November 15, 2026</p>
  <p>${credit}</p>
  <p>Authors &amp; editors: Robert Nemiroff, Jerry Bonnell</p>
  <p>Yesterday's Image APOD: 2026 November 14 &#8211; Apollo 12</p>`;

const imagePost = {
  date: '2026-11-15T00:05:00',
  link: 'https://science.nasa.gov/image-article/apod-2026-november-15-leonid-meteors-through-orion/',
  title: { rendered: 'APOD: 2026 November 15 &#8211; Leonid Meteors Through Orion' },
  content: { rendered: page('<figure><img src="https://assets.science.nasa.gov/x.jpg"></figure>') },
  _embedded: {
    'wp:featuredmedia': [
      {
        source_url: 'https://assets.science.nasa.gov/full.jpg',
        alt_text: 'Meteors over Orion',
        media_details: { sizes: { large: { source_url: 'https://assets.science.nasa.gov/large.jpg' } } }
      }
    ]
  }
};

describe('decodeEntities and htmlToText', () => {
  it('decodes the entities WordPress writes', () => {
    expect(decodeEntities('Today&#8217;s &amp; &#x2019; &hellip;')).toBe('Today’s & ’ …');
  });
  it("doesn't leave a space before punctuation where a link ended", () => {
    expect(htmlToText('from <a href="#">Hainan</a>, China.<br>Next')).toBe('from Hainan, China. Next');
  });
});

describe('readApodPost', () => {
  it('reads a picture day', () => {
    expect(readApodPost(imagePost)).toEqual({
      date: '2026-11-15',
      title: 'Leonid Meteors Through Orion',
      explanation: 'Where will the next meteor appear? The view is from Hainan, China.',
      media_type: 'image',
      url: 'https://assets.science.nasa.gov/large.jpg',
      hdurl: 'https://assets.science.nasa.gov/full.jpg',
      alt: 'Meteors over Orion',
      credit: 'Credit & Copyright: Luo Hongyang',
      link: imagePost.link
    });
  });

  it("reads a day with NASA's own video", () => {
    const post = {
      ...imagePost,
      content: { rendered: page('<video class="video-js"><source src="https://assets.science.nasa.gov/content/dam/occultation.mp4" type="video/mp4"></video>') }
    };
    expect(readApodPost(post)).toMatchObject({ media_type: 'video', url: 'https://assets.science.nasa.gov/content/dam/occultation.mp4' });
  });

  it('reads a YouTube day, and ignores embeds from anywhere else', () => {
    const youtube = { ...imagePost, content: { rendered: page('<iframe src="https://www.youtube.com/embed/DzrCEm1ZBRY?feature=oembed&amp;x=1"></iframe>') } };
    expect(readApodPost(youtube)).toMatchObject({ media_type: 'video', url: 'https://www.youtube.com/embed/DzrCEm1ZBRY?feature=oembed&x=1' });
    const elsewhere = { ...imagePost, content: { rendered: page('<iframe src="https://example.com/embed"></iframe>') } };
    expect(readApodPost(elsewhere)).toMatchObject({ media_type: 'image' });
  });

  it('reads a credit written without a colon, or as "Credit: Image Credit:"', () => {
    const noColon = { ...imagePost, content: { rendered: page('', 'Credit &amp; Copyright Włodzimierz Bubak') } };
    expect(readApodPost(noColon)?.credit).toBe('Credit & Copyright: Włodzimierz Bubak');
    const doubled = { ...imagePost, content: { rendered: page('', 'Credit: Image Credit: NASA, ESA') } };
    expect(readApodPost(doubled)?.credit).toBe('Image Credit: NASA, ESA');
  });

  it('reads the older pages\' bare "Credit" label before NASA\'s own credit line', () => {
    // As on 2010-01-20, 2019-12-22 and 1999-12-25
    const credit = (line: string) => readApodPost({ ...imagePost, content: { rendered: page('', line) } })?.credit;
    expect(credit('<strong>Credit</strong> Credit &amp; Copyright: <a href="#">American Museum of Natural History</a>'))
      .toBe('Credit & Copyright: American Museum of Natural History');
    expect(credit('Credit Video Credit &amp; Copyright: Ken Murphy (<a href="#"> MurphLab</a>)'))
      .toBe('Video Credit & Copyright: Ken Murphy (MurphLab)');
    expect(credit('Credit Credit: The Clementine Project')).toBe('Credit: The Clementine Project');
  });

  it('decodes entities in the alt text', () => {
    const media = { ...imagePost._embedded['wp:featuredmedia'][0], alt_text: 'Ganymede casts a shadow on Jupiter&#039;s disk.' };
    expect(readApodPost({ ...imagePost, _embedded: { 'wp:featuredmedia': [media] } })?.alt).toBe("Ganymede casts a shadow on Jupiter's disk.");
  });

  it("shows the post's own picture when the featured one is NASA's stand-in", () => {
    // As on 1995-06-20 and 1999-12-25: a GIF in the post, and NASA's generic "news" picture as the featured image
    const gif = 'https://assets.science.nasa.gov/content/dam/science/cds/apod/apod/1999/december/earthmos_clem_big.gif';
    const old = {
      ...imagePost,
      content: {
        rendered: page(
          `<figure><a href="${gif}" target="_blank"><img decoding="async" width="732" height="629" src="${gif}" ` +
          'alt="See Explanation. Clicking on the picture will download the highest resolution version available."></a></figure>'
        )
      },
      _embedded: { 'wp:featuredmedia': [{ source_url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png' }] }
    };
    expect(readApodPost(old)).toMatchObject({ media_type: 'image', url: gif, hdurl: gif, alt: undefined });
  });

  it('never shows the stand-in, even with nothing else to show', () => {
    const standIn = { source_url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png' };
    expect(readApodPost({ ...imagePost, content: { rendered: page('') }, _embedded: { 'wp:featuredmedia': [standIn] } })).toBeNull();
  });

  it('gives up on a post with no picture or video', () => {
    expect(readApodPost({ ...imagePost, _embedded: {} })).toBeNull();
  });
});

describe('cleanTitle', () => {
  it('drops the "APOD: date –" prefix, in either date order', () => {
    expect(cleanTitle('APOD: 2026 November 15 &#8211; Leonid Meteors Through Orion')).toBe('Leonid Meteors Through Orion');
    expect(cleanTitle('APOD: 2026 October 24 – Rosetta&#8217;s Selfie')).toBe('Rosetta’s Selfie');
    expect(cleanTitle('APOD: 29 October 2026 &#8211; The Horns of Venus')).toBe('The Horns of Venus');
    expect(cleanTitle('APOD: 2000 January 09 &#8211; Galaxy Dwingeloo 1 Emerges')).toBe('Galaxy Dwingeloo 1 Emerges');
  });
});

describe('fetchApod', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks science.nasa.gov for the newest APOD post', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(JSON.stringify([imagePost]))));
    await expect(fetchApod()).resolves.toMatchObject({ title: 'Leonid Meteors Through Orion' });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/science\.nasa\.gov\/wp-json\/wp\/v2\/image-article\?categories=22766&per_page=1/);
  });

  it('gives up after the time limit, with a message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(fetchApod(20)).rejects.toThrow(/Couldn't reach NASA Science/);
  });

  it('says when NASA Science is having trouble', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 503 })));
    await expect(fetchApod()).rejects.toThrow(/having trouble/);
  });

  it("says when the reply isn't JSON, rather than showing the parser's error", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('<html>Maintenance</html>')));
    await expect(fetchApod()).rejects.toThrow("NASA Science sent something NASA News can't read. Try again later.");
  });
});
