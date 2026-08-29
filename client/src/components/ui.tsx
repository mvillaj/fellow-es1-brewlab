import { useEffect, useState, type ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="faint small">unrated</span>;
  return (
    <span className="stars" title={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? '' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function RatingInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="rating-input">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={value != null && n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <div className="small">{children}</div> : null}
    </div>
  );
}

export function Banner({ kind = 'info', children }: { kind?: 'info' | 'good' | 'bad'; children: ReactNode }) {
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <div className="spread" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

/**
 * Busy indicator for the model-backed actions, which can sit for tens of seconds.
 * Built from the same bar vocabulary as the brand mark — an extraction rising and
 * falling — rather than a generic spinner. Colour is `currentColor`, so it reads
 * correctly on a ghost button, a primary button, and in both themes.
 *
 * `seconds` is real elapsed time, not a progress guess: it appears only once the
 * wait is long enough to be worth reassuring about.
 */
export function Working({ label, seconds }: { label: string; seconds?: number | null }) {
  return (
    <span className="working">
      <span className="working-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {label}
      {seconds != null && seconds >= 4 ? <span className="working-clock">{seconds}s</span> : null}
    </span>
  );
}

/** Seconds since `active` became true, for honest "still going" feedback. */
export function useElapsed(active: boolean): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      setSeconds(null);
      return;
    }
    setSeconds(0);
    const started = performance.now();
    const t = setInterval(() => setSeconds(Math.floor((performance.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [active]);
  return seconds;
}
