// React
import React, { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long the screen takes to go dark and to come back: Sleep dims slowly, Restart a little faster */
const FADE_IN_MS = { sleep: 1000, restart: 600 };
const FADE_OUT_MS = 400;

/**
 * The click that follows a press which woke the screen: caught before any
 * window sees it, so waking never also clicks whatever is underneath (the
 * screen may already be gone by then, at once with reduced motion)
 */
const swallowNextClick = () => {
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    done();
  };
  const done = () => {
    window.removeEventListener('click', swallow, true);
    window.clearTimeout(timer);
  };
  window.addEventListener('click', swallow, true);
  const timer = window.setTimeout(done, 1000);
};

/**
 * The screen going dark, over everything. For Sleep, pass `onWake`: any
 * click, key or tap fades it back in, and then onWake removes it. That
 * first key or click is swallowed, so it doesn't also type into a window.
 * For Restart, pass `onDark`, called once the screen is black (it reloads).
 * With reduced motion it goes dark and comes back at once.
 */
const SleepScreen: React.FC<{ onWake?: () => void; onDark?: () => void }> = ({ onWake, onDark }) => {
  const [waking, setWaking] = useState(false);
  const screen = useRef<HTMLDivElement>(null);
  const fadeIn = onWake ? FADE_IN_MS.sleep : FADE_IN_MS.restart;
  // The latest callbacks, for the effects below, which run once
  const callbacks = useRef({ onWake, onDark });
  useEffect(() => {
    callbacks.current = { onWake, onDark };
  });

  useEffect(() => {
    const timer = window.setTimeout(() => callbacks.current.onDark?.(), reducedMotion() ? 0 : fadeIn);
    return () => window.clearTimeout(timer);
  }, [fadeIn]);

  // Wake on any key (caught before any window sees it) or any press on the
  // screen, which covers the whole page. The key or click that chose Sleep
  // came before this, so it can't wake it straight away.
  const canWake = Boolean(onWake);
  useEffect(() => {
    if (!canWake) return;
    const since = performance.now();
    const previous = document.activeElement as HTMLElement | null;
    screen.current?.focus({ preventScroll: true });
    let woken = false;
    let timer: number | undefined;
    const wake = (e: Event) => {
      if (e.timeStamp <= since) return;
      e.preventDefault();
      e.stopPropagation();
      if (woken) return;
      woken = true;
      if (e.type === 'pointerdown') swallowNextClick();
      if (reducedMotion()) {
        callbacks.current.onWake?.();
        return;
      }
      setWaking(true);
      timer = window.setTimeout(() => callbacks.current.onWake?.(), FADE_OUT_MS);
    };
    const node = screen.current;
    window.addEventListener('keydown', wake, true);
    node?.addEventListener('pointerdown', wake);
    return () => {
      window.removeEventListener('keydown', wake, true);
      node?.removeEventListener('pointerdown', wake);
      window.clearTimeout(timer);
      previous?.focus?.({ preventScroll: true });
    };
  }, [canWake]);

  return (
    <div
      ref={screen}
      className={`desktop-sleep${waking ? ' desktop-sleep-waking' : ''}`}
      style={{ animationDuration: `${waking ? FADE_OUT_MS : fadeIn}ms` }}
      role={onWake ? 'dialog' : undefined}
      aria-modal={onWake ? true : undefined}
      aria-label={onWake ? 'Asleep. Press any key, click or tap to wake.' : 'Restarting'}
      tabIndex={-1}
    />
  );
};

export default SleepScreen;
