// About This Mac's "specs", read from the visitor's own browser and written
// the way Mac OS X wrote them. Pure, so it is tested without a browser.
// Nothing here is stored or sent anywhere: it is read when the window draws.

export const NOT_SHARED = 'Not shared by this browser';

/** Up to two decimals, without trailing zeros: 2 -> "2", 1.5 -> "1.5", 2.625 -> "2.63" */
const trim = (n: number) => String(Math.round(n * 100) / 100);

const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** navigator.hardwareConcurrency: "8 cores" */
export const formatCores = (cores: unknown): string => {
  if (!usable(cores)) return NOT_SHARED;
  const n = Math.round(cores);
  return n === 1 ? '1 core' : `${n} cores`;
};

/**
 * navigator.deviceMemory, in GB. Only Chromium browsers have it, and they
 * round it to the nearest power of two within bounds of their own (a 16 GB
 * Mac read 16 in Chrome 156, 2026-11-15; older Chromes stopped at 8), so it
 * is "About".
 */
export const formatMemory = (gigabytes: unknown): string => {
  if (!usable(gigabytes)) return NOT_SHARED;
  return gigabytes < 1 ? `About ${Math.round(gigabytes * 1024)} MB` : `About ${trim(gigabytes)} GB`;
};

/** The screen in CSS pixels and how many device pixels make one: "1512 × 982 at 2×" */
export const formatDisplay = (width: unknown, height: unknown, pixelRatio: unknown): string => {
  if (!usable(width) || !usable(height)) return NOT_SHARED;
  const size = `${Math.round(width)} × ${Math.round(height)}`;
  return usable(pixelRatio) ? `${size} at ${trim(pixelRatio)}×` : size;
};

export interface Specs {
  processor: string;
  memory: string;
  display: string;
}

/** The three lines, from the parts of navigator, screen and devicePixelRatio they need */
export const readSpecs = (
  nav: { hardwareConcurrency?: number; deviceMemory?: number },
  screen: { width?: number; height?: number },
  pixelRatio: number | undefined
): Specs => ({
  processor: formatCores(nav.hardwareConcurrency),
  memory: formatMemory(nav.deviceMemory),
  display: formatDisplay(screen.width, screen.height, pixelRatio)
});
