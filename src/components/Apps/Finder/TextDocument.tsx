import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DocBlock } from './finderFiles';

/** A document's text: paragraphs, headings and lists. Finder's info pane and the document's own window both use it. */
export const DocText: React.FC<{ body: DocBlock[] }> = ({ body }) => (
  <>
    {body.map((block, i) =>
      'heading' in block ? <h3 key={i} className="finder-doc-heading">{block.heading}</h3>
        : 'text' in block ? <p key={i} className="finder-doc-text">{block.text}</p>
          : <ul key={i} className="finder-doc-list">{block.list.map(item => <li key={item}>{item}</li>)}</ul>
    )}
  </>
);

// The menus' choices. A size is the browser's 1-7 scale for execCommand.
const FONTS = [
  { label: 'Lucida Grande', face: '"Lucida Grande", "Helvetica Neue", sans-serif' },
  { label: 'Monaco', face: 'Monaco, Menlo, monospace' },
  { label: 'Times', face: 'Times, "Times New Roman", serif' },
  { label: 'Chalkboard', face: '"Chalkboard SE", "Comic Sans MS", cursive' }
];
const SIZES = [
  { label: 'Small', size: '2' },
  { label: 'Medium', size: '3' },
  { label: 'Large', size: '5' },
  { label: 'Huge', size: '6' }
];
const STYLES = [
  { command: 'bold', label: 'Bold', glyph: 'B' },
  { command: 'italic', label: 'Italic', glyph: 'I' },
  { command: 'underline', label: 'Underline', glyph: 'U' }
];
const ALIGNS = [
  { command: 'justifyLeft', label: 'Align left' },
  { command: 'justifyCenter', label: 'Centre' },
  { command: 'justifyRight', label: 'Align right' }
];
type Command = (typeof STYLES)[number]['command'] | (typeof ALIGNS)[number]['command'];

/**
 * A document opened from Finder, in its own window, like SimpleText. Its
 * text can be edited and styled with the bar along the top (font, size,
 * bold, italic, underline, alignment); nothing is saved, and Revert puts the
 * text back. Styling goes through document.execCommand: deprecated, but
 * still in every browser, and nothing else styles a selection without a
 * whole editor library (system-map, finder.md).
 */
const TextDocument: React.FC<{ body: DocBlock[] }> = ({ body }) => {
  const pageRef = useRef<HTMLDivElement>(null);
  // The selection in the page, kept so a menu (which takes the focus) can
  // style what was selected before it opened
  const savedRange = useRef<Range | null>(null);
  const [edition, setEdition] = useState(0);
  const [on, setOn] = useState<Partial<Record<Command, boolean>>>({});
  const [edited, setEdited] = useState(false);

  const readState = useCallback(() => {
    const state: Partial<Record<Command, boolean>> = {};
    for (const { command } of [...STYLES, ...ALIGNS]) {
      try { state[command] = document.queryCommandState(command); } catch { state[command] = false; }
    }
    setOn(state);
  }, []);

  // Follow the selection, only while it is in this page
  useEffect(() => {
    const onSelection = () => {
      const selection = document.getSelection();
      const page = pageRef.current;
      if (!selection || !selection.rangeCount || !page || !page.contains(selection.anchorNode)) return;
      savedRange.current = selection.getRangeAt(0).cloneRange();
      readState();
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, [readState]);

  const run = (command: string, value?: string) => {
    const page = pageRef.current;
    if (!page) return;
    page.focus();
    const selection = document.getSelection();
    if (savedRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
    document.execCommand(command, false, value);
    setEdited(true);
    readState();
  };

  const revert = () => {
    savedRange.current = null;
    setEdited(false);
    setOn({});
    setEdition(n => n + 1);
  };

  // A button keeps the page's selection: pressing it mustn't take the focus
  const keepSelection = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

  return (
    <div className="finder-doc-window">
      <div className="finder-doc-bar mac-toolbar" role="toolbar" aria-label="Format">
        <select
          className="finder-doc-menu"
          aria-label="Font"
          value=""
          onChange={e => e.target.value && run('fontName', e.target.value)}
        >
          <option value="">Font</option>
          {FONTS.map(f => <option key={f.label} value={f.face}>{f.label}</option>)}
        </select>
        <select
          className="finder-doc-menu"
          aria-label="Size"
          value=""
          onChange={e => e.target.value && run('fontSize', e.target.value)}
        >
          <option value="">Size</option>
          {SIZES.map(s => <option key={s.label} value={s.size}>{s.label}</option>)}
        </select>
        <div className="finder-doc-group">
          {STYLES.map(s => (
            <button
              key={s.command}
              type="button"
              className={`finder-doc-tool finder-doc-${s.command}`}
              aria-label={s.label}
              title={s.label}
              aria-pressed={!!on[s.command]}
              onPointerDown={keepSelection}
              onMouseDown={keepSelection}
              onClick={() => run(s.command)}
            >
              {s.glyph}
            </button>
          ))}
        </div>
        <div className="finder-doc-group">
          {ALIGNS.map(a => (
            <button
              key={a.command}
              type="button"
              className="finder-doc-tool"
              aria-label={a.label}
              title={a.label}
              aria-pressed={!!on[a.command]}
              onPointerDown={keepSelection}
              onMouseDown={keepSelection}
              onClick={() => run(a.command)}
            >
              <span className={`finder-doc-align finder-doc-${a.command}`} aria-hidden="true" />
            </button>
          ))}
        </div>
        <button type="button" className="finder-doc-revert" disabled={!edited} onClick={revert} title="Put the text back as it was">
          Revert
        </button>
      </div>

      <div
        key={edition}
        ref={pageRef}
        className="finder-doc-page"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label="Document"
        onInput={() => setEdited(true)}
      >
        <DocText body={body} />
      </div>
    </div>
  );
};

export default TextDocument;
