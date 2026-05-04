// Server-side: llama directo al API interno (Docker network).
// Client-side: usa ruta relativa "/" → Next.js rewrite lo proxea a api:8080.
// Esto permite acceder desde cualquier dispositivo en la red sin hardcodear IPs.
const API_BASE =
  typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL ?? "http://api:8080")
    : "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Error de servidor");
  }
  return res.json();
}

export interface ApiResponse<T> {
  data: T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getList: async <T>(path: string): Promise<T[]> => {
    const res = await request<T[] | ApiResponse<T[]>>(path);
    if (Array.isArray(res)) return res;
    if (res && typeof res === "object" && "data" in res) return (res as ApiResponse<T[]>).data;
    return [];
  },
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Types
export interface Workshop {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: "workshop" | "course" | "class" | "event";
  modality: "in-person" | "online" | "hybrid";
  price: number;
  currency: string;
  capacity?: number;
  location?: string;
  lat?: number | null;
  lng?: number | null;
  online_url?: string;
  cover_image_url?: string;
  status: "draft" | "published" | "archived";
  approval_status?: "not_submitted" | "pending_review" | "approved" | "changes_requested";
  admin_observations?: string;
  category?: { id: string; name: string; slug: string };
  category_id?: string;
  category_name?: string;
  category_slug?: string;
  instructor?: { name: string; avatar_url?: string; bio?: string };
  instructor_id?: string;
  instructor_name?: string;
  instructor_bio?: string;
  instructor_instagram?: string;
  instructor_facebook?: string;
  instructor_whatsapp?: string;
  instructor_phone?: string;
  schedule?: string;
  sessions?: Session[];
  schedules?: Schedule[];
  bookings_count?: number;
  discounts?: Discount[];
  created_at: string;
}

export interface Session {
  id: string;
  starts_at: string;
  ends_at: string;
  cancelled?: boolean;
  notes?: string;
  online_url?: string;
  spots_remaining?: number; // nil = sin límite de cupos
  booking_count?: number;
}

/**
 * Recurring schedule rule for workshops of type "class".
 * days_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
export interface InstructorProfile {
  id: string;
  name: string;
  bio: string;
  avatar_url: string;
  phone: string;
  whatsapp: string;
  instagram_url: string;
  facebook_url: string;
  city: string;
  country: string;
  workshops: Workshop[];
}

export interface Schedule {
  id: string;
  workshop_id: string;
  days_of_week: number[];
  time_start: string;       // "HH:MM"
  duration_min: number;
  valid_from: string;       // "YYYY-MM-DD"
  valid_until?: string;     // "YYYY-MM-DD" | undefined = active indefinitely
  created_at: string;
}

/**
 * Slot calculado para el calendario de administración del tallerista.
 * Retornado por GET /workshops/:id/available-slots.
 */
export interface AvailableSlot {
  date: string;              // "YYYY-MM-DD"
  time: string;              // "HH:MM"
  duration_min: number;
  schedule_id: string;
  session_id?: string;       // undefined = no materializado aún
  online_url?: string;       // link personalizado de la sesión
  spots_remaining?: number;  // undefined = sin límite
  booking_count: number;     // reservas activas de esta sesión
  status: "not_materialized" | "available" | "full" | "cancelled";
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; role: string };
}

export interface Profile {
  name: string;
  bio: string;
  phone: string;
  whatsapp: string;
  instagram_url: string;
  facebook_url: string;
}

export interface PendingChanges {
  title?:       string;
  description?: string;
  modality?:    string;
}

export interface AdminWorkshop extends Workshop {
  instructor_id:    string;
  instructor_email: string;
  pending_changes?: PendingChanges | null;
  guest_contact_id?: string | null;
  use_guest_contact?: boolean;
}

export interface AdminStats {
  total_workshops: number;
  published_workshops: number;
  draft_workshops: number;
  pending_review: number;
  changes_requested: number;
  total_instructors: number;
  total_students: number;
  total_bookings: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  platform_commission: number;
}

export interface AppNotification {
  id: string;
  type: string;
  data: {
    type: string;
    message: string;
    workshop_id?: string;
    workshop_title?: string;
    booking_id?: string;
    student_name?: string;
    session_date?: string;
    amount?: number;
    reason?: string;
    instructor_name?: string;
    recipient_role?: string;
    [key: string]: unknown;
  };
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  list: () =>
    api
      .get<{ data: AppNotification[]; unread_count: number }>("/api/v1/my-notifications")
      .then((r) => r),
  markRead: (id: string) =>
    api.post<{ data: { id: string; read: boolean } }>(`/api/v1/notifications/${id}/read`, {}),
  markAllRead: () =>
    api.post<{ data: { marked_read: number } }>("/api/v1/notifications/read-all", {}),
};

