import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, makeFakeSupabase } from '@/tests/helpers/fakeSupabase'

const { revalidateTagMock, churchOrNullMock } = vi.hoisted(() => ({
  revalidateTagMock: vi.fn(),
  churchOrNullMock: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock }))
vi.mock('@/lib/auth/church', () => ({ churchOrNull: churchOrNullMock }))

const {
  uploadAnnouncementImage,
  addRecurringAnnouncement,
  updateRecurringAnnouncement,
  deleteRecurringAnnouncement,
  moveRecurringAnnouncement,
  addAnnouncement,
} = await import('./annonces-actions')

/** Contexte d'église simulé : le client de session est le faux Supabase du test. */
function ctxWith(supabase: unknown) {
  return { supabase, userId: 'user-1', memberId: 'member-1', church: { churchId: 'church-1', role: 'responsable', isPastoral: false } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('annonces récurrentes — invalidation du cache', () => {
  it('addRecurringAnnouncement invalide `recurring-announcements`', async () => {
    churchOrNullMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({ recurring_announcements: [ok([]), ok({ id: 'ra-1' })] })
    ))
    await addRecurringAnnouncement('Titre', 'Corps')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it('updateRecurringAnnouncement invalide `recurring-announcements`', async () => {
    churchOrNullMock.mockResolvedValue(ctxWith(makeFakeSupabase({ recurring_announcements: [ok(null)] })))
    await updateRecurringAnnouncement('ra-1', 'Titre', 'Corps')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it('deleteRecurringAnnouncement invalide `recurring-announcements`', async () => {
    churchOrNullMock.mockResolvedValue(ctxWith(makeFakeSupabase({ recurring_announcements: [ok(null)] })))
    await deleteRecurringAnnouncement('ra-1')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it('moveRecurringAnnouncement invalide `recurring-announcements`', async () => {
    churchOrNullMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({
        recurring_announcements: [
          ok([{ id: 'ra-1', order_index: 0 }, { id: 'ra-2', order_index: 1 }]),
          ok(null),
          ok(null),
        ],
      })
    ))
    await moveRecurringAnnouncement('ra-2', 'up')
    expect(revalidateTagMock).toHaveBeenCalledWith('recurring-announcements', 'max')
  })

  it("n'invalide rien si l'utilisateur n'est pas autorisé (rôle responsable exigé)", async () => {
    churchOrNullMock.mockResolvedValue(null)
    const result = await addRecurringAnnouncement('Titre', 'Corps')
    expect(result).toBeNull()
    expect(churchOrNullMock).toHaveBeenCalledWith('responsable')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})

describe('téléversement d’image d’annonce', () => {
  function formWith(file: File) {
    const fd = new FormData()
    fd.set('file', file)
    return fd
  }
  function ctxWithStorage() {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      storage: { from: () => ({ upload, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) },
    }
    churchOrNullMock.mockResolvedValue(ctxWith(supabase))
    return upload
  }

  it('dépose une image autorisée dans le dossier de l’église, sous un nom aléatoire', async () => {
    const upload = ctxWithStorage()
    const url = await uploadAnnouncementImage(formWith(new File(['x'], 'photo de nous.PNG', { type: 'image/png' })))
    expect(url).toMatch(/^https:\/\/cdn\/church-1\/announcements\/.+\.png$/)
    expect(upload.mock.calls[0][0]).not.toContain('photo')
  })

  it('refuse un type de fichier non autorisé (SVG, HTML, PDF…)', async () => {
    const upload = ctxWithStorage()
    expect(await uploadAnnouncementImage(formWith(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })))).toBeNull()
    expect(await uploadAnnouncementImage(formWith(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })))).toBeNull()
    expect(upload).not.toHaveBeenCalled()
  })

  it('refuse une image trop lourde', async () => {
    const upload = ctxWithStorage()
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    expect(await uploadAnnouncementImage(formWith(big))).toBeNull()
    expect(upload).not.toHaveBeenCalled()
  })

  it('refuse sans droit de responsable', async () => {
    churchOrNullMock.mockResolvedValue(null)
    expect(await uploadAnnouncementImage(formWith(new File(['x'], 'a.png', { type: 'image/png' })))).toBeNull()
  })
})

describe('annonces de plan (volatiles) — pas d’invalidation de cache', () => {
  it("addAnnouncement (plan_announcements) n'invalide aucun tag — donnée propre au plan, jamais cachée", async () => {
    churchOrNullMock.mockResolvedValue(ctxWith(
      makeFakeSupabase({ plan_announcements: [ok([]), ok({ id: 'pa-1' })] })
    ))
    await addAnnouncement('plan-1', 'Titre', 'Corps')
    expect(revalidateTagMock).not.toHaveBeenCalled()
  })
})
