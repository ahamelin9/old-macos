// Finder: the pretend disk about Alex (src/components/Apps/Finder/), at the
// three sizes every app must work at: the 400x300 window it opens in, that
// window maximized on a laptop, and a 390px phone.
//
//   node .claude/skills/know-how/finder-check.mjs <appUrl> <outDir>
//
// At each size it checks:
//  - it opens on Alex's home folder, with Back and Forward off and nothing
//    running sideways out of the window; the toolbar's symbols are drawn,
//    not typed (a phone shows ◀ and ▶ as emoji); the sidebar shows, but
//    not on a phone, where the icons get the room;
//  - double-clicking Projects opens it here: the path, the status line and
//    Back follow; Back, Forward, ⌘[ and the path's own steps move about;
//  - a click on a project shows its note in the info pane, with an Open
//    button named for the app; the info pane sits beside the items in a wide
//    window and under them in a narrow one, only once something is chosen;
//  - Return on About Me.txt opens it in its own window, and again brings the
//    same window back rather than a second;
//  - the document's formatting bar fits the window, and Bold, Centre and
//    Huge style the selected text; Revert puts it back;
//  - as List shows each item's kind, and the choice is remembered;
//  - opening macOS 1999 opens About This Mac, and Calculator (in Utilities)
//    opens Calculator: the projects open the real apps;
//  - a link opens its page in a new tab.
// It needs no outside service: Finder calls none, and the two apps it opens
// call none either.
import { launch } from './cdp.mjs';

const [appUrl, outDir] = process.argv.slice(2);
if (!appUrl || !outDir) throw new Error('usage: finder-check.mjs <appUrl> <outDir>');

const win = (title) => `[...document.querySelectorAll('.window')].find(w => w.querySelector('.window-title')?.textContent === ${JSON.stringify(title)})`;
const front = `[...document.querySelectorAll('.window:not(.window-minimized)')].sort((a, b) => (+b.style.zIndex) - (+a.style.zIndex))[0]`;
const frontTitle = `${front}?.querySelector('.window-title')?.textContent`;
const app = `${win('Finder')}.querySelector('.finder-app')`;
const item = (id) => `${app}.querySelector('[data-node="${id}"]')`;
const count = (title) => `[...document.querySelectorAll('.window-title')].filter(e => e.textContent === ${JSON.stringify(title)}).length`;
const path = `[...${app}.querySelectorAll('.finder-path-step')].map(e => e.textContent).join(' > ')`;
const status = `${app}.querySelector('.finder-status').textContent`;
const tool = (label) => `${app}.querySelector('[aria-label="${label}"]')`;
const dblclick = (id) => `${item(id)}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`;
const key = (target, k, meta = false) =>
  `${target}.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, metaKey: ${meta}, bubbles: true, cancelable: true }))`;
const focusFinder = `${win('Finder')}.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`;

const sizes = [
  { name: 'laptop-small', width: 1400, height: 900, maximize: false },
  { name: 'laptop-max', width: 1400, height: 900, maximize: true },
  { name: 'phone', width: 390, height: 844, maximize: false }
];

