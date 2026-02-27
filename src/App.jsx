/**
 * Shader Sandbox — ENS Weaving Draft
 * WebGL canvas reads shaders from src/shaders/*.glsl. Patterns come from src/patterns (composable registry).
 * UI: Linear-style (minimal chrome, subtle borders, neutral grays).
 */
import { useState, useCallback } from 'react';
import { ShaderCanvas } from './components/ShaderCanvas';
import { PATTERNS } from './patterns';

const PALETTE_NAMES = ['Citrine', 'Garnet', 'Lapis', 'Peridot'];
const SHADE_NAMES = ['950', '500', '100', '400'];

/* Linear-style: thin bar, ghost buttons, compact controls */
const btnGhost =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-2.5 py-1 text-[13px] font-medium text-text-secondary outline-none transition-colors hover:border-border hover:bg-surface-hover hover:text-text focus:border-accent focus:outline-none';
const inputSelect =
  'h-7 rounded-md border border-border-subtle bg-surface-input px-2.5 py-1 text-[13px] text-text outline-none transition-colors hover:border-border focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none';
const pill = 'inline-flex items-center rounded-full bg-surface-elevated border border-border-subtle px-2.5 py-0.5 text-[12px] font-medium text-text-secondary';

export default function App() {
  const [pattern, setPattern] = useState(0);
  const [palette, setPalette] = useState(0);
  const [bgShade, setBgShade] = useState(2);   // 100
  const [warpShade, setWarpShade] = useState(1); // 500
  const [weftShade, setWeftShade] = useState(3); // 400
  const [gridSize, setGridSize] = useState(32);
  const [fps, setFps] = useState(0);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden bg-surface" style={{ height: '100dvh' }}>
      <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface px-3 py-2">
        <h1 className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-text">
          Shader Sandbox — ENS Weaving Draft
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhost} onClick={handleReload}>
            Reload
          </button>
          <span className="h-4 w-px bg-border" aria-hidden />
          <select className={inputSelect} value={pattern} onChange={(e) => setPattern(Number(e.target.value))}>
            {PATTERNS.map((p, i) => (
              <option key={p.id} value={i}>{p.name}</option>
            ))}
          </select>
          <select className={inputSelect} value={palette} onChange={(e) => setPalette(Number(e.target.value))} title="Colorway">
            {PALETTE_NAMES.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
          <select className={inputSelect} value={bgShade} onChange={(e) => setBgShade(Number(e.target.value))} title="Background shade">
            {SHADE_NAMES.map((name, i) => (
              <option key={`bg-${name}`} value={i}>BG: {name}</option>
            ))}
          </select>
          <select className={inputSelect} value={warpShade} onChange={(e) => setWarpShade(Number(e.target.value))} title="Warp shade">
            {SHADE_NAMES.map((name, i) => (
              <option key={`warp-${name}`} value={i}>Warp: {name}</option>
            ))}
          </select>
          <select className={inputSelect} value={weftShade} onChange={(e) => setWeftShade(Number(e.target.value))} title="Weft shade">
            {SHADE_NAMES.map((name, i) => (
              <option key={`weft-${name}`} value={i}>Weft: {name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <span className="shrink-0">Tile size</span>
            <input
              type="range"
              min={8}
              max={64}
              step={2}
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="h-1.5 w-20 shrink-0 rounded-full accent-accent"
              title={`Grid: ${gridSize} cells`}
            />
            <span className="w-6 tabular-nums text-text">{gridSize}</span>
          </label>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <ShaderCanvas patternIndex={pattern} palette={palette} bgShade={bgShade} warpShade={warpShade} weftShade={weftShade} gridSize={gridSize} patterns={PATTERNS} onFpsChange={setFps} />
      </main>

      <footer className="flex min-h-9 shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle bg-surface-elevated px-3 py-2">
        <span className={pill}>{PATTERNS[pattern]?.name ?? '—'}</span>
        <span className={pill}>{PALETTE_NAMES[palette]}</span>
        <span className={pill}>BG: {SHADE_NAMES[bgShade]}</span>
        <span className={pill}>Warp: {SHADE_NAMES[warpShade]}</span>
        <span className={pill}>Weft: {SHADE_NAMES[weftShade]}</span>
        <span className={pill}>Grid: {gridSize}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={pill}>{fps || '--'} fps</span>
          <span className={pill}>WebGL 1</span>
        </div>
      </footer>
    </div>
  );
}
