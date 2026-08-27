import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Badge, LinkedTypeBadge, TypeBadge, TYPE_CHIP } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InfoTip, TipRow } from "@/components/ui/infotip"
import { resolveMoveInfo, moveIdForName, type LoadedDataset } from "@/lib/dataset/load"
import type { Form, ItemInfo, MoveInfo, Set } from "@/lib/domain/types"
import { cn, formatSpread, STAT_LABEL } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

const CATEGORY_ICON: Record<string, string> = {
  Physical: "/sprites/category-physical.png",
  Special: "/sprites/category-special.png",
  Status: "/sprites/category-status.png",
}

/** 24x24 cell of the vendored Showdown itemicons sheet, positioned by spriteNum. */
function ItemIcon({ item }: { item: ItemInfo | undefined }) {
  if (!item || item.spriteNum === null) return null
  const left = (item.spriteNum % 16) * 24
  const top = Math.floor(item.spriteNum / 16) * 24
  return (
    <span
      aria-hidden
      className="inline-block h-6 w-6 shrink-0 bg-no-repeat"
      style={{ backgroundImage: "url(/sprites/itemicons-sheet.png)", backgroundPosition: `-${left}px -${top}px` }}
    />
  )
}

/**
 * Move chip: type dot + name + category glyph. STAB moves take the type's soft
 * tint (instant STAB-vs-coverage read); unknown moves degrade to a dashed chip.
 * Hover = effect InfoTip, click = smart redirect to /moves/$moveId.
 */
function MoveChip({ name, info, stab, muted }: { name: string; info: MoveInfo | null; stab: boolean; muted?: boolean }) {
  const { t } = useI18n()
  const chip = (
    <span
      className={cn(
        "inline-flex max-w-full cursor-help items-center gap-1.5 rounded-md border px-2 h-[22px] text-xs font-medium",
        info && stab ? TYPE_CHIP[info.type]?.soft : "border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-[var(--ds-gray-900)]",
        muted && "opacity-60",
        !info && "border-dashed",
      )}
    >
      {info && <span aria-hidden className={cn("h-2 w-2 rounded-full shrink-0", TYPE_CHIP[info.type]?.solid)} />}
      <span className="truncate">{name}</span>
      {info && <img src={CATEGORY_ICON[info.category]} alt="" className="h-2.5 w-auto opacity-80 shrink-0" />}
    </span>
  )
  const linked = (
    <Link
      to="/moves/$moveId"
      params={{ moveId: moveIdForName(name) } as never}
      title={t("moves.openDetail")}
      className="inline-flex max-w-full rounded-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-blue-700)]"
    >
      {chip}
    </Link>
  )
  if (!info) return linked
  return (
    <InfoTip
      tip={
        <div className="space-y-1.5">
          <TipRow label={t("sets.type")}>
            <LinkedTypeBadge type={info.type} className="h-[18px] text-[10px]" />
            {stab && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ds-gray-700)]">
                {t("sets.stab")} · 1.5×
              </span>
            )}
          </TipRow>
          <TipRow label={t("sets.category")}>
            <img src={CATEGORY_ICON[info.category]} alt="" className="h-2.5 w-auto" />
            {info.category}
          </TipRow>
          <TipRow label={t("sets.power")}>
            <span className="tnum">{info.power !== null ? `${info.power} BP` : "—"}</span>
          </TipRow>
          <TipRow label={t("sets.accuracy")}>
            <span className="tnum">{info.accuracy !== null ? `${info.accuracy}%` : "—"}</span>
          </TipRow>
          <p className="pt-0.5 text-[var(--ds-gray-700)]">{info.shortDesc}</p>
        </div>
      }
    >
      {linked}
    </InfoTip>
  )
}

function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[52px_1fr] gap-x-1.5 items-center min-w-0 text-xs">
      <span className="text-[var(--ds-gray-700)] shrink-0">{label}</span>
      <span className="min-w-0 font-medium">{children}</span>
    </div>
  )
}

