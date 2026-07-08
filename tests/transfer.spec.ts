import { expect, test } from '@playwright/test'

/**
 * US-28: перенос между устройствами через файл — режим «Объединить».
 * iCloud в E2E не участвует: проверяем файловый цикл экспорт → слияние.
 */
test('перенос: объединение не теряет записей, сделанных после экспорта', async ({ page }) => {
  // экспорт должен идти через скачивание, а не share sheet
  await page.addInitScript(() => {
    Object.assign(navigator, { canShare: undefined, share: undefined })
  })
  await page.goto('./')

  // «устройство A»: продукт + завтрак сегодня
  await page.getByRole('button', { name: '＋ Продукт' }).click()
  await page.getByLabel('Название продукта').fill('Овсянка')
  await page.getByLabel('Вес по умолчанию').fill('60')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  const breakfast = page.getByRole('region', { name: 'Завтрак', exact: true })
  await breakfast.getByRole('button', { name: '＋ Добавить' }).click()
  const sheet = page.getByRole('dialog', { name: 'Добавить в: Завтрак' })
  await sheet.getByRole('button', { name: /Овсянка/ }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()

  // экспорт файла
  await page.getByRole('button', { name: 'Резервная копия' }).click()
  const dialog = page.getByRole('dialog', { name: 'Резервная копия' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Экспорт в файл' }).click(),
  ])
  const filePath = await download.path()
  await dialog.getByRole('button', { name: 'Закрыть' }).click()

  // запись ПОСЛЕ экспорта (критерий 7): вчера — тот же продукт
  await page.getByRole('button', { name: 'Предыдущий день' }).click()
  await breakfast.getByRole('button', { name: '＋ Добавить' }).click()
  await sheet.getByRole('button', { name: /Овсянка/ }).click()
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveValue('60')

  // импорт в режиме «Объединить»
  await page.getByRole('button', { name: 'Резервная копия' }).click()
  await dialog.getByLabel('Файл резервной копии').setInputFiles(filePath)
  await dialog.getByRole('button', { name: 'Объединить' }).click()

  // отчёт о слиянии (критерий 3); сегодня в файле и локально совпадает → без изменений
  await expect(dialog.getByText('Объединение завершено.')).toBeVisible()
  await expect(dialog.getByText(/Дни: добавлено 0, обновлено 0, без изменений 1/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Закрыть' }).click()

  // вчерашняя запись, сделанная после экспорта, цела (критерий 7)
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveValue('60')

  // сегодня тоже на месте, без дублей (критерий 4 — идемпотентность)
  await page.getByRole('button', { name: 'Сегодня' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveCount(1)

  // повторный импорт того же файла ничего не меняет
  await page.getByRole('button', { name: 'Резервная копия' }).click()
  await dialog.getByLabel('Файл резервной копии').setInputFiles(filePath)
  await dialog.getByRole('button', { name: 'Объединить' }).click()
  await expect(dialog.getByText(/Продукты: добавлено 0, обновлено 0, без изменений 1/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Закрыть' }).click()
  await expect(breakfast.getByLabel('Вес: Овсянка')).toHaveCount(1)
})
