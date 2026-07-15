"use client";

import { useEffect, useState } from "react";
import { adminApi, guestContactsApi, type GuestContact, type GuestContactInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Props {
  entityId: string;
  entityType: "workshop" | "route";
  currentContactId: string | null | undefined;
  useGuestContact: boolean;
  realInstructorName: string;
  realInstructorEmail?: string;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  onSaved: (contactId: string | null, useGuestContact: boolean) => void;
}

const EMPTY_FORM: GuestContactInput = {
  name: "", email: "", phone: "", whatsapp: "", bio: "", instagram: "", website: "",
};

function ContactDetail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function AdminContactCard({
  entityId, entityType,
  currentContactId, useGuestContact,
  realInstructorName, realInstructorEmail,
  editing, onEditingChange, onSaved,
}: Props) {
  const [contacts, setContacts] = useState<GuestContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [saving, setSaving] = useState(false);

  // draft state
  const [draftUseGuest, setDraftUseGuest] = useState(useGuestContact);
  const [draftContactId, setDraftContactId] = useState<string>(currentContactId ?? "none");
  // form for creating a new guest contact or editing the selected one
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<GuestContactInput>(EMPTY_FORM);

  useEffect(() => {
    guestContactsApi.list()
      .then(setContacts)
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  // Reset draft to current values when editing opens
  useEffect(() => {
    if (editing) {
      setDraftUseGuest(useGuestContact);
      setDraftContactId(currentContactId ?? "none");
      setFormMode(null);
      setForm(EMPTY_FORM);
    }
  }, [editing, useGuestContact, currentContactId]);

  const currentContact = contacts.find((c) => c.id === currentContactId);
  const draftContact   = contacts.find((c) => c.id === draftContactId);
  const displayingGuest = !!currentContactId && useGuestContact;
  const label = entityType === "workshop" ? "tallerista" : "guía";

  function cancel() {
    onEditingChange(false);
    setFormMode(null);
  }

  function startCreate() {
    setFormMode("create");
    setForm(EMPTY_FORM);
    setDraftUseGuest(true);
  }

  function startEdit() {
    const c = contacts.find((x) => x.id === draftContactId);
    if (!c) return;
    setForm({
      name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "", bio: c.bio ?? "", instagram: c.instagram ?? "", website: c.website ?? "",
    });
    setFormMode("edit");
    setDraftUseGuest(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let contactId: string | null = draftContactId === "none" ? null : draftContactId;

      if (formMode === "create") {
        if (!form.name.trim()) { toast.error("El nombre es obligatorio"); setSaving(false); return; }
        const res = await guestContactsApi.create(form);
        const newContact = await guestContactsApi.get(res.id);
        setContacts((prev) => [...prev, newContact]);
        contactId = res.id;
      } else if (formMode === "edit" && draftContactId !== "none") {
        if (!form.name.trim()) { toast.error("El nombre es obligatorio"); setSaving(false); return; }
        await guestContactsApi.update(draftContactId, form);
        const updated = await guestContactsApi.get(draftContactId);
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        contactId = draftContactId;
      }

      const useGuest = contactId !== null ? draftUseGuest : true;

      if (entityType === "workshop") {
        await adminApi.setWorkshopGuestContact(entityId, contactId, useGuest);
      } else {
        await adminApi.setRouteGuestContact(entityId, contactId, useGuest);
      }

      onSaved(contactId, useGuest);
      onEditingChange(false);
      setFormMode(null);
      toast.success("Cambios guardados");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Contacto</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {!editing ? (
          /* ── Read mode ── */
          <div className="space-y-4">
            {/* Real instructor */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium capitalize">{label} real</p>
                {!displayingGuest && (
                  <Badge className="text-[10px] h-4 px-1.5">Visible</Badge>
                )}
              </div>
              <div className="rounded-lg border px-4 py-3 space-y-0.5">
                <p className="text-sm font-semibold">{realInstructorName || "—"}</p>
                {realInstructorEmail && (
                  <p className="text-xs text-muted-foreground">{realInstructorEmail}</p>
                )}
              </div>
            </div>

            {/* Guest contact */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Contacto fantasma</p>
                {displayingGuest && (
                  <Badge className="text-[10px] h-4 px-1.5">Visible</Badge>
                )}
                {!currentContact && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                    Sin asignar
                  </Badge>
                )}
              </div>
              {currentContact ? (
                <div className="rounded-lg border px-4 py-3 space-y-2">
                  <p className="text-sm font-semibold">{currentContact.name}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <ContactDetail label="Email"     value={currentContact.email} />
                    <ContactDetail label="Teléfono"  value={currentContact.phone} />
                    <ContactDetail label="WhatsApp"  value={currentContact.whatsapp} />
                    <ContactDetail label="Instagram" value={currentContact.instagram} />
                    <ContactDetail label="Sitio web" value={currentContact.website} />
                  </div>
                  {currentContact.bio && (
                    <p className="text-xs text-muted-foreground italic border-t pt-2">{currentContact.bio}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  No hay contacto fantasma asignado.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Edit mode ── */
          <div className="space-y-5">
            {/* Toggle who to show */}
            <div className="space-y-2">
              <Label>¿Quién se muestra como {label}?</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraftUseGuest(false)}
                  className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                    !draftUseGuest
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <p className="text-sm font-medium capitalize">{label} real</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{realInstructorName}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftUseGuest(true)}
                  disabled={draftContactId === "none" && formMode !== "create"}
                  className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    draftUseGuest
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <p className="text-sm font-medium">Contacto fantasma</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {formMode === "create"
                      ? (form.name || "Nuevo contacto")
                      : formMode === "edit"
                        ? (form.name || "Editando contacto")
                        : (draftContact?.name ?? "Selecciona uno abajo")}
                  </p>
                </button>
              </div>
            </div>

            {/* Guest contact selector / creator / editor */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  {formMode === "edit"
                    ? "Editar contacto fantasma"
                    : formMode === "create"
                      ? "Nuevo contacto fantasma"
                      : "Contacto fantasma"}
                </Label>
                <div className="flex items-center gap-3">
                  {formMode === null && draftContactId !== "none" && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar seleccionado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (formMode === null ? startCreate() : setFormMode(null))}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {formMode === null ? "Crear nuevo" : "Seleccionar existente"}
                  </button>
                </div>
              </div>

              {formMode === null ? (
                <Select
                  value={draftContactId}
                  onValueChange={(v) => {
                    setDraftContactId(v);
                    if (v !== "none") setDraftUseGuest(true);
                  }}
                  disabled={loadingContacts}
                >
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
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Nombre *</Label>
                    <Input
                      placeholder="María González"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" placeholder="maria@ejemplo.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono</Label>
                    <Input type="tel" placeholder="+56 9 1234 5678" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input type="tel" placeholder="+56 9 1234 5678" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Instagram</Label>
                    <Input placeholder="@usuario" value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Sitio web</Label>
                    <Input type="url" placeholder="https://..." value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Bio</Label>
                    <Textarea placeholder="Breve descripción..." rows={2} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            {/* Action row — visible right below the form */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving
                  ? (formMode === "create" ? "Creando..." : "Guardando...")
                  : (formMode === "create" ? "Crear y guardar" : "Guardar cambios")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
