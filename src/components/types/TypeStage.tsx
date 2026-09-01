import * as React from "react"
import { TYPE_HEX } from "@/components/ui/badge"
import { TypeGem } from "@/components/types/TypeGem"
import { getMultiplier, TYPE_NAMES } from "@/lib/domain/typeChart"
import type { TypeName } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

const FIRE_I = TYPE_NAMES.indexOf("Fire")

function ringAngle(i: number): number {
  const shifted = (i - FIRE_I + TYPE_NAMES.length) % TYPE_NAMES.length
  return (shifted / TYPE_NAMES.length) * Math.PI * 2 - Math.PI / 2
}

function defenseHit(atk: TypeName, defs: TypeName[]): number {
  if (!defs.length) return 1
  return defs.reduce((m, d) => m * getMultiplier(atk, d), 1)
}

function attackHit(atks: TypeName[], def: TypeName): number {
  if (!atks.length) return 1
  return Math.max(...atks.map((a) => getMultiplier(a, def)))
}

function markFor(mult: number): { mark?: string; color?: string } {
  if (mult >= 4) return { mark: "4×", color: "#ff5e63" }
  if (mult >= 2) return { mark: "2×", color: "#ff8a8d" }
  if (mult === 0) return { mark: "0×", color: "#cfcfcf" }
  if (mult <= 0.25) return { mark: "¼×", color: "#00ca52" }
  if (mult <= 0.5) return { mark: "½×", color: "#5dff8a" }
  return {}
}

export function TypeStage({
  selected,
  attack,
  onToggle,
  onClear,
}: {
  selected: TypeName[]
  attack: boolean
  onToggle: (t: TypeName) => void
  onClear: () => void
}) {
  const { t, typeName } = useI18n()
  const boxRef = React.useRef<HTMLDivElement>(null)
  const [box, setBox] = React.useState(560)
  React.useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const fit = () => setBox(Math.max(320, Math.min(el.clientWidth, el.clientHeight)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cx = box / 2
  const cy = box / 2
  const gem = Math.round(Math.max(56, Math.min(72, box * 0.108)))
  const radius = box * 0.34
  const core = Math.round(box * 0.26)
  const live = selected.length > 0
  const hex1 = selected[0] ? TYPE_HEX[selected[0]] : "#333"
  const hex2 = selected[1] ? TYPE_HEX[selected[1]] : hex1

  return (
    <div ref={boxRef} className="relative h-full min-h-[420px] min-w-0">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: live
            ? `radial-gradient(ellipse at 50% 48%, ${hex1}55 0%, ${hex2}22 32%, transparent 68%)`
            : "radial-gradient(ellipse at 50% 48%, #ffffff08 0%, transparent 62%)",
        }}
      />
      <div className="absolute left-1/2 top-1/2" style={{ width: box, height: box, marginLeft: -box / 2, marginTop: -box / 2 }}>
        <svg width={box} height={box} className="absolute inset-0 pointer-events-none">
          {TYPE_NAMES.map((tt, i) => {
            const a = ringAngle(i)
            const x = cx + radius * Math.cos(a)
            const y = cy + radius * Math.sin(a)
            const on = selected.includes(tt)
            const mult = !live || on ? 1 : attack ? attackHit(selected, tt) : defenseHit(tt, selected)
            const stroke = TYPE_HEX[tt] ?? "#666"
            const w = mult >= 2 ? 3 : mult === 0 ? 0.8 : mult < 1 ? 2 : 1
            const op = !live ? 0.12 : on ? 0.7 : mult >= 2 ? 0.7 : mult === 0 ? 0.2 : mult < 1 ? 0.45 : 0.12
            return (
              <line key={tt} x1={cx} y1={cy} x2={x} y2={y} stroke={stroke} strokeWidth={w} opacity={op} />
            )
          })}
          <circle cx={cx} cy={cy} r={core / 2 + 8} fill="none" stroke="#ffffff14" strokeWidth="1" />
        </svg>

        <button
          type="button"
          onClick={onClear}
          title={t("dex.clear")}
          className="absolute rounded-full overflow-hidden border border-white/15 shadow-[0_20px_60px_#000000aa]"
          style={{
            left: cx - core / 2,
            top: cy - core / 2,
            width: core,
            height: core,
            background: selected.length === 0
              ? "radial-gradient(circle at 35% 30%, #2a2a2a, #111)"
              : selected.length === 1
                ? `radial-gradient(circle at 35% 28%, ${hex1}, ${hex1}cc 55%, #000 120%)`
                : `conic-gradient(from 200deg, ${hex1} 0 50%, ${hex2} 50% 100%)`,
            boxShadow: live ? `0 0 48px ${hex1}99, inset 0 0 24px #0006` : undefined,
          }}
        >
          <span className="relative z-[1] flex flex-col items-center justify-center h-full px-3 text-center">
            {selected.length === 0 ? (
              <span className="text-[11px] font-medium text-white/50 leading-snug">{t("types.pickHint")}</span>
            ) : (
              <>
                <span className="text-[13px] font-bold uppercase tracking-wide text-white drop-shadow">
                  {typeName(selected[0]!)}
                </span>
                {selected[1] ? (
                  <span className="text-[13px] font-bold uppercase tracking-wide text-white drop-shadow">
                    {typeName(selected[1])}
                  </span>
                ) : (
                  <span className="text-[10px] text-white/70 mt-0.5">{t("types.mono")}</span>
                )}

              </>
            )}
          </span>
        </button>

        {TYPE_NAMES.map((tt, i) => {
          const a = ringAngle(i)
          const x = cx + radius * Math.cos(a)
          const y = cy + radius * Math.sin(a)
          const on = selected.includes(tt)
          const mult = !live || on ? 1 : attack ? attackHit(selected, tt) : defenseHit(tt, selected)
          const tagged = markFor(mult)
          return (
            <div
              key={tt}
              className="absolute z-[2]"
              style={{
                left: x - gem / 2,
                top: y - (gem * 1.12) / 2,
                width: gem,
              }}
            >
              <TypeGem
                type={tt}
                size={gem}
                selected={on}
                dim={live && !on && mult === 1}
                mark={tagged.mark}
                markColor={tagged.color}
                onClick={() => onToggle(tt)}
                title={tagged.mark ? `${typeName(tt)} ${tagged.mark}` : typeName(tt)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TypeModeBar({
  attack,
  onAttack,
  onDefend,
  canAttack,
}: {
  attack: boolean
  onAttack: () => void
  onDefend: () => void
  canAttack: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5 backdrop-blur-sm">
      <button
        type="button"
        onClick={onDefend}
        className={cn(
          "h-7 px-3 rounded-full text-[11px] font-semibold",
          !attack ? "bg-white text-black" : "text-white/70 hover:text-white",
        )}
      >
        {t("types.defense")}
      </button>
      <button
        type="button"
        disabled={!canAttack}
        onClick={onAttack}
        className={cn(
          "h-7 px-3 rounded-full text-[11px] font-semibold disabled:opacity-30",
          attack ? "bg-white text-black" : "text-white/70 hover:text-white",
        )}
      >
        {t("types.offense")}
      </button>
    </div>
  )
}
