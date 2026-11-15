/**
 * A species' varieties: every Pokémon filed under it, from
 * `pokemon-species/{id}`'s `varieties` (the `apis` skill, pokeapi.md). That
 * covers regional forms (Alolan Raichu), Megas, Gigantamax and the rest
 * (Pikachu's caps, Deoxys's formes).
 *
 * PokeAPI names them like `charizard-mega-x`; the games say "Mega Charizard
 * X". The names here are worked out from PokeAPI's name, so no form costs a
 * request. The rules were spot-checked against `pokemon-form/{name}`'s
 * English names on 2026-11-15.
 */
import { idFromUrl, spriteFor, type Species } from './pokeapi';

/**
 * What a variety is. `mega` and `gmax` are transformations of the Pokémon
 * they come from, so they sit in the evolution line; the others don't,
 * because the chain doesn't say which regional form evolves from what.
 */
export type FormKind = 'base' | 'mega' | 'gmax' | 'regional' | 'other';

export interface PokemonForm {
  /** PokeAPI's name, which `pokemon/{name}` answers to */
  name: string;
  /** Its Pokémon id (10034 for Mega Charizard X); 0 if the link had none */
  id: number;
  /** What to show: "Mega Charizard X" */
  label: string;
  kind: FormKind;
  /** The species' default Pokémon (Dragonite; Deoxys's Normal Forme) */
  isDefault: boolean;
  /** Its sprite on GitHub. A few forms have none (Mega Zygarde), so show it with a fallback */
  sprite: string;
}

const REGIONS: Record<string, string> = {
  alola: 'Alolan',
  galar: 'Galarian',
  hisui: 'Hisuian',
  paldea: 'Paldean'
};

// Words PokeAPI writes differently from the games
const WORDS: Record<string, string> = {
  phd: 'Ph.D.', // Pikachu Ph.D.
  '10': '10%', // Zygarde's 10% and 50% Formes
  '50': '50%',
  of: 'of' // Maushold's Family of Three
};

/** "original-cap" → "Original Cap" */
export const titleCase = (name: string) =>
  name
    .split('-')
    .filter(Boolean)
    .map(word => WORDS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** The species' English name ("Mr. Mime"), else its PokeAPI name made readable */
export const speciesLabel = (species: Pick<Species, 'name' | 'names'>) =>
  species.names?.find(n => n.language.name === 'en')?.name ?? titleCase(species.name);

/**
 * The kind and readable name of one of a species' Pokémon:
 * - `charizard-mega-x` → Mega Charizard X (mega)
 * - `charizard-gmax` → Gigantamax Charizard (gmax)
 * - `raichu-alola` → Alolan Raichu (regional); Galarian, Hisuian, Paldean too
 * - `kyogre-primal` → Primal Kyogre
 * - anything else keeps the base name with the form in brackets:
 *   `pikachu-original-cap` → Pikachu (Original Cap), `deoxys-normal` →
 *   Deoxys (Normal), `meowstic-female-mega` → Mega Meowstic (Female)
 *
 * `base` is the species' display name; it defaults to the PokeAPI name made
 * readable, which is wrong only for a few (Mr. Mime, Farfetch'd).
 */
export const describeForm = (
  name: string,
  speciesName: string,
  base = titleCase(speciesName)
): { kind: FormKind; label: string } => {
  if (name === speciesName) return { kind: 'base', label: base };
  // Every variety is named "<species>-<form>"; anything else is shown as is
  if (!name.startsWith(`${speciesName}-`)) return { kind: 'other', label: titleCase(name) };

  const words = name.slice(speciesName.length + 1).split('-');
  const before: string[] = [];
  let after = '';
  let kind: FormKind = 'other';
  const take = (word: string) => {
    const at = words.indexOf(word);
    if (at >= 0) words.splice(at, 1);
    return at;
  };

  const mega = take('mega');
  if (mega >= 0) {
    kind = 'mega';
    before.push('Mega');
    // Mega Charizard X and Y, Mega Absol Z
    if (/^[xyz]$/.test(words[mega] ?? '')) after = ` ${words.splice(mega, 1)[0].toUpperCase()}`;
  } else if (take('gmax') >= 0) {
    kind = 'gmax';
    before.push('Gigantamax');
  } else if (take('primal') >= 0) {
    before.push('Primal');
  }

  // A region word makes a regional form, except Pikachu's caps ("alola-cap")
  const region = words.findIndex((word, i) => REGIONS[word] && words[i + 1] !== 'cap');
  if (region >= 0) {
    before.push(REGIONS[words[region]]);
    words.splice(region, 1);
    if (kind === 'other') kind = 'regional';
  }

  const rest = words.length ? ` (${titleCase(words.join('-'))})` : '';
  return { kind, label: `${[...before, base].join(' ')}${after}${rest}` };
};

/** Every Pokémon of a species, in PokeAPI's order (the default first) */
export const readVarieties = (species: Species): PokemonForm[] => {
  const base = speciesLabel(species);
  return (species.varieties ?? []).map(v => {
    const id = idFromUrl(v.pokemon.url);
    return {
      name: v.pokemon.name,
      id,
      ...describeForm(v.pokemon.name, species.name, base),
      isDefault: v.is_default,
      sprite: id ? spriteFor(id) : ''
    };
  });
};

/** True for a Mega or Gigantamax: a transformation, shown in the evolution line */
export const isTransformation = (form: Pick<PokemonForm, 'kind' | 'isDefault'>) =>
  !form.isDefault && (form.kind === 'mega' || form.kind === 'gmax');

/** The Megas and Gigantamax (for the evolution line), and every other form */
export const splitForms = (forms: PokemonForm[]) => ({
  transformations: forms.filter(isTransformation),
  others: forms.filter(f => !isTransformation(f))
});

/** Up to this many forms show open, in one row that fits even the 400x300 window */
export const ONE_ROW = 3;

/**
 * The Forms row: the forms the evolution line doesn't already show. The line
 * shows the default as its stage and the Megas and Gigantamax off it, so
 * those stay out (Dragonite gets no row). More than ONE_ROW fold away behind
 * a disclosure triangle (Pikachu's 15 caps and costumes).
 */
export const formsRow = (forms: PokemonForm[]) => {
  const row = splitForms(forms).others.filter(f => !f.isDefault);
  return { forms: row, folds: row.length > ONE_ROW };
};
