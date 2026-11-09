import React, { useState } from 'react';
import { MONTHS, MONTH_NAMES } from './months';

interface MonthChartProps {
  /** Sightings for January..December */
  counts: number[];
  /** 1-12; highlighted as "now" */
  currentMonth: number;
}

/** A round axis top: two gridline steps that cover the tallest month. */
const niceScale = (max: number) => {
  const raw = Math.max(max, 1) / 2;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw) ?? 10 * magnitude;
  return { step, top: step * 2 };
};

const compact = (n: number) =>
  n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n);

/**
 * Sightings by month as twelve thin columns, the current month washed so
 * "is now a good time?" reads at a glance. One series, so no legend: the
 * section heading names it. Every value is on hover/focus and in the table.
 */
const MonthChart: React.FC<MonthChartProps> = ({ counts, currentMonth }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...counts);
  const { step, top } = niceScale(max);
  const peak = counts.indexOf(max);
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="month-chart">
      <div className="month-chart-plot">
        {[0, step, top].map(value => (
          <div key={value} className="month-grid" style={{ bottom: `${(value / top) * 100}%` }}>
            <span className="month-grid-label">{compact(value)}</span>
          </div>
        ))}
        <div
          className="month-cols"
          role="list"
          aria-label="Sightings by month"
          onMouseLeave={() => setHovered(null)}
        >
          {counts.map((count, i) => {
            const height = (count / top) * 100;
            const isNow = i === currentMonth - 1;
            const share = total ? Math.round((count / total) * 100) : 0;
            return (
              <div
                key={MONTHS[i]}
                role="listitem"
                tabIndex={0}
                className={`month-col ${isNow ? 'now' : ''} ${hovered === i ? 'hovered' : ''}`}
                aria-label={`${MONTH_NAMES[i]}${isNow ? ' (this month)' : ''}: ${count.toLocaleString()} sightings, ${share}% of the year`}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              >
                {count > 0 && <div className="month-bar" style={{ height: `${height}%` }} />}
                {/* Only the busiest month is labelled; hover or the table has the rest */}
                {i === peak && count > 0 && hovered === null && (
                  <span className="month-peak-label" style={{ bottom: `${height}%` }}>
                    {count.toLocaleString()}
                  </span>
                )}
                {hovered === i && (
                  <div
                    className={`month-tooltip ${i < 2 ? 'align-left' : i > 9 ? 'align-right' : ''}`}
                    style={{ bottom: `calc(${Math.min(height, 100)}% + 4px)` }}
                  >
                    <strong>{count.toLocaleString()}</strong>
                    <span>
                      {MONTH_NAMES[i]} · {share}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="month-axis" aria-hidden="true">
        {MONTHS.map((m, i) => (
          <span key={m} className={i === currentMonth - 1 ? 'now' : ''}>
            {m}
          </span>
        ))}
      </div>

      <details className="month-chart-table">
        <summary>Show numbers</summary>
        <div className="month-table-scroll">
          <table>
            <thead>
              <tr>
                {MONTHS.map(m => (
                  <th key={m} scope="col">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {counts.map((c, i) => (
                  <td key={MONTHS[i]}>{c.toLocaleString()}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

export default MonthChart;
