import { describe, expect, it } from "vitest"
import { bookmarkKey, hasBookmark, parseBookmarks, serializeBookmarks, toggleBookmark, type Bookmark } from "./store"

const form = { kind: "form" as const, formId: "slaking" }
const move = { kind: "move" as const, moveId: "earthquake" }
const typ = { kind: "type" as const, typeId: "Ground" }
const set = { kind: "set" as const, formId: "slaking", dexGen: "sv" as const, formatId: "ou", name: "Choice Band" }

describe("bookmarkKey", () => {
  it("distinguishes kinds that share an id string", () => {
    expect(bookmarkKey(form)).not.toBe(bookmarkKey({ kind: "move", moveId: "slaking" }))
    expect(bookmarkKey(set)).toBe("set:slaking:sv:ou:Choice Band")
  })
})

describe("parseBookmarks", () => {
  it("returns empty on null, junk, and malformed JSON", () => {
    expect(parseBookmarks(null)).toEqual([])
    expect(parseBookmarks("nope")).toEqual([])
    expect(parseBookmarks('{"v":1}')).toEqual([])
  })

  it("accepts the versioned envelope and a bare array, dropping invalid rows and dupes", () => {
    const items = parseBookmarks(
      JSON.stringify({
        v: 1,
        items: [
          { kind: "form", formId: "slaking", savedAt: 10 },
          { kind: "form", formId: "slaking", savedAt: 99 },
          { kind: "move" },
          { kind: "set", formId: "slaking", dexGen: "sv", formatId: "ou", name: "Band" },
        ],
      }),
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({ kind: "form", formId: "slaking", savedAt: 10 })
    expect(items[1]!.kind).toBe("set")
    expect(parseBookmarks(JSON.stringify([{ kind: "type", typeId: "Fire", savedAt: 1 }]))).toEqual([
      { kind: "type", typeId: "Fire", savedAt: 1 },
    ])
  })
})

describe("toggleBookmark", () => {
  it("adds newest-first and removes by natural key", () => {
    let items: Bookmark[] = []
    items = toggleBookmark(items, form, 1)
    items = toggleBookmark(items, move, 2)
    expect(items.map(bookmarkKey)).toEqual(["move:earthquake", "form:slaking"])
    expect(hasBookmark(items, form)).toBe(true)
    items = toggleBookmark(items, form, 3)
    expect(hasBookmark(items, form)).toBe(false)
    expect(items).toHaveLength(1)
  })
})

describe("serializeBookmarks", () => {
  it("round-trips through parse", () => {
    const items = toggleBookmark([], typ, 5)
    expect(parseBookmarks(serializeBookmarks(items))).toEqual(items)
  })
})
