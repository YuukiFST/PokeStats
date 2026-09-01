import type { ReactNode } from "react"
import * as React from "react"
import { Link } from "@tanstack/react-router"
import { Badge, LinkedTypeBadge, TypeBadge, TYPE_CHIP } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InfoTip, TipRow } from "@/components/ui/infotip"
import { resolveMoveInfo, moveIdForName, type LoadedDataset } from "@/lib/dataset/load"
import type { Form, MoveInfo, Set, StatKey } from "@/lib/domain/types"
import { ItemIcon } from "@/components/ui/itemIcon"
import { itemIdForName } from "@/lib/domain/items"
import { cn, formatSpread, STAT_LABEL } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { useBookmarks } from "@/lib/bookmarks/BookmarksProvider"
import { StarButton } from "@/components/ui/star"
import { useCobblemonEgg } from "@/lib/cobblemon/CobblemonEggProvider"
import { buildPokemonEditCommand, defaultCommandIvs, STAT_KEYS } from "@/lib/cobblemon/command"

const CATEGORY_ICON: Record<string, string> = {
  Physical: "/sprites/category-physical.png",
  Special: "/sprites/category-special.png",
  Status: "/sprites/category-status.png",
}

/**
 * Move chip: type dot + name + category glyph. STAB moves take the type's soft
 * tint (instant STAB-vs-coverage read); unknown moves degrade to a dashed chip.
 * Hover = effect InfoTip, click = smart redirect to /moves/$moveId.
 * When Cobblemon pick mode is on, click selects the move for the command instead.
 */
function MoveChip({
  name,
  info,
  stab,
  muted,
  pickable,
  selected,
  onPick,
}: {
  name: string
  info: MoveInfo | null
  stab: boolean
  muted?: boolean
  pickable?: boolean
  selected?: boolean
  onPick?: () => void
}) {
  const { t } = useI18n()
  const chip = (
    <span
      className={cn(
        "flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
        pickable ? "cursor-pointer" : "cursor-help",
        selected && "ring-1 ring-[var(--ds-blue-700)]",
        info && stab ? TYPE_CHIP[info.type]?.soft : "border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-[var(--ds-gray-900)]",
        muted && "opacity-60",
        !info && "border-dashed",
      )}
      onClick={
        pickable
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              onPick?.()
            }
          : undefined
      }
      role={pickable ? "button" : undefined}
      tabIndex={pickable ? 0 : undefined}
      aria-pressed={pickable ? selected : undefined}
      title={pickable ? `${t("cobblemon.pickMove")}: ${name}` : undefined}
    >
      {info && <span aria-hidden className={cn("h-2 w-2 rounded-full shrink-0", TYPE_CHIP[info.type]?.solid)} />}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {info && <img src={CATEGORY_ICON[info.category]} alt="" className="h-2.5 w-auto opacity-80 shrink-0" />}
    </span>
  )
  const linked = pickable ? (
    chip
  ) : (
    <Link
      to="/moves/$moveId"
      params={{ moveId: moveIdForName(name) } as never}
      title={t("moves.openDetail")}
      className="flex w-full min-w-0 rounded-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-blue-700)]"
    >
      {chip}
    </Link>
  )
  if (!info) return linked
  return (
    <InfoTip
      className="w-full min-w-0"
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
    <>
      <span className="text-[var(--ds-gray-700)] whitespace-nowrap">{label}</span>
      <span className="min-w-0 font-medium">{children}</span>
    </>
  )
}

function ItemCell({
  options,
  data,
  pickable,
  selected,
  onPick,
}: {
  options: string[]
  data: LoadedDataset
  pickable?: boolean
  selected?: string
  onPick?: (name: string) => void
}) {
  const { t } = useI18n()
  const renderItem = (name: string, muted: boolean, isSelected: boolean) => {
    const info = data.itemsByName.get(name)
    const inner = (
      <span
        className={cn(
          "inline-flex items-center gap-1 min-w-0 rounded-md",
          muted && "opacity-60",
          pickable && "cursor-pointer",
          isSelected && pickable && "ring-1 ring-[var(--ds-blue-700)] px-1",
        )}
        onClick={
          pickable
            ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                onPick?.(name)
              }
            : undefined
        }
        role={pickable ? "button" : undefined}
        tabIndex={pickable ? 0 : undefined}
        aria-pressed={pickable ? isSelected : undefined}
        title={pickable ? `${t("cobblemon.pickItem")}: ${name}` : undefined}
      >
        <ItemIcon item={info} />
        <span className="truncate">{name}</span>
      </span>
    )
    if (!info) return inner
    return (
      <Link to="/items/$itemId" params={{ itemId: itemIdForName(name) } as never} className="min-w-0">
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
      </Link>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {options.map((name, i) => (
        <span key={name} className="inline-flex items-center gap-x-1">
          {i > 0 && <span className="text-[var(--ds-gray-700)]">{t("sets.or")}</span>}
          {renderItem(name, pickable ? name !== selected : i > 0, name === selected)}
        </span>
      ))}
    </span>
  )
}

