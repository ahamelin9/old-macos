/**
 * Calls to the PokeAPI (the `apis` skill, pokeapi.md). Its fair use policy
 * asks clients to cache, so the names list is kept for the session, species,
 * evolution chains and types are fetched once a session, and sprites come
 * from the sprites repo by id, not one call per stage or form.
 */
export const POKEAPI = 'https://pokeapi.co/api/v2';

const NAMES_KEY = 'pokeapi-names-v1';
const DOWN = 'The PokeAPI might be down. Try again in a bit.';

/** The default sprite for a species or Pokémon id */
export const spriteFor = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

/** The id at the end of a PokeAPI link, like …/pokemon-species/133/; 0 if none */
export const idFromUrl = (url: string) => Number(url.match(/\/(\d+)\/?$/)?.[1] ?? 0);

const get = async (url: string) => {
  try {
    return await fetch(url);
  } catch {
    throw new Error("Couldn't reach the PokeAPI. If on mobile try turning off wifi, or the PokeAPI might be down.");
  }
};

/** One of a species' Pokémon: its default, a regional form, a Mega… */
export interface Variety {
  is_default: boolean;
  pokemon: { name: string; url: string };
}

/** A `pokemon-species/` answer, as far as the forms read it */
export interface Species {
  id?: number;
  name: string;
  names?: { name: string; language: { name: string } }[];
  varieties?: Variety[];
}

// Answers that don't change, kept for the session. A failed one is dropped,
// so Try again really asks again.
const cache = new Map<string, Promise<unknown>>();

/** JSON from a PokeAPI link, fetched once a session. Throws an Error fit to show. */
export const fetchCached = <T,>(url: string): Promise<T> => {
  let answer = cache.get(url) as Promise<T> | undefined;
  if (!answer) {
    answer = get(url).then(res => {
      if (!res.ok) throw new Error(DOWN);
      return res.json() as Promise<T>;
    });
    cache.set(url, answer);
    answer.catch(() => cache.delete(url));
  }
  return answer;
};

/**
 * A species by its link (or a link's id), fetched once a session. The
 * Pokémon's own `species.url` and the evolution chain's links share a key,
 * so the species shown is never fetched twice.
 */
export const fetchSpecies = <T extends Species = Species>(link: string): Promise<T> => {
  const id = idFromUrl(link);
  return fetchCached<T>(id ? `${POKEAPI}/pokemon-species/${id}/` : link);
};

/** Forget everything fetched this session (for tests) */
export const clearCache = () => cache.clear();

/**
 * A Pokémon by name or id. 37 species, like Deoxys and Toxtricity, have no
 * `pokemon/` entry under the species name, only under a form name
 * (`deoxys-normal`), so a 404 is tried again as a species, using its
 * default form. Throws an Error with a message fit to show.
 */
export const fetchPokemon = async <T,>(name: string): Promise<T> => {
  const res = await get(`${POKEAPI}/pokemon/${encodeURIComponent(name)}`);
  if (res.ok) return (await res.json()) as T;
  if (res.status !== 404) throw new Error(DOWN);

  const speciesRes = await get(`${POKEAPI}/pokemon-species/${encodeURIComponent(name)}`);
  if (speciesRes.status === 404) throw new Error(`No Pokémon called "${name}". Check the spelling?`);
  if (!speciesRes.ok) throw new Error(DOWN);
  const species = (await speciesRes.json()) as Species;
  const variety = species.varieties?.find(v => v.is_default) ?? species.varieties?.[0];
  if (!variety) throw new Error(`No Pokémon called "${name}". Check the spelling?`);
  const formRes = await get(variety.pokemon.url);
  if (!formRes.ok) throw new Error(DOWN);
  return (await formRes.json()) as T;
};

/** Every Pokémon name, in id order; fetched once a session */
export const loadPokemonNames = async (): Promise<string[]> => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(NAMES_KEY) ?? 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved as string[];
  } catch {
    // no storage (private mode, tests): fetch instead
  }
  const res = await get(`${POKEAPI}/pokemon?limit=10000`);
  if (!res.ok) throw new Error(DOWN);
  const names = ((await res.json()) as { results: { name: string }[] }).results.map(p => p.name);
  try {
    sessionStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // full or blocked storage: it just gets fetched again next time
  }
  return names;
};
