export default function Loading() {
  return (
    <div className="min-h-screen bg-sand">
      {/* Mobile */}
      <div className="lg:hidden bg-teal-50 min-h-screen animate-pulse">
        <div
          className="px-4 pb-3 flex items-center justify-between"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 12px, 52px)' }}
        >
          <div className="w-9 h-9 rounded-full bg-white/60 shrink-0" />
          <div className="h-9 w-24 rounded-full bg-teal/20" />
        </div>
        <div className="mx-4 mb-4">
          <div className="rounded-3xl h-40 bg-teal/20" />
        </div>
        <div className="px-4 pb-28 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-24 shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
          ))}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex gap-5 items-start max-w-5xl mx-auto px-6 py-6 animate-pulse">
        <div className="flex-1 min-w-0 space-y-5">
          <div className="rounded-2xl h-28 bg-teal/20" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-20 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
          ))}
        </div>
        <div className="w-75 shrink-0 rounded-2xl h-64 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
      </div>
    </div>
  )
}
