import { describe, expect, it } from 'vitest';
import { describeForm, formsRow, ONE_ROW, readVarieties, speciesLabel, splitForms, titleCase } from './forms';
import { POKEAPI, spriteFor } from './pokeapi';

const variety = (name: string, id: number, isDefault = false) => ({
  is_default: isDefault,
  pokemon: { name, url: `${POKEAPI}/pokemon/${id}/` }
});

// pokemon-species/{name}'s varieties, as PokeAPI answered on 2026-11-15
const charizard = {
  name: 'charizard',
  names: [{ name: 'Charizard', language: { name: 'en' } }],
  varieties: [
    variety('charizard', 6, true),
    variety('charizard-mega-x', 10034),
    variety('charizard-mega-y', 10035),
    variety('charizard-gmax', 10196)
  ]
};
const raichu = {
  name: 'raichu',
  varieties: [
    variety('raichu', 26, true),
    variety('raichu-alola', 10100),
    variety('raichu-mega-x', 10304),
    variety('raichu-mega-y', 10305)
  ]
};

describe('describeForm: the names the games use', () => {
  // Each checked against pokemon-form/{name}'s English names on 2026-11-15
  it.each([
    ['dragonite', 'dragonite', 'base', 'Dragonite'],
    ['dragonite-mega', 'dragonite', 'mega', 'Mega Dragonite'],
    ['charizard-mega-x', 'charizard', 'mega', 'Mega Charizard X'],
    ['charizard-mega-y', 'charizard', 'mega', 'Mega Charizard Y'],
    ['absol-mega-z', 'absol', 'mega', 'Mega Absol Z'],
    ['charizard-gmax', 'charizard', 'gmax', 'Gigantamax Charizard'],
    ['raichu-alola', 'raichu', 'regional', 'Alolan Raichu'],
    ['meowth-galar', 'meowth', 'regional', 'Galarian Meowth'],
    ['growlithe-hisui', 'growlithe', 'regional', 'Hisuian Growlithe'],
    ['wooper-paldea', 'wooper', 'regional', 'Paldean Wooper'],
    ['kyogre-primal', 'kyogre', 'other', 'Primal Kyogre']
  ])('%s is %s, "%s"', (name, species, kind, label) => {
    expect(describeForm(name, species)).toEqual({ kind, label });
  });

  it('puts any other form in brackets after the base name', () => {
    expect(describeForm('pikachu-original-cap', 'pikachu').label).toBe('Pikachu (Original Cap)');
    expect(describeForm('rotom-wash', 'rotom').label).toBe('Rotom (Wash)');
    expect(describeForm('pikachu-original-cap', 'pikachu').kind).toBe('other');
  });

  it('names a default that has a form name (the 37 species filed under one)', () => {
    expect(describeForm('deoxys-normal', 'deoxys')).toEqual({ kind: 'other', label: 'Deoxys (Normal)' });
    expect(describeForm('toxtricity-amped', 'toxtricity').label).toBe('Toxtricity (Amped)');
  });

  it('keeps the form of a Mega or Gigantamax whose default has one', () => {
    expect(describeForm('meowstic-female-mega', 'meowstic')).toEqual({ kind: 'mega', label: 'Mega Meowstic (Female)' });
    expect(describeForm('toxtricity-low-key-gmax', 'toxtricity')).toEqual({ kind: 'gmax', label: 'Gigantamax Toxtricity (Low Key)' });
  });

  it('keeps what follows a region in brackets', () => {
    expect(describeForm('tauros-paldea-combat-breed', 'tauros')).toEqual({ kind: 'regional', label: 'Paldean Tauros (Combat Breed)' });
    expect(describeForm('darmanitan-galar-zen', 'darmanitan').label).toBe('Galarian Darmanitan (Zen)');
    expect(describeForm('raticate-totem-alola', 'raticate').label).toBe('Alolan Raticate (Totem)');
  });

  it("doesn't take Pikachu's Alola Cap for an Alolan form", () => {
    expect(describeForm('pikachu-alola-cap', 'pikachu')).toEqual({ kind: 'other', label: 'Pikachu (Alola Cap)' });
  });

  it('uses the display name it is given, for species PokeAPI spells differently', () => {
    expect(describeForm('mr-mime-galar', 'mr-mime', 'Mr. Mime').label).toBe('Galarian Mr. Mime');
    expect(describeForm('kommo-o-totem', 'kommo-o', 'Kommo-o').label).toBe('Kommo-o (Totem)');
  });

  it('writes the odd words the way the games do', () => {
    expect(describeForm('pikachu-phd', 'pikachu').label).toBe('Pikachu (Ph.D.)');
    expect(describeForm('zygarde-10', 'zygarde').label).toBe('Zygarde (10%)');
    expect(describeForm('maushold-family-of-three', 'maushold').label).toBe('Maushold (Family of Three)');
  });

  it("shows a name that isn't under its species as it is", () => {
    expect(describeForm('something-else', 'pikachu')).toEqual({ kind: 'other', label: 'Something Else' });
  });
});

