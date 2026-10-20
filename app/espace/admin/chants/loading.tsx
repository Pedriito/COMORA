export default function Loading() {
  return (
    <div className="lg:hidden min-h-screen bg-teal-50">
      <div
        className="bg-white border-b border-teal/20 px-4 pb-4 animate-pulse flex items-center gap-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}
      >
        <div className="w-4 h-4 bg-dark/10 rounded shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-2 w-24 bg-teal/20 rounded-full" />
          <div className="h-7 w-28 bg-dark/10 rounded-lg" />
        </div>
        <div className="h-8 w-28 bg-coral/20 rounded-full shrink-0" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3 animate-pulse">
        <div className="bg-white rounded-2xl h-12 shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-white rounded-full border border-teal/20 shrink-0" />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-[56px] shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
        ))}
      </div>
    </div>
  )
}
