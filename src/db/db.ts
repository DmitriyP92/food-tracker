/**
 * Слой данных — ЕДИНСТВЕННАЯ точка доступа к IndexedDB (через Dexie).
 * Компоненты не обращаются к Dexie напрямую (см. CLAUDE.md).
 *
 * Версионирование схемы — через db.version(N).stores(...) + upgrade-миграции.
 */
import Dexie, { type Table } from 'dexie'
import type { BackupData, Category, Day, Meal, MealItem, Product, Template } from '../types/models'

export const MAX_TEMPLATES_PER_CATEGORY = 10
export const BACKUP_FORMAT = 'food-tracker-backup'
export const BACKUP_VERSION = 1

const DEFAULT_CATEGORY_NAMES = ['Завтрак', 'Обед', 'Ужин']

class FoodTrackerDB extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  days!: Table<Day, string>
  templates!: Table<Template, string>

  constructor() {
    super('food-tracker')
    this.version(1).stores({
      products: 'id, name, updatedAt',
      categories: 'id, order',
      days: 'date',
      templates: 'id, categoryId',
    })
    this.on('populate', (tx) => seedDefaultCategories(tx.table('categories')))
  }
}

function seedDefaultCategories(categories: Table<Category, string>) {
  return categories.bulkAdd(
    DEFAULT_CATEGORY_NAMES.map((name, order) => ({
      id: crypto.randomUUID(),
      name,
      isDefault: true,
      order,
    })),
  )
}

export const db = new FoodTrackerDB()

function nowISO(): string {
  return new Date().toISOString()
}

function assertProductInput(name: string, defaultWeight: number): void {
  if (!name.trim()) throw new Error('Название продукта не может быть пустым')
  if (!Number.isFinite(defaultWeight) || defaultWeight <= 0)
    throw new Error('Вес должен быть положительным числом')
}

// ───────────────────────── Продукты (библиотека) ─────────────────────────

export async function listProducts(): Promise<Product[]> {
  return db.products.orderBy('name').toArray()
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id)
}

export async function addProduct(input: {
  name: string
  defaultWeight: number
  unit: string
}): Promise<Product> {
  assertProductInput(input.name, input.defaultWeight)
  const now = nowISO()
  const product: Product = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    defaultWeight: input.defaultWeight,
    unit: input.unit,
    createdAt: now,
    updatedAt: now,
  }
  await db.products.add(product)
  return product
}

/** Меняет продукт в библиотеке. Прошлые записи дневника не затрагивает (snapshot, US-20). */
export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, 'name' | 'defaultWeight' | 'unit'>>,
): Promise<Product> {
  return db.transaction('rw', db.products, async () => {
    const existing = await db.products.get(id)
    if (!existing) throw new Error('Продукт не найден')
    const updated: Product = { ...existing, ...patch, updatedAt: nowISO() }
    assertProductInput(updated.name, updated.defaultWeight)
    updated.name = updated.name.trim()
    await db.products.put(updated)
    return updated
  })
}

/** Удаляет продукт из библиотеки. Дневник и шаблоны не затрагивает (snapshot, US-3). */
export async function deleteProduct(id: string): Promise<void> {
  await db.products.delete(id)
}

// ───────────────────────── Категории ─────────────────────────

export async function listCategories(): Promise<Category[]> {
  return db.categories.orderBy('order').toArray()
}

// ───────────────────────── Дни и приёмы пищи ─────────────────────────

export async function getDay(date: string): Promise<Day> {
  return (await db.days.get(date)) ?? { date, meals: [] }
}

function snapshotOf(product: Product, weight?: number): MealItem {
  return {
    productId: product.id,
    name: product.name,
    weight: weight ?? product.defaultWeight,
    unit: product.unit,
  }
}

/** Добавляет продукт в приём пищи выбранного дня как snapshot (US-7, US-20). */
export async function addProductToMeal(
  date: string,
  categoryId: string,
  product: Product,
  weight?: number,
): Promise<Day> {
  return addItemToMeal(date, categoryId, snapshotOf(product, weight))
}

/** Добавляет готовый snapshot-элемент (используется копированием и шаблонами). */
export async function addItemToMeal(
  date: string,
  categoryId: string,
  item: MealItem,
): Promise<Day> {
  if (!item.name.trim()) throw new Error('Название продукта не может быть пустым')
  if (!Number.isFinite(item.weight) || item.weight <= 0)
    throw new Error('Вес должен быть положительным числом')
  return db.transaction('rw', db.days, async () => {
    const day = await getDay(date)
    let meal: Meal | undefined = day.meals.find((m) => m.categoryId === categoryId)
    if (!meal) {
      meal = { categoryId, items: [] }
      day.meals.push(meal)
    }
    meal.items.push({ ...item })
    await db.days.put(day)
    return day
  })
}

