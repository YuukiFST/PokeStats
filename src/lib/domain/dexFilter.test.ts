import { describe, expect, it } from "vitest"
import { formMatchesSelectedTypes } from "./dexFilter"

describe("formMatchesSelectedTypes", () => {
  it("matches every Form when no types are selected", () => {
    expect(formMatchesSelectedTypes(["Dark"], new Set())).toBe(true)
  })

  it("matches a Form that has the single selected type", () => {
    expect(formMatchesSelectedTypes(["Fire", "Fighting"], new Set(["Fighting"]))).toBe(true)
  })

  it("rejects a Form that lacks the single selected type", () => {
    expect(formMatchesSelectedTypes(["Dark"], new Set(["Fighting"]))).toBe(false)
  })

  it("requires every selected type on the Form, not any of them", () => {
    const both = new Set(["Dark", "Fighting"])
    expect(formMatchesSelectedTypes(["Dark"], both)).toBe(false)
    expect(formMatchesSelectedTypes(["Fighting", "Ghost"], both)).toBe(false)
    expect(formMatchesSelectedTypes(["Fire", "Fighting"], both)).toBe(false)
    expect(formMatchesSelectedTypes(["Dark", "Fighting"], both)).toBe(true)
  })
})