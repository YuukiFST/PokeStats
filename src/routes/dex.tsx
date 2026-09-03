import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge, TypeBadge, TYPE_CHIP, TypeBadgeAnchor } from "@/components/ui/badge"
import { HelpTip } from "@/components/ui/helptip"
import { calcBST, cn } from "@/lib/utils"
import type { Form } from "@/lib/domain/types"
import { formMatchesSelectedTypes, sortFormsCached, collapseSpecies, type DexSortKey } from "@/lib/domain/dexFilter"
import { TYPE_NAMES } from "@/lib/domain/typeChart"
import { useDataset } from "@/hooks/useDataset"
import { useRestoredScroll } from "@/hooks/useRestoredScroll"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { ListSprite, useSpriteManifest, baseFormOf, SpriteLightbox } from "@/components/ui/sprite"
import { spriteUrls, type SpriteManifest, type SpriteBase } from "@/lib/sprites"

export type DexSearch = {
  q?: string
  trait?: string
  traits?: string
  type?: string
  types?: string
  mode?: string
  grouped?: string
  sort?: string
  dir?: string
}
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider"
import { StarButton } from "@/components/ui/star"
import { useBookmarks } from "@/lib/bookmarks/BookmarksProvider"

type SortKey = DexSortKey

const SCROLL_KEY = "dex:scrollTop"
const FILTERS_KEY = "pokestats:filtersOpen"
const TRAIT_OPTIONS = ["mega", "gmax", "primal", "regional", "battle-only", "none"] as const

type DexRowProps = {
  form: Form
  index: number
  start: number
  selected: boolean
  starred: boolean
  manifest: SpriteManifest | null
  base: SpriteBase | undefined
  starAdd: string
  starRemove: string
  typeName: (type: string) => string
  onToggleSelect: (id: string) => void
  onToggleStar: (id: string) => void
  onExpand: (form: Form) => void
}

