import { describe, expect, it } from 'vitest';
import { checkCss, checkScript, parseCss } from './design-check.mjs';

const APP = 'src/components/Apps/Notes/Notes.css';
const problems = (css, rel = APP) => checkCss(rel, css).map(p => p.text);

describe('parseCss', () => {
  it('finds rules inside at-rules, with line numbers', () => {
    const { rules, keyframes } = parseCss('.a { color: red; }\n@media (max-width: 1px) {\n  .b { top: 0 }\n}\n@keyframes spin { from { x: 1 } }');
    expect(rules.map(r => [r.selector, r.line])).toEqual([['.a', 1], ['.b', 3]]);
    expect(rules[1].decls).toEqual([{ prop: 'top', value: '0', line: 3, exception: false }]);
    expect(keyframes.map(k => k.name)).toEqual(['spin']);
  });
});

describe('checkCss', () => {
  it('passes a stylesheet built from tokens', () => {
    expect(problems('.notes-window { color: var(--color-text); font: inherit; font-size: var(--text-md); border-radius: var(--radius) 0; box-shadow: 0 1px 2px var(--black-a20); }')).toEqual([]);
  });

  it('flags raw colours, including named ones and colours inside gradients', () => {
    expect(problems('.notes-a { color: #333; } .notes-b { background: linear-gradient(white, rgba(0,0,0,.2)); } .notes-c { border: 1px solid red; }')).toHaveLength(3);
  });

  it('leaves words that only contain a colour name alone', () => {
    expect(problems('.notes-a { filter: grayscale(100%); white-space: nowrap; background: url(red.png); content: "black"; }')).toEqual([]);
  });

  it('allows raw values only in the app\'s own palette', () => {
    expect(problems('.notes-window { --notes-paper: #fffff0; --color-text: #000; }')).toEqual(['--color-text: #000']);
  });

  it('flags raw fonts, sizes, corners and !important', () => {
    expect(problems('.notes-a { font-family: Arial; font-size: 12px; border-radius: 4px; color: var(--color-text) !important; }')).toHaveLength(4);
  });

  it('wants every selector to start with the app\'s class', () => {
    expect(problems('.notes-a .x, .loading, button.notes-b, .notes-c:hover { top: 0 }')).toEqual(['.loading', 'button.notes-b']);
  });

  it('wants keyframe names prefixed', () => {
    expect(problems('@keyframes spin { from { opacity: 0 } }')).toEqual(['@keyframes spin']);
  });

  it('lets only base.css style bare elements, and skips tokens.css entirely', () => {
    expect(problems('button { padding: 0 }', 'src/styles/base.css')).toEqual([]);
    expect(problems(':root { --grey-0: #000; }', 'src/styles/tokens.css')).toEqual([]);
  });

  it('respects a design-exception comment', () => {
    expect(problems('.notes-a {\n  color: #f00; /* design-exception: matches the Spotify logo */\n}')).toEqual([]);
  });

  it('asks for a PREFIXES entry for a new stylesheet', () => {
    expect(problems('.x { top: 0 }', 'src/components/Apps/New/New.css')).toContain('stylesheet has no entry in PREFIXES');
  });
});

describe('checkScript', () => {
  it('flags every colour string, but not other strings or marked lines', () => {
    expect(checkScript('x.tsx', `style={{ color: '#ff4444', background: "rgba(0,0,0,0.1)" }}\nconst id = '#main';\nconst c = '#1DB954'; // design-exception: Spotify green`).map(p => p.text))
      .toEqual(['#ff4444', 'rgba(0,0,0,0.1)']);
  });
});
