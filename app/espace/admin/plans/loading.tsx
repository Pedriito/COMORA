export default function Loading() {
  return (
    <div className="lg:hidden min-h-screen bg-sand">
      <div
        className="bg-white border-b border-teal/20 px-4 pb-3 animate-pulse"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 bg-dark/10 rounded shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-2 w-14 bg-teal/20 rounded-full" />
            <div className="h-7 w-40 bg-dark/10 rounded-lg" />
          </div>
          <div className="h-8 w-20 bg-coral/20 rounded-full shrink-0" />
        </div>
        <div className="mt-3 h-7 w-32 bg-dark/5 rounded-full" />
      </div>
      <div className="px-4 py-6 space-y-2 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-[72px] shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
        ))}
      </div>
    </div>
  )
}
