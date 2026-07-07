import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { applyTemplate, deleteTemplate, listCategories, listTemplates, updateTemplate } from '../../db/db'
import type { Template } from '../../types/models'
import { mealTotal } from '../day/totals'
import styles from './TemplatesPanel.module.css'

interface Props {
  date: string
}

/**
 * Панель шаблонов: применить к открытому дню (US-15), отредактировать
 * состав или удалить (US-17). Сохранение нового шаблона — из приёма пищи.
 */
export function TemplatesPanel({ date }: Props) {
  const categories = useLiveQuery(listCategories, []) ?? []
  const templates = useLiveQuery(() => listTemplates(), []) ?? []

  if (templates.length === 0) {
    return (
      <p className={styles.empty}>
        Шаблонов пока нет. Наполните приём пищи и нажмите «В шаблоны».
      </p>
    )
  }

  return (
    <div className={styles.groups}>
      {categories.map((category) => {
        const list = templates.filter((t) => t.categoryId === category.id)
        if (list.length === 0) return null
        return (
          <section key={category.id} aria-label={`Шаблоны: ${category.name}`}>
            <h3 className={styles.groupTitle}>{category.name}</h3>
            <ul className={styles.list}>
              {list.map((template) => (
                <TemplateCard key={template.id} template={template} date={date} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function TemplateCard({ template, date }: { template: Template; date: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(template.name)
  const [error, setError] = useState<string | null>(null)

  const rename = async () => {
    if (name.trim() === template.name) return
    try {
      await updateTemplate(template.id, { name })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  const removeItem = (index: number) =>
    void updateTemplate(template.id, {
      items: template.items.filter((_, i) => i !== index),
    })

  const total = mealTotal({ categoryId: template.categoryId, items: template.items })

  return (
    <li className={styles.card}>
      {editing ? (
        <div className={styles.edit}>
          <input
            type="text"
            aria-label={`Название шаблона: ${template.name}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void rename()}
          />
          {error && <p className={styles.error}>{error}</p>}
          <ul className={styles.items}>
            {template.items.map((item, index) => (
              <li key={index} className={styles.item}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemWeight}>
                  {item.weight} {item.unit}
                </span>
                <button
                  type="button"
                  className={styles.itemRemove}
                  aria-label={`Убрать из шаблона: ${item.name}`}
                  onClick={() => removeItem(index)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.editActions}>
            <button type="button" onClick={() => setEditing(false)}>
              Готово
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={() => void deleteTemplate(template.id)}
            >
              Удалить шаблон
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.info}>
            <span className={styles.name}>{template.name}</span>
            <span className={styles.summary}>
              {template.items.length} прод. · {total} г
            </span>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.apply}
              onClick={() => void applyTemplate(date, template.id)}
            >
              Применить
            </button>
            <button
              type="button"
              aria-label={`Изменить шаблон: ${template.name}`}
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
          </div>
        </>
      )}
    </li>
  )
}
