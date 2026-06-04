/**
 * Bottom-anchored capture bar: copy/export/record settings and optional keyframe play controls.
 * Keyframe **Play** and **+ Record** share one segmented control in the Animate row (preview vs play-and-capture);
 * Video keeps **Record** only. Tooltips use Radix (150ms) on grouped icon+label rows via AppTooltip.
 */
import { COPY_SCALES, EXPORT_SCALES } from '../constants';
import { supportsMP4 } from '../hooks/useCanvasRecorder';
import { Icon } from './ui/Icon';
import { IconButton } from './ui/IconButton';
import { SegmentedControl, SegmentedControlButton } from './ui/SegmentedControl';
import { AppTooltip } from './ui/AppTooltip';
import { iconSm, iconResetGlyph, btnGhost, typeLabel } from '../uiConstants';

export function CaptureToolbar({
  copyFormat,
  setCopyFormat,
  copyScale,
  setCopyScale,
  copyDefaults,
  onCopy,
  copyFeedback,
  showExport = false,
  exportScale,
  setExportScale,
  exportDefaults,
  onExport,
  exportFeedback,
  recordFormat,
  setRecordFormat,
  isRecording,
  isProcessing,
  recordingReason,
  onRecordClick,
  onPlayRecord,
  keyframe,
  showEmbedExport = false,
  onOpenEmbedExport,
}) {
  const recordTitle = isProcessing
    ? 'Processing…'
    : isRecording
      ? `${recordingReason === 'auto' ? 'Auto-recording — ' : ''}Stop and download ${recordFormat.toUpperCase()}`
      : `Record canvas as ${recordFormat.toUpperCase()}`;

  return (
    <div
      className="shrink-0 border-t border-border-subtle bg-surface-elevated px-3 py-2"
      role="region"
      aria-label="Capture and animation"
    >
      <div className="flex min-h-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`${typeLabel} shrink-0 text-text-muted`}>Image</span>
          <AppTooltip content="Resolution multiplier for clipboard copy (PNG or WebP)">
            <div className="inline-flex items-center gap-1">
              <SegmentedControl>
                <div className="flex h-full">
                  {COPY_SCALES.map((s) => (
                    <SegmentedControlButton
                      key={s}
                      active={copyScale === s}
                      aria-pressed={copyScale === s}
                      aria-label={`Copy resolution: ${s}×`}
                      onClick={() => setCopyScale(s)}
                    >
                      {s}×
                    </SegmentedControlButton>
                  ))}
                </div>
                <div className="flex h-full">
                  {['png', 'webp'].map((fmt) => (
                    <SegmentedControlButton
                      key={fmt}
                      format
                      active={copyFormat === fmt}
                      aria-pressed={copyFormat === fmt}
                      aria-label={`Clipboard format: ${fmt}`}
                      onClick={() => setCopyFormat(fmt)}
                    >
                      {fmt}
                    </SegmentedControlButton>
                  ))}
                </div>
              </SegmentedControl>
            </div>
          </AppTooltip>
          <AppTooltip content={`Copy canvas at ${copyScale}× as ${copyFormat.toUpperCase()}`}>
            <span className="inline-flex cursor-default items-center gap-1">
              <IconButton
                size="sm"
                aria-label={`Copy ${copyFormat.toUpperCase()}`}
                onClick={onCopy}
              >
                <Icon name="content_copy" className={iconSm} />
              </IconButton>
              <span className={`${typeLabel} hidden sm:inline`}>Copy</span>
            </span>
          </AppTooltip>
          {(copyScale !== copyDefaults.copyScale || copyFormat !== copyDefaults.copyFormat) && (
            <AppTooltip content="Reset copy scale and format to defaults">
              <span className="inline-flex cursor-default items-center gap-1">
                <IconButton
                  size="resetSm"
                  aria-label="Reset copy scale and format to defaults"
                  onClick={() => {
                    setCopyScale(copyDefaults.copyScale);
                    setCopyFormat(copyDefaults.copyFormat);
                  }}
                >
                  <Icon name="restart_alt" className={iconResetGlyph} />
                </IconButton>
                <span className={`${typeLabel} hidden md:inline`}>Reset copy</span>
              </span>
            </AppTooltip>
          )}
          {showEmbedExport && typeof onOpenEmbedExport === 'function' && (
            <AppTooltip content="Generate embeddable React and HTML shader snippets">
              <span className="inline-flex cursor-default items-center gap-1">
                <IconButton size="sm" aria-label="Export embed code" onClick={onOpenEmbedExport}>
                  <Icon name="code" className={iconSm} />
                </IconButton>
                <span className={`${typeLabel} hidden md:inline`}>Export Embed</span>
              </span>
            </AppTooltip>
          )}
          {copyFeedback && (
            <span className={`shrink-0 text-xs ${copyFeedback === 'Copied!' ? 'text-accent' : 'text-error'}`} role="status">
              {copyFeedback}
            </span>
          )}
        </div>

        {showExport && exportScale != null && setExportScale && exportDefaults && onExport && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-border-subtle sm:border-l sm:pl-3">
            <span className={`${typeLabel} shrink-0 text-text-muted`}>PNG</span>
            <AppTooltip content="Scale for downloaded PNG file">
              <div className="inline-flex items-center gap-1">
                <SegmentedControl>
                  <div className="flex h-full">
                    {EXPORT_SCALES.map((s) => (
                      <SegmentedControlButton
                        key={s}
                        active={exportScale === s}
                        aria-pressed={exportScale === s}
                        aria-label={`Export at ${s}×`}
                        onClick={() => setExportScale(s)}
                      >
                        {s}×
                      </SegmentedControlButton>
                    ))}
                  </div>
                </SegmentedControl>
              </div>
            </AppTooltip>
            <AppTooltip content={`Download PNG at ${exportScale}×`}>
              <span className="inline-flex cursor-default items-center gap-1">
                <IconButton size="sm" aria-label="Export PNG" onClick={onExport}>
                  <Icon name="file_download" className={iconSm} />
                </IconButton>
                <span className={`${typeLabel} hidden sm:inline`}>Download</span>
              </span>
            </AppTooltip>
            {exportScale !== exportDefaults.exportScale && (
              <AppTooltip content="Reset export scale to default">
                <span className="inline-flex cursor-default items-center gap-1">
                  <IconButton
                    size="resetSm"
                    aria-label="Reset export scale to default"
                    onClick={() => setExportScale(exportDefaults.exportScale)}
                  >
                    <Icon name="restart_alt" className={iconResetGlyph} />
                  </IconButton>
                </span>
              </AppTooltip>
            )}
            {exportFeedback && (
              <span className={`shrink-0 text-xs ${exportFeedback === 'Exported!' ? 'text-accent' : 'text-error'}`} role="status">
                {exportFeedback}
              </span>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-wrap items-center gap-2 border-border-subtle sm:border-l sm:pl-3">
          <span className={`${typeLabel} shrink-0 text-text-muted`}>Video</span>
          <AppTooltip content={isRecording ? 'Cannot change format while recording' : 'Recording container format'}>
            <div className="inline-flex items-center gap-1">
              <SegmentedControl>
                <div className="flex h-full">
                  {(supportsMP4 ? ['mp4', 'webm'] : ['webm']).map((fmt) => (
                    <SegmentedControlButton
                      key={fmt}
                      format
                      active={recordFormat === fmt}
                      aria-pressed={recordFormat === fmt}
                      aria-label={`Record format: ${fmt}`}
                      onClick={() => setRecordFormat(fmt)}
                      disabled={isRecording}
                    >
                      {fmt}
                    </SegmentedControlButton>
                  ))}
                </div>
              </SegmentedControl>
            </div>
          </AppTooltip>
          <AppTooltip content={recordTitle}>
            <span className="inline-flex cursor-default items-center gap-1">
              <IconButton
                size="sm"
                variant={isRecording || isProcessing ? 'danger' : 'default'}
                aria-label={isProcessing ? 'Processing video' : isRecording ? 'Stop recording' : 'Start recording'}
                onClick={onRecordClick}
                disabled={isProcessing}
              >
                <Icon name={isProcessing ? 'hourglass_empty' : isRecording ? 'stop' : 'videocam'} className={iconSm} />
              </IconButton>
              <span className={`${typeLabel} hidden sm:inline`}>{isRecording ? 'Stop' : 'Record'}</span>
            </span>
          </AppTooltip>
        </div>

        {keyframe && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-border-subtle sm:border-l sm:pl-3">
            <span className={`${typeLabel} shrink-0 text-text-muted`}>Animate</span>
            <AppTooltip content="When on, sidebar tweaks update keyframe B in real time; when off, they only change the canvas">
              <button
                type="button"
                className={`${btnGhost} ${keyframe.editingAfter ? 'border border-accent text-accent' : ''}`}
                aria-pressed={keyframe.editingAfter}
                onClick={() => keyframe.setEditingAfter((v) => !v)}
                disabled={keyframe.isPlaying}
              >
                <span className={typeLabel}>Edit B</span>
              </button>
            </AppTooltip>
            <AppTooltip content="Capture current canvas parameters as keyframe A (start of animation)">
              <button type="button" className={btnGhost} onClick={keyframe.onSetBefore} disabled={keyframe.isPlaying}>
                <span className={typeLabel}>Set A</span>
              </button>
            </AppTooltip>
            <AppTooltip content="Capture current parameters as keyframe B (end). Or turn on Edit B and adjust the sidebar">
              <button type="button" className={btnGhost} onClick={keyframe.onSetAfter} disabled={keyframe.isPlaying}>
                <span className={typeLabel}>Set B</span>
              </button>
            </AppTooltip>
            <AppTooltip content="Duration of one A→B playback cycle">
              <label className={`inline-flex cursor-default items-center gap-1 ${typeLabel}`}>
                <span className="text-text-muted">Duration</span>
                <input
                  type="number"
                  className="w-14 rounded border border-border-subtle bg-surface-input px-1 py-0.5 text-text"
                  min={0.25}
                  max={120}
                  step={0.25}
                  value={keyframe.durationSec}
                  onChange={(e) => keyframe.setDurationSec(Math.max(0.25, Math.min(120, Number(e.target.value) || 2)))}
                  disabled={keyframe.isPlaying}
                />
                <span className="text-text-muted">s</span>
              </label>
            </AppTooltip>
            {onPlayRecord ? (
              <div className="inline-flex items-center gap-1">
                <SegmentedControl>
                  <div className="flex h-full">
                    <AppTooltip content="Preview keyframe animation (A→B) without recording">
                      <SegmentedControlButton
                        aria-label="Play keyframe preview without recording"
                        onClick={keyframe.onPlay}
                        disabled={isProcessing || keyframe.isPlaying}
                      >
                        <Icon name="play_arrow" className={iconSm} />
                        <span className={typeLabel}>Play</span>
                      </SegmentedControlButton>
                    </AppTooltip>
                    <AppTooltip content="Play A→B and record for the duration above, then stop">
                      <SegmentedControlButton
                        aria-label="Play keyframe animation and record"
                        onClick={onPlayRecord}
                        disabled={isProcessing || keyframe.isPlaying}
                      >
                        <Icon name="movie_creation" className={iconSm} />
                        <span className={typeLabel}>+ Record</span>
                      </SegmentedControlButton>
                    </AppTooltip>
                  </div>
                </SegmentedControl>
              </div>
            ) : (
              <AppTooltip content="Preview animation without recording">
                <button type="button" className={btnGhost} onClick={keyframe.onPlay} disabled={keyframe.isPlaying || isProcessing}>
                  <Icon name="play_arrow" className={iconSm} />
                  <span className={typeLabel}>Play</span>
                </button>
              </AppTooltip>
            )}
            {keyframe.isPlaying && (
              <AppTooltip content="Stop animation (recording stops too if Play + record)">
                <button type="button" className={btnGhost} onClick={keyframe.onStop}>
                  <Icon name="stop" className={iconSm} />
                  <span className={typeLabel}>Stop</span>
                </button>
              </AppTooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
