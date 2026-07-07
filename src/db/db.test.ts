import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_TEMPLATES_PER_CATEGORY,
  addProduct,
  addProductToMeal,
  applyTemplate,
  copyDay,
  db,
  deleteProduct,
  exportBackup,
  getDay,
  getProduct,
  importBackup,
  listCategories,
  listProducts,
  listTemplates,
  removeMealItem,
  saveTemplate,
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
