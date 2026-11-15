/**
 * 30-second previews from Apple's iTunes Search API, for guests: Spotify
 * stopped sending preview_url in late 2024 (the `apis` skill, itunes.md and
 * spotify.md). A track is looked up when it is played, never a whole
 * playlist at once (Apple asks for about 20 requests a minute), and what is
 * found is kept for the page's life.
 */
const SEARCH = 'https://itunes.apple.com/search';
const TIMEOUT_MS = 8000;

interface ItunesSong {
  artistName?: string;
  trackName?: string;
  previewUrl?: string;
}

/** Lower case, no accents or punctuation, and no "(feat. …)" or " - Remastered" tails */
export const simplify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The first result by the same artist with the same title. The artist has
 * to match too: the top hit for a common title is often a cover.
 */
export const pickPreview = (results: ItunesSong[], artist: string, title: string): string | null => {
  const wantArtist = simplify(artist.split(',')[0]);
  const wantTitle = simplify(title);
  if (!wantArtist || !wantTitle) return null;
  for (const song of results) {
    if (!song.previewUrl) continue;
    const gotArtist = simplify(song.artistName ?? '');
    const gotTitle = simplify(song.trackName ?? '');
    const artistMatches = gotArtist.includes(wantArtist) || (gotArtist !== '' && wantArtist.includes(gotArtist));
    const titleMatches = gotTitle === wantTitle || gotTitle.startsWith(`${wantTitle} `) || wantTitle.startsWith(`${gotTitle} `);
    if (artistMatches && titleMatches) return song.previewUrl;
  }
  return null;
};

const found = new Map<string, Promise<string | null>>();

const lookUp = async (artist: string, title: string): Promise<string | null> => {
  // Without "(feat. …)" or " - Remastered": they make Apple's search find nothing
  const term = `${artist.split(',')[0]} ${title.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SEARCH}?term=${encodeURIComponent(term)}&entity=song&media=music&limit=10`, {
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`iTunes Search answered ${res.status}`);
    const data = (await res.json()) as { results?: ItunesSong[] };
    return pickPreview(data.results ?? [], artist, title);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * A preview clip's address for a track, or null if Apple has none. A failed
 * request is not remembered, so the next play tries again.
 */
export const findPreview = (artist: string, title: string): Promise<string | null> => {
  const key = `${artist}\u0000${title}`;
  let pending = found.get(key);
  if (!pending) {
    pending = lookUp(artist, title);
    found.set(key, pending);
    pending.catch(() => found.delete(key));
  }
  return pending;
};
