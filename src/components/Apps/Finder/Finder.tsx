// React
import React, { useState } from 'react';
// Context
import { useWindows } from '../../../contexts/useWindows';
import { readStored, writeStored } from '../../../contexts/storage';
// The disk, and Back and Forward
import {
  KIND_LABEL,
  PLACES,
  WEB_LINKS,
  findFolder,
  itemCount,
  pathTo,
  type FinderNode
} from './finderFiles';
import { back, canGoBack, canGoForward, current, forward, startHistory, visit, type History } from './finderHistory';
// Parts
import FinderIcon from './FinderIcon';
import TextDocument, { DocText } from './TextDocument';
// Styling
import './Finder.css';

type View = 'icons' | 'list';
const VIEW_KEY = 'macos-1999-finder-view';
const readView = (): View => (readStored(VIEW_KEY) === 'list' ? 'list' : 'icons');

/** What double-clicking does, said on the info pane's button */
const openLabel = (node: FinderNode) =>
  node.kind === 'app' ? `Open ${node.name}` : node.kind === 'link' ? 'Open in a new tab' : 'Open';

/** The info pane: what the chosen item is, or the folder itself when nothing is chosen */
const InfoPane: React.FC<{ node: FinderNode; folderShowing: boolean; onOpen: () => void }> = ({ node, folderShowing, onOpen }) => (
  <aside className={`finder-info${folderShowing ? ' finder-info-folder' : ''}`} aria-label="Info">
    <div className="finder-info-head">
      <FinderIcon node={node} />
      <div className="finder-info-names">
        <h2 className="finder-info-name">{node.name}</h2>
        <p className="finder-info-kind">
          {KIND_LABEL[node.kind]}
          {node.kind === 'folder' && `, ${itemCount(node)}`}
        </p>
      </div>
    </div>
    {node.summary && <p className="finder-info-summary">{node.summary}</p>}

    {node.kind === 'app' && (
      <>
        <p className="finder-info-text">{node.about}</p>
        {node.built.length > 0 && (
          <>
            <h3 className="finder-info-heading">How it's built</h3>
            <ul className="finder-info-list">{node.built.map(line => <li key={line}>{line}</li>)}</ul>
          </>
        )}
        <h3 className="finder-info-heading">Talks to</h3>
        <p className="finder-info-text">{node.services.length ? node.services.join(', ') : 'Nothing outside this browser'}</p>
      </>
    )}
    {node.kind === 'document' && (
      <div className="finder-info-preview">
        <DocText body={node.body} />
      </div>
    )}
    {node.kind === 'link' && <p className="finder-info-url">{node.url.replace(/^https:\/\/(www\.)?/, '')}</p>}

    {!folderShowing && (
      <button type="button" className="mac-button-primary finder-info-open" onClick={onOpen}>
        {openLabel(node)}
      </button>
    )}
  </aside>
);

/**
 * Finder: a window onto a small pretend disk about Alex (finderFiles.ts).
 * Click an item to read about it in the info pane; double-click it (or press
 * Return) to open it: a folder opens here, a document in its own window, a
 * project as the real app, a link in a new tab.
 */
