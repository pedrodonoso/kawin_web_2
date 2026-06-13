"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface TimePickerProps {
  /** Valor en formato "HH:MM" */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

export function TimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Seleccionar hora",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const [selHour, selMin] = React.useMemo(() => {
    if (!value) return [undefined, undefined]
    const [h, m] = value.split(":").map(Number)
    const snapped = MINUTES.reduce((prev, curr) =>
      Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
    )
    return [h, snapped]
  }, [value])

  const emit = (h: number, m: number) =>
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)

  const handleHour = (h: number) => emit(h, selMin ?? 0)
  const handleMin = (m: number) => emit(selHour ?? 0, m)

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <ClockIcon className="mr-2 h-4 w-4 opacity-70 shrink-0" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex gap-2">
          {/* Hours */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">HH</span>
            <ScrollArea className="h-48 w-14">
              <div className="flex flex-col gap-0.5 p-1">
                {HOURS.map((h) => (
                  <Button
                    key={h}
                    type="button"
                    size="sm"
                    variant={selHour === h ? "default" : "ghost"}
                    className="h-7 w-12 px-0 text-xs"
                    onClick={() => handleHour(h)}
                  >
                    {String(h).padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </div>

          <div className="flex items-center text-muted-foreground font-bold text-lg pt-6">:</div>

          {/* Minutes */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">MM</span>
            <ScrollArea className="h-48 w-14">
              <div className="flex flex-col gap-0.5 p-1">
                {MINUTES.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={selMin === m ? "default" : "ghost"}
                    className="h-7 w-12 px-0 text-xs"
                    onClick={() => handleMin(m)}
                  >
                    {String(m).padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
