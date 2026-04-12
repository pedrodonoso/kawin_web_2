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
  cover_image_url?: string;
  status: "draft" | "published" | "archived";
  category?: { id: string; name: string; slug: string };
  instructor?: { name: string; avatar_url?: string; bio?: string };
  instructor_id?: string;
  instructor_name?: string;
  instructor_bio?: string;
  instructor_instagram?: string;
  instructor_facebook?: string;
  instructor_whatsapp?: string;
  instructor_phone?: string;
  schedule?: string;
  category_id?: string;
  category_name?: string;
  category_slug?: string;
  sessions?: Session[];
  schedules?: Schedule[];
  bookings_count?: number;
  created_at: string;
}

export interface Session {
  id: string;
  starts_at: string;
  ends_at: string;
  cancelled?: boolean;
  notes?: string;
  spots_remaining?: number; // nil = sin límite de cupos
  booking_count?: number;
}

/**
 * Recurring schedule rule for workshops of type "class".
 * days_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
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
