const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const isJson = res.headers
    .get('content-type')
    ?.includes('application/json');

  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      `Error ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

/* ========= Tipos ========= */

export type AuthUser = {
  sub: string;
  username: string;
  displayName: string;
  role: string;
};

/* ========= Auth API ========= */

export async function authMe(): Promise<AuthUser | null> {
  const r = await fetchJSON<{ user: AuthUser | null }>(
    `${API_BASE_URL}/auth/me`,
  );
  return r.user;
}

export async function authLogin(
  username: string,
  password: string,
  remember: boolean,
): Promise<AuthUser> {
  const r = await fetchJSON<{ user: AuthUser }>(
    `${API_BASE_URL}/auth/login`,
    {
      method: 'POST',
      body: JSON.stringify({ username, password, remember }),
    },
  );
  return r.user;
}

export async function authRegister(
  username: string,
  password: string,
  displayName: string | undefined,
  remember: boolean,
): Promise<AuthUser> {
  const r = await fetchJSON<{ user: AuthUser }>(
    `${API_BASE_URL}/auth/register`,
    {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        displayName,
        remember,
      }),
    },
  );
  return r.user;
}

export async function authLogout(): Promise<void> {
  await fetchJSON(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
}

/* ========= Password reset  ========= */

export async function requestPasswordReset(username: string): Promise<string> {
  const r = await fetchJSON<{ ok: true; token: string }>(
    `${API_BASE_URL}/auth/password/request`,
    {
      method: 'POST',
      body: JSON.stringify({ username }),
    },
  );
  return r.token;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await fetchJSON<{ ok: true }>(`${API_BASE_URL}/auth/password/reset`, {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
