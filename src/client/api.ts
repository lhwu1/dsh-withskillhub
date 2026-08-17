/** Read a same-origin JSON route and surface the host's error message. */
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const payload = await response.json() as T & { error?: unknown }
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with HTTP ${response.status}`)
  return payload
}

/** Format an exact count compactly without losing the full number in the title. */
export function formatCount(value: number | undefined): string {
  if (value === undefined) return '0'
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** Convert unknown rejected values into a display-safe one-line message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
