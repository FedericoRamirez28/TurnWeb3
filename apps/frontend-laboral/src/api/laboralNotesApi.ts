// src/api/laboralNotesApi.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data: unknown = isJson ? await res.json() : await res.text().catch(() => null)

  if (!res.ok) {
    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      (typeof data === 'string' && data) ||
      `Error ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

export type NoteColor = 'mint' | 'sky' | 'lilac' | 'peach' | 'lemon' | 'stone'

export type LaboralNote = {
  id: string
  text: string
  color: NoteColor
  createdAt: string
  updatedAt: string
}

export type CreateLaboralNoteInput = {
  text: string
  color: NoteColor
}

export type UpdateLaboralNoteInput = Partial<{
  text: string
  color: NoteColor
}>

export async function laboralNotesList(): Promise<LaboralNote[]> {
  const r = await fetchJSON<{ items: LaboralNote[] }>(`${API_BASE_URL}/laboral/notes`, { method: 'GET' })
  return Array.isArray(r.items) ? r.items : []
}

export async function laboralNoteCreate(input: CreateLaboralNoteInput): Promise<LaboralNote> {
  const r = await fetchJSON<{ item: LaboralNote }>(`${API_BASE_URL}/laboral/notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return r.item
}

export async function laboralNoteUpdate(id: string, patch: UpdateLaboralNoteInput): Promise<LaboralNote> {
  const r = await fetchJSON<{ item: LaboralNote }>(`${API_BASE_URL}/laboral/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return r.item
}

export async function laboralNoteDelete(id: string): Promise<{ ok: true }> {
  return fetchJSON<{ ok: true }>(`${API_BASE_URL}/laboral/notes/${id}`, { method: 'DELETE' })
}