/** Меняет элемент приёма (например, вес — US-8). Библиотеку не затрагивает. */
export async function updateMealItem(
  date: string,
  categoryId: string,
  itemIndex: number,
  patch: Partial<Pick<MealItem, 'name' | 'weight' | 'unit'>>,
): Promise<Day> {
  return db.transaction('rw', db.days, async () => {
    const day = await getDay(date)
    const meal = day.meals.find((m) => m.categoryId === categoryId)
    const item = meal?.items[itemIndex]
    if (!meal || !item) throw new Error('Запись не найдена')
    const updated: MealItem = { ...item, ...patch }
    if (!updated.name.trim()) throw new Error('Название продукта не может быть пустым')
    if (!Number.isFinite(updated.weight) || updated.weight <= 0)
      throw new Error('Вес должен быть положительным числом')
    meal.items[itemIndex] = updated
    await db.days.put(day)
    return day
  })
}

/** Убирает элемент из приёма пищи (US-9). Пустые приёмы удаляются из дня. */
export async function removeMealItem(
  date: string,
  categoryId: string,
  itemIndex: number,
): Promise<Day> {
  return db.transaction('rw', db.days, async () => {
    const day = await getDay(date)
    const meal = day.meals.find((m) => m.categoryId === categoryId)
    if (!meal || itemIndex < 0 || itemIndex >= meal.items.length)
      throw new Error('Запись не найдена')
    meal.items.splice(itemIndex, 1)
    day.meals = day.meals.filter((m) => m.items.length > 0)
    await db.days.put(day)
    return day
  })
}

// ───────────────────────── Шаблоны ─────────────────────────

export async function listTemplates(categoryId?: string): Promise<Template[]> {
  return categoryId
    ? db.templates.where('categoryId').equals(categoryId).toArray()
    : db.templates.toArray()
}

/** Сохраняет шаблон. Не больше MAX_TEMPLATES_PER_CATEGORY на категорию (US-14). */
export async function saveTemplate(input: {
  name: string
  categoryId: string
  items: MealItem[]
}): Promise<Template> {
  if (!input.name.trim()) throw new Error('Название шаблона не может быть пустым')
  return db.transaction('rw', db.templates, async () => {
    const count = await db.templates.where('categoryId').equals(input.categoryId).count()
    if (count >= MAX_TEMPLATES_PER_CATEGORY)
      throw new Error(`Не больше ${MAX_TEMPLATES_PER_CATEGORY} шаблонов на категорию`)
    const template: Template = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      categoryId: input.categoryId,
      items: input.items.map((item) => ({ ...item })),
    }
    await db.templates.add(template)
    return template
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}

// ───────────────────────── Резервная копия (JSON) ─────────────────────────

/** Экспорт всех данных в JSON-совместимый объект (защита от очистки кэша Safari). */
export async function exportBackup(): Promise<BackupData> {
  return db.transaction('r', [db.products, db.categories, db.days, db.templates], async () => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    products: await db.products.toArray(),
    categories: await db.categories.toArray(),
    days: await db.days.toArray(),
    templates: await db.templates.toArray(),
  }))
}

/** Импорт резервной копии. ПОЛНОСТЬЮ заменяет текущие данные. */
export async function importBackup(data: unknown): Promise<void> {
  if (!isBackupData(data)) throw new Error('Файл не является резервной копией Food Tracker')
  await db.transaction('rw', [db.products, db.categories, db.days, db.templates], async () => {
    await Promise.all([
      db.products.clear(),
      db.categories.clear(),
      db.days.clear(),
      db.templates.clear(),
    ])
    await db.products.bulkAdd(data.products)
    await db.categories.bulkAdd(data.categories)
    await db.days.bulkAdd(data.days)
    await db.templates.bulkAdd(data.templates)
  })
}

function isBackupData(data: unknown): data is BackupData {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    d.format === BACKUP_FORMAT &&
    d.version === BACKUP_VERSION &&
    Array.isArray(d.products) &&
    Array.isArray(d.categories) &&
    Array.isArray(d.days) &&
    Array.isArray(d.templates)
  )
}
