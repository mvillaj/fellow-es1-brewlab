import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STOCK_PROFILES, totalDurationS, yieldG, type BrewProfileRecord } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Empty, Modal } from '../components/ui';
import { ProfileCurve } from '../components/charts';
import { tempF } from '../lib/format';

const ORIGIN_TAG: Partial<Record<BrewProfileRecord['origin'], { cls: string; label: string }>> = {
  factory: { cls: '', label: "from Fellow's own" },
  drop: { cls: 'cool', label: 'from a Drop' },
  custom: { cls: 'crema', label: 'on your machine' },
};

const SYNC_TAG: Record<BrewProfileRecord['syncState'], { cls: string; label: string }> = {
  local: { cls: '', label: 'not sent' },
  pushed: { cls: 'good', label: 'on the machine' },
  stale: { cls: 'bad', label: 'edited since sending' },
};

export default function Profiles() {
  const profiles = useApi<BrewProfileRecord[]>('/profiles');
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);

  async function createFromStock(name: string) {
    const stock = STOCK_PROFILES.find((p) => p.name === name)!;
    const created = await api<BrewProfileRecord>('/profiles', {
      method: 'POST',
      body: {
        name: stock.name,
        description: stock.description,
        isPublic: false,
        profile: { ...stock, id: 'pending' },
      },
    });
    navigate(`/profiles/${created.id}`);
  }

  async function remove(p: BrewProfileRecord) {
    await api(`/profiles/${p.id}`, { method: 'DELETE' });
    void profiles.reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Brew profiles</h1>
          <p>
            Shots the ES1 runs as timed phases: each one targets a pressure and the machine modulates flow to hold
            it. Build one here, then send it to your Fellow account.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setPicking(true)}>
          New profile
        </button>
      </div>

      {profiles.data?.length ? (
        <div className="grid grid-2">
          {profiles.data.map((p) => (
            <div key={p.id} className="card">
              <div className="spread" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <Link to={`/profiles/${p.id}`} style={{ fontSize: '1.05rem' }}>
                    {p.name}
                  </Link>
                  {p.description ? <div className="small dim">{p.description}</div> : null}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(p)}>
                  ✕
                </button>
              </div>

              <ProfileCurve profile={p.profile} height={150} />

              <div className="row-wrap small" style={{ marginTop: 10 }}>
                <span className="tag mono">{tempF(p.profile.brewTempC)}</span>
                <span className="tag mono">
                  {p.profile.doseG} → {yieldG(p.profile)} g
                </span>
                <span className="tag mono">{totalDurationS(p.profile)}s</span>
                <span className="tag">{p.profile.stages.length} stages</span>
                <span className={`tag ${SYNC_TAG[p.syncState].cls}`}>{SYNC_TAG[p.syncState].label}</span>
                {ORIGIN_TAG[p.origin] ? (
                  <span className={`tag ${ORIGIN_TAG[p.origin]!.cls}`}>{ORIGIN_TAG[p.origin]!.label}</span>
                ) : null}
                {p.isPublic ? <span className="tag crema">shared</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No profiles yet">Start from one of Fellow's factory profiles and bend it to your coffee.</Empty>
      )}

      {picking ? (
        <Modal title="Start from" onClose={() => setPicking(false)} wide>
          <div className="grid grid-2">
            <button className="list-item" onClick={() => navigate('/profiles/new')}>
              <div style={{ fontSize: '1.02rem' }}>Blank profile</div>
              <div className="small dim">Pre-infusion, infusion, ramp down — then change everything.</div>
            </button>
            {STOCK_PROFILES.map((s) => (
              <button key={s.name} className="list-item" onClick={() => createFromStock(s.name)}>
                <div className="spread">
                  <span style={{ fontSize: '1.02rem' }}>{s.name}</span>
                  <span className="tag mono">{tempF(s.brewTempC)}</span>
                </div>
                <div className="small dim" style={{ marginTop: 4 }}>
                  {s.description}
                </div>
                <div className="row-wrap small" style={{ marginTop: 8 }}>
                  <span className="tag mono">1:{s.ratio}</span>
                  <span className="tag mono">{totalDurationS(s)}s</span>
                  <span className="tag">{s.stages.length} stages</span>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
