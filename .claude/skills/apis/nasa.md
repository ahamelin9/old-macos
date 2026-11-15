# NASA APOD (Astronomy Picture of the Day)

Part of the `apis` skill. Used by NASA News
(`src/components/Apps/NasaNews/`: `apod.ts` fetches and reads a post,
`apodDays.ts` fetches the sidebar's past days, searches and dates, and
`NasaNews.tsx` shows them).

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
"[…]": don't use it. The media's `alt_text` has entities (`&#039;`), so it
is decoded too.

### NASA's stand-in picture

Many older days (GIFs, videos, all of 1995) have NASA's generic "news"
picture as their featured image:
`…/cosmic-origins/images/misc/news-thumbnail.png`. It is never the day's
picture. 19 of 109 days sampled on 2026-11-15 had it, from 1995 to 2026.
`isStandInImage` spots it by file name. The day's real picture is then an
`<img>` inside the post, in the APOD folder on `assets.science.nasa.gov`,
inside a link to the full-size file; `readApodPost` uses that. A video day
with the stand-in gets its video from the post as usual. In the sidebar, a
stand-in day shows a ✦ placeholder.

Title and credit quirks `readApodPost` handles:

- Titles come as "APOD: 2026 November 15 – …" and "APOD: 29 October 2026 – …",
  with the dash as `&#8211;` or a plain "–" (`cleanTitle`).
- Older pages put a bare "Credit" label before NASA's own credit line
  ("Credit Video Credit & Copyright: Ken Murphy"); the app shows just the line.

### The sidebar: past days, search and dates

All three are the same `image-article` list, category 22766. A row needs no
post text, so the list asks only for what a row shows:

```
https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=20&page=N&_embed=wp:featuredmedia&_fields=id,date,title,link,_links,_embedded
```

- About 2 s and 270 KB a page; 11,469 days on 2026-11-15, back to
  1995-06-16, so 574 pages (the last has 9).
- `X-WP-TotalPages` and `X-WP-Total` say how many there are; browsers can
  read them (`Access-Control-Expose-Headers`). A page past the end answers
  400 (`rest_post_invalid_page_number`), so stop at `X-WP-TotalPages`.
- Pages are by position, newest first: a new day published between two
  pages pushes the next page down one, so `mergeDays` drops repeats by `id`.
- **Thumbnails:** `media_details.sizes['thumbnail-sm']` (fits 140×100,
  about 20 KB), else `sizes.thumbnail` (319 px). Some `thumbnail-sm` URLs on
  `…/dynamicimage/…` say `w=0&h=0`, which is the whole picture (150 KB);
  that server sizes any picture from `w` and `h`, so `smallThumb` asks for
  `w=140&h=100` (3 KB). A picture with `sizes: {}` (2025-10-15) gets the same
  server's copy of its file: `/content/dam/X` is also at
  `/dynamicimage/assets/X`.
- **One day,** when its row is picked:
  `image-article/{id}?_embed=wp:featuredmedia&_fields=date,link,title,content,_links,_embedded`,
  read by `readApodPost`. About 25 KB, under a second. Kept for the visit.
- **Search:** add `&search=<words>&orderby=relevance`. It searches the title
  **and** the explanation ("rocket": 301 days; the 2026-10-16 day says it
  only in its text). `search_columns=post_title` is ignored, so titles alone
  can't be searched. `orderby=relevance` puts title matches first: on
  2026-11-15 "horsehead" gave 5 title matches in the top 5 against 2 newest
  first, and "rocket" 8 of the top 10 against 4. No results: `[]` with
  `X-WP-Total: 0`.
- **A date:** `per_page=1&after=<day before>T23:59:59&before=<day after>T00:00:00`
  with the one-day `_fields`. Early years have gaps: 1995-06-18 answers `[]`
  (the app says "No picture on 1995-06-18."), and 1995 posts are dated
  00:00:00. The first day is 1995-06-16; the date box allows up to today in
  US Eastern time.
- Video days for testing: 2026-10-28 (NASA's own .mp4), 2026-10-18 (YouTube),
  2019-12-22 (Vimeo), 2010-01-20 (YouTube, with the stand-in picture).

## Setup and limits

- No key. It answers browsers from any site (it echoes the `Origin` in
  `Access-Control-Allow-Origin`), and caches for 60 s.
- No published rate limit. NASA News makes one request when it opens. The
  sidebar adds a page when it first opens and one more each time its end
  scrolls into view (never two at once), one per picked day or date (kept
  for the visit), and searches only after typing pauses for 400 ms.
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

The sidebar's list, with its page count:

```bash
curl -s -D - -o /dev/null -A "macos-1999-apod-check/1.0" "https://science.nasa.gov/wp-json/wp/v2/image-article?categories=22766&per_page=20&page=1&_fields=id" | grep -i '^x-wp-total'
```

Should print `x-wp-total` (about 11,500 and growing) and `x-wp-totalpages`.
The whole sidebar, in a browser at three sizes: know-how's `nasa-check.mjs`.
