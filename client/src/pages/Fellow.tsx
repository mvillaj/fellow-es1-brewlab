import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Es1Profile, FellowConnectionStatus, ProfileOrigin } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { Banner, Empty, Field } from '../components/ui';
import { tempF } from '../lib/format';

interface RemoteProfile {
  remoteId: string;
  name: string;
  origin: ProfileOrigin;
  editable: boolean;
  profile: Es1Profile;
}

const ORIGIN_TAG: Record<ProfileOrigin, { cls: string; label: string }> = {
  factory: { cls: '', label: "Fellow's own" },
  drop: { cls: 'cool', label: 'Drop' },
  custom: { cls: 'crema', label: 'Yours' },
  local: { cls: '', label: 'local' },
};

export default function Fellow() {
  const status = useApi<FellowConnectionStatus>('/fellow/status');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState<unknown>(null);
  const [remote, setRemote] = useState<{ deviceId: string; list: RemoteProfile[] } | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const navigate = useNavigate();

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/fellow/connect', { method: 'POST', body: { email, password } });
      setPassword('');
      void status.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await api('/fellow/disconnect', { method: 'POST' });
    void status.reload();
  }

  async function dumpProfiles(deviceId: string) {
    try {
      setRaw(await api(`/fellow/devices/${deviceId}/profiles`));
    } catch (err) {
      setRaw({ error: (err as Error).message });
    }
  }

  async function loadProfiles(deviceId: string) {
    setFlash(null);
    try {
      const list = await api<RemoteProfile[]>(`/fellow/devices/${deviceId}/profiles/parsed`);
      setRemote({ deviceId, list });
    } catch (err) {
      setFlash((err as Error).message);
    }
  }

  async function importProfile(deviceId: string, p: RemoteProfile) {
    setImporting(p.remoteId);
    try {
      const saved = await api<{ id: string }>(`/fellow/import/${deviceId}/${p.remoteId}`, {
        method: 'POST',
      });
      navigate(`/profiles/${saved.id}`);
    } catch (err) {
      setFlash((err as Error).message);
    } finally {
      setImporting(null);
    }
  }

  const s = status.data;

  return (
    <>
      <div className="page-head">
        <h1>Fellow account</h1>
        <p>
          Connect the account your ES1 is paired with, then push profiles to it from the editor. Your password is
          used for the sign-in call and is never stored; the access token it returns is.
        </p>
        <p className="small faint">
          Crema is an independent project, not affiliated with, endorsed by or supported by Fellow. It talks to
          Fellow's private API, which can change or stop working without notice.
        </p>
      </div>

      {s?.warning ? (
        <div style={{ marginBottom: 16 }}>
          <Banner kind={s.mode === 'live' ? 'bad' : 'info'}>
            <strong>{s.mode === 'live' ? 'Live mode' : 'Simulated'}</strong> — {s.warning}
          </Banner>
        </div>
      ) : null}

      {s?.connected ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="spread">
              <div>
                <div className="stat-label">Connected as</div>
                <div className="mono">{s.email}</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Devices</h2>
              <span className="small faint">{s.devices.length} on this account</span>
            </div>
            {s.devices.length ? (
              <div className="stack-sm">
                {s.devices.map((d) => (
                  <div key={d.id} className="list-item">
                    <div className="spread">
                      <div>
                        <div style={{ fontSize: '1.02rem' }}>{d.displayName}</div>
                        <div className="small dim mono">
                          {d.model}
                          {d.firmware ? ` · fw ${d.firmware}` : ''} · {d.id}
                        </div>
                      </div>
                      <div className="row">
                        <span className={`tag ${d.supportsEspressoProfiles ? 'good' : ''}`}>
                          {d.supportsEspressoProfiles ? 'espresso profiles' : 'not an espresso machine'}
                        </span>
                        {d.supportsEspressoProfiles ? (
                          <button className="btn btn-sm" onClick={() => loadProfiles(d.id)}>
                            Profiles on this machine
                          </button>
                        ) : null}
                        <button className="btn btn-ghost btn-sm" onClick={() => dumpProfiles(d.id)}>
                          Raw JSON
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No devices on that account" />
            )}
          </div>

          {flash ? (
            <div style={{ marginTop: 16 }}>
              <Banner kind="bad">{flash}</Banner>
            </div>
          ) : null}

          {remote ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head">
                <h2>Profiles on this machine</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setRemote(null)}>
                  Close
                </button>
              </div>
              <p className="small dim">
                Importing copies a profile onto your shelf. Fellow's own profiles are read-only — editing one and
                sending it back saves a new profile in your custom folder rather than overwriting the original.
              </p>
              {remote.list.length ? (
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  {remote.list.map((p) => (
                    <div className="list-item spread" key={p.remoteId}>
                      <div style={{ minWidth: 0 }}>
                        <div className="row-wrap" style={{ gap: 8 }}>
                          <strong>{p.name}</strong>
                          <span className={`tag ${ORIGIN_TAG[p.origin].cls}`}>{ORIGIN_TAG[p.origin].label}</span>
                          {!p.editable ? <span className="tag">read-only</span> : null}
                        </div>
                        <div className="small dim mono" style={{ marginTop: 4 }}>
                          {p.remoteId} · {p.profile.stages.length} stages · {tempF(p.profile.brewTempC)}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm"
                        disabled={importing === p.remoteId}
                        onClick={() => importProfile(remote.deviceId, p)}
                      >
                        {importing === p.remoteId ? 'Importing…' : 'Import'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="No profiles on this machine yet" />
              )}
            </div>
          ) : null}

          {raw ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head">
                <h2>Raw response</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setRaw(null)}>
                  Clear
                </button>
              </div>
              <p className="small dim">
                The wire format is captured, but this is still the quickest way to see exactly what the API
                returns for an account.
              </p>
              <pre
                className="mono small"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  overflowX: 'auto',
                  maxHeight: 380,
                }}
              >
                {JSON.stringify(raw, null, 2)}
              </pre>
            </div>
          ) : null}
        </>
      ) : (
        <div className="card" style={{ maxWidth: 460 }}>
          <div className="card-head">
            <h2>Connect</h2>
          </div>
          <form onSubmit={connect} className="stack">
            <Field label="Fellow email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Fellow password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error ? <Banner kind="bad">{error}</Banner> : null}
            <div>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            {s?.mode === 'mock' ? (
              <p className="small faint" style={{ margin: 0 }}>
                In simulated mode any email and a password of four or more characters will connect you to a fake ES1.
              </p>
            ) : null}
          </form>
        </div>
      )}
    </>
  );
}
