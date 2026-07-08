import { useRef, useState } from 'react'
import { exportBackup, importBackup, mergeBackup } from '../../db/db'
import type { MergeReport } from '../../types/models'
import { todayISO } from '../day/date'
import styles from './BackupDialog.module.css'

interface Props {
  onClose: () => void
}

interface PendingImport {
  fileName: string
  data: unknown
}

interface Status {
  kind: 'ok' | 'error'
  text: string
  details?: string[]
}

function formatMergeReport(report: MergeReport): string[] {
  return [
    `Дни: добавлено ${report.days.added}, обновлено ${report.days.updated}, без изменений ${report.days.kept}`,
    `Продукты: добавлено ${report.products.added}, обновлено ${report.products.updated}, без изменений ${report.products.kept}`,
    `Категории: добавлено ${report.categories.added}, без изменений ${report.categories.kept}`,
    `Шаблоны: добавлено ${report.templates.added}, без изменений ${report.templates.kept}` +
      (report.templates.skipped > 0
        ? `, пропущено ${report.templates.skipped} (лимит 10 на категорию)`
        : ''),
  ]
}

/**
 * Резервная копия и перенос между устройствами (US-28).
 * Экспорт — JSON-файл через share sheet (сохраняется в iCloud Drive → «Файлы»);
 * импорт — «Объединить» (перенос, ничего не удаляет) или «Заменить всё»
 * (восстановление из бэкапа).
 */
export function BackupDialog({ onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)

  const handleExport = async () => {
    try {
      const backup = await exportBackup()
      const json = JSON.stringify(backup, null, 2)
      const file = new File([json], `food-tracker-backup-${todayISO()}.json`, {
        type: 'application/json',
      })

      // iOS Safari/PWA не умеет скачивать blob-ссылки — там файл отдаём
      // через системное меню «Поделиться» (можно сохранить в «Файлы»)
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
          setStatus({ kind: 'ok', text: 'Резервная копия передана в меню «Поделиться».' })
          return
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return // пользователь передумал
          // share не сработал — пробуем обычное скачивание ниже
        }
      }

      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
      setStatus({ kind: 'ok', text: 'Файл резервной копии сохранён.' })
    } catch {
      setStatus({ kind: 'error', text: 'Не удалось создать резервную копию.' })
    }
  }

  const handleFileSelected = async (file: File) => {
    setStatus(null)
    try {
      const data: unknown = JSON.parse(await file.text())
      setPending({ fileName: file.name, data })
    } catch {
      setStatus({ kind: 'error', text: 'Не удалось прочитать файл.' })
    }
  }

  const runMerge = async () => {
    if (!pending) return
    try {
      const report = await mergeBackup(pending.data)
      setStatus({
        kind: 'ok',
        text: 'Объединение завершено.',
        details: formatMergeReport(report),
      })
    } catch (e) {
      setStatus({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Не удалось импортировать файл.',
      })
    } finally {
      setPending(null)
    }
  }

  const runReplace = async () => {
    if (!pending) return
    const confirmed = window.confirm(
      'Импорт заменит ВСЕ текущие данные (библиотеку, дневник, шаблоны). Продолжить?',
    )
    if (!confirmed) return
    try {
      await importBackup(pending.data)
      setStatus({ kind: 'ok', text: 'Данные восстановлены из резервной копии.' })
    } catch (e) {
      setStatus({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Не удалось импортировать файл.',
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-label="Резервная копия"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Резервная копия</h2>
          <button type="button" className={styles.close} aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>

        <p className={styles.hint}>
          Данные живут только на этом устройстве. Сохраняйте копию в файл — это и защита от очистки
          Safari, и перенос на другое устройство: сохраните файл в iCloud Drive («Файлы»), а там
          откройте импорт и выберите «Объединить».
        </p>

        {pending ? (
          <div className={styles.modeChooser} role="group" aria-label="Режим импорта">
            <p className={styles.modeTitle}>
              Файл «{pending.fileName}». Как импортировать?
            </p>
            <button type="button" className={styles.primary} onClick={() => void runMerge()}>
              Объединить
            </button>
            <p className={styles.modeHint}>
              Перенос с другого устройства: локальные записи сохраняются, данные из файла
              добавляются к ним.
            </p>
            <button type="button" className={styles.dangerButton} onClick={() => void runReplace()}>
              Заменить всё
            </button>
            <p className={styles.modeHint}>
              Восстановление из бэкапа: все текущие данные будут заменены содержимым файла.
            </p>
            <button type="button" onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void handleExport()}>
              Экспорт в файл
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Импорт из файла
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className={styles.fileInput}
              aria-label="Файл резервной копии"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileSelected(file)
                e.target.value = ''
              }}
            />
          </div>
        )}

        {status && (
          <div className={status.kind === 'ok' ? styles.ok : styles.error}>
            <p className={styles.statusText}>{status.text}</p>
            {status.details && (
              <ul className={styles.details}>
                {status.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
