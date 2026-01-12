// src/components/ui/home/TurnosLaboralAgendaMini.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'
import penPng from '@/assets/icons/pen.png'
import {
  laboralTurnoUpdate,
  laboralTurnosList,
  laboralTurnoDelete,
  type LaborTurno,
  type SedeKey,
} from '@/api/laboralTurnosApi'

type TurnosLaboralAgendaMiniProps = {
  /** Si viene, la agenda queda controlada por Home */
  sede?: SedeKey
}

const FIXED_TURNO_HORA = '08:00'
const AR_TZ = 'America/Argentina/Buenos_Aires'
const STORAGE_KEY_SEDE = 'medic_laboral_sede_v1'

function isoDay(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dayPart(iso: string) {
  return (iso || '').slice(0, 10)
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(base: Date, delta: number) {
  const d = new Date(base)
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  return d
}

function monthLabelES(d: Date) {
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  return `${meses[d.getMonth()]} de ${d.getFullYear()}`
}

function buildMonthMatrix(anchor: Date) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  const firstDow = (first.getDay() + 6) % 7
  const daysInMonth = last.getDate()

  const cells: Array<{ day: number; iso: string; inMonth: boolean }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: 0, iso: '', inMonth: false })

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month, day)
    cells.push({ day, iso: isoDay(dt), inMonth: true })
  }

  while (cells.length % 7 !== 0) cells.push({ day: 0, iso: '', inMonth: false })

  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return weeks
}

function normalizeText(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/** ✅ Formatea YYYY-MM-DD como fecha de Buenos Aires (dd/mm/aaaa) */
function formatDayAR(isoYYYYMMDD: string) {
  const iso = dayPart(isoYYYYMMDD)
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso

  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dt)
}

function readPersistedSede(): SedeKey {
  try {
    const v = String(localStorage.getItem(STORAGE_KEY_SEDE) || '').trim()
    if (v === 'caba' || v === 'sanjusto') return v
  } catch {
    /* noop */
  }
  return 'caba'
}

function sedeLabel(s: SedeKey) {
  return s === 'caba' ? 'CABA' : 'San Justo'
}

function buildPdfTurnosMes(turnos: LaborTurno[], monthTitle: string, sede: SedeKey) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const groups = new Map<string, LaborTurno[]>()
  for (const t of turnos) {
    const key = (t.empresa || 'Sin empresa').trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  const empresas = Array.from(groups.keys()).sort((a, b) =>
    normalizeText(a).localeCompare(normalizeText(b)),
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`Medic Laboral - Turnos laborales ${sedeLabel(sede)}`, margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(monthTitle, margin, 22)

  const printed = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ }).format(new Date())
  doc.text(printed, pageW - margin, 16, { align: 'right' })

  let y = 30

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageH - margin) return
    doc.addPage()
    y = margin
  }

  for (const emp of empresas) {
    const list = (groups.get(emp) || []).slice().sort((a, b) => {
      const by = dayPart(a.fechaTurnoISO || '').localeCompare(dayPart(b.fechaTurnoISO || ''))
      if (by !== 0) return by
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })

    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(`${emp} (${list.length})`, margin, y)
    y += 6

    ensureSpace(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text('#', margin, y)
    doc.text('Fecha', margin + 10, y)
    doc.text('Hora', margin + 34, y)
    doc.text('DNI', margin + 50, y)
    doc.text('Nombre', margin + 74, y)
    doc.text('Puesto', margin + 130, y)
    doc.text('Examen', margin + 158, y)
    y += 4
    doc.setDrawColor(210)
    doc.line(margin, y, pageW - margin, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.2)

    let idx = 1
    for (const t of list) {
      ensureSpace(7)

      const fecha = formatDayAR(t.fechaTurnoISO || '-') || '-'
      const hora = FIXED_TURNO_HORA
      const dni = (t.dni || '-').slice(0, 14)
      const nombre = (t.nombre || '-').slice(0, 28)
      const puesto = (t.puesto || '-').slice(0, 18)
      const examen = (t.tipoExamen || '-').slice(0, 20)

      doc.text(String(idx), margin, y)
      doc.text(fecha, margin + 10, y)
      doc.text(hora, margin + 34, y)
      doc.text(dni, margin + 50, y)
      doc.text(nombre, margin + 74, y)
      doc.text(puesto, margin + 130, y)
      doc.text(examen, margin + 158, y)
      y += 6
      idx++
    }

    y += 4
  }

  return doc
}