const DexRow = React.memo(function DexRow(p: DexRowProps) {
  const f = p.form
  const bst = calcBST(f.baseStats)
  return (
    <div
      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${p.start}px)` }}
      className={`grid grid-cols-[28px_36px_28px_1fr_140px_54px_54px_54px_54px_54px_54px_64px_84px] gap-2 px-4 py-1.5 items-center text-sm border-b border-[var(--ds-gray-200)] hover:bg-[var(--ds-gray-100)] ${p.selected ? "bg-[var(--ds-gray-100)]" : ""}`}
    >
      <input type="checkbox" checked={p.selected} onChange={() => p.onToggleSelect(f.id)} className="rounded" />
      <span className="text-center tnum text-xs text-[var(--ds-gray-700)] tabular-nums">{p.index + 1}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); p.onExpand(f) }}
        className="w-7 h-7 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-blue-700)] inline-flex items-center justify-center cursor-zoom-in"
        aria-label={`Expandir ${f.name}`}
      >
        <ListSprite form={f} base={p.base} manifest={p.manifest} />
      </button>
      <span className="flex items-center gap-1 min-w-0">
        <StarButton className="h-6 w-6" active={p.starred} onToggle={() => p.onToggleStar(f.id)} label={p.starred ? p.starRemove : p.starAdd} />
        <a data-nav href={`/form/${encodeURIComponent(f.id)}`} className="text-left truncate hover:underline font-medium" title={f.id}>
          {f.name}
          {f.traits.length > 0 && <span className="ml-1 text-xs text-[var(--ds-gray-700)]">[{f.traits.join(",")}]</span>}
        </a>
      </span>
      <span className="flex gap-1">
        {f.types.map((tt) => <TypeBadgeAnchor key={tt} type={tt} title={p.typeName(tt)} />)}
        {f.types.length === 1 && <span className="w-[62px] shrink-0" />}
      </span>
      <span className="text-right tnum">{f.baseStats.hp}</span>
      <span className="text-right tnum">{f.baseStats.atk}</span>
      <span className="text-right tnum">{f.baseStats.def}</span>
      <span className="text-right tnum">{f.baseStats.spa}</span>
      <span className="text-right tnum">{f.baseStats.spd}</span>
      <span className="text-right tnum">{f.baseStats.spe}</span>
      <span className="text-right tnum font-semibold">{bst}</span>
      <span className="text-right flex justify-end">{f.tier ? <Badge className="w-[64px] justify-center">{f.tier}</Badge> : <span className="text-[var(--ds-gray-700)] w-[64px] inline-flex justify-center">—</span>}</span>
    </div>
  )
})

export function DexPage() {
  const { data, loading, error } = useDataset()
  const navigate = useNavigate({ from: "/" })
  const search = useSearch({ from: "/" }) as DexSearch
  const { t, typeName } = useI18n()
  const { keys: starredKeys, toggle } = useBookmarks()
  const manifest = useSpriteManifest()
  const onToggleStar = React.useCallback((id: string) => toggle({ kind: "form", formId: id }), [toggle])
  const [lightbox, setLightbox] = React.useState<Form | null>(null)
  const onExpand = React.useCallback((f: Form) => setLightbox(f), [])
  const starAdd = t("bookmarks.add")
  const starRemove = t("bookmarks.remove")
  const { openInNewTab, openLinkMenu } = useWorkspace()

  const query = search.q ?? ""
  const sortBy = (search.sort as SortKey) ?? "name"
  const sortDir = (search.dir as "asc" | "desc") ?? "asc"

  // legacy support: ?type=Fire / ?trait=mega and ?mode=ranking
  const legacySingleType = search.type && search.type !== "all" ? search.type : null
  const rawTypes = search.types ?? (legacySingleType ? legacySingleType : undefined)
  const selectedTypes = React.useMemo(() => {
    if (!rawTypes) return new Set<string>()
    return new Set(rawTypes.split(",").filter(Boolean))
  }, [rawTypes])

  const rawTraits = search.traits ?? (search.trait && search.trait !== "all" ? search.trait : undefined)
  const selectedTraits = React.useMemo(() => {
    if (!rawTraits) return new Set<string>()
    return new Set(rawTraits.split(",").filter(Boolean))
  }, [rawTraits])

  const grouped = search.grouped === "1" || search.mode === "ranking"

  const [filtersOpen, setFiltersOpen] = React.useState(() => {
    try {
      const v = localStorage.getItem(FILTERS_KEY)
      return v ? v === "1" : true
    } catch { return true }
  })
  React.useEffect(() => {
    try { localStorage.setItem(FILTERS_KEY, filtersOpen ? "1" : "0") } catch {}
  }, [filtersOpen])

  const setSearch = React.useCallback(
    (patch: Partial<DexSearch>) => {
      navigate({
        search: (prev) => {
          const next = { ...(prev as DexSearch), ...patch } as DexSearch & Record<string, unknown>
          if (!next.q) delete next.q
          if (next.trait === "all") delete next.trait
          if (next.traits === "" || (next as any).traits === "all") delete (next as any).traits
          if ("trait" in patch || "traits" in patch) {
            if ((next as any).traits === "" || (next as any).traits === "all") delete (next as any).traits
            if ((next as any).trait) delete (next as any).trait
            if (!(next as any).traits) delete (next as any).traits
          }
          // normalize type/types
          if ("type" in patch || "types" in patch) {
            // if types is set, remove legacy type
            if (next.types === "" || next.types === "all") delete next.types
            if (next.type) delete next.type
            if (!next.types) delete next.types
          }
          if (next.grouped !== "1") delete next.grouped
          if (next.mode) delete next.mode
          if (next.sort === "name" || !next.sort) delete next.sort
          if (next.dir === "asc" || !next.dir) delete next.dir
          return next as never
        },
        replace: false,
      })
    },
    [navigate],
  )

  const toggleTrait = React.useCallback(
    (tr: string) => {
      const next = new Set(selectedTraits)
      if (next.has(tr)) next.delete(tr)
      else next.add(tr)
      const arr = [...next]
      setSearch({ traits: arr.length ? arr.join(",") : undefined, trait: undefined as never })
    },
    [selectedTraits, setSearch],
  )

  const toggleType = React.useCallback(
    (tt: string) => {
      const next = new Set(selectedTypes)
      if (next.has(tt)) next.delete(tt)
      else next.add(tt)
      const arr = [...next]
      setSearch({ types: arr.length ? arr.join(",") : undefined, type: undefined as never })
    },
    [selectedTypes, setSearch],
  )

  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [inputValue, setInputValue] = React.useState(query)
  React.useEffect(() => setInputValue(query), [query])
  const deferredQuery = React.useDeferredValue(inputValue)
  React.useEffect(() => {
    if (deferredQuery !== query) {
      navigate({
        search: (prev) => {
          const next = { ...(prev as DexSearch) }
          if (deferredQuery) next.q = deferredQuery
          else delete next.q
          return next as never
        },
        replace: true,
      })
    }
  }, [deferredQuery, query, navigate])

  const forms: Form[] = React.useMemo(() => data?.core.forms ?? [], [data?.core.forms])

  const handleSort = React.useCallback(
    (col: SortKey) => {
      if (sortBy === col) setSearch({ sort: col === "name" ? undefined : col, dir: sortDir === "asc" ? "desc" : "asc" })
      else setSearch({ sort: col === "name" ? undefined : col, dir: col === "name" ? undefined : "desc" })
    },
    [sortBy, sortDir, setSearch],
  )

  const SortIndicator = React.useCallback(
    ({ col }: { col: SortKey }) => {
      if (sortBy !== col) return <span className="opacity-20 ml-1">↕</span>
      return <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
    },
    [sortBy, sortDir],
  )

  const activeCount = selectedTypes.size + selectedTraits.size + (grouped ? 1 : 0)

  const sorted = React.useMemo(() => sortFormsCached(forms, sortBy, sortDir), [forms, sortBy, sortDir])
  const filtered = React.useMemo(() => {
    let out = sorted
    const q = (search.q ?? deferredQuery).trim().toLowerCase()
    if (q) out = out.filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q))
    if (selectedTraits.size > 0) {
      out = out.filter((f) => {
        const hasNone = f.traits.length === 0
        // OR across selected traits: match if any selected trait matches
        for (const tr of selectedTraits) {
          if (tr === "none" && hasNone) return true
          if ((f.traits as string[]).includes(tr)) return true
        }
        return false
      })
    }
    if (selectedTypes.size > 0) {
      out = out.filter((f) => formMatchesSelectedTypes(f.types as string[], selectedTypes))
    }
    if (grouped && sortBy !== "name") out = collapseSpecies(out)
    return out
  }, [sorted, search.q, deferredQuery, selectedTraits, selectedTypes, grouped, sortBy])

  const parentRef = React.useRef<HTMLDivElement>(null)
  const { initialOffset, saveNow } = useRestoredScroll(parentRef, SCROLL_KEY, !loading)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(() => 36, []),
    overscan: 10,
    initialOffset,
  })

  const toggleSelect = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        if (next.size >= 4) return next
        next.add(id)
      }
      return next
    })
  }, [])

  const selectedForms = React.useMemo(() => {
    const byId = new Map(forms.map((f) => [f.id, f] as const))
    return [...selected].flatMap((id) => {
      const f = byId.get(id)
      return f ? [f] : []
    })
  }, [forms, selected])

  const goCompare = React.useCallback(
    (e?: React.MouseEvent) => {
      if (selected.size < 2) return
      saveNow()
      const ids = [...selected].join(",")
      const loc = { pathname: "/compare", search: `?ids=${ids}` }
      if (e && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        openInNewTab(loc)
        return
      }
      navigate({ to: "/compare", search: { ids } as never })
    },
    [selected, saveNow, openInNewTab, navigate],
  )

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-6 w-32 bg-[var(--ds-gray-100)] animate-pulse rounded" />
        <div className="h-10 bg-[var(--ds-gray-100)] animate-pulse rounded" />
        <div className="h-96 bg-[var(--ds-gray-100)] animate-pulse rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-[var(--ds-red-700)] bg-[var(--ds-background-200)] p-4 text-sm">
          {t("dex.loadingFailed")} {String(error)}
          <div className="text-xs text-[var(--ds-gray-700)] mt-1">{t("dex.checkFiles")}</div>
        </div>
      </div>
    )
  }

  const selCount = selected.size

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-4 py-3 space-y-3">
        <Input autoFocus placeholder={t("dex.searchPlaceholder")} value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full max-w-xl" />

        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] overflow-hidden">
          <div className="flex items-stretch">
            <button onClick={() => setFiltersOpen((v) => !v)} className="flex-1 min-w-0 flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-[var(--ds-gray-100)] transition-colors">
              <span className="flex items-center gap-2">
                {t("dex.filters")} {activeCount ? <span className="text-xs font-normal text-[var(--ds-gray-700)]">({activeCount} {t("dex.activeFilters")})</span> : null}
                {grouped && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--ds-amber-100)] border border-[var(--ds-amber-400)] text-[var(--ds-amber-1000)]">Ranking</span>}
              </span>
              <span className="flex items-center gap-2 text-xs text-[var(--ds-gray-700)]">
                <span className="hidden sm:inline">{filtered.length} / {forms.length} {t("dex.count")}</span>
                <span>{filtersOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            <span className="flex items-center pr-3">
              <HelpTip text={t("dex.tabsHelp")} />
            </span>
          </div>
          {filtersOpen && (
            <div className="border-t border-[var(--ds-gray-400)] p-3 space-y-4">
              <div>
                <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  {t("dex.header.types")} <HelpTip text={t("dex.typeHelp")} />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-1.5">
                  {TYPE_NAMES.map((tt) => {
                    const active = selectedTypes.has(tt)
                    const chip = TYPE_CHIP[tt]!
                    return (
                      <button
                        key={tt}
                        onClick={() => toggleType(tt)}
                        aria-pressed={active}
                        title={tt}
                        className={cn(
                          "h-7 rounded-md text-[11px] font-semibold tracking-wide border uppercase flex items-center justify-center transition-colors",
                          active ? cn(chip.solid, "ring-2 ring-offset-1 ring-offset-[var(--ds-background-100)] ring-[var(--ds-gray-1000)]") : cn(chip.soft, "hover:brightness-125"),
                        )}
                      >
                        {typeName(tt)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  {t("dex.traitLabel")} <HelpTip text={t("dex.traitHelp")} />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {TRAIT_OPTIONS.map((tr) => {
                    const active = selectedTraits.has(tr)
                    return (
                      <button
                        key={tr}
                        onClick={() => toggleTrait(tr)}
                        aria-pressed={active}
                        className={`h-7 rounded-md text-[11px] font-medium border flex items-center justify-center transition-colors ${active ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]" : "bg-[var(--ds-background-200)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]"}`}
                      >
                        {t(`trait.${tr}` as TranslationKey)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-2.5">
                <input type="checkbox" checked={grouped} onChange={(e) => setSearch({ grouped: e.target.checked ? "1" : undefined })} className="mt-0.5 rounded" />
                <span className="flex flex-col">
                  <span className="font-medium text-xs flex items-center gap-1.5">{t("dex.grouped")} <HelpTip text={t("dex.groupedDesc")} /></span>
                </span>
              </label>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--ds-gray-200)]">
                <span className="text-xs text-[var(--ds-gray-700)]">
                  {filtered.length} / {forms.length} {t("dex.count")}
                </span>
                {activeCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSearch({ traits: undefined, trait: undefined as never, types: undefined, type: undefined as never, grouped: undefined })}>
                    {t("dex.clearAll")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--ds-gray-700)] mr-1">{t("dex.filters")}:</span>
            {[...selectedTypes].map((tt) => (
              <button
                key={tt}
                onClick={() => toggleType(tt)}
                title={t("dex.removeFilter")}
                className="inline-flex items-center gap-0.5 h-6 rounded-full pl-0.5 pr-1.5 border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] hover:border-[var(--ds-red-700)] transition-colors"
              >
                <TypeBadge type={tt} className="h-[18px] text-[10px]" />
                <span aria-hidden className="text-xs text-[var(--ds-gray-700)] hover:text-[var(--ds-red-700)]">×</span>
              </button>
            ))}
            {[...selectedTraits].map((tr) => (
              <button
                key={tr}
                onClick={() => toggleTrait(tr)}
                title={t("dex.removeFilter")}
                className="inline-flex items-center gap-1 h-6 rounded-full px-2 border border-[var(--ds-blue-700)] bg-[var(--ds-blue-700)]/15 text-xs font-medium text-[var(--ds-blue-700)] hover:border-[var(--ds-red-700)] hover:text-[var(--ds-red-700)] transition-colors"
              >
                {t(`trait.${tr}` as TranslationKey)} <span aria-hidden>×</span>
              </button>
            ))}
            {grouped && (
              <button
                onClick={() => setSearch({ grouped: undefined })}
                title={t("dex.removeFilter")}
                className="inline-flex items-center gap-1 h-6 rounded-full px-2 border border-[var(--ds-amber-400)] bg-[var(--ds-amber-100)] text-xs font-medium text-[var(--ds-amber-1000)] hover:border-[var(--ds-red-700)] hover:text-[var(--ds-red-700)] transition-colors"
              >
                Ranking <span aria-hidden>×</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 text-xs text-[var(--ds-gray-700)]">
          {t("dex.sortHelp")} <span className="font-medium text-[var(--ds-gray-1000)]">{sortBy.toUpperCase()} {sortDir === "asc" ? "↑" : "↓"}</span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 grid grid-cols-[28px_36px_28px_1fr_140px_54px_54px_54px_54px_54px_54px_64px_84px] gap-2 px-4 py-2 text-xs font-medium text-[var(--ds-gray-900)] border-b border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">
        <span />
        <span className="text-center tnum">#</span>
        <span className="text-center">SPR</span>
        <button onClick={() => handleSort("name")} className="text-left hover:text-[var(--ds-gray-1000)] flex items-center">
          {t("dex.header.name")} <SortIndicator col="name" />
        </button>
        <span>{t("dex.header.types")}</span>
        <button onClick={() => handleSort("hp")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          HP <SortIndicator col="hp" />
        </button>
        <button onClick={() => handleSort("atk")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          Atk <SortIndicator col="atk" />
        </button>
        <button onClick={() => handleSort("def")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          Def <SortIndicator col="def" />
        </button>
        <button onClick={() => handleSort("spa")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          SpA <SortIndicator col="spa" />
        </button>
        <button onClick={() => handleSort("spd")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          SpD <SortIndicator col="spd" />
        </button>
        <button onClick={() => handleSort("spe")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          Spe <SortIndicator col="spe" />
        </button>
        <span className="text-right flex items-center justify-end gap-0.5 w-full">
          <button onClick={() => handleSort("bst")} className="hover:text-[var(--ds-gray-1000)] flex items-center justify-end flex-1 font-semibold">
            BST <SortIndicator col="bst" />
          </button>
          <HelpTip text={t("glossary.bst")} />
        </span>
        <button onClick={() => handleSort("tier")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          {t("dex.header.tier")} <SortIndicator col="tier" />
        </button>
      </div>

      <div ref={parentRef} data-boot-content="" className={cn("flex-1 overflow-auto", selCount > 0 && "pb-[4.75rem]")}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => {
            const f = filtered[row.index]!
            return (
              <DexRow
                key={f.id}
                form={f}
                index={row.index}
                start={row.start}
                selected={selected.has(f.id)}
                starred={starredKeys.has(`form:${f.id}`)}
                manifest={manifest}
                base={f.isBaseForm ? undefined : baseFormOf(forms, f.speciesId)}
                starAdd={starAdd}
                starRemove={starRemove}
                typeName={typeName}
                onToggleSelect={toggleSelect}
                onToggleStar={onToggleStar}
                onExpand={onExpand}
              />
            )
          })}
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-[var(--ds-gray-700)]">
            {t("dex.noMatch")} <em className="text-[var(--ds-gray-1000)]">{query || [...selectedTypes].map(typeName).join(", ") || [...selectedTraits].join(", ")}</em>
            <div className="mt-2 flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setSearch({ q: undefined, traits: undefined, trait: undefined as never, types: undefined, type: undefined as never, grouped: undefined })}>
                {t("dex.clearFilters")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {lightbox && manifest && (
        <SpriteLightbox
          form={lightbox}
          src={spriteUrls(lightbox, "thumb", lightbox.isBaseForm ? undefined : baseFormOf(forms, lightbox.speciesId), manifest).list[0] ?? ""}
          open
          onClose={() => setLightbox(null)}
        />
      )}

      {selCount > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-3">
          <div
            role="status"
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)]/95 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm"
          >
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 4 }, (_, i) => {
                const f = selectedForms[i]
                if (!f) {
                  return (
                    <span
                      key={`empty-${i}`}
                      aria-hidden
                      className="h-8 w-8 rounded-md border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-background-200)]"
                    />
                  )
                }
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={t("dex.removeSelection")}
                    onClick={() => toggleSelect(f.id)}
                    className="relative h-8 w-8 overflow-hidden rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] hover:border-[var(--ds-red-700)]"
                  >
                    <ListSprite form={f} size={32} base={f.isBaseForm ? undefined : baseFormOf(forms, f.speciesId)} manifest={manifest} />
                  </button>
                )
              })}
            </div>
            <span className="whitespace-nowrap text-xs text-[var(--ds-gray-900)]">
              <span className="tnum font-medium text-[var(--ds-gray-1000)]">{selCount}</span>
              {" "}{t("dex.selectedOf")} {t("dex.selected")}
            </span>
            <div className="flex items-center gap-1.5 border-l border-[var(--ds-gray-400)] pl-3">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                {t("dex.clear")}
              </Button>
              <Button
                size="sm"
                disabled={selCount < 2}
                title={selCount < 2 ? t("dex.compareNeedTwo") : t("dex.compare")}
                onClick={(e) => goCompare(e)}
                onContextMenu={(e) => {
                  if (selCount < 2) return
                  e.preventDefault()
                  openLinkMenu(e.clientX, e.clientY, { pathname: "/compare", search: `?ids=${[...selected].join(",")}` })
                }}
              >
                {t("dex.compare")}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
