/**
 * Real Showdown Export builder: resolves each Team slot's best Set from the
 * Dataset (latest Dex Gen, OU-family preferred). Falls back to the bare Form
 * name when no Set exists — still a valid Showdown import line.
 */
import type { LoadedDataset } from "@/lib/dataset/load"
import type { Team } from "@/lib/domain/types"
import { formatSpread } from "@/lib/utils"

export const GEN_RANK: Record<string, number> = { rb: 1, gs: 2, rs: 3, dp: 4, bw: 5, xy: 6, sm: 7, ss: 8, sv: 9 }

export function buildShowdownExport(team: Team, data: LoadedDataset): string {
  const out: string[] = [`=== ${team.name} ===`]
  for (const slot of team.slots) {
    if (!slot) continue
    const form = data.formsById.get(slot.formId)
    if (!form) {
      out.push(`${slot.formId} (unresolved)`, "")
      continue
    }
    const sets = data.sets.sets.filter((s) => s.formId === form.id)
    sets.sort((a, b) => {
      const gen = (GEN_RANK[b.dexGen] ?? 0) - (GEN_RANK[a.dexGen] ?? 0)
      if (gen !== 0) return gen
      const ou = (a.formatId.includes("ou") ? -1 : 0) - (b.formatId.includes("ou") ? -1 : 0)
      if (ou !== 0) return ou
      return a.name.localeCompare(b.name)
    })
    const s = sets[0]
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
        ...s.moves.map((slot) => `- ${slot.join(" / ")}`),
      ]
        .filter((l): l is string => l !== null)
        .join("\n"),
      "",
    )
  }
  return out.join("\n").trimEnd()
}
