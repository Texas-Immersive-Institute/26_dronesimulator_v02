import { useEffect, useRef, useState } from 'react'
import type { Vec3 } from '../model/types'
import { useEditor } from '../store/editorStore'

const fmt = (v: number, digits: number): string => String(Number(v.toFixed(digits)))

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  digits?: number
  title?: string
}

/** Pixels of mouse movement per `step` while scrubbing. */
const PX_PER_STEP = 4
/** Movement before a press on the field counts as a scrub rather than a click. */
const SCRUB_THRESHOLD = 3

interface ScrubOptions {
  value: number
  onChange: (value: number) => void
  step: number
  min?: number
  max?: number
  digits: number
}

/**
 * Drag-to-change for a number input. Press and drag left or right to change the value
 * live (Shift for fine steps, Ctrl/Cmd for big steps); click without dragging to type.
 * One drag, or everything typed while the input has focus, is one undo step.
 */
function useScrubInput({ value, onChange, step, min, max, digits }: ScrubOptions): {
  onPointerDown: (e: React.PointerEvent) => void
  scrubbing: boolean
  input: React.InputHTMLAttributes<HTMLInputElement> & { ref: React.RefObject<HTMLInputElement | null> }
} {
  const [text, setText] = useState(fmt(value, digits))
  const [focused, setFocused] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const latest = useRef({ onChange, value })
  latest.current = { onChange, value }
  const { beginGesture, endGesture } = useEditor.getState()

  useEffect(() => {
    if (!focused) setText(fmt(value, digits))
  }, [value, focused, digits])

  const clamp = (v: number): number => Math.min(Math.max(v, min ?? -Infinity), max ?? Infinity)

  const onPointerDown = (e: React.PointerEvent): void => {
    if (focused || e.button !== 0) return
    e.preventDefault()
    // Capture the pointer so the drag keeps working, and always ends, wherever the mouse goes.
    const el = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try {
      el.setPointerCapture(pointerId)
    } catch {
      // Not capturable (e.g. a synthetic event); the window listeners below still work.
    }
    const startX = e.clientX
    const startValue = latest.current.value
    let started = false
    let finished = false
    let lastX = startX
    let acc = 0

    const finish = (): void => {
      if (finished) return
      finished = true
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('blur', finish)
      el.removeEventListener('lostpointercapture', finish)
      document.body.classList.remove('scrubbing')
      if (started) {
        setScrubbing(false)
        endGesture()
      } else {
        ref.current?.focus()
        ref.current?.select()
      }
    }
    const move = (ev: PointerEvent): void => {
      // The button was released somewhere we didn't hear about: stop here.
      if ((ev.buttons & 1) === 0) {
        finish()
        return
      }
      if (!started) {
        if (Math.abs(ev.clientX - startX) < SCRUB_THRESHOLD) return
        started = true
        setScrubbing(true)
        beginGesture()
        document.body.classList.add('scrubbing')
      }
      // Accumulate the movement so switching Shift / Ctrl mid-drag doesn't jump.
      const rate = ev.shiftKey ? 0.1 : ev.ctrlKey || ev.metaKey ? 10 : 1
      acc += ((ev.clientX - lastX) / PX_PER_STEP) * step * rate
      lastX = ev.clientX
      const snap = ev.shiftKey ? step / 10 : step
      const next = clamp(Math.round((startValue + acc) / snap) * snap)
      latest.current.onChange(Number(next.toFixed(Math.max(digits, 4))))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('blur', finish)
    el.addEventListener('lostpointercapture', finish)
  }

  return {
    onPointerDown,
    scrubbing,
    input: {
      ref,
      type: 'number',
      className: focused ? '' : 'scrub-input',
      step,
      min,
      max,
      value: text,
      onPointerDown,
      onFocus: () => {
        setFocused(true)
        beginGesture()
      },
      onBlur: () => {
        setFocused(false)
        endGesture()
      },
      onChange: (e) => {
        setText(e.target.value)
        const v = parseFloat(e.target.value)
        if (Number.isFinite(v)) onChange(clamp(v))
      },
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
      }
    }
  }
}

/** A labelled number field. Drag the label or the field left and right to change it, or click to type. */
export function NumberField({ label, value, onChange, step = 0.1, min, max, unit, digits = 2, title }: NumberFieldProps): React.JSX.Element {
  const { onPointerDown, scrubbing, input } = useScrubInput({ value, onChange, step, min, max, digits })
  return (
    // A div, not a label: a label would focus the input after every drag.
    <div className={`field${scrubbing ? ' field--scrubbing' : ''}`} title={title}>
      <span className="field-label field-label--scrub" onPointerDown={onPointerDown} title={title ?? 'Drag left or right to change, or click the value to type'}>
        {label}
      </span>
      <span className="field-input">
        <input {...input} />
        {unit && <em>{unit}</em>}
      </span>
    </div>
  )
}

function AxisInput({ axis, value, onChange, step, digits }: { axis: string; value: number; onChange: (v: number) => void; step: number; digits: number }): React.JSX.Element {
  const { onPointerDown, scrubbing, input } = useScrubInput({ value, onChange, step, digits })
  return (
    <span className={`axis-input axis-input--${axis.toLowerCase()}${scrubbing ? ' field--scrubbing' : ''}`}>
      <b onPointerDown={onPointerDown}>{axis}</b>
      <input {...input} />
    </span>
  )
}

/** A 3D point as three draggable X / Y / Z inputs on one row. */
export function Vec3Field({ label, value, onChange, step = 0.1, digits = 2, title }: { label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number; digits?: number; title?: string }): React.JSX.Element {
  const set = (i: number, v: number): void => {
    const next: Vec3 = [value[0], value[1], value[2]]
    next[i] = v
    onChange(next)
  }
  return (
    <div className="field field--vec" title={title}>
      <span className="field-label">{label}</span>
      <span className="field-input">
        {(['X', 'Y', 'Z'] as const).map((axis, i) => (
          <AxisInput key={axis} axis={axis} value={value[i]} onChange={(v) => set(i, v)} step={step} digits={digits} />
        ))}
        <em>m</em>
      </span>
    </div>
  )
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }): React.JSX.Element {
  const { beginGesture, endGesture } = useEditor.getState()
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={beginGesture}
          onBlur={endGesture}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
        />
      </span>
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">
        <select value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}

export function Section({ title, children, highlight = false }: { title: string; children: React.ReactNode; highlight?: boolean }): React.JSX.Element {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlight])
  return (
    <section ref={ref} className={`inspector-section${highlight ? ' inspector-section--highlight' : ''}`}>
      <h3>{title}</h3>
      {children}
    </section>
  )
}