describe('speciesLabel and titleCase', () => {
  it("uses the species' English name when there is one", () => {
    expect(speciesLabel({ name: 'mr-mime', names: [{ name: 'M. Mime', language: { name: 'fr' } }, { name: 'Mr. Mime', language: { name: 'en' } }] })).toBe('Mr. Mime');
    expect(speciesLabel({ name: 'mr-mime' })).toBe('Mr Mime');
    expect(titleCase('original-cap')).toBe('Original Cap');
  });
});

describe('readVarieties', () => {
  it("reads each of a species' Pokémon, with its id, sprite and name", () => {
    const forms = readVarieties(charizard);
    expect(forms.map(f => f.label)).toEqual(['Charizard', 'Mega Charizard X', 'Mega Charizard Y', 'Gigantamax Charizard']);
    expect(forms[1]).toEqual({
      name: 'charizard-mega-x',
      id: 10034,
      label: 'Mega Charizard X',
      kind: 'mega',
      isDefault: false,
      sprite: spriteFor(10034)
    });
    expect(forms[0].isDefault).toBe(true);
  });

  it('gives no sprite rather than a broken link when the link has no id', () => {
    const [form] = readVarieties({ name: 'mew', varieties: [{ is_default: true, pokemon: { name: 'mew', url: 'nonsense' } }] });
    expect(form.sprite).toBe('');
  });

  it('copes with a species that lists no varieties', () => {
    expect(readVarieties({ name: 'mew' })).toEqual([]);
  });
});

describe('splitForms', () => {
  it('sends Megas and Gigantamax to the evolution line, and keeps regional forms out of it', () => {
    const { transformations, others } = splitForms(readVarieties(raichu));
    expect(transformations.map(f => f.name)).toEqual(['raichu-mega-x', 'raichu-mega-y']);
    expect(others.map(f => f.name)).toEqual(['raichu', 'raichu-alola']);
  });

  it('counts Gigantamax as a transformation, and caps and costumes as other forms', () => {
    const pikachu = readVarieties({
      name: 'pikachu',
      varieties: [variety('pikachu', 25, true), variety('pikachu-original-cap', 10094), variety('pikachu-gmax', 10199)]
    });
    const { transformations, others } = splitForms(pikachu);
    expect(transformations.map(f => f.label)).toEqual(['Gigantamax Pikachu']);
    expect(others.map(f => f.label)).toEqual(['Pikachu', 'Pikachu (Original Cap)']);
  });

  it('never moves a default into the evolution line', () => {
    const { transformations } = splitForms(readVarieties({ name: 'odd', varieties: [variety('odd-mega', 1, true)] }));
    expect(transformations).toEqual([]);
  });
});

describe('formsRow: what the Forms row shows, and when it folds away', () => {
  // pikachu's varieties on 2026-11-15: the default, 15 caps and costumes, and Gigantamax
  const caps = ['rock-star', 'belle', 'pop-star', 'phd', 'libre', 'cosplay', 'original-cap', 'hoenn-cap',
    'sinnoh-cap', 'unova-cap', 'kalos-cap', 'alola-cap', 'partner-cap', 'starter', 'world-cap'];
  const pikachu = {
    name: 'pikachu',
    varieties: [variety('pikachu', 25, true), ...caps.map((c, i) => variety(`pikachu-${c}`, 10080 + i)), variety('pikachu-gmax', 10199)]
  };

  it('leaves out what the evolution line shows: the default, the Megas and Gigantamax', () => {
    expect(formsRow(readVarieties(raichu)).forms.map(f => f.label)).toEqual(['Alolan Raichu']);
    expect(formsRow(readVarieties(charizard)).forms).toEqual([]);
  });

  it('shows nothing for Dragonite, whose only other form is its Mega', () => {
    const dragonite = { name: 'dragonite', varieties: [variety('dragonite', 149, true), variety('dragonite-mega', 10281)] };
    expect(formsRow(readVarieties(dragonite))).toEqual({ forms: [], folds: false });
  });

  it('keeps a form-named default out too: the line shows it as the stage', () => {
    const deoxys = {
      name: 'deoxys',
      varieties: [variety('deoxys-normal', 386, true), variety('deoxys-attack', 10001), variety('deoxys-defense', 10002), variety('deoxys-speed', 10003)]
    };
    expect(formsRow(readVarieties(deoxys)).forms.map(f => f.label)).toEqual(['Deoxys (Attack)', 'Deoxys (Defense)', 'Deoxys (Speed)']);
  });

  it(`shows up to ${ONE_ROW} open, in one row`, () => {
    expect(formsRow(readVarieties(raichu)).folds).toBe(false);
    const three = { name: 'x', varieties: [variety('x', 1, true), variety('x-a', 2), variety('x-b', 3), variety('x-c', 4)] };
    expect(formsRow(readVarieties(three))).toMatchObject({ folds: false });
    expect(formsRow(readVarieties(three)).forms).toHaveLength(3);
  });

  it(`folds away more than ${ONE_ROW}: Pikachu's 15 caps and costumes, without Gigantamax Pikachu`, () => {
    const row = formsRow(readVarieties(pikachu));
    expect(row.folds).toBe(true);
    expect(row.forms).toHaveLength(15);
    expect(row.forms.map(f => f.label)).not.toContain('Gigantamax Pikachu');
    expect(row.forms.map(f => f.label)).not.toContain('Pikachu');
  });
});
