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
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

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
  /** Called when user confirms — parent applies schedule change then bulk action */
  onConfirm: (action: "migrate_all" | "refund_all") => Promise<void>;
  changeDate: string; // "YYYY-MM-DD"
}

export default function AffectedBookingsModal({
  open,
  onClose,
  affectedBookings,
  onConfirm,
  changeDate,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleBulkAction(action: "migrate_all" | "refund_all") {
    setLoading(true);
    try {
      await onConfirm(action);
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

        {affectedBookings.some((b) => b.commission_zone === "instructor") && (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              Algunas reservas están marcadas como{" "}
              <strong>Comisión a tu cargo</strong> porque pertenecen a clases
              de la semana actual o pasada. Al cancelarlas o migrarlas, la
              comisión de plataforma será descontada de tu próximo pago.{" "}
              <Link
                href="/condiciones-instructor"
                target="_blank"
                className="underline font-medium hover:text-amber-900"
              >
                Ver condiciones completas
              </Link>
            </span>
          </div>
        )}

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
