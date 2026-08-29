import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  suggestNextShot,
  type BrewProfileRecord,
  type Coffee,
  type Grinder,
  type Shot,
  type Suggestion,
} from '@brewlab/shared';
import { useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Banner, Empty, Modal, Stars, Stat } from '../components/ui';
import ShotForm from '../components/ShotForm';
import { DialInChart } from '../components/charts';
import { fmt, relativeDate } from '../lib/format';

interface Stats {
  total: number;
  avgRating: number | null;
  avgTimeS: number | null;
  avgRatio: number | null;
  goodShots: number;
  activeDaysLast30: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const shots = useApi<Shot[]>('/shots?limit=200');
  const stats = useApi<Stats>('/shots/meta/stats');
  const coffees = useApi<Coffee[]>('/coffees');
  const grinders = useApi<Grinder[]>('/grinders');
  const profiles = useApi<BrewProfileRecord[]>('/profiles');

  const [logging, setLogging] = useState(false);
  const [justSaved, setJustSaved] = useState<{ shot: Shot; suggestion: Suggestion } | null>(null);

  const latest = shots.data?.[0] ?? null;
  const suggestion = useMemo(() => (latest ? suggestNextShot(latest) : null), [latest]);

  const activeCoffeeShots = useMemo(() => {
    if (!shots.data || !latest?.coffeeId) return [];
    return shots.data.filter((s) => s.coffeeId === latest.coffeeId);
  }, [shots.data, latest]);

  function refreshAll() {
    void shots.reload();
    void stats.reload();
  }

  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening';

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>
            {greeting}, {user?.displayName}
          </h1>
          <p>
            {latest
              ? `Last pull: ${relativeDate(latest.brewedAt)} — ${latest.coffeeName ?? 'unnamed coffee'}.`
              : 'No shots logged yet. Pull one and write it down.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setLogging(true)}>
          Log a shot
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <Stat label="Shots logged" value={stats.data?.total ?? '—'} note={`${stats.data?.goodShots ?? 0} rated 4★ or better`} />
        <Stat label="Average time" value={fmt(stats.data?.avgTimeS)} unit="s" />
        <Stat label="Average ratio" value={stats.data?.avgRatio ? `1:${fmt(stats.data.avgRatio, 2)}` : '—'} />
        <Stat label="Days brewing" value={stats.data?.activeDaysLast30 ?? '—'} note="in the last 30" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>What to change next</h2>
            {latest ? <span className="small faint">{relativeDate(latest.brewedAt)}</span> : null}
          </div>
          {latest && suggestion ? (
            <div className="stack">
              <div>
                <div style={{ fontSize: '1.15rem', color: 'var(--crema)' }}>{suggestion.headline}</div>
                <p className="dim small" style={{ margin: '6px 0 0' }}>
                  {suggestion.reason}
                </p>
              </div>
              <div className="row-wrap small">
                <span className="tag">{latest.grinderName ?? 'no grinder'}</span>
                {latest.grindSetting != null ? (
                  <span className="tag crema mono">
                    {latest.grindSetting}
                    {latest.grindMicrons ? ` · ${latest.grindMicrons}µm` : ''}
                  </span>
                ) : null}
                <span className="tag mono">
                  {fmt(latest.doseG)} → {fmt(latest.yieldG)} g
                </span>
                <span className="tag mono">{fmt(latest.shotTimeS)}s</span>
                <Stars value={latest.rating} />
              </div>
              <div className={`tag ${suggestion.confidence === 'high' ? 'good' : suggestion.confidence === 'low' ? '' : 'crema'}`} style={{ alignSelf: 'flex-start' }}>
                {suggestion.confidence} confidence
              </div>
            </div>
          ) : (
            <Empty title="Nothing to go on yet">Log a shot and this becomes your dial-in coach.</Empty>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Dial-in progress</h2>
            {latest?.coffeeId ? (
              <Link className="small dim" to={`/coffees/${latest.coffeeId}`}>
                {latest.coffeeName} →
              </Link>
            ) : null}
          </div>
          {activeCoffeeShots.length >= 2 ? (
            <DialInChart shots={activeCoffeeShots} />
          ) : (
            <Empty title="Two shots and a story appears">
              Shot time over successive pulls, coloured by how each one tasted.
            </Empty>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>Recent shots</h2>
          <Link className="small dim" to="/shots">
            All shots →
          </Link>
        </div>
        {shots.data?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Coffee</th>
                <th>Grind</th>
                <th className="num">Dose → Yield</th>
                <th className="num">Time</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {shots.data.slice(0, 6).map((s) => (
                <tr key={s.id}>
                  <td data-label="When" className="dim">{relativeDate(s.brewedAt)}</td>
                  <td data-label="Coffee">{s.coffeeName ?? <span className="faint">—</span>}</td>
                  <td data-label="Grind" className="num dim">
                    {s.grindSetting ?? '—'}
                    {s.grindMicrons ? <span className="faint"> · {s.grindMicrons}µm</span> : null}
                  </td>
                  <td data-label="Dose → Yield" className="num">
                    {fmt(s.doseG)} → {fmt(s.yieldG)}
                  </td>
                  <td data-label="Time" className="num">{fmt(s.shotTimeS)}s</td>
                  <td data-label="Rating">
                    <Stars value={s.rating} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No shots yet" />
        )}
      </div>

      {logging ? (
        <Modal title="Log a shot" onClose={() => setLogging(false)} wide>
          <ShotForm
            coffees={coffees.data ?? []}
            grinders={grinders.data ?? []}
            profiles={profiles.data ?? []}
            basedOn={latest}
            onSaved={(shot, s) => {
              setLogging(false);
              setJustSaved({ shot, suggestion: s });
              refreshAll();
            }}
          />
        </Modal>
      ) : null}

      {justSaved ? (
        <Modal title="Shot logged" onClose={() => setJustSaved(null)}>
          <div className="stack">
            <Banner kind="good">{justSaved.suggestion.headline}</Banner>
            <p className="dim small" style={{ margin: 0 }}>
              {justSaved.suggestion.reason}
            </p>
            <button className="btn" onClick={() => setJustSaved(null)}>
              Got it
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
