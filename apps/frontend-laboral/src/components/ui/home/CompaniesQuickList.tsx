import React, { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'

import AddCompanyModal, { type CompanyDraft as ModalDraft } from './AddCompanyModal'

import bajaIcon from '@/assets/icons/afiliado-baja.png'
import altaIcon from '@/assets/icons/agregar-usuario.png'
import trashIcon from '@/assets/icons/trash-gradient.png'
import editIcon from '@/assets/icons/pen.png'

import {
  type Company,
  type CompanyDraft,
  type CompanyPadronPerson,
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getCompanyPadron,
} from '@/api/companiesApi'

type FilterMode = 'actives' | 'inactive' | 'all'

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Activas primero, luego Baja; dentro de cada grupo, alfabético */
function sortCompanies(a: Company, b: Company) {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1

  const aa = normalizeText(a.nombre)
  const bb = normalizeText(b.nombre)
  if (aa < bb) return -1
  if (aa > bb) return 1

  return a.createdAt < b.createdAt ? -1 : 1
}

function buildCompanyPdf(c: Company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 18
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Medic Laboral - Empresa / Socio', margin, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(new Date().toLocaleDateString(), pageW - margin, 18, { align: 'right' })

  doc.setDrawColor(200)
  doc.line(margin, 24, pageW - margin, 24)

  const rows: Array<[string, string]> = [
    ['Empresa', c.nombre],
    ['Estado', c.isActive ? 'Activa' : 'Baja'],
    ['N° Socio', c.nroSocio ?? ''],
    ['CUIT', c.cuit ?? ''],
    ['Contacto', c.contacto ?? ''],
    ['Teléfono', c.telefono ?? ''],
    ['Email', c.email ?? ''],
    ['Domicilio', c.domicilio ?? ''],
    ['Notas', c.notas ?? ''],
  ]

  let y = 36
  doc.setFontSize(11)

  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${k}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text((v || '—').toString().slice(0, 120) || '—', margin + 34, y)
    y += 10
  })

  return doc
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[]
  let i = 0
  const n = Math.max(1, Math.floor(limit))

  const runners = new Array(Math.min(n, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await worker(items[idx])
    }
  })

  await Promise.all(runners)
  return results
}

