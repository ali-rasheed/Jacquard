/**
 * Radix Tooltip with 150ms open delay. Wrap trigger + label in one region so hover on either shows the same tip.
 * @param {{ children: React.ReactNode, content: React.ReactNode, side?: 'top'|'right'|'bottom'|'left', className?: string }} props
 */
import * as Tooltip from '@radix-ui/react-tooltip';
import { TOOLTIP_DELAY_MS } from '../../ui/tooltipConstants';

export function AppTooltip({ children, content, side = 'top', className = '' }) {
  return (
    <Tooltip.Root delayDuration={TOOLTIP_DELAY_MS}>
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className={`z-50 max-w-[min(20rem,calc(100vw-1rem))] rounded border border-border-subtle bg-surface-elevated px-2 py-1 text-xs text-text shadow-md ${className}`}
        >
          {content}
          <Tooltip.Arrow className="fill-border-subtle" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
