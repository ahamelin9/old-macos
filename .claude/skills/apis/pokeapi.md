# PokeAPI

Part of the `apis` skill. Used by Pokémon
(`src/components/Apps/PokemonSearch/PokemonSearch.tsx`).

## What the site uses

Base `https://pokeapi.co/api/v2`. No key.

| Call | For |
|---|---|
| `pokemon/{name or id}` | The Pokémon shown: stats, types, sprites, and links to the rest |
| `pokemon?limit=10000` | Every name, for the suggestions and the ← → buttons |
| `pokemon-species/{id}` (the `species.url` link) | The Pokédex entry and the evolution chain's link |
| `type/{id}` (each `types[].type.url`) | Damage relations, for the matchups and the type chart |
| `evolution-chain/{id}` | The evolution tree |

Sprites are files on GitHub, not API calls:
`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`
(and `…/items/{name}.png` for evolution items).

## Setup and limits

- No key and no published rate limit, but a **fair use policy**: cache what
  you fetch, or an address that hammers it can be banned for good.
- The names list is about 93 KB. Names come back in id order for ids 1 to
  1025, then alternate forms from id 10001.

## Known issues

### A Pokémon "doesn't exist" though it does, or its evolution sprite is missing

*2026-11-15. Fixed 2026-11-15.*

- **Symptom:** searching `deoxys`, `giratina`, `mimikyu`, `toxtricity` or
  `lycanroc` says no Pokémon has that name. Evolution chains that include
  one (Toxel, Rockruff, Honedge…) show a blank card for it.
- **Cause:** 37 of the 1,025 species have no `pokemon/` entry under the
  species name, only under a form name (`deoxys-normal`,
  `toxtricity-amped`). `pokemon/deoxys` is a 404. The evolution tree also
  fetched `pokemon/{species name}` for every stage.
- **Fix:** `PokemonSearch/pokeapi.ts`. On a 404, `fetchPokemon` asks
  `pokemon-species/{name}` and loads its default variety (Deoxys shows as
  "Deoxys-normal"). Evolution sprites come from the species id in the
  chain's links (`spriteFor`), with no request per stage. The names list is
  kept in sessionStorage for the session.
- **Check:** `pokeapi.test.ts`; `app-check.mjs` loads Deoxys.

### A misspelled name blamed the wifi

Solved; in know-how (`apps.md`, "Pokémon says turn off wifi").

## Probe

```bash
for n in pikachu deoxys deoxys-normal; do curl -s -o /dev/null -w "%{http_code} $n\n" "https://pokeapi.co/api/v2/pokemon/$n"; done
```

Should print 200, 404, 200.
