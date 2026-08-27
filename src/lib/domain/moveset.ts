/**
 * Moveset profile: aggregate a Form's Sets (CONTEXT.md Set) into an attacking-Type
 * distribution. Pure aggregation — move resolution is injected so this module stays
 * free of dataset-loading concerns. Consumer: Smart Counters (CONTEXT.md Application).
 */
import type { MoveInfo, Set, TypeName } from "./types"

/** Slot weight: primary Move 1.0, each alternative 0.4 (CONTEXT.md: "primary first"). */
const PRIMARY_SLOT_WEIGHT = 1
const ALT_SLOT_WEIGHT = 0.4

export interface MovesetProfile {
  /**
   * Attacking Type -> share of the click distribution. Each Set with at least one
   * attacking Move contributes 1.0 spread across its Types, then Sets are averaged,
   * so weights sum to 1.0 when attackingSetCount > 0. Status Moves never count.
   */
  typeWeights: Map<TypeName, number>
  /** Sets that had at least one attacking Move (0 = no real movepool signal). */
  attackingSetCount: number
  /** Deduped resolved attacking Moves across all Sets, primary options first. */
  attackMoves: MoveInfo[]
  /**
   * Physical share of the damaging weight (physical / (physical + special)).
   * 0.5 when the profile has no damaging Moves — balanced bulk assumption.
   */
  physicalShare: number
}

const EMPTY_PROFILE: MovesetProfile = {
  typeWeights: new Map(),
  attackingSetCount: 0,
  attackMoves: [],
  physicalShare: 0.5,
}

export function emptyMovesetProfile(): MovesetProfile {
  return EMPTY_PROFILE
}

export function movesetProfile(
  sets: Set[],
  resolveMove: (name: string) => MoveInfo | null,
): MovesetProfile {
  const totals = new Map<TypeName, number>()
  const seenMoves = new Map<string, MoveInfo>()
  let attackingSetCount = 0
  let physicalWeight = 0
  let specialWeight = 0
  for (const set of sets) {
    const perSet = new Map<TypeName, number>()
    let setTotal = 0
    for (const slot of set.moves) {
      slot.forEach((name, idx) => {
        const move = resolveMove(name)
        if (!move || move.category === "Status") return
        const weight = idx === 0 ? PRIMARY_SLOT_WEIGHT : ALT_SLOT_WEIGHT
        perSet.set(move.type, (perSet.get(move.type) ?? 0) + weight)
        setTotal += weight
        if (move.category === "Physical") physicalWeight += weight
        else specialWeight += weight
        if (!seenMoves.has(move.name)) seenMoves.set(move.name, move)
      })
    }
    if (setTotal === 0) continue
    attackingSetCount++
    for (const [type, weight] of perSet) totals.set(type, (totals.get(type) ?? 0) + weight / setTotal)
  }
  if (attackingSetCount > 0) {
    for (const [type, weight] of totals) totals.set(type, weight / attackingSetCount)
  }
  const physicalShare = physicalWeight + specialWeight > 0 ? physicalWeight / (physicalWeight + specialWeight) : 0.5
  return { typeWeights: totals, attackingSetCount, attackMoves: [...seenMoves.values()], physicalShare }
}
