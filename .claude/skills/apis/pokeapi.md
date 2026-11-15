# PokeAPI

Part of the `apis` skill. Used by Pokémon
(`src/components/Apps/PokemonSearch/PokemonSearch.tsx`).

## What the site uses

Base `https://pokeapi.co/api/v2`. No key.

| Call | For |
|---|---|
| `pokemon/{name or id}` | The Pokémon shown: stats, types, sprites, and links to the rest |
| `pokemon?limit=10000` | Every name, for the suggestions and the ← → buttons |
| `pokemon-species/{id}` (the `species.url` link) | The Pokédex entry, the evolution chain's link, its English name, and its `varieties` (the forms) |
| `pokemon-species/{id}` for each stage of the chain | Each stage's English name, and its Megas and Gigantamax for the line |
| `type/{id}` (each `types[].type.url`) | Damage relations, for the matchups and the type chart |
| `evolution-chain/{id}` | The evolution tree |

Species, chains and types never change, so `fetchCached` in
`PokemonSearch/pokeapi.ts` keeps them for the session (a failure isn't kept,
so Try again asks again). Showing Dragonite costs about seven requests the
first time; clicking Mega Dragonite then costs one, `pokemon/dragonite-mega`.

Sprites are files on GitHub, not API calls:
`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`
(and `…/items/{name}.png` for evolution items). A form's id works too
(10281 is Mega Dragonite).

## Setup and limits

- No key and no published rate limit, but a **fair use policy**: cache what
  you fetch, or an address that hammers it can be banned for good.
- The names list is about 93 KB. Names come back in id order for ids 1 to
  1025, then alternate forms from id 10001.

## Varieties and forms

*2026-11-15. Code: `PokemonSearch/forms.ts`, tested in `forms.test.ts`.*

- **Where they are:** `pokemon-species/{id}`'s `varieties`, a list of
  `{ is_default, pokemon: { name, url } }`. Each is a `pokemon/` entry of
  its own, with its own types, size and sprite. Dragonite has `dragonite`
  and `dragonite-mega` (10281); Charizard adds `-mega-x`, `-mega-y` and
  `-gmax`; Raichu has `raichu-alola` and `-mega-x`/`-mega-y`; Pikachu has 17
  (15 caps and costumes, and `-gmax`). Forms have ids from 10001.
- **Names:** every variety is `<species>-<form>`. The games' names are
  worked out from that, with no request per form: Mega Charizard X,
  Gigantamax Charizard, Alolan / Galarian / Hisuian / Paldean …, Primal
  Kyogre, and anything else in brackets: Pikachu (Original Cap), Deoxys
  (Normal). `pikachu-alola-cap` is a cap, not an Alolan form. A few words
  are spelled differently (`phd` is Ph.D., Zygarde's `10` is 10%). The
  species' own English name comes from its `names` (Mr. Mime, not Mr-mime).
- **How they were checked:** the rules were run over all 326 form names in
  the names list, and spot-checked against `pokemon-form/{name}`'s English
  `names` (it calls `pikachu-original-cap` "Original Cap Pikachu" and
  `darmanitan-galar-zen` "Zen Galarian Darmanitan"; ours put the form in
  brackets on purpose). `pokemon-form/` also has `is_mega`, but costs a
  request per form, so the app doesn't use it.
- **Missing sprites:** 9 of 326 forms had no sprite on GitHub
  (Koraidon's and Miraidon's builds and modes, Mega Zygarde), and
  `pokemon/zygarde-mega` has `front_default: null`. The app shows a "?".

How the app shows them (Alex, 2026-11-15):

- **Megas and Gigantamax go in the evolution line**, in a dashed tray hanging
  off their stage, because they are transformations of that Pokémon.
- **Regional forms don't.** The chain lists species, not forms, so it can't
  say which Raichu evolves from which Pikachu; drawing Alolan Raichu in the
  line would claim what the data doesn't.
- **"Other forms" holds the rest**: not the default (the line's stage) and
  not the Megas and Gigantamax (in the line). None left, no row (Dragonite).
  Up to three show open in one line (Raichu); more fold behind "▸ Other
  forms (15)", which stays as the user left it for the session
  (`sessionStorage`, `pokemon-other-forms-open`).
- **No carousel and no auto-rotating forms**: motion pulls attention,
  moving cards are hard to click, and there's no room at 400×300.
- The heading shows the Pokédex number, so Mega Dragonite is #149, not
  #10281, and ← → step by Pokédex number from a form too.

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

The forms, against the app at three sizes, with spot-checks of three forms:
know-how's `pokemon-forms-check.mjs` (`feature-checks.md`). One species' varieties:

```bash
curl -s -A 'macos-1999-pokemon-check/1.0' https://pokeapi.co/api/v2/pokemon-species/charizard | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).varieties.map(v=>v.pokemon.name).join(" ")))'
```

Should print `charizard charizard-mega-x charizard-mega-y charizard-gmax`.
