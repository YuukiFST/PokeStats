import { Link } from "@tanstack/react-router"
import { SpriteThumb } from "@/components/ui/sprite"
import { useDataset } from "@/hooks/useDataset"
import type { Set } from "@/lib/domain/types"
import { useI18n } from "@/lib/i18n"

const MOSAIC_CAP = 18

function holders(sets: Set[]): { formId: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of sets) counts.set(s.formId, (counts.get(s.formId) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([formId, count]) => ({ formId, count }))
}

export function SetUseList({
  sets,
  extrasReady,
  empty,
}: {
  sets: Set[]
  extrasReady: boolean
  empty: string
}) {
  const { t } = useI18n()
  const { data } = useDataset()
  if (!extrasReady) {
    return <div className="p-6 text-center text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>
  }
  if (!sets.length) {
    return <div className="p-6 text-center text-sm text-[var(--ds-gray-700)]">{empty}</div>
  }
  const forms = holders(sets)
  const shown = forms.slice(0, MOSAIC_CAP)
  const rest = forms.length - shown.length
  return (
    <div className="p-4">
      <p className="text-xs text-[var(--ds-gray-700)] mb-3 tnum">
        {sets.length} {t("items.setsUnit")} · {forms.length} {t("items.formsUnit")}
        {rest > 0 ? ` · ${t("items.topHolders")}` : null}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {shown.map((row) => {
          const form = data?.formsById.get(row.formId)
          return (
            <Link
              key={row.formId}
              to="/form/$formId"
              params={{ formId: row.formId } as never}
              search={{ tab: "sets" } as never}
              className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 py-1.5 hover:border-[var(--ds-blue-700)] text-sm min-w-0"
            >
              {form ? <SpriteThumb form={form} expandable={false} /> : <span className="w-6 shrink-0" />}
              <span className="truncate font-medium min-w-0">{form?.name ?? row.formId}</span>
              <span className="ml-auto shrink-0 tnum text-[10px] text-[var(--ds-gray-700)]">
                {row.count} {t("items.setsUnit")}
              </span>
            </Link>
          )
        })}
      </div>
      {rest > 0 ? (
        <p className="mt-2 text-xs text-[var(--ds-gray-700)]">+{rest} {t("items.formsUnit")}</p>
      ) : null}
    </div>
  )
}
