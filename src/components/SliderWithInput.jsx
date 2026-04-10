/**
 * SliderWithInput — Radix Slider + typeable number input(s), Figma-style.
 * Slider and input stay in sync: drag updates input, typing (and blur) updates slider.
 * Optional snap ticks are drawn on the track when snapPointCount is set.
 */
import { useState, useCallback, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { inputNumber } from '../uiConstants';
import { IconButton, Icon } from './ui';

function clamp(value, min, max) {
  if (value == null || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** When snapValues provided, find closest index. */
function indexOfClosest(snapValues, value) {
  if (!snapValues?.length) return 0;
  return snapValues.reduce((best, _, i) =>
    Math.abs(snapValues[i] - value) < Math.abs(snapValues[best] - value) ? i : best,
    0
  );
}

function SingleSliderWithInput({
  id,
  'aria-label': ariaLabel,
  value,
  onValueChange,
  min,
  max,
  step,
  snapPointCount = 0,
  /** When set, slider and input use these discrete values (e.g. GRID_SNAPS). */
  snapValues = null,
  format = (n) => String(n),
  parse = (s) => (Number.isFinite(Number(s)) ? Number(s) : null),
  className = '',
  trackClassName = 'relative h-1.5 grow rounded-full bg-surface-input',
  thumbClassName = 'block h-4 w-4 rounded-full border border-border bg-surface shadow focus:outline-none focus:ring-2 focus:ring-accent/40',
  /** Default value used to show inline reset affordance when changed. */
  defaultValue = undefined,
  onReset = undefined,
}) {
  const [inputStr, setInputStr] = useState(() => format(value));
  const [isFocused, setIsFocused] = useState(false);

  const effectiveMin = snapValues ? 0 : min;
  const effectiveMax = snapValues ? Math.max(0, snapValues.length - 1) : max;
  const effectiveStep = snapValues ? 1 : step;
  const sliderValue = snapValues ? indexOfClosest(snapValues, value) : value;
  const displayValue = snapValues ? snapValues[sliderValue] : value;

  useEffect(() => {
    if (!isFocused) setInputStr(format(displayValue));
  }, [displayValue, isFocused, format]);

  const commitInput = useCallback(() => {
    const parsed = parse(inputStr);
    if (parsed != null) {
      const next = snapValues
        ? snapValues[indexOfClosest(snapValues, clamp(parsed, snapValues[0], snapValues[snapValues.length - 1]))]
        : clamp(parsed, min, max);
      onValueChange(next);
      setInputStr(format(next));
    } else {
      setInputStr(format(displayValue));
    }
    setIsFocused(false);
  }, [inputStr, min, max, snapValues, onValueChange, format, parse, displayValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInput();
    }
  };

  const tickCount = snapPointCount || (snapValues ? snapValues.length : 0);
  const snapTicks =
    tickCount > 0
      ? Array.from({ length: tickCount }, (_, i) =>
          tickCount === 1 ? 50 : (i / (tickCount - 1)) * 100
        )
      : [];
  const isDirty = defaultValue != null && Math.abs(Number(displayValue) - Number(defaultValue)) > 1e-6;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex w-20 shrink-0 touch-none select-none items-center">
        {snapTicks.length > 0 && (
          <div
            className="absolute inset-0 flex pointer-events-none rounded-full"
            aria-hidden
          >
            {snapTicks.map((pct, i) => (
              <div
                key={i}
                className="absolute top-1/2 w-px h-2.5 -translate-y-1/2 bg-border"
                style={{ left: `${pct}%` }}
              />
            ))}
          </div>
        )}
        <Slider.Root
          id={id}
          className="relative flex w-full touch-none items-center"
          value={[sliderValue]}
          onValueChange={([v]) => {
            const next = snapValues ? snapValues[v] : v;
            onValueChange(next);
          }}
          min={effectiveMin}
          max={effectiveMax}
          step={effectiveStep}
          aria-label={ariaLabel}
        >
          <Slider.Track className={trackClassName}>
            <Slider.Range className="absolute h-full rounded-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb className={thumbClassName} />
        </Slider.Root>
      </div>
      <input
        type="text"
        inputMode="decimal"
        className={inputNumber}
        size={Math.max(3, Math.min(10, inputStr.length + 1))}
        value={inputStr}
        onChange={(e) => setInputStr(e.target.value)}
        onBlur={commitInput}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel ? `${ariaLabel} value` : undefined}
      />
      {isDirty && onReset && (
        <IconButton size="sm" onClick={onReset} title="Reset to default" aria-label="Reset to default">
          <Icon name="restart_alt" className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}

function RangeSliderWithInput({
  id,
  'aria-label': ariaLabel,
  value,
  onValueChange,
  min,
  max,
  step,
  snapPointCount = 0,
  format = (n) => String(n),
  parse = (s) => (Number.isFinite(Number(s)) ? Number(s) : null),
  className = '',
  trackClassName = 'relative h-1.5 grow rounded-full bg-surface-input',
  thumbClassName = 'block h-4 w-4 rounded-full border border-border bg-surface shadow focus:ring-2 focus:ring-accent/40',
  /** Default range used to show inline reset affordance when changed. */
  defaultValue = undefined,
  onReset = undefined,
}) {
  const [a, b] = value;
  const [inputA, setInputA] = useState(() => format(a));
  const [inputB, setInputB] = useState(() => format(b));
  const [focused, setFocused] = useState(null); // 'a' | 'b' | null

  useEffect(() => {
    if (focused !== 'a') setInputA(format(a));
  }, [a, focused, format]);
  useEffect(() => {
    if (focused !== 'b') setInputB(format(b));
  }, [b, focused, format]);

  const commitA = useCallback(() => {
    const parsed = parse(inputA);
    if (parsed != null) {
      const next = clamp(parsed, min, max);
      const newB = Math.max(next, b);
      onValueChange([next, newB]);
      setInputA(format(next));
    } else {
      setInputA(format(a));
    }
    setFocused(null);
  }, [inputA, min, max, b, onValueChange, format, parse, a]);

  const commitB = useCallback(() => {
    const parsed = parse(inputB);
    if (parsed != null) {
      const next = clamp(parsed, min, max);
      const newA = Math.min(next, a);
      onValueChange([newA, next]);
      setInputB(format(next));
    } else {
      setInputB(format(b));
    }
    setFocused(null);
  }, [inputB, min, max, a, onValueChange, format, parse, b]);

  const handleKeyDownA = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitA();
    }
  };
  const handleKeyDownB = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitB();
    }
  };

  const snapTicks =
    snapPointCount > 0
      ? Array.from({ length: snapPointCount }, (_, i) =>
          snapPointCount === 1 ? 50 : (i / (snapPointCount - 1)) * 100
        )
      : [];
  const isDirty = Array.isArray(defaultValue)
    && defaultValue.length === 2
    && (Math.abs(Number(a) - Number(defaultValue[0])) > 1e-6 || Math.abs(Number(b) - Number(defaultValue[1])) > 1e-6);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex w-24 shrink-0 touch-none select-none items-center">
        {snapTicks.length > 0 && (
          <div
            className="absolute inset-0 flex pointer-events-none rounded-full"
            aria-hidden
          >
            {snapTicks.map((pct, i) => (
              <div
                key={i}
                className="absolute top-1/2 w-px h-2.5 -translate-y-1/2 bg-border"
                style={{ left: `${pct}%` }}
              />
            ))}
          </div>
        )}
        <Slider.Root
          id={id}
          className="relative flex w-full touch-none items-center"
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel}
        >
          <Slider.Track className={trackClassName}>
            <Slider.Range className="absolute h-full rounded-full bg-accent" />
          </Slider.Track>
          <Slider.Thumb className={thumbClassName} />
          <Slider.Thumb className={thumbClassName} />
        </Slider.Root>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          inputMode="decimal"
          className={inputNumber}
          size={Math.max(3, Math.min(10, inputA.length + 1))}
          value={inputA}
          onChange={(e) => setInputA(e.target.value)}
          onBlur={commitA}
          onFocus={() => setFocused('a')}
          onKeyDown={handleKeyDownA}
          aria-label={ariaLabel ? `${ariaLabel} min` : undefined}
        />
        <span className="text-text-secondary" aria-hidden>
          –
        </span>
        <input
          type="text"
          inputMode="decimal"
          className={inputNumber}
          size={Math.max(3, Math.min(10, inputB.length + 1))}
          value={inputB}
          onChange={(e) => setInputB(e.target.value)}
          onBlur={commitB}
          onFocus={() => setFocused('b')}
          onKeyDown={handleKeyDownB}
          aria-label={ariaLabel ? `${ariaLabel} max` : undefined}
        />
      </div>
      {isDirty && onReset && (
        <IconButton size="sm" onClick={onReset} title="Reset range to default" aria-label="Reset range to default">
          <Icon name="restart_alt" className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}

export function SliderWithInput(props) {
  const isRange = Array.isArray(props.value) && props.value.length === 2;
  return isRange ? (
    <RangeSliderWithInput {...props} />
  ) : (
    <SingleSliderWithInput
      {...props}
      value={props.value}
      onValueChange={props.onValueChange}
    />
  );
}
