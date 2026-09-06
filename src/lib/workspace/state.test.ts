import { describe, expect, it } from "vitest"
import {
  activateTab,
  closeTab,
  createInitialState,
  currentLocation,
  findHref,
  goBack,
  goForward,
  hrefOf,
  jumpToEntry,
  openTab,
  pushInTab,
  replaceInTab,
  resolveHistoryNavigation,
  parseWorkspaceSnapshot,
  serializeWorkspace,
  snapshotFromHref,
} from "./state"

const dex = { pathname: "/", search: "" }
const formX = { pathname: "/form/pikachu", search: "" }
const formY = { pathname: "/form/charizard", search: "" }
const compare = { pathname: "/compare", search: "?ids=pikachu,charizard" }
const dexFire = { pathname: "/", search: "?types=Fire" }

describe("createInitialState", () => {
  it("starts with a single tab at the given location", () => {
    const s = createInitialState(dex)
    expect(s.tabs).toHaveLength(1)
    expect(s.activeId).toBe("tab-1")
    expect(currentLocation(s)).toEqual(dex)
  })
})

describe("pushInTab / goBack / goForward", () => {
  it("backs from a Type hub to Teams analysis with search intact", () => {
    const teamsAnalysis = { pathname: "/teams", search: "?tab=analysis" }
    let s = createInitialState(teamsAnalysis)
    s = pushInTab(s, { pathname: "/types/Fire", search: "" })
    s = goBack(s)
    expect(currentLocation(s)).toEqual(teamsAnalysis)
  })

  it("pushes a new entry and back restores the previous", () => {
    let s = createInitialState(dex)
    s = pushInTab(s, formX)
    expect(currentLocation(s)).toEqual(formX)
    s = goBack(s)
    expect(currentLocation(s)).toEqual(dex)
    s = goForward(s)
    expect(currentLocation(s)).toEqual(formX)
  })

  it("push after back drops the discarded forward entries", () => {
    let s = createInitialState(dex)
    s = pushInTab(s, formX)
    s = goBack(s)
    s = pushInTab(s, formY)
    expect(currentLocation(s)).toEqual(formY)
    s = goForward(s)
    expect(currentLocation(s)).toEqual(formY)
    s = goBack(s)
    expect(currentLocation(s)).toEqual(dex)
  })

  it("ignores a push to the same location", () => {
    const s = pushInTab(createInitialState(dex), dex)
    expect(s.tabs[0]!.entries).toHaveLength(1)
  })

  it("goBack at the start is a no-op", () => {
    const s = createInitialState(dex)
    expect(goBack(s)).toBe(s)
  })
})

describe("replaceInTab", () => {
  it("overwrites the current entry without growing the stack", () => {
    let s = createInitialState(dex)
    s = replaceInTab(s, dexFire)
    expect(s.tabs[0]!.entries).toHaveLength(1)
    expect(currentLocation(s)).toEqual(dexFire)
  })
})

describe("openTab", () => {
  it("inserts after the active tab without focusing it", () => {
    let s = createInitialState(dex)
    s = openTab(s, formX)
    expect(s.tabs.map((t) => t.id)).toEqual(["tab-1", "tab-2"])
    expect(s.activeId).toBe("tab-1")
    expect(currentLocation(s)).toEqual(dex)
    expect(s.tabs[1]!.entries[0]).toEqual(formX)
  })

  it("keeps inserting after the still-active tab", () => {
    let s = createInitialState(dex)
    s = openTab(s, formX)
    s = openTab(s, formY)
    expect(s.tabs.map((t) => t.id)).toEqual(["tab-1", "tab-3", "tab-2"])
    expect(s.activeId).toBe("tab-1")
    expect(currentLocation(s)).toEqual(dex)
  })

  it("focuses the new tab when asked", () => {
    let s = createInitialState(formX)
    s = openTab(s, dex, true)
    expect(s.activeId).toBe("tab-2")
    expect(currentLocation(s)).toEqual(dex)
  })
})