export function SetCard({ set, form, data }: { set: Set; form: Form; data: LoadedDataset }) {
  const { t } = useI18n()
  const { has, toggle } = useBookmarks()
  const { unlocked, slot, setSlot } = useCobblemonEgg()
  const [copied, setCopied] = React.useState<"export" | "cobblemon" | null>(null)
  const itemOptions = set.itemOptions ?? (set.item ? [set.item] : [])
  const [itemPick, setItemPick] = React.useState(itemOptions[0] ?? "")
  const [movePicks, setMovePicks] = React.useState(() => set.moves.map((slotMoves) => slotMoves[0]!))
  const [ivs, setIvs] = React.useState<Partial<Record<StatKey, number>>>(() => defaultCommandIvs(set))
  const setRef = { kind: "set" as const, formId: set.formId, dexGen: set.dexGen, formatId: set.formatId, name: set.name }

  const flash = (kind: "export" | "cobblemon") => {
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1400)
  }

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
      ...set.moves.map((slotMoves) => `- ${slotMoves.join(" / ")}`),
    ]
      .filter((l): l is string => l !== null)
      .join("\n")
    await navigator.clipboard.writeText(text)
    flash("export")
  }

  const copyCobblemon = async () => {
    const species = data.speciesById.get(form.speciesId)
    if (!species) return
    const cmd = buildPokemonEditCommand({
      slot,
      species,
      form,
      set,
      item: itemPick || undefined,
      moves: movePicks,
      ivs,
    })
    await navigator.clipboard.writeText(cmd)
    flash("cobblemon")
  }

  const nature = set.nature ? data.naturesByName.get(set.nature) : undefined
  const ability = set.ability ? data.abilitiesByName.get(set.ability) : undefined

  return (
    <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <StarButton
          active={has(setRef)}
          onToggle={() => toggle(setRef)}
          label={has(setRef) ? t("bookmarks.remove") : t("bookmarks.add")}
        />
        <span className="font-medium text-sm">{set.name}</span>
        <Badge className="min-w-[84px] justify-center">
          {set.dexGen} • {set.formatId}
        </Badge>
        {set.teraType && <TypeBadge type={set.teraType} />}
        <div className="ml-auto flex items-center gap-2 flex-wrap shrink-0">
          {unlocked && (
            <>
              <label className="flex items-center gap-1 text-xs text-[var(--ds-gray-700)] shrink-0">
                <span className="whitespace-nowrap">{t("cobblemon.slot")}</span>
                <select
                  value={slot}
                  onChange={(e) => setSlot(Number(e.target.value))}
                  className="h-7 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1.5 text-xs"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => void copyCobblemon()}>
                {copied === "cobblemon" ? t("cobblemon.copied") : t("cobblemon.copy")}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => void copyExport()}>
            {copied === "export" ? t("cobblemon.copied") : t("detail.copyExport")}
          </Button>
        </div>
      </div>
      <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="text-xs text-[var(--ds-gray-700)] mb-1">{t("detail.moves")}</div>
          <div className="space-y-1">
            {set.moves.map((slotMoves, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-1 gap-y-1 min-w-0">
                {slotMoves.map((moveName, j) => {
                  const info = resolveMoveInfo(data.movesByName, moveName)
                  const stab = info !== null && form.types.includes(info.type)
                  const pickable = unlocked && slotMoves.length > 1
                  const selected = movePicks[i] === moveName
                  return (
                    <React.Fragment key={`${moveName}-${j}`}>
                      {j > 0 && (
                        <span className="shrink-0 text-xs text-[var(--ds-gray-700)]">{t("sets.or")}</span>
                      )}
                      <div className="w-[10rem] shrink-0">
                        <MoveChip
                          name={moveName}
                          info={info}
                          stab={stab}
                          muted={pickable ? !selected : j > 0}
                          pickable={pickable}
                          selected={pickable && selected}
                          onPick={() =>
                            setMovePicks((prev) => {
                              const next = [...prev]
                              next[i] = moveName
                              return next
                            })
                          }
                        />
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 items-center min-w-0 text-xs" style={{ gridTemplateColumns: "max-content minmax(0, 1fr)" }}>
          {itemOptions.length > 0 && (
            <DetailRow label={t("detail.item")}>
              <ItemCell
                options={itemOptions}
                data={data}
                pickable={unlocked && itemOptions.length > 1}
                selected={itemPick}
                onPick={setItemPick}
              />
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
          {unlocked ? (
            <DetailRow label={t("sets.ivs")}>
              <div className="flex flex-wrap gap-1">
                {STAT_KEYS.map((key) => (
                  <label key={key} className="inline-flex items-center gap-0.5 text-[10px] text-[var(--ds-gray-700)]">
                    <span>{STAT_LABEL[key]}</span>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      inputMode="numeric"
                      placeholder="—"
                      value={ivs[key] ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value
                        setIvs((prev) => {
                          const next = { ...prev }
                          if (raw.trim() === "") {
                            delete next[key]
                            return next
                          }
                          const n = Number(raw)
                          if (!Number.isFinite(n)) return prev
                          next[key] = Math.min(31, Math.max(0, Math.round(n)))
                          return next
                        })
                      }}
                      className="tnum h-7 w-11 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 text-xs"
                    />
                  </label>
                ))}
              </div>
            </DetailRow>
          ) : (
            formatSpread(set.ivs) && (
              <DetailRow label={t("sets.ivs")}>
                <span className="tnum">{formatSpread(set.ivs)}</span>
              </DetailRow>
            )
          )}
          {set.level && <DetailRow label={t("sets.level")}><span className="tnum">{set.level}</span></DetailRow>}
        </div>
      </div>
    </div>
  )
}
