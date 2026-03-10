const API_BASE =
  typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL ?? "http://api:8080")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080");

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
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
  instructor_name?: string;
  instructor_bio?: string;
  schedule?: string;
  category_id?: string;
  category_name?: string;
  category_slug?: string;
  sessions?: Session[];
  created_at: string;
}

export interface Session {
  id: string;
  starts_at: string;
  ends_at: string;
  notes?: string;
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