describe("closeTab", () => {
  it("closing a non-active tab leaves the active tab alone", () => {
    let s = createInitialState(dex)
    s = openTab(s, formX)
    s = closeTab(s, "tab-2", dex)
    expect(s.activeId).toBe("tab-1")
    expect(s.tabs).toHaveLength(1)
    expect(currentLocation(s)).toEqual(dex)
  })

  it("closing the active tab focuses the right neighbor", () => {
    let s = createInitialState(dex)
    s = openTab(s, formX)
    s = openTab(s, formY)
    s = activateTab(s, "tab-3")
    s = closeTab(s, "tab-3", dex)
    expect(s.activeId).toBe("tab-2")
    expect(currentLocation(s)).toEqual(formX)
  })

  it("closing the last tab resets it to the fallback location", () => {
    let s = createInitialState(formX)
    s = closeTab(s, "tab-1", dex)
    expect(s.tabs).toHaveLength(1)
    expect(s.activeId).toBe("tab-1")
    expect(currentLocation(s)).toEqual(dex)
    expect(s.tabs[0]!.index).toBe(0)
  })
})

describe("href helpers", () => {
  it("parses path and search from an href", () => {
    expect(snapshotFromHref("https://x.example/compare?ids=a,b")).toEqual({ pathname: "/compare", search: "?ids=a,b" })
    expect(hrefOf(compare)).toBe("/compare?ids=pikachu,charizard")
  })
})

describe("session restore", () => {
  it("round-trips three tabs (Moves, Dex, Compare) with filters intact", () => {
    let s = createInitialState({ pathname: "/", search: "?types=Fire" })
    s = openTab(s, { pathname: "/moves", search: "?type=Fire" }, true)
    s = openTab(s, compare, true)
    const restored = parseWorkspaceSnapshot(serializeWorkspace(s), dex)
    expect(restored).not.toBeNull()
    expect(restored!.tabs).toHaveLength(3)
    expect(restored!.activeId).toBe(s.activeId)
    expect(restored!.tabs.map((t) => hrefOf(t.entries[t.index]!))).toEqual([
      "/?types=Fire",
      "/moves?type=Fire",
      "/compare?ids=pikachu,charizard",
    ])
  })

  it("keeps per-tab back history", () => {
    let s = createInitialState(dex)
    s = pushInTab(s, formX)
    const restored = parseWorkspaceSnapshot(serializeWorkspace(s), dex)!
    expect(restored.tabs[0]!.entries).toHaveLength(2)
    expect(currentLocation(restored)).toEqual(formX)
  })

  it("falls back on missing, corrupt or unusable snapshots", () => {
    expect(parseWorkspaceSnapshot(null, dex)).toBeNull()
    expect(parseWorkspaceSnapshot("not-json", dex)).toBeNull()
    expect(parseWorkspaceSnapshot(JSON.stringify({ v: 999, tabs: [] }), dex)).toBeNull()
    expect(parseWorkspaceSnapshot(JSON.stringify({ v: 1, tabs: [], activeId: "tab-1", seq: 1 }), dex)).toBeNull()
  })

  it("drops invalid entries and fixes the active tab", () => {
    const raw = JSON.stringify({
      v: 1,
      activeId: "tab-gone",
      seq: 2,
      tabs: [
        { id: "tab-1", index: 5, entries: [{ pathname: "/moves", search: "?type=Fire" }, { pathname: "nope", search: "" }] },
        { id: "tab-2", index: 0, entries: [] },
      ],
    })
    const restored = parseWorkspaceSnapshot(raw, dex)!
    expect(restored.tabs).toHaveLength(1)
    expect(restored.activeId).toBe("tab-1")
    expect(currentLocation(restored)).toEqual({ pathname: "/moves", search: "?type=Fire" })
  })

  it("never reuses tab ids after restore", () => {
    let s = createInitialState(dex)
    s = openTab(s, formX, true)
    const restored = parseWorkspaceSnapshot(serializeWorkspace(s), dex)!
    const next = openTab(restored, formY, true)
    const ids = next.tabs.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(next.activeId).not.toBe("tab-1")
    expect(next.activeId).not.toBe("tab-2")
  })
})

