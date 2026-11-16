// A picture that shows a shimmering skeleton until it has loaded, instead of
// an empty box or its alt text. Shared by every app: the look is the kit's
// mac-skeleton and mac-loading-image (src/styles/kit.css), and the box's size
// comes from the app's own class (a width and an aspect-ratio or a height).
// The `design` skill, "Skeleton loaders".
import React, { useState } from 'react';

interface LoadingImageProps {
  src: string;
  alt: string;
  /** The app's class for the box: it gives the box its size */
  className?: string;
  /** The picture's own size, when known, so the box keeps its shape before it arrives */
  width?: number;
  height?: number;
  /** Load only when scrolled near (a long list of cards) */
  lazy?: boolean;
}

const LoadingImage: React.FC<LoadingImageProps> = ({ src, alt, className = '', width, height, lazy = false }) => {
  // Which picture has arrived (or failed), so a new src starts on the skeleton again
  const [settled, setSettled] = useState<{ src: string; ok: boolean } | null>(null);
  const done = settled?.src === src;
  const failed = done && !settled.ok;
  return (
    <span className={`mac-loading-image ${done ? 'mac-loaded' : 'mac-skeleton'} ${className}`.trim()}>
      {!failed && (
        <img
          // A picture already in the browser's cache can be complete before React listens for its load
          ref={img => { if (img?.complete && img.naturalWidth > 0 && !done) setSettled({ src, ok: true }); }}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={lazy ? 'lazy' : undefined}
          onLoad={() => setSettled({ src, ok: true })}
          onError={() => setSettled({ src, ok: false })}
        />
      )}
    </span>
  );
};

export default LoadingImage;
