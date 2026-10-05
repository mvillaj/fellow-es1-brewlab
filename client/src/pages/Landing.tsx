import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BUILT_IN_GRINDERS,
  STOCK_PROFILES,
  convertSetting,
  grindBucket,
  pressureCurve,
  settingToMicrons,
  specToUserGrinder,
  suggestNextShot,
  totalDurationS,
  type Es1Profile,
  type Es1Stage,
  type StageKind,
} from '@brewlab/shared';
import BrandLockup from '../components/BrandLockup';
import { ProfileCurve, STAGE_COLOUR } from '../components/charts';
import '../styles/landing.css';

/**
 * The public front door. The page is one shot: the hero pulls a real factory
 * profile across the full width, and its three stages carry the story below.
 * Every demo runs the app's own shared code on sample inputs, so what a visitor
 * plays with here is what the app will tell them at the bench.
 */

const HERO = STOCK_PROFILES.find((p) => p.name === 'Modern Arc') ?? STOCK_PROFILES[0];
const HERO_TOTAL = totalDurationS(HERO);
/** Machine seconds to wall-clock milliseconds: a 35 s shot plays in about 5 s. */
const MS_PER_SECOND = 140;

const STAGE_NAME: Record<StageKind, string> = {
  preinfusion: 'Pre-infusion',
  infusion: 'Infusion',
  rampdown: 'Ramp down',
};
const STAGE_ANCHOR: Record<StageKind, string> = {
  preinfusion: 'log',
  infusion: 'coach',
  rampdown: 'profiles',
};

interface Band {
  stage: Es1Stage;
  from: number;
  to: number;
}

function bandsOf(profile: Pick<Es1Profile, 'stages'>): Band[] {
  let cursor = 0;
  return profile.stages.map((stage) => {
    const band = { stage, from: cursor, to: cursor + stage.durationS };
    cursor += stage.durationS;
    return band;
  });
}

const HERO_BANDS = bandsOf(HERO);
const END_BAR = HERO.stages[HERO.stages.length - 1].endPressureBar;

function barAt(t: number): { bar: number; flow: number; kind: StageKind } {
  const band = HERO_BANDS.find((b) => t <= b.to) ?? HERO_BANDS[HERO_BANDS.length - 1];
  const frac = band.stage.durationS ? (t - band.from) / band.stage.durationS : 0;
  const { pressureBar: a, endPressureBar: b } = band.stage;
  return {
    bar: a + (b - a) * Math.min(1, Math.max(0, frac)),
    flow: band.stage.flowLimitMlS,
    kind: band.stage.kind,
  };
}

