import { expect, test } from '@playwright/test'

test('приложение загружается: шапка, навигация по дням, категории из IndexedDB', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page).toHaveTitle('Дневник питания')
  await expect(page.getByRole('heading', { name: 'Дневник питания' })).toBeVisible()
  await expect(page.getByLabel('Выбрать дату', { exact: true })).toBeVisible()

  // дефолтные категории посеяны в IndexedDB и отрисованы
  for (const name of ['Завтрак', 'Обед', 'Ужин']) {
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
  await expect(page.getByText(/Итого за день/)).toBeVisible()
})

test('все три панели присутствуют (библиотека / день / шаблоны)', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('region', { name: 'Библиотека продуктов' })).toBeAttached()
  await expect(page.getByRole('region', { name: 'Дневник дня' })).toBeAttached()
  await expect(page.getByRole('region', { name: 'Шаблоны' })).toBeAttached()
})

test('навигация по датам: вчера и обратно «Сегодня»', async ({ page }) => {
  await page.goto('./')
  const todayButton = page.getByRole('button', { name: 'Сегодня' })
  // на сегодняшнем дне кнопка «Сегодня» не показывается
  await expect(todayButton).toHaveCount(0)

  await page.getByRole('button', { name: 'Предыдущий день' }).click()
  await expect(todayButton).toBeVisible()

  await todayButton.click()
  await expect(todayButton).toHaveCount(0)
})

test('PWA: манифест подключён, service worker регистрируется', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest/)
  const hasServiceWorker = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.ready
    return registration.active !== null
  })
  expect(hasServiceWorker).toBe(true)
})
