/**
 * Showdown import/export for Teams. Export resolves each slot's referenced
 * Set and falls back to the best-ranked one; import matches pasted entries
 * back to Forms and Sets by name.
 */
import type { LoadedDataset } from "@/lib/dataset/load"
import { GEN_RANK, resolveSlotSet } from "@/lib/domain/teamSets"
import type { Form, Set, Team, TeamSlot } from "@/lib/domain/types"
import { formatSpread } from "@/lib/utils"

export { GEN_RANK }

export function buildShowdownExport(team: Team, data: LoadedDataset): string {
  const out: string[] = [`=== ${team.name} ===`]
  for (const slot of team.slots) {
    if (!slot) continue
    const form = data.formsById.get(slot.formId)
    if (!form) {
      out.push(`${slot.formId} (unresolved)`, "")
      continue
    }
    const s = resolveSlotSet(slot, data.setsByFormId.get(form.id) ?? [])
    if (!s) {
      out.push(form.name, "")
      continue
    }
    const evLines = formatSpread(s.evs)
    out.push(
      [
        `${form.name}${s.item ? ` @ ${s.item}` : ""}`,
        s.ability ? `Ability: ${s.ability}` : null,
        evLines ? `EVs: ${evLines}` : null,
        s.nature ? `${s.nature} Nature` : null,
        s.teraType && s.dexGen === "sv" ? `Tera Type: ${s.teraType}` : null,
        ...s.moves.map((options) => `- ${options.join(" / ")}`),
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
      "",
    )
  }
  return out.join("\n").trimEnd()
}

export interface ParsedTeam {
  name: string | null
  slots: (TeamSlot | null)[]
  /** Entry headers the parser could not match to a Form. */
  warnings: string[]
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

/** First line forms: `Name @ Item`, `Nick (Name) @ Item`, `Nick (Name)`, `Name`. */
function parseHeader(line: string): { species: string; item: string | null } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("===")) return null
  const [head, ...itemRest] = trimmed.split("@")
  const item = itemRest.length ? itemRest.join("@").trim() || null : null
  const name = head!.trim()
  const paren = /\(([^)]+)\)\s*$/.exec(name)
  return { species: paren?.[1]?.trim() || name, item }
}

/**
 * Pastes a Showdown team back into slots. Species match by name (nicknames in
 * parens supported); the Set matches by held item, else the slot keeps no
 * reference and export falls back to the best-ranked Set.
 */
export function parseShowdownTeam(text: string, data: LoadedDataset): ParsedTeam {
  const forms = data.core.forms as Form[]
  const byName = new Map<string, Form>()
  for (const f of forms) {
    if (!byName.has(slug(f.name))) byName.set(slug(f.name), f)
    if (!byName.has(f.id)) byName.set(f.id, f)
  }
  const title = /^===\s*(.+?)\s*===\s*$/.exec(text.trim().split("\n")[0] ?? "")
  const slots: (TeamSlot | null)[] = Array(6).fill(null)
  const warnings: string[] = []
  let idx = 0
  for (const block of text.split(/\n\s*\n/)) {
    const header = parseHeader(block.split("\n")[0] ?? "")
    if (!header) continue
    // Showdown teams cap at six; extra entries warn instead of vanishing.
    if (idx >= 6) {
      warnings.push(header.species)
      continue
    }
    const form = byName.get(slug(header.species))
    if (!form) {
      warnings.push(header.species)
      continue
    }
    let setKey: TeamSlot["setKey"]
    if (header.item) {
      const want = header.item.toLowerCase()
      const hit = (data.setsByFormId.get(form.id) ?? []).find(
        (s: Set) => s.item?.toLowerCase() === want || s.itemOptions?.some((o) => o.toLowerCase() === want),
      )
      if (hit) setKey = { dexGen: hit.dexGen, formatId: hit.formatId, name: hit.name }
    }
    slots[idx] = setKey ? { formId: form.id, setKey } : { formId: form.id }
    idx++
  }
  return { name: title?.[1]?.trim() || null, slots, warnings }
}