export function CompaniesQuickList() {
  const [items, setItems] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterMode>('actives')

  // modal padrón
  const [padronOpen, setPadronOpen] = useState(false)
  const [padronCompanyId, setPadronCompanyId] = useState<string | null>(null)
  const [padronLoading, setPadronLoading] = useState(false)
  const [padronPeople, setPadronPeople] = useState<CompanyPadronPerson[]>([])

  // cache de conteos por empresa (para el numerito al lado del nombre)
  const [countsByCompanyId, setCountsByCompanyId] = useState<Map<string, number>>(() => new Map())
  const countsRef = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    countsRef.current = countsByCompanyId
  }, [countsByCompanyId])

  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  async function refreshCompanies(next?: { q?: string; filter?: FilterMode }) {
    const qq = next?.q ?? q
    const ff = next?.filter ?? filter
    const r = await listCompanies({ q: qq, filter: ff })
    const sorted = r.items.slice().sort(sortCompanies)
    setItems(sorted)
    void prefetchCounts(sorted)
  }

  async function prefetchCounts(companies: Company[]) {
    const missingIds = companies
      .map((c) => c.id)
      .filter((id) => !countsRef.current.has(id))

    if (missingIds.length === 0) return

    try {
      await runWithConcurrency(
        missingIds,
        4,
        async (companyId) => {
          try {
            const r = await getCompanyPadron(companyId)
            const len = (r.items || []).length

            if (!aliveRef.current) return null

            setCountsByCompanyId((prev) => {
              const next = new Map(prev)
              next.set(companyId, len)
              return next
            })

            return len
          } catch {
            if (!aliveRef.current) return null
            setCountsByCompanyId((prev) => {
              const next = new Map(prev)
              next.set(companyId, 0)
              return next
            })
            return 0
          }
        },
      )
    } catch {
      // no rompemos UI
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await refreshCompanies({ q, filter })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // cuando cambia filtro, recarga
  useEffect(() => {
    if (loading) return
    refreshCompanies({ q, filter }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // ESC cierra modal padrón
  useEffect(() => {
    if (!padronOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPadronOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [padronOpen])

  const counts = useMemo(() => {
    let active = 0
    let inactive = 0

    for (const c of items) {
      if (c.isActive) active++
      else inactive++
    }

    return { active, inactive, total: items.length }
  }, [items])

  const emptyLabel = useMemo(() => {
    if (q.trim()) return 'No hay resultados para tu búsqueda.'
    if (filter === 'actives') return 'No hay empresas activas.'
    if (filter === 'inactive') return 'No hay empresas dadas de baja.'
    return 'No hay empresas cargadas.'
  }, [q, filter])

  const filtered = useMemo(() => {
    const qq = normalizeText(q)
    let base = items
    if (filter === 'actives') base = items.filter((c) => c.isActive)
    if (filter === 'inactive') base = items.filter((c) => !c.isActive)

    if (!qq) return base

    return base.filter((c) => {
      const hay =
        normalizeText(c.nombre) +
        ' ' +
        normalizeText(c.cuit ?? '') +
        ' ' +
        normalizeText(c.nroSocio ?? '') +
        ' ' +
        normalizeText(c.contacto ?? '') +
        ' ' +
        normalizeText(c.domicilio ?? '') +
        ' ' +
        normalizeText(c.telefono ?? '') +
        ' ' +
        normalizeText(c.email ?? '')
      return hay.includes(qq)
    })
  }, [items, q, filter])

  // cuando cambia la lista filtrada (items), precarga conteos faltantes
  useEffect(() => {
    if (loading) return
    void prefetchCounts(filtered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, loading])

  const padronCompany = useMemo(() => {
    if (!padronCompanyId) return null
    return items.find((x) => x.id === padronCompanyId) || null
  }, [items, padronCompanyId])

  async function openPadronModal(companyId: string) {
    setPadronCompanyId(companyId)
    setPadronOpen(true)
    setPadronPeople([])
    setPadronLoading(true)

    try {
      const r = await getCompanyPadron(companyId)
      const people = (r.items || []).slice()
      people.sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)))
      setPadronPeople(people)

      setCountsByCompanyId((prev) => {
        const next = new Map(prev)
        next.set(companyId, people.length)
        return next
      })
    } catch (e) {
      Swal.fire({ title: 'Error', text: String((e as Error)?.message || 'Error'), icon: 'error' })
    } finally {
      setPadronLoading(false)
    }
  }

  async function addCompany(d: ModalDraft) {
    const payload: CompanyDraft = {
      nombre: d.nombre.trim(),
      nroSocio: d.nroSocio.trim(),
      cuit: d.cuit.trim(),
      contacto: d.contacto.trim(),
      telefono: d.telefono.trim(),
      email: d.email.trim(),
      domicilio: d.domicilio.trim(),
      notas: d.notas.trim(),
    }

    const r = await createCompany(payload)
    setItems((prev) => [r.item, ...prev].sort(sortCompanies))
    setFilter('actives')

    // precarga count nuevo (0)
    setCountsByCompanyId((prev) => {
      const next = new Map(prev)
      next.set(r.item.id, 0)
      return next
    })
  }

  async function setCompanyActive(c: Company, nextActive: boolean) {
    const r = await updateCompany(c.id, { isActive: nextActive })
    setItems((prev) => prev.map((x) => (x.id === c.id ? r.item : x)).sort(sortCompanies))
  }

  async function hardDeleteCompany(c: Company) {
    await deleteCompany(c.id)
    setItems((prev) => prev.filter((x) => x.id !== c.id).sort(sortCompanies))

    setCountsByCompanyId((prev) => {
      const next = new Map(prev)
      next.delete(c.id)
      return next
    })

    if (padronCompanyId === c.id) {
      setPadronOpen(false)
      setPadronCompanyId(null)
      setPadronPeople([])
    }
  }

  function askToggleBaja(c: Company) {
    const nextActive = !c.isActive

    Swal.fire({
      title: nextActive ? '¿Dar de alta la empresa?' : '¿Dar de baja la empresa?',
      html: `
        <div style="text-align:left">
          <div style="font-weight:700;margin-bottom:6px;">${(c.nombre || 'Empresa').toString()}</div>
          <div style="color:#6b7280;font-size:0.95rem;">
            ${nextActive ? 'La empresa volverá a estar activa.' : 'La empresa quedará marcada como “Baja”.'}
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: nextActive ? 'Sí, dar de alta' : 'Sí, dar de baja',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
    }).then(async (res) => {
      if (!res.isConfirmed) return
      try {
        await setCompanyActive(c, nextActive)
        Swal.fire({
          title: nextActive ? 'Empresa activada' : 'Empresa dada de baja',
          text: nextActive ? 'La empresa volvió a estar activa.' : 'La empresa fue marcada como inactiva.',
          icon: 'success',
          timer: 1400,
          showConfirmButton: false,
          customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
        })
      } catch (e) {
        Swal.fire({ title: 'Error', text: String((e as Error)?.message || 'Error'), icon: 'error' })
      }
    })
  }

  function askHardDelete(c: Company) {
    Swal.fire({
      title: '¿Eliminar definitivamente?',
      html: `
        <div style="text-align:left">
          <div style="font-weight:700;margin-bottom:6px;">${(c.nombre || 'Empresa').toString()}</div>
          <div style="color:#6b7280;font-size:0.95rem;">
            Esto la elimina del sistema. No se puede deshacer.
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e11d48',
      reverseButtons: true,
      customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
    }).then(async (res) => {
      if (!res.isConfirmed) return
      try {
        await hardDeleteCompany(c)
        Swal.fire({
          title: 'Eliminada',
          text: 'La empresa fue eliminada.',
          icon: 'success',
          timer: 1300,
          showConfirmButton: false,
          customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
        })
      } catch (e) {
        Swal.fire({ title: 'Error', text: String((e as Error)?.message || 'Error'), icon: 'error' })
      }
    })
  }

  async function askEditCompany(c: Company) {
    const safe = (v?: string | null) => (v ?? '').toString()

    const { value: form } = await Swal.fire({
      title: 'Editar empresa',
       width: "100vw",
      html: `
        <div style="display:grid;gap:10px;text-align:left;width:100%">
          <label style="display:grid;gap:6px">
            <span style="font-size:12px;color:#64748b">Empresa</span>
            <input id="sw_nombre" class="swal2-input" style="margin:0" value="${safe(c.nombre).replace(/"/g, '&quot;')}" />
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:grid;gap:6px">
              <span style="font-size:12px;color:#64748b">N° Socio</span>
              <input id="sw_nroSocio" class="swal2-input" style="margin:0" value="${safe(c.nroSocio).replace(/"/g, '&quot;')}" />
            </label>
            <label style="display:grid;gap:6px">
              <span style="font-size:12px;color:#64748b">CUIT</span>
              <input id="sw_cuit" class="swal2-input" style="margin:0" value="${safe(c.cuit).replace(/"/g, '&quot;')}" />
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:grid;gap:6px">
              <span style="font-size:12px;color:#64748b">Contacto</span>
              <input id="sw_contacto" class="swal2-input" style="margin:0" value="${safe(c.contacto).replace(/"/g, '&quot;')}" />
            </label>
            <label style="display:grid;gap:6px">
              <span style="font-size:12px;color:#64748b">Teléfono</span>
              <input id="sw_telefono" class="swal2-input" style="margin:0" value="${safe(c.telefono).replace(/"/g, '&quot;')}" />
            </label>
          </div>

          <label style="display:grid;gap:6px">
            <span style="font-size:12px;color:#64748b">Email</span>
            <input id="sw_email" class="swal2-input" style="margin:0" value="${safe(c.email).replace(/"/g, '&quot;')}" />
          </label>

          <label style="display:grid;gap:6px">
            <span style="font-size:12px;color:#64748b">Domicilio</span>
            <input id="sw_domicilio" class="swal2-input" style="margin:0" value="${safe(c.domicilio).replace(/"/g, '&quot;')}" />
          </label>

          <label style="display:grid;gap:6px">
            <span style="font-size:12px;color:#64748b">Notas</span>
            <textarea id="sw_notas" class="swal2-textarea" style="margin:0;min-height:90px">${safe(c.notas)}</textarea>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusConfirm: false,
      preConfirm: () => {
        const nombre = (document.getElementById('sw_nombre') as HTMLInputElement | null)?.value ?? ''
        const nroSocio = (document.getElementById('sw_nroSocio') as HTMLInputElement | null)?.value ?? ''
        const cuit = (document.getElementById('sw_cuit') as HTMLInputElement | null)?.value ?? ''
        const contacto = (document.getElementById('sw_contacto') as HTMLInputElement | null)?.value ?? ''
        const telefono = (document.getElementById('sw_telefono') as HTMLInputElement | null)?.value ?? ''
        const email = (document.getElementById('sw_email') as HTMLInputElement | null)?.value ?? ''
        const domicilio = (document.getElementById('sw_domicilio') as HTMLInputElement | null)?.value ?? ''
        const notas = (document.getElementById('sw_notas') as HTMLTextAreaElement | null)?.value ?? ''

        if (!nombre.trim()) {
          Swal.showValidationMessage('El nombre de la empresa es obligatorio.')
          return null
        }

        return {
          nombre: nombre.trim(),
          nroSocio: nroSocio.trim(),
          cuit: cuit.trim(),
          contacto: contacto.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          domicilio: domicilio.trim(),
          notas: notas.trim(),
        } as CompanyDraft
      },
      customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
    })

    if (!form) return

    try {
      const r = await updateCompany(c.id, form)
      setItems((prev) => prev.map((x) => (x.id === c.id ? r.item : x)).sort(sortCompanies))
      await Swal.fire({
        title: 'Listo',
        text: 'Se guardaron los cambios.',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
        customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
      })
    } catch (e) {
      Swal.fire({ title: 'Error', text: String((e as Error)?.message || 'Error'), icon: 'error' })
    }
  }

  function downloadCompanyPdf(c: Company) {
    const doc = buildCompanyPdf(c)
    const safeName =
      (c.nombre || 'empresa')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w-]/g, '')
        .slice(0, 40) || 'empresa'
    doc.save(`Empresa_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <section className="companies">
      <div className="companies__head">
        <div>
          <h3 className="companies__title">Cartilla de socios / empresas</h3>
          <p className="companies__subtitle">Buscá y gestioná empresas rápidamente.</p>
        </div>

        <button className="btn btn--primary" type="button" onClick={() => setOpen(true)}>
          + Agregar empresa
        </button>
      </div>

      <div className="companies__tools">
        <div className="companies__search">
          <input
            className="input"
            placeholder="Buscar por empresa, CUIT, N° socio, contacto o domicilio…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                refreshCompanies({ q, filter }).catch(() => {})
              }
            }}
          />
        </div>

        <div className="companies__filters">
          <button
            type="button"
            className={'filter-chip' + (filter === 'actives' ? ' filter-chip--active' : '')}
            onClick={() => setFilter('actives')}
          >
            Activas <span className="filter-chip__count">{counts.active}</span>
          </button>

          <button
            type="button"
            className={'filter-chip' + (filter === 'inactive' ? ' filter-chip--active' : '')}
            onClick={() => setFilter('inactive')}
          >
            Baja <span className="filter-chip__count">{counts.inactive}</span>
          </button>

          <button
            type="button"
            className={'filter-chip' + (filter === 'all' ? ' filter-chip--active' : '')}
            onClick={() => setFilter('all')}
          >
            Todas <span className="filter-chip__count">{counts.total}</span>
          </button>
        </div>
      </div>

      <div className="companies__listWrap">
        <div className="companies__list">
          {loading ? (
            <div className="companies__empty">Cargando empresas…</div>
          ) : filtered.length === 0 ? (
            <div className="companies__empty">{emptyLabel}</div>
          ) : (
            filtered.map((c) => {
              const hasCount = countsByCompanyId.has(c.id)
              const peopleCount = countsByCompanyId.get(c.id) ?? 0

              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className={'company' + (!c.isActive ? ' company--inactive' : '')}
                  onClick={() => openPadronModal(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openPadronModal(c.id)
                  }}
                >
                  <div className="company__main">
                    <div className="company__top">
                      <div className="company__name">
                        {c.nombre}{' '}
                        <span className="company__count">({hasCount ? peopleCount : '…'})</span>
                      </div>
                      {!c.isActive && <span className="chip chip--danger">Baja</span>}
                    </div>

                    <div className="company__meta">
                      <span className="chip">Socio: {c.nroSocio || '-'}</span>
                      <span className="chip">CUIT: {c.cuit || '-'}</span>
                      <span className="chip">Contacto: {c.contacto || '-'}</span>
                    </div>
                  </div>

                  <div className="company__side">
                    <div className="company__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Modificar datos"
                        onClick={() => askEditCompany(c)}
                      >
                        <img className="icon-btn__img" src={editIcon} alt="Editar" />
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        title={c.isActive ? 'Dar de baja' : 'Dar de alta'}
                        onClick={() => askToggleBaja(c)}
                      >
                        <img className="icon-btn__img" src={c.isActive ? bajaIcon : altaIcon} alt="Toggle" />
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        title="Eliminar definitivamente"
                        onClick={() => askHardDelete(c)}
                      >
                        <img className="icon-btn__img" src={trashIcon} alt="Eliminar" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {padronOpen && padronCompany && (
        <div className="companies-modal__backdrop" role="presentation" onClick={() => setPadronOpen(false)}>
          <div className="companies-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="companies-modal__header">
              <div className="companies-modal__title">
                Padrón de empleados — <b>{padronCompany.nombre}</b>
              </div>

              <div className="companies-modal__actions">
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => downloadCompanyPdf(padronCompany)}
                >
                  Descargar PDF
                </button>
                <button type="button" className="companies-modal__close" onClick={() => setPadronOpen(false)} aria-label="Cerrar">
                  ×
                </button>
              </div>
            </div>

            <div className="companies-modal__sub">
              {padronLoading
                ? 'Cargando padrón…'
                : padronPeople.length
                  ? `${padronPeople.length} persona(s)`
                  : 'Sin personas cargadas todavía'}
            </div>

            {padronLoading ? (
              <div className="companies-modal__empty">Cargando…</div>
            ) : padronPeople.length > 0 ? (
              <div className="companies-modal__tableWrap">
                <table className="companies-modal__table">
                  <thead>
                    <tr>
                      <th>DNI</th>
                      <th>Nombre</th>
                      <th>Afiliado</th>
                      <th>Puesto</th>
                      <th>Últ. turno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {padronPeople.slice(0, 80).map((p) => (
                      <tr key={p.dni}>
                        <td>{p.dni}</td>
                        <td>{p.nombre || '-'}</td>
                        <td>{p.nroAfiliado || '-'}</td>
                        <td className="companies-modal__muted">{p.puesto || '-'}</td>
                        <td className="companies-modal__muted">{p.lastTurnoISO || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="companies-modal__empty">Todavía no hay empleados asociados a esta empresa.</div>
            )}

            {padronPeople.length > 80 && (
              <div className="companies-modal__hint">Mostrando 80 resultados. (Se deduplica por DNI)</div>
            )}

            <div className="companies-modal__footer">
              <button type="button" className="btn btn--outline" onClick={() => setPadronOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <AddCompanyModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={async (draft) => {
          try {
            await addCompany(draft)
            setOpen(false)
          } catch (e) {
            Swal.fire({ title: 'Error', text: String((e as Error)?.message || 'Error'), icon: 'error' })
          }
        }}
      />
    </section>
  )
}

export default CompaniesQuickList
