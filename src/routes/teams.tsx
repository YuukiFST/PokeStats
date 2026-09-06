import * as React from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useDataset } from "@/hooks/useDataset"
import { useI18n } from "@/lib/i18n"
import type { Team } from "@/lib/domain/types"
import { buildShowdownExport, parseShowdownTeam } from "@/lib/showdown"
import { prunePinnedCounters, resolveSlotSet, validateTeam } from "@/lib/domain/teamSets"
import { TeamSlots } from "@/components/teams/TeamSlots"
import { TeamCheck } from "@/components/teams/TeamCheck"
import { BattleMode } from "@/components/teams/BattleMode"
import { TeamAnalysis } from "@/components/teams/TeamAnalysis"
import { ThreatMatchup, type CounterMode } from "@/components/teams/ThreatMatchup"

const STORAGE_KEY = "pokestats:teams"

function loadTeams(): Team[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Team[]) : []
  } catch {
    return []
  }
}

function saveTeams(teams: Team[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
}

type TabKey = "team" | "analysis" | "matchup" | "battle"

export function TeamsPage() {
  const { data } = useDataset()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  // Tab, selected team and counter mode live in the URL so browser Back
  // rebuilds the exact view (and the router's scroll restore lands where it was).
  const search = useSearch({ from: "/teams" })
  const [teams, setTeams] = React.useState<Team[]>(() => loadTeams())
  const [copied, setCopied] = React.useState(false)
  const [lastChange, setLastChange] = React.useState<{ removed: string[]; added: string[] } | null>(null)

  const tab: TabKey = search.tab === "analysis" || search.tab === "matchup" || search.tab === "battle" ? search.tab : "team"
  const counterMode: CounterMode = search.mode === "smart" ? "smart" : "dataset"
  const active = teams.find((tm) => tm.id === search.team) ?? teams[0] ?? null

  // The change summary belongs to one team; drop it on switch.
  const activeId = active?.id
  React.useEffect(() => {
    setLastChange(null)
  }, [activeId])

  const patchSearch = React.useCallback(
    (patch: { team?: string | null; tab?: TabKey; mode?: CounterMode }) => {
      void navigate({
        to: "/teams",
        search: {
          team: "team" in patch ? (patch.team ?? undefined) : (active?.id ?? undefined),
          tab: "tab" in patch ? patch.tab : tab,
          mode: "mode" in patch ? patch.mode : counterMode,
        },
        replace: true,
      })
    },
    [navigate, active?.id, tab, counterMode],
  )

  const persist = (next: Team[]) => {
    setTeams(next)
    saveTeams(next)
  }

  const patchActive = (patch: Partial<Team>) => {
    if (!active) return
    persist(teams.map((tm) => (tm.id === active.id ? { ...tm, ...patch } : tm)))
  }

  const createTeam = () => {
    const id = Math.random().toString(36).slice(2, 9)
    const team: Team = {
      id,
      name: `Team ${teams.length + 1}`,
      slots: Array(6).fill(null),
      createdWithDatasetVersion: data?.core.datasetVersion ?? "unknown",
      opponents: [],
    }
    persist([...teams, team])
    patchSearch({ team: id, tab: "team" })
  }

  const removeTeam = (id: string) => {
    const next = teams.filter((tm) => tm.id !== id)
    persist(next)
    if (active?.id === id) patchSearch({ team: next[0]?.id ?? null })
  }

  const setSlot = (teamId: string, index: number, formId: string | null) => {
    persist(
      teams.map((tm) => {
        if (tm.id !== teamId) return tm
        const slots = [...tm.slots] as Team["slots"]
        slots[index] = formId ? { formId } : null
        return { ...tm, slots }
      }),
    )
  }

  const setSlotSet = (teamId: string, index: number, setKey: NonNullable<Team["slots"][number]>["setKey"]) => {
    persist(
      teams.map((tm) => {
        if (tm.id !== teamId) return tm
        const slots = [...tm.slots] as Team["slots"]
        const cur = slots[index]
        if (!cur) return tm
        slots[index] = setKey ? { ...cur, setKey } : { formId: cur.formId }
        return { ...tm, slots }
      }),
    )
  }

  const togglePin = (formId: string) => {
    if (!active) return
    const cur = active.pinnedSuggestions ?? []
    patchActive({
      pinnedSuggestions: cur.includes(formId) ? cur.filter((id) => id !== formId) : [...cur, formId],
    })
  }

  // Pin removal and the slot write must share one persist: two patchActive calls
  // would both read the same stale `teams` snapshot and drop each other's patch.
  const addSuggestedToFirstEmpty = (formId: string) => {
    if (!active) return
    const empty = active.slots.findIndex((s) => s === null)
    if (empty === -1) return
    const slots = [...active.slots] as Team["slots"]
    slots[empty] = { formId }
    persist(
      teams.map((tm) =>
        tm.id === active.id
          ? { ...tm, slots, pinnedSuggestions: tm.pinnedSuggestions?.filter((id) => id !== formId) }
          : tm,
      ),
    )
    setLastChange({ removed: [], added: [formId] })
  }

  // Same one-persist rule: the swap writes the slot and drops the candidate's pin together.
  const replaceMemberWithSuggested = (formId: string, replaceMemberId: string) => {
    if (!active) return
    const idx = active.slots.findIndex((s) => s?.formId === replaceMemberId)
    if (idx === -1) return
    const slots = [...active.slots] as Team["slots"]
    slots[idx] = { formId }
    persist(
      teams.map((tm) =>
        tm.id === active.id
          ? { ...tm, slots, pinnedSuggestions: tm.pinnedSuggestions?.filter((id) => id !== formId) }
          : tm,
      ),
    )
    setLastChange({ removed: [replaceMemberId], added: [formId] })
  }

  const toggleProtect = (formId: string) => {
    if (!active) return
    const cur = active.protectedMembers ?? []
    patchActive({
      protectedMembers: cur.includes(formId) ? cur.filter((id) => id !== formId) : [...cur, formId],
    })
  }

  // One persist for the whole plan: every swapped slot plus pin cleanup in a single write.
  const applyImprovementPlan = (removeIds: string[], addIds: string[]) => {
    if (!active) return
    const slots = [...active.slots] as Team["slots"]
    removeIds.forEach((rm, k) => {
      const addId = addIds[k]
      if (!addId) return
      const idx = slots.findIndex((s) => s?.formId === rm)
      if (idx !== -1) slots[idx] = { formId: addId }
    })
    const addSet = new Set(addIds)
    persist(
      teams.map((tm) =>
        tm.id === active.id
          ? { ...tm, slots, pinnedSuggestions: tm.pinnedSuggestions?.filter((id) => !addSet.has(id)) }
          : tm,
      ),
    )
    setLastChange({ removed: removeIds, added: addIds })
  }

  const copyExport = async (team: Team) => {
    if (!data) return
    await navigator.clipboard.writeText(buildShowdownExport(team, data))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const changeOpponents = (opponents: string[]) => {
    if (!active) return
    // Pins only make sense for listed opponents; prune with the same write.
    patchActive({ opponents, pinnedCounters: prunePinnedCounters(active.pinnedCounters, new Set(opponents)) })
  }

  const changePins = (pins: Record<string, string[]>) => {
    if (!active) return
    patchActive({ pinnedCounters: prunePinnedCounters(pins, new Set(active.opponents ?? [])) })
  }

  const members = React.useMemo(() => {
    if (!active || !data) return []
    return active.slots
      .map((s) => (s ? data.formsById.get(s.formId) : null))
      .filter(Boolean) as NonNullable<ReturnType<typeof data.formsById.get>>[]
  }, [active, data])

  const resolvedMembers = React.useMemo(() => {
    if (!active || !data) return []
    return active.slots.flatMap((s) => {
      if (!s) return []
      const form = data.formsById.get(s.formId)
      if (!form) return []
      return [{ form, set: resolveSlotSet(s, data.setsByFormId.get(s.formId) ?? []) }]
    })
  }, [active, data])

  const validation = React.useMemo(() => validateTeam(resolvedMembers), [resolvedMembers])

  const [importOpen, setImportOpen] = React.useState(false)
  const [importText, setImportText] = React.useState("")
  const [importWarnings, setImportWarnings] = React.useState<string[] | null>(null)

  const applyImport = () => {
    if (!active || !data) return
    const parsed = parseShowdownTeam(importText, data)
    if (parsed.slots.every((s) => s === null)) {
      setImportWarnings(parsed.warnings)
      return
    }
    // The pasted title is intentionally ignored: importing must not rename the team.
    persist(teams.map((tm) => (tm.id === active.id ? { ...tm, slots: parsed.slots } : tm)))
    setImportWarnings(parsed.warnings)
    setImportText("")
    // Keep the panel open while warnings exist so they stay visible.
    if (parsed.warnings.length === 0) setImportOpen(false)
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "team", label: t("teams.tabTeam") },
    { key: "analysis", label: t("teams.tabAnalysis") },
    { key: "matchup", label: t("teams.tabMatchup") },
    { key: "battle", label: t("teams.tabBattle") },
  ]

  const opponentForms = React.useMemo(() => {
    if (!active || !data) return []
    return (active.opponents ?? [])
      .map((id) => data.formsById.get(id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
  }, [active, data])

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("teams.title")}</h1>
        <Button size="sm" onClick={createTeam}>
          {t("teams.new")}
        </Button>
        <span className="text-xs text-[var(--ds-gray-700)] ml-2">
          {teams.length} {t("teams.saved")}
        </span>
      </div>
      <p className="text-xs leading-tight text-[var(--ds-gray-700)] max-w-[680px]">{t("teams.desc")}</p>

      {teams.length === 0 ? (
        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">
          {t("teams.noTeams")}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            {teams.map((tm) => (
              <button
                key={tm.id}
                onClick={() => patchSearch({ team: tm.id })}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm ${active?.id === tm.id ? "bg-[var(--ds-gray-100)] border-[var(--ds-gray-400)]" : "border-transparent hover:bg-[var(--ds-gray-100)]"}`}
              >
                <div className="font-medium truncate">{tm.name}</div>
                <div className="text-xs text-[var(--ds-gray-700)]">
                  {tm.slots.filter(Boolean).length}/6 • {tm.opponents?.length ?? 0} {t("teams.tabMatchup").toLowerCase()}
                </div>
              </button>
            ))}
          </div>

          {active && (
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={active.name}
                  onChange={(e) => patchActive({ name: e.target.value })}
                  className="flex-1 min-w-[160px] h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm"
                />
                <Button variant="outline" size="sm" onClick={() => void copyExport(active)}>
                  {copied ? t("teams.copied") : t("teams.copyShowdown")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeTeam(active.id)}>
                  {t("teams.delete")}
                </Button>
              </div>

              <div className="flex gap-1 border-b border-[var(--ds-gray-400)] -mb-px">
                {tabs.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => patchSearch({ tab: key })}
                    className={`px-3 py-2 text-sm border-b-2 ${tab === key ? "border-[var(--ds-gray-1000)] font-medium" : "border-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "team" &&
                (data ? (
                  <div className="space-y-3">
                    <TeamCheck
                      duplicateItems={validation.duplicateItems}
                      multiMega={validation.multiMega}
                      missingHazardRemoval={validation.missingHazardRemoval}
                      missingSpeedControl={validation.missingSpeedControl}
                    />
                    <TeamSlots
                      team={active}
                      data={data}
                      onSetSlot={(idx, id) => setSlot(active.id, idx, id)}
                      onSetSlotSet={(idx, key) => setSlotSet(active.id, idx, key)}
                    />
                    <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
                      <Button variant="outline" size="sm" onClick={() => setImportOpen((v) => !v)}>
                        {t("teams.import")}
                      </Button>
                      {importOpen && (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={importText}
                            onChange={(e) => {
                              setImportText(e.target.value)
                              setImportWarnings(null)
                            }}
                            placeholder={t("teams.importPlaceholder")}
                            rows={6}
                            className="w-full rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 py-1 font-mono text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={applyImport}>
                              {t("teams.applyImport")}
                            </Button>
                            {importWarnings && importWarnings.length > 0 && (
                              <span className="text-xs text-[var(--ds-gray-700)]">
                                {t("teams.importUnmatched")} {importWarnings.join(", ")}
                              </span>
                            )}
                            {importWarnings && importWarnings.length === 0 && (
                              <span className="text-xs text-[var(--ds-gray-700)]">{t("teams.importEmpty")}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">
                    {t("detail.loading")}
                  </div>
                ))}

              {tab === "analysis" &&
                (members.length ? (
                  <>
                    {lastChange && data && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-green-700/50 bg-green-700/10 px-3 py-2 text-xs">
                        <span className="font-semibold text-green-400">{t("teams.changed")}</span>
                        {lastChange.removed.length > 0 && (
                          <span className="text-[var(--ds-gray-700)]">
                            {t("teams.changeOut")} {lastChange.removed.map((id) => data.formsById.get(id)?.name ?? id).join(", ")}
                          </span>
                        )}
                        {lastChange.added.length > 0 && (
                          <span className="text-[var(--ds-gray-700)]">
                            {t("teams.changeIn")} {lastChange.added.map((id) => data.formsById.get(id)?.name ?? id).join(", ")}
                          </span>
                        )}
                        <button onClick={() => setLastChange(null)} className="ml-auto text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)]" aria-label={t("teams.clear")}>
                          ×
                        </button>
                      </div>
                    )}
                    <TeamAnalysis
                    members={members}
                    ptBR={lang === "pt-BR"}
                    data={data}
                    pinnedSuggestions={active.pinnedSuggestions}
                    onTogglePin={togglePin}
                    onAddMember={active.slots.some((s) => s === null) ? addSuggestedToFirstEmpty : undefined}
                    onReplaceMember={active.slots.every((s) => s !== null) ? replaceMemberWithSuggested : undefined}
                    protectedMembers={active.protectedMembers}
                    onToggleProtect={toggleProtect}
                    onApplyPlan={active.slots.every((s) => s !== null) ? applyImprovementPlan : undefined}
                    />
                  </>
                ) : (
                  <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">
                    {t("teams.noMembers")}
                  </div>
                ))}

              {tab === "matchup" &&
                (members.length && data ? (
                  <ThreatMatchup
                    key={active.id}
                    team={active}
                    members={members}
                    data={data}
                    ptBR={lang === "pt-BR"}
                    onChange={changeOpponents}
                    counterMode={counterMode}
                    onCounterModeChange={(mode) => patchSearch({ mode })}
                    initialPins={active.pinnedCounters}
                    onPinsChange={changePins}
                  />
                ) : (
                  <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">
                    {t("teams.noMembers")}
                  </div>
                ))}

              {tab === "battle" &&
                (members.length && data ? (
                  <BattleMode
                    members={members}
                    opponents={opponentForms}
                    allForms={data.core.forms}
                    onOpponentsChange={changeOpponents}
                  />
                ) : (
                  <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">
                    {t("teams.noMembers")}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
