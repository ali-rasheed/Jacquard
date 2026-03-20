/**
 * Material Symbols icon wrapper. Use symbol name (e.g. refresh, arrow_downward).
 * Requires Material Symbols Outlined font loaded (see index.html).
 * @param {{ name: string, className?: string }} props
 */
export function Icon({ name, className = '' }) {
  return (
    <span className={`icon inline-block shrink-0 ${className}`} aria-hidden>
      {name}
    </span>
  );
}
