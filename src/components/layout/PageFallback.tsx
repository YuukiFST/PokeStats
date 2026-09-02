export function PageFallback() {
  return (
    <div className="p-8 space-y-4">
      <div className="h-6 w-32 bg-neutral-800 animate-pulse rounded" />
      <div className="h-10 bg-neutral-800 animate-pulse rounded" />
      <div className="h-96 bg-neutral-800 animate-pulse rounded" />
    </div>
  )
}