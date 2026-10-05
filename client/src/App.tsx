import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Bean,
  CloudCog,
  Coffee as CoffeeIcon,
  Compass,
  Cog,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Plus,
  Sun,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { MachineCapabilities } from '@brewlab/shared';
import { useAuth } from './lib/auth';
import { useMachines } from './lib/machines';
import { FINISHES, useTheme, type ThemePref } from './lib/theme';
import AuthPage from './pages/Auth';
import Landing from './pages/Landing';
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
import Changelog from './pages/Changelog';
import BrandLockup from './components/BrandLockup';

interface NavLinkDef {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  show: boolean;
}

function navFor(caps: MachineCapabilities) {
  const groups: { section: string; links: NavLinkDef[] }[] = [
    { section: 'Brewing', links: [
      { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true, show: true },
      { to: '/shots', label: 'Shot log', icon: History, show: true },
      { to: '/profiles', label: 'Profiles', icon: Waves, show: caps.profiling !== 'none' },
    ]},
    { section: 'Equipment', links: [
      { to: '/machines', label: 'Machines', icon: CoffeeIcon, show: true },
      { to: '/grinders', label: 'Grinders', icon: Cog, show: true },
    ]},
    { section: 'Library', links: [
      { to: '/coffees', label: 'My coffees', icon: Bean, show: true },
      { to: '/explore', label: 'Explore', icon: Compass, show: true },
    ]},
    { section: 'Account', links: [
      { to: '/fellow', label: 'Fellow account', icon: CloudCog, show: caps.cloud === 'fellow' },
    ]},
    { section: 'About', links: [
      { to: '/changelog', label: 'Changelog', icon: BookOpen, show: true },
    ]},
  ];
  return groups
    .map((g) => ({ ...g, links: g.links.filter((l) => l.show) }))
    .filter((g) => g.links.length > 0);
}

const THEMES: { value: ThemePref; icon: LucideIcon; title: string }[] = [
  { value: 'light', icon: Sun, title: 'Light' },
  { value: 'dark', icon: Moon, title: 'Dark' },
  { value: 'auto', icon: Monitor, title: 'Match the system' },
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
          <t.icon aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** Two-tone swatches, body over wood, like picking the machine itself. */
function FinishPicker() {
  const { finish, setFinish } = useTheme();
  const current = FINISHES.find((f) => f.value === finish);
  return (
    <div className="stack-sm">
      <div className="finish-picker" role="group" aria-label="Colour">
        {FINISHES.map((f, i) => [
          i === 1 ? <span key="sep" className="finish-sep" aria-hidden="true" /> : null,
          <button
            key={f.value}
            type="button"
            className={finish === f.value ? 'on' : ''}
            onClick={() => setFinish(f.value)}
            title={f.label}
            aria-label={f.label}
            aria-pressed={finish === f.value}
            style={{ '--swatch-body': f.body, '--swatch-wood': f.wood } as React.CSSProperties}
          />,
        ])}
      </div>
      <span className="finish-name">{current?.label}</span>
    </div>
  );
}

function Nav({ groups }: { groups: ReturnType<typeof navFor> }) {
  const { pathname } = useLocation();
  // On a short window the nav scrolls; keep where you are in view.
  // Only the nav's own scroll area moves: scrollIntoView would scroll the page too.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('.sidebar .nav');
    const active = nav?.querySelector<HTMLElement>('a.active');
    if (!nav || !active) return;
    const top = active.offsetTop - nav.offsetTop;
    if (top < nav.scrollTop) nav.scrollTop = top;
    else if (top + active.offsetHeight > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = top + active.offsetHeight - nav.clientHeight;
    }
  }, [pathname]);
  return (
    <nav className="nav" aria-label="Main">
      {groups.map((group) => (
        <div className="nav-group" key={group.section}>
          <div className="nav-label">{group.section}</div>
          {group.links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <l.icon className="nav-icon" aria-hidden="true" />
              {l.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * Account row. On desktop, theme and finish live in a popover off this row, so
 * the footer stays one line and never crowds the nav on a short window. The
 * phone sheet has the room, so it shows them inline.
 */
function Settings({ inline = false }: { inline?: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.account')) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const controls = (
    <>
      <h3>Theme</h3>
      <ThemeToggle />
      <h3>Colour</h3>
      <FinishPicker />
    </>
  );

  return (
    <div className="sidebar-foot">
      {inline ? <div className="settings-inline">{controls}</div> : null}
      <div className="account">
        <span className="account-name">{user?.displayName}</span>
        {inline ? null : (
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Theme and colour"
            title="Theme and colour"
          >
            <Palette aria-hidden="true" />
          </button>
        )}
        <button className="btn btn-ghost btn-icon" onClick={logout} aria-label="Sign out" title="Sign out">
          <LogOut aria-hidden="true" />
        </button>
        {open && !inline ? (
          <div className="settings-pop" role="dialog" aria-label="Theme and colour">
            {controls}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Phone navigation: four destinations and Log shot, raised, under the thumb. */
function TabBar({ onMore }: { onMore: () => void }) {
  const navigate = useNavigate();
  const tab = ({ isActive }: { isActive: boolean }) => `tab${isActive ? ' active' : ''}`;
  return (
    <nav className="tabbar" aria-label="Main">
      <NavLink to="/" end className={tab}>
        <LayoutGrid aria-hidden="true" />
        Home
      </NavLink>
      <NavLink to="/shots" className={tab}>
        <History aria-hidden="true" />
        Shots
      </NavLink>
      <button type="button" className="tab tab-log" onClick={() => navigate('/', { state: { log: true } })}>
        <span className="tab-log-disc">
          <Plus aria-hidden="true" />
        </span>
        Log shot
      </button>
      <NavLink to="/coffees" className={tab}>
        <Bean aria-hidden="true" />
        Coffees
      </NavLink>
      <button type="button" className="tab" onClick={onMore} aria-haspopup="dialog">
        <Menu aria-hidden="true" />
        More
      </button>
    </nav>
  );
}

/** Destinations the tab bar already carries, so the sheet doesn't repeat them. */
const IN_TAB_BAR = new Set(['/', '/shots', '/coffees']);

function MoreSheet({ groups, onClose }: { groups: ReturnType<typeof navFor>; onClose: () => void }) {
  const location = useLocation();
  const rest = groups
    .map((g) => ({ ...g, links: g.links.filter((l) => !IN_TAB_BAR.has(l.to)) }))
    .filter((g) => g.links.length > 0);
  const [opened] = useState(location.key);
  // Any navigation from inside the sheet closes it.
  useEffect(() => {
    if (location.key !== opened) onClose();
  }, [location.key, opened, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="More">
        <div className="sheet-grip" aria-hidden="true" />
        <Nav groups={rest} />
        <Settings inline />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { capabilities } = useMachines();
  const nav = navFor(capabilities);
  const [more, setMore] = useState(false);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLockup />
          <div className="brand-sub">ES1 Brew Lab</div>
        </div>
        <Nav groups={nav} />
        <Settings />
      </aside>

      <header className="topbar">
        <BrandLockup />
      </header>

      <main className="main">{children}</main>

      <TabBar onMore={() => setMore(true)} />
      {more ? <MoreSheet groups={nav} onClose={() => setMore(false)} /> : null}
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

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<AuthPage mode="login" />} />
        <Route path="/sign-up" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

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
        <Route path="/changelog" element={<Changelog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
