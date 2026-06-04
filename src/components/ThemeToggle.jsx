/**
 * Nav control: toggles light/dark theme (Material icon + tooltip).
 */
import { AppTooltip } from './ui/AppTooltip.jsx';
import { Icon, IconButton } from './ui';
import { iconMd } from '../uiConstants.js';
import { useTheme } from '../theme/ThemeProvider.jsx';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const next = isDark ? 'light' : 'dark';

  return (
    <AppTooltip content={isDark ? 'Light mode' : 'Dark mode'}>
      <IconButton
        size="md"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => setTheme(next)}
      >
        <Icon name={isDark ? 'light_mode' : 'dark_mode'} className={iconMd} />
      </IconButton>
    </AppTooltip>
  );
}
