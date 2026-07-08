import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addProduct, db, exportBackup, listProducts } from '../../db/db'
import { BackupDialog } from './BackupDialog'

beforeEach(async () => {
  await db.delete()
  await db.open()
  // jsdom не умеет blob-URL и скачивание — заглушаем
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function makeFile(content: unknown): File {
  return new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' })
}

async function uploadFile(user: ReturnType<typeof userEvent.setup>, content: unknown) {
  await user.upload(screen.getByLabelText('Файл резервной копии'), makeFile(content))
}

describe('BackupDialog', () => {
  it('экспортирует данные в файл (скачивание)', async () => {
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Экспорт в файл' }))

    await screen.findByText('Файл резервной копии сохранён.')
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
  })

  it('экспортирует через системный share, если он доступен (iOS)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { canShare: () => true, share })
    try {
      const user = userEvent.setup()
      render(<BackupDialog onClose={() => undefined} />)

      await user.click(screen.getByRole('button', { name: 'Экспорт в файл' }))

      await screen.findByText('Резервная копия передана в меню «Поделиться».')
      expect(share).toHaveBeenCalledOnce()
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    } finally {
      // navigator общий на файл тестов — убираем share, чтобы не влиять на соседей
      Object.assign(navigator, { canShare: undefined, share: undefined })
    }
  })

  it('после выбора файла предлагает режим: Объединить / Заменить всё / Отмена', async () => {
    const backup = await exportBackup()
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await uploadFile(user, backup)

    await screen.findByText(/Как импортировать/)
    expect(screen.getByRole('button', { name: 'Объединить' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Заменить всё' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
  })

  it('«Объединить» сливает данные и показывает отчёт (US-28)', async () => {
    const product = await addProduct({ name: 'С iPad', defaultWeight: 50, unit: 'г' })
    const backup = await exportBackup()
    await db.products.clear()
    await addProduct({ name: 'Локальный', defaultWeight: 100, unit: 'г' })

    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await uploadFile(user, backup)
    await user.click(await screen.findByRole('button', { name: 'Объединить' }))

    await screen.findByText('Объединение завершено.')
    await screen.findByText(/Продукты: добавлено 1/)
    // оба продукта на месте — ничего не удалено
    const products = await listProducts()
    expect(products.map((p) => p.name).sort()).toEqual(['Локальный', 'С iPad'])
    expect(products.some((p) => p.id === product.id)).toBe(true)
  })

  it('«Заменить всё» после подтверждения восстанавливает данные', async () => {
    await addProduct({ name: 'Старый продукт', defaultWeight: 100, unit: 'г' })
    const backup = await exportBackup()
    await db.products.clear()
    await addProduct({ name: 'Лишний', defaultWeight: 1, unit: 'г' })

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await uploadFile(user, backup)
    await user.click(await screen.findByRole('button', { name: 'Заменить всё' }))

    await screen.findByText('Данные восстановлены из резервной копии.')
    const products = await listProducts()
    expect(products.map((p) => p.name)).toEqual(['Старый продукт'])
  })

  it('«Заменить всё» без подтверждения ничего не делает', async () => {
    const backup = await exportBackup()
    await addProduct({ name: 'Не должен исчезнуть', defaultWeight: 100, unit: 'г' })

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await uploadFile(user, backup)
    await user.click(await screen.findByRole('button', { name: 'Заменить всё' }))

    await waitFor(async () => expect(await listProducts()).toHaveLength(1))
    // выбор режима остаётся открытым
    expect(screen.getByRole('button', { name: 'Объединить' })).toBeInTheDocument()
  })

  it('«Отмена» закрывает выбор режима без изменений', async () => {
    await addProduct({ name: 'Локальный', defaultWeight: 100, unit: 'г' })
    const backup = await exportBackup()

    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await uploadFile(user, backup)
    await user.click(await screen.findByRole('button', { name: 'Отмена' }))

    expect(screen.queryByText(/Как импортировать/)).not.toBeInTheDocument()
    expect(await listProducts()).toHaveLength(1)
  })

  it('отклоняет чужой файл с ошибкой в обоих режимах', async () => {
    const user = userEvent.setup()
    render(<BackupDialog onClose={() => undefined} />)

    await uploadFile(user, { something: 'else' })
    await user.click(await screen.findByRole('button', { name: 'Объединить' }))

    await screen.findByText('Файл не является резервной копией Food Tracker')
  })
})
