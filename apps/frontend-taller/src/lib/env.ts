export function getApiBaseUrl(): string {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  return raw.replace(/\/+$/, '')
}
