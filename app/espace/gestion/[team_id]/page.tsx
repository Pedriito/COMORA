import { requireChurch } from '@/lib/auth/church'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { QuickAddDecision } from './QuickAddDecision'
import { QuickAddTask } from './QuickAddTask'
import { IconWarning } from '@/app/espace/_components/Icons'
import { ResolveDecisionForm } from './ResolveDecisionForm'
import { toggleTask, deleteTask, deleteDecision } from '../actions'

type Profile = { id: string; first_name: string; last_name: string }

type Decision = {
  id: string
  title: string
  context: string | null
  status: string
  decision_note: string | null
  created_by: string | null
  created_at: string
  decided_at: string | null
  decided_by: string | null
}

type Task = {
  id: string
  title: string
  status: string
  assigned_to: string | null
  due_date: string | null
  created_at: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`
  return `il y a ${Math.floor(days / 30)} mois`
}

export default async function GestionTeamPage({
  params,
}: {
  params: Promise<{ team_id: string }>
}) {
  const { team_id } = await params
  const ctx = await requireChurch('membre')
  const supabase = ctx.supabase
  const churchId = ctx.church.churchId

  const isAdmin = ctx.church.role === 'admin' || ctx.church.role === 'responsable'

  // Vérification d'accès : un membre ne voit que les équipes dont il fait partie
  if (!isAdmin) {
    const { data: membership } = ctx.memberId
      ? await supabase
          .from('team_members')
          .select('id')
          .eq('church_id', churchId)
          .eq('member_id', ctx.memberId)
          .eq('team_id', team_id)
          .maybeSingle()
      : { data: null }
    if (!membership) redirect('/espace/gestion')
  }

  const [
    { data: team },
    { data: memberships },
    { data: rawDecisions },
    { data: rawTasks },
    { data: allMembers },
  ] = await Promise.all([
    supabase.from('teams').select('id, name').eq('church_id', churchId).eq('id', team_id).maybeSingle(),
    supabase.from('team_members').select('member_id, role').eq('church_id', churchId).eq('team_id', team_id),
    supabase
      .from('decisions')
      .select('id, title, context, status, decision_note, created_by, created_at, decided_at, decided_by')
      .eq('church_id', churchId)
      .eq('team_id', team_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('id, title, status, assigned_to, due_date, created_at')
      .eq('church_id', churchId)
      .eq('team_id', team_id)
      .order('created_at', { ascending: false }),
    supabase.from('members').select('id, user_id, first_name, last_name').eq('church_id', churchId),
  ])

  if (!team) redirect('/espace/gestion')

  // Tâches : `assigned_to` est une personne ; décisions : auteurs et décideurs sont des comptes
  const memberMap = new Map<string, Profile>()
  const accountMap = new Map<string, Profile>()
  allMembers?.forEach(m => {
    memberMap.set(m.id, m)
    if (m.user_id) accountMap.set(m.user_id, m)
  })

  const decisions = (rawDecisions ?? []) as Decision[]
  const tasks = (rawTasks ?? []) as Task[]

  const pendingDecisions = decisions.filter(d => d.status === 'pending')
  const resolvedDecisions = decisions.filter(d => d.status !== 'pending')

  const todoTasks = tasks.filter(t => t.status === 'todo')
  const doneTasks = tasks.filter(t => t.status === 'done')

  const teamMembers = (memberships ?? [])
    .map(m => memberMap.get(m.member_id))
    .filter((p): p is Profile => p !== undefined)

  return (
    <div className="min-h-screen bg-sand">
      <header className="bg-white border-b border-dark/8 px-4 md:px-6 py-4 flex items-center gap-3">
        <Link href="/espace/gestion" className="text-dark/40 hover:text-dark transition-colors font-sans text-lg shrink-0">‹</Link>
        <h1 className="font-display text-xl md:text-2xl text-dark font-light truncate flex-1">{team.name}</h1>
        {pendingDecisions.length > 0 && (
          <span className="shrink-0 bg-amber-100 text-amber-700 font-sans text-xs font-semibold px-2.5 py-1 rounded-full">
            {pendingDecisions.length} à décider
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-10">

        {/* ── DÉCISIONS ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display text-xl text-dark font-light">À décider</h2>
            {pendingDecisions.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center font-sans leading-none">
                {pendingDecisions.length}
              </span>
            )}
          </div>

          <QuickAddDecision teamId={team_id} />

          {pendingDecisions.length === 0 ? (
            <p className="font-sans text-sm text-dark/30 italic px-1 mt-4">
              Aucune question en attente — c'est tout bon ✓
            </p>
          ) : (
            <div className="space-y-2 mt-3">
              {pendingDecisions.map(d => {
                const author = d.created_by ? accountMap.get(d.created_by) : null
                return (
                  <div key={d.id} className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-sans text-sm text-dark font-medium leading-snug flex-1">{d.title}</p>
                        <form action={deleteDecision}>
                          <input type="hidden" name="decision_id" value={d.id} />
                          <input type="hidden" name="team_id" value={team_id} />
                          <button type="submit" aria-label="Supprimer" className="text-dark/20 hover:text-red-400 transition-colors text-xl leading-none shrink-0">
                            ×
                          </button>
                        </form>
                      </div>
                      {d.context && (
                        <p className="font-sans text-xs text-dark/50 mt-2 leading-relaxed">{d.context}</p>
                      )}
                      <p className="font-sans text-xs text-dark/30 mt-2">
                        {author ? `${author.first_name} ${author.last_name} · ` : ''}{timeAgo(d.created_at)}
                      </p>
                    </div>
                    <ResolveDecisionForm decisionId={d.id} teamId={team_id} />
                  </div>
                )
              })}
            </div>
          )}

          {resolvedDecisions.length > 0 && (
            <details className="mt-4 group">
              <summary className="font-sans text-xs text-dark/40 cursor-pointer hover:text-dark/60 transition-colors select-none list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                {resolvedDecisions.length} résolue{resolvedDecisions.length > 1 ? 's' : ''}
              </summary>
              <div className="space-y-2 mt-2">
                {resolvedDecisions.map(d => {
                  const decidedBy = d.decided_by ? accountMap.get(d.decided_by) : null
                  return (
                    <div key={d.id} className="bg-white/60 rounded-xl border border-dark/6 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-sans text-sm text-dark/40 line-through leading-snug">{d.title}</p>
                          {d.decision_note && (
                            <p className="font-sans text-xs text-teal/70 mt-1">→ {d.decision_note}</p>
                          )}
                          {d.status === 'rejected' && !d.decision_note && (
                            <p className="font-sans text-xs text-dark/25 mt-1 italic">Archivé sans suite</p>
                          )}
                          <p className="font-sans text-xs text-dark/25 mt-1.5">
                            {decidedBy ? `Tranché par ${decidedBy.first_name}` : 'Résolu'}
                            {d.decided_at ? ` · ${timeAgo(d.decided_at)}` : ''}
                          </p>
                        </div>
                        <form action={deleteDecision}>
                          <input type="hidden" name="decision_id" value={d.id} />
                          <input type="hidden" name="team_id" value={team_id} />
                          <button type="submit" aria-label="Supprimer" className="text-dark/15 hover:text-red-400 transition-colors text-lg leading-none shrink-0">
                            ×
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </section>

        {/* ── TÂCHES ────────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-xl text-dark font-light mb-3">Tâches</h2>

          <QuickAddTask teamId={team_id} teamMembers={teamMembers} />

          {todoTasks.length === 0 && doneTasks.length === 0 ? (
            <p className="font-sans text-sm text-dark/30 italic px-1 mt-4">Aucune tâche en cours.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-dark/8 overflow-hidden mt-3">
              {/* À faire */}
              {todoTasks.map(t => {
                const assignee = t.assigned_to ? memberMap.get(t.assigned_to) : null
                const overdue = t.due_date && new Date(t.due_date) < new Date()
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-dark/6 last:border-0 group">
                    <form action={toggleTask} className="shrink-0">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="current_status" value="todo" />
                      <input type="hidden" name="team_id" value={team_id} />
                      <button
                        type="submit"
                        className="w-5 h-5 rounded-full border-2 border-teal/30 hover:border-teal hover:bg-teal/10 transition-colors"
                        title="Marquer comme fait"
                      />
                    </form>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-dark">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {assignee && (
                          <span className="font-sans text-xs text-teal/60">
                            {assignee.first_name} {assignee.last_name}
                          </span>
                        )}
                        {t.due_date && (
                          <span className={`font-sans text-xs ${overdue ? 'text-red-400 font-semibold' : 'text-dark/30'}`}>
                            {overdue && <IconWarning className="w-3 h-3 inline-block mr-0.5 -mt-0.5" />}{new Date(t.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <form action={deleteTask} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="team_id" value={team_id} />
                      <button type="submit" aria-label="Supprimer" className="text-dark/20 hover:text-red-400 transition-colors text-xl leading-none">×</button>
                    </form>
                  </div>
                )
              })}

              {/* Faites */}
              {doneTasks.length > 0 && todoTasks.length > 0 && (
                <div className="border-t-2 border-dark/5" />
              )}
              {doneTasks.map(t => {
                const assignee = t.assigned_to ? memberMap.get(t.assigned_to) : null
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-dark/5 last:border-0 bg-sand/40 group">
                    <form action={toggleTask} className="shrink-0">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="current_status" value="done" />
                      <input type="hidden" name="team_id" value={team_id} />
                      <button
                        type="submit"
                        className="w-5 h-5 rounded-full bg-teal/20 border-2 border-teal/40 flex items-center justify-center text-teal/70 text-xs hover:bg-teal/10 transition-colors"
                        title="Remettre à faire"
                      >
                        ✓
                      </button>
                    </form>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-dark/35 line-through">{t.title}</p>
                      {assignee && (
                        <span className="font-sans text-xs text-dark/20">{assignee.first_name} {assignee.last_name}</span>
                      )}
                    </div>
                    <form action={deleteTask} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="team_id" value={team_id} />
                      <button type="submit" aria-label="Supprimer" className="text-dark/15 hover:text-red-400 transition-colors text-xl leading-none">×</button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