export function TurnosLaboralAgendaMini(props: TurnosLaboralAgendaMiniProps) {
  // ✅ estado local SOLO si no viene sede por props
  const [localSede, setLocalSede] = useState<SedeKey>(() => readPersistedSede())
  const sede: SedeKey = props.sede ?? localSede
  const isControlled = props.sede !== undefined

  const [turnos, setTurnos] = useState<LaborTurno[]>([])
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedISO, setSelectedISO] = useState<string>(() => isoDay(new Date()))

  const openDayScheduleRef = useRef<(dayISO: string, cm?: boolean) => void>(() => {})

  // ✅ escuchar eventos/storage SOLO cuando es uncontrolled
  useEffect(() => {
    if (isControlled) return

    const onEvt = (ev: Event) => {
      const ce = ev as CustomEvent
      const next = String(ce.detail || '').trim()
      if (next === 'caba' || next === 'sanjusto') setLocalSede(next)
    }
    window.addEventListener('medic:laboral-sede', onEvt as EventListener)

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY_SEDE) return
      const v = String(e.newValue || '').trim()
      if (v === 'caba' || v === 'sanjusto') setLocalSede(v)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('medic:laboral-sede', onEvt as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [isControlled])

  const loadMonth = useCallback(async () => {
    const mk = monthKey(anchor)
    try {
      const list = await laboralTurnosList({ month: mk, sede })
      setTurnos(list)
      return list
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los turnos del mes'
      console.error(e)
      Swal.fire({ icon: 'error', title: 'Error', text: msg })
      return []
    }
  }, [anchor, sede])

  useEffect(() => {
    const t = window.setTimeout(() => void loadMonth(), 0)
    return () => window.clearTimeout(t)
  }, [loadMonth])

  const countByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of turnos) {
      if (t.sede !== sede) continue
      const d = dayPart(t.fechaTurnoISO || '')
      if (!d) continue
      m.set(d, (m.get(d) || 0) + 1)
    }
    return m
  }, [turnos, sede])

  const weeks = useMemo(() => buildMonthMatrix(anchor), [anchor])
  const monthTitle = useMemo(() => monthLabelES(anchor), [anchor])
  const agendaTitle = useMemo(() => `Turnos laborales ${sedeLabel(sede)}`, [sede])

  function goToday() {
    const d = new Date()
    const a = new Date(d.getFullYear(), d.getMonth(), 1)
    setAnchor(a)
    setSelectedISO(isoDay(d))
  }

  function downloadPdfMes() {
    const list = turnos.filter((t) => t.sede === sede)
    if (!list.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin turnos',
        text: 'Este mes no tiene turnos laborales cargados para esta sede.',
        timer: 1800,
        showConfirmButton: false,
      })
      return
    }
    const doc = buildPdfTurnosMes(list, monthTitle, sede)
    doc.save(`TurnosLaborales_${sedeLabel(sede)}_${monthKey(anchor)}.pdf`)
  }

  const openDaySchedule = useCallback(
    async (dayISO: string, cm?: boolean) => {
      const cancelMode = Boolean(cm)

      const dayTurns = turnos
        .filter((t) => t.sede === sede)
        .filter((t) => dayPart(t.fechaTurnoISO || '') === dayISO)
        .slice()
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

      const total = dayTurns.length
      const dayLabelAR = formatDayAR(dayISO) || dayISO

      const rowsHtml = dayTurns
        .map((t, idx) => {
          const editBtn = `
            <button class="qedit" data-id="${escapeHtml(t.id)}" title="Editar turno">
              <img src="${String(penPng)}" alt="Editar" />
            </button>
          `
          const delBtn = cancelMode
            ? `<button class="qdel" data-id="${escapeHtml(t.id)}" title="Eliminar turno">✕</button>`
            : ''

          return `
            <div class="queue">
              <div class="queue__pos">#${idx + 1}</div>
              <div class="queue__main">
                <div class="queue__title"><b>${escapeHtml(t.empresa || 'Sin empresa')}</b></div>
                <div class="queue__muted">${escapeHtml(t.nombre || '-')} · DNI ${escapeHtml(t.dni || '-')} · ${escapeHtml(
                  sedeLabel(t.sede),
                )}</div>
                <div class="queue__muted">${escapeHtml(t.tipoExamen || '-')} · Hora ${escapeHtml(FIXED_TURNO_HORA)}</div>
              </div>

              <div class="queue__actions">
                ${editBtn}
                ${delBtn}
              </div>
            </div>
          `
        })
        .join('')

      const html = `
        <style>
          .meta { display:flex; gap:10px; flex-wrap:wrap; margin:6px 0 12px; color:#64748b; font-size:.92rem; align-items:center; }
          .meta b { color:#0f172a; }
          .meta__sp { flex:1; }
          .wrap { max-height: 62vh; overflow:auto; padding-right:6px; display:flex; flex-direction:column; gap:10px; }
          .wrap::-webkit-scrollbar { width: 10px; }
          .wrap::-webkit-scrollbar-thumb { background: rgba(148,163,184,.35); border-radius: 999px; border: 2px solid rgba(255,255,255,.6); }

          .queue { border:1px solid rgba(148,163,184,.35); border-radius:14px; background:rgba(255,255,255,.92); padding:10px 12px; display:flex; gap:12px; align-items:flex-start; position:relative; }
          .queue__pos { width:54px; min-width:54px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-weight:900; background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe; }
          .queue__title { color:#0f172a; font-size:.98rem; }
          .queue__muted { color:#64748b; font-size:.88rem; margin-top:2px; line-height:1.2; }

          .queue__actions { margin-left:auto; display:flex; gap:8px; }

          .cmode { display:inline-flex; align-items:center; gap:8px; padding:7px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.4); background:#fff; cursor:pointer; font-size:.9rem; }
          .cmode--on { border-color: rgba(239,68,68,.45); background: rgba(254,226,226,.7); color:#991b1b; font-weight:700; }

          .qedit { width:34px; height:34px; border-radius:10px; border:1px solid rgba(59,130,246,.28); background: rgba(219,234,254,.85); cursor:pointer; display:flex; align-items:center; justify-content:center; }
          .qedit img { width:16px; height:16px; display:block; }
          .qedit:hover { filter: brightness(.98); }

          .qdel { width:34px; height:34px; border-radius:10px; border:1px solid rgba(239,68,68,.35); background: rgba(254,226,226,.9); color:#b91c1c; cursor:pointer; font-weight:900; display:flex; align-items:center; justify-content:center; }
          .qdel:hover { filter: brightness(0.98); }
        </style>

        <div class="meta">
          <div><b>${escapeHtml(dayLabelAR)}</b></div>
          <div>· Sede: <b>${escapeHtml(sedeLabel(sede))}</b></div>
          <div>· Turnos: <b>${total}</b></div>
          <div>· Hora fija: <b>${escapeHtml(FIXED_TURNO_HORA)}</b></div>
          <div>· Orden: <b>de llamado</b></div>
          <div class="meta__sp"></div>
          <button id="toggleCancel" class="cmode ${cancelMode ? 'cmode--on' : ''}">
            ${cancelMode ? 'Salir de cancelar' : 'Modo cancelar'}
          </button>
        </div>

        <div class="wrap" id="wrapList">
          ${rowsHtml || '<div style="color:#64748b">Sin turnos para este día.</div>'}
        </div>
      `

      await Swal.fire({
        title: 'Turnos del día (orden de llamado)',
        html,
        width: 920,
        showConfirmButton: false,
        showCloseButton: true,
        focusConfirm: false,
        customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
        didOpen: () => {
          const toggle = document.getElementById('toggleCancel')
          toggle?.addEventListener('click', () => {
            const next = !cancelMode
            openDayScheduleRef.current(dayISO, next)
          })

          const wrap = document.getElementById('wrapList')
          wrap?.addEventListener('click', async (ev) => {
            const el = ev.target as HTMLElement | null

            const editBtn = el?.closest?.('.qedit') as HTMLElement | null
            if (editBtn) {
              const id = editBtn.getAttribute('data-id') || ''
              if (!id) return

              const t = dayTurns.find((x) => x.id === id)
              if (!t) return

              const r = await Swal.fire({
                title: 'Editar turno',
                html: `
                  <div style="display:grid; gap:10px; text-align:left;">
                    <input id="edit_nombre" class="swal2-input" value="${escapeHtml(t.nombre || '')}" placeholder="Nombre y apellido" />
                    <input id="edit_dni" class="swal2-input" value="${escapeHtml(t.dni || '')}" placeholder="DNI" />
                    <input id="edit_puesto" class="swal2-input" value="${escapeHtml(t.puesto || '')}" placeholder="Puesto" />
                    <textarea id="edit_examen" class="swal2-textarea" placeholder="Tipo de examen">${escapeHtml(t.tipoExamen || '')}</textarea>
                    <div style="color:#64748b; font-size:.9rem;">Hora fija: <b>${escapeHtml(FIXED_TURNO_HORA)}</b> · Sede: <b>${escapeHtml(
                      sedeLabel(sede),
                    )}</b></div>
                  </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Guardar',
                cancelButtonText: 'Cancelar',
                focusConfirm: false,
              })

              if (!r.isConfirmed) return

              const nombre = (document.getElementById('edit_nombre') as HTMLInputElement | null)?.value ?? ''
              const dni = (document.getElementById('edit_dni') as HTMLInputElement | null)?.value ?? ''
              const puesto = (document.getElementById('edit_puesto') as HTMLInputElement | null)?.value ?? ''
              const tipoExamen = (document.getElementById('edit_examen') as HTMLTextAreaElement | null)?.value ?? ''

              try {
                await laboralTurnoUpdate(id, {
                  nombre: nombre.trim(),
                  dni: dni.trim(),
                  puesto: puesto.trim(),
                  tipoExamen: tipoExamen.trim(),
                })

                await loadMonth()
                await Swal.fire({ icon: 'success', title: 'Turno actualizado', timer: 1100, showConfirmButton: false })

                window.setTimeout(() => {
                  openDayScheduleRef.current(dayISO, cancelMode)
                }, 0)
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'No se pudo actualizar'
                Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: msg })
              }

              return
            }

            const delBtn = el?.closest?.('.qdel') as HTMLElement | null
            if (!delBtn) return

            const id = delBtn.getAttribute('data-id') || ''
            if (!id) return

            const r = await Swal.fire({
              icon: 'warning',
              title: '¿Eliminar turno?',
              text: 'Se va a borrar el turno de forma permanente.',
              showCancelButton: true,
              confirmButtonText: 'Sí, eliminar',
              cancelButtonText: 'Cancelar',
            })
            if (!r.isConfirmed) return

            try {
              await laboralTurnoDelete(id)
              await loadMonth()
              await Swal.fire({ icon: 'success', title: 'Turno eliminado', timer: 1100, showConfirmButton: false })

              window.setTimeout(() => {
                openDayScheduleRef.current(dayISO, true)
              }, 0)
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'No se pudo eliminar'
              Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: msg })
            }
          })
        },
      })
    },
    [loadMonth, sede, turnos],
  )

  useEffect(() => {
    openDayScheduleRef.current = (dayISO: string, cm?: boolean) => {
      void openDaySchedule(dayISO, cm)
    }
  }, [openDaySchedule])

  return (
    <section className="lab-agenda">
      <header className="lab-agenda__head">
        <div>
          <h3 className="lab-agenda__title">{agendaTitle}</h3>
          <div className="lab-agenda__sub">{monthTitle}</div>
        </div>

        <div className="lab-agenda__actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setAnchor(addMonths(anchor, -1))}>
            ‹
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={goToday}>
            Hoy
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setAnchor(addMonths(anchor, +1))}>
            ›
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={downloadPdfMes}>
            Descargar PDF
          </button>
        </div>
      </header>

      <div className="lab-agenda__cal">
        <div className="lab-agenda__dow">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => (
            <div key={i} className="lab-agenda__dowCell">
              {x}
            </div>
          ))}
        </div>

        <div className="lab-agenda__grid">
          {weeks.flat().map((cell, idx) => {
            const iso = cell.inMonth ? cell.iso : ''
            const cnt = iso ? countByDay.get(iso) || 0 : 0
            const selected = cell.inMonth && iso === selectedISO

            return (
              <button
                key={idx}
                type="button"
                className={
                  'lab-agenda__day' +
                  (cell.inMonth ? '' : ' lab-agenda__day--off') +
                  (selected ? ' lab-agenda__day--sel' : '')
                }
                onClick={() => {
                  if (!cell.inMonth) return
                  setSelectedISO(cell.iso)
                  void openDaySchedule(cell.iso, false)
                }}
                disabled={!cell.inMonth}
              >
                <div className="lab-agenda__num">{cell.inMonth ? cell.day : ''}</div>
                {cnt > 0 && <div className="lab-agenda__badge">{cnt}</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="lab-agenda__hint" style={{ marginTop: 10, color: 'var(--color-ink-soft)', fontSize: '.9rem' }}>
        Tip: hacé click en un día para ver el listado por orden de llamado.
      </div>
    </section>
  )
}

export default TurnosLaboralAgendaMini
