/** True when the Form carries every selected type (AND). Empty selection matches all. */
export function formMatchesSelectedTypes(
  formTypes: readonly string[],
  selectedTypes: ReadonlySet<string>,
): boolean {
  if (selectedTypes.size === 0) return true
  for (const tt of selectedTypes) {
    if (!formTypes.includes(tt)) return false
  }
  return true
}