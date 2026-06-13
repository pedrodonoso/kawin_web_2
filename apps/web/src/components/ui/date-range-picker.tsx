"use client"

import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  /** Fecha inicio en formato "YYYY-MM-DD" */
  from: string
  /** Fecha fin en formato "YYYY-MM-DD" */
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Si se pasa, deshabilita fechas anteriores a ese día. */
  minDate?: Date
}

/** Parsea "YYYY-MM-DD" como fecha local (no UTC) */
function parseLocal(s: string): Date | undefined {
  if (!s) return undefined
  const parts = s.split("-").map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return undefined
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function fmtDate(d: Date) {
  return format(d, "dd MMM yyyy", { locale: es })
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  disabled = false,
  placeholder = "Seleccionar rango",
  minDate,
}: DateRangePickerProps) {
  // Estado interno: evita que el round-trip al padre interrumpa la selección
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const f = parseLocal(from)
    const t = parseLocal(to)
    return f ? { from: f, to: t } : undefined
  })

  // Sincronizar solo cuando los props cambian desde afuera (ej. reset del form)
  const prevFrom = React.useRef(from)
  const prevTo = React.useRef(to)
  React.useEffect(() => {
    if (from !== prevFrom.current || to !== prevTo.current) {
      prevFrom.current = from
      prevTo.current = to
      const f = parseLocal(from)
      const t = parseLocal(to)
      setRange(f ? { from: f, to: t } : undefined)
    }
  }, [from, to])

  const minDay = React.useMemo(() => {
    if (!minDate) return undefined
    const d = new Date(minDate)
    d.setHours(0, 0, 0, 0)
    return d
  }, [minDate])

  // onSelect recibe (range, clickedDay, modifiers, e) en react-day-picker v10
  const handleSelect = (r: DateRange | undefined, clickedDay: Date) => {
    const prevComplete = !!(range?.from && range?.to)

    if (prevComplete) {
      // Con rango completo, cualquier click reinicia desde la fecha clickeada
      const fresh: DateRange = { from: clickedDay, to: undefined }
      setRange(fresh)
      onFromChange(toISO(clickedDay))
      onToChange("")
      return
    }

    // react-day-picker v10 sin `min` devuelve {from:A, to:A} en el primer click.
    // Normalizamos a fecha única: {from:A, to:undefined}
    let normalized = r
    if (r?.from && r?.to && r.from.getTime() === r.to.getTime()) {
      normalized = { from: r.from, to: undefined }
    }
    setRange(normalized)
    onFromChange(normalized?.from ? toISO(normalized.from) : "")
    onToChange(normalized?.to ? toISO(normalized.to) : "")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRange(undefined)
    onFromChange("")
    onToChange("")
  }

  const label = React.useMemo(() => {
    const f = parseLocal(from)
    const t = parseLocal(to)
    if (f && t) return `${fmtDate(f)} – ${fmtDate(t)}`
    if (f) return `Desde ${fmtDate(f)}`
    return null
  }, [from, to])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !label && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70 shrink-0" />
          <span className="flex-1 truncate">{label ?? placeholder}</span>
          {label && (
            <XIcon
              className="ml-2 h-3.5 w-3.5 opacity-50 hover:opacity-100 shrink-0"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          locale={es}
          numberOfMonths={2}
          disabled={minDay ? (d: Date) => d < minDay : undefined}
        />
        {range?.from && !range.to && (
          <p className="text-center text-xs text-muted-foreground py-2 border-t">
            Selecciona la fecha de fin, o cierra para dejar abierta la vigencia
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
