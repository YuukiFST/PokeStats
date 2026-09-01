import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider"
import { Badge, LinkedTypeBadge, TypeBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HelpTip } from "@/components/ui/helptip"
import { SpriteThumb } from "@/components/ui/sprite"
import { calcBST } from "@/lib/utils"
import { moveIdForName, type LoadedDataset } from "@/lib/dataset/load"
import { useDataset } from "@/hooks/useDataset"
import type { Form, MoveInfo } from "@/lib/domain/types"
import { useI18n } from "@/lib/i18n"
import { StarButton } from "@/components/ui/star"
import { useBookmarks } from "@/lib/bookmarks/BookmarksProvider"

const CATEGORY_ICON: Record<string, string> = {
  Physical: "/sprites/category-physical.png",
  Special: "/sprites/category-special.png",
  Status: "/sprites/category-status.png",
}

/** De-slug fallback so a Move without a core row still gets a readable title. */
function desluge(id: string): string {
  const words = id.replace(/([a-z])([A-Z])/g, "$1 $2").split("-")
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function resolveMove(data: LoadedDataset, moveId: string): { info: MoveInfo | null; displayName: string } {
  const direct = data.movesById.get(moveId)
  if (direct) return { info: direct, displayName: direct.name }
  // Set-referenced variant (e.g. "Hidden Power Fire") — recover the display name
  for (const s of data.sets.sets) {
    for (const slot of s.moves) {
      for (const name of slot) {
        if (moveIdForName(name) === moveId) {
          const info = data.movesByName.get(name) ?? null
          return { info, displayName: name }
        }
      }
    }
  }
  return { info: null, displayName: desluge(moveId) }
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-3 py-2 text-center min-w-[84px]">
      <div className="text-[10px] uppercase tracking-wide text-[var(--ds-gray-700)]">{label}</div>
      <div className="tnum text-lg font-semibold leading-tight">{value}</div>
    </div>
  )
}

function LearnerRow({ form }: { form: Form }) {
  return (
    <Link
      to="/form/$formId"
      params={{ formId: form.id } as never}
      className="grid grid-cols-[28px_1fr_132px_54px_54px_64px_84px] gap-2 items-center px-4 py-1 border-b border-[var(--ds-gray-200)] hover:bg-[var(--ds-gray-100)] text-sm"
    >
      <span className="text-center tnum text-xs text-[var(--ds-gray-700)]">#{String(form.speciesId).padStart(4, "0")}</span>
      <span className="flex items-center gap-2 min-w-0">
        <SpriteThumb form={form} expandable={false} />
        <span className="truncate font-medium hover:underline">{form.name}</span>
      </span>
      <span className="flex gap-1">
        {(form.types as string[]).map((tt) => (
          <TypeBadge key={tt} type={tt} />
        ))}
      </span>
      <span className="text-right tnum text-[var(--ds-gray-700)]">{form.baseStats.atk}</span>
      <span className="text-right tnum text-[var(--ds-gray-700)]">{form.baseStats.spa}</span>
      <span className="text-right tnum font-semibold">{calcBST(form.baseStats)}</span>
      <span className="flex justify-end">
        {form.tier ? <Badge className="w-[64px] justify-center">{form.tier}</Badge> : <span className="w-[64px] inline-flex justify-center text-[var(--ds-gray-700)]">—</span>}
      </span>
    </Link>
  )
}

