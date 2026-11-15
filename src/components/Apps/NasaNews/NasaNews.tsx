import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
import './NasaNews.css';
import { fetchApod, type ApodData } from './apod';
import {
  FIRST_APOD,
  fetchApodDate,
  fetchApodDay,
  fetchApodPage,
  fetchedApodDay,
  mergeDays,
  todayInEastern,
  type ApodDay
} from './apodDays';

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

/** In a narrow window the list slides over the picture (NasaNews.css), covering the ☰ */
const coversPicture = (sidebar: HTMLElement | null) =>
  Boolean(sidebar && getComputedStyle(sidebar).position === 'absolute');

/** One day's picture or video, its explanation and credit: the same layout for today and any past day */
const ApodView: React.FC<{ apodData: ApodData }> = ({ apodData }) => {
  const isDirectVideo = Boolean(
    apodData.url &&
    (
      apodData.url.endsWith('.mp4') ||
      apodData.url.endsWith('.webm') ||
      apodData.url.endsWith('.ogg') ||
      apodData.url.endsWith('.mov') ||
      apodData.url.endsWith('.m4v') ||
      apodData.url.includes('.mp4?')
    )
  );

  return (
    <>
      <div className="apod-container">
        <h3 className="apod-title">{apodData.title}</h3>
        <p className="apod-date">{apodData.date}</p>

        {apodData.media_type === 'image' ? (
          <div className="apod-image-container">
            <img
              src={apodData.url}
              alt={apodData.alt || apodData.title}
              className="apod-image"
              onError={(e) => {
                // The web-size copy is missing now and then; try the full size
                const target = e.target as HTMLImageElement;
                if (apodData.hdurl && target.src !== apodData.hdurl) {
                  target.src = apodData.hdurl;
                }
              }}
            />
            {apodData.hdurl && (
              <div className="button-row">
                <a href={apodData.hdurl} target="_blank" rel="noopener noreferrer" className="download-link">
                  Open Full Resolution Original ↗
                </a>
              </div>
            )}
          </div>
        ) : apodData.media_type === 'video' ? (
          <div className="apod-video-container">
            {isDirectVideo ? (
              <video
                src={apodData.url}
                controls
                playsInline
                className="apod-video"
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <iframe
                src={apodData.url}
                title={apodData.title}
                className="apod-video"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
          </div>
        ) : null}

        <p className="apod-explanation">{apodData.explanation}</p>

        {apodData.credit && <p className="apod-copyright">{apodData.credit}</p>}
      </div>

      <div className="nasa-links">
        <h4>More NASA Content:</h4>
        <ul>
          {apodData.link && (
            <li><a href={apodData.link} target="_blank" rel="noopener noreferrer">This picture on NASA Science</a></li>
          )}
          <li><a href="https://www.nasa.gov" target="_blank" rel="noopener noreferrer">NASA Official Website</a></li>
          <li><a href="https://science.nasa.gov/apod/archive/" target="_blank" rel="noopener noreferrer">APOD Archive</a></li>
          <li><a href="https://www.nasa.gov/image-of-the-day/" target="_blank" rel="noopener noreferrer">NASA Image of the Day</a></li>
          <li><a href="https://science.nasa.gov/mars/" target="_blank" rel="noopener noreferrer">Mars Exploration Program</a></li>
        </ul>
      </div>
    </>
  );
};

/** A row's small picture, or a star when the day has none (or it won't load) */
const Thumb: React.FC<{ src?: string; lazy?: boolean }> = ({ src, lazy = true }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="nasa-thumb nasa-thumb-none" aria-hidden="true">✦</span>;
  return <img className="nasa-thumb" src={src} alt="" loading={lazy ? 'lazy' : 'eager'} onError={() => setFailed(true)} />;
};

interface DayRowProps {
  label: string;
  title: string;
  thumb?: string;
  current: boolean;
  today?: boolean;
  onPick: () => void;
}

const DayRow: React.FC<DayRowProps> = ({ label, title, thumb, current, today = false, onPick }) => (
  <button
    type="button"
    className={`mac-list-row nasa-day${today ? ' nasa-day-today' : ''}${current ? ' mac-selected' : ''}`}
    aria-current={current ? 'true' : undefined}
    onClick={onPick}
  >
    {/* Today's row reuses the picture already on screen, so it needn't wait to be scrolled to */}
    <Thumb src={thumb} lazy={!today} />
    <span className="nasa-day-text">
      <span className="nasa-day-date">{label}</span>
      <span className="nasa-day-title">{title}</span>
    </span>
  </button>
);

/** One list of days: the plain list, or a search's results */
interface DayList {
  days: ApodDay[];
  pagesLoaded: number;
  totalPages: number | null;
  /** How many days in all (a search shows it) */
  total: number | null;
  busy: boolean;
  error: string | null;
}

const NEW_LIST: DayList = { days: [], pagesLoaded: 0, totalPages: null, total: null, busy: false, error: null };

/** A day on show instead of today: a row picked from a list (with its id), or a date picked */
interface Pick {
  date: string;
  id?: number;
  link?: string;
}

const NasaNews: React.FC = () => {
  // Today's picture, fetched when the app opens
  const [apodData, setApodData] = useState<ApodData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // The sidebar. Its lists are fetched a page at a time as they scroll,
  // starting when it first opens. The plain list is under '', and the search
  // on show under its words; a reply for a search since replaced finds no
  // list to go in, and is dropped
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lists, setLists] = useState<Record<string, DayList>>({ '': NEW_LIST });
  const [query, setQuery] = useState(''); // as typed
  const [search, setSearch] = useState(''); // the search on show, once typing pauses
  const [dateValue, setDateValue] = useState('');
  const onTheWay = useRef(new Set<string>());
  const searchTimer = useRef<number | undefined>(undefined);
  const dateTimer = useRef<number | undefined>(undefined);

  // The past day on show; null means today
  const [picked, setPicked] = useState<Pick | null>(null);
  const [pickedData, setPickedData] = useState<ApodData | null>(null);
  const [pickedError, setPickedError] = useState<string | null>(null);
  // Each pick takes a ticket; a reply for an older ticket arrived too late and is dropped
  const pickTicket = useRef(0);
  const mounted = useRef(true);

  const sidebarId = useId();
  const sidebarRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(searchTimer.current);
      window.clearTimeout(dateTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchApod()
      .then(data => {
        if (!cancelled) setApodData(data);
      })
      .catch(err => {
        if (!cancelled) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Fetch one more page of a list ('' or a search); never two at once for one list */
  const loadPage = useCallback((key: string, page: number) => {
    if (onTheWay.current.has(key)) return;
    onTheWay.current.add(key);
    const update = (change: (list: DayList) => DayList) =>
      setLists(all => (all[key] ? { ...all, [key]: change(all[key]) } : all));
    update(list => ({ ...list, busy: true, error: null }));
    fetchApodPage(page, key)
      .then(result => {
        onTheWay.current.delete(key);
        if (!mounted.current) return;
        update(list => ({
          days: mergeDays(list.days, result.days),
          pagesLoaded: result.page,
          totalPages: result.totalPages,
          total: result.total,
          busy: false,
          error: null
        }));
      })
      .catch(err => {
        onTheWay.current.delete(key);
        if (mounted.current) update(list => ({ ...list, busy: false, error: messageOf(err) }));
      });
  }, []);

  const list = lists[search] ?? NEW_LIST;
  const hasMore = list.totalPages === null || list.pagesLoaded < list.totalPages;

  // Load the next page when the end of the list scrolls within 200px of view.
  // A new observer reports straight away whether the end is already in view,
  // so making one after each page re-checks: a short list fills a page at a
  // time, never in a burst. It's off while the sidebar is shut, while a page
  // is on its way, and after an error (Try again takes over).
  useEffect(() => {
    const root = scrollRef.current;
    const end = listEndRef.current;
    if (!sidebarOpen || !hasMore || list.busy || list.error || !root || !end) return;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        loadPage(search, list.pagesLoaded + 1);
      },
      { root, rootMargin: '0px 0px 200px 0px' }
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [sidebarOpen, hasMore, list.busy, list.error, list.pagesLoaded, search, loadPage]);

  // When the list slides over the ☰, move the keyboard to the list's own close button
  useEffect(() => {
    if (sidebarOpen && coversPicture(sidebarRef.current)) closeRef.current?.focus({ preventScroll: true });
  }, [sidebarOpen]);

  const closeSidebar = () => {
    const covered = coversPicture(sidebarRef.current);
    setSidebarOpen(false);
    if (covered) toggleRef.current?.focus({ preventScroll: true });
  };

  /** Show the results for some words, or the plain list again ('') */
  const runSearch = (words: string) => {
    setSearch(words);
    // Keep the plain list's pages; let go of any other search's
    setLists(all => ({ '': all[''], ...(words ? { [words]: all[words] ?? NEW_LIST } : {}) }));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  /** Typing searches once it pauses (400 ms); clearing goes back at once */
  const changeQuery = (value: string) => {
    setQuery(value);
    window.clearTimeout(searchTimer.current);
    const words = value.trim();
    if (!words) runSearch('');
    else searchTimer.current = window.setTimeout(() => runSearch(words), 400);
  };

  /** Show a past day, or today (null) */
  const show = (pick: Pick | null) => {
    const ticket = ++pickTicket.current;
    if (coversPicture(sidebarRef.current)) closeSidebar();
    if (mainRef.current) mainRef.current.scrollTop = 0;
    // The date box shows the past day on show, and is empty for today
    setDateValue(pick?.date ?? '');
    setPicked(pick);
    setPickedError(null);
    const have = pick?.id !== undefined ? fetchedApodDay(pick.id) : undefined;
    setPickedData(have ?? null);
    if (!pick || have) return;
    (pick.id !== undefined ? fetchApodDay(pick.id) : fetchApodDate(pick.date))
      .then(data => {
        if (mounted.current && ticket === pickTicket.current) setPickedData(data);
      })
      .catch(err => {
        if (mounted.current && ticket === pickTicket.current) setPickedError(messageOf(err));
      });
  };

  const latest = todayInEastern();

  /** A date picked or typed: go there once it settles (400 ms), if it's one APOD has */
  const changeDate = (value: string) => {
    setDateValue(value);
    window.clearTimeout(dateTimer.current);
    // While a year is half typed the box holds dates like 0199-06-20: wait for a real one
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < FIRST_APOD || value > latest) return;
    dateTimer.current = window.setTimeout(() => show(value === apodData?.date ? null : { date: value }), 400);
  };

  // Today has its own row at the top of the plain list, so leave it out below
  const rows = search ? list.days : list.days.filter(day => day.date !== apodData?.date);

  let body: React.ReactNode;
  if (picked) {
    body = pickedError ? (
      <div className="nasa-status nasa-status-error">
        {pickedError}
        {picked.link && (
          <a className="nasa-day-link" href={picked.link} target="_blank" rel="noopener noreferrer">
            See {picked.date} on NASA Science ↗
          </a>
        )}
      </div>
    ) : pickedData ? (
      <ApodView key={picked.date} apodData={pickedData} />
    ) : (
      <p className="nasa-status">Loading {picked.date}...</p>
    );
  } else if (loading) {
    body = <p className="nasa-status">Loading NASA data...</p>;
  } else if (error) {
    body = <p className="nasa-status nasa-status-error">{error}</p>;
  } else if (!apodData) {
    body = <p className="nasa-status">No data available</p>;
  } else {
    body = <ApodView key="today" apodData={apodData} />;
  }

  return (
    <div className="nasa-app">
      <nav
        id={sidebarId}
        ref={sidebarRef}
        className={`nasa-sidebar${sidebarOpen ? ' nasa-sidebar-open' : ''}`}
        aria-label="Past days"
      >
        <div className="nasa-sidebar-top">
          <div className="nasa-sidebar-header">
            {/* Only in a narrow window, where the list covers the ☰ on the page */}
            <button
              ref={closeRef}
              type="button"
              className="nasa-gel-button nasa-sidebar-close"
              aria-label="Hide past days"
              title="Hide past days"
              onClick={closeSidebar}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <span aria-hidden="true">▼</span> Past Days
          </div>

          <div className="nasa-search">
            <input
              ref={searchRef}
              type="search"
              className="mac-field nasa-search-field"
              placeholder="Search titles and text"
              aria-label="Search past days"
              value={query}
              onChange={e => changeQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && query) {
                  e.preventDefault();
                  changeQuery('');
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="nasa-search-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => {
                  changeQuery('');
                  searchRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
          </div>

          <label className="nasa-date">
            <span>Go to</span>
            <input
              type="date"
              className="mac-field nasa-date-field"
              min={FIRST_APOD}
              max={latest}
              value={dateValue}
              title={`Any day from ${FIRST_APOD} to ${latest}`}
              onChange={e => changeDate(e.target.value)}
            />
          </label>
        </div>

        <div className="nasa-day-scroll" ref={scrollRef}>
          {search && list.pagesLoaded > 0 && (
            <p className="nasa-result-count" role="status">
              {list.total === 0 || (list.total === null && rows.length === 0)
                ? `No days match “${search}”.`
                : `${(list.total ?? rows.length).toLocaleString('en-US')} ${list.total === 1 ? 'day' : 'days'}`}
            </p>
          )}
          <ul className="nasa-day-list">
            {!search && (
              <li>
                <DayRow
                  label="Today"
                  title={apodData?.title ?? (loading ? 'Loading...' : "Today's picture")}
                  thumb={apodData?.media_type === 'image' ? apodData.url : undefined}
                  current={picked === null}
                  today
                  onPick={() => show(null)}
                />
              </li>
            )}
            {rows.map(day => (
              <li key={day.id}>
                <DayRow
                  label={day.date}
                  title={day.title}
                  thumb={day.thumb}
                  current={picked?.date === day.date}
                  onPick={() => show({ date: day.date, id: day.id, link: day.link })}
                />
              </li>
            ))}
          </ul>

          {/* When this nears the bottom of the sidebar, the next page loads */}
          <div ref={listEndRef} className="nasa-list-end" />
          {list.error ? (
            <div className="mac-message mac-message-error nasa-list-note">
              <p>{list.error}</p>
              <button type="button" onClick={() => loadPage(search, list.pagesLoaded + 1)}>Try again</button>
            </div>
          ) : list.busy ? (
            <p className="mac-message nasa-list-note">Loading...</p>
          ) : hasMore || rows.length === 0 ? null : (
            <p className="mac-message nasa-list-note">
              {search ? "That's every match." : `That's every day, back to ${list.days[list.days.length - 1]?.date}.`}
            </p>
          )}
        </div>
      </nav>

      {/* Behind the sliding list in a narrow window: a tap here closes it */}
      {sidebarOpen && <div className="nasa-scrim" aria-hidden="true" onClick={closeSidebar} />}

      <div className="nasa-main" ref={mainRef}>
        <div className="nasa-container">
          <div className="nasa-heading-row">
            <button
              ref={toggleRef}
              type="button"
              className="nasa-gel-button nasa-sidebar-toggle"
              aria-expanded={sidebarOpen}
              aria-controls={sidebarId}
              aria-label="Past days"
              title="Past days"
              onClick={() => (sidebarOpen ? closeSidebar() : setSidebarOpen(true))}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <h2 className="nasa-title">NASA Astronomy Picture of the Day</h2>
          </div>
          {body}
        </div>
      </div>
    </div>
  );
};

export default NasaNews;
