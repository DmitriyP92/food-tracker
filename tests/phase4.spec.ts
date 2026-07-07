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

  // крестик сбрасывает запрос
  await page.getByRole('button', { name: 'Очистить поиск' }).click()
  await expect(page.getByLabel('Поиск по библиотеке')).toHaveValue('')
  await expect(page.getByText('Творог нежирный')).toBeVisible()
})

test('перетаскивание категории: «Второй завтрак» встаёт после Завтрака', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: '＋ Категория' }).click()
  await page.getByLabel('Название категории').fill('Второй завтрак')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  const dayPanel = page.getByRole('region', { name: 'Дневник дня' })
  await expect(dayPanel.locator('h3')).toHaveText(['Завтрак', 'Обед', 'Ужин', 'Второй завтрак'])

  // тащим за ручку вверх, на позицию сразу под Завтраком
  const handle = page.getByRole('button', { name: 'Переместить категорию: Второй завтрак' })
  const target = dayPanel.getByRole('region', { name: 'Обед', exact: true })
  const handleBox = (await handle.boundingBox())!
  const targetBox = (await target.boundingBox())!

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 15,
  })
  await page.mouse.up()

  await expect(dayPanel.locator('h3')).toHaveText(['Завтрак', 'Второй завтрак', 'Обед', 'Ужин'])

  // порядок сохранился после перезагрузки
  await page.reload()
  await expect(dayPanel.locator('h3')).toHaveText(['Завтрак', 'Второй завтрак', 'Обед', 'Ужин'])
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
