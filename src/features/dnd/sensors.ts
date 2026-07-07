import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

/**
 * Сенсоры drag & drop (dnd-kit, HTML5 DnD запрещён — см. CLAUDE.md).
 * Мышь: перетаскивание после сдвига на 5px — обычный клик остаётся кликом.
 * Тач: длинное нажатие 250 мс — свайп скроллит список, а не тянет карточку.
 */
export function useAppSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
}
