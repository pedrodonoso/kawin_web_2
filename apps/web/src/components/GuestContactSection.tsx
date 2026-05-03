"use client";

import { useEffect, useState } from "react";
import { guestContactsApi, type GuestContact, type GuestContactInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCircle, Plus, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface GuestContactSectionProps {
  currentContactId: string | null | undefined;
  useGuestContact: boolean;
  realInstructorName?: string | null;
  onSave: (id: string | null, useGuestContact: boolean) => Promise<void>;
}

const EMPTY_FORM: GuestContactInput = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  bio: "",
  instagram: "",
  website: "",
};

export function GuestContactSection({
  currentContactId,
  useGuestContact,
  realInstructorName,
  onSave,
}: GuestContactSectionProps) {
  const [contacts, setContacts] = useState<GuestContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedId, setSelectedId] = useState<string>("none");
  const [createForm, setCreateForm] = useState<GuestContactInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    guestContactsApi
      .list()
      .then(setContacts)
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  const currentContact = contacts.find((c) => c.id === currentContactId);
  const hasBoth = !!currentContactId && !!realInstructorName;

  function setField(field: keyof GuestContactInput, value: string) {
    setCreateForm((f) => ({ ...f, [field]: value }));
  }

  async function handleToggleDisplay(showGuest: boolean) {
    setSaving(true);
    try {
      await onSave(currentContactId ?? null, showGuest);
      toast.success(showGuest ? "Mostrando contacto fantasma" : "Mostrando instructor real");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssociate() {
    setSaving(true);
    try {
      await onSave(selectedId === "none" ? null : selectedId, true);
      setOpen(false);
      toast.success(selectedId === "none" ? "Contacto fantasma eliminado" : "Contacto fantasma asociado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!createForm.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const res = await guestContactsApi.create(createForm);
      const newContact = await guestContactsApi.get(res.id);
      setContacts((prev) => [...prev, newContact]);
      await onSave(res.id, true);
      setCreateForm(EMPTY_FORM);
      setOpen(false);
      toast.success("Contacto creado y asociado");
    } catch {
      toast.error("Error al crear el contacto");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await onSave(null, true);
      toast.success("Contacto fantasma eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Contacto fantasma</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setOpen((v) => !v); setMode("select"); setSelectedId(currentContactId ?? "none"); }}
        >
          <Plus className="h-4 w-4 mr-1" />
          {currentContact ? "Cambiar contacto" : "Agregar contacto"}
          {open ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {/* Current contact display + toggle */}
      {currentContact && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold">{currentContact.name}</p>
              <div className="text-muted-foreground space-y-0.5">
                {currentContact.email    && <p>Email: {currentContact.email}</p>}
                {currentContact.phone    && <p>Teléfono: {currentContact.phone}</p>}
                {currentContact.whatsapp && <p>WhatsApp: {currentContact.whatsapp}</p>}
                {currentContact.instagram && <p>Instagram: {currentContact.instagram}</p>}
                {currentContact.website  && <p>Web: {currentContact.website}</p>}
                {currentContact.bio      && <p className="mt-1 text-xs italic">{currentContact.bio}</p>}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleRemove}
              disabled={saving}
              title="Quitar contacto fantasma"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Toggle: only shown when both instructor and guest contact exist */}
          {hasBoth && (
            <div className="border-t pt-2 space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">¿Quién se muestra públicamente?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleDisplay(false)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    !useGuestContact
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                  }`}
                >
                  Instructor real
                  {realInstructorName && <span className="block font-normal opacity-70 truncate">{realInstructorName}</span>}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleDisplay(true)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    useGuestContact
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                  }`}
                >
                  Contacto fantasma
                  <span className="block font-normal opacity-70 truncate">{currentContact.name}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "select" ? "default" : "outline"} onClick={() => setMode("select")}>
              Seleccionar existente
            </Button>
            <Button type="button" size="sm" variant={mode === "create" ? "default" : "outline"} onClick={() => setMode("create")}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Crear nuevo
            </Button>
          </div>

          {mode === "select" && (
            <div className="space-y-3">
              <Select value={selectedId} onValueChange={setSelectedId} disabled={loadingContacts}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un contacto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin contacto fantasma —</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.email ? ` (${c.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" size="sm" onClick={handleAssociate} disabled={saving}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label>Nombre *</Label>
                  <Input placeholder="María González" value={createForm.name} onChange={(e) => setField("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" placeholder="maria@ejemplo.com" value={createForm.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input type="tel" placeholder="+56 9 1234 5678" value={createForm.phone} onChange={(e) => setField("phone", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>WhatsApp</Label>
                  <Input type="tel" placeholder="+56 9 1234 5678" value={createForm.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Instagram</Label>
                  <Input placeholder="@usuario" value={createForm.instagram} onChange={(e) => setField("instagram", e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label>Sitio web</Label>
                  <Input type="url" placeholder="https://..." value={createForm.website} onChange={(e) => setField("website", e.target.value)} />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label>Bio</Label>
                  <Textarea placeholder="Breve descripción..." rows={3} value={createForm.bio} onChange={(e) => setField("bio", e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Creando..." : "Crear y asociar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
