import * as React from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { TypeBadge } from "@/components/ui/badge"
import { SpriteThumb } from "@/components/ui/sprite"
import { useI18n } from "@/lib/i18n"
import type { LoadedDataset } from "@/lib/dataset/load"
import type { Team, Form } from "@/lib/domain/types"

interface Props {
  team: Team
  data: LoadedDataset
  onSetSlot: (index: number, formId: string | null) => void
}

/**
 * 6-slot roster editor with sprite search. Owns its query state; empty slots
 * jump focus to the search input so adding a member is one click + type.
 */
export function TeamSlots({ team, data, onSetSlot }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const inTeam = React.useMemo(() => new Set(team.slots.filter(Boolean).map((s) => s!.formId)), [team.slots])
  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (data.core.forms as Form[])
      .filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q))
      .slice(0, 30)
  }, [query, data])

  const addFirstEmpty = (formId: string) => {
    const empty = team.slots.findIndex((s) => s === null)
    if (empty !== -1) onSetSlot(empty, formId)
  }

  return (
    <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {team.slots.map((slot, idx) => {
          const form = slot ? (data.formsById.get(slot.formId) ?? null) : null
          const isTombstone = slot && !form
          return (
            <div
              key={idx}
              className={`rounded-md border p-2 min-h-[112px] flex flex-col gap-1 ${isTombstone ? "border-[var(--ds-red-700)] bg-red-950/20" : form ? "border-[var(--ds-gray-400)] bg-[var(--ds-background-100)]" : "border-dashed border-[var(--ds-gray-400)] bg-transparent"}`}
            >
              <div className="text-xs text-[var(--ds-gray-700)]">{t("teams.slot")} {idx + 1}</div>
              {slot && form ? (
                <>
                  <div className="flex items-center gap-2">
                    <SpriteThumb form={form} />
                    <Link to="/form/$formId" params={{ formId: form.id } as never} className="font-medium text-sm truncate hover:underline">
                      {form.name}
                    </Link>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(form.types as string[]).map((tt) => (
                      <TypeBadge key={tt} type={tt} />
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-auto -mx-1" onClick={() => onSetSlot(idx, null)}>
                    {t("teams.remove")}
                  </Button>
                </>
              ) : isTombstone ? (
                <>
                  <div className="text-sm font-medium text-[var(--ds-red-700)] break-all">{slot!.formId}</div>
                  <div className="text-xs text-[var(--ds-red-700)]">{t("teams.unresolved")}</div>
                  <Button variant="ghost" size="sm" className="mt-auto -mx-1" onClick={() => onSetSlot(idx, null)}>
                    {t("teams.clear")}
                  </Button>
                </>
              ) : (
                <button
                  onClick={() => inputRef.current?.focus()}
                  className="mt-auto mb-auto py-2 rounded-md text-xs text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] transition-colors"
                >
                  + {t("teams.empty")}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          placeholder={t("teams.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm"
        />
        {query && (
          <div className="mt-2 grid gap-1 max-h-64 overflow-auto rounded-md border border-[var(--ds-gray-400)] p-1 bg-[var(--ds-background-100)]">
            {results.map((f) => {
              const dup = inTeam.has(f.id)
              return (
                <button
                  key={f.id}
                  disabled={dup}
                  title={dup ? t("teams.alreadyInTeam") : undefined}
                  className="text-left flex items-center gap-2 justify-between rounded px-2 py-1 text-sm enabled:hover:bg-[var(--ds-gray-100)] disabled:opacity-45 disabled:cursor-not-allowed"
                  onClick={() => {
                    addFirstEmpty(f.id)
                    setQuery("")
                    inputRef.current?.focus()
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <SpriteThumb form={f} expandable={false} />
                    <span className="truncate">{f.name}</span>
                    {dup && <span className="text-[10px] text-[var(--ds-gray-700)] shrink-0">· {t("teams.alreadyInTeam")}</span>}
                  </span>
                  <span className="flex gap-1 shrink-0">
                    {(f.types as string[]).map((tt) => (
                      <TypeBadge key={tt} type={tt} />
                    ))}
                  </span>
                </button>
              )
            })}
            {results.length === 0 && <div className="text-xs text-[var(--ds-gray-700)] p-2">{t("teams.noResults")}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
