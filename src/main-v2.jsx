/**
 * V2 entry: Image to colored rects. Mounts AppV2 only.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './AppV2.jsx';
import { AppTooltipProvider } from './components/ui/AppTooltipProvider.jsx';
import { ThemeProvider } from './theme/ThemeProvider.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppTooltipProvider>
        <AppV2 />
      </AppTooltipProvider>
    </ThemeProvider>
  </StrictMode>
);
