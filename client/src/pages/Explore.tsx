import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BrewProfileRecord, Coffee } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { useMachines } from '../lib/machines';
import { Banner, Empty, Segmented } from '../components/ui';
import CoffeeCard from '../components/CoffeeCard';
import { ProfileCurve } from '../components/charts';
import { ROAST_LEVELS, tempF } from '../lib/format';
import { totalDurationS, yieldG } from '@brewlab/shared';

export default function Explore() {
  const { capabilities } = useMachines();
  // Shared profiles are only browsable if you own something that could run one.
  const canProfile = capabilities.profiling !== 'none';
  const [tab, setTab] = useState<'coffees' | 'profiles'>('coffees');
  // Losing the capability while parked on the profiles tab should land you
  // back on coffees, not on an empty panel.
  const activeTab = canProfile ? tab : 'coffees';
  const [q, setQ] = useState('');
  const [roast, setRoast] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (roast) params.set('roast', roast);
  const coffees = useApi<Coffee[]>(`/coffees/public?${params}`, [q, roast]);
  const profiles = useApi<BrewProfileRecord[]>(canProfile ? '/profiles/public' : null);

  async function cloneCoffee(c: Coffee) {
    await api(`/coffees/${c.id}/clone`, { method: 'POST' });
    setFlash(`"${c.name}" is on your shelf.`);
  }

  async function cloneProfile(p: BrewProfileRecord) {
    await api(`/profiles/${p.id}/clone`, { method: 'POST' });
    setFlash(`"${p.name}" copied into your profiles.`);
  }

  return (
    <>
      <div className="page-head">
        <h1>Explore</h1>
        <p>
          {canProfile ? 'Coffees and profiles' : 'Coffees'} other people have published. Clone anything onto
          your own shelf.
        </p>
      </div>

      <div className="row-wrap" style={{ marginBottom: 16 }}>
        {canProfile ? (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'coffees', label: 'Coffees' },
              { value: 'profiles', label: 'Profiles' },
            ]}
          />
        ) : null}
        {activeTab === 'coffees' ? (
          <>
            <input
              placeholder="Search roaster, origin, varietal…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 320 }}
            />
            <select value={roast} onChange={(e) => setRoast(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">Any roast level</option>
              {ROAST_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      {flash ? (
        <div style={{ marginBottom: 16 }}>
          <Banner kind="good">{flash}</Banner>
        </div>
      ) : null}

      {activeTab === 'coffees' ? (
        coffees.data?.length ? (
          <div className="grid grid-2">
            {coffees.data.map((c) => (
              <CoffeeCard
                key={c.id}
                coffee={c}
                action={
                  <button className="btn btn-sm" onClick={() => cloneCoffee(c)}>
                    Clone
                  </button>
                }
              />
            ))}
          </div>
        ) : (
          <Empty title="Nothing published yet">Publish one of your own coffees to get this started.</Empty>
        )
      ) : profiles.data?.length ? (
        <div className="grid grid-2">
          {profiles.data.map((p) => (
            <div key={p.id} className="card">
              <div className="spread" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <Link to={`/profiles/${p.id}`} style={{ fontSize: '1.05rem' }}>
                    {p.name}
                  </Link>
                  <div className="small faint">by {p.ownerName}</div>
                </div>
                <button className="btn btn-sm" onClick={() => cloneProfile(p)}>
                  Clone
                </button>
              </div>
              <ProfileCurve profile={p.profile} height={150} />
              <div className="row-wrap small" style={{ marginTop: 10 }}>
                <span className="tag mono">{tempF(p.profile.brewTempC)}</span>
                <span className="tag mono">
                  {p.profile.doseG} → {yieldG(p.profile)} g
                </span>
                <span className="tag mono">1:{p.profile.ratio}</span>
                <span className="tag mono">{totalDurationS(p.profile)}s</span>
                <span className="tag">{p.profile.stages.length} stages</span>
              </div>
              {p.description ? (
                <p className="small dim" style={{ marginBottom: 0 }}>
                  {p.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No shared profiles yet" />
      )}
    </>
  );
}
