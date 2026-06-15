/**
 * Export modal for sharing the current tab configuration (share URL + JSON handoff).
 * Media files are not embedded — the share URL restores shader/UI params; users attach their own image/video.
 */
import { useEffect, useMemo, useState } from 'react';
import { buildConfigHandoffPayload, formatConfigHandoffJson } from '../export/configHandoff';
import { btnGhost, iconSm, typeLabel } from '../uiConstants';
import { Icon } from './ui/Icon';
import { SegmentedControl, SegmentedControlButton } from './ui/SegmentedControl';

export function ConfigExportModal({
  open,
  onClose,
  tab,
  state,
  meta,
  animation,
  keyframes,
  hasKeyframeA = false,
  hasKeyframeB = false,
}) {
  const [target, setTarget] = useState('link');
  const [includeKeyframes, setIncludeKeyframes] = useState(true);
  const [copyState, setCopyState] = useState('');

  useEffect(() => {
    if (!open) return;
    setTarget('link');
    setIncludeKeyframes(hasKeyframeA || hasKeyframeB);
    setCopyState('');
  }, [open, hasKeyframeA, hasKeyframeB]);

  const payload = useMemo(() => buildConfigHandoffPayload({
    tab,
    state,
    meta,
    animation,
    keyframes,
    includeKeyframes,
  }), [tab, state, meta, animation, keyframes, includeKeyframes]);

  const shareUrl = payload.shareUrl || '';
  const jsonText = useMemo(() => formatConfigHandoffJson(payload), [payload]);
  const activeText = target === 'link' ? shareUrl : jsonText;
  const tabLabel = tab === 'weave' ? 'Weave' : 'Mosaic';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Export configuration">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border-subtle bg-surface">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="share" className={iconSm} />
            <span className={`${typeLabel} text-text`}>Export {tabLabel} configuration</span>
          </div>
          <button type="button" className={btnGhost} onClick={onClose}>
            <Icon name="close" className={iconSm} />
            <span className={typeLabel}>Close</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3">
          <p className={`${typeLabel} text-text-muted`}>
            Copy a share link or JSON snapshot for handoff. Image/video files are not included.
          </p>
          {(hasKeyframeA || hasKeyframeB) && (
            <label className={`inline-flex items-center gap-2 ${typeLabel}`}>
              <input
                type="checkbox"
                checked={includeKeyframes}
                onChange={(e) => setIncludeKeyframes(e.target.checked)}
              />
              <span className="text-text-muted">Include keyframe A/B</span>
            </label>
          )}
          <div className="ml-auto">
            <SegmentedControl>
              <div className="flex h-full">
                <SegmentedControlButton active={target === 'link'} aria-pressed={target === 'link'} onClick={() => setTarget('link')}>
                  Link
                </SegmentedControlButton>
                <SegmentedControlButton active={target === 'json'} aria-pressed={target === 'json'} onClick={() => setTarget('json')}>
                  JSON
                </SegmentedControlButton>
              </div>
            </SegmentedControl>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <pre className="min-h-[12rem] overflow-x-auto rounded border border-border-subtle bg-surface-secondary p-3 text-xs text-text">
            <code>{activeText}</code>
          </pre>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
          <span className={`text-xs ${copyState === 'Copied!' ? 'text-accent' : 'text-text-muted'}`}>
            {copyState || (target === 'link' ? 'Opens the same tab and shader settings in another browser.' : 'Includes `playing` (shimmer, colorway loops, stitch-in, keyframe transport, embed drivers on Weave).')}
          </span>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(activeText);
                setCopyState('Copied!');
              } catch {
                setCopyState('Copy failed');
              }
            }}
          >
            <Icon name="content_copy" className={iconSm} />
            <span className={typeLabel}>Copy {target === 'link' ? 'link' : 'JSON'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
