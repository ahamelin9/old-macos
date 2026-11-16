// npm run probe: is every outside API up and answering the way the code
// expects? These are the live calls; browser checks use canned replies
// instead (know-how's checking.md). One or two small requests per service,
// a second apart. Each service's file in this skill explains its probe.
//
//   npm run probe                 every service except Brave
//   npm run probe -- nasa pokeapi just these
//   npm run probe -- brave        Brave too: each probe spends one of the month's 2,000 searches
//
// Prints one summary line, plus a line for each failure.
const UA = { 'User-Agent': 'macos-1999-api-check/1.0' };
const get = async (url, init = {}) => {
  const res = await fetch(url, { headers: UA, ...init });
  return res;
};
const json = async (url) => {
  const res = await get(url);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
};
const expect = (ok, what) => { if (!ok) throw new Error(what); };

const PROBES = {
  nasa: async () => {
    const res = await get('https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=1&_fields=date,title');
    expect(res.ok, `status ${res.status}`);
    const [p] = await res.json();
    expect(/^APOD/.test(p?.title?.rendered ?? ''), `latest title is "${p?.title?.rendered}"`);
    expect(Number(res.headers.get('x-wp-total')) > 10000, `x-wp-total is ${res.headers.get('x-wp-total')}`);
    const age = (Date.now() - Date.parse(p.date)) / 864e5;
    expect(age < 3, `latest APOD is from ${p.date.slice(0, 10)}`);
  },
  pokeapi: async () => {
    const codes = [];
    for (const n of ['pikachu', 'deoxys', 'deoxys-normal']) codes.push((await get(`https://pokeapi.co/api/v2/pokemon/${n}`)).status);
    expect(codes.join() === '200,404,200', `pikachu, deoxys, deoxys-normal gave ${codes.join(', ')} (want 200, 404, 200)`);
    const v = (await json('https://pokeapi.co/api/v2/pokemon-species/charizard')).varieties.map(x => x.pokemon.name).join(' ');
    expect(v === 'charizard charizard-mega-x charizard-mega-y charizard-gmax', `charizard varieties: ${v}`);
  },
  inaturalist: async () => {
    const d = await json('https://api.inaturalist.org/v1/observations/species_counts?lat=35.6762&lng=139.6503&radius=25&per_page=0');
    expect(d.total_results > 0, `total_results ${d.total_results}`);
  },
  wikipedia: async () => {
    const d = await json('https://en.wikipedia.org/api/rest_v1/page/summary/Grey_heron');
    expect(d.type === 'standard' && d.wikibase_item === 'Q25273', `${d.type} ${d.wikibase_item} (want standard Q25273)`);
  },
  openstreetmap: async () => {
    const n = await get('https://nominatim.openstreetmap.org/search?q=Kyoto&format=json&limit=1');
    expect(n.ok, `nominatim ${n.status}`);
    await new Promise(r => setTimeout(r, 1000));
    const p = await get('https://photon.komoot.io/api/?q=Kyot&limit=4&lang=en');
    expect(p.ok, `photon ${p.status}`);
    const t = await get('https://tile.openstreetmap.org/3/7/3.png');
    expect(t.ok, `tile ${t.status}`);
  },
  itunes: async () => {
    const r = (await json('https://itunes.apple.com/search?term=zach%20bryan%20something%20in%20the%20orange&entity=song&limit=1')).results?.[0];
    expect(r?.previewUrl, `no preview for ${r?.artistName} - ${r?.trackName}`);
  },
  spotify: async () => {
    // A guest token from the live site, never printed
    const { access_token } = await json('https://old-macos-2vr.pages.dev/api/client_credentials');
    expect(access_token, 'no guest token');
    const res = await fetch('https://api.spotify.com/v1/playlists/34LNnZ8iIV884x9xZZxDt6/tracks', { headers: { Authorization: `Bearer ${access_token}` } });
    expect(res.ok, `playlist ${res.status}`);
    const items = (await res.json()).items.filter(x => x.track);
    expect(items.length > 0, 'the playlist is empty');
  },
  brave: async () => {
    const d = await json('https://brave-search-worker.ahamelin9.workers.dev?q=macintosh');
    expect(d.type === 'search' && d.web?.results?.length > 0, `${d.type}, ${d.web?.results?.length ?? 0} results ${d.error?.detail ?? ''}`);
  },
};

const asked = process.argv.slice(2);
const names = asked.length ? Object.keys(PROBES).filter(n => asked.some(a => n.includes(a))) : Object.keys(PROBES).filter(n => n !== 'brave');
const failures = [];
const t0 = Date.now();
for (const name of names) {
  try { await PROBES[name](); } catch (e) { failures.push(`  ✗ ${name}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 1000));
}
console.log(`probe: ${failures.length ? 'FAILED' : 'ok'}: ${names.length - failures.length}/${names.length} services answer as expected (${names.join(', ')}) in ${Math.round((Date.now() - t0) / 1000)}s`);
if (failures.length) { console.log(failures.join('\n')); process.exitCode = 1; }
