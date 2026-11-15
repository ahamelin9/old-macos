import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCache, fetchCached, fetchPokemon, fetchSpecies, idFromUrl, loadPokemonNames, POKEAPI } from './pokeapi';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('idFromUrl', () => {
  it('reads the id from a PokeAPI link, with or without the last slash', () => {
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon-species/133/')).toBe(133);
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon-species/849')).toBe(849);
    expect(idFromUrl('nonsense')).toBe(0);
  });
});

describe('fetchPokemon', () => {
  afterEach(() => vi.restoreAllMocks());

  it('finds a species that is only filed under a form name', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
      const url = String(input);
      if (url === `${POKEAPI}/pokemon/deoxys`) return json({}, 404);
      if (url === `${POKEAPI}/pokemon-species/deoxys`) {
        return json({
          varieties: [
            { is_default: false, pokemon: { name: 'deoxys-attack', url: `${POKEAPI}/pokemon/10001/` } },
            { is_default: true, pokemon: { name: 'deoxys-normal', url: `${POKEAPI}/pokemon/386/` } }
          ]
        });
      }
      if (url === `${POKEAPI}/pokemon/386/`) return json({ id: 386, name: 'deoxys-normal' });
      return json({}, 500);
    });
    await expect(fetchPokemon('deoxys')).resolves.toEqual({ id: 386, name: 'deoxys-normal' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('says the name is wrong when neither a Pokémon nor a species has it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({}, 404));
    await expect(fetchPokemon('pikachoo')).rejects.toThrow('No Pokémon called "pikachoo"');
  });

  it('blames the API, not the spelling, on a 500', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({}, 500));
    await expect(fetchPokemon('pikachu')).rejects.toThrow(/might be down/);
  });
});

describe('fetchCached and fetchSpecies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('asks once a session for the same species, whichever link names it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ name: 'dragonite' }));
    await fetchSpecies(`${POKEAPI}/pokemon-species/149/`);
    await fetchSpecies(`${POKEAPI}/pokemon-species/149`);
    await Promise.all([fetchSpecies(`${POKEAPI}/pokemon-species/148/`), fetchSpecies(`${POKEAPI}/pokemon-species/148/`)]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(`${POKEAPI}/pokemon-species/149/`);
  });

  it("checks the answer, and doesn't keep a failure, so Try again asks again", async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => json({}, 503))
      .mockImplementationOnce(() => json({ name: 'dragon' }));
    await expect(fetchCached(`${POKEAPI}/type/16/`)).rejects.toThrow(/might be down/);
    await expect(fetchCached(`${POKEAPI}/type/16/`)).resolves.toEqual({ name: 'dragon' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('loadPokemonNames', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches the list once, then reads it from the session', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v)
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json({ results: [{ name: 'bulbasaur' }, { name: 'ivysaur' }] })
    );
    await expect(loadPokemonNames()).resolves.toEqual(['bulbasaur', 'ivysaur']);
    await expect(loadPokemonNames()).resolves.toEqual(['bulbasaur', 'ivysaur']);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('still works when storage is blocked', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); }
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ results: [{ name: 'mew' }] }));
    await expect(loadPokemonNames()).resolves.toEqual(['mew']);
  });
});
