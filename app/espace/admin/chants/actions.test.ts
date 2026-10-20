import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { redirectMock, revalidatePathMock, revalidateTagMock, createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock, revalidateTag: revalidateTagMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

const { createSong, updateSong, deleteSong } = await import('./actions')

function fakeAdminSessionClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { permission: 'admin' } }) }) }) }),
  }
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  createClientMock.mockResolvedValue(fakeAdminSessionClient())
})

describe('createSong', () => {
  it('invalide `songs` après la création du chant + arrangement', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ songs: [ok({ id: 42 })], arrangements: [ok(null)] })
    )

    await expect(
      createSong(fd({ title: 'Amazing Grace', chord_chart_key: '', chord_chart: '', arrangement_name: '', youtube_url: '', audio_url: '' }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('songs', 'max')
  })

  it("n'invalide rien si le titre est manquant", async () => {
    await expect(
      createSong(fd({ title: '', chord_chart_key: '', chord_chart: '', arrangement_name: '', youtube_url: '', audio_url: '' }))
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('updateSong', () => {
  it('invalide `songs` après la mise à jour', async () => {
    createAdminClientMock.mockReturnValue(
      makeFakeSupabase({ songs: [ok(null)], arrangements: [ok(null)] })
    )

    await expect(
      updateSong(fd({
        song_id: '42', arrangement_id: 'arr-1', title: 'Amazing Grace (v2)',
        chord_chart_key: '', chord_chart: '', arrangement_name: '', youtube_url: '', audio_url: '',
      }))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('songs', 'max')
  })
})

describe('deleteSong', () => {
  it('invalide `songs` après suppression', async () => {
    createAdminClientMock.mockReturnValue(makeFakeSupabase({ songs: [ok(null)] }))

    await expect(deleteSong(fd({ song_id: '42' }))).rejects.toThrow('NEXT_REDIRECT')

    expect(revalidateTagMock).toHaveBeenCalledWith('songs', 'max')
  })
})
