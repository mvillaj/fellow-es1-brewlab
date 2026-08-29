import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { MachineProvider } from './lib/machines';
import { ThemeProvider } from './lib/theme';
import { AiProvider } from './lib/ai';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
