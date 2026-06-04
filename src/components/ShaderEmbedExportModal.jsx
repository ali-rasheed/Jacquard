/**
 * Export modal for Weaving shader embeds (React + HTML snippets).
 * Source snapshot is selected at export time: current, Set A, or Set B.
 */
import { useEffect, useMemo, useState } from 'react';
import { buildShaderEmbedPayload } from '../export/shaderEmbedPayload';
import { generateReactEmbedCode, generateHtmlEmbedCode } from '../export/shaderEmbedTemplates';
import { btnGhost, iconSm, typeLabel } from '../uiConstants';
import { Icon } from './ui/Icon';
import { SegmentedControl, SegmentedControlButton } from './ui/SegmentedControl';

export function ShaderEmbedExportModal({
  open,
  onClose,
  currentState,
  snapshotA,
  snapshotB,
  isKeyframePlaying = false,
  shimmerPlaying = true,
  colorwayAnimPlaying,
}) {
  const [source, setSource] = useState('current');
  const [target, setTarget] = useState('react');
  const [staticMode, setStaticMode] = useState(false);
  const [hoverReactive, setHoverReactive] = useState(false);
  const [hoverRevealOnly, setHoverRevealOnly] = useState(false);
  const [movementBoost, setMovementBoost] = useState(true);
  const [copyState, setCopyState] = useState('');

  useEffect(() => {
    if (!open) return;
    setHoverReactive(false);
    setHoverRevealOnly(false);
    setMovementBoost(true);
    setCopyState('');
  }, [open]);

  const hasA = !!snapshotA;
  const hasB = !!snapshotB;

  const payload = useMemo(() => buildShaderEmbedPayload({
    source,
    currentState,
    snapshotA,
    snapshotB,
    smartAuto: true,
    staticMode,
    isKeyframePlaying,
    shimmerPlaying,
    colorwayAnimPlaying,
    hoverReactive,
    hoverRevealOnly,
    movementBoost,
  }), [source, currentState, snapshotA, snapshotB, staticMode, isKeyframePlaying, shimmerPlaying, colorwayAnimPlaying, hoverReactive, hoverRevealOnly, movementBoost]);

  const reactCode = useMemo(() => generateReactEmbedCode(payload), [payload]);
  const htmlCode = useMemo(() => generateHtmlEmbedCode(payload), [payload]);
  const activeCode = target === 'react' ? reactCode : htmlCode;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Export shader embed">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border-subtle bg-surface">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="code" className={iconSm} />
            <span className={`${typeLabel} text-text`}>Export embed code</span>
          </div>
          <button type="button" className={btnGhost} onClick={onClose}>
            <Icon name="close" className={iconSm} />
            <span className={typeLabel}>Close</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3">
          <label className={`inline-flex items-center gap-2 ${typeLabel}`}>
            <span className="text-text-muted">Source</span>
            <select
              className="rounded border border-border-subtle bg-surface-input px-2 py-1 text-text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="current">Current</option>
              <option value="setA" disabled={!hasA}>Set A</option>
              <option value="setB" disabled={!hasB}>Set B</option>
            </select>
          </label>

          <label className={`inline-flex items-center gap-2 ${typeLabel}`}>
            <input type="checkbox" checked={staticMode} onChange={(e) => setStaticMode(e.target.checked)} />
            <span className="text-text-muted">Static (disable auto animation)</span>
          </label>
          <label className={`inline-flex items-center gap-2 ${typeLabel}`}>
            <input type="checkbox" checked={hoverReactive} onChange={(e) => setHoverReactive(e.target.checked)} />
            <span className="text-text-muted">Enable hover ripple</span>
          </label>
          <label className={`inline-flex items-center gap-2 ${typeLabel}`}>
            <input
              type="checkbox"
              checked={hoverRevealOnly}
              disabled={!hoverReactive}
              onChange={(e) => setHoverRevealOnly(e.target.checked)}
            />
            <span className={`text-text-muted ${!hoverReactive ? 'opacity-50' : ''}`}>Reveal tiles only on hover</span>
          </label>
          <label className={`inline-flex items-center gap-2 ${typeLabel}`}>
            <input
              type="checkbox"
              checked={movementBoost}
              disabled={!hoverReactive}
              onChange={(e) => setMovementBoost(e.target.checked)}
            />
            <span className={`text-text-muted ${!hoverReactive ? 'opacity-50' : ''}`}>Movement boost</span>
          </label>

          <div className="ml-auto">
            <SegmentedControl>
              <div className="flex h-full">
                <SegmentedControlButton active={target === 'react'} aria-pressed={target === 'react'} onClick={() => setTarget('react')}>
                  React
                </SegmentedControlButton>
                <SegmentedControlButton active={target === 'html'} aria-pressed={target === 'html'} onClick={() => setTarget('html')}>
                  HTML
                </SegmentedControlButton>
              </div>
            </SegmentedControl>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <pre className="min-h-full overflow-x-auto rounded border border-border-subtle bg-surface-secondary p-3 text-xs text-text">
            <code>{activeCode}</code>
          </pre>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
          <span className={`text-xs ${copyState === 'Copied!' ? 'text-accent' : 'text-text-muted'}`}>{copyState || 'Payload includes `playing` (embed drivers, shimmer, keyframe transport, colorway bits). URL: epl, wkp, cwp, shp.'}</span>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(activeCode);
                setCopyState('Copied!');
              } catch {
                setCopyState('Copy failed');
              }
            }}
          >
            <Icon name="content_copy" className={iconSm} />
            <span className={typeLabel}>Copy code</span>
          </button>
        </div>
      </div>
    </div>
  );
}

