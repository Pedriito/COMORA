import { Logo } from '@/components/brand/logo'
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="flex justify-center"><Logo size={44} word="serif" /></h1>
          <p className="mt-2 text-sm text-teal-dark font-sans uppercase tracking-widest">
            Espace bénévoles
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-teal/20 p-8 flex items-center justify-center">
          <p className="text-sm text-dark/40 font-sans">Chargement…</p>
        </div>
      </div>
    </div>
  )
}
