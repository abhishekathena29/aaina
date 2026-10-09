import { useEffect, useMemo, useState } from 'react'
import { bookableDates, formatTime, isValidSlot, slotEnd, slotKey, slotTimes, type SlotKind } from '../shared/catalog'
import type { Slot } from '../shared/types'
import { useTakenSlots } from '../lib/app-context'

export function SlotPicker({
  kind,
  value,
  onChange,
}: {
  kind: SlotKind
  value: Slot | null
  onChange: (slot: Slot | null) => void
}) {
  const taken = useTakenSlots(kind)
  const times = useMemo(() => slotTimes(kind), [kind])

  const days = useMemo(() => {
    const now = new Date()
    return bookableDates(now).map((date) => {
      const open = times.filter((t) => isValidSlot(kind, date, t, now) && !taken.has(slotKey(kind, date, t)))
      return { date, open }
    })
  }, [kind, taken, times])

  const firstOpen = days.find((d) => d.open.length)?.date
  const [picked, setPicked] = useState<string | undefined>(value?.date)
  const date = picked ?? firstOpen
  const day = days.find((d) => d.date === date)

  // If the chosen slot gets taken by someone else, clear it.
  const stillOpen = !value || !!days.find((d) => d.date === value.date)?.open.includes(value.time)
  useEffect(() => {
    if (!stillOpen) onChange(null)
  }, [stillOpen, onChange])

  return (
    <div className="slots">
      <div className="slots__days" role="tablist" aria-label="Choose a date">
        {days.map((d) => {
          const dt = new Date(d.date + 'T00:00:00Z')
          return (
            <button
              key={d.date}
              role="tab"
              aria-selected={d.date === date}
              disabled={!d.open.length}
              className={'slots__day' + (d.date === date ? ' is-active' : '')}
              onClick={() => setPicked(d.date)}
            >
              <span>{dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}</span>
              <strong>{dt.getUTCDate()}</strong>
              <span>{dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}</span>
              <small>{d.open.length ? `${d.open.length} open` : 'Full'}</small>
            </button>
          )
        })}
      </div>

      {day && (
        <div className="slots__times">
          {times.map((t) => {
            const open = day.open.includes(t)
            const selected = value?.date === day.date && value.time === t
            return (
              <button
                key={t}
                disabled={!open}
                className={'slots__time' + (selected ? ' is-active' : '')}
                onClick={() => onChange({ date: day.date, time: t })}
                title={open ? `${formatTime(t)} – ${formatTime(slotEnd(kind, t))}` : 'Unavailable'}
              >
                {formatTime(t)}
              </button>
            )
          })}
        </div>
      )}
      {!firstOpen && <p className="muted">No open slots in the next few weeks. Please reach out to us on WhatsApp.</p>}
      <p className="slots__legend">
        Monday – Friday · {kind === 'consultation' ? '30-minute sessions, 11:30 AM – 7 PM' : '15-minute windows, 11 AM – 7 PM'} · All times IST
      </p>
    </div>
  )
}
