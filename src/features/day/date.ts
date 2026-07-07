/** Работа с датами дневника. Дата дня — локальная, в формате ISO «2026-06-01». */

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Сдвиг даты на N дней (N может быть отрицательным). */
export function shiftISODate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) throw new Error('Неверная дата')
  const date = new Date(y, m - 1, d + days)
  return toISODate(date)
}

const formatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
})

/** «пн, 1 июня» для шапки дневника. */
export function formatDayTitle(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return isoDate
  return formatter.format(new Date(y, m - 1, d))
}
