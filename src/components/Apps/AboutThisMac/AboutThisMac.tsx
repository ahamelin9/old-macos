// React
import React, { useEffect, useState } from 'react';
// Context
import { useWindows } from '../../../contexts/useWindows';
// Specs
import { readSpecs, type Specs } from './specs';
// Styling
import './AboutThisMac.css';

/** Read now, from this browser; never kept or sent */
const currentSpecs = (): Specs =>
  readSpecs(navigator as Navigator & { deviceMemory?: number }, window.screen, window.devicePixelRatio);

/** The specs, read again when the window changes size (a phone turning, a zoom changing the pixel ratio) */
const useSpecs = () => {
  const [specs, setSpecs] = useState(currentSpecs);
  useEffect(() => {
    const update = () => setSpecs(currentSpecs());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return specs;
};

/**
 * About This Mac, as in Mac OS X 10.0–10.2: the logo, the name and version,
 * a few specs, and More Info…, which opens Finder (about Alex). The specs
 * come from the visitor's own browser and are only shown.
 */
const AboutThisMac: React.FC = () => {
  const { showApp } = useWindows();
  const specs = useSpecs();

  return (
    <div className="about-app">
      <div className="about-logo" aria-hidden="true">
        <span className="about-logo-apple">🍎</span>
      </div>
      <h2 className="about-name">macOS 1999</h2>
      <p className="about-version">Version 10.1999 (Y2K ready)</p>

      <dl className="about-specs">
        <dt>Processor</dt>
        <dd>{specs.processor}</dd>
        <dt>Memory</dt>
        <dd>{specs.memory}</dd>
        <dt>Display</dt>
        <dd>{specs.display}</dd>
      </dl>

      <button className="about-more" onClick={() => showApp('finder')}>More Info…</button>
      <p className="about-note">Read from your browser just now. Never saved or sent.</p>
    </div>
  );
};

export default AboutThisMac;