export function MoveDetailPage() {
  const { moveId } = useParams({ strict: false }) as { moveId: string }
  const { back } = useWorkspace()
  const { data, loading } = useDataset()
  const { t } = useI18n()
  const { has, toggle } = useBookmarks()
  const [showAllLearners, setShowAllLearners] = React.useState(false)

  const resolved = React.useMemo(() => (data ? resolveMove(data, moveId) : null), [data, moveId])

  const learnerForms = React.useMemo(() => {
    if (!data || !resolved) return []
    let ids = data.learnsets[moveId]
    if (!ids && moveId.startsWith("hiddenpower")) ids = data.learnsets["hiddenpower"]
    if (!ids) return []
    return ids
      .map((id) => data.formsById.get(id))
      .filter(Boolean) as Form[]
  }, [data, resolved, moveId])

  if (loading || !data || !resolved) return <div className="p-8 text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>

  const info = resolved.info
  const shownLearners = showAllLearners ? learnerForms : learnerForms.slice(0, 60)

  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-6 py-4">
        <Button variant="ghost" size="sm" onClick={() => back({ pathname: "/moves", search: "" })} className="-ml-2 mb-2">
          ← {t("moves.back")}
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-[var(--ds-gray-700)]">{t("moves.title")}</div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
              {resolved.displayName}
              {info && <img src={CATEGORY_ICON[info.category]} alt={info.category} className="h-4 w-auto opacity-80" />}
              <StarButton
                active={has({ kind: "move", moveId })}
                onToggle={() => toggle({ kind: "move", moveId })}
                label={has({ kind: "move", moveId }) ? t("bookmarks.remove") : t("bookmarks.add")}
              />
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {info && <LinkedTypeBadge type={info.type} />}
              {info && (
                <Badge className="min-w-[84px] justify-center gap-1">
                  <img src={CATEGORY_ICON[info.category]} alt="" className="h-2.5 w-auto" /> {info.category}
                </Badge>
              )}
              {!info && <span className="text-xs text-[var(--ds-amber-1000)] bg-[var(--ds-amber-100)] border border-[var(--ds-amber-400)] rounded px-2 py-0.5">{t("moves.noDataRow")}</span>}
              <span className="text-xs text-[var(--ds-gray-700)] font-mono">{moveId}</span>
            </div>
          </div>
          {info && (
            <div className="flex gap-2 flex-wrap">
              <StatChip label={t("sets.power")} value={info.power !== null ? String(info.power) : "—"} />
              <StatChip label={t("sets.accuracy")} value={info.accuracy !== null ? `${info.accuracy}%` : "—"} />
              <StatChip label="PP" value={info.pp !== null ? String(info.pp) : "—"} />
              <StatChip label="Priority" value={info.priority !== 0 ? (info.priority > 0 ? `+${info.priority}` : String(info.priority)) : "0"} />
            </div>
          )}
        </div>
        {info && (
          <p className="mt-3 max-w-[760px] text-sm text-[var(--ds-gray-900)]">
            {info.desc}
            {info.desc !== info.shortDesc && <span className="block mt-1 text-xs text-[var(--ds-gray-700)]">{info.shortDesc}</span>}
          </p>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* learners */}
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap border-b border-[var(--ds-gray-300)]">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              {t("moves.learners")} <HelpTip text={t("moves.learnersPoolHelp")} />
            </h2>
            <span className="text-xs text-[var(--ds-gray-700)]">{learnerForms.length} {learnerForms.length === 1 ? t("moves.form") : t("dex.count")}</span>
          </div>
          {data.extrasReady ? (
            learnerForms.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--ds-gray-700)]">{t("moves.noLearners")}</div>
          ) : (
            <>
              <div className="grid grid-cols-[28px_1fr_132px_54px_54px_64px_84px] gap-2 px-4 py-2 text-xs font-medium text-[var(--ds-gray-900)] border-b border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">
                <span className="text-center">#</span>
                <span>{t("dex.header.name")}</span>
                <span>{t("dex.header.types")}</span>
                <span className="text-right">Atk</span>
                <span className="text-right">SpA</span>
                <span className="text-right font-semibold">BST</span>
                <span className="text-right">{t("dex.header.tier")}</span>
              </div>
              {[...shownLearners]
                .sort((a, b) => calcBST(b.baseStats) - calcBST(a.baseStats) || a.name.localeCompare(b.name))
                .map((f) => (
                  <LearnerRow key={f.id} form={f} />
                ))}
              {learnerForms.length > 60 && !showAllLearners && (
                <button onClick={() => setShowAllLearners(true)} className="w-full py-2.5 text-sm text-[var(--ds-blue-700)] hover:bg-[var(--ds-gray-100)] transition-colors">
                  {t("moves.showAll")} ({learnerForms.length})
                </button>
              )}
            </>
          )
          ) : (
            <div className="p-6 text-center text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>
          )}
        </section>
      </div>
    </div>
  )
}
