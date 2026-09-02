import type { DexGeneration } from "@/lib/domain/types"

export type BookmarkRef =
  | { kind: "form"; formId: string }
  | { kind: "move"; moveId: string }
  | { kind: "type"; typeId: string }
  | { kind: "set"; formId: string; dexGen: DexGeneration; formatId: string; name: string }

export type Bookmark = BookmarkRef & { savedAt: number }

export const BOOKMARKS_KEY = "pokestats:bookmarks"

const KINDS = new Set(["form", "move", "type", "set"])

export function bookmarkKey(ref: BookmarkRef): string {
  switch (ref.kind) {
    case "form":
      return `form:${ref.formId}`
    case "move":
      return `move:${ref.moveId}`
    case "type":
      return `type:${ref.typeId}`
    case "set":
      return `set:${ref.formId}:${ref.dexGen}:${ref.formatId}:${ref.name}`
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0
}

function parseOne(raw: unknown): Bookmark | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (!KINDS.has(o.kind as string)) return null
  const savedAt = typeof o.savedAt === "number" && Number.isFinite(o.savedAt) ? o.savedAt : 0
  if (o.kind === "form" && isNonEmptyString(o.formId)) return { kind: "form", formId: o.formId, savedAt }
  if (o.kind === "move" && isNonEmptyString(o.moveId)) return { kind: "move", moveId: o.moveId, savedAt }
  if (o.kind === "type" && isNonEmptyString(o.typeId)) return { kind: "type", typeId: o.typeId, savedAt }
  if (
    o.kind === "set" &&
    isNonEmptyString(o.formId) &&
    isNonEmptyString(o.dexGen) &&
    isNonEmptyString(o.formatId) &&
    isNonEmptyString(o.name)
  ) {
    return {
      kind: "set",
      formId: o.formId,
      dexGen: o.dexGen as DexGeneration,
      formatId: o.formatId,
      name: o.name,
      savedAt,
    }
  }
  return null
}

export function parseBookmarks(raw: string | null): Bookmark[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items : null
    if (!items) return []
    const out: Bookmark[] = []
    const seen = new Set<string>()
    for (const row of items) {
      const b = parseOne(row)
      if (!b) continue
      const k = bookmarkKey(b)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(b)
    }
    return out
  } catch {
    return []
  }
}

export function serializeBookmarks(items: Bookmark[]): string {
  return JSON.stringify({ v: 1, items })
}

export function bookmarkKeySet(items: Bookmark[]): Set<string> {
  return new Set(items.map(bookmarkKey))
}

export function hasBookmark(items: Bookmark[], ref: BookmarkRef): boolean {
  const k = bookmarkKey(ref)
  return items.some((b) => bookmarkKey(b) === k)
}

export function toggleBookmark(items: Bookmark[], ref: BookmarkRef, now = Date.now()): Bookmark[] {
  const k = bookmarkKey(ref)
  if (items.some((b) => bookmarkKey(b) === k)) return items.filter((b) => bookmarkKey(b) !== k)
  return [{ ...ref, savedAt: now }, ...items]
}
