import { expect, test } from '@playwright/test'

/**
 * Сквозной сценарий MVP (Фаза 1): добавить продукт в библиотеку,
 * добавить его в завтрак тапом через шторку, проверить итоги,
 * поправить вес, убрать и убедиться в автосохранении при навигации.
 */
test('продукт → завтрак → итоги → правка веса → автосохранение', async ({ page }) => {
  await page.goto('./')

  // US-1: добавить продукт
  await page.getByRole('button', { name: '＋ Продукт' }).click()
  await page.getByLabel('Название продукта').fill('Гречка')
  await page.getByLabel('Вес по умолчанию').fill('100')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await expect(page.getByText('Гречка')).toBeVisible()

  // US-6/7: тап-добавление в завтрак через шторку
  await page.getByRole('button', { name: '＋ Добавить' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Добавить в: Завтрак' })
  await sheet.getByRole('button', { name: /Гречка/ }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()

  // US-10: итоги приёма и дня
  const breakfast = page.getByRole('region', { name: 'Завтрак' })
  await expect(breakfast.getByText('100 г')).toBeVisible()
  await expect(page.getByText('Итого за день')).toBeVisible()

  // US-8: правка веса в дне
  await breakfast.getByLabel('Вес: Гречка').fill('150')
  await breakfast.getByLabel('Вес: Гречка').blur()
  await expect(breakfast.getByText('150 г')).toBeVisible()

  // US-11/23: автосохранение — уход на другой день и возврат не теряет данные
  await page.getByRole('button', { name: 'Предыдущий день' }).click()
  await expect(breakfast.getByText('Пусто', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Сегодня' }).click()
  await expect(breakfast.getByLabel('Вес: Гречка')).toHaveValue('150')

  // US-9: убрать продукт из приёма
  await breakfast.getByRole('button', { name: 'Убрать: Гречка' }).click()
  await expect(breakfast.getByLabel('Вес: Гречка')).toHaveCount(0)
})