describe("findHref / jumpToEntry", () => {
  it("prefers the active tab and the entry behind for back", () => {
    let s = createInitialState(dex)
    s = pushInTab(s, formX)
    // Another tab also holds dex: the active tab still wins.
    s = openTab(s, dex)
    const found = findHref(s, hrefOf(dex), "back")
    expect(found).toEqual({ tabId: "tab-1", index: 0 })
  })

  it("prefers the entry ahead for forward", () => {
    let s = createInitialState(formX)
    s = pushInTab(s, dex)
    s = goBack(s)
    s = openTab(s, dex)
    const found = findHref(s, hrefOf(dex), "forward")
    expect(found).toEqual({ tabId: "tab-1", index: 1 })
  })

  it("returns null when no tab holds the href", () => {
    expect(findHref(createInitialState(dex), hrefOf(formY), "back")).toBeNull()
  })

  it("jumpToEntry rejects unknown tabs and out-of-range indexes", () => {
    const s = createInitialState(dex)
    expect(jumpToEntry(s, "tab-gone", 0)).toBe(s)
    expect(jumpToEntry(s, "tab-1", 7)).toBe(s)
    expect(jumpToEntry(s, "tab-1", 0)).toBe(s)
    const moved = jumpToEntry(pushInTab(s, formX), "tab-1", 0)
    expect(currentLocation(moved)).toEqual(dex)
  })
})

describe("resolveHistoryNavigation", () => {
  it("is a no-op when the router already shows the workspace location", () => {
    const s = pushInTab(createInitialState(dex), formX)
    expect(resolveHistoryNavigation(s, dex, formX, "traverse-back")).toEqual({ state: null, navigateHref: null })
  })

  it("pushes cross-path link clicks and replaces same-path filter edits", () => {
    const s = createInitialState(dex)
    const cross = resolveHistoryNavigation(s, dex, compare, "navigate")
    expect(cross.navigateHref).toBeNull()
    expect(currentLocation(cross.state!)).toEqual(compare)
    expect(cross.state!.tabs[0]!.entries).toHaveLength(2)
    const same = resolveHistoryNavigation(s, dex, dexFire, "navigate")
    expect(same.navigateHref).toBeNull()
    expect(same.state!.tabs[0]!.entries).toHaveLength(1)
    expect(currentLocation(same.state!)).toEqual(dexFire)
  })

  it("jumps to the matching entry on traverse-back (Compare -> Dex -> Mouse4)", () => {
    let s = createInitialState(compare)
    s = pushInTab(s, dex)
    const res = resolveHistoryNavigation(s, dex, compare, "traverse-back")
    expect(res.navigateHref).toBeNull()
    expect(currentLocation(res.state!)).toEqual(compare)
  })

  it("retargets workspace-back when the popped entry is stale", () => {
    let s = createInitialState(compare)
    s = pushInTab(s, dex)
    const res = resolveHistoryNavigation(s, dex, formY, "traverse-back")
    expect(res.navigateHref).toBe(hrefOf(compare))
    expect(currentLocation(res.state!)).toEqual(compare)
  })

  it("re-traps at the bottom instead of leaving the app", () => {
    const s = createInitialState(dex)
    const res = resolveHistoryNavigation(s, dex, formX, "traverse-back")
    expect(res.state).toBeNull()
    expect(res.navigateHref).toBe(hrefOf(dex))
  })

  it("jumps forward on traverse-forward", () => {
    let s = createInitialState(dex)
    s = pushInTab(s, formX)
    s = goBack(s)
    const res = resolveHistoryNavigation(s, dex, formX, "traverse-forward")
    expect(res.navigateHref).toBeNull()
    expect(currentLocation(res.state!)).toEqual(formX)
  })
})
