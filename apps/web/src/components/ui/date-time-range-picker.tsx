"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface DateTimeRangePickerProps {
  startDate: Date | undefined
  endDate: Date | undefined
  onStartChange: (date: Date) => void
  onEndChange: (date: Date) => void
  disabled?: boolean
}

function TimeSelector({
  date,
  onChange,
  label,
}: {
  date: Date | undefined
  onChange: (date: Date) => void
  label: string
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5)

  const selectedHour = date?.getHours()
  const selectedMinute = date
    ? minutes.reduce((prev, curr) =>
        Math.abs(curr - date.getMinutes()) < Math.abs(prev - date.getMinutes())
          ? curr
          : prev
      )
    : undefined

  const handleTime = (type: "hour" | "minute", value: number) => {
    const d = date ? new Date(date) : new Date()
    if (type === "hour") d.setHours(value)
    else d.setMinutes(value)
    onChange(d)
  }

  return (
    <div className="flex flex-col gap-1 min-w-[60px]">
      <span className="text-xs font-medium text-muted-foreground text-center">{label}</span>
      <div className="flex gap-0.5">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground mb-1">HH</span>
          <ScrollArea className="h-[180px] w-12">
            <div className="flex flex-col p-1 gap-0.5">
              {hours.map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={selectedHour === h ? "default" : "ghost"}
                  className="h-7 w-10 text-xs shrink-0 px-0"
                  onClick={() => handleTime("hour", h)}
                >
                  {String(h).padStart(2, "0")}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-muted-foreground mb-1">MM</span>
          <ScrollArea className="h-[180px] w-12">
            <div className="flex flex-col p-1 gap-0.5">
              {minutes.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={selectedMinute === m ? "default" : "ghost"}
                  className="h-7 w-10 text-xs shrink-0 px-0"
                  onClick={() => handleTime("minute", m)}
                >
                  {String(m).padStart(2, "0")}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

export function DateTimeRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  disabled = false,
}: DateTimeRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleDateSelect = (range: DateRange | undefined) => {
    if (!range) return

    if (range.from) {
      const d = new Date(range.from)
      d.setHours(startDate?.getHours() ?? 9, startDate?.getMinutes() ?? 0, 0, 0)
      onStartChange(d)
    }

    if (range.to) {
      const d = new Date(range.to)
      d.setHours(endDate?.getHours() ?? 10, endDate?.getMinutes() ?? 0, 0, 0)
      onEndChange(d)
    } else if (range.from) {
      // Single date selected — set end = same day + 1h
      const d = new Date(range.from)
      const startH = startDate?.getHours() ?? 9
      d.setHours(endDate?.getHours() ?? startH + 1, endDate?.getMinutes() ?? 0, 0, 0)
      onEndChange(d)
    }
  }

  const fmt = (d: Date | undefined) =>
    d ? format(d, "dd MMM yyyy, HH:mm", { locale: es }) : "—"

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-auto py-2.5",
            !startDate && !endDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span>
              <span className="text-muted-foreground">Inicio: </span>
              {fmt(startDate)}
            </span>
            <span>
              <span className="text-muted-foreground">Fin:&nbsp;&nbsp;&nbsp; </span>
              {fmt(endDate)}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="range"
            selected={
              startDate || endDate
                ? { from: startDate, to: endDate }
                : undefined
            }
            onSelect={handleDateSelect}
            locale={es}
          />
          <div className="flex gap-3 p-3 border-t sm:border-t-0 sm:border-l">
            <TimeSelector
              date={startDate}
              onChange={onStartChange}
              label="Inicio"
            />
            <TimeSelector
              date={endDate}
              onChange={onEndChange}
              label="Fin"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
