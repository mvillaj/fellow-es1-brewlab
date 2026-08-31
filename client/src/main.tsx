import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import { AuthProvider } from './lib/auth';
import { MachineProvider } from './lib/machines';
import { ThemeProvider } from './lib/theme';
import { AiProvider } from './lib/ai';
import './styles/app.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Fail loudly and legibly. Without a key ClerkProvider throws from deep inside
 * its own tree, which reads as a blank page and a stack trace about a context
 * that means nothing to whoever just cloned this.
 */
if (!publishableKey) {
  document.getElementById('root')!.innerHTML =
    '<div style="font:14px system-ui;padding:40px;max-width:60ch;margin:0 auto">' +
    '<h1 style="font-size:18px">Missing VITE_CLERK_PUBLISHABLE_KEY</h1>' +
    '<p>Add it to the <code>.env</code> at the repo root, then restart <code>npm run dev</code>. ' +
    'See <code>.env.example</code>.</p></div>';
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set — see .env.example');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <MachineProvider>
              <AiProvider>
                <App />
              </AiProvider>
            </MachineProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);
