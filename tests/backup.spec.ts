import { expect, test } from '@playwright/test'

/** Резервная копия: экспорт в файл и восстановление данных импортом. */
test('экспорт → удаление данных → импорт восстанавливает', async ({ page }) => {
  // выключаем Web Share, чтобы экспорт детерминированно шёл через скачивание
  await page.addInitScript(() => {
    Object.assign(navigator, { canShare: undefined, share: undefined })
  })
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

  // подтверждаем системные confirm-диалоги (удаление, импорт)
  page.on('dialog', (d) => void d.accept())

  // удалить продукт из библиотеки
  await dialog.getByRole('button', { name: 'Закрыть' }).click()
  await page.getByText('Резервный сыр').click()
  await page.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByText('Резервный сыр')).toHaveCount(0)
  // импорт в режиме «Заменить всё» (confirm подтверждается обработчиком выше)
  await page.getByRole('button', { name: 'Резервная копия' }).click()
  await dialog.getByLabel('Файл резервной копии').setInputFiles(filePath)
  await dialog.getByRole('button', { name: 'Заменить всё' }).click()
  await expect(dialog.getByText('Данные восстановлены из резервной копии.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.getByText('Резервный сыр')).toBeVisible()
})
