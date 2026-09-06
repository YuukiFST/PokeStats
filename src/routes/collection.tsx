import * as React from "react"
import { Link } from "@tanstack/react-router"
import { useDataset } from "@/hooks/useDataset"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { useCollection } from "@/lib/collection/CollectionProvider"
import type { CollectionFlag } from "@/lib/collection/store"
import type { Form } from "@/lib/domain/types"
import { SpriteThumb } from "@/components/ui/sprite"
import { TypeBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Filter = "all" | "owned" | "shiny" | "wanted" | "missing"

const FILTERS: Filter[] = ["all", "owned", "shiny", "wanted", "missing"]

const FILTER_LABEL: Record<Filter, TranslationKey> = {
  all: "collection.filter.all",
  owned: "collection.filter.owned",
  shiny: "collection.filter.shiny",
  wanted: "collection.filter.wanted",
  missing: "collection.filter.missing",
}

const PAGE_SIZE = 200

function FlagButton({
  active,
  onClick,
  label,
  glyph,
}: {
  active: boolean
  onClick: () => void
  label: string
  glyph: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md border px-1.5 text-xs transition-colors",
        active
          ? "border-[var(--ds-blue-700)] bg-[var(--ds-blue-700)]/15 text-[var(--ds-blue-700)]"
          : "border-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-900)]",
      )}
    >
      <span aria-hidden>{glyph}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

/** Cobblemon collection: what the player owns in game. Local-only. */
export function CollectionPage() {
  const { data, loading } = useDataset()
  const { t } = useI18n()
  const { entry, toggle, entries } = useCollection()
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [limit, setLimit] = React.useState(PAGE_SIZE)

  const forms = React.useMemo(() => (data?.core.forms as Form[] | undefined) ?? [], [data])
  const knownIds = React.useMemo(() => new Set(forms.map((f) => f.id)), [forms])
  const orphans = React.useMemo(() => entries.filter((e) => !knownIds.has(e.formId)), [entries, knownIds])

  const counts = React.useMemo(() => {
    let owned = 0
    let shiny = 0
    let wanted = 0
    for (const f of forms) {
      const e = entry(f.id)
      if (e.owned) owned++
      if (e.shiny) shiny++
      if (e.wanted) wanted++
    }
    return { owned, shiny, wanted, total: forms.length }
  }, [forms, entry])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return forms.filter((f) => {
      const e = entry(f.id)
      if (filter === "owned" && !e.owned) return false
      if (filter === "shiny" && !e.shiny) return false
      if (filter === "wanted" && !e.wanted) return false
      if (filter === "missing" && e.owned) return false
      if (q && !f.name.toLowerCase().includes(q) && !f.id.includes(q)) return false
      return true
    })
  }, [forms, filter, query, entry])

  if (loading || !data) return <div className="p-8 text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>

  const flag = (formId: string, kind: CollectionFlag) => () => toggle(formId, kind)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">{t("collection.title")}</h1>
      <p className="text-xs leading-tight text-[var(--ds-gray-700)] max-w-[680px]">{t("collection.desc")}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-[var(--ds-gray-400)] px-2 py-0.5 tnum">
          {t("collection.owned")} {counts.owned}/{counts.total}
        </span>
        <span className="rounded-full border border-[var(--ds-gray-400)] px-2 py-0.5 tnum">
          {t("collection.shiny")} {counts.shiny}
        </span>
        <span className="rounded-full border border-[var(--ds-gray-400)] px-2 py-0.5 tnum">
          {t("collection.wanted")} {counts.wanted}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("collection.search")}
          className="h-8 min-w-[200px] flex-1 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button key={f} variant={filter === f ? "outline" : "ghost"} size="sm" onClick={() => { setFilter(f); setLimit(PAGE_SIZE) }}>
              {t(FILTER_LABEL[f])}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-1">
        {rows.slice(0, limit).map((f) => {
          const e = entry(f.id)
          return (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-1.5 text-sm"
            >
              <SpriteThumb form={f} size={24} expandable={false} />
              <Link to="/form/$formId" params={{ formId: f.id } as never} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {f.name}
              </Link>
              <span className="hidden gap-1 sm:flex">
                {f.types.map((tt) => (
                  <TypeBadge key={tt} type={tt} />
                ))}
              </span>
              <span className="ml-auto flex gap-0.5">
                <FlagButton active={e.owned} onClick={flag(f.id, "owned")} label={t("collection.owned")} glyph="●" />
                <FlagButton active={e.shiny} onClick={flag(f.id, "shiny")} label={t("collection.shiny")} glyph="✦" />
                <FlagButton active={e.wanted} onClick={flag(f.id, "wanted")} label={t("collection.wanted")} glyph="♡" />
              </span>
            </div>
          )
        })}
        {rows.length > limit && (
          <div className="flex items-center gap-2 p-2 text-xs text-[var(--ds-gray-700)]">
            <span>
              {t("collection.showing")} {limit}/{rows.length}
            </span>
            <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              {t("collection.more")}
            </Button>
          </div>
        )}
        {rows.length === 0 && <div className="p-4 text-sm text-[var(--ds-gray-700)]">{t("teams.noResults")}</div>}
      </div>

      {orphans.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[var(--ds-gray-700)]">{t("collection.unresolved")}</div>
          {orphans.map((o) => (
            <div key={o.formId} className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] px-3 py-1.5 text-xs text-[var(--ds-gray-700)]">
              <span className="min-w-0 flex-1 truncate font-mono">{o.formId}</span>
              <span className="ml-auto flex gap-0.5">
                <FlagButton active={o.owned} onClick={flag(o.formId, "owned")} label={t("collection.owned")} glyph="●" />
                <FlagButton active={o.shiny} onClick={flag(o.formId, "shiny")} label={t("collection.shiny")} glyph="✦" />
                <FlagButton active={o.wanted} onClick={flag(o.formId, "wanted")} label={t("collection.wanted")} glyph="♡" />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
