import { ES1_LIMITS, pressureCurve, totalDurationS, type Es1Profile, type Es1Stage } from '@brewlab/shared';
import type { Shot } from '@brewlab/shared';
import { relativeDate } from '../lib/format';

const STAGE_COLOUR: Record<Es1Stage['kind'], string> = {
  preinfusion: 'var(--cool)',
  infusion: 'var(--crema)',
  rampdown: 'var(--espresso)',
};

export { STAGE_COLOUR };

/**
 * The shot as the machine will run it: pressure against time, with each phase
 * shaded in its own colour and the flow ceiling drawn as a dashed overlay.
 */
export function ProfileCurve({ profile, height = 220 }: { profile: Es1Profile; height?: number }) {
  const W = 720;
  const H = height;
  const pad = { top: 14, right: 46, bottom: 26, left: 34 };
  const total = Math.max(1, totalDurationS(profile));
  const maxBar = ES1_LIMITS.pressureBar.max;
  const maxFlow = ES1_LIMITS.flowMlS.max;

  const x = (t: number) => pad.left + (t / total) * (W - pad.left - pad.right);
  const y = (bar: number) => H - pad.bottom - (bar / maxBar) * (H - pad.top - pad.bottom);
  const yFlow = (f: number) => H - pad.bottom - (f / maxFlow) * (H - pad.top - pad.bottom);

  const points = pressureCurve(profile, 0.25);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.bar).toFixed(1)}`).join(' ');
  const area = `${line} L${x(total).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const flowLine = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${yFlow(p.flow).toFixed(1)}`)
    .join(' ');

  let cursor = 0;
  const bands = profile.stages.map((s) => {
    const band = { stage: s, from: cursor, to: cursor + s.durationS };
    cursor += s.durationS;
    return band;
  });

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pressure profile">
      <defs>
        <linearGradient id="crema-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--crema)" stopOpacity="var(--chart-area-opacity)" />
          <stop offset="100%" stopColor="var(--crema)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {[0, 3, 6, 9].map((bar) => (
        <g key={bar}>
          <line className="grid-line" x1={pad.left} y1={y(bar)} x2={W - pad.right} y2={y(bar)} />
          <text x={pad.left - 7} y={y(bar) + 3} textAnchor="end">
            {bar}
          </text>
        </g>
      ))}

      {bands.map((b, i) => (
        <g key={b.stage.id ?? i}>
          <rect
            x={x(b.from)}
            y={pad.top}
            width={Math.max(0, x(b.to) - x(b.from))}
            height={H - pad.top - pad.bottom}
            fill={STAGE_COLOUR[b.stage.kind]}
            style={{ opacity: 'var(--chart-band-opacity)' }}
          />
          {i > 0 ? (
            <line className="grid-line" x1={x(b.from)} y1={pad.top} x2={x(b.from)} y2={H - pad.bottom} strokeDasharray="2 3" />
          ) : null}
        </g>
      ))}

      <path d={area} fill="url(#crema-fill)" />
      <path d={flowLine} fill="none" stroke="var(--cool)" strokeWidth="1.4" strokeDasharray="4 3" opacity="0.75" />
      <path d={line} fill="none" stroke="var(--crema)" strokeWidth="2.2" strokeLinejoin="round" />

      <line className="axis" x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={x(total * f)} y={H - pad.bottom + 14} textAnchor="middle">
          {Math.round(total * f)}s
        </text>
      ))}

      <text x={W - pad.right + 6} y={y(maxBar) + 4} fill="var(--crema)">
        bar
      </text>
      <text x={W - pad.right + 6} y={yFlow(maxFlow) + 16} fill="var(--cool)">
        ml/s
      </text>
    </svg>
  );
}

/**
 * The dial-in story for one coffee: shot time over successive pulls, with the
 * target window shaded and each point coloured by how it tasted.
 */
export function DialInChart({ shots, targetS = 28 }: { shots: Shot[]; targetS?: number }) {
  const ordered = [...shots].sort((a, b) => a.brewedAt.localeCompare(b.brewedAt));
  if (ordered.length < 2) return null;

  const W = 720;
  const H = 200;
  const pad = { top: 14, right: 16, bottom: 30, left: 34 };
  const times = ordered.map((s) => s.shotTimeS);
  const lo = Math.min(...times, targetS - 8) - 2;
  const hi = Math.max(...times, targetS + 8) + 2;

  const x = (i: number) => pad.left + (i / Math.max(1, ordered.length - 1)) * (W - pad.left - pad.right);
  const y = (t: number) => H - pad.bottom - ((t - lo) / (hi - lo)) * (H - pad.top - pad.bottom);

  const path = ordered.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.shotTimeS).toFixed(1)}`).join(' ');
  const colour = (s: Shot) =>
    s.rating == null ? 'var(--text-faint)' : s.rating >= 4 ? 'var(--good)' : s.rating >= 3 ? 'var(--warn)' : 'var(--bad)';

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Shot time history">
      <rect
        x={pad.left}
        y={y(targetS + 4)}
        width={W - pad.left - pad.right}
        height={Math.max(0, y(targetS - 4) - y(targetS + 4))}
        fill="var(--good)"
        style={{ opacity: 'var(--chart-target-opacity)' }}
      />
      <line className="grid-line" x1={pad.left} y1={y(targetS)} x2={W - pad.right} y2={y(targetS)} strokeDasharray="3 4" />
      <text x={W - pad.right} y={y(targetS) - 5} textAnchor="end" fill="var(--good)">
        {targetS}s target
      </text>

      <path d={path} fill="none" stroke="var(--text-dim)" strokeWidth="1.5" opacity="0.55" />
      {ordered.map((s, i) => (
        <g key={s.id}>
          <circle cx={x(i)} cy={y(s.shotTimeS)} r="5" fill={colour(s)} stroke="var(--surface)" strokeWidth="1.5">
            <title>{`${relativeDate(s.brewedAt)} · ${s.shotTimeS}s · ${s.rating ?? '–'}★${
              s.grindSetting != null ? ` · grind ${s.grindSetting}` : ''
            }`}</title>
          </circle>
        </g>
      ))}

      <line className="axis" x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} />
      {[lo, (lo + hi) / 2, hi].map((t) => (
        <text key={t} x={pad.left - 7} y={y(t) + 3} textAnchor="end">
          {Math.round(t)}s
        </text>
      ))}
      <text x={pad.left} y={H - 8}>
        {relativeDate(ordered[0].brewedAt)}
      </text>
      <text x={W - pad.right} y={H - 8} textAnchor="end">
        {relativeDate(ordered[ordered.length - 1].brewedAt)}
      </text>
    </svg>
  );
}

/** A tiny inline bar for a value inside a known range. */
export function Meter({ value, min, max, colour = 'var(--crema)' }: { value: number; min: number; max: number; colour?: string }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min))) * 100;
  return (
    <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, borderRadius: 3 }} />
    </div>
  );
}
