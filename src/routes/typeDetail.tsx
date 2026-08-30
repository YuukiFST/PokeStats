import * as React from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider"
import { Badge, LinkedTypeBadge, TypeBadge, TYPE_CHIP } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SpriteThumb } from "@/components/ui/sprite"
import { calcBST, cn } from "@/lib/utils"
import { getMultiplier, TYPE_NAMES } from "@/lib/domain/typeChart"
import type { TypeName } from "@/lib/domain/types"
import { moveIdForName } from "@/lib/dataset/load"
import { useDataset } from "@/hooks/useDataset"
import { useI18n } from "@/lib/i18n"

const CATEGORY_ICON: Record<string, string> = {
  Physical: "/sprites/category-physical.png",
  Special: "/sprites/category-special.png",
  Status: "/sprites/category-status.png",
}

function TypeList({ types, linked = true }: { types: TypeName[]; linked?: boolean }) {
  const { typeName } = useI18n()
  if (!types.length) return <span className="text-xs text-[var(--ds-gray-700)]">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((tt) =>
        linked ? <LinkedTypeBadge key={tt} type={tt} /> : <span key={tt} className={cn("inline-flex items-center justify-center rounded-md text-[11px] font-semibold tracking-wide border uppercase min-w-[62px] px-1 h-[20px]", TYPE_CHIP[tt]?.solid)}>{typeName(tt)}</span>,
      )}
    </div>
  )
}

