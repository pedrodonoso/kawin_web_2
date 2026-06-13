"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  /** Valor en formato "YYYY-MM-DD" */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Fecha mínima seleccionable (deshabilita días anteriores) */
  minDate?: Date
  /** Fecha máxima seleccionable (deshabilita días posteriores) */
  maxDate?: Date
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Seleccionar fecha",
  minDate,
  maxDate,
}: DatePickerProps) {
  const disabledMatcher = React.useMemo(() => {
    const min = minDate ? new Date(minDate.setHours(0, 0, 0, 0)) : undefined
    const max = maxDate ? new Date(maxDate.setHours(0, 0, 0, 0)) : undefined
    if (!min && !max) return undefined
    return (day: Date) => {
      if (min && day < min) return true
      if (max && day > max) return true
      return false
    }
  }, [minDate, maxDate])
  const selected = React.useMemo(() => {
    if (!value) return undefined
    const parts = value.split("-").map(Number)
    if (parts.length !== 3 || parts.some(isNaN)) return undefined
    return new Date(parts[0], parts[1] - 1, parts[2])
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    if (!date) { onChange(""); return }
    onChange(format(date, "yyyy-MM-dd"))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70 shrink-0" />
          {selected
            ? format(selected, "dd MMM yyyy", { locale: es })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          locale={es}
          disabled={disabledMatcher}
        />
      </PopoverContent>
    </Popover>
  )
}
