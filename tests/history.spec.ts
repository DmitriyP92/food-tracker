import { expect, test } from '@playwright/test'

/**
 * Фаза 3: наполнить вчерашний день, вернуться на сегодня,
 * «Скопировать вчера», затем скопировать продукт из истории тапом,
 * и прыгнуть на произвольную дату через календарь.
 */
test('копирование вчера, история и календарь', async ({ page }) => {
  await page.goto('./')

  // подготовить вчерашний завтрак
  await page.getByRole('button', { name: '＋ Продукт' }).click()
  await page.getByLabel('Название продукта').fill('Овсянка')
  await page.getByLabel('Вес по умолчанию').fill('60')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  await page.getByRole('button', { name: 'Предыдущий день' }).click()
  const breakfast = page.getByRole('region', { name: 'Завтрак', exact: true })
  await breakfast.getByRole('button', { name: '＋ Добавить' }).click()
  const sheet = page.getByRole('dialog', { name: 'Добавить в: Завтрак' })
  await sheet.getByRole('button', { name: /Овсянка/ }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveValue('60')

  // US-26: «Скопировать вчера» на пустом сегодня
  await page.getByRole('button', { name: 'Сегодня' }).click()
  await page.getByRole('button', { name: 'Скопировать вчера' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveValue('60')

  // US-26: копирование продукта из истории тапом (вчера выбрано по умолчанию)
  await page.getByRole('tab', { name: 'История' }).click()
  await page
    .getByRole('button', { name: 'Скопировать в открытый день: Овсянка', exact: true })
    .click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveCount(2)

  // US-22: прыжок на произвольную дату через календарь
  await page.getByLabel('Выбрать дату', { exact: true }).fill('2026-01-15')
  await expect(page.getByRole('region', { name: 'Дневник дня' }).getByText(/15 января/)).toBeVisible()
  await expect(breakfast.getByText('0 г', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Сегодня' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveCount(2)
})