/** Line and area paths for a profile inside a w×h box, 9 bar at `topY`. */
function curvePaths(profile: Pick<Es1Profile, 'stages'>, w: number, h: number, topY: number) {
  const total = Math.max(1, totalDurationS(profile));
  const x = (t: number) => (t / total) * w;
  const y = (bar: number) => h - ((h - topY) * bar) / 9;
  const pts = pressureCurve(profile, 0.25);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.bar).toFixed(1)}`).join(' ');
  return { line, area: `${line} L${w},${h} L0,${h} Z`, x, y };
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── Hero: the pull ────────────────────────────────────────────────────────── */

const VB_W = 1000;
const VB_H = 400;
const VB_TOP = 104;

function HeroPull() {
  const clip = useRef<SVGRectElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLDivElement>(null);
  const barText = useRef<HTMLSpanElement>(null);
  const timeText = useRef<HTMLSpanElement>(null);
  const flowText = useRef<HTMLSpanElement>(null);
  const stageText = useRef<HTMLSpanElement>(null);
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);

  const { line, area, y } = useMemo(() => curvePaths(HERO, VB_W, VB_H, VB_TOP), []);

  useEffect(() => {
    // Written straight to the DOM: one React render per frame would be a lot of
    // reconciling for a line, a dot and three numbers.
    const paint = (p: number) => {
      const t = p * HERO_TOTAL;
      const { bar, flow, kind } = barAt(t);
      const pct = `${(p * 100).toFixed(3)}%`;
      clip.current?.setAttribute('width', String(p * VB_W));
      if (head.current) head.current.style.left = pct;
      if (dot.current) {
        dot.current.style.left = pct;
        dot.current.style.top = `${((y(bar) / VB_H) * 100).toFixed(3)}%`;
        dot.current.style.background = STAGE_COLOUR[kind];
      }
      if (readout.current) {
        // Half the chip's own width, so it never hangs off either end of the track.
        const half = Math.ceil(readout.current.offsetWidth / 2) + 8;
        readout.current.style.left = `clamp(${half}px, ${pct}, calc(100% - ${half}px))`;
      }
      if (barText.current) barText.current.textContent = bar.toFixed(1);
      if (timeText.current) timeText.current.textContent = t.toFixed(1);
      if (flowText.current) flowText.current.textContent = flow.toFixed(1);
      if (stageText.current) {
        stageText.current.textContent = STAGE_NAME[kind];
        stageText.current.style.color = STAGE_COLOUR[kind];
      }
    };

    if (prefersReducedMotion()) {
      paint(1);
      setDone(true);
      return;
    }

    setDone(false);
    let frame = 0;
    let start = 0;
    const duration = HERO_TOTAL * MS_PER_SECOND;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      paint(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    paint(0);
    // A beat before the pump starts, so the empty profile reads first.
    const delay = window.setTimeout(() => (frame = requestAnimationFrame(tick)), run ? 150 : 650);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
  }, [run, y]);

  return (
    <figure
      className="pull"
      aria-label={`${HERO.name}: ${HERO.stages.map((s) => STAGE_NAME[s.kind]).join(', then ')}, over ${HERO_TOTAL} seconds`}
    >
      <div className={done ? 'pull-plot done' : 'pull-plot'}>
        <div className="pull-track">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="pull-fill" gradientUnits="userSpaceOnUse" x1="0" y1={VB_TOP} x2="0" y2={VB_H}>
                <stop offset="0%" stopColor="var(--crema)" stopOpacity="var(--chart-area-opacity)" />
                <stop offset="100%" stopColor="var(--crema)" stopOpacity="0" />
              </linearGradient>
              {/* The shot's tail past the last reading fades out across the gutter, so
                  the fill leaves the page instead of stopping in a hard edge. */}
              <linearGradient id="pull-tail-fade" gradientUnits="userSpaceOnUse" x1={VB_W} y1="0" x2={VB_W * 1.035} y2="0">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id="pull-tail-mask" maskUnits="userSpaceOnUse" x={VB_W} y="0" width={VB_W} height={VB_H}>
                <rect x={VB_W} y="0" width={VB_W} height={VB_H} fill="url(#pull-tail-fade)" />
              </mask>
              <clipPath id="pull-clip">
                <rect ref={clip} x="0" y="0" width="0" height={VB_H} />
              </clipPath>
            </defs>
            {HERO_BANDS.map((b, i) => (
              <rect
                key={b.stage.id}
                x={(b.from / HERO_TOTAL) * VB_W}
                y="0"
                // The last band runs on past the track to the viewport edge, so the
                // shot ends inside its stage rather than against a bare column.
                width={((b.to - b.from) / HERO_TOTAL) * VB_W + (i === HERO_BANDS.length - 1 ? VB_W : 0)}
                height={VB_H}
                fill={STAGE_COLOUR[b.stage.kind]}
                style={{ opacity: 'var(--chart-band-opacity)' }}
              />
            ))}
            {[3, 6, 9].map((bar) => (
              <line key={bar} className="pull-grid" x1="0" x2={VB_W * 2} y1={y(bar)} y2={y(bar)} vectorEffect="non-scaling-stroke" />
            ))}
            {HERO_BANDS.slice(1).map((b) => (
              <line
                key={b.stage.id}
                className="pull-grid"
                x1={(b.from / HERO_TOTAL) * VB_W}
                x2={(b.from / HERO_TOTAL) * VB_W}
                y1="0"
                y2={VB_H}
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={line} className="pull-ghost" vectorEffect="non-scaling-stroke" />
            <g className="pull-tail" mask="url(#pull-tail-mask)">
              <path d={`M${VB_W},${y(END_BAR)} L${VB_W * 2},${y(END_BAR)} L${VB_W * 2},${VB_H} L${VB_W},${VB_H} Z`} fill="url(#pull-fill)" />
              <path d={`M${VB_W},${y(END_BAR)} L${VB_W * 2},${y(END_BAR)}`} className="pull-ghost" vectorEffect="non-scaling-stroke" />
            </g>
            <g clipPath="url(#pull-clip)">
              <path d={area} fill="url(#pull-fill)" />
              <path d={line} className="pull-line" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>

          {[3, 6, 9].map((bar) => (
            <span key={bar} className="pull-axis" style={{ top: `${(y(bar) / VB_H) * 100}%` }}>
              {bar}
              {bar === 9 ? <small> bar</small> : null}
            </span>
          ))}

          <div ref={head} className="pull-head" aria-hidden="true" />
          <div ref={dot} className="pull-dot" aria-hidden="true" />
          <div ref={readout} className="pull-readout" aria-hidden="true">
            <span className="pull-reading">
              <span ref={barText}>0.0</span>
              <small>bar</small>
            </span>
            <span className="pull-reading">
              <span ref={timeText}>0.0</span>
              <small>s</small>
            </span>
            {/* The profile carries a flow ceiling, not a measured flow, so it is labelled as one. */}
            <span className="pull-reading" title="Flow limit for this stage">
              <span ref={flowText}>{HERO.stages[0].flowLimitMlS.toFixed(1)}</span>
              <small>ml/s max</small>
            </span>
            <span ref={stageText} className="pull-stage">
              {STAGE_NAME[HERO.stages[0].kind]}
            </span>
          </div>

          <nav className="pull-stages" aria-label="What Crema does">
            {HERO_BANDS.map((b, i) => (
              <a
                key={b.stage.id}
                href={`#${STAGE_ANCHOR[b.stage.kind]}`}
                className={i === HERO_BANDS.length - 1 && i > 0 ? 'last' : undefined}
                style={
                  i === HERO_BANDS.length - 1 && i > 0
                    ? { right: 0, color: STAGE_COLOUR[b.stage.kind] }
                    : { left: `${(b.from / HERO_TOTAL) * 100}%`, color: STAGE_COLOUR[b.stage.kind] }
                }
              >
                {STAGE_NAME[b.stage.kind]}
                <span className="mono">
                  {b.from}–{b.to} s
                </span>
              </a>
            ))}
          </nav>
        </div>
      </div>

      <figcaption className="pull-caption">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRun((n) => n + 1)} disabled={!done}>
          Pull it again
        </button>
        <span>
          {HERO.name}, one of Fellow’s factory profiles: <span className="mono">{HERO.doseG} g</span> in,{' '}
          <span className="mono">{HERO.doseG * HERO.ratio} g</span> out at <span className="mono">{HERO.brewTempC} °C</span>.
        </span>
      </figcaption>
    </figure>
  );
}

