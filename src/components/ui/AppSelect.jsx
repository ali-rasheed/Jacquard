/**
 * Radix Select wired to uiConstants (selectTrigger, selectContent, selectItem).
 * Value is always string from Radix; parent may coerce to number.
 * @param {{ value: string | number, onValueChange: (v: string) => void, options: Array<{ value: string | number, label: string, icon?: string }>, placeholder?: string, title?: string, id?: string, labelText?: string }} props
 */
import * as Select from '@radix-ui/react-select';
import * as Label from '@radix-ui/react-label';
import { Icon } from './Icon';
import { selectTrigger, selectContent, selectItem, iconMd, iconLg } from '../../uiConstants';

export function AppSelect({ value, onValueChange, options, placeholder, title, id: idProp, labelText }) {
  const selected = options.find((o) => String(o.value) === String(value));
  const label = labelText ?? title;
  return (
    <>
      {idProp && label && (
        <Label.Root className="sr-only" htmlFor={idProp}>
          {label}
        </Label.Root>
      )}
      <Select.Root value={String(value)} onValueChange={onValueChange}>
        <Select.Trigger id={idProp} className={selectTrigger} title={title} aria-label={title ?? placeholder}>
          <span className="flex min-w-0 items-center gap-1.5">
            {selected?.icon && (
              <Icon name={selected.icon} className={`shrink-0 ${iconMd} text-text-muted`} />
            )}
            <Select.Value placeholder={placeholder} />
          </span>
          <Icon name="expand_more" className={`${iconLg} opacity-60`} />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className={selectContent} position="popper" sideOffset={4}>
            <Select.Viewport>
              {options.map((opt, i) => (
                <Select.Item
                  key={opt.id ?? i}
                  className={selectItem}
                  value={String(opt.value)}
                >
                  {opt.icon && (
                    <Icon name={opt.icon} className={`mr-1.5 shrink-0 ${iconMd} text-text-muted`} />
                  )}
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute right-2 inline-flex items-center" />
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}
