import * as React from "react"
import { useParams } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ItemIcon } from "@/components/ui/itemIcon"
import { SetUseList } from "@/components/sets/SetUseList"
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider"
import { itemIdForName, setsUsingItem } from "@/lib/domain/items"
import type { ItemKind } from "@/lib/domain/types"
import { useDataset } from "@/hooks/useDataset"
import { useI18n, type TranslationKey } from "@/lib/i18n"

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

export function ItemDetailPage() {
  const { itemId } = useParams({ strict: false }) as { itemId: string }
  const { back } = useWorkspace()
  const { data, loading, extrasReady, catalogReady } = useDataset()
  const { t } = useI18n()

  const item = data?.itemsById.get(itemId) ?? null
  const uses = React.useMemo(() => {
    if (!data || !item) return []
    return setsUsingItem(data.sets.sets, item.name)
  }, [data, item])

  if (loading || !data || !catalogReady) return <div className="p-8 text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>

  if (!item) {
    return (
      <div className="p-8 space-y-3">
        <Button variant="outline" size="sm" onClick={() => back({ pathname: "/items", search: "" })}>
          ← {t("items.back")}
        </Button>
        <div className="rounded-md border border-[var(--ds-red-700)] bg-[var(--ds-background-200)] p-4 text-sm">
          Item <code>{itemId}</code> {t("detail.notFound")}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-6 py-4">
        <Button variant="ghost" size="sm" onClick={() => back({ pathname: "/items", search: "" })} className="-ml-2 mb-2">
          ← {t("items.back")}
        </Button>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] flex items-center justify-center">
            <ItemIcon item={item} size={48} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-[var(--ds-gray-700)]">{t("items.title")}</div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <Badge>{t(KIND_KEY[item.kind])}</Badge>
              {item.gen !== null && <Badge>Gen {item.gen}</Badge>}
              {item.isNonstandard && <Badge>{item.isNonstandard}</Badge>}
              {extrasReady ? (
                <span className="text-xs text-[var(--ds-gray-700)] tnum">
                  {uses.length} {t("items.setsUnit")}
                </span>
              ) : null}
              <span className="text-xs text-[var(--ds-gray-700)] font-mono">{itemIdForName(item.name)}</span>
            </div>
            <p className="mt-3 max-w-[760px] text-sm text-[var(--ds-gray-900)]">{item.desc}</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--ds-gray-300)] flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("items.usedBy")}</h2>
            <span className="text-xs text-[var(--ds-gray-700)] tnum">
              {extrasReady ? `${uses.length} ${t("items.setsUnit")}` : t("detail.loading")}
            </span>
          </div>
          <SetUseList sets={uses} extrasReady={extrasReady} empty={t("items.noSets")} />
        </section>
      </div>
    </div>
  )
}
