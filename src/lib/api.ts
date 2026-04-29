export const API_BASE = "https://farmwise-api-cauf.onrender.com";

const TOKEN_KEY = "farmwise_token";

const isBrowser = typeof window !== "undefined";

export const auth = {
  getToken: (): string | null => (isBrowser ? localStorage.getItem(TOKEN_KEY) : null),
  setToken: (t: string) => {
    if (isBrowser) localStorage.setItem(TOKEN_KEY, t);
  },
  clear: () => {
    if (isBrowser) localStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const token = auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  location?: string;
  cropTypes?: string[];
}

export const api = {
  register: (body: RegisterPayload) =>
    request("/api/v1/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request("/api/v1/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/api/v1/me"),
  updateMe: (body: Record<string, unknown>) =>
    request("/api/v1/me", { method: "PUT", body: JSON.stringify(body) }),
  deleteMe: () => request("/api/v1/me", { method: "DELETE" }),
  predict: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/predict", { method: "POST", body: fd });
  },
  chat: (question: string) =>
    request("/chat", { method: "POST", body: JSON.stringify({ question }) }),
  diagnoses: (limit = 20, offset = 0) =>
    request(`/api/v1/diagnoses?limit=${limit}&offset=${offset}`),
  chats: (limit = 20, offset = 0) =>
    request(`/api/v1/chats?limit=${limit}&offset=${offset}`),
  crops: (search?: string) =>
    request(`/api/v1/crops${search ? `?search=${encodeURIComponent(search)}` : ""}`),
};
