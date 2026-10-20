/** Fallback de <Suspense> pour PlanWorkspaceData — rendu comme enfant direct du même
 *  conteneur flex (`hidden xl:flex gap-5 ...`), donc pas de wrapper ici. */
export function WorkspaceSkeleton() {
  return (
    <>
      <div className="w-70 shrink-0 space-y-2 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl h-16 bg-white border border-teal/10" />
        ))}
      </div>
      <div className="flex-1 min-w-0 space-y-5 animate-pulse">
        <div className="rounded-2xl h-28 bg-teal/20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl h-20 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
        ))}
      </div>
      <div className="w-75 shrink-0 rounded-2xl h-64 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] animate-pulse" />
    </>
  )
}
