import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TypeBadge } from "@/components/ui/badge"
import { HelpTip } from "@/components/ui/helptip"
import { toSlug, cn } from "@/lib/utils"
import type { MoveCategory } from "@/lib/domain/types"
import { TYPE_NAMES } from "@/lib/domain/typeChart"
import { moveIdForName } from "@/lib/dataset/load"
import { useDataset } from "@/hooks/useDataset"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { StarButton } from "@/components/ui/star"
import { useBookmarks } from "@/lib/bookmarks/BookmarksProvider"

export type MovesSearch = {
  q?: string
  type?: string
  category?: string
  sort?: string
  dir?: string
}

type SortKey = "name" | "power" | "accuracy" | "pp" | "priority" | "learners"

const CATEGORIES: MoveCategory[] = ["Physical", "Special", "Status"]
const SCROLL_KEY = "moves:scrollTop"

const CATEGORY_ICON: Record<string, string> = {
  Physical: "/sprites/category-physical.png",
  Special: "/sprites/category-special.png",
  Status: "/sprites/category-status.png",
}

/**
 * Single-select type filter: type to narrow the 18 options as you go.
 * Matches both the canonical EN name and the localized label (accent-insensitive,
 * via toSlug). URL param stays canonical EN — only the display is translated.
 */
function TypeCombobox({ value, onChange }: { value: string | null; onChange: (type: string | undefined) => void }) {
  const { t, typeName } = useI18n()
  const [text, setText] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [hi, setHi] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)

  const matches = React.useMemo(() => {
    const qs = toSlug(text)
    if (!qs) return TYPE_NAMES
    return TYPE_NAMES.filter((tt) => toSlug(tt).includes(qs) || toSlug(typeName(tt)).includes(qs))
  }, [text, typeName])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const pick = (tt: string) => {
    onChange(tt)
    setText("")
    setHi(0)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          "h-7 w-[190px] flex items-center gap-1 rounded-md border bg-[var(--ds-background-100)] px-2 cursor-text",
          open ? "border-[var(--ds-blue-700)]" : "border-[var(--ds-gray-400)]",
        )}
        onClick={() => rootRef.current?.querySelector("input")?.focus()}
      >
        {value && (
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <TypeBadge type={value} className="h-[18px] text-[10px]" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(undefined) }}
              aria-label={t("dex.removeFilter")}
              className="text-xs text-[var(--ds-gray-700)] hover:text-[var(--ds-red-700)]"
            >
              ×
            </button>
          </span>
        )}
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setHi(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
            else if (e.key === "Enter" && matches[hi]) { e.preventDefault(); pick(matches[hi]) }
            else if (e.key === "Escape") setOpen(false)
          }}
          placeholder={value ? "" : t("dex.allTypes")}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label={t("dex.header.types")}
          className="flex-1 min-w-0 bg-transparent outline-none text-xs h-full placeholder:text-[var(--ds-gray-700)]"
        />
      </div>
      {open && (
        <div
          role="listbox"
          aria-label={t("dex.header.types")}
          className="absolute z-20 top-full mt-1 left-0 w-[190px] max-h-64 overflow-auto rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] shadow-lg p-1"
        >
          {matches.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-[var(--ds-gray-700)]">{t("teams.noResults")}</div>
          ) : (
            matches.map((tt, i) => (
              <button
                key={tt}
                type="button"
                role="option"
                aria-selected={tt === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(tt)}
                onMouseEnter={() => setHi(i)}
                className={cn("w-full flex items-center px-1.5 py-1 rounded text-left", i === hi && "bg-[var(--ds-gray-100)]")}
              >
                <TypeBadge type={tt} className="h-[18px] text-[10px]" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function MovesPage() {
  const { data, loading, error } = useDataset()
  const navigate = useNavigate({ from: "/moves" })
  const search = useSearch({ from: "/moves" }) as MovesSearch
  const { t, typeName } = useI18n()
  const { has, toggle } = useBookmarks()

  const query = search.q ?? ""
  const sortBy = (search.sort as SortKey) ?? "power"
  const sortDir = (search.dir as "asc" | "desc") ?? "desc"

  const selectedType = search.type && TYPE_NAMES.includes(search.type as never) ? search.type : null
  const selectedCategory = CATEGORIES.includes(search.category as MoveCategory) ? (search.category as MoveCategory) : null

  const setSearch = React.useCallback(
    (patch: Partial<MovesSearch>) => {
      navigate({
        search: (prev) => {
          const next = { ...(prev as MovesSearch), ...patch } as MovesSearch & Record<string, unknown>
          if (!next.q) delete next.q
          if (!next.type || next.type === "all") delete next.type
          if (!next.category) delete next.category
          if (!next.sort || next.sort === "power") delete next.sort
          if (!next.dir || next.dir === "desc") delete next.dir
          return next as never
        },
        replace: false,
      })
    },
    [navigate],
  )

  const [inputValue, setInputValue] = React.useState(query)
  React.useEffect(() => setInputValue(query), [query])
  const deferredQuery = React.useDeferredValue(inputValue)
  React.useEffect(() => {
    if (deferredQuery !== query) {
      navigate({
        search: (prev) => ({ ...(prev as MovesSearch), q: deferredQuery || undefined }) as never,
        replace: true,
      })
    }
  }, [deferredQuery, query, navigate])

  const moves = React.useMemo(() => data?.core.moves ?? [], [data?.core.moves])
  const learnsets = data?.learnsets
  const extrasReady = data?.extrasReady ?? false

  const handleSort = React.useCallback(
    (col: SortKey) => {
      if (sortBy === col) setSearch({ sort: col === "power" ? undefined : col, dir: sortDir === "asc" ? undefined : "asc" })
      else setSearch({ sort: col === "power" ? undefined : col, dir: col === "power" ? undefined : "asc" })
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

  const activeCount = (selectedType ? 1 : 0) + (selectedCategory ? 1 : 0)

  const filtered = React.useMemo(() => {
    let out = moves
    const q = (search.q ?? deferredQuery).trim().toLowerCase()
    if (q) out = out.filter((m) => m.name.toLowerCase().includes(q) || m.shortDesc.toLowerCase().includes(q))
    if (selectedType) out = out.filter((m) => m.type === selectedType)
    if (selectedCategory) out = out.filter((m) => m.category === selectedCategory)
    const dir = sortDir === "asc" ? 1 : -1
    const learnersOf = (name: string): number => learnsets?.[moveIdForName(name)]?.length ?? 0
    out = [...out].sort((a, b) => {
      let av: number | string | null
      let bv: number | string | null
      if (sortBy === "name") {
        av = a.name
        bv = b.name
      } else if (sortBy === "learners") {
        if (!extrasReady) return a.name.localeCompare(b.name)
        av = learnersOf(a.name)
        bv = learnersOf(b.name)
      } else {
        // null power/accuracy sorts last regardless of direction
        av = a[sortBy]
        bv = b[sortBy]
      }
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === "string") return av.localeCompare(bv as string) * dir
      return (av - (bv as number)) * dir
    })
    return out
  }, [moves, search.q, deferredQuery, selectedType, selectedCategory, sortBy, sortDir, learnsets, extrasReady])

  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(() => 36, []),
    overscan: 10,
  })

  // Virtualized inner scroller owns its own save/restore; the router's window
  // restoration is disabled for "/moves" (App.tsx). Keyed on `loading` because
  // the skeleton swaps the element out — refs are null until data renders.
  const restoredRef = React.useRef(false)
  React.useEffect(() => {
    const el = parentRef.current
    if (!el) return
    if (!restoredRef.current && !loading) {
      restoredRef.current = true
      const raw = sessionStorage.getItem(SCROLL_KEY)
      const top = raw === null ? NaN : Number(raw)
      if (!Number.isNaN(top)) {
        // double rAF: let the virtualizer lay out rows before jumping
        requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = top }))
      }
    }
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [loading])
  const saveScroll = React.useCallback(() => {
    const el = parentRef.current
    if (el) sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
  }, [])

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-6 w-40 bg-[var(--ds-gray-100)] animate-pulse rounded" />
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
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-4 py-3 space-y-3">
        <Input placeholder={t("moves.searchPlaceholder")} value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full max-w-xl" />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--ds-gray-700)]">{t("dex.header.types")}:</span>
          <TypeCombobox value={selectedType} onChange={(tt) => setSearch({ type: tt })} />
          <span className="mx-2 h-5 w-px bg-[var(--ds-gray-400)]" aria-hidden />
          <span className="text-xs font-medium text-[var(--ds-gray-700)]">{t("sets.category")}:</span>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSearch({ category: active ? undefined : cat })}
                aria-pressed={active}
                className={cn(
                  "h-7 inline-flex items-center gap-1.5 rounded-md text-[11px] font-medium border px-2 transition-colors",
                  active
                    ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]"
                    : "bg-[var(--ds-background-200)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]",
                )}
              >
                <img src={CATEGORY_ICON[cat]} alt="" className="h-2.5 w-auto opacity-80" />
                {t(`movecat.${cat}` as TranslationKey)}
              </button>
            )
          })}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSearch({ type: undefined, category: undefined })}>
              {t("dex.clearAll")}
            </Button>
          )}
          <span className="ml-auto text-xs text-[var(--ds-gray-700)]">
            {filtered.length} / {moves.length} {t("moves.count")}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-[var(--ds-gray-700)]">
          {t("dex.sortHelp")} <span className="font-medium text-[var(--ds-gray-1000)]">{sortBy.toUpperCase()} {sortDir === "asc" ? "↑" : "↓"}</span>
          <HelpTip text={t("moves.sortHelp")} />
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-[28px_minmax(180px,1fr)_92px_96px_64px_64px_48px_64px_96px_minmax(160px,1.4fr)] gap-2 px-4 py-2 text-xs font-medium text-[var(--ds-gray-900)] border-b border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">
        <span />
        <button onClick={() => handleSort("name")} className="text-left hover:text-[var(--ds-gray-1000)] flex items-center">
          {t("dex.header.name")} <SortIndicator col="name" />
        </button>
        <span>{t("sets.type")}</span>
        <span>{t("sets.category")}</span>
        <button onClick={() => handleSort("power")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          {t("sets.power")} <SortIndicator col="power" />
        </button>
        <button onClick={() => handleSort("accuracy")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          {t("sets.accuracy")} <SortIndicator col="accuracy" />
        </button>
        <button onClick={() => handleSort("pp")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full">
          PP <SortIndicator col="pp" />
        </button>
        <button onClick={() => handleSort("priority")} className="text-right hover:text-[var(--ds-gray-1000)] flex items-center justify-end w-full whitespace-nowrap">
          Prio <SortIndicator col="priority" />
        </button>
        <span className="text-right flex items-center justify-end w-full gap-0.5 whitespace-nowrap">
          <button onClick={() => handleSort("learners")} className="hover:text-[var(--ds-gray-1000)] flex items-center">
            {t("moves.learnersCol")} <SortIndicator col="learners" />
          </button>
          <HelpTip text={t("moves.learnersHelp")} />
        </span>
        <span className="truncate">{t("moves.effect")}</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => {
            const m = filtered[row.index]!
            const learners = extrasReady && learnsets ? (learnsets[moveIdForName(m.name)]?.length ?? 0) : 0
            const moveId = moveIdForName(m.name)
            const starred = has({ kind: "move", moveId })
            return (
              <div
                key={m.name}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}
                className="w-full grid grid-cols-[28px_minmax(180px,1fr)_92px_96px_64px_64px_48px_64px_96px_minmax(160px,1.4fr)] gap-2 px-4 py-1.5 items-center text-sm border-b border-[var(--ds-gray-200)] hover:bg-[var(--ds-gray-100)]"
              >
                <StarButton
                  className="h-6 w-6"
                  active={starred}
                  onToggle={() => toggle({ kind: "move", moveId })}
                  label={starred ? t("bookmarks.remove") : t("bookmarks.add")}
                />
                <Link
                  to="/moves/$moveId"
                  params={{ moveId } as never}
                  onClick={() => saveScroll()}
                  className="contents text-left"
                >
                  <span className="font-medium truncate hover:underline">{m.name}</span>
                  <TypeBadge type={m.type} className="h-[20px]" />
                  <span className="flex items-center gap-1.5 text-xs text-[var(--ds-gray-700)]">
                    <img src={CATEGORY_ICON[m.category]} alt="" className="h-2.5 w-auto opacity-80 shrink-0" />
                    {m.category}
                  </span>
                  <span className="text-right tnum">{m.power ?? "—"}</span>
                  <span className="text-right tnum">{m.accuracy !== null ? `${m.accuracy}%` : "—"}</span>
                  <span className="text-right tnum">{m.pp ?? "—"}</span>
                  <span className="text-right tnum">{m.priority !== 0 ? (m.priority > 0 ? `+${m.priority}` : m.priority) : "—"}</span>
                  <span className="text-right tnum text-[var(--ds-gray-700)]">{extrasReady && learners > 0 ? learners : "—"}</span>
                  <span className="truncate text-xs text-[var(--ds-gray-700)]" title={m.shortDesc}>{m.shortDesc}</span>
                </Link>
              </div>
            )
          })}
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-[var(--ds-gray-700)]">
            {t("moves.noMatch")} <em className="text-[var(--ds-gray-1000)]">{query || (selectedType ? typeName(selectedType) : "")}</em>
            <div className="mt-2 flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setSearch({ q: undefined, type: undefined, category: undefined })}>
                {t("dex.clearFilters")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
