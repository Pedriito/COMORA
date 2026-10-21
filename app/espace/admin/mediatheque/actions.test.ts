import { describe, it, expect, vi, beforeEach } from 'vitest'

const { churchOrNullMock } = vi.hoisted(() => ({ churchOrNullMock: vi.fn() }))
vi.mock('@/lib/auth/church', () => ({ churchOrNull: churchOrNullMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { prepareMediaUpload, registerMediaFile, deleteMediaFile, importUnsplashPhoto, searchUnsplash } = await import('./actions')

const CH = '11111111-1111-4111-8111-111111111111'
const fetchMock = vi.fn()

function ctx(row: unknown = null) {
  const removed: string[][] = []
  const supabase: any = {
    storage: { from: () => ({ remove: (p: string[]) => { removed.push(p); return Promise.resolve({}) }, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x/${p}` } }), upload: vi.fn() }) },
    from: () => {
      const b: any = { select: () => b, eq: () => b, delete: () => b, insert: () => b, single: () => Promise.resolve({ data: { id: 'm1' }, error: null }), maybeSingle: () => Promise.resolve({ data: row, error: null }), then: (r: any) => Promise.resolve({}).then(r) }
      return b
    },
  }
  churchOrNullMock.mockResolvedValue({ supabase, church: { churchId: CH } })
  return { removed }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  process.env.UNSPLASH_ACCESS_KEY = 'k'
})

describe('médiathèque', () => {
  it('refuse sans rôle responsable', async () => {
    churchOrNullMock.mockResolvedValue(null)
    expect(await prepareMediaUpload('image/png')).toHaveProperty('error')
    await expect(searchUnsplash('x')).rejects.toThrow()
    await expect(importUnsplashPhoto('abcdef12')).rejects.toThrow()
    expect(churchOrNullMock).toHaveBeenCalledWith('responsable')
  })

  it('prépare un chemin dans le dossier de l’église et refuse un type non image', async () => {
    ctx()
    const ok = await prepareMediaUpload('image/png') as { path: string }
    expect(ok.path.startsWith(`${CH}/mediatheque/`)).toBe(true)
    expect(ok.path.endsWith('.png')).toBe(true)
    expect(await prepareMediaUpload('text/html')).toHaveProperty('error')
  })

  it('refuse d’enregistrer un chemin d’une autre église', async () => {
    ctx()
    expect(await registerMediaFile('autre-eglise/mediatheque/a.png', 'a')).toHaveProperty('error')
  })

  it('ne supprime du stockage qu’un chemin de l’église', async () => {
    const a = ctx({ id: 'm1', storage_path: 'autre/mediatheque/a.png' })
    await deleteMediaFile('m1')
    expect(a.removed).toEqual([])
    const b = ctx({ id: 'm1', storage_path: `${CH}/mediatheque/a.png` })
    await deleteMediaFile('m1')
    expect(b.removed).toEqual([[`${CH}/mediatheque/a.png`]])
  })

  it('Unsplash : refuse un identifiant mal formé et un hôte d’image inattendu', async () => {
    ctx()
    await expect(importUnsplashPhoto('http://169.254.169.254/')).rejects.toThrow('Photo invalide')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      urls: { regular: 'https://evil.example/x.jpg' }, user: { name: 'N' }, links: { download_location: 'https://api.unsplash.com/photos/x/download' },
    })))
    await expect(importUnsplashPhoto('abcdef12')).rejects.toThrow('Image Unsplash invalide')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
