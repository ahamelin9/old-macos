import { useEffect, useState } from 'react';

/**
 * How many cards a grid actually fits on one row.
 *
 * This mirrors what `repeat(auto-fill, minmax(minCardWidth, 1fr))` resolves to,
 * but as a number the caller can slice data with, so a row is never left part
 * empty. It observes the element rather than the browser window, because these
 * grids live inside a resizable Mac window whose size is independent of the page.
 *
 * It hands back a callback ref rather than taking a ref object: these grids mount
 * after a loading state, so an effect keyed on a ref object would run once while
 * `ref.current` was still null and never re-run to measure the real element.
 */
export function useGridColumns(
  minCardWidth: number,
  gap: number
): [(node: HTMLElement | null) => void, number] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    if (!node) return;

    const measure = () => {
      const width = node.clientWidth;
      if (!width) return;
      setColumns(Math.max(1, Math.floor((width + gap) / (minCardWidth + gap))));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, minCardWidth, gap]);

  return [setNode, columns];
}
