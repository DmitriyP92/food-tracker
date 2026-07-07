/** Итоги по весу (US-10). КБЖУ и калории — вне скоупа (PRD §4). */
import type { Day, Meal } from '../../types/models'

export function mealTotal(meal: Meal | undefined): number {
  if (!meal) return 0
  return meal.items.reduce((sum, item) => sum + item.weight, 0)
}

export function dayTotal(day: Day | null | undefined): number {
  if (!day) return 0
  return day.meals.reduce((sum, meal) => sum + mealTotal(meal), 0)
}
