import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import type { BackupData } from '../types/models'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_TEMPLATES_PER_CATEGORY,
  addCategory,
  addProduct,
  addProductToMeal,
  applyTemplate,
  copyDay,
  copyMeal,
  db,
  deleteCategory,
  deleteProduct,
  exportBackup,
  getDay,
  getProduct,
  importBackup,
  listCategories,
  listProducts,
  listTemplates,
  mergeBackup,
  removeMealItem,
  saveTemplate,
  setCategoryOrder,
  updateMealItem,
  updateProduct,
  updateTemplate,
} from './db'

const DATE = '2026-06-01'

beforeEach(async () => {
  await db.delete()
  await db.open() // populate заново сеет дефолтные категории
})

describe('категории', () => {
  it('дефолтные категории сеются при создании базы (US-12)', async () => {
    const categories = await listCategories()
    expect(categories.map((c) => c.name)).toEqual(['Завтрак', 'Обед', 'Ужин'])
    expect(categories.every((c) => c.isDefault)).toBe(true)
  })

  it('добавляет пользовательскую категорию в конец (US-13)', async () => {
    const snack = await addCategory('Перекус')
    expect(snack.isDefault).toBe(false)
    const categories = await listCategories()
    expect(categories.map((c) => c.name)).toEqual(['Завтрак', 'Обед', 'Ужин', 'Перекус'])
  })

  it('отклоняет пустое имя и дубликат (без учёта регистра)', async () => {
    await expect(addCategory('  ')).rejects.toThrow()
    await addCategory('Перекус')
    await expect(addCategory('перекус')).rejects.toThrow('уже есть')
  })

  it('удаляет пользовательскую категорию, но не дефолтную (US-13)', async () => {
    const snack = await addCategory('Перекус')
    await deleteCategory(snack.id)
    expect(await listCategories()).toHaveLength(3)

    const [breakfast] = await listCategories()
    await expect(deleteCategory(breakfast!.id)).rejects.toThrow('по умолчанию')
  })

  it('меняет порядок категорий (вставить «Второй завтрак» после Завтрака)', async () => {
    const second = await addCategory('Второй завтрак')
    const [breakfast, lunch, dinner] = await listCategories()
    await setCategoryOrder([breakfast!.id, second.id, lunch!.id, dinner!.id])

    const reordered = await listCategories()
    expect(reordered.map((c) => c.name)).toEqual(['Завтрак', 'Второй завтрак', 'Обед', 'Ужин'])
  })

  it('отклоняет неполный или дублирующийся порядок', async () => {
    const [breakfast, lunch] = await listCategories()
    await expect(setCategoryOrder([breakfast!.id, lunch!.id])).rejects.toThrow()
    await expect(
      setCategoryOrder([breakfast!.id, breakfast!.id, lunch!.id]),
    ).rejects.toThrow()
  })

  it('не удаляет категорию, используемую в дневнике или шаблонах', async () => {
    const snack = await addCategory('Перекус')
    const product = await addProduct({ name: 'Яблоко', defaultWeight: 150, unit: 'г' })
    await addProductToMeal(DATE, snack.id, product)
    await expect(deleteCategory(snack.id)).rejects.toThrow('в дневнике')

    const snack2 = await addCategory('Второй ужин')
    await saveTemplate({
      name: 'Вечер',
      categoryId: snack2.id,
      items: [{ name: 'Кефир', weight: 250, unit: 'мл' }],
    })
    await expect(deleteCategory(snack2.id)).rejects.toThrow('в шаблонах')
  })
})

describe('библиотека продуктов', () => {
  it('добавляет продукт и возвращает список по алфавиту (US-1)', async () => {
    await addProduct({ name: 'Творог', defaultWeight: 150, unit: 'г' })
    await addProduct({ name: 'Гречка', defaultWeight: 100, unit: 'г' })
    const products = await listProducts()
    expect(products.map((p) => p.name)).toEqual(['Гречка', 'Творог'])
  })

  it('отклоняет пустое название и неположительный вес', async () => {
    await expect(addProduct({ name: '  ', defaultWeight: 100, unit: 'г' })).rejects.toThrow()
    await expect(addProduct({ name: 'Рис', defaultWeight: 0, unit: 'г' })).rejects.toThrow()
    await expect(addProduct({ name: 'Рис', defaultWeight: -5, unit: 'г' })).rejects.toThrow()
  })

  it('редактирует продукт и обновляет updatedAt (US-2)', async () => {
    const product = await addProduct({ name: 'Овсянка', defaultWeight: 50, unit: 'г' })
    const updated = await updateProduct(product.id, { defaultWeight: 60 })
    expect(updated.defaultWeight).toBe(60)
    expect(updated.updatedAt >= product.updatedAt).toBe(true)
  })

  it('удаляет продукт из библиотеки (US-3)', async () => {
    const product = await addProduct({ name: 'Кефир', defaultWeight: 250, unit: 'мл' })
    await deleteProduct(product.id)
    expect(await getProduct(product.id)).toBeUndefined()
  })
})

describe('день и приёмы пищи', () => {
  it('добавляет продукт с весом по умолчанию (US-7)', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Яйцо', defaultWeight: 60, unit: 'г' })
    const day = await addProductToMeal(DATE, breakfast!.id, product)
    expect(day.meals).toHaveLength(1)
    expect(day.meals[0]!.items[0]).toEqual({
      productId: product.id,
      name: 'Яйцо',
      weight: 60,
      unit: 'г',
    })
  })

  it('запись дня — snapshot: правка и удаление продукта не меняют день (US-20)', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Хлеб', defaultWeight: 30, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, product)

    await updateProduct(product.id, { name: 'Хлеб ржаной', defaultWeight: 40 })
    await deleteProduct(product.id)

    const day = await getDay(DATE)
    expect(day.meals[0]!.items[0]).toMatchObject({ name: 'Хлеб', weight: 30 })
  })

  it('изменение веса в дне не меняет библиотеку (US-8)', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Сыр', defaultWeight: 20, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, product)

    const day = await updateMealItem(DATE, breakfast!.id, 0, { weight: 35 })
    expect(day.meals[0]!.items[0]!.weight).toBe(35)
    expect((await getProduct(product.id))!.defaultWeight).toBe(20)
  })

  it('убирает продукт из приёма; пустой приём удаляется (US-9)', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Банан', defaultWeight: 120, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, product)

    const day = await removeMealItem(DATE, breakfast!.id, 0)
    expect(day.meals).toHaveLength(0)
  })

  it('дни независимы: запись в один день не видна в другом (US-23)', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Каша', defaultWeight: 200, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, product)

    const other = await getDay('2026-06-02')
    expect(other.meals).toHaveLength(0)
  })
})

