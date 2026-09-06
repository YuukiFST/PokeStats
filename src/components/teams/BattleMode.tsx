import * as React from "react"
import { Link } from "@tanstack/react-router"
import { useI18n } from "@/lib/i18n"
import { battleMatrix, safeSwitchins, suggestLeads, threatRanking } from "@/lib/domain/battle"
import type { VerdictKey } from "@/lib/domain/matchup"
import type { Form } from "@/lib/domain/types"
import { SpriteThumb } from "@/components/ui/sprite"
import { cn } from "@/lib/utils"

const CHIP: Record<VerdictKey, string> = {
  excellent: "bg-green-700 text-white border-green-700",
  good: "bg-green-700/20 text-green-400 border-green-700/50",
  neutral: "bg-transparent text-[var(--ds-gray-700)] border-[var(--ds-gray-400)]",
  bad: "bg-amber-500/15 text-amber-500 border-amber-600/50",
  none: "bg-red-950/40 text-red-400 border-red-900",
}

interface Props {
  members: Form[]
  opponents: Form[]
  allForms: Form[]
  onOpponentsChange: (ids: string[]) => void
}

/**
 * Battle Mode: plan a 6v6 from the teams tab. Lead suggestion, threat
 * ranking, full matchup matrix and safe switch-ins, all type-level like the
 * Threat Matchup simulator.
 */
export function BattleMode({ members, opponents, allForms, onOpponentsChange }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = React.useState("")
  const [focusOpp, setFocusOpp] = React.useState<string | null>(null)

  const matrix = React.useMemo(() => battleMatrix(members, opponents), [members, opponents])
  const leads = React.useMemo(() => suggestLeads(matrix), [matrix])
  const threats = React.useMemo(() => threatRanking(matrix), [matrix])
  const focused = opponents.find((o) => o.id === (focusOpp ?? opponents[0]?.id)) ?? opponents[0] ?? null
  const switchins = React.useMemo(() => (focused ? safeSwitchins(members, focused) : []), [members, focused])

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const known = new Set(opponents.map((o) => o.id))
    return allForms.filter((f) => !known.has(f.id) && (f.name.toLowerCase().includes(q) || f.id.includes(q))).slice(0, 8)
  }, [query, allForms, opponents])

  const nameOf = (id: string) => [...members, ...opponents].find((f) => f.id === id)?.name ?? id

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
        <div className="mb-2 text-xs font-semibold text-[var(--ds-gray-700)]">{t("battle.opponents")}</div>
        <div className="flex flex-wrap gap-1">
          {opponents.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--ds-gray-400)] px-2 py-0.5 text-xs">
              <SpriteThumb form={o} size={18} expandable={false} />
              {o.name}
              <button
                aria-label={`${t("teams.remove")} ${o.name}`}
                className="text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)]"
                onClick={() => onOpponentsChange(opponents.filter((x) => x.id !== o.id).map((x) => x.id))}
              >
                ×
              </button>
            </span>
          ))}
          {opponents.length === 0 && <span className="text-xs text-[var(--ds-gray-700)]">{t("battle.noOpponents")}</span>}
        </div>
        {opponents.length < 6 && (
          <div className="relative mt-2 max-w-sm">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("matchup.addPlaceholder")}
              className="h-8 w-full rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm"
            />
            {query && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-1">
                {matches.map((f) => (
                  <button
                    key={f.id}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-[var(--ds-gray-100)]"
                    onClick={() => {
                      onOpponentsChange([...opponents.map((x) => x.id), f.id])
                      setQuery("")
                    }}
                  >
                    <SpriteThumb form={f} size={20} expandable={false} />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
                {matches.length === 0 && <div className="p-2 text-xs text-[var(--ds-gray-700)]">{t("teams.noResults")}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {members.length > 0 && opponents.length > 0 && (
        <>
          <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--ds-gray-700)]">{t("battle.lead")}</div>
            <div className="space-y-1">
              {leads.slice(0, 3).map((l, i) => (
                <div key={l.formId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tnum w-4 text-xs text-[var(--ds-gray-700)]">{i + 1}</span>
                  <Link to="/form/$formId" params={{ formId: l.formId } as never} className="font-medium hover:underline">
                    {nameOf(l.formId)}
                  </Link>
                  <span className="text-xs text-[var(--ds-gray-700)]">
                    {t("battle.pressures")} {l.pressures.length ? l.pressures.map(nameOf).join(", ") : "—"}
                    {l.risks.length > 0 && ` · ${t("battle.risks")} ${l.risks.map(nameOf).join(", ")}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--ds-gray-700)]">{t("battle.threats")}</div>
            <div className="space-y-1">
              {threats.map((th) => (
                <button key={th.formId} onClick={() => setFocusOpp(th.formId)} className="flex w-full items-center gap-2 text-left text-sm hover:underline">
                  <SpriteThumb form={opponents.find((o) => o.id === th.formId)!} size={20} expandable={false} />
                  <span className="font-medium">{nameOf(th.formId)}</span>
                  <span className="text-xs text-[var(--ds-gray-700)]">
                    {t("battle.threatens")} {th.threatenedCount}/{members.length} · ×{th.maxMult}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--ds-gray-700)]">{t("battle.matrix")}</div>
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th />
                  {opponents.map((o) => (
                    <th key={o.id} className="max-w-[90px] truncate px-1 pb-1 text-center font-medium" title={o.name}>
                      {o.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id}>
                    <th className="max-w-[110px] truncate pr-2 text-left font-medium" title={m.name}>
                      {m.name}
                    </th>
                    {matrix.cells[i]!.map((c) => (
                      <td key={c.opponentId} className="px-1 py-0.5 text-center">
                        <span className={cn("inline-block min-w-[34px] rounded border px-1 py-0.5 tnum", CHIP[c.verdict])}>
                          {c.bestStabMult === 0 ? "0" : `${c.bestStabMult}×`}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {focused && (
            <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--ds-gray-700)]">{t("battle.switchins")}</span>
                <select
                  value={focused.id}
                  onChange={(e) => setFocusOpp(e.target.value)}
                  className="h-7 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 text-xs"
                >
                  {opponents.map((o) => (
                    <option key={o.id} value={o.id}>
                      {t("battle.vs")} {o.name}
                    </option>
                  ))}
                </select>
              </div>
              {switchins.length === 0 ? (
                <div className="text-xs text-[var(--ds-gray-700)]">{t("battle.noSwitchins")}</div>
              ) : (
                <div className="space-y-1">
                  {switchins.map((s) => (
                    <div key={s.formId} className="flex items-center gap-2 text-sm">
                      <SpriteThumb form={members.find((m) => m.id === s.formId)!} size={20} expandable={false} />
                      <span className="font-medium">{nameOf(s.formId)}</span>
                      <span className="tnum text-xs text-[var(--ds-gray-700)]">
                        ×{s.incomingWorst} {t("battle.incoming")} · ×{s.pressure} {t("battle.back")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
