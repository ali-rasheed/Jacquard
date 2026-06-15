/**
 * Canvas demo entry — live Weave canvas permutations (gradient, shimmer, colorways, halftone).
 * Open `/canvas-demo.html` in dev or after build.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppTooltipProvider } from './components/ui/AppTooltipProvider.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import CanvasDemoPage from './pages/CanvasDemoPage.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppTooltipProvider>
        <CanvasDemoPage />
      </AppTooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
