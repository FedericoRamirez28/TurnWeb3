// apps/frontend-laboral/src/api/laboralNotesApi.ts
import { apiJson } from './http'

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
  const r = await apiJson<{ items: LaboralNote[] }>('/laboral/notes')
  return Array.isArray(r.items) ? r.items : []
}

export async function laboralNoteCreate(input: CreateLaboralNoteInput): Promise<LaboralNote> {
  const r = await apiJson<{ item: LaboralNote }>('/laboral/notes', {
    method: 'POST',
    body: input,
  })
  return r.item
}

export async function laboralNoteUpdate(id: string, patch: UpdateLaboralNoteInput): Promise<LaboralNote> {
  const r = await apiJson<{ item: LaboralNote }>(`/laboral/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  })
  return r.item
}

export async function laboralNoteDelete(id: string): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>(`/laboral/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
