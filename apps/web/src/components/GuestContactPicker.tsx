"use client";

import { useEffect, useState } from "react";
import { guestContactsApi, type GuestContact } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCircle, X } from "lucide-react";

interface GuestContactPickerProps {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
}

export function GuestContactPicker({ value, onChange }: GuestContactPickerProps) {
  const [contacts, setContacts] = useState<GuestContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    guestContactsApi
      .list()
      .then((contacts) => setContacts(contacts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = contacts.find((c) => c.id === value);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <UserCircle className="w-4 h-4" />
        Contacto fantasma
      </Label>
      <div className="flex gap-2">
        <Select
          value={value ?? "none"}
          onValueChange={(v) => onChange(v === "none" ? null : v)}
          disabled={loading}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sin contacto fantasma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin contacto fantasma</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` — ${c.email}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            title="Quitar contacto fantasma"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">
          {[selected.phone, selected.whatsapp && `WhatsApp: ${selected.whatsapp}`, selected.instagram]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
