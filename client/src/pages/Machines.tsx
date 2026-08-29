import { useState } from 'react';
import { BUILT_IN_MACHINES, specToUserMachine, type Machine, type MachineSpec } from '@brewlab/shared';
import { api } from '../lib/api';
import { useMachines } from '../lib/machines';
import { Banner, Empty, Field, Modal } from '../components/ui';
import { fToC, roundF } from '../lib/format';

/** What each capability means in the sidebar, in words rather than flags. */
function CapabilityTags({ m }: { m: Machine }) {
  return (
    <div className="row-wrap small">
      {m.capabilities.profiling === 'pressure' ? (
        <span className="tag crema">pressure profiling</span>
      ) : (
        <span className="tag">no profiling</span>
      )}
      {m.capabilities.cloud === 'fellow' ? <span className="tag cool">Fellow account</span> : null}
      <span className="tag mono">
        {roundF(m.limits.tempC.min)}–{roundF(m.limits.tempC.max)} °F
      </span>
      <span className="tag mono">{m.limits.maxPressureBar} bar</span>
    </div>
  );
}

export default function Machines() {
  const { machines, reload } = useMachines();
  const [adding, setAdding] = useState(false);

  async function remove(m: Machine) {
    await api(`/machines/${m.id}`, { method: 'DELETE' });
    void reload();
  }

  async function makeDefault(m: Machine) {
    await api(`/machines/${m.id}`, { method: 'PATCH', body: { isDefault: true } });
    void reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Machines</h1>
          <p>
            What you pull shots on. The default machine sets the temperature range the shot log will accept, and
            decides whether the profile studio and a vendor account are any use to you.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add machine
        </button>
      </div>

      {machines.length ? (
        <div className="grid grid-2">
          {machines.map((m) => (
            <div className="card" key={m.id}>
              <div className="card-head">
                <h3>{m.name}</h3>
                {m.isDefault ? (
                  <span className="tag crema">default</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => makeDefault(m)}>
                    Make default
                  </button>
                )}
              </div>
              <CapabilityTags m={m} />
              {m.notes ? (
                <p className="small dim" style={{ marginTop: 12, marginBottom: 0 }}>
                  {m.notes}
                </p>
              ) : null}
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(m)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No machines yet">Add the one you actually pull shots on.</Empty>
      )}

      {adding ? (
        <Modal title="Add a machine" onClose={() => setAdding(false)} wide>
          <AddMachine
            onSaved={() => {
              setAdding(false);
              void reload();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

function AddMachine({ onSaved }: { onSaved: () => void }) {
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog');
  const [specId, setSpecId] = useState(BUILT_IN_MACHINES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState({
    name: '',
    tempMin: '176',
    tempMax: '221',
    maxPressureBar: '15',
    profiling: 'none' as 'none' | 'pressure',
  });

  const spec = BUILT_IN_MACHINES.find((s) => s.id === specId) as MachineSpec;

  async function save() {
    setError(null);
    try {
      if (mode === 'catalog') {
        const m = specToUserMachine(spec);
        await api('/machines', { method: 'POST', body: { ...m, notes: spec.notes ?? null } });
      } else {
        await api('/machines', {
          method: 'POST',
          body: {
            builtInId: null,
            name: custom.name,
            // A machine we know nothing about gets no cloud: there is no vendor
            // API to talk to, and guessing one would only produce a dead page.
            capabilities: { profiling: custom.profiling, cloud: null },
            limits: {
              tempC: { min: fToC(Number(custom.tempMin)), max: fToC(Number(custom.tempMax)) },
              maxPressureBar: Number(custom.maxPressureBar),
            },
          },
        });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="segmented">
        <button className={mode === 'catalog' ? 'on' : ''} onClick={() => setMode('catalog')}>
          From the catalogue
        </button>
        <button className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
          Custom machine
        </button>
      </div>

      {mode === 'catalog' ? (
        <>
          <Field label="Machine">
            <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
              {BUILT_IN_MACHINES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.model}
                </option>
              ))}
            </select>
          </Field>
          <div className="card tight">
            <div className="row-wrap small">
              {spec.capabilities.profiling === 'pressure' ? (
                <span className="tag crema">pressure profiling</span>
              ) : (
                <span className="tag">no profiling</span>
              )}
              {spec.capabilities.cloud === 'fellow' ? <span className="tag cool">Fellow account</span> : null}
              <span className="tag mono">
                {roundF(spec.limits.tempC.min)}–{roundF(spec.limits.tempC.max)} °F
              </span>
              <span className="tag mono">{spec.limits.maxPressureBar} bar</span>
            </div>
            {spec.notes ? (
              <p className="small dim" style={{ marginTop: 10, marginBottom: 0 }}>
                {spec.notes}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Field label="Name">
            <input
              type="text"
              value={custom.name}
              onChange={(e) => setCustom({ ...custom, name: e.target.value })}
              placeholder="Gaggia Classic"
            />
          </Field>
          <div className="grid grid-3">
            <Field label="Min temp (°F)">
              <input
                type="number"
                value={custom.tempMin}
                onChange={(e) => setCustom({ ...custom, tempMin: e.target.value })}
              />
            </Field>
            <Field label="Max temp (°F)">
              <input
                type="number"
                value={custom.tempMax}
                onChange={(e) => setCustom({ ...custom, tempMax: e.target.value })}
              />
            </Field>
            <Field label="Max pressure (bar)">
              <input
                type="number"
                step="0.1"
                value={custom.maxPressureBar}
                onChange={(e) => setCustom({ ...custom, maxPressureBar: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Pressure profiling"
            hint="Only turn this on if your machine runs a shot as timed, pressure-targeted phases."
          >
            <select
              value={custom.profiling}
              onChange={(e) => setCustom({ ...custom, profiling: e.target.value as 'none' | 'pressure' })}
            >
              <option value="none">No — one pump, one pressure</option>
              <option value="pressure">Yes — timed pressure phases</option>
            </select>
          </Field>
        </>
      )}

      {error ? <Banner kind="bad">{error}</Banner> : null}

      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={mode === 'custom' && !custom.name.trim()}>
          Add to my bench
        </button>
      </div>
    </div>
  );
}
