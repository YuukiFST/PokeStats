import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { SpriteThumb } from "@/components/ui/sprite"
import { useDataset } from "@/hooks/useDataset"
import type { Set } from "@/lib/domain/types"
import { useI18n } from "@/lib/i18n"

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
  return (
    <div>
      {sets.map((s) => {
        const form = data?.formsById.get(s.formId)
        return (
          <Link
            key={`${s.formId}:${s.dexGen}:${s.formatId}:${s.name}`}
            to="/form/$formId"
            params={{ formId: s.formId } as never}
            search={{ tab: "sets" } as never}
            className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--ds-gray-200)] last:border-b-0 hover:bg-[var(--ds-gray-100)] text-sm"
          >
            {form ? <SpriteThumb form={form} expandable={false} /> : <span className="w-6" />}
            <span className="truncate font-medium">{form?.name ?? s.formId}</span>
            <span className="truncate text-[var(--ds-gray-700)]">{s.name}</span>
            <Badge className="ml-auto shrink-0">{s.formatId}</Badge>
          </Link>
        )
      })}
    </div>
  )
}
