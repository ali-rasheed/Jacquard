/**
 * Single Tooltip.Provider for the app: shared delay/skip settings for all Radix tooltips.
 */
import * as Tooltip from '@radix-ui/react-tooltip';
import { TOOLTIP_DELAY_MS } from '../../ui/tooltipConstants';

export function AppTooltipProvider({ children }) {
  return (
    <Tooltip.Provider delayDuration={TOOLTIP_DELAY_MS} skipDelayDuration={300}>
      {children}
    </Tooltip.Provider>
  );
}
