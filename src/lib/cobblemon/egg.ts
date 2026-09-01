export const EGG_CLICKS = 7
export const EGG_CLICK_WINDOW_MS = 2000
/** Legacy key; unlock is session-only and this is only removed on boot. */
export const EGG_STORAGE_KEY = "pokestats:cobblemonEgg"
export const EGG_SLOT_KEY = "pokestats:cobblemonSlot"

export function nextLogoClicks(count: number, lastAt: number, now: number, windowMs = EGG_CLICK_WINDOW_MS): number {
  if (count <= 0 || now - lastAt > windowMs) return 1
  return count + 1
}

export function parsePartySlot(raw: string | null): number {
  const n = raw ? Number(raw) : 1
  if (!Number.isInteger(n) || n < 1 || n > 6) return 1
  return n
}
