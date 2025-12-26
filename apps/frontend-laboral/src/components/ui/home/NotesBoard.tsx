// src/components/ui/home/NotesBoard.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  laboralNotesList,
  laboralNoteCreate,
  laboralNoteUpdate,
  laboralNoteDelete,
  type LaboralNote as Note,
  type NoteColor,
} from '@/api/laboralNotesApi'

const COLORS: { key: NoteColor; label: string }[] = [
  { key: 'mint', label: 'Menta' },
  { key: 'sky', label: 'Cielo' },
  { key: 'lilac', label: 'Lila' },
  { key: 'peach', label: 'Durazno' },
  { key: 'lemon', label: 'Limón' },
  { key: 'stone', label: 'Gris' },
]

function clampText(s: string) {
  return (s || '').replace(/\r\n/g, '\n').slice(0, 4000)
}

type NotePatch = { text?: string; color?: NoteColor }

export function NotesBoard() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [draft, setDraft] = useState('')
  const [draftColor, setDraftColor] = useState<NoteColor>('mint')

  // debounce PATCH por nota (cuando se edita texto)
  const patchTimersRef = useRef<Record<string, number | undefined>>({})
  const pendingPatchRef = useRef<Record<string, NotePatch | undefined>>({})

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }, [notes])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const items = await laboralNotesList()
        if (!alive) return
        setNotes(items)
      } catch (e) {
        if (!alive) return
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: String((e as Error)?.message || 'No se pudieron cargar las notas'),
        })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const addNote = useCallback(async () => {
    const text = clampText(draft).trim()
    if (!text) return

    setBusy(true)
    try {
      const created = await laboralNoteCreate({ text, color: draftColor })
      setNotes((prev) => [created, ...prev])
      setDraft('')
      setDraftColor('mint')
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: String((e as Error)?.message || 'No se pudo guardar la nota'),
      })
    } finally {
      setBusy(false)
    }
  }, [draft, draftColor])

  const flushPatch = useCallback(async (id: string) => {
    const pending = pendingPatchRef.current[id]
    if (!pending) return

    pendingPatchRef.current[id] = undefined

    try {
      const updated = await laboralNoteUpdate(id, pending)
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: String((e as Error)?.message || 'No se pudo actualizar la nota'),
      })
    }
  }, [])

  const schedulePatch = useCallback(
    (id: string, patch: NotePatch, delayMs: number) => {
      const prevPending = pendingPatchRef.current[id] || {}
      pendingPatchRef.current[id] = { ...prevPending, ...patch }

      const prevTimer = patchTimersRef.current[id]
      if (prevTimer !== undefined) window.clearTimeout(prevTimer)

      const t = window.setTimeout(() => {
        patchTimersRef.current[id] = undefined
        void flushPatch(id)
      }, delayMs)

      patchTimersRef.current[id] = t
    },
    [flushPatch],
  )

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'text' | 'color'>>, mode?: 'immediate') => {
      const nowIso = new Date().toISOString()

      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                ...patch,
                text: patch.text !== undefined ? clampText(patch.text) : n.text,
                updatedAt: nowIso,
              }
            : n,
        ),
      )

      const apiPatch: NotePatch = {
        ...(patch.text !== undefined ? { text: clampText(patch.text) } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
      }

      if (mode === 'immediate') {
        const prevPending = pendingPatchRef.current[id] || {}
        pendingPatchRef.current[id] = { ...prevPending, ...apiPatch }

        const prevTimer = patchTimersRef.current[id]
        if (prevTimer !== undefined) window.clearTimeout(prevTimer)
        patchTimersRef.current[id] = undefined

        void flushPatch(id)
        return
      }

      // por defecto: debounce (para tipeo)
      schedulePatch(id, apiPatch, 550)
    },
    [flushPatch, schedulePatch],
  )

  const removeNote = useCallback(async (id: string) => {
    const res = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar nota?',
      text: 'Esto no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      confirmButtonColor: '#e11d48',
      customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
    })

    if (!res.isConfirmed) return

    try {
      await laboralNoteDelete(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: String((e as Error)?.message || 'No se pudo eliminar la nota'),
      })
    }
  }, [])

  const onDraftKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void addNote()
    },
    [addNote],
  )

  return (
    <section className="notes">
      <div className="notes__header">
        <div>
          <h3 className="notes__title">Notas</h3>
          <p className="notes__subtitle">Notas compartidas entre usuarios.</p>
        </div>
      </div>

      <div className="notes__composer">
        <div className="notes__colors" aria-label="Colores">
          {COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={'notes__color' + (draftColor === c.key ? ' notes__color--active' : '')}
              onClick={() => setDraftColor(c.key)}
              title={c.label}
              disabled={busy}
            >
              <span className={'notes__dot notes__dot--' + c.key} />
            </button>
          ))}
        </div>

        <textarea
          className="notes__input"
          placeholder="Escribí una nota…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
          disabled={busy}
        />

        <div className="notes__composer-actions">
          <button className="btn btn--primary" type="button" onClick={() => void addNote()} disabled={busy || !draft.trim()}>
            {busy ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      </div>

      <div className="notes__list">
        {loading ? (
          <div className="notes__empty">Cargando notas…</div>
        ) : sorted.length === 0 ? (
          <div className="notes__empty">Todavía no hay notas.</div>
        ) : (
          sorted.map((n) => <NoteCard key={n.id} note={n} onUpdate={updateNote} onRemove={removeNote} />)
        )}
      </div>
    </section>
  )
}

function NoteCard({
  note,
  onUpdate,
  onRemove,
}: {
  note: Note
  onUpdate: (id: string, patch: Partial<Pick<Note, 'text' | 'color'>>, mode?: 'immediate') => void
  onRemove: (id: string) => void
}) {
  const [openColors, setOpenColors] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!openColors) return
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpenColors(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openColors])

  return (
    <article className={'note note--' + note.color}>
      <div className="note__top">
        <div className="note__meta">
          <span className="note__date">Actualizada: {new Date(note.updatedAt).toLocaleString()}</span>
        </div>

        <div className="note__tools" ref={ref}>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setOpenColors((p) => !p)}>
            Color
          </button>

          {openColors && (
            <div className="note__palette" role="menu">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="note__palette-item"
                  onClick={() => {
                    onUpdate(note.id, { color: c.key }, 'immediate')
                    setOpenColors(false)
                  }}
                >
                  <span className={'notes__dot notes__dot--' + c.key} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          )}

          <button className="btn btn--ghost btn--sm" type="button" onClick={() => onRemove(note.id)}>
            Eliminar
          </button>
        </div>
      </div>

      <textarea className="note__text" value={note.text} onChange={(e) => onUpdate(note.id, { text: e.target.value })} />
    </article>
  )
}

export default NotesBoard
