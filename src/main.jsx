/**
 * App entry. Renders Root (App + error boundary). In dev, mounts Agentation
 * toolbar for visual feedback annotations (syncs via MCP when server is running).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Agentation } from 'agentation';
import Root from './Root.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
    {import.meta.env.DEV && <Agentation />}
  </StrictMode>
);