export interface Discount {
  id: string;
  workshop_id: string;
  session_id?: string;
  type: "percent" | "flat";
  value: number;
  label: string;
  max_uses?: number;
  uses_count: number;
  active: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
}

export interface InstructorStats {
  total_bookings: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  this_month_bookings: number;
  this_month_revenue: number;
  by_workshop: {
    workshop_id: string;
    workshop_title: string;
    confirmed: number;
    cancelled: number;
    revenue: number;
  }[];
  over_time: {
    month: string;
    bookings: number;
    revenue: number;
  }[];
  top_students: {
    student_name: string;
    student_email: string;
    booking_count: number;
    total_spent: number;
    last_workshop: string;
  }[];
}

export const discountApi = {
  list: (workshopId: string) =>
    api.get<{ data: Discount[] }>(`/api/v1/workshops/${workshopId}/discounts`).then((r) => r.data),
  create: (workshopId: string, body: Omit<Discount, "id" | "workshop_id" | "uses_count" | "created_at">) =>
    api.post<{ data: Discount }>(`/api/v1/workshops/${workshopId}/discounts`, body).then((r) => r.data),
  update: (id: string, body: Partial<Pick<Discount, "active" | "label" | "value" | "max_uses" | "valid_from" | "valid_until">>) =>
    api.put<{ data: Discount }>(`/api/v1/discounts/${id}`, body).then((r) => r.data),
  delete: (id: string) =>
    api.delete<{ data: { id: string; deleted: boolean } }>(`/api/v1/discounts/${id}`).then((r) => r.data),
};

export const instructorApi = {
  getStats: () =>
    api.get<{ data: InstructorStats }>("/api/v1/instructor/stats").then((r) => r.data),
};

export const adminApi = {
  getStats: () => api.get<{ data: AdminStats }>("/api/v1/admin/stats").then((r) => r.data),
  getWorkshops: (status?: string) =>
    api
      .get<{ data: AdminWorkshop[] }>(`/api/v1/admin/workshops${status ? `?status=${status}` : ""}`)
      .then((r) => r.data),
  updateWorkshop: (id: string, body: Partial<AdminWorkshop>) =>
    api.put<{ data: { id: string } }>(`/api/v1/admin/workshops/${id}`, body),
  reviewWorkshop: (id: string, action: "approve" | "send_observations", observations?: string) =>
    api.post<{ data: { id: string; approval_status: string } }>(`/api/v1/admin/workshops/${id}/review`, {
      action,
      observations: observations ?? "",
    }),
  submitForReview: (id: string, previousValues?: PendingChanges) =>
    api.post<{ data: { id: string; approval_status: string } }>(`/api/v1/my-workshops/${id}/submit-review`, {
      previous_values: previousValues ?? null,
    }),
  setWorkshopGuestContact: (workshopId: string, guestContactId: string | null, useGuest: boolean) =>
    api.patch<{ data: { id: string } }>(`/api/v1/admin/workshops/${workshopId}/guest-contact`, {
      guest_contact_id: guestContactId,
      use_guest_contact: useGuest,
    }),
  setRouteGuestContact: (routeId: string, guestContactId: string | null, useGuest: boolean) =>
    api.patch<{ data: { id: string } }>(`/api/v1/admin/routes/${routeId}/guest-contact`, {
      guest_contact_id: guestContactId,
      use_guest_contact: useGuest,
    }),
};


// ---------------------------------------------------------------------------
// Guest contacts
// ---------------------------------------------------------------------------

export interface GuestContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  bio: string;
  instagram: string;
  website: string;
  created_by?: string;
  created_by_name?: string;
  workshops_count?: number;
  routes_count?: number;
  created_at: string;
}

export type GuestContactInput = Omit<GuestContact, "id" | "created_by" | "created_by_name" | "workshops_count" | "routes_count" | "created_at">;

export const guestContactsApi = {
  list: () =>
    api.get<{ data: GuestContact[] }>("/api/v1/admin/guest-contacts").then((r) => r.data),
  get: (id: string) =>
    api.get<{ data: GuestContact }>(`/api/v1/admin/guest-contacts/${id}`).then((r) => r.data),
  create: (body: GuestContactInput) =>
    api.post<{ data: { id: string } }>("/api/v1/admin/guest-contacts", body).then((r) => r.data),
  update: (id: string, body: GuestContactInput) =>
    api.put<{ data: { id: string } }>(`/api/v1/admin/guest-contacts/${id}`, body).then((r) => r.data),
  delete: (id: string) =>
    api.delete<{ data: { id: string } }>(`/api/v1/admin/guest-contacts/${id}`).then((r) => r.data),
};
