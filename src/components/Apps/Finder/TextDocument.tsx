import React from 'react';
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

/** A document opened from Finder, in its own window, like SimpleText */
const TextDocument: React.FC<{ body: DocBlock[] }> = ({ body }) => (
  <div className="finder-doc-window">
    <div className="finder-doc-page">
      <DocText body={body} />
    </div>
  </div>
);

export default TextDocument;
