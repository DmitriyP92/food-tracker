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

/** Добавляет пользовательскую категорию в конец списка (US-13). */
export async function addCategory(name: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Название категории не может быть пустым')
  return db.transaction('rw', db.categories, async () => {
    const existing = await db.categories.toArray()
    if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase()))
      throw new Error('Такая категория уже есть')
    const category: Category = {
      id: crypto.randomUUID(),
      name: trimmed,
      isDefault: false,
      order: Math.max(0, ...existing.map((c) => c.order)) + 1,
    }
    await db.categories.add(category)
    return category
  })
}

/** Сохраняет порядок категорий: order = позиция в переданном списке id. */
export async function setCategoryOrder(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const categories = await db.categories.toArray()
    const valid =
      orderedIds.length === categories.length &&
      new Set(orderedIds).size === orderedIds.length &&
      categories.every((c) => orderedIds.includes(c.id))
    if (!valid) throw new Error('Неверный порядок категорий')
    await Promise.all(orderedIds.map((id, index) => db.categories.update(id, { order: index })))
  })
}

/**
 * Удаляет пользовательскую категорию (US-13). Дефолтные удалять нельзя.
 * Категория, на которую ссылаются дневник или шаблоны, не удаляется —
 * иначе прошлые дни осиротеют (snapshot-принцип, US-20/23).
 */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', [db.categories, db.days, db.templates], async () => {
    const category = await db.categories.get(id)
    if (!category) throw new Error('Категория не найдена')
    if (category.isDefault) throw new Error('Нельзя удалить категорию по умолчанию')
    const usedInDays = await db.days
      .filter((day) => day.meals.some((meal) => meal.categoryId === id))
      .count()
    if (usedInDays > 0) throw new Error('Категория используется в дневнике')
    const usedInTemplates = await db.templates.where('categoryId').equals(id).count()
    if (usedInTemplates > 0) throw new Error('Категория используется в шаблонах')
    await db.categories.delete(id)
  })
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

/**
 * Копирует все приёмы пищи одного дня в другой (US-26: «Скопировать вчера»
 * и копирование из произвольной даты). Копии независимы (snapshot);
 * день-источник не меняется, существующие записи дня-назначения сохраняются.
 */
export async function copyDay(fromDate: string, toDate: string): Promise<Day> {
  if (fromDate === toDate) throw new Error('Нельзя скопировать день сам в себя')
  return db.transaction('rw', db.days, async () => {
    const source = await getDay(fromDate)
    if (source.meals.every((meal) => meal.items.length === 0))
      throw new Error('День-источник пуст')
    const target = await getDay(toDate)
    for (const meal of source.meals) {
      let targetMeal: Meal | undefined = target.meals.find(
        (m) => m.categoryId === meal.categoryId,
      )
      if (!targetMeal) {
        targetMeal = { categoryId: meal.categoryId, items: [] }
        target.meals.push(targetMeal)
      }
      targetMeal.items.push(...meal.items.map((item) => ({ ...item })))
    }
    await db.days.put(target)
    return target
  })
}

/** Копирует один приём пищи в тот же приём другого дня (US-26). */
export async function copyMeal(
  fromDate: string,
  toDate: string,
  categoryId: string,
): Promise<Day> {
  if (fromDate === toDate) throw new Error('Нельзя скопировать день сам в себя')
  return db.transaction('rw', db.days, async () => {
    const source = await getDay(fromDate)
    const sourceMeal = source.meals.find((m) => m.categoryId === categoryId)
    if (!sourceMeal || sourceMeal.items.length === 0) throw new Error('Приём пищи пуст')
    const target = await getDay(toDate)
    let targetMeal: Meal | undefined = target.meals.find((m) => m.categoryId === categoryId)
    if (!targetMeal) {
      targetMeal = { categoryId, items: [] }
      target.meals.push(targetMeal)
    }
    targetMeal.items.push(...sourceMeal.items.map((item) => ({ ...item })))
    await db.days.put(target)
    return target
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

/** Меняет шаблон (имя и/или состав). Затрагивает только этот шаблон (US-17). */
export async function updateTemplate(
  id: string,
  patch: Partial<Pick<Template, 'name' | 'items'>>,
): Promise<Template> {
  return db.transaction('rw', db.templates, async () => {
    const existing = await db.templates.get(id)
    if (!existing) throw new Error('Шаблон не найден')
    const updated: Template = {
      ...existing,
      ...patch,
      items: (patch.items ?? existing.items).map((item) => ({ ...item })),
    }
    updated.name = updated.name.trim()
    if (!updated.name) throw new Error('Название шаблона не может быть пустым')
    await db.templates.put(updated)
    return updated
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id)
}

/**
 * Применяет шаблон к выбранному дню: продукты добавляются в приём категории
 * шаблона как независимые копии (US-15). Правки дня не меняют шаблон.
 */
export async function applyTemplate(date: string, templateId: string): Promise<Day> {
  return db.transaction('rw', [db.days, db.templates], async () => {
    const template = await db.templates.get(templateId)
    if (!template) throw new Error('Шаблон не найден')
    const day = await getDay(date)
    let meal: Meal | undefined = day.meals.find((m) => m.categoryId === template.categoryId)
    if (!meal) {
      meal = { categoryId: template.categoryId, items: [] }
      day.meals.push(meal)
    }
    meal.items.push(...template.items.map((item) => ({ ...item })))
    await db.days.put(day)
    return day
  })
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
