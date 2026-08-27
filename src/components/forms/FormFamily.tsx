import * as React from "react"
import { Link } from "@tanstack/react-router"
import type { LoadedDataset } from "@/lib/dataset/load"
import { evolutionStages } from "@/lib/domain/evolution"
import { SpriteThumb } from "@/components/ui/sprite"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { Form } from "@/lib/domain/types"

function FormNode({ form, current }: { form: Form; current: boolean }) {
  return (
    <Link
      to="/form/$formId"
      params={{ formId: form.id } as never}
      className={cn(
        "group flex flex-col items-center gap-0.5 rounded-md border p-1.5 min-w-[72px] transition-colors",
        current
          ? "border-[var(--ds-gray-1000)] bg-[var(--ds-gray-100)] ring-1 ring-[var(--ds-gray-1000)]"
          : "border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] hover:border-[var(--ds-gray-1000)]",
      )}
    >
      <SpriteThumb form={form} size={40} expandable={false} />
      <span className={cn("text-[11px] leading-tight text-center line-clamp-2", current ? "font-semibold" : "group-hover:underline")}>
        {form.name}
      </span>
    </Link>
  )
}

/**
 * Identity-level family of the open Form: sibling Forms of its Species (Mega,
 * Gmax, regional...) and its evolution line. Rendered above both tabs.
 */
export function FormFamily({ form, data }: { form: Form; data: LoadedDataset }) {
  const { t } = useI18n()

  const siblings = React.useMemo(() => {
    const sp = data.speciesById.get(form.speciesId)
    if (!sp) return []
    return sp.formIds.filter((id) => id !== form.id).map((id) => data.formsById.get(id)!).filter(Boolean)
  }, [data, form.speciesId, form.id])

  const stages = React.useMemo(() => evolutionStages(form.id, data.formsById, data.speciesById), [data, form.id])

  if (siblings.length === 0 && stages.length <= 1) return null

  return (
    <div className="px-6 py-3 space-y-3 border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)]">
      {stages.length > 1 && (
        <section aria-label={t("detail.evolution")}>
          <h2 className="text-xs font-medium text-[var(--ds-gray-700)] mb-1.5">{t("detail.evolution")}</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {stages.map((stage, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span aria-hidden className="text-[var(--ds-gray-700)] shrink-0 px-0.5">→</span>}
                <div className="flex gap-1 shrink-0">
                  {stage.map((f) => (
                    <FormNode key={f.id} form={f} current={f.id === form.id} />
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      )}
      {siblings.length > 0 && (
        <section aria-label={t("detail.forms")}>
          <h2 className="text-xs font-medium text-[var(--ds-gray-700)] mb-1.5">
            {t("detail.forms")} <span className="font-normal">({siblings.length})</span>
          </h2>
          <div className="flex flex-wrap gap-1">
            {siblings.map((f) => (
              <FormNode key={f.id} form={f} current={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
