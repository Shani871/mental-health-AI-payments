type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

function readTokenFromStorage(): string | null {
  const directKeys = ["accessToken", "token", "jwt"];
  for (const key of directKeys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }

  const authRaw = localStorage.getItem("auth");
  if (!authRaw) return null;

  try {
    const parsed = JSON.parse(authRaw) as { accessToken?: string; token?: string };
    return parsed.accessToken || parsed.token || null;
  } catch {
    return null;
  }
}

export async function apiFetch<T = JsonValue>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readTokenFromStorage();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const errorData = await response.json();
      if (typeof errorData?.message === "string") {
        message = errorData.message;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const token = readTokenFromStorage();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const errorData = await response.json();
      if (typeof errorData?.message === "string") {
        message = errorData.message;
      }
    } catch {
      // keep fallback
    }
    throw new Error(message);
  }

  return response.blob();
}
