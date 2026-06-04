/**
 * Design system page section — anchor id, title, optional description, children in a bordered panel.
 */
import { typeLabel, typeCaption, sidebarGroup } from '../uiConstants';

export function DsSection({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className={`${typeLabel} mb-1`}>{title}</h2>
      {description ? <p className={`${typeCaption} mb-3 max-w-2xl`}>{description}</p> : null}
      <div className={`${sidebarGroup} gap-3`}>{children}</div>
    </section>
  );
}

/** Row label + control for specimen layouts. */
export function DsRow({ label, children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {label ? <span className="w-28 shrink-0 text-[10px] text-text-muted">{label}</span> : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
