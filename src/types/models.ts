/**
 * Модель данных Food Tracker (см. CLAUDE.md «Модель данных»).
 * Идентификаторы — UUID (crypto.randomUUID).
 * Даты дней — ISO-строки вида «2026-06-01» (локальная дата устройства).
 */

export type UUID = string

/** Продукт в библиотеке. */
export interface Product {
  id: UUID
  name: string
  defaultWeight: number
  unit: string
  createdAt: string
  updatedAt: string
}

/** Тип приёма пищи (Завтрак / Обед / Ужин + пользовательские в Фазе 4). */
export interface Category {
  id: UUID
  name: string
  isDefault: boolean
  order: number
}

/**
 * Продукт внутри приёма пищи — snapshot.
 * name/weight/unit копируются в момент добавления: изменение или удаление
 * продукта в библиотеке НЕ меняет прошлые дни (PRD US-20).
 */
export interface MealItem {
  productId?: UUID
  name: string
  weight: number
  unit: string
}

/** Приём пищи внутри дня. */
export interface Meal {
  categoryId: UUID
  items: MealItem[]
}

/**
 * Запись дня. Ключ — дата ISO «2026-06-01». Приёмы пищи хранятся вложенно.
 * `updatedAt` — момент последней записи дня; используется при слиянии
 * переноса между устройствами (US-28): побеждает более свежий день.
 */
export interface Day {
  date: string
  meals: Meal[]
  updatedAt: string
}

/** Шаблон приёма пищи. До 10 на категорию (ограничение в логике db). */
export interface Template {
  id: UUID
  name: string
  categoryId: UUID
  items: MealItem[]
}

/** Формат файла резервной копии (экспорт/импорт JSON). v2: дни с updatedAt. */
export interface BackupData {
  format: 'food-tracker-backup'
  version: number
  exportedAt: string
  products: Product[]
  categories: Category[]
  days: Day[]
  templates: Template[]
}

/** Итог слияния при переносе между устройствами (US-28, режим «Объединить»). */
export interface MergeReport {
  days: { added: number; updated: number; kept: number }
  products: { added: number; updated: number; kept: number }
  categories: { added: number; kept: number }
  templates: { added: number; kept: number; skipped: number }
}
