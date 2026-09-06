import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Props {
  duplicateItems: string[]
  multiMega: boolean
  missingHazardRemoval: boolean
  missingSpeedControl: boolean
}

/** Composition flags over the team's resolved Sets: all clear renders one ok chip. */
export function TeamCheck(p: Props) {
  const { t } = useI18n()
  const flags: string[] = [
    ...p.duplicateItems.map((item) => `${t("teams.dupItems")}: ${item}`),
    ...(p.multiMega ? [t("teams.multiMega")] : []),
    ...(p.missingHazardRemoval ? [t("teams.noHazard")] : []),
    ...(p.missingSpeedControl ? [t("teams.noSpeed")] : []),
  ]
  return (
    <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-2">
      <div className="mb-1 text-xs font-semibold text-[var(--ds-gray-700)]">{t("teams.check")}</div>
      {flags.length === 0 ? (
        <span className="inline-flex rounded-full border border-green-700/50 bg-green-700/20 px-2 py-0.5 text-[11px] text-green-400">
          {t("teams.checkOk")}
        </span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {flags.map((f) => (
            <span
              key={f}
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                "border-amber-600/50 bg-amber-500/15 text-amber-500",
              )}
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
