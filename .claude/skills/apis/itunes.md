# iTunes Search (Apple)

Part of the `apis` skill. The source of Music's guest previews, now that
Spotify sends none ([spotify.md](spotify.md)). The code is
`src/components/Apps/Music/itunes.ts`.

## What it offers

`GET https://itunes.apple.com/search?term={artist} {title}&entity=song&media=music&limit=5`

- No key. Answers browsers from any site (`Access-Control-Allow-Origin: *`).
- Each result has `artistName`, `trackName` and `previewUrl`, a 30-second
  AAC clip on `audio-ssl.itunes.apple.com` that an `<audio>` element plays.
- Match on the artist as well as the title: the first result for a common
  title can be a cover. `pickPreview` compares the first Spotify artist and
  the title with accents, punctuation, "(feat. …)" and " - Remastered"
  tails removed, and gives up rather than play a different recording.
- Leave "(feat. …)" out of the search term: with it, Apple often finds
  nothing.

## Setup and limits

- Apple asks for **about 20 requests a minute**. Look a track up when it is
  played, not the whole playlist at once, and keep what you found for the
  session (`findPreview` keeps each answer for the page's life, but not a
  failed request).
- Apple's terms ask that previews promote the music, so the guest banner
  says they come from Apple Music.

## Known issues

- Not every track is there. On 2026-11-15, 16 of 20 sampled across the
  five playlists matched. The misses: a live recording, two small artists,
  and Zach Bryan's "Boys of Faith", for which Apple has only an
  instrumental cover.

## Probe

```bash
curl -s "https://itunes.apple.com/search?term=zach%20bryan%20something%20in%20the%20orange&entity=song&limit=1" | python3 -c "import json,sys;r=json.load(sys.stdin)['results'][0];print(r['artistName'],'-',r['trackName'],'| preview:',bool(r.get('previewUrl')))"
```
