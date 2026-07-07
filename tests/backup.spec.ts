import { expect, test } from '@playwright/test'

/** Резервная копия: экспорт в файл и восстановление данных импортом. */
test('экспорт → удаление данных → импорт восстанавливает', async ({ page }) => {
  await page.goto('./')

  // продукт, который поедет в резервную копию
  await page.getByRole('button', { name: '＋ Продукт' }).click()
  await page.getByLabel('Название продукта').fill('Резервный сыр')
  await page.getByLabel('Вес по умолчанию').fill('50')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await expect(page.getByText('Резервный сыр')).toBeVisible()

  // экспорт
  await page.getByRole('button', { name: 'Резервная копия' }).click()
  const dialog = page.getByRole('dialog', { name: 'Резервная копия' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Экспорт в файл' }).click(),
  ])
  const filePath = await download.path()
  expect(download.suggestedFilename()).toMatch(/^food-tracker-backup-.*\.json$/)

  // удалить продукт из библиотеки
  await dialog.getByRole('button', { name: 'Закрыть' }).click()
  await page.getByText('Резервный сыр').click()
  await page.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByText('Резервный сыр')).toHaveCount(0)

  // импорт возвращает данные (подтверждаем replace-диалог)
  page.on('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Резервная копия' }).click()
  await dialog.getByLabel('Файл резервной копии').setInputFiles(filePath)
  await expect(dialog.getByText('Данные восстановлены из резервной копии.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.getByText('Резервный сыр')).toBeVisible()
})
