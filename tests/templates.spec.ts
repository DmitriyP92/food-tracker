import { expect, test } from '@playwright/test'

/**
 * Сценарий Фазы 2: наполнить завтрак, сохранить как шаблон,
 * применить шаблон на другом дне как редактируемую копию.
 */
test('сохранить приём как шаблон и применить на другом дне', async ({ page }) => {
  await page.goto('./')

  // наполнить завтрак продуктом из библиотеки
  await page.getByRole('button', { name: '＋ Продукт' }).click()
  await page.getByLabel('Название продукта').fill('Овсянка')
  await page.getByLabel('Вес по умолчанию').fill('60')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  const breakfast = page.getByRole('region', { name: 'Завтрак', exact: true })
  await breakfast.getByRole('button', { name: '＋ Добавить' }).click()
  const sheet = page.getByRole('dialog', { name: 'Добавить в: Завтрак' })
  await sheet.getByRole('button', { name: /Овсянка/ }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()

  // US-14: сохранить как шаблон
  await breakfast.getByRole('button', { name: 'В шаблоны' }).click()
  await page.getByLabel('Название шаблона: Завтрак').fill('Моё утро')
  await breakfast.getByRole('button', { name: 'Сохранить' }).click()

  const templates = page.getByRole('region', { name: 'Шаблоны', exact: true })
  await expect(templates.getByText('Моё утро')).toBeVisible()

  // US-15: применить на другом дне
  await page.getByRole('button', { name: 'Предыдущий день' }).click()
  await expect(breakfast.getByText('0 г', { exact: true })).toBeVisible()
  await templates.getByRole('button', { name: 'Применить' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveValue('60')

  // US-16: дополнение применённой копии не меняет шаблон
  await breakfast.getByLabel('Вес: Овсянка').fill('90')
  await breakfast.getByLabel('Вес: Овсянка').blur()
  await expect(templates.getByText('1 прод. · 60 г')).toBeVisible()
})
