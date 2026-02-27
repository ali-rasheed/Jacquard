/**
 * V2 entry: Image to colored rects. Mounts AppV2 only.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './AppV2.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppV2 />
  </StrictMode>
);
