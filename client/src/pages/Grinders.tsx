import { useMemo, useState } from 'react';
import {
  BUILT_IN_GRINDERS,
  calibrateFromTwoPoints,
  convertSetting,
  grindBucket,
  settingToMicrons,
  specToUserGrinder,
  type Grinder,
  type GrinderSpec,
} from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Banner, Empty, Field, Modal } from '../components/ui';
import { Meter } from '../components/charts';

export default function Grinders() {
  const grinders = useApi<Grinder[]>('/grinders');
  const [adding, setAdding] = useState(false);
  const [calibrating, setCalibrating] = useState<Grinder | null>(null);

  const list = grinders.data ?? [];

  async function remove(g: Grinder) {
    await api(`/grinders/${g.id}`, { method: 'DELETE' });
    void grinders.reload();
  }

  async function makeDefault(g: Grinder) {
    await api(`/grinders/${g.id}`, { method: 'PATCH', body: { isDefault: true } });
    void grinders.reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Grinders</h1>
          <p>
            Every grinder speaks its own dialect. Crema translates settings into approximate microns so a shot
            ground on one is comparable to a shot ground on another.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add grinder
        </button>
      </div>

      {list.length >= 2 ? <Converter grinders={list} /> : null}

      {list.length ? (
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          {list.map((g) => {
            const spec = BUILT_IN_GRINDERS.find((s) => s.id === g.builtInId);
            const espresso = spec?.espressoRange;
            return (
              <div key={g.id} className="card">
                <div className="spread" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem' }}>{g.name}</div>
                    <div className="small dim">
                      {g.burrType ?? 'unknown'} burrs
                      {spec?.burrSizeMm ? ` · ${spec.burrSizeMm} mm` : ''} ·{' '}
                      {g.scale.min}–{g.scale.max} {g.scale.unitLabel}
                    </div>
                  </div>
                  {g.isDefault ? (
                    <span className="tag crema">default</span>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => makeDefault(g)}>
                      Make default
                    </button>
                  )}
                </div>

                <div className="divider" />

                <div className="small dim">Micron model</div>
                <div className="mono small" style={{ marginTop: 2 }}>
                  {g.calibration.umPerUnit} µm per {g.scale.unitLabel.replace(/s$/, '')}
                  {g.calibration.interceptUm ? ` + ${g.calibration.interceptUm} µm offset` : ''}
                </div>
                <div className="row-wrap small" style={{ marginTop: 8 }}>
                  <span className={`tag ${g.calibration.source === 'measured' ? 'good' : g.calibration.source === 'estimated' ? 'bad' : ''}`}>
                    {g.calibration.source}
                  </span>
                  {espresso ? (
                    <span className="tag mono">
                      espresso {espresso[0]}–{espresso[1]} ({Math.round(settingToMicrons(g, espresso[0]))}–
                      {Math.round(settingToMicrons(g, espresso[1]))} µm)
                    </span>
                  ) : null}
                </div>

                {g.notes ? (
                  <p className="small faint" style={{ marginTop: 10, marginBottom: 0 }}>
                    {g.notes}
                  </p>
                ) : null}

                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn btn-sm" onClick={() => setCalibrating(g)}>
                    Calibrate
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(g)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title="No grinders yet">Add the one sitting next to your machine.</Empty>
      )}

      {adding ? (
        <Modal title="Add a grinder" onClose={() => setAdding(false)} wide>
          <AddGrinder
            onSaved={() => {
              setAdding(false);
              void grinders.reload();
            }}
          />
        </Modal>
      ) : null}

      {calibrating ? (
        <Modal title={`Calibrate ${calibrating.name}`} onClose={() => setCalibrating(null)}>
          <Calibrate
            grinder={calibrating}
            onSaved={() => {
              setCalibrating(null);
              void grinders.reload();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

/** The headline feature: "I know 4 on the Opus — what is that on the hand grinder?" */
function Converter({ grinders }: { grinders: Grinder[] }) {
  const [fromId, setFromId] = useState(grinders.find((g) => g.isDefault)?.id ?? grinders[0].id);
  const [toId, setToId] = useState(grinders.find((g) => g.id !== (grinders.find((x) => x.isDefault)?.id ?? grinders[0].id))?.id ?? grinders[1].id);
  const [setting, setSetting] = useState('4');

  const from = grinders.find((g) => g.id === fromId)!;
  const to = grinders.find((g) => g.id === toId)!;
  const value = Number(setting);

  const result = useMemo(
    () => (Number.isFinite(value) ? convertSetting(from, value, to) : null),
    [from, to, value],
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2>Grind translator</h2>
        <span className="small faint">approximate — calibrate for better numbers</span>
      </div>

      <div className="grid grid-3">
        <Field label="From">
          <select value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {grinders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Setting (${from.scale.unitLabel})`}>
          <input
            type="number"
            step={from.scale.step}
            min={from.scale.min}
            max={from.scale.max}
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
          />
        </Field>
        <Field label="To">
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            {grinders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {result ? (
        <>
          <div className="row-wrap" style={{ marginTop: 18, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: '2rem' }}>
              {result.setting}
            </span>
            <span className="dim">{to.scale.unitLabel} on the {to.name}</span>
            <span className="tag crema mono">≈ {result.microns} µm</span>
            <span className="tag">{grindBucket(result.microns)}</span>
            <span className={`tag ${result.confidence === 'measured' ? 'good' : result.confidence === 'estimated' ? 'bad' : ''}`}>
              {result.confidence}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <Meter value={result.microns} min={120} max={700} />
            <div className="spread small faint" style={{ marginTop: 4 }}>
              <span>120 µm</span>
              <span>espresso window 200–400 µm</span>
              <span>700 µm</span>
            </div>
          </div>

          {result.outOfRange ? (
            <div style={{ marginTop: 12 }}>
              <Banner kind="bad">
                That grind is off the end of the {to.name}'s dial — clamped to {result.setting}. The two grinders do
                not overlap here.
              </Banner>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function AddGrinder({ onSaved }: { onSaved: () => void }) {
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog');
  const [specId, setSpecId] = useState(BUILT_IN_GRINDERS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({
    name: '',
    unitLabel: 'clicks',
    min: '0',
    max: '40',
    step: '1',
    umPerUnit: '25',
    interceptUm: '150',
  });

  async function save() {
    setError(null);
    try {
      if (mode === 'catalog') {
        const spec = BUILT_IN_GRINDERS.find((s) => s.id === specId) as GrinderSpec;
        const g = specToUserGrinder(spec);
        await api('/grinders', {
          method: 'POST',
          body: { ...g, burrType: spec.burrType, notes: spec.notes ?? null },
        });
      } else {
        await api('/grinders', {
          method: 'POST',
          body: {
            builtInId: null,
            name: custom.name,
            burrType: 'unknown',
            scale: {
              kind: 'clicks',
              min: Number(custom.min),
              max: Number(custom.max),
              step: Number(custom.step),
              unitLabel: custom.unitLabel,
            },
            calibration: {
              umPerUnit: Number(custom.umPerUnit),
              interceptUm: Number(custom.interceptUm),
              source: 'estimated',
            },
          },
        });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const spec = BUILT_IN_GRINDERS.find((s) => s.id === specId)!;

  return (
    <div className="stack">
      <div className="segmented">
        <button className={mode === 'catalog' ? 'on' : ''} onClick={() => setMode('catalog')}>
          From the catalogue
        </button>
        <button className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
          Custom grinder
        </button>
      </div>

      {mode === 'catalog' ? (
        <>
          <Field label="Grinder">
            <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
              {BUILT_IN_GRINDERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.model} {s.handPowered ? '(hand)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="card tight">
            <div className="row-wrap small">
              <span className="tag">{spec.burrType} burrs</span>
              {spec.burrSizeMm ? <span className="tag mono">{spec.burrSizeMm} mm</span> : null}
              <span className="tag mono">
                {spec.scale.min}–{spec.scale.max} {spec.scale.unitLabel}
              </span>
              <span className="tag mono">{spec.calibration.umPerUnit} µm / step</span>
              <span className={`tag ${spec.calibration.source === 'measured' ? 'good' : ''}`}>
                {spec.calibration.source}
              </span>
            </div>
            {spec.notes ? (
              <p className="small dim" style={{ marginBottom: 0, marginTop: 10 }}>
                {spec.notes}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Field label="Name">
            <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Shop grinder" />
          </Field>
          <div className="grid grid-4">
            <Field label="Unit label">
              <input value={custom.unitLabel} onChange={(e) => setCustom({ ...custom, unitLabel: e.target.value })} />
            </Field>
            <Field label="Min">
              <input type="number" value={custom.min} onChange={(e) => setCustom({ ...custom, min: e.target.value })} />
            </Field>
            <Field label="Max">
              <input type="number" value={custom.max} onChange={(e) => setCustom({ ...custom, max: e.target.value })} />
            </Field>
            <Field label="Step">
              <input type="number" step="0.1" value={custom.step} onChange={(e) => setCustom({ ...custom, step: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-2">
            <Field label="µm per step" hint="Rough is fine — calibrate later.">
              <input type="number" step="0.1" value={custom.umPerUnit} onChange={(e) => setCustom({ ...custom, umPerUnit: e.target.value })} />
            </Field>
            <Field label="µm at setting zero">
              <input type="number" value={custom.interceptUm} onChange={(e) => setCustom({ ...custom, interceptUm: e.target.value })} />
            </Field>
          </div>
        </>
      )}

      {error ? <Banner kind="bad">{error}</Banner> : null}

      <div>
        <button className="btn btn-primary" onClick={save}>
          Add to my shelf
        </button>
      </div>
    </div>
  );
}

/**
 * Two-point calibration. You do not need a laser particle sizer: pick two
 * settings you know well and say what they behave like, and the line through
 * them beats our estimate every time.
 */
function Calibrate({ grinder, onSaved }: { grinder: Grinder; onSaved: () => void }) {
  const [a, setA] = useState({ setting: String(grinder.scale.min + grinder.scale.step * 2), microns: '250' });
  const [b, setB] = useState({ setting: String(grinder.scale.min + grinder.scale.step * 10), microns: '450' });
  const [error, setError] = useState<string | null>(null);

  let preview: ReturnType<typeof calibrateFromTwoPoints> | null = null;
  try {
    preview = calibrateFromTwoPoints(
      { setting: Number(a.setting), microns: Number(a.microns) },
      { setting: Number(b.setting), microns: Number(b.microns) },
    );
  } catch {
    preview = null;
  }

  async function save() {
    if (!preview) {
      setError('Use two different settings.');
      return;
    }
    try {
      await api(`/grinders/${grinder.id}`, { method: 'PATCH', body: { calibration: preview } });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <p className="small dim" style={{ margin: 0 }}>
        Give two settings you have a feel for and the particle size each behaves like. Espresso lands around
        200–400 µm; a good pour over is 600–800 µm. The line through your two points replaces our estimate.
      </p>

      {[
        { label: 'Reference point A', state: a, set: setA },
        { label: 'Reference point B', state: b, set: setB },
      ].map(({ label, state, set }) => (
        <div key={label} className="grid grid-2">
          <Field label={`${label} — setting`}>
            <input type="number" step={grinder.scale.step} value={state.setting} onChange={(e) => set({ ...state, setting: e.target.value })} />
          </Field>
          <Field label="behaves like (µm)">
            <input type="number" step="10" value={state.microns} onChange={(e) => set({ ...state, microns: e.target.value })} />
          </Field>
        </div>
      ))}

      {preview ? (
        <Banner kind="good">
          <span className="mono">
            {preview.umPerUnit.toFixed(1)} µm per {grinder.scale.unitLabel.replace(/s$/, '')}
            {preview.interceptUm ? `, ${preview.interceptUm.toFixed(0)} µm at zero` : ''}
          </span>
          {' — was '}
          <span className="mono">{grinder.calibration.umPerUnit} µm</span>
        </Banner>
      ) : (
        <Banner kind="bad">Pick two different settings.</Banner>
      )}

      {error ? <Banner kind="bad">{error}</Banner> : null}

      <div>
        <button className="btn btn-primary" onClick={save} disabled={!preview}>
          Save calibration
        </button>
      </div>
    </div>
  );
}
