/**
 * Design system entry — lightweight page for previewing `uiConstants` and `components/ui`.
 * Open `/design-system.html` in dev or after build. No WebGL shell; shares theme + tooltip provider with the app.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppTooltipProvider } from './components/ui/AppTooltipProvider.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import DesignSystemPage from './pages/DesignSystemPage.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppTooltipProvider>
        <DesignSystemPage />
      </AppTooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