function ItemCell({ options, data }: { options: string[]; data: LoadedDataset }) {
  const { t } = useI18n()
  const renderItem = (name: string, muted: boolean) => {
    const info = data.itemsByName.get(name)
    const inner = (
      <span className={cn("inline-flex items-center gap-1 min-w-0", muted && "opacity-60")}>
        <ItemIcon item={info} />
        <span className="truncate">{name}</span>
      </span>
    )
    if (!info) return inner
    return (
      <InfoTip
        tip={
          <div className="flex items-start gap-2">
            <ItemIcon item={info} />
            <div className="space-y-1 min-w-0">
              <div className="font-semibold">{info.name}</div>
              <p className="text-[var(--ds-gray-700)]">{info.shortDesc}</p>
            </div>
          </div>
        }
      >
        {inner}
      </InfoTip>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {renderItem(options[0]!, false)}
      {options.length > 1 && (
        <>
          {options.slice(1).map((alt) => (
            <span key={alt} className="inline-flex items-center gap-x-1">
              <span className="text-[var(--ds-gray-700)]">{t("sets.or")}</span>
              {renderItem(alt, true)}
            </span>
          ))}
        </>
      )}
    </span>
  )
}

export function SetCard({ set, form, data }: { set: Set; form: Form; data: LoadedDataset }) {
  const { t } = useI18n()
  const copyExport = async () => {
    const evs = formatSpread(set.evs)
    const ivs = formatSpread(set.ivs)
    const text = [
      `${set.name} @ ${set.item ?? "No Item"}`,
      set.ability ? `Ability: ${set.ability}` : null,
      evs ? `EVs: ${evs}` : null,
      ivs ? `IVs: ${ivs}` : null,
      set.nature ? `${set.nature} Nature` : null,
      set.teraType && set.dexGen === "sv" ? `Tera Type: ${set.teraType}` : null,
      set.level ? `Level: ${set.level}` : null,
      ...set.moves.map((slot) => `- ${slot.join(" / ")}`),
    ]
      .filter((l): l is string => l !== null)
      .join("\n")
    await navigator.clipboard.writeText(text)
  }

  const nature = set.nature ? data.naturesByName.get(set.nature) : undefined
  const ability = set.ability ? data.abilitiesByName.get(set.ability) : undefined

  return (
    <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{set.name}</span>
        <Badge className="min-w-[84px] justify-center">
          {set.dexGen} • {set.formatId}
        </Badge>
        {set.teraType && <TypeBadge type={set.teraType} />}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void copyExport()}>
          {t("detail.copyExport")}
        </Button>
      </div>
      <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="text-xs text-[var(--ds-gray-700)] mb-1">{t("detail.moves")}</div>
          <div className="space-y-1">
            {set.moves.map((slot, i) => {
              const primary = resolveMoveInfo(data.movesByName, slot[0]!)
              const stab = primary !== null && form.types.includes(primary.type)
              return (
                <div key={i} className="flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0">
                  <MoveChip name={slot[0]!} info={primary} stab={stab} />
                  {slot.length > 1 && (
                    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0">
                      {slot.slice(1).map((alt) => (
                        <span key={alt} className="inline-flex items-center gap-x-1">
                          <span className="text-xs text-[var(--ds-gray-700)]">{t("sets.or")}</span>
                          <MoveChip name={alt} info={resolveMoveInfo(data.movesByName, alt)} stab={false} muted />
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="space-y-1.5 min-w-0">
          {set.item && (
            <DetailRow label={t("detail.item")}>
              <ItemCell options={set.itemOptions ?? [set.item]} data={data} />
            </DetailRow>
          )}
          {set.ability && (
            <DetailRow label={t("detail.ability")}>
              {ability ? (
                <InfoTip
                  tip={
                    <div className="space-y-1">
                      <div className="font-semibold">{ability.name}</div>
                      <p className="text-[var(--ds-gray-700)]">{ability.shortDesc}</p>
                    </div>
                  }
                >
                  <span className="cursor-help underline decoration-dotted decoration-[var(--ds-gray-400)] underline-offset-2">{set.ability}</span>
                </InfoTip>
              ) : (
                set.ability
              )}
            </DetailRow>
          )}
          {set.nature && (
            <DetailRow label={t("detail.nature")}>
              {nature ? (
                <InfoTip
                  tip={
                    nature.plus || nature.minus ? (
                      <div className="space-y-0.5 tnum">
                        {nature.plus && <div>+10% {STAT_LABEL[nature.plus] ?? nature.plus}</div>}
                        {nature.minus && <div>−10% {STAT_LABEL[nature.minus] ?? nature.minus}</div>}
                      </div>
                    ) : (
                      <span className="text-[var(--ds-gray-700)]">{t("sets.natureNeutral")}</span>
                    )
                  }
                >
                  <span className="cursor-help underline decoration-dotted decoration-[var(--ds-gray-400)] underline-offset-2">{set.nature}</span>
                </InfoTip>
              ) : (
                set.nature
              )}
            </DetailRow>
          )}
          {formatSpread(set.evs) && <DetailRow label={t("detail.evs")}><span className="tnum">{formatSpread(set.evs)}</span></DetailRow>}
          {formatSpread(set.ivs) && <DetailRow label={t("sets.ivs")}><span className="tnum">{formatSpread(set.ivs)}</span></DetailRow>}
          {set.level && <DetailRow label={t("sets.level")}><span className="tnum">{set.level}</span></DetailRow>}
        </div>
      </div>
    </div>
  )
}