export function TypeDetailPage() {
  const { typeId } = useParams({ strict: false }) as { typeId: string }
  const { back } = useWorkspace()
  const { data, loading } = useDataset()
  const { t, typeName } = useI18n()

  const valid = TYPE_NAMES.includes(typeId as TypeName)
  const tt = typeId as TypeName

  const asAttacker = React.useMemo(() => {
    if (!valid) return null
    return {
      superEffective: TYPE_NAMES.filter((d) => getMultiplier(tt, d) > 1),
      notVery: TYPE_NAMES.filter((d) => getMultiplier(tt, d) > 0 && getMultiplier(tt, d) < 1),
      noEffect: TYPE_NAMES.filter((d) => getMultiplier(tt, d) === 0),
    }
  }, [valid, tt])

  const asDefender = React.useMemo(() => {
    if (!valid) return null
    return {
      weakTo: TYPE_NAMES.filter((a) => getMultiplier(a, tt) > 1),
      resists: TYPE_NAMES.filter((a) => getMultiplier(a, tt) > 0 && getMultiplier(a, tt) < 1),
      immuneTo: TYPE_NAMES.filter((a) => getMultiplier(a, tt) === 0),
    }
  }, [valid, tt])

  const topForms = React.useMemo(() => {
    if (!data || !valid) return []
    return data.core.forms
      .filter((f) => (f.types as string[]).includes(tt))
      .sort((a, b) => calcBST(b.baseStats) - calcBST(a.baseStats))
      .slice(0, 12)
  }, [data, valid, tt])

  const topMoves = React.useMemo(() => {
    if (!data || !valid) return []
    return data.core.moves
      .filter((m) => m.type === tt && m.category !== "Status" && m.power !== null)
      .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
      .slice(0, 8)
  }, [data, valid, tt])

  if (loading || !data) return <div className="p-8 text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>

  if (!valid) {
    return (
      <div className="p-8 space-y-3">
        <Button variant="outline" size="sm" onClick={() => back()}>
          ← {t("compare.back")}
        </Button>
        <div className="rounded-md border border-[var(--ds-red-700)] bg-[var(--ds-background-200)] p-4 text-sm">
          Type <code>{typeId}</code> {t("detail.notFound")}
        </div>
      </div>
    )
  }

  const chip = TYPE_CHIP[tt]!
  const formCount = data.core.forms.filter((f) => (f.types as string[]).includes(tt)).length

  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-6 py-4">
        <Button variant="ghost" size="sm" onClick={() => back()} className="-ml-2 mb-2">
          ← {t("typeDetail.back")}
        </Button>
        <div className="flex items-center gap-4 flex-wrap">
          <span className={cn("inline-flex items-center justify-center rounded-md border h-11 px-5 text-lg font-bold tracking-wide uppercase", chip.solid)}>{typeName(tt)}</span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{t("typeDetail.title")}</h1>
            <p className="text-xs text-[var(--ds-gray-700)] mt-0.5">
              {formCount} {t("dex.count")} •{" "}
              <Link to="/" search={{ types: tt } as never} className="text-[var(--ds-blue-700)] hover:underline font-medium">
                {t("typeDetail.viewInDex")} →
              </Link>{" "}
              •{" "}
              <Link to="/moves" search={{ type: tt } as never} className="text-[var(--ds-blue-700)] hover:underline font-medium">
                {t("typeDetail.viewMoves")} →
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 grid lg:grid-cols-2 gap-4">
        {/* attacking */}
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("typeDetail.attacking")}</h2>
          <div>
            <div className="text-xs font-medium mb-1.5 text-green-500">2× — {t("typeDetail.superEffective")}</div>
            <TypeList types={asAttacker!.superEffective} />
          </div>
          <div>
            <div className="text-xs font-medium mb-1.5 text-[var(--ds-gray-900)]">½× — {t("typeDetail.notVery")}</div>
            <TypeList types={asAttacker!.notVery} />
          </div>
          <div>
            <div className="text-xs font-medium mb-1.5 text-red-400">0× — {t("typeDetail.noEffectVs")}</div>
            <TypeList types={asAttacker!.noEffect} />
          </div>
        </section>

        {/* defending */}
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 space-y-3">
          <h2 className="text-sm font-semibold">{t("typeDetail.defending")}</h2>
          <div>
            <div className="text-xs font-medium mb-1.5 text-red-400">2× — {t("typeDetail.weakTo")}</div>
            <TypeList types={asDefender!.weakTo} />
          </div>
          <div>
            <div className="text-xs font-medium mb-1.5 text-green-500">½× — {t("typeDetail.resists")}</div>
            <TypeList types={asDefender!.resists} />
          </div>
          <div>
            <div className="text-xs font-medium mb-1.5 text-[var(--ds-gray-900)]">0× — {t("typeDetail.immuneTo")}</div>
            <TypeList types={asDefender!.immuneTo} />
          </div>
        </section>
      </div>

      <div className="px-6 pb-6 grid lg:grid-cols-[1fr_380px] gap-4">
        {/* strongest forms of this type */}
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--ds-gray-300)]">
            <h2 className="text-sm font-semibold">{t("typeDetail.topForms")}</h2>
            <Link to="/" search={{ types: tt } as never} className="text-xs text-[var(--ds-blue-700)] hover:underline font-medium">
              {t("typeDetail.viewInDex")} →
            </Link>
          </div>
          <div>
            {topForms.map((f) => (
              <Link
                key={f.id}
                to="/form/$formId"
                params={{ formId: f.id } as never}
                className="grid grid-cols-[28px_1fr_140px_64px_84px] gap-2 items-center px-4 py-1 border-b border-[var(--ds-gray-200)] last:border-b-0 hover:bg-[var(--ds-gray-100)] text-sm"
              >
                <span className="text-center tnum text-xs text-[var(--ds-gray-700)]">#{String(f.speciesId).padStart(4, "0")}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <SpriteThumb form={f} expandable={false} />
                  <span className="truncate font-medium">{f.name}</span>
                </span>
                <span className="flex gap-1">
                  {(f.types as string[]).map((x) => (
                    <TypeBadge key={x} type={x} />
                  ))}
                </span>
                <span className="text-right tnum font-semibold">{calcBST(f.baseStats)}</span>
                <span className="flex justify-end">
                  {f.tier ? <Badge className="w-[64px] justify-center">{f.tier}</Badge> : <span className="w-[64px] inline-flex justify-center text-[var(--ds-gray-700)]">—</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* strongest moves of this type */}
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t("typeDetail.topMoves")}</h2>
            <Link to="/moves" search={{ type: tt } as never} className="text-xs text-[var(--ds-blue-700)] hover:underline font-medium">
              {t("typeDetail.viewMoves")} →
            </Link>
          </div>
          <div className="grid gap-1">
            {topMoves.map((m) => (
              <Link
                key={m.name}
                to="/moves/$moveId"
                params={{ moveId: moveIdForName(m.name) } as never}
                className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 py-1.5 text-sm hover:border-[var(--ds-blue-700)] transition-colors"
              >
                <img src={CATEGORY_ICON[m.category]} alt="" className="h-2.5 w-auto opacity-80 shrink-0" title={m.category} />
                <span className="truncate font-medium">{m.name}</span>
                <span className="ml-auto tnum text-xs text-[var(--ds-gray-700)] shrink-0">{m.power} BP</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
