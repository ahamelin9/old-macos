# NASA APOD (Astronomy Picture of the Day)

Part of the `apis` skill. Used by NASA News
(`src/components/Apps/NasaNews/`: `apod.ts` fetches and reads the post,
`NasaNews.tsx` shows it).

## What the site uses

APOD now lives on **science.nasa.gov**, a WordPress site. Each day's entry
is an `image-article` post in category **22766** (APOD), and the site's
public REST API serves them newest first:

```
https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=1&_embed=wp:featuredmedia&_fields=date,link,title,content,_links,_embedded
```

About 30 KB, under a second. `_fields` must keep `_links` and `_embedded`,
or the embedded picture is dropped. What `apod.ts` reads from the post:

| Shown | From |
|---|---|
| Title | `title.rendered`, without the "APOD: 2026 November 15 – " prefix, entities decoded |
| Date | `date`, first 10 characters |
| Picture | the embedded media's `media_details.sizes.large.source_url` (1024 px); `source_url` is full size |
| Alt text | the embedded media's `alt_text` |
| Explanation | `content.rendered` as text, from `Explanation:` to `Tomorrow's picture:` (or to `Date`, when there's no "tomorrow") |
| Credit | the text from `Credit…` to `Authors & editors`; the colon is sometimes missing |
| Video days | a `<source>`/`<video>` with an `.mp4` on `assets.science.nasa.gov`, or a YouTube or Vimeo `<iframe>`; embeds from anywhere else are ignored |
| Link | `link`, the day's page |

The media's `caption` looks like the explanation but is cut short with
"[…]": don't use it.

## Setup and limits

- No key. It answers browsers from any site (it echoes the `Origin` in
  `Access-Control-Allow-Origin`), and caches for 60 s.
- No published rate limit; NASA News makes one request each time it opens.
- New days appear just after midnight US Eastern time.

## Known issues

### NASA News showed an error, loaded forever, or showed a NASA logo titled "NASA Science"

*2026-11-15. Fixed 2026-11-15.*

- **Cause:** the APOD website moved. `apod.nasa.gov` now 301-redirects to
  `science.nasa.gov/apod/`, but `api.nasa.gov/planetary/apod`, which the
  app used to call, still scrapes the old pages. On 2026-11-15, asking it
  for today answered 500 after about 13 s. Every other date answered 200
  with the new site's generic header: the title "NASA Science", NASA's logo
  as the picture, and one unrelated caption. Some dates weren't even JSON.
  No key, retry or "try yesterday" gets around that.
- **Fix:** NASA News reads science.nasa.gov's WordPress API instead (above),
  with a 10 s timeout and honest messages. `VITE_NASA_API_KEY` is no longer
  used, so it can be deleted from the Cloudflare Pages settings and `.env`.
- **Check:** `apod.test.ts` (shaped like real posts). On 2026-11-15
  `readApodPost` read all 40 posts from 2026-10-07 to 2026-11-15, with the
  explanation and credit for each and all 3 videos.

## Probe

```bash
curl -s -A "macos-1999-api-check/1.0" "https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=1&_fields=date,title" | python3 -c "import json,sys;p=json.load(sys.stdin)[0];print(p['date'][:10], p['title']['rendered'])"
```

Should print today's date (Eastern time) and "APOD: …" with today's title.
