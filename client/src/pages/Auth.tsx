import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Banner, Field } from '../components/ui';
import BrandLockup from '../components/BrandLockup';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password, displayName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-hero">
          <BrandLockup heading />
          <p className="dim small" style={{ marginTop: 6 }}>
            Track every shot you pull — across machines, grinders, coffees and profiles.
          </p>
        </div>

        <div className="card">
          <div className="segmented" style={{ width: '100%', marginBottom: 18 }}>
            <button className={mode === 'login' ? 'on grow' : 'grow'} onClick={() => setMode('login')}>
              Sign in
            </button>
            <button className={mode === 'signup' ? 'on grow' : 'grow'} onClick={() => setMode('signup')}>
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="stack">
            {mode === 'signup' ? (
              <Field label="Name">
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="name" />
              </Field>
            ) : null}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </Field>

            {error ? <Banner kind="bad">{error}</Banner> : null}

            <button className="btn btn-primary" disabled={busy} style={{ justifyContent: 'center' }}>
              {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="small faint center" style={{ marginTop: 16 }}>
          Seeded demo: <span className="mono">michael@example.com</span> /{' '}
          <span className="mono">espresso123</span>
        </p>
      </div>
    </div>
  );
}
