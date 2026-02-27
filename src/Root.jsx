/**
 * Root — Switcher between V1 (weaving draft) and V2 (image to colored rects).
 * Renders a small nav with two buttons, then the active app.
 */
import { useState } from 'react';
import App from './App.jsx';
import AppV2 from './AppV2.jsx';

const navBtn =
  'inline-flex h-8 items-center rounded-md border px-3 text-[13px] font-medium outline-none transition-colors focus:ring-2 focus:ring-accent/40';
const navBtnActive = 'border-accent bg-accent/10 text-accent ' + navBtn;
const navBtnInactive = 'border-border-subtle bg-transparent text-text-secondary hover:border-border hover:bg-surface-hover hover:text-text ' + navBtn;

export default function Root() {
  const [view, setView] = useState('v1');

  return (
    <div className="flex min-h-0 flex-col bg-surface" style={{ height: '100dvh' }}>
      <nav className="flex shrink-0 items-center gap-1 border-b border-border-subtle bg-surface-elevated px-3 py-1.5">
        <button
          type="button"
          className={view === 'v1' ? navBtnActive : navBtnInactive}
          onClick={() => setView('v1')}
          aria-pressed={view === 'v1'}
          aria-label="Weaving draft (V1)"
        >
          V1 Weaving
        </button>
        <button
          type="button"
          className={view === 'v2' ? navBtnActive : navBtnInactive}
          onClick={() => setView('v2')}
          aria-pressed={view === 'v2'}
          aria-label="Image to colored rects (V2)"
        >
          V2 Image Rects
        </button>
      </nav>
      <div className="min-h-0 flex-1">
        {view === 'v1' ? <App /> : <AppV2 />}
      </div>
    </div>
  );
}