/* ── Stage gutter: the shot, with one stage lit ────────────────────────────── */

function StageMark({ kind }: { kind: StageKind | 'yield' }) {
  const W = 220;
  const H = 72;
  const { line, area } = useMemo(() => curvePaths(HERO, W, H, 8), []);
  const whole = kind === 'yield';
  const band = whole
    ? { from: 0, to: HERO_TOTAL }
    : HERO_BANDS.find((b) => b.stage.kind === kind)!;
  const colour = whole ? 'var(--crema)' : STAGE_COLOUR[kind];
  const x0 = (band.from / HERO_TOTAL) * W;
  const x1 = (band.to / HERO_TOTAL) * W;
  const id = `mark-${kind}`;
  return (
    <div className="stage-mark">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x={x0} y="0" width={x1 - x0} height={H} />
          </clipPath>
        </defs>
        <path d={line} className="stage-mark-rest" />
        <g clipPath={`url(#${id})`}>
          <path d={area} fill={colour} style={{ opacity: 'var(--chart-area-opacity)' }} />
          <path d={line} fill="none" stroke={colour} strokeWidth="2.2" strokeLinejoin="round" />
        </g>
      </svg>
      <div className="stage-mark-label" style={{ color: colour }}>
        {whole ? 'End of shot' : STAGE_NAME[kind]}
        <span className="mono">
          {whole ? `${HERO.doseG * HERO.ratio} g out` : `${band.from}–${band.to} s`}
        </span>
      </div>
    </div>
  );
}

