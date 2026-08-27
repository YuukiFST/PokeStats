import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { TYPE_NAMES } from "@/lib/domain/typeChart"
import type { TypeName } from "@/lib/domain/types"
import { moveIdForName } from "@/lib/dataset/load"
import { useDataset } from "./useDataset"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { toSlug } from "@/lib/utils"
import { TypeBadge } from "@/components/ui/badge"

type Result =
  | { kind: "form"; key: string; label: string; hint: string; formId: string }
  | { kind: "move"; key: string; label: string; hint: string; moveId: string }
  | { kind: "type"; key: string; label: TypeName }

const SECTION_LABEL: Record<Result["kind"], TranslationKey> = {
  form: "palette.forms",
  type: "palette.types",
  move: "palette.moves",
}

/**
 * Universal jump box: Forms, Moves and Types in one ranked list.
 * Enter picks the first hit; every result deep-links into its hub page.
 */
export function CommandPalette() {
  const { data } = useDataset()
  const navigate = useNavigate()
  const { t, typeName } = useI18n()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setQ("")
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const groups = React.useMemo((): { kind: Result["kind"]; items: Result[] }[] => {
    if (!data || !q.trim()) return []
    const qq = q.trim().toLowerCase()

    const forms: Result[] = data.core.forms
      .filter((f) => f.name.toLowerCase().includes(qq) || f.id.includes(qq))
      .sort((a, b) => {
        const aExact = a.name.toLowerCase() === qq ? 0 : 1
        const bExact = b.name.toLowerCase() === qq ? 0 : 1
        return aExact - bExact || a.name.localeCompare(b.name)
      })
      .slice(0, 6)
      .map((f) => ({ kind: "form" as const, key: f.id, label: f.name, hint: `${f.types.map(typeName).join(" / ")}`, formId: f.id }))

    const qs = toSlug(qq)
    const types: Result[] = TYPE_NAMES.filter(
      (tt) => toSlug(tt).startsWith(qs) || toSlug(typeName(tt)).startsWith(qs),
    ).map(
      (tt) => ({ kind: "type" as const, key: tt, label: tt }),
    )

    const moves: Result[] = data.core.moves
      .filter((m) => m.name.toLowerCase().includes(qq))
      .slice(0, 6)
      .map((m) => ({ kind: "move" as const, key: m.name, label: m.name, hint: `${typeName(m.type)} · ${m.category}`, moveId: moveIdForName(m.name) }))

    const out: { kind: Result["kind"]; items: Result[] }[] = [
      { kind: "form", items: forms },
      { kind: "type", items: types },
      { kind: "move", items: moves },
    ]
    return out.filter((g) => g.items.length > 0)
  }, [data, q, typeName])

  const flat = React.useMemo(() => groups.flatMap((g) => g.items), [groups])

  const go = React.useCallback(
    (r: Result) => {
      setOpen(false)
      if (r.kind === "form") navigate({ to: "/form/$formId", params: { formId: r.formId } as never })
      else if (r.kind === "type") navigate({ to: "/types/$typeId", params: { typeId: r.label } as never })
      else navigate({ to: "/moves/$moveId", params: { moveId: r.moveId } as never })
    },
    [navigate],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder={t("palette.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && flat[0]) go(flat[0])
          }}
          className="w-full h-11 px-4 bg-transparent outline-none border-b border-[var(--ds-gray-400)] text-sm"
        />
        <div className="max-h-80 overflow-auto p-1">
          {flat.length === 0 ? (
            <div className="p-3 text-sm text-[var(--ds-gray-700)]">{q ? t("palette.noResults") : t("palette.typeToSearch")}</div>
          ) : (
            groups.map((g) => (
              <div key={g.kind}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ds-gray-700)]">
                  {t(SECTION_LABEL[g.kind])}
                </div>
                {g.items.map((r) =>
                  r.kind === "type" ? (
                    <button
                      key={`type-${r.key}`}
                      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--ds-gray-100)] flex items-center justify-between gap-2 text-sm"
                      onClick={() => go(r)}
                    >
                      <TypeBadge type={r.label} />
                      <span className="text-xs text-[var(--ds-gray-700)]">{t("palette.typeHint")}</span>
                    </button>
                  ) : (
                    <button
                      key={`${r.kind}-${r.key}`}
                      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--ds-gray-100)] flex items-center justify-between gap-2 text-sm"
                      onClick={() => go(r)}
                    >
                      <span className="truncate">{r.label}</span>
                      <span className="text-xs text-[var(--ds-gray-700)] shrink-0 truncate max-w-[220px]">{r.hint}</span>
                    </button>
                  ),
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
