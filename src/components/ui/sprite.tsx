import * as React from "react"
import { createPortal } from "react-dom"
import { getSpriteCandidates, getHighResCandidates, type SpriteBase } from "@/lib/sprites"
import { useDataset } from "@/hooks/useDataset"
import { useI18n } from "@/lib/i18n"
import type { Form } from "@/lib/domain/types"

type FormLike = {
  id: string
  name: string
  speciesId: number
  isBaseForm: boolean
  types?: readonly string[]
  tier?: string | null
}

// speciesId -> Base Form of that Species (dataset is immutable per app run)
let baseFormIndex: Map<number, Form> | null = null
function baseFormOf(forms: Form[], speciesId: number): SpriteBase | undefined {
  if (!baseFormIndex) {
    baseFormIndex = new Map()
    for (const f of forms) {
      if (f.isBaseForm && !baseFormIndex.has(f.speciesId)) baseFormIndex.set(f.speciesId, f)
    }
  }
  const b = baseFormIndex.get(speciesId)
  return b ? { id: b.id, name: b.name, speciesId: b.speciesId } : undefined
}

function useBaseFallback(form: FormLike): SpriteBase | undefined {
  const { data } = useDataset()
  return React.useMemo(() => {
    if (!data || form.isBaseForm) return undefined
    return baseFormOf(data.core.forms as Form[], form.speciesId)
  }, [data, form.speciesId, form.isBaseForm])
}

type Props = {
  form: FormLike
  alt?: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  fallback?: React.ReactNode
  expandable?: boolean
}

