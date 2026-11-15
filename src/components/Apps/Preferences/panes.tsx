// The four panes of System Preferences. Each reads and changes the shared
// settings (useSettings); nothing here is saved by the pane itself.
// React
import React, { useId, useRef, useState } from 'react';
// Packages
import { format } from 'date-fns';
// Context
import { useSettings } from '../../../contexts/useSettings';
import { WALLPAPERS, clockPattern, type Settings, type WallpaperId } from '../../../contexts/settings';

interface Option<T> { value: T; label: React.ReactNode }

/** A labelled row of radio buttons, Mac OS X style: "Text size:  ( ) Small  (•) Medium …" */
function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="preferences-row" role="radiogroup" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="preferences-label">{label}:</span>
      <div className="preferences-options">
        {options.map(option => (
          <label key={option.value} className="preferences-option">
            <input
              type="radio"
              className="preferences-radio"
              name={id}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** A labelled checkbox row: "Magnification:  [x] Icons grow under the pointer" */
const Check: React.FC<{ label: string; text: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  label, text, checked, onChange
}) => (
  <div className="preferences-row">
    <span className="preferences-label">{label && `${label}:`}</span>
    <div className="preferences-options">
      <label className="preferences-option">
        <input
          type="checkbox"
          className="preferences-checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        {text}
      </label>
    </div>
  </div>
);

const swatchBackground = (id: WallpaperId, pictureUrl: string | null) =>
  id === 'custom' ? `url(${pictureUrl}) var(--wallpaper-custom)` : `var(--wallpaper-${id})`;

export const DesktopPane: React.FC = () => {
  const { wallpaper, change, pictureUrl, pictureSaved, setPicture, removePicture } = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear it, so choosing the same file again still counts as a change
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setMessage(await setPicture(file));
    setBusy(false);
  };

  const swatches: { id: WallpaperId; name: string }[] = [
    ...(pictureUrl ? [{ id: 'custom' as const, name: 'Your Picture' }] : []),
    ...WALLPAPERS
  ];

  return (
    <div className="preferences-pane">
      <div className="preferences-swatches" role="group" aria-label="Desktop picture">
        {swatches.map(w => (
          <button
            key={w.id}
            className={`preferences-swatch${wallpaper === w.id ? ' preferences-swatch-selected' : ''}`}
            aria-pressed={wallpaper === w.id}
            onClick={() => change({ wallpaper: w.id })}
          >
            <span className="preferences-swatch-picture" style={{ background: swatchBackground(w.id, pictureUrl) }} />
            <span className="preferences-swatch-name">{w.name}</span>
          </button>
        ))}
      </div>

      <div className="preferences-buttons">
        <button onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Opening…' : 'Choose Picture…'}
        </button>
        {pictureUrl && <button onClick={() => { setMessage(null); removePicture(); }}>Remove Picture</button>}
        <input ref={input} className="preferences-file" type="file" accept="image/*" onChange={choose} hidden />
      </div>
      {message && <p className="preferences-note preferences-error" role="alert">{message}</p>}
      <p className="preferences-note">
        {pictureSaved
          ? 'Your picture stays in this browser. It is never uploaded.'
          : "This browser can't keep pictures (a private window?), so yours lasts only this visit. It is never uploaded."}
      </p>
    </div>
  );
};

const THEMES: Option<Settings['theme']>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

/**
 * Light, dark or the computer's own setting, as three small pictures of a
 * window, after Mac OS X's appearance picker. Each is a radio button, so
 * the arrow keys move between them; System's picture is half of each.
 */
const ThemeChoice: React.FC<{ value: Settings['theme']; onChange: (theme: Settings['theme']) => void }> = ({ value, onChange }) => {
  const id = useId();
  return (
    <div className="preferences-row" role="radiogroup" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="preferences-label">Appearance:</span>
      <div className="preferences-themes">
        {THEMES.map(option => (
          <label key={option.value} className="preferences-theme">
            <input
              type="radio"
              className="preferences-theme-input"
              name={id}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="preferences-theme-picture" aria-hidden="true">
              {option.value !== 'light' && <span className="preferences-theme-window preferences-theme-window-dark" />}
              {option.value !== 'dark' && <span className="preferences-theme-window preferences-theme-window-light" />}
            </span>
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
};

const TEXT_SIZES: Option<Settings['textSize']>[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'larger', label: 'Larger' }
];

const HIGHLIGHTS: Option<Settings['highlight']>[] = [
  { value: 'blue', label: <><span className="preferences-dot preferences-dot-blue" aria-hidden="true" />Blue</> },
  { value: 'graphite', label: <><span className="preferences-dot preferences-dot-graphite" aria-hidden="true" />Graphite</> }
];

export const AppearancePane: React.FC = () => {
  const { settings, change } = useSettings();
  return (
    <div className="preferences-pane">
      <ThemeChoice value={settings.theme} onChange={theme => change({ theme })} />
      <Choice label="Text size" value={settings.textSize} options={TEXT_SIZES} onChange={textSize => change({ textSize })} />
      <Choice label="Highlight colour" value={settings.highlight} options={HIGHLIGHTS} onChange={highlight => change({ highlight })} />
      <p className="preferences-note">
        System follows your computer's light or dark setting, and changes when it does. Text size changes the
        menu bar, every window and the Dock. Graphite turns title bars, buttons and selections grey.
      </p>
    </div>
  );
};

const DOCK_SIZES: Option<Settings['dockSize']>[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

export const DockPane: React.FC = () => {
  const { settings, change } = useSettings();
  return (
    <div className="preferences-pane">
      <Choice label="Icon size" value={settings.dockSize} options={DOCK_SIZES} onChange={dockSize => change({ dockSize })} />
      <Check
        label="Magnification"
        text="Icons grow under the pointer"
        checked={settings.dockMagnify}
        onChange={dockMagnify => change({ dockMagnify })}
      />
      <p className="preferences-note">On a phone the Dock shows five apps, and Large stays Medium so they fit.</p>
    </div>
  );
};

// A fixed time for the examples beside each choice, so they read the same all day
const EXAMPLE = new Date(2000, 0, 1, 15, 45, 30);

export const DateTimePane: React.FC = () => {
  const { settings, change } = useSettings();
  const example = (clock: Settings['clock']) => format(EXAMPLE, clockPattern({ clock, clockSeconds: settings.clockSeconds }));
  const clocks: Option<Settings['clock']>[] = [
    { value: '12', label: <>12-hour <span className="preferences-example">({example('12')})</span></> },
    { value: '24', label: <>24-hour <span className="preferences-example">({example('24')})</span></> }
  ];
  return (
    <div className="preferences-pane">
      <Choice label="Menu bar clock" value={settings.clock} options={clocks} onChange={clock => change({ clock })} />
      <Check
        label=""
        text="Show seconds"
        checked={settings.clockSeconds}
        onChange={clockSeconds => change({ clockSeconds })}
      />
    </div>
  );
};
