import { describe, expect, it } from "vitest"
import { EGG_CLICKS, nextLogoClicks, parsePartySlot } from "./egg"

describe("nextLogoClicks", () => {
  it("starts a new streak after the window and unlocks on the 7th click", () => {
    let n = 0
    let t = 1000
    for (let i = 0; i < EGG_CLICKS - 1; i++) {
      n = nextLogoClicks(n, t, t + 100)
      t += 100
    }
    expect(n).toBe(6)
    expect(nextLogoClicks(n, t, t + 3000)).toBe(1)
    n = 0
    t = 0
    for (let i = 0; i < EGG_CLICKS; i++) {
      n = nextLogoClicks(n, t, t + 50)
      t += 50
    }
    expect(n).toBe(7)
  })
})

describe("parsePartySlot", () => {
  it("defaults and clamps to 1..6", () => {
    expect(parsePartySlot(null)).toBe(1)
    expect(parsePartySlot("3")).toBe(3)
    expect(parsePartySlot("0")).toBe(1)
    expect(parsePartySlot("7")).toBe(1)
  })
})