describe('копирование дня (US-26)', () => {
  it('копирует все приёмы в другой день, источник не меняется', async () => {
    const [breakfast, lunch] = await listCategories()
    const oats = await addProduct({ name: 'Овсянка', defaultWeight: 60, unit: 'г' })
    const soup = await addProduct({ name: 'Суп', defaultWeight: 350, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, oats)
    await addProductToMeal(DATE, lunch!.id, soup)

    const target = await copyDay(DATE, '2026-06-02')
    expect(target.meals).toHaveLength(2)

    // копия независима: правка копии не меняет источник
    await updateMealItem('2026-06-02', breakfast!.id, 0, { weight: 90 })
    const source = await getDay(DATE)
    expect(source.meals[0]!.items[0]!.weight).toBe(60)
  })

  it('дополняет, а не затирает записи дня-назначения', async () => {
    const [breakfast] = await listCategories()
    const oats = await addProduct({ name: 'Овсянка', defaultWeight: 60, unit: 'г' })
    const egg = await addProduct({ name: 'Яйцо', defaultWeight: 60, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, oats)
    await addProductToMeal('2026-06-02', breakfast!.id, egg)

    const target = await copyDay(DATE, '2026-06-02')
    expect(target.meals[0]!.items.map((i) => i.name)).toEqual(['Яйцо', 'Овсянка'])
  })

  it('отклоняет пустой источник и копирование в себя', async () => {
    await expect(copyDay('2026-06-03', '2026-06-04')).rejects.toThrow('пуст')
    await expect(copyDay(DATE, DATE)).rejects.toThrow()
  })

  it('копирует один приём пищи, не трогая остальные (US-26)', async () => {
    const [breakfast, lunch] = await listCategories()
    const oats = await addProduct({ name: 'Овсянка', defaultWeight: 60, unit: 'г' })
    const soup = await addProduct({ name: 'Суп', defaultWeight: 350, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, oats)
    await addProductToMeal(DATE, lunch!.id, soup)

    const target = await copyMeal(DATE, '2026-06-02', breakfast!.id)
    expect(target.meals).toHaveLength(1)
    expect(target.meals[0]!.items[0]!.name).toBe('Овсянка')

    // копия независима, источник не изменился
    await updateMealItem('2026-06-02', breakfast!.id, 0, { weight: 90 })
    const source = await getDay(DATE)
    expect(source.meals[0]!.items[0]!.weight).toBe(60)
  })

  it('отклоняет копирование пустого приёма', async () => {
    const [breakfast] = await listCategories()
    await expect(copyMeal(DATE, '2026-06-02', breakfast!.id)).rejects.toThrow('пуст')
  })
})

describe('шаблоны', () => {
  it(`не больше ${MAX_TEMPLATES_PER_CATEGORY} шаблонов на категорию (US-14)`, async () => {
    const [breakfast, lunch] = await listCategories()
    const items = [{ name: 'Каша', weight: 200, unit: 'г' }]
    for (let i = 0; i < MAX_TEMPLATES_PER_CATEGORY; i++) {
      await saveTemplate({ name: `Шаблон ${i + 1}`, categoryId: breakfast!.id, items })
    }
    await expect(
      saveTemplate({ name: 'Лишний', categoryId: breakfast!.id, items }),
    ).rejects.toThrow()
    // лимит — на категорию, в другой сохранять можно
    await expect(
      saveTemplate({ name: 'Обеденный', categoryId: lunch!.id, items }),
    ).resolves.toBeDefined()
    expect(await listTemplates(breakfast!.id)).toHaveLength(MAX_TEMPLATES_PER_CATEGORY)
  })

  it('применяет шаблон как независимую копию (US-15)', async () => {
    const [breakfast] = await listCategories()
    const template = await saveTemplate({
      name: 'Утро',
      categoryId: breakfast!.id,
      items: [
        { name: 'Каша', weight: 200, unit: 'г' },
        { name: 'Кофе', weight: 250, unit: 'мл' },
      ],
    })

    const day = await applyTemplate(DATE, template.id)
    expect(day.meals[0]!.items).toHaveLength(2)

    // правка применённой копии не меняет шаблон (US-15/16)
    await updateMealItem(DATE, breakfast!.id, 0, { weight: 300 })
    const [stored] = await listTemplates(breakfast!.id)
    expect(stored!.items[0]!.weight).toBe(200)
  })

  it('редактирует шаблон, не трогая дневник и библиотеку (US-17)', async () => {
    const [breakfast] = await listCategories()
    const template = await saveTemplate({
      name: 'Утро',
      categoryId: breakfast!.id,
      items: [
        { name: 'Каша', weight: 200, unit: 'г' },
        { name: 'Кофе', weight: 250, unit: 'мл' },
      ],
    })
    await applyTemplate(DATE, template.id)

    // убрать «Кофе» из шаблона и переименовать
    const updated = await updateTemplate(template.id, {
      name: 'Утро без кофе',
      items: template.items.filter((item) => item.name !== 'Кофе'),
    })
    expect(updated.items).toHaveLength(1)

    // применённый ранее день не изменился
    const day = await getDay(DATE)
    expect(day.meals[0]!.items).toHaveLength(2)
  })

  it('отклоняет применение несуществующего шаблона', async () => {
    await expect(applyTemplate(DATE, 'нет-такого')).rejects.toThrow()
  })
})

describe('миграция схемы v1 → v2 (US-28)', () => {
  it('проставляет updatedAt существующим дням при апгрейде', async () => {
    await db.delete()
    // база «старого» приложения: версия 1, день без updatedAt
    const raw = new Dexie('food-tracker')
    raw.version(1).stores({
      products: 'id, name, updatedAt',
      categories: 'id, order',
      days: 'date',
      templates: 'id, categoryId',
    })
    await raw.open()
    await raw.table('days').add({
      date: '2026-05-01',
      meals: [{ categoryId: 'x', items: [{ name: 'Каша', weight: 200, unit: 'г' }] }],
    })
    raw.close()

    await db.open() // апгрейд до v2
    const day = await getDay('2026-05-01')
    expect(day.updatedAt).toBeTruthy()
    expect(day.meals[0]!.items[0]!.name).toBe('Каша')
  })

  it('каждая мутация дня обновляет updatedAt', async () => {
    const [breakfast, lunch] = await listCategories()
    const product = await addProduct({ name: 'Овсянка', defaultWeight: 60, unit: 'г' })
    const stamps: string[] = []
    const tick = () => new Promise((r) => setTimeout(r, 2))

    let day = await addProductToMeal(DATE, breakfast!.id, product)
    stamps.push(day.updatedAt)
    await tick()
    day = await updateMealItem(DATE, breakfast!.id, 0, { weight: 90 })
    stamps.push(day.updatedAt)
    await tick()
    day = await copyDay(DATE, '2026-06-02')
    stamps.push(day.updatedAt)
    await tick()
    day = await copyMeal(DATE, '2026-06-03', breakfast!.id)
    stamps.push(day.updatedAt)
    await tick()
    const template = await saveTemplate({
      name: 'Утро',
      categoryId: lunch!.id,
      items: [{ name: 'Суп', weight: 350, unit: 'г' }],
    })
    day = await applyTemplate(DATE, template.id)
    stamps.push(day.updatedAt)
    await tick()
    day = await removeMealItem(DATE, breakfast!.id, 0)
    stamps.push(day.updatedAt)

    expect(stamps.every(Boolean)).toBe(true)
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i]! > stamps[i - 1]!).toBe(true)
    }
  })
})

