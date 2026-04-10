/**
 * After recording, browsers may block programmatic downloads (especially after async MP4 encode).
 * Shows a visible Download link (real user gesture) plus optional error text.
 */
import { useEffect, useMemo } from 'react';

export function RecordingDownloadBanner({ pending, onDismiss, recordError, onClearError }) {
  const url = useMemo(() => (pending?.blob ? URL.createObjectURL(pending.blob) : null), [pending]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (!pending && !recordError) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-1/2 z-50 flex max-w-[min(100vw-24px,420px)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-sm shadow-lg"
      role="status"
    >
      {recordError && (
        <div className="flex items-start justify-between gap-2 text-error">
          <span>{recordError}</span>
          {onClearError && (
            <button type="button" className="shrink-0 underline" onClick={onClearError}>
              Dismiss
            </button>
          )}
        </div>
      )}
      {pending && url && (
        <div className="flex flex-col gap-1.5">
          <span className="text-text-secondary text-xs">Recording ready — your browser may not auto-save; use the button below.</span>
          <div className="flex flex-wrap items-center gap-2">
          <a
            href={url}
            download={pending.filename}
            className="rounded border border-accent bg-accent/15 px-3 py-1.5 font-medium text-accent hover:bg-accent/25"
          >
            Download {pending.filename}
          </a>
          {onDismiss && (
            <button type="button" className="text-text-secondary underline" onClick={onDismiss}>
              Dismiss
            </button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
