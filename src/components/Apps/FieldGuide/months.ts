export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * The months with at least half the busiest month's sightings, grouped into
 * runs that may wrap past December: "Apr–May, Sep–Oct", "Nov–Feb". When
 * nearly every month is busy, "year-round" with the quietest month.
 */
export const peakMonths = (counts: number[]): string => {
  const max = Math.max(...counts);
  if (max <= 0) return '';
  const busy = counts.map(c => c >= max / 2);
  const quiet = busy.filter(b => !b).length;
  if (quiet === 0) return 'year-round';
  // "Sep–Jul" is accurate but reads as a riddle; say what it means
  if (quiet <= 3) return `year-round, fewest in ${MONTHS[counts.indexOf(Math.min(...counts))]}`;

  // Start just after a quiet month so no run is split across the year end
  const start = (busy.findIndex(b => !b) + 1) % 12;
  const runs: [number, number][] = [];
  for (let k = 0; k < 12; k++) {
    const m = (start + k) % 12;
    if (!busy[m]) continue;
    const last = runs[runs.length - 1];
    if (last && (last[1] + 1) % 12 === m) last[1] = m;
    else runs.push([m, m]);
  }
  return runs
    .map(([a, b]) => (a === b ? MONTHS[a] : `${MONTHS[a]}–${MONTHS[b]}`))
    .join(', ');
};
