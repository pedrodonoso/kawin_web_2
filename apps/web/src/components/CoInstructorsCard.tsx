"use client";

import { useEffect, useRef, useState } from "react";
import {
  adminApi, guestContactsApi,
  type CoInstructorRef, type GuestContact, type UserSearchResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, X, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  workshopId: string;
  /** user_id del tallerista principal, para no ofrecerlo como co-tallerista. */
  primaryUserId?: string;
}

/** Item del borrador: exactamente una referencia + datos para mostrar. */
type DraftItem = {
  key: string;
  user_id: string | null;
  guest_contact_id: string | null;
  name: string;
  sub: string;
  isGuest: boolean;
};

export function CoInstructorsCard({ workshopId, primaryUserId }: Props) {
  const [draft, setDraft] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Buscador de usuarios registrados
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contactos fantasma disponibles
  const [guests, setGuests] = useState<GuestContact[]>([]);

  useEffect(() => {
    Promise.all([
      adminApi.getWorkshopInstructors(workshopId).catch(() => []),
      guestContactsApi.list().catch(() => []),
    ]).then(([cur, gc]) => {
      setGuests(gc);
      setDraft(
        cur.map((c) => ({
          key: c.id,
          user_id: c.user_id,
          guest_contact_id: c.guest_contact_id,
          name: c.name || "(sin nombre)",
          sub: c.is_guest ? "Fantasma" : c.email,
          isGuest: c.is_guest,
        }))
      );
      setLoading(false);
    });
  }, [workshopId]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      adminApi.searchUsers(query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  function alreadyAdded(userId: string | null, guestId: string | null): boolean {
    return draft.some((d) => (userId && d.user_id === userId) || (guestId && d.guest_contact_id === guestId));
  }

  function addUser(u: UserSearchResult) {
    if (u.id === primaryUserId) { toast.error("Ese usuario ya es el tallerista principal"); return; }
    if (alreadyAdded(u.id, null)) { toast.error("Ese tallerista ya está en la lista"); return; }
    setDraft((d) => [...d, {
      key: `u-${u.id}`, user_id: u.id, guest_contact_id: null,
      name: u.name || u.email, sub: u.email, isGuest: false,
    }]);
    setDirty(true);
    setQuery("");
    setResults([]);
  }

  function addGuest(guestId: string) {
    const g = guests.find((x) => x.id === guestId);
    if (!g) return;
    if (alreadyAdded(null, g.id)) { toast.error("Ese contacto ya está en la lista"); return; }
    setDraft((d) => [...d, {
      key: `g-${g.id}`, user_id: null, guest_contact_id: g.id,
      name: g.name, sub: "Fantasma", isGuest: true,
    }]);
    setDirty(true);
  }

  function remove(key: string) {
    setDraft((d) => d.filter((x) => x.key !== key));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const refs: CoInstructorRef[] = draft.map((d) =>
        d.user_id ? { user_id: d.user_id } : { guest_contact_id: d.guest_contact_id! }
      );
      await adminApi.setWorkshopInstructors(workshopId, refs);
      setDirty(false);
      toast.success("Co-talleristas actualizados");
    } catch {
      toast.error("Error al guardar co-talleristas");
    } finally {
      setSaving(false);
    }
  }

  const availableGuests = guests.filter((g) => !alreadyAdded(null, g.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Co-talleristas</CardTitle>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Talleristas adicionales que se muestran en la ficha pública junto al principal.
          Solo visibilidad: no reciben permisos, ingresos ni notificaciones.
        </p>

        {/* Lista actual */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : draft.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            No hay co-talleristas asignados.
          </div>
        ) : (
          <ul className="space-y-2">
            {draft.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.sub}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={d.isGuest ? "outline" : "secondary"} className="text-[10px] h-5">
                    {d.isGuest ? "Fantasma" : "Registrado"}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => remove(d.key)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Agregar registrado */}
        <div className="space-y-2 rounded-lg border p-4">
          <Label className="text-sm">Agregar tallerista registrado</Label>
          <div className="relative">
            <Input
              placeholder="Buscar por nombre o email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(searching || results.length > 0) && query.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-md max-h-60 overflow-auto">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
                ) : (
                  results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addUser(u)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="font-medium">{u.name || u.email}</span>
                        {u.name && <span className="text-muted-foreground"> · {u.email}</span>}
                      </span>
                    </button>
                  ))
                )}
                {!searching && results.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agregar fantasma */}
        <div className="space-y-2 rounded-lg border p-4">
          <Label className="text-sm">Agregar contacto fantasma</Label>
          <Select value="" onValueChange={addGuest} disabled={availableGuests.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={
                availableGuests.length === 0 ? "No hay contactos disponibles" : "Elige un contacto..."
              } />
            </SelectTrigger>
            <SelectContent>
              {availableGuests.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}{g.email ? ` (${g.email})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Los contactos fantasma se crean en Admin → Contactos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
