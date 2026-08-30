import { describe, expect, it } from "vitest"
import {
  activateTab,
  closeTab,
  createInitialState,
  currentLocation,
  goBack,
  goForward,
  hrefOf,
  openTab,
  pushInTab,
  replaceInTab,
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