for (const size of sizes) {
  const t = await launch(appUrl, outDir, { width: size.width, height: size.height });
  const step = (s) => `${size.name}: ${s}`;
  try {
    // Record links instead of opening them
    await t.ev(`window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }`);
    await t.openApp('Finder');
    if (size.maximize) await t.ev(`${win('Finder')}.querySelector('.window-maximize').click()`);
    await t.settle();

    // ---- Home
    const home = await t.ev(`(() => {
      const a = ${app}, files = a.querySelector('.finder-files');
      return {
        items: [...a.querySelectorAll('.finder-item-name')].map(e => e.textContent).join(),
        back: ${tool('Back')}.disabled, forward: ${tool('Forward')}.disabled,
        sideways: a.scrollWidth > a.clientWidth + 1 || files.scrollWidth > files.clientWidth + 1,
        sidebar: getComputedStyle(a.querySelector('.finder-sidebar')).display !== 'none',
        typed: /[◀▶▦☰]/.test(a.querySelector('.finder-toolbar').textContent),
        glyphs: [...a.querySelectorAll('.finder-tool-glyph')].every(g => g.getBoundingClientRect().width >= 8),
        icons: a.querySelectorAll('.finder-item .finder-icon').length
      };
    })()`);
    t.check(step('opens on Alex\'s home folder'),
      home.items === 'About Me.txt,Projects,Skills.txt,Interests.txt,LinkedIn,GitHub' && (await t.ev(path)) === 'Alex' && (await t.ev(status)) === '6 items', home.items);
    t.check(step('Back and Forward start off'), home.back && home.forward);
    t.check(step('every item has an icon, and nothing runs sideways'), home.icons === 6 && !home.sideways, JSON.stringify(home));
    t.check(step('the toolbar\'s symbols are drawn, not typed'), !home.typed && home.glyphs);
    const phone = size.width < 500;
    t.check(step(phone ? 'phone: no sidebar, so the icons get the room' : 'the sidebar of places shows'), home.sidebar === !phone);
    const narrow = await t.ev(`getComputedStyle(${app}.querySelector('.finder-main')).flexDirection === 'column'`);
    t.check(step('the layout is the one this width should have'), narrow === !size.maximize);
    t.check(step(narrow ? 'narrow: no info pane until something is chosen' : 'wide: the info pane shows the folder'),
      (await t.ev(`getComputedStyle(${app}.querySelector('.finder-info')).display === 'none'`)) === narrow);

    // ---- Into Projects, and about
    await t.ev(dblclick('projects'));
    await t.settle();
    t.check(step('double-clicking Projects opens it here'),
      (await t.ev(path)) === 'Alex > Projects' && (await t.ev(status)) === '8 items' && !(await t.ev(`${tool('Back')}.disabled`)), await t.ev(path));
    t.check(step('the sidebar marks Projects'), (await t.ev(`${app}.querySelector('.finder-place.mac-selected')?.textContent`)) === 'Projects');
    await t.ev(`${tool('Back')}.click()`);
    await t.settle();
    t.check(step('Back goes home'), (await t.ev(path)) === 'Alex' && !(await t.ev(`${tool('Forward')}.disabled`)));
    await t.ev(`${tool('Forward')}.click()`);
    await t.settle();
    t.check(step('Forward goes to Projects again'), (await t.ev(path)) === 'Alex > Projects');
    await t.ev(key(app, '[', true));
    await t.settle();
    t.check(step('⌘[ goes back'), (await t.ev(path)) === 'Alex');
    await t.ev(`${app}.querySelector('.finder-place:nth-child(3)').click()`);
    await t.settle();
    t.check(step('the sidebar opens Utilities (a phone hides it, but it still works)'), (await t.ev(path)) === 'Alex > Projects > Utilities');
    await t.ev(`[...${app}.querySelectorAll('button.finder-path-step')].find(b => b.textContent === 'Projects').click()`);
    await t.settle();
    t.check(step('a step in the path opens that folder'), (await t.ev(path)) === 'Alex > Projects');

    // ---- A project's note
    await t.ev(`${item('project-planes')}.click()`);
    await t.settle();
    const info = await t.ev(`(() => {
      const i = ${app}.querySelector('.finder-info'), f = ${app}.querySelector('.finder-files');
      const ir = i.getBoundingClientRect(), fr = f.getBoundingClientRect(), w = ${win('Finder')}.getBoundingClientRect();
      return {
        name: i.querySelector('.finder-info-name')?.textContent, button: i.querySelector('.finder-info-open')?.textContent,
        built: i.querySelectorAll('.finder-info-list li').length, talks: /adsb\\.lol/.test(i.innerText),
        below: ir.top >= fr.bottom - 1, beside: ir.left >= fr.right - 1,
        inside: ir.right <= w.right + 1 && ir.bottom <= w.bottom + 1, height: Math.round(ir.height)
      };
    })()`);
    t.check(step('a click on Planes shows its note, with how it\'s built and what it talks to'),
      info.name === 'Planes' && info.built >= 3 && info.talks, JSON.stringify(info));
    t.check(step('…and an Open button named for it'), info.button === 'Open Planes');
    t.check(step(narrow ? 'narrow: the note sits under the items' : 'wide: the note sits beside the items'),
      (narrow ? info.below : info.beside) && info.inside && info.height >= 60, JSON.stringify(info));
    t.check(step('the status line says one is chosen'), (await t.ev(status)) === '1 of 8 items selected');
    await t.ev(`${app}.querySelector('.finder-files').click()`);
    await t.settle();
    t.check(step('a click on the empty space clears the choice'), (await t.ev(status)) === '8 items');
    await t.shot(`${size.name}-projects.png`);

    // ---- A project opens the real app
    await t.ev(dblclick('project-macos'));
    await t.settle();
    t.check(step('macOS 1999 opens About This Mac, in front'), (await t.ev(frontTitle)) === 'About This Mac');
    await t.ev(focusFinder);
    await t.ev(dblclick('utilities'));
    await t.settle();
    await t.ev(`${item('project-calculator')}.click()`);
    await t.settle();
    await t.ev(`${app}.querySelector('.finder-info-open').click()`);
    await t.settle();
    t.check(step('Calculator\'s Open button opens Calculator, in front'), (await t.ev(frontTitle)) === 'Calculator' && (await t.ev(count('Calculator'))) === 1);

    // ---- A document opens in its own window, once
    await t.ev(focusFinder);
    await t.ev(`${app}.querySelector('.finder-place').click()`);
    await t.settle();
    await t.ev(key(item('doc-about'), 'Enter'));
    await t.settle();
    t.check(step('Return on About Me.txt opens it in its own window'),
      (await t.ev(frontTitle)) === 'About Me.txt' && /Alex Hamelin/.test(await t.ev(`${win('About Me.txt')}.innerText`)));
    await t.ev(focusFinder);
    await t.ev(dblclick('doc-about'));
    await t.settle();
    t.check(step('opening it again brings back the same window'), (await t.ev(count('About Me.txt'))) === 1 && (await t.ev(frontTitle)) === 'About Me.txt');

    // ---- Formatting the document
    const doc = `${win('About Me.txt')}.querySelector('.finder-doc-window')`;
    const page = `${doc}.querySelector('.finder-doc-page')`;
    const bar = await t.ev(`(() => {
      const b = ${doc}.querySelector('.finder-doc-bar'), w = ${win('About Me.txt')}.getBoundingClientRect();
      return { fits: b.scrollWidth <= b.clientWidth + 1 && [...b.children].every(c => c.getBoundingClientRect().right <= w.right + 1),
        editable: ${page}.isContentEditable, revert: ${doc}.querySelector('.finder-doc-revert').disabled };
    })()`);
    t.check(step('the document has a formatting bar that fits its window, over text you can edit'), bar.fits && bar.editable && bar.revert, JSON.stringify(bar));
    // Select the first paragraph
    await t.ev(`(() => { const r = document.createRange(); r.selectNodeContents(${page}.querySelector('p')); const s = document.getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
    await t.settle();
    await t.ev(`${doc}.querySelector('[aria-label="Bold"]').click()`);
    await t.ev(`${doc}.querySelector('[aria-label="Centre"]').click()`);
    await t.ev(`(() => { const m = ${doc}.querySelector('[aria-label="Size"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(m, '6');
      m.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await t.settle();
    const styled = await t.ev(`(() => {
      const p = ${page}.querySelector('p'), b = p.querySelector('b, strong, [style*="bold"]');
      return { bold: !!b, centred: getComputedStyle(p).textAlign === 'center' || getComputedStyle(${page}.firstElementChild).textAlign === 'center',
        huge: !!${page}.querySelector('font[size="6"]'), pressed: ${doc}.querySelector('[aria-label="Bold"]').getAttribute('aria-pressed'),
        others: !${page}.querySelectorAll('p')[1].querySelector('b, strong'), revert: ${doc}.querySelector('.finder-doc-revert').disabled };
    })()`);
    t.check(step('Bold, Centre and Huge style the selected text, and only it'), styled.bold && styled.centred && styled.huge && styled.others, JSON.stringify(styled));
    t.check(step('Bold shows as pressed, and Revert comes on'), styled.pressed === 'true' && !styled.revert, JSON.stringify(styled));
    await t.ev(`${doc}.querySelector('.finder-doc-revert').click()`);
    await t.settle();
    t.check(step('Revert puts the text back'),
      await t.ev(`!${page}.querySelector('b, strong, font') && getComputedStyle(${page}.querySelector('p')).textAlign !== 'center' && /Alex Hamelin/.test(${page}.innerText) && ${doc}.querySelector('.finder-doc-revert').disabled`));
    await t.shot(`${size.name}-document.png`);

    // ---- A link opens in a new tab
    await t.ev(focusFinder);
    await t.ev(dblclick('link-github'));
    t.check(step('GitHub opens its page in a new tab'), (await t.ev('window.__opened.join()')) === 'https://github.com/ahamelin9');

    // ---- As List
    await t.ev(`${tool('as List')}.click()`);
    await t.settle();
    const list = await t.ev(`(() => {
      const a = ${app}, files = a.querySelector('.finder-files');
      return {
        kinds: [...a.querySelectorAll('.finder-item-kind')].map(e => e.textContent),
        pressed: ${tool('as List')}.getAttribute('aria-pressed'),
        sideways: files.scrollWidth > files.clientWidth + 1,
        saved: localStorage.getItem('macos-1999-finder-view')
      };
    })()`);
    t.check(step('as List shows each item\'s kind'), list.kinds.length === 6 && list.kinds[1] === 'Folder' && list.kinds[4] === 'Internet location', list.kinds.join());
    t.check(step('…fits the window, and is remembered'), !list.sideways && list.pressed === 'true' && list.saved === 'list', JSON.stringify(list));
    await t.shot(`${size.name}-list.png`);
  } catch (e) { t.check(step('script'), false, e.message); }
  finally { t.finish(); t.close(); }
}