/* ── Demo: grind translator ────────────────────────────────────────────────── */

const ESPRESSO_GRINDERS = BUILT_IN_GRINDERS.filter((g) => g.espressoRange);

/** "DF DF64" reads as a stutter; some models already carry the brand. */
function grinderName(g: { brand: string; model: string }) {
  return g.model.startsWith(g.brand) ? g.model : `${g.brand} ${g.model}`;
}

function settingLabel(value: number, unit: string, step: number) {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return `${value.toFixed(decimals)} ${unit}`;
}

function GrindTranslator() {
  const [fromId, setFromId] = useState('niche-zero');
  const spec = ESPRESSO_GRINDERS.find((g) => g.id === fromId) ?? ESPRESSO_GRINDERS[0];
  const [lo, hi] = spec.espressoRange!;
  const [setting, setSetting] = useState(15);
  const value = Math.min(hi, Math.max(lo, setting));
  const from = specToUserGrinder(spec);
  const microns = Math.round(settingToMicrons(from, value));

  const others = ESPRESSO_GRINDERS.filter((g) => g.id !== spec.id)
    .slice(0, 5)
    .map((g) => ({ spec: g, result: convertSetting(from, value, specToUserGrinder(g)) }));

  return (
    <div className="demo">
      <div className="demo-head">
        <h3>Grind translator</h3>
        <span className="tag">Live, built-in calibrations</span>
      </div>

      <div className="grind-controls">
        <div className="field">
          <label htmlFor="grind-from">Your grinder</label>
          <select
            id="grind-from"
            value={spec.id}
            onChange={(e) => {
              const next = ESPRESSO_GRINDERS.find((g) => g.id === e.target.value)!;
              setFromId(next.id);
              const [a, b] = next.espressoRange!;
              setSetting(Number(((a + b) / 2).toFixed(1)));
            }}
          >
            {ESPRESSO_GRINDERS.map((g) => (
              <option key={g.id} value={g.id}>
                {grinderName(g)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="grind-setting">
            Setting <span className="mono demo-value">{settingLabel(value, spec.scale.unitLabel, spec.scale.step)}</span>
          </label>
          <input
            id="grind-setting"
            type="range"
            min={lo}
            max={hi}
            step={spec.scale.step}
            value={value}
            onChange={(e) => setSetting(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grind-reading">
        <span className="reading-xl mono">
          {microns}
          <small>µm</small>
        </span>
        <span className="dim">{grindBucket(microns)}</span>
      </div>

      <table className="grind-table">
        <thead>
          <tr>
            <th scope="col">Same grind on</th>
            <th scope="col">Setting</th>
            <th scope="col">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {others.map(({ spec: g, result }) => (
            <tr key={g.id}>
              <td>{grinderName(g)}</td>
              <td className="mono">
                {result.outOfRange ? (
                  <span className="faint">off the dial</span>
                ) : (
                  settingLabel(result.setting, g.scale.unitLabel, g.scale.step)
                )}
              </td>
              <td>
                <span
                  className={`tag ${result.confidence === 'measured' ? 'good' : result.confidence === 'community' ? 'cool' : ''}`}
                >
                  {result.confidence}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Demo: the dial-in coach ───────────────────────────────────────────────── */

const TASTE_LABEL: Record<number, string> = {
  [-2]: 'Sour',
  [-1]: 'A bit sour',
  0: 'Balanced',
  1: 'A bit bitter',
  2: 'Bitter',
};

function CoachDemo() {
  const [time, setTime] = useState(21);
  const [taste, setTaste] = useState(-2);
  const s = suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: time, tasteBalance: taste });
  const tone = s.direction === 'hold' ? 'good' : 'accent';

  return (
    <div className="demo coach">
      <div className="demo-head">
        <h3>Your last shot</h3>
        <span className="mono faint small">18 g in · 36 g out</span>
      </div>

      <div className="coach-controls">
        <div className="field">
          <label htmlFor="coach-time">
            Shot time <span className="mono demo-value">{time} s</span>
          </label>
          <input
            id="coach-time"
            type="range"
            min={14}
            max={44}
            step={1}
            value={time}
            onChange={(e) => setTime(Number(e.target.value))}
          />
          <div className="range-ends faint mono">
            <span>14 s</span>
            <span>44 s</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="coach-taste">
            It tasted <span className="demo-value">{TASTE_LABEL[taste]}</span>
          </label>
          <input
            id="coach-taste"
            type="range"
            min={-2}
            max={2}
            step={1}
            value={taste}
            onChange={(e) => setTaste(Number(e.target.value))}
          />
          <div className="range-ends faint">
            <span>Sour</span>
            <span>Bitter</span>
          </div>
        </div>
      </div>

      <div className={`coach-answer ${tone}`} aria-live="polite">
        <div className="coach-headline">{s.headline.replace(' — ', ': ')}</div>
        <p>{s.reason}</p>
        <span className={`tag ${s.confidence === 'high' ? 'good' : s.confidence === 'medium' ? 'accent' : ''}`}>
          {s.confidence} confidence
        </span>
      </div>
    </div>
  );
}

/* ── Demo: a profile in the editor ─────────────────────────────────────────── */

const SAMPLE_PROFILE: Es1Profile = {
  id: 'sample',
  name: 'Slow bloom',
  doseG: 18,
  ratio: 2.2,
  brewTempC: 93,
  stages: [
    { id: 'a', kind: 'preinfusion', durationS: 12, pressureBar: 2, endPressureBar: 2, flowLimitMlS: 3 },
    { id: 'b', kind: 'infusion', durationS: 10, pressureBar: 9, endPressureBar: 9, flowLimitMlS: 4.5 },
    { id: 'c', kind: 'infusion', durationS: 8, pressureBar: 7.5, endPressureBar: 7.5, flowLimitMlS: 4.5 },
    { id: 'd', kind: 'rampdown', durationS: 6, pressureBar: 7.5, endPressureBar: 4, flowLimitMlS: 4.5 },
  ],
};

function ProfileDemo() {
  return (
    <div className="demo">
      <div className="demo-head">
        <h3>{SAMPLE_PROFILE.name}</h3>
        <span className="tag">Sample profile</span>
      </div>
      <ProfileCurve profile={SAMPLE_PROFILE} height={200} />
      <ol className="profile-stages">
        {SAMPLE_PROFILE.stages.map((st) => (
          <li key={st.id}>
            <i style={{ background: STAGE_COLOUR[st.kind] }} aria-hidden="true" />
            <span>{STAGE_NAME[st.kind]}</span>
            <span className="mono">
              {st.durationS}
              <small>s</small>
            </span>
            <span className="mono">
              {st.pressureBar === st.endPressureBar ? st.pressureBar : `${st.pressureBar} → ${st.endPressureBar}`}
              <small>bar</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

function Ctas() {
  return (
    <div className="landing-ctas">
      <Link to="/sign-up" className="btn btn-primary btn-lg">
        Create account
      </Link>
      <Link to="/sign-in" className="btn btn-lg">
        Sign in
      </Link>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-bar">
        <Link to="/" aria-label="Crema home">
          <BrandLockup />
        </Link>
        <Link to="/sign-in" className="btn btn-ghost">
          Sign in
        </Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Dial in espresso on your ES1, one change at a time.</h1>
          <p>
            Crema is a shot log, a dial-in coach and a pressure-profile editor for people who own a Fellow Espresso Series 1. Log
            a shot, get the single next change, pull again.
          </p>
          <Ctas />
        </div>
        <HeroPull />
      </section>

      <section className="stage" id="log">
        <StageMark kind="preinfusion" />
        <div className="stage-body">
          <h2>Every shot, logged with the setting that made it.</h2>
          <p className="lead">
            Dose, yield, time, pre-infusion, temperature, grind, a rating, and where the cup landed between sour and bitter. The
            grind is also stored in microns, so shots from grinders that disagree about what “15” means sit on one axis, and
            recalibrating a grinder later never rewrites your history.
          </p>
          <div className="log-line mono" aria-label="A sample logged shot">
            <span>
              18.0<small>g</small> → 36.4<small>g</small>
            </span>
            <span>
              27<small>s</small>
            </span>
            <span>
              92.5<small>°C</small>
            </span>
            <span>
              Niche Zero 15 · 305<small>µm</small>
            </span>
            <span>4/5 · a bit sour</span>
            <span className="tag">sample</span>
          </div>
          <GrindTranslator />
          <p className="aside">
            Coffees live on a shelf of the bags you’re working through. Paste a roaster’s page to prefill one, and share coffees to
            a library other brewers can clone.
          </p>
        </div>
      </section>

      <section className="stage" id="coach">
        <StageMark kind="infusion" />
        <div className="stage-body">
          <h2>One change at a time.</h2>
          <p className="lead">
            After each shot the coach reads the time and the taste and hands back exactly one adjustment: finer, coarser, longer,
            shorter, or hold. Change two things at once and you learn nothing. Try it on a shot you pulled this morning.
          </p>
          <CoachDemo />
          <p className="aside">
            This is the same code the app runs. It’s a barista’s checklist written down, not science: judge the time against a 28
            s target, then let taste break the tie.
          </p>
        </div>
      </section>

      <section className="stage" id="profiles">
        <StageMark kind="rampdown" />
        <div className="stage-body">
          <h2>Profiles the machine can actually run.</h2>
          <p className="lead">
            The editor builds only what the ES1 runs: an optional pre-infusion, flat infusion steps and an optional ramp down,
            inside the machine’s limits. Every profile is validated before it can reach the machine.
          </p>
          <div className="profile-split">
            <ProfileDemo />
            <ul className="facts">
              <li>
                <strong>Bring your own.</strong> Import the profiles on your Fellow account, edit them here, and push them back.
              </li>
              <li>
                <strong>Never touches what isn’t yours.</strong> Only profiles Crema can tell are yours get updated. Factory
                profiles and Drops are left alone, and the editor says what will happen before it happens.
              </li>
              <li>
                <strong>A starting point, if you want one.</strong> Describe a coffee and ask a model for a first profile. It
                opens unsaved, for you to check.
              </li>
              <li>
                <strong>Honest about estimates.</strong> Grinder calibrations are tagged{' '}
                <span className="tag good">measured</span> <span className="tag cool">community</span> or{' '}
                <span className="tag">estimated</span>. Machine limits Fellow hasn’t published are marked as inferred, and anything
                a model filled in says so.
              </li>
              <li>
                <strong>Candid about the plumbing.</strong> Fellow’s API is private and unofficial. If it changes, pushing breaks
                and tells you so; your log keeps working.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="stage who" id="who">
        <StageMark kind="yield" />
        <div className="stage-body">
          <h2>Who it’s for</h2>
          <p className="lead">
            ES1 owners who want a record of what they pulled and a plain answer about what to change next. The shot log, coach and
            coffee library work with any espresso machine; the profile studio needs the ES1.
          </p>
        </div>
      </section>

      <section className="close">
        <BrandLockup />
        <p>Your next shot is the one to log.</p>
        <Ctas />
      </section>

      <footer className="landing-foot">
        Crema is an independent project. It is not affiliated with, endorsed by, or supported by Fellow Products. Fellow and
        Espresso Series 1 belong to their owner.
      </footer>
    </div>
  );
}
