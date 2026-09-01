import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ItemIcon } from "@/components/ui/itemIcon"
import { HelpTip } from "@/components/ui/helptip"
import { cn } from "@/lib/utils"
import { ITEM_KINDS, itemIdForName } from "@/lib/domain/items"
import type { ItemKind } from "@/lib/domain/types"
import { useDataset } from "@/hooks/useDataset"
import { useI18n, type TranslationKey } from "@/lib/i18n"

export type ItemsSearch = {
  q?: string
  kind?: string
  used?: string
}

const KIND_KEY: Record<ItemKind, TranslationKey> = {
  choice: "items.kind.choice",
  berry: "items.kind.berry",
  mega: "items.kind.mega",
  zcrystal: "items.kind.zcrystal",
  plate: "items.kind.plate",
  memory: "items.kind.memory",
  drive: "items.kind.drive",
  utility: "items.kind.utility",
}

const SCROLL_KEY = "items:scrollTop"

export function ItemsPage() {
  const search = useSearch({ strict: false }) as ItemsSearch
  const navigate = useNavigate()
  const { data, loading, error, extrasReady } = useDataset()
  const { t } = useI18n()
  const [inputValue, setInputValue] = React.useState(search.q ?? "")
  const deferredQuery = React.useDeferredValue(inputValue)

  React.useEffect(() => {
    setInputValue(search.q ?? "")
  }, [search.q])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const q = inputValue.trim() || undefined
      if (q === search.q) return
      navigate({ to: "/items", search: { ...search, q } as never })
    }, 200)
    return () => window.clearTimeout(id)
  }, [inputValue, navigate, search])

  const setSearch = (patch: Partial<ItemsSearch>) => {
    navigate({ to: "/items", search: { ...search, ...patch } as never })
  }

  const usedCounts = React.useMemo(() => {
    if (!data || !extrasReady) return null
    const counts = new Map<string, number>()
    const bump = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1)
    for (const s of data.sets.sets) {
      if (s.item) bump(s.item)
      if (s.itemOptions) for (const n of s.itemOptions) bump(n)
    }
    return counts
  }, [data, extrasReady])

  const kind = ITEM_KINDS.includes(search.kind as ItemKind) ? (search.kind as ItemKind) : null
  const usedOnly = search.used === "1"

  const filtered = React.useMemo(() => {
    const list = data?.core.items ?? []
    let out = list
    const q = (search.q ?? deferredQuery).trim().toLowerCase()
    if (q) {
      out = out.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.shortDesc.toLowerCase().includes(q) ||
          it.desc.toLowerCase().includes(q),
      )
    }
    if (kind) out = out.filter((it) => it.kind === kind)
    if (usedOnly && usedCounts) out = out.filter((it) => (usedCounts.get(it.name) ?? 0) > 0)
    return out
  }, [data, search.q, deferredQuery, kind, usedOnly, usedCounts])

  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(() => 44, []),
    overscan: 12,
  })

  const restoredRef = React.useRef(false)
  React.useEffect(() => {
    const el = parentRef.current
    if (!el) return
    if (!restoredRef.current && !loading) {
      restoredRef.current = true
      const raw = sessionStorage.getItem(SCROLL_KEY)
      const top = raw === null ? NaN : Number(raw)
      if (!Number.isNaN(top)) {
        requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollTop = top }))
      }
    }
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop))
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [loading])

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
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("items.title")}</h1>
          <p className="text-xs text-[var(--ds-gray-700)] mt-0.5">{t("items.navDesc")}</p>
        </div>
        <Input placeholder={t("items.searchPlaceholder")} value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full max-w-xl" />
        <div className="flex flex-wrap items-center gap-1.5">
          {ITEM_KINDS.map((k) => {
            const active = kind === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSearch({ kind: active ? undefined : k })}
                aria-pressed={active}
                className={cn(
                  "h-7 rounded-md text-[11px] font-medium border px-2 transition-colors",
                  active
                    ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]"
                    : "bg-[var(--ds-background-100)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]",
                )}
              >
                {t(KIND_KEY[k])}
              </button>
            )
          })}
          <span className="mx-1 h-5 w-px bg-[var(--ds-gray-400)]" />
          <button
            type="button"
            onClick={() => setSearch({ used: usedOnly ? undefined : "1" })}
            aria-pressed={usedOnly}
            className={cn(
              "h-7 rounded-md text-[11px] font-medium border px-2 transition-colors",
              usedOnly
                ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]"
                : "bg-[var(--ds-background-100)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]",
            )}
          >
            {t("items.usedInSets")}
          </button>
          <HelpTip text={t("items.usedHelp")} />
          <span className="ml-auto text-xs text-[var(--ds-gray-700)] tnum">
            {filtered.length} {t("items.count")}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-sm text-[var(--ds-gray-700)]">{t("items.noMatch")}</div>
      ) : (
        <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const it = filtered[row.index]!
              const usedCount = usedCounts?.get(it.name) ?? null
              return (
                <Link
                  key={it.name}
                  to="/items/$itemId"
                  params={{ itemId: itemIdForName(it.name) } as never}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: row.size, transform: `translateY(${row.start}px)` }}
                  className="grid grid-cols-[32px_minmax(0,220px)_88px_1fr_72px] gap-2 items-center px-4 border-b border-[var(--ds-gray-200)] hover:bg-[var(--ds-gray-100)]"
                >
                  <ItemIcon item={it} />
                  <span className="truncate font-medium text-sm">{it.name}</span>
                  <Badge className="justify-center text-[10px]">{t(KIND_KEY[it.kind])}</Badge>
                  <span className="truncate text-xs text-[var(--ds-gray-700)]">{it.shortDesc}</span>
                  <span className="text-right tnum text-xs text-[var(--ds-gray-700)]">
                    {usedCount === null ? "…" : usedCount > 0 ? usedCount : "—"}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
