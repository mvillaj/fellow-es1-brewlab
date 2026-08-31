import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import BrandLockup from '../components/BrandLockup';

/**
 * The form itself is Clerk's now — this page keeps the hero and the segmented
 * control so the front door still looks like the rest of the app.
 */
export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-hero">
          <BrandLockup heading />
          <p className="dim small" style={{ marginTop: 6 }}>
            Track every shot you pull — across machines, grinders, coffees and profiles.
          </p>
        </div>

        <div className="segmented" style={{ width: '100%', marginBottom: 18 }}>
          <button className={mode === 'login' ? 'on grow' : 'grow'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'on grow' : 'grow'}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
        </div>

        <div className="center">
          {mode === 'login' ? (
            <SignIn routing="virtual" />
          ) : (
            <SignUp routing="virtual" />
          )}
        </div>
      </div>
    </div>
  );
}