const Finder: React.FC = () => {
  const { windows, openWindow, focusWindow, restoreWindow, showApp } = useWindows();
  const [history, setHistory] = useState<History>(() => startHistory('home'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>(readView);

  const folder = findFolder(current(history));
  const selected = selectedId ? folder.children.find(n => n.id === selectedId) : undefined;
  const path = pathTo(folder.id);

  const go = (next: History) => {
    setHistory(next);
    setSelectedId(null);
  };
  const openFolder = (id: string) => go(visit(history, id));

  const changeView = (next: View) => {
    setView(next);
    writeStored(VIEW_KEY, next);
  };

  const open = (node: FinderNode) => {
    switch (node.kind) {
      case 'folder':
        openFolder(node.id);
        return;
      case 'app':
        showApp(node.app);
        return;
      case 'link':
        window.open(node.url, '_blank', 'noopener,noreferrer');
        return;
      case 'document': {
        // One window per document: opening it again brings that one back
        const already = windows.find(w => !w.appId && w.title === node.name);
        if (!already) openWindow(node.name, <TextDocument body={node.body} />);
        else if (already.minimized) restoreWindow(already.id);
        else focusWindow(already.id);
      }
    }
  };

  // Finder's own keys: ⌘[ and ⌘] for Back and Forward, ⌘↑ for the
  // enclosing folder, ⌘↓ to open the chosen item
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const parent = path.at(-2);
    if (e.key === '[' && canGoBack(history)) go(back(history));
    else if (e.key === ']' && canGoForward(history)) go(forward(history));
    else if (e.key === 'ArrowUp' && parent) openFolder(parent.id);
    else if (e.key === 'ArrowDown' && selected) open(selected);
    else return;
    e.preventDefault();
  };

  return (
    <div className="finder-app" onKeyDown={onKeyDown}>
      <div className="finder-toolbar mac-toolbar">
        <div className="finder-button-group">
          <button type="button" className="finder-tool" aria-label="Back" title="Back" disabled={!canGoBack(history)} onClick={() => go(back(history))}>
            <span aria-hidden="true">◀</span>
          </button>
          <button type="button" className="finder-tool" aria-label="Forward" title="Forward" disabled={!canGoForward(history)} onClick={() => go(forward(history))}>
            <span aria-hidden="true">▶</span>
          </button>
        </div>
        <div className="finder-button-group" role="group" aria-label="View">
          <button type="button" className="finder-tool" aria-label="as Icons" title="as Icons" aria-pressed={view === 'icons'} onClick={() => changeView('icons')}>
            <span aria-hidden="true">▦</span>
          </button>
          <button type="button" className="finder-tool" aria-label="as List" title="as List" aria-pressed={view === 'list'} onClick={() => changeView('list')}>
            <span aria-hidden="true">☰</span>
          </button>
        </div>
        <nav className="finder-path" aria-label="Path">
          {path.map((step, i) => (
            <React.Fragment key={step.id}>
              {i > 0 && <span className="finder-path-arrow" aria-hidden="true">▸</span>}
              {i < path.length - 1 ? (
                <button type="button" className="finder-path-step" onClick={() => openFolder(step.id)}>{step.name}</button>
              ) : (
                <span className="finder-path-step finder-path-here" aria-current="page">{step.name}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="finder-body">
        <nav className="finder-sidebar" aria-label="Places">
          {PLACES.map(place => (
            <button
              key={place.id}
              type="button"
              className={`mac-list-row finder-place${place.id === folder.id ? ' mac-selected' : ''}`}
              aria-current={place.id === folder.id ? 'page' : undefined}
              onClick={() => openFolder(place.id)}
            >
              <FinderIcon node={place} small />
              <span className="finder-place-name">{place.name}</span>
            </button>
          ))}
          <h2 className="finder-sidebar-heading">On the Web</h2>
          {WEB_LINKS.map(link => (
            <a key={link.id} className="mac-list-row finder-place" href={link.url} target="_blank" rel="noopener noreferrer">
              <FinderIcon node={link} small />
              <span className="finder-place-name">{link.name}</span>
            </a>
          ))}
        </nav>

        <div className="finder-main">
          {/* A click on the empty space between items clears the choice */}
          <div className="finder-files" onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
            {view === 'list' && (
              <div className="finder-list-header" aria-hidden="true">
                <span>Name</span>
                <span>Kind</span>
              </div>
            )}
            <ul className={`finder-items finder-items-${view}`} aria-label={folder.name}>
              {folder.children.map(node => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={`finder-item${node.id === selectedId ? ' finder-item-selected' : ''}`}
                    aria-pressed={node.id === selectedId}
                    data-node={node.id}
                    onClick={() => setSelectedId(node.id)}
                    onDoubleClick={() => open(node)}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      setSelectedId(node.id);
                      open(node);
                    }}
                  >
                    <FinderIcon node={node} small={view === 'list'} />
                    <span className="finder-item-name">{node.name}</span>
                    {view === 'list' && <span className="finder-item-kind">{KIND_LABEL[node.kind]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <InfoPane
            key={selected?.id ?? folder.id}
            node={selected ?? folder}
            folderShowing={!selected}
            onOpen={() => selected && open(selected)}
          />
        </div>
      </div>

      <div className="finder-status" role="status">
        {selected ? `1 of ${itemCount(folder)} selected` : itemCount(folder)}
      </div>
    </div>
  );
};

export default Finder;
