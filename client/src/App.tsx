import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { MachineCapabilities } from '@brewlab/shared';
import { useAuth } from './lib/auth';
import { useMachines } from './lib/machines';
import { useTheme, type ThemePref } from './lib/theme';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Shots from './pages/Shots';
import Coffees from './pages/Coffees';
import CoffeeDetail from './pages/CoffeeDetail';
import Explore from './pages/Explore';
import Grinders from './pages/Grinders';
import Machines from './pages/Machines';
import Profiles from './pages/Profiles';
import ProfileEditor from './pages/ProfileEditor';
import Fellow from './pages/Fellow';
import BrandLockup from './components/BrandLockup';

function navFor(caps: MachineCapabilities) {
  const groups = [
    { section: 'Brewing', links: [
      { to: '/', label: 'Dashboard', icon: '◎', end: true, show: true },
      { to: '/shots', label: 'Shot log', icon: '⏱', show: true },
      { to: '/profiles', label: 'Profiles', icon: '◠', show: caps.profiling !== 'none' },
    ]},
    { section: 'Equipment', links: [
      { to: '/machines', label: 'Machines', icon: '☕︎', show: true },
      { to: '/grinders', label: 'Grinders', icon: '⚙', show: true },
    ]},
    { section: 'Library', links: [
      { to: '/coffees', label: 'My coffees', icon: '☕', show: true },
      { to: '/explore', label: 'Explore', icon: '✧', show: true },
    ]},
    { section: 'Account', links: [
      { to: '/fellow', label: 'Fellow account', icon: '⌁', show: caps.cloud === 'fellow' },
    ]},
  ];
  return groups
    .map((g) => ({ ...g, links: g.links.filter((l) => l.show) }))
    .filter((g) => g.links.length > 0);
}

const THEMES: { value: ThemePref; label: string; title: string }[] = [
  { value: 'light', label: '☀', title: 'Light' },
  { value: 'dark', label: '☾', title: 'Dark' },
  { value: 'auto', label: 'A', title: 'Match the system' },
];

function ThemeToggle() {
  const { pref, setPref } = useTheme();
  return (
    <div className="segmented theme-toggle" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          className={pref === t.value ? 'on' : ''}
          onClick={() => setPref(t.value)}
          title={t.title}
          aria-label={t.title}
          aria-pressed={pref === t.value}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { capabilities } = useMachines();
  const nav = navFor(capabilities);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLockup />
          <div className="brand-sub">ES1 Brew Lab</div>
        </div>

        <nav className="nav">
          {nav.map((group) => (
            <div key={group.section}>
              <div className="nav-label">{group.section}</div>
              {group.links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end}>
                  <span className="nav-icon">{l.icon}</span>
                  {l.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <ThemeToggle />
          <div className="small dim" style={{ padding: '0 8px 8px' }}>
            {user?.displayName}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  const { capabilities, ready: benchReady } = useMachines();

  if (!ready || (user && !benchReady)) {
    return (
      <div className="auth-wrap">
        <span className="faint">Warming up…</span>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/shots" element={<Shots />} />
        <Route path="/coffees" element={<Coffees />} />
        <Route path="/coffees/:id" element={<CoffeeDetail />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/grinders" element={<Grinders />} />
        <Route path="/machines" element={<Machines />} />
        {capabilities.profiling !== 'none' ? (
          <>
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/profiles/new" element={<ProfileEditor />} />
            <Route path="/profiles/:id" element={<ProfileEditor />} />
          </>
        ) : null}
        {capabilities.cloud === 'fellow' ? <Route path="/fellow" element={<Fellow />} /> : null}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
