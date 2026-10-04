import { Link, useNavigate } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/clerk-react';
import BrandLockup from '../components/BrandLockup';
import { useClerkAppearance } from '../lib/clerkAppearance';

/**
 * The form itself is Clerk's now — this page keeps the hero and the segmented
 * control so the front door still looks like the rest of the app. Each mode has
 * its own URL (/sign-in, /sign-up) so the landing page can link straight to it.
 */
export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const navigate = useNavigate();
  const setMode = (m: 'login' | 'signup') => navigate(m === 'login' ? '/sign-in' : '/sign-up', { replace: true });
  const appearance = useClerkAppearance();

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-hero">
          <Link to="/" aria-label="Crema home">
            <BrandLockup heading />
          </Link>
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
            <SignIn routing="virtual" appearance={appearance} />
          ) : (
            <SignUp routing="virtual" appearance={appearance} />
          )}
        </div>
      </div>
    </div>
  );
}
