import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { FINISHES, useTheme, type ThemePref } from '../lib/theme';

const THEMES: { value: ThemePref; icon: LucideIcon; title: string }[] = [
  { value: 'light', icon: Sun, title: 'Light' },
  { value: 'dark', icon: Moon, title: 'Dark' },
  { value: 'auto', icon: Monitor, title: 'Match the system' },
];

export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  return (
    <div className="segmented theme-toggle" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          className={pref === t.value ? 'on' : ''}
          onClick={() => setPref(t.value)}
          title={t.title}
          aria-label={t.title}
          aria-pressed={pref === t.value}
        >
          <t.icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** Two-tone swatches, body over wood, like picking the machine itself. */
export function FinishPicker() {
  const { finish, setFinish } = useTheme();
  const current = FINISHES.find((f) => f.value === finish);
  return (
    <div className="stack-sm">
      <div className="finish-picker" role="group" aria-label="Colour">
        {FINISHES.map((f, i) => [
          i === 1 ? <span key="sep" className="finish-sep" aria-hidden="true" /> : null,
          <button
            key={f.value}
            type="button"
            className={finish === f.value ? 'on' : ''}
            onClick={() => setFinish(f.value)}
            title={f.label}
            aria-label={f.label}
            aria-pressed={finish === f.value}
            style={{ '--swatch-body': f.body, '--swatch-wood': f.wood } as React.CSSProperties}
          />,
        ])}
      </div>
      <span className="finish-name">{current?.label}</span>
    </div>
  );
}
