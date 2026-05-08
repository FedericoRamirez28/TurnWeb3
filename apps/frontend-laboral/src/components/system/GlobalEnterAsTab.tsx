import  { useEffect } from 'react'

function isVisible(el: HTMLElement) {
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  return true
}

function isDisabled(el: HTMLElement) {
  if ('disabled' in el) return Boolean((el as unknown as { disabled?: boolean }).disabled)
  return el.hasAttribute('disabled')
}

function isTextArea(el: HTMLElement): el is HTMLTextAreaElement {
  return el.tagName.toLowerCase() === 'textarea'
}

function isEditable(el: HTMLElement) {
  if (el.isContentEditable) return true
  const role = el.getAttribute('role') || ''
  return role.toLowerCase() === 'textbox'
}

function getFocusableFields(): HTMLElement[] {
  // ✅ SOLO CAMPOS (no botones / tabs)
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('input, select, textarea'))

  return nodes.filter((el) => {
    if (!el) return false
    if (isDisabled(el)) return false
    if (!isVisible(el)) return false
    if (el.getAttribute('aria-hidden') === 'true') return false

    // Excluir hidden / submit / button
    if (el instanceof HTMLInputElement) {
      const t = (el.type || '').toLowerCase()
      if (t === 'hidden' || t === 'submit' || t === 'button') return false
    }

    return true
  })
}

function focusNextFieldFrom(active: HTMLElement) {
  const fields = getFocusableFields()
  const idx = fields.indexOf(active)
  if (idx < 0) return

  const next = fields[idx + 1]
  if (next) next.focus()
}

function shouldIgnoreTarget(target: HTMLElement) {
  // No tocar nada dentro de SweetAlert2 (modal)
  if (target.closest('.swal2-container')) return true

  // No tocar editores rich-text / contentEditable
  if (isEditable(target)) return true

  return false
}

export function GlobalEnterAsTab() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return

      // no romper atajos
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e as unknown as { isComposing?: boolean }).isComposing) return

      const target = e.target as HTMLElement | null
      if (!target) return

      if (shouldIgnoreTarget(target)) return

      const tag = target.tagName.toLowerCase()

      // ✅ No interceptar botones (Enter debería ejecutar click)
      if (tag === 'button') return

      // Solo inputs/select/textarea
      const isField = tag === 'input' || tag === 'select' || tag === 'textarea'
      if (!isField) return

      // Si es input tipo checkbox/radio: Enter = toggle (click)
      if (target instanceof HTMLInputElement) {
        const t = (target.type || '').toLowerCase()
        if (t === 'checkbox' || t === 'radio') {
          e.preventDefault()
          target.click()
          return
        }
        // submit/button ya está excluido arriba, pero por las dudas:
        if (t === 'submit' || t === 'button') return
      }

      // Textarea: por defecto Enter crea nueva línea -> lo dejamos normal
      // Si vos querés que también haga "tab" en textarea, borrá este if.
      if (isTextArea(target)) return

      // ✅ Enter = Tab global
      e.preventDefault()
      e.stopPropagation()
      focusNextFieldFrom(target)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return null
}

export default GlobalEnterAsTab
