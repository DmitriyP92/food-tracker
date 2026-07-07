import { expect, test } from '@playwright/test'

/** Фаза 4: поиск по библиотеке (US-5) и пользовательские категории (US-13). */

test('поиск в библиотеке фильтрует по части названия', async ({ page }) => {
  await page.goto('./')

  for (const [name, weight] of [
    ['Творог нежирный', '100'],
    ['Сыр плавленый', '50'],
  ] as const) {
    await page.getByRole('button', { name: '＋ Продукт' }).click()
    await page.getByLabel('Название продукта').fill(name)
    await page.getByLabel('Вес по умолчанию').fill(weight)
    await page.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(page.getByText(name)).toBeVisible()
  }

  await page.getByLabel('Поиск по библиотеке').fill('сыр')
  await expect(page.getByText('Сыр плавленый')).toBeVisible()
  await expect(page.getByText('Творог нежирный')).toHaveCount(0)

  await page.getByLabel('Поиск по библиотеке').fill('')
  await expect(page.getByText('Творог нежирный')).toBeVisible()
})

test('пользовательская категория: добавить, наполнить, удалить', async ({ page }) => {
  await page.goto('./')

  // добавить категорию
  await page.getByRole('button', { name: '＋ Категория' }).click()
  await page.getByLabel('Название категории').fill('Перекус')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  const snack = page.getByRole('region', { name: 'Перекус', exact: true })
  await expect(snack).toBeVisible()

  // наполнить её продуктом
  await page.getByRole('button', { name: '＋ Продукт' }).click()
  await page.getByLabel('Название продукта').fill('Яблоко')
  await page.getByLabel('Вес по умолчанию').fill('150')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await snack.getByRole('button', { name: '＋ Добавить' }).click()
  const sheet = page.getByRole('dialog', { name: 'Добавить в: Перекус' })
  await sheet.getByRole('button', { name: /Яблоко/ }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(snack.getByLabel('Вес: Яблоко')).toHaveValue('150')

  // используемая категория не удаляется
  page.on('dialog', (d) => void d.accept())
  await snack.getByRole('button', { name: 'Удалить категорию: Перекус' }).click()
  await expect(snack.getByText('Категория используется в дневнике')).toBeVisible()

  // после очистки — удаляется
  await snack.getByRole('button', { name: 'Убрать: Яблоко' }).click()
  await snack.getByRole('button', { name: 'Удалить категорию: Перекус' }).click()
  await expect(page.getByRole('region', { name: 'Перекус', exact: true })).toHaveCount(0)
})