/** Файл «с другого устройства»: свои UUID у всего, включая дефолтные категории. */
function deviceFile(overrides: Partial<BackupData> = {}): BackupData {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-06-10T10:00:00.000Z',
    products: [],
    categories: [],
    days: [],
    templates: [],
    ...overrides,
  }
}

describe('перенос между устройствами — mergeBackup (US-28)', () => {
  it('добавляет дни из файла, не трогая локальные (критерии 2, 7)', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Локальный', defaultWeight: 100, unit: 'г' })
    await addProductToMeal('2026-06-05', breakfast!.id, product)

    const report = await mergeBackup(
      deviceFile({
        days: [
          {
            date: '2026-06-01',
            meals: [{ categoryId: 'remote-cat', items: [{ name: 'Каша', weight: 200, unit: 'г' }] }],
            updatedAt: '2026-06-01T09:00:00.000Z',
          },
        ],
      }),
    )

    expect(report.days).toEqual({ added: 1, updated: 0, kept: 0 })
    expect((await getDay('2026-06-01')).meals[0]!.items[0]!.name).toBe('Каша')
    // локальный день не тронут
    expect((await getDay('2026-06-05')).meals[0]!.items[0]!.name).toBe('Локальный')
  })

  it('конфликт дня: побеждает более свежий, при равенстве — локальный', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Локальный', defaultWeight: 100, unit: 'г' })
    const local = await addProductToMeal(DATE, breakfast!.id, product)

    // файл СТАРЕЕ локального → локальный остаётся
    let report = await mergeBackup(
      deviceFile({
        days: [
          {
            date: DATE,
            meals: [{ categoryId: 'x', items: [{ name: 'Старый', weight: 1, unit: 'г' }] }],
            updatedAt: '2020-01-01T00:00:00.000Z',
          },
        ],
      }),
    )
    expect(report.days).toEqual({ added: 0, updated: 0, kept: 1 })
    expect((await getDay(DATE)).meals[0]!.items[0]!.name).toBe('Локальный')

    // файл НОВЕЕ локального → файл побеждает
    report = await mergeBackup(
      deviceFile({
        days: [
          {
            date: DATE,
            meals: [{ categoryId: 'x', items: [{ name: 'Новый', weight: 2, unit: 'г' }] }],
            updatedAt: '2099-01-01T00:00:00.000Z',
          },
        ],
      }),
    )
    expect(report.days).toEqual({ added: 0, updated: 1, kept: 0 })
    expect((await getDay(DATE)).meals[0]!.items[0]!.name).toBe('Новый')

    // равные метки → локальный
    report = await mergeBackup(
      deviceFile({
        days: [{ date: '2026-06-07', meals: [], updatedAt: local.updatedAt }],
      }),
    )
    expect(report.days.added).toBe(1)
  })

  it('продукты: более свежий побеждает, локальные не удаляются', async () => {
    const localOnly = await addProduct({ name: 'Только локальный', defaultWeight: 1, unit: 'г' })
    const shared = await addProduct({ name: 'Общий', defaultWeight: 100, unit: 'г' })

    const report = await mergeBackup(
      deviceFile({
        products: [
          { ...shared, name: 'Общий обновлённый', updatedAt: '2099-01-01T00:00:00.000Z' },
          {
            id: 'remote-product',
            name: 'Новый с iPad',
            defaultWeight: 50,
            unit: 'г',
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(report.products).toEqual({ added: 1, updated: 1, kept: 0 })
    expect((await getProduct(shared.id))!.name).toBe('Общий обновлённый')
    expect((await getProduct(localOnly.id))!.name).toBe('Только локальный')
    expect(await listProducts()).toHaveLength(3)
  })

  it('склеивает дефолтные категории по имени и переписывает categoryId (§5)', async () => {
    const [localBreakfast] = await listCategories()

    const report = await mergeBackup(
      deviceFile({
        categories: [{ id: 'remote-breakfast', name: 'завтрак', isDefault: true, order: 0 }],
        days: [
          {
            date: '2026-06-01',
            meals: [
              { categoryId: 'remote-breakfast', items: [{ name: 'Каша', weight: 200, unit: 'г' }] },
            ],
            updatedAt: '2026-06-01T09:00:00.000Z',
          },
        ],
        templates: [
          {
            id: 'remote-template',
            name: 'Утро',
            categoryId: 'remote-breakfast',
            items: [{ name: 'Каша', weight: 200, unit: 'г' }],
          },
        ],
      }),
    )

    expect(report.categories).toEqual({ added: 0, kept: 1 })
    expect(await listCategories()).toHaveLength(3)
    // categoryId в дне и шаблоне переписан на локальный id
    expect((await getDay('2026-06-01')).meals[0]!.categoryId).toBe(localBreakfast!.id)
    expect((await listTemplates())[0]!.categoryId).toBe(localBreakfast!.id)
  })

  it('пользовательская категория из файла добавляется в конец', async () => {
    const report = await mergeBackup(
      deviceFile({
        categories: [{ id: 'remote-snack', name: 'Перекус', isDefault: false, order: 0 }],
      }),
    )
    expect(report.categories).toEqual({ added: 1, kept: 0 })
    const categories = await listCategories()
    expect(categories.map((c) => c.name)).toEqual(['Завтрак', 'Обед', 'Ужин', 'Перекус'])
  })

  it('шаблоны сверх лимита пропускаются и попадают в отчёт', async () => {
    const [breakfast] = await listCategories()
    const items = [{ name: 'Каша', weight: 200, unit: 'г' }]
    for (let i = 0; i < MAX_TEMPLATES_PER_CATEGORY; i++) {
      await saveTemplate({ name: `Шаблон ${i}`, categoryId: breakfast!.id, items })
    }

    const report = await mergeBackup(
      deviceFile({
        categories: [{ id: 'remote-breakfast', name: 'Завтрак', isDefault: true, order: 0 }],
        templates: [{ id: 'remote-template', name: 'Лишний', categoryId: 'remote-breakfast', items }],
      }),
    )

    expect(report.templates).toEqual({ added: 0, kept: 0, skipped: 1 })
    expect(await listTemplates()).toHaveLength(MAX_TEMPLATES_PER_CATEGORY)
  })

  it('идемпотентность: повторное слияние того же файла ничего не меняет (критерий 4)', async () => {
    const file = deviceFile({
      categories: [{ id: 'remote-snack', name: 'Перекус', isDefault: false, order: 0 }],
      products: [
        {
          id: 'remote-product',
          name: 'С iPad',
          defaultWeight: 50,
          unit: 'г',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      days: [
        {
          date: '2026-06-01',
          meals: [{ categoryId: 'remote-snack', items: [{ name: 'Яблоко', weight: 150, unit: 'г' }] }],
          updatedAt: '2026-06-01T09:00:00.000Z',
        },
      ],
      templates: [
        {
          id: 'remote-template',
          name: 'Перекусить',
          categoryId: 'remote-snack',
          items: [{ name: 'Яблоко', weight: 150, unit: 'г' }],
        },
      ],
    })

    const first = await mergeBackup(JSON.parse(JSON.stringify(file)) as unknown)
    expect(first.days.added).toBe(1)
    expect(first.products.added).toBe(1)
    expect(first.categories.added).toBe(1)
    expect(first.templates.added).toBe(1)

    const second = await mergeBackup(JSON.parse(JSON.stringify(file)) as unknown)
    expect(second).toEqual({
      days: { added: 0, updated: 0, kept: 1 },
      products: { added: 0, updated: 0, kept: 1 },
      categories: { added: 0, kept: 1 },
      templates: { added: 0, kept: 1, skipped: 0 },
    })
    expect((await getDay('2026-06-01')).meals[0]!.items).toHaveLength(1)
  })

  it('принимает файл v1 без updatedAt у дней в обоих режимах (критерий 6)', async () => {
    const v1 = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-06-01T10:00:00.000Z',
      products: [],
      categories: [],
      days: [
        {
          date: '2026-05-30',
          meals: [{ categoryId: 'x', items: [{ name: 'Каша', weight: 200, unit: 'г' }] }],
        },
      ],
      templates: [],
    }

    const report = await mergeBackup(JSON.parse(JSON.stringify(v1)) as unknown)
    expect(report.days.added).toBe(1)
    expect((await getDay('2026-05-30')).updatedAt).toBe(v1.exportedAt)

    await importBackup(JSON.parse(JSON.stringify(v1)) as unknown)
    expect((await getDay('2026-05-30')).updatedAt).toBe(v1.exportedAt)
  })

  it('отклоняет чужой файл той же ошибкой, что и importBackup', async () => {
    await expect(mergeBackup({ hello: 'world' })).rejects.toThrow(
      'Файл не является резервной копией Food Tracker',
    )
  })
})

describe('резервная копия', () => {
  it('экспорт → импорт восстанавливает все данные', async () => {
    const [breakfast] = await listCategories()
    const product = await addProduct({ name: 'Йогурт', defaultWeight: 125, unit: 'г' })
    await addProductToMeal(DATE, breakfast!.id, product)
    await saveTemplate({
      name: 'Утро',
      categoryId: breakfast!.id,
      items: [{ name: 'Йогурт', weight: 125, unit: 'г' }],
    })

    const backup = await exportBackup()
    // копия через JSON — как при записи в файл и чтении из него
    const roundTripped = JSON.parse(JSON.stringify(backup)) as unknown

    await db.delete()
    await db.open()
    await importBackup(roundTripped)

    expect(await listProducts()).toHaveLength(1)
    expect((await getDay(DATE)).meals[0]!.items[0]!.name).toBe('Йогурт')
    expect(await listTemplates()).toHaveLength(1)
    // импорт заменяет данные целиком, включая категории
    expect(await listCategories()).toHaveLength(3)
  })

  it('отклоняет чужой или битый файл', async () => {
    await expect(importBackup({ hello: 'world' })).rejects.toThrow()
    await expect(importBackup(null)).rejects.toThrow()
    await expect(importBackup('строка')).rejects.toThrow()
  })
})
