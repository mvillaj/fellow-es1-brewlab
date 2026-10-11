import { totalDurationS, type Es1Profile } from '@brewlab/shared';

/**
 * A profile is written as straight lines with steps at the stage edges, but the
 * pump can't jump from 3 to 9 bar in no time, so a chart drawn that way shows a
 * shot no machine pulls. This eases each edge (and the start, from 0 bar) with
 * a smootherstep blend between the two stages' lines. The blend is a weighted
 * mix of the neighbours, so the curve never overshoots either of them: a 9 bar
 * stage still peaks at 9 bar.
 */

interface Segment {
  from: number;
  to: number;
  a: number;
  b: number;
}

/** Longest ease either side of a stage edge, in seconds. */
const EDGE_S = 1.8;
/** Longest ease from 0 bar at the start of the shot. */
const START_S = 2.4;

/** A stage's line, held at its end values outside it so a ramp never extrapolates past them. */
function lineAt(s: Segment, t: number) {
  const d = s.to - s.from;
  const u = d ? Math.min(1, Math.max(0, (t - s.from) / d)) : 0;
  return s.a + (s.b - s.a) * u;
}

function smoother(x: number) {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/** Pressure in bar at any second of the shot, eased at every edge. */
export function pressureEaser(profile: Pick<Es1Profile, 'stages'>): (t: number) => number {
  const segs: Segment[] = [];
  let cursor = 0;
  for (const st of profile.stages) {
    if (st.durationS <= 0) continue;
    segs.push({ from: cursor, to: cursor + st.durationS, a: st.pressureBar, b: st.endPressureBar });
    cursor += st.durationS;
  }
  if (!segs.length) return () => 0;

  const span = (s: Segment) => s.to - s.from;
  // Half-width of the blend at each inner edge, kept inside both stages.
  const edges = segs.slice(1).map((s, i) => Math.min(EDGE_S, span(segs[i]) * 0.35, span(s) * 0.35));
  const start = Math.min(START_S, span(segs[0]) * 0.5);

  return (t: number) => {
    const found = segs.findIndex((s) => t <= s.to);
    const idx = found === -1 ? segs.length - 1 : found;
    const seg = segs[idx];
    let bar = lineAt(seg, t);

    const before = idx > 0 ? edges[idx - 1] : 0;
    const after = idx < segs.length - 1 ? edges[idx] : 0;
    if (before && t < seg.from + before) {
      const prev = segs[idx - 1];
      bar = lineAt(prev, t) + (bar - lineAt(prev, t)) * smoother((t - (seg.from - before)) / (2 * before));
    } else if (after && t > seg.to - after) {
      const next = segs[idx + 1];
      bar = bar + (lineAt(next, t) - bar) * smoother((t - (seg.to - after)) / (2 * after));
    }
    if (idx === 0 && t < start) bar *= smoother(t / start);
    return bar;
  };
}

/** Samples of the eased curve, about 400 across the shot. */
export function smoothPressurePoints(profile: Pick<Es1Profile, 'stages'>, samples = 400) {
  const total = Math.max(1, totalDurationS(profile));
  const at = pressureEaser(profile);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (i / samples) * total;
    return { t, bar: at(t) };
  });
}

/** SVG line and area paths for the eased curve, with the caller's scales. */
export function smoothPressurePaths(
  profile: Pick<Es1Profile, 'stages'>,
  x: (t: number) => number,
  y: (bar: number) => number,
) {
  const pts = smoothPressurePoints(profile);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)},${y(p.bar).toFixed(2)}`).join(' ');
  const last = pts[pts.length - 1];
  const area = `${line} L${x(last.t).toFixed(2)},${y(0).toFixed(2)} L${x(0).toFixed(2)},${y(0).toFixed(2)} Z`;
  return { line, area };
}