/* ---------- lightbox: only image, solid opaque bg, draggable ---------- */
function SpriteLightbox({
  form,
  src,
  open,
  onClose,
}: {
  form: FormLike
  src: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const base = useBaseFallback(form)
  const [animate, setAnimate] = React.useState(false)
  const [pos, setPos] = React.useState({ x: 0, y: 0 })
  const dragging = React.useRef(false)
  const start = React.useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const highRes = React.useMemo(() => getHighResCandidates(form, base), [form.id, form.name, form.speciesId, form.isBaseForm, base])
  const [hi, setHi] = React.useState(0)
  const [highLoaded, setHighLoaded] = React.useState(false)
  const [pokeHD, setPokeHD] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setPos({ x: 0, y: 0 })
      setHi(0)
      setHighLoaded(false)
      setPokeHD(null)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
      return () => cancelAnimationFrame(id)
    } else {
      setAnimate(false)
    }
  }, [open])

  // Fetch HD via PokeAPI official-artwork (handles mega/alternate correctly, e.g. aerodactyl-mega -> 10042.png)
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    const alias = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const tryFetch = async (a: string) => {
      try {
        const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${a}`)
        if (!r.ok) return null
        const j = await r.json()
        const url = j?.sprites?.other?.["official-artwork"]?.front_default || j?.sprites?.other?.home?.front_default
        return url as string | null
      } catch { return null }
    }
    ;(async () => {
      let url = await tryFetch(alias)
      // Tauros Paldea special: PokeAPI uses -breed suffix
      if (!url && alias.startsWith("tauros-paldea")) {
        url = await tryFetch(alias + "-breed")
      }

      if (!cancelled && url) setPokeHD(url)
    })()
    return () => { cancelled = true }
  }, [open, form.name])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  const onPointerMove = React.useCallback((e: PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    setPos({ x: start.current.ox + dx, y: start.current.oy + dy })
  }, [])

  const onPointerUp = React.useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
  }, [onPointerMove])

  const onHandlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true
      start.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", onPointerUp)
      e.preventDefault()
    },
    [pos.x, pos.y, onPointerMove, onPointerUp],
  )

  if (!open) return null

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
      style={{
        background: "#000",
        opacity: animate ? 1 : 0,
        transition: "opacity 220ms ease",
      }}
    >
      {/* draggable — only image, no border/light, loader until HD */}
      <div
        className="relative select-none bg-transparent"
        style={{
          opacity: animate ? 1 : 0,
          transform: `translate(${pos.x}px, ${pos.y}px) ${animate ? "scale(1)" : "scale(0.88)"}`,
          transition: dragging.current ? "none" : "transform 340ms var(--ds-motion-timing-swift), opacity 220ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onHandlePointerDown}
      >
        <div
          className="flex items-center justify-center cursor-grab active:cursor-grabbing bg-transparent relative"
          style={{ width: 360, height: 360 }}
          title="Arraste para mover — clique fora ou ESC para fechar"
        >
          {!highLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-white animate-spin" />
            </div>
          )}
          {(() => {
            const pokeSrc = pokeHD
            const hiList = highRes.list
            const hiSrc = pokeSrc ?? (hiList[hi] ?? src)
            const isHighRes = !!pokeSrc || hiSrc.includes("official-artwork") || hiSrc.includes("/home/") || hiSrc.includes("artwork")
            return (
              <img
                key={hiSrc}
                src={hiSrc}
                alt={form.name}
                width={320}
                height={320}
                decoding="async"
                title={highRes.baseFallbackUrls.has(hiSrc) ? t("sprite.baseFallback") : undefined}
                className="w-[320px] h-[320px] object-contain pointer-events-none"
                style={{ imageRendering: (isHighRes ? "auto" : "pixelated") as never, opacity: highLoaded ? 1 : 0, transition: "opacity 320ms ease" }}
                draggable={false}
                onLoad={() => setHighLoaded(true)}
                onError={() => {
                  if (pokeSrc) {
                    setPokeHD(null)
                    return
                  }
                  if (hi < hiList.length - 1) setHi((v) => v + 1)
                  else setHighLoaded(true)
                }}
              />
            )
          })()}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white text-black hover:bg-white/90 transition-colors shadow-lg"
        >
          ×
        </button>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

export function Sprite({ form, alt, size = "md", className, fallback, expandable = true }: Props) {
  const { t } = useI18n()
  const base = useBaseFallback(form)
  const { list: candidates, baseFallbackUrls } = React.useMemo(
    () => getSpriteCandidates(form, base),
    [form.id, form.name, form.speciesId, form.isBaseForm, base],
  )
  const [index, setIndex] = React.useState(0)
  const [failed, setFailed] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    setIndex(0)
    setFailed(false)
    setLoaded(false)
  }, [form.id])

  const src = candidates[index]
  const sizeCls = size === "sm" ? "w-8 h-8" : size === "md" ? "w-14 h-14" : size === "lg" ? "w-24 h-24" : "w-[120px] h-[120px]"
  const px = size === "sm" ? 32 : size === "md" ? 56 : size === "lg" ? 96 : 120

  if (failed || !src) {
    return (
      <div className={`shrink-0 rounded-md border border-dashed border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] flex items-center justify-center text-[10px] text-[var(--ds-gray-700)] ${sizeCls} ${className ?? ""}`} title={form.name}>
        {fallback ?? form.name.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  const img = (
    <img
      src={src}
      alt={alt ?? form.name}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      title={baseFallbackUrls.has(src) ? t("sprite.baseFallback") : undefined}
      className={`shrink-0 object-contain select-none ${sizeCls} ${className ?? ""} ${expandable ? "cursor-zoom-in hover:scale-[1.04] active:scale-[0.98] transition-transform duration-200 ease-out" : ""} ${loaded ? "opacity-100" : "opacity-0"}`}
      style={{ imageRendering: "auto" as never, transition: "opacity 220ms ease" }}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (index + 1 < candidates.length) setIndex((i) => i + 1)
        else setFailed(true)
      }}
    />
  )

  if (!expandable) return img

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-blue-700)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-background-100)]"
        aria-label={`Expandir ${form.name}`}
        title="Clique para expandir"
      >
        {img}
      </button>
      {open && <SpriteLightbox form={form} src={src} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}

export function SpriteThumb({ form, size = 28, expandable = true }: { form: FormLike; size?: number; expandable?: boolean }) {
  const { t } = useI18n()
  const base = useBaseFallback(form)
  const { list: candidates, baseFallbackUrls } = React.useMemo(
    () => getSpriteCandidates(form, base),
    [form.id, form.name, form.speciesId, form.isBaseForm, base],
  )
  const [idx, setIdx] = React.useState(0)
  const [fail, setFail] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [thumbLoaded, setThumbLoaded] = React.useState(false)
  React.useEffect(() => { setIdx(0); setFail(false); setThumbLoaded(false) }, [form.id])
  if (fail) return <span className="w-7 h-7 rounded bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] inline-flex items-center justify-center text-[9px] text-[var(--ds-gray-700)] shrink-0">—</span>
  const src = candidates[idx]!
  const img = (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="eager"
      title={baseFallbackUrls.has(src) ? t("sprite.baseFallback") : undefined}
      className={`object-contain shrink-0 ${expandable ? "cursor-zoom-in hover:scale-110 transition-transform duration-200" : ""} ${thumbLoaded ? "opacity-100" : "opacity-0"}`}
      style={{ imageRendering: "auto" as never, width: size, height: size, transition: "opacity 180ms ease" }}
      onLoad={() => setThumbLoaded(true)}
      onError={() => (idx + 1 < candidates.length ? setIdx(idx + 1) : setFail(true))}
    />
  )
  if (!expandable) return img
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="w-7 h-7 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-blue-700)] inline-flex items-center justify-center"
        aria-label={`Expandir ${form.name}`}
      >
        {img}
      </button>
      {open && <SpriteLightbox form={form} src={src} open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
