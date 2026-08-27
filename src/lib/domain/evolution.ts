/**
 * Evolution-chain walk over Form-level edges (prevoFormId/evoFormIds) emitted by
 * tools/dataset/build.ts from Showdown's pokedex prevo/evos.
 * Chains connect Forms: regional variants keep their own line (Rattata-Alola ->
 * Raticate-Alola); Megas/Gmax/battle-only transforms carry no edges and appear
 * only as sibling Forms of their Species (CONTEXT.md: they are not evolutions).
 */
import type { Form, FormId, Species } from "@/lib/domain/types"

/**
 * Stages of the evolution line containing `startId`, root first. Each stage holds
 * the branch Forms evolving at that distance (e.g. Eevee's 8 in one stage).
 * Returns [] only when startId is not in the map; any known Form yields >= 1 stage.
 */
export function evolutionStages(startId: FormId, formsById: Map<string, Form>, speciesById: Map<number, Species>): Form[][] {
  const start = formsById.get(startId)
  if (!start) return []

  // Detached alternate formes (Mega, Gmax, Rotom appliance, cosmetic...) inherit
  // their Species' Base Form line. A forme with own edges keeps them — regional
  // branches would otherwise collapse into the original's line.
  let anchor = start
  if (!start.prevoFormId && !start.evoFormIds?.length && !start.isBaseForm) {
    const baseId = speciesById.get(start.speciesId)?.formIds[0]
    const base = baseId ? formsById.get(baseId) : undefined
    if (base) anchor = base
  }

  // Walk up to the root of the line; seen-set guards against corrupt cycles.
  const seenUp = new Set<FormId>()
  while (anchor.prevoFormId && !seenUp.has(anchor.prevoFormId)) {
    seenUp.add(anchor.prevoFormId)
    const prev = formsById.get(anchor.prevoFormId)
    if (!prev) break
    anchor = prev
  }

  const stages: Form[][] = [[anchor]]
  const seen = new Set<FormId>([anchor.id])
  for (;;) {
    const next: Form[] = []
    for (const f of stages[stages.length - 1]!) {
      for (const evoId of f.evoFormIds ?? []) {
        if (seen.has(evoId)) continue
        seen.add(evoId)
        const evo = formsById.get(evoId)
        if (evo) next.push(evo)
      }
    }
    if (next.length === 0) break
    stages.push(next)
  }
  return stages
}
