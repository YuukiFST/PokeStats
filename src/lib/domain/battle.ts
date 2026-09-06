/**
 * Battle Mode: full-team (6v6) planning over type math. Lead suggestion,
 * threat ranking and safe switch-ins, all derived from memberMatchup so the
 * Battle tab agrees with the Threat Matchup simulator.
 */
import { defensiveProfile } from "./typeChart"
import { memberMatchup, type MemberMatchup } from "./matchup"
import type { Form, TypeName } from "./types"

export interface BattleCell extends MemberMatchup {
  memberId: string
  opponentId: string
}

export interface BattleMatrix {
  members: Form[]
  opponents: Form[]
  /** cells[memberIdx][opponentIdx] */
  cells: BattleCell[][]
}

export function battleMatrix(members: Form[], opponents: Form[]): BattleMatrix {
  const cells = members.map((m) =>
    opponents.map((o) => ({
      ...memberMatchup(m.types as TypeName[], o.types as TypeName[], m.id),
      memberId: m.id,
      opponentId: o.id,
    })),
  )
  return { members, opponents, cells }
}

export interface LeadSuggestion {
  formId: string
  score: number
  /** Opponent ids this lead pressures (best STAB 2x+). */
  pressures: string[]
  /** Opponent ids threatening this lead for 2x+. */
  risks: string[]
}

/**
 * Transparent lead score: pressure (best STAB per opponent, capped at 4 so
 * one 4x matchup does not elect a glass cannon) minus incoming threat mults.
 */
export function suggestLeads(matrix: BattleMatrix): LeadSuggestion[] {
  return matrix.members.map((m, i) => {
    let score = 0
    const pressures: string[] = []
    const risks: string[] = []
    for (const o of matrix.opponents) {
      const cell = matrix.cells[i]!.find((c) => c.opponentId === o.id)!
      score += Math.min(4, cell.bestStabMult)
      if (cell.bestStabMult >= 2) pressures.push(o.id)
      const incoming = Math.max(0, ...cell.threats.map((t) => t.mult))
      score -= incoming
      if (incoming >= 2) risks.push(o.id)
    }
    return { formId: m.id, score, pressures, risks }
  }).sort((a, b) => b.score - a.score)
}

export interface OpponentThreat {
  formId: string
  /** Members this opponent hits for 2x+ with its own STAB types. */
  threatenedCount: number
  /** Highest multiplier it deals to any member. */
  maxMult: number
}

/** Opponents ordered by how much of the team they threaten. */
export function threatRanking(matrix: BattleMatrix): OpponentThreat[] {
  return matrix.opponents.map((o) => {
    let threatenedCount = 0
    let maxMult = 0
    for (let i = 0; i < matrix.members.length; i++) {
      const memberDef = defensiveProfile(matrix.members[i]!.types as TypeName[])
      let worst = 0
      for (const atk of o.types as TypeName[]) worst = Math.max(worst, memberDef[atk]!)
      if (worst >= 2) threatenedCount++
      maxMult = Math.max(maxMult, worst)
    }
    return { formId: o.id, threatenedCount, maxMult }
  }).sort((a, b) => b.threatenedCount - a.threatenedCount || b.maxMult - a.maxMult)
}

export interface SwitchinOption {
  formId: string
  /** Worst multiplier the opponent deals to this member (<=1 is safe). */
  incomingWorst: number
  /** Best STAB multiplier back. */
  pressure: number
}

/** Members that avoid 2x+ from the opponent, best pressure first. */
export function safeSwitchins(members: Form[], opponent: Form): SwitchinOption[] {
  return members
    .map((m) => {
      const memberDef = defensiveProfile(m.types as TypeName[])
      let incomingWorst = 0
      for (const atk of opponent.types as TypeName[]) incomingWorst = Math.max(incomingWorst, memberDef[atk]!)
      const oppDef = defensiveProfile(opponent.types as TypeName[])
      let pressure = 0
      for (const atk of m.types as TypeName[]) pressure = Math.max(pressure, oppDef[atk]!)
      return { formId: m.id, incomingWorst, pressure }
    })
    .filter((o) => o.incomingWorst <= 1)
    .sort((a, b) => b.pressure - a.pressure)
}
