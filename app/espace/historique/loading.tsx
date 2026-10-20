export default function Loading() {
  return (
    <div className="lg:hidden min-h-screen bg-teal-50">
      <div className="px-5 pb-4 animate-pulse" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 52px)' }}>
        <div className="h-2.5 w-20 bg-teal/25 rounded-full mb-3" />
        <div className="h-10 w-44 bg-dark/10 rounded-xl" />
      </div>
      <div className="px-4 pb-6 space-y-3 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-[72px] shadow-[0_1px_4px_rgba(0,0,0,0.06)]" />
        ))}
      </div>
    </div>
  )
}
