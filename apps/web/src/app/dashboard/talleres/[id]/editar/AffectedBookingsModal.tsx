"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

export interface AffectedBooking {
  booking_id: string;
  student_name: string;
  session_date: string;
  session_time: string;
  amount: number;
  commission_zone: "instructor" | "platform";
}

interface Props {
  open: boolean;
  onClose: () => void;
  affectedBookings: AffectedBooking[];
  oldScheduleId: string;
  newScheduleId: string;
  onComplete: () => void;
  changeDate: string; // "YYYY-MM-DD"
}

export default function AffectedBookingsModal({
  open,
  onClose,
  affectedBookings,
  oldScheduleId,
  newScheduleId,
  onComplete,
  changeDate,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleBulkAction(action: "migrate_all" | "refund_all") {
    setLoading(true);
    try {
      const res = await api.post<{
        migrated?: number;
        refunded?: number;
        message?: string;
      }>(`/api/v1/schedules/${oldScheduleId}/bulk-action`, {
        action,
        new_schedule_id: newScheduleId,
        change_date: changeDate,
      });
      const migrated = res?.migrated ?? (action === "migrate_all" ? affectedBookings.length : 0);
      const refunded = res?.refunded ?? (action === "refund_all" ? affectedBookings.length : 0);
      toast.success(`Acción completada: ${migrated} migradas, ${refunded} devueltas`);
      onComplete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar la acción");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reservas afectadas por el cambio de horario</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-800">{affectedBookings.length} reservas</span>{" "}
          serán afectadas a partir del{" "}
          <span className="font-semibold text-zinc-800">{changeDate}</span>
        </p>

        <div className="overflow-y-auto flex-1 mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="pb-2 font-medium">Alumno</th>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Hora</th>
                <th className="pb-2 font-medium text-right">Monto</th>
                <th className="pb-2 font-medium text-right">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {affectedBookings.map((b) => (
                <tr key={b.booking_id} className="py-2">
                  <td className="py-2 pr-3 font-medium">{b.student_name}</td>
                  <td className="py-2 pr-3 text-zinc-600">{b.session_date}</td>
                  <td className="py-2 pr-3 text-zinc-600">{b.session_time}</td>
                  <td className="py-2 pr-3 text-right text-zinc-700">
                    {b.amount.toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    {b.commission_zone === "instructor" ? (
                      <Badge variant="destructive" className="text-xs">
                        Comisión a tu cargo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        Sin cargo
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => handleBulkAction("refund_all")}
          >
            {loading ? "Procesando..." : "Devolver todas"}
          </Button>
          <Button
            disabled={loading}
            onClick={() => handleBulkAction("migrate_all")}
          >
            {loading ? "Procesando..." : "Migrar todas al nuevo horario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
