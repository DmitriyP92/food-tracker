import { useRef, useState } from 'react'
import { exportBackup, importBackup } from '../../db/db'
import { todayISO } from '../day/date'
import styles from './BackupDialog.module.css'

interface Props {
  onClose: () => void
}

/**
 * Резервная копия: экспорт/импорт всех данных в JSON-файл.
 * Защита от очистки хранилища Safari при долгом неиспользовании PWA
 * (CLAUDE.md, PRD §10.6). Импорт ПОЛНОСТЬЮ заменяет текущие данные.
 */
export function BackupDialog({ onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

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

  const handleImport = async (file: File) => {
    const confirmed = window.confirm(
      'Импорт заменит ВСЕ текущие данные (библиотеку, дневник, шаблоны). Продолжить?',
    )
    if (!confirmed) return
    try {
      const data: unknown = JSON.parse(await file.text())
      await importBackup(data)
      setStatus({ kind: 'ok', text: 'Данные восстановлены из резервной копии.' })
    } catch (e) {
      setStatus({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Не удалось импортировать файл.',
      })
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
          Данные живут только на этом устройстве. Safari может удалить их, если приложение долго не
          открывать, — время от времени сохраняйте копию в файл.
        </p>

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
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />
        </div>

        {status && (
          <p className={status.kind === 'ok' ? styles.ok : styles.error}>{status.text}</p>
        )}
      </div>
    </div>
  )
}
