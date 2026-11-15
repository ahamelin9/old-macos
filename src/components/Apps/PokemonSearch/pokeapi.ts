/**
 * Calls to the PokeAPI (the `apis` skill, pokeapi.md). Its fair use policy
 * asks clients to cache, so the names list is kept for the session and
 * evolution sprites come from the sprites repo by id, not one call per stage.
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

interface Species {
  varieties?: { is_default: boolean; pokemon: { name: string; url: string } }[];
}

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
