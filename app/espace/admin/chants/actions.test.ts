import { describe, it, expect, vi, beforeEach } from 'vitest'

const { redirectMock, revalidatePathMock, revalidateTagMock, requireChurchMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  requireChurchMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock, revalidateTag: revalidateTagMock }))
vi.mock('@/lib/auth/church', () => ({ requireChurch: requireChurchMock }))

const { createSong, updateSong, deleteSong } = await import('./actions')

const CHURCH = 'church-a'
const SONG = '7b0c1c5e-1a2b-4c3d-8e9f-0a1b2c3d4e5f'

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] }

/** Faux client qui enregistre chaque opération et ses filtres. */
function recordingClient(results: Record<string, unknown> = {}) {
  const calls: Call[] = []
  function from(table: string) {
    const call: Call = { table, op: 'select', filters: [] }
    calls.push(call)
    const resp = { data: results[table] ?? null, error: null }
    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: (payload: unknown) => { call.op = 'insert'; call.payload = payload; return builder },
      update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return builder },
      delete: () => { call.op = 'delete'; return builder },
      eq: (col: string, val: unknown) => { call.filters.push([col, val]); return builder },
      single: () => Promise.resolve(resp),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resp).then(resolve),
    }
    return builder
  }
  return { from, calls }
}

function useChurch(client: ReturnType<typeof recordingClient>) {
  requireChurchMock.mockResolvedValue({ supabase: client, church: { churchId: CHURCH, role: 'responsable' } })
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

const EMPTY = { chord_chart_key: '', chord_chart: '', arrangement_name: '', youtube_url: '', audio_url: '' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSong', () => {
  it('exige le rôle responsable et rattache chant et arrangement à l’église courante', async () => {
    const client = recordingClient({ songs: { id: SONG } })
    useChurch(client)

    await expect(createSong(fd({ title: 'Amazing Grace', ...EMPTY }))).rejects.toThrow(`NEXT_REDIRECT:/espace/admin/chants/${SONG}/modifier?created=1`)

    expect(requireChurchMock).toHaveBeenCalledWith('responsable')
    expect(client.calls[0]).toMatchObject({ table: 'songs', op: 'insert', payload: { church_id: CHURCH, title: 'Amazing Grace' } })
    expect(client.calls[1]).toMatchObject({ table: 'arrangements', op: 'insert', payload: { church_id: CHURCH, song_id: SONG } })
    expect(revalidateTagMock).toHaveBeenCalledWith('songs', 'max')
  })

  it("n'invalide rien si le titre est manquant", async () => {
    useChurch(recordingClient())
    await expect(createSong(fd({ title: '', ...EMPTY }))).rejects.toThrow('NEXT_REDIRECT')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })

  it('ne fait rien si le contrôle de rôle redirige', async () => {
    requireChurchMock.mockImplementation(() => { throw new Error('NEXT_REDIRECT:/espace/dashboard') })
    await expect(createSong(fd({ title: 'X', ...EMPTY }))).rejects.toThrow('NEXT_REDIRECT:/espace/dashboard')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('updateSong', () => {
  it("garde l'id uuid tel quel et filtre par église", async () => {
    const client = recordingClient()
    useChurch(client)

    await expect(
      updateSong(fd({ song_id: SONG, arrangement_id: 'arr-1', title: 'Amazing Grace (v2)', ...EMPTY }))
    ).rejects.toThrow(`NEXT_REDIRECT:/espace/admin/chants/${SONG}/modifier?saved=1`)

    expect(requireChurchMock).toHaveBeenCalledWith('responsable')
    const song = client.calls.find(c => c.table === 'songs')!
    expect(song.filters).toEqual([['id', SONG], ['church_id', CHURCH]])
    const arr = client.calls.find(c => c.table === 'arrangements')!
    expect(arr.filters).toEqual([['id', 'arr-1'], ['song_id', SONG], ['church_id', CHURCH]])
    expect(revalidateTagMock).toHaveBeenCalledWith('songs', 'max')
  })
})

describe('deleteSong', () => {
  it("supprime seulement dans l'église courante", async () => {
    const client = recordingClient()
    useChurch(client)

    await expect(deleteSong(fd({ song_id: SONG }))).rejects.toThrow('NEXT_REDIRECT')

    expect(client.calls[0]).toMatchObject({ table: 'songs', op: 'delete', filters: [['id', SONG], ['church_id', CHURCH]] })
    expect(revalidateTagMock).toHaveBeenCalledWith('songs', 'max')
  })
})
