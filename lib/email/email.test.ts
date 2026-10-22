import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTH_TEMPLATES } from './auth-templates'
import { emailButton, esc, renderEmail } from './layout'

const root = process.cwd()

describe('mise en page des e-mails', () => {
  const html = renderEmail({ preheader: 'Aperçu', heading: 'Bonjour', body: '<p>Texte</p>', churchName: 'Église <b>X</b>', reason: 'Raison.' })

  it('porte le logo, le nom de marque et les liens légaux', () => {
    expect(html).toContain('/email/logo.png')
    expect(html).toContain('Comora')
    expect(html).toContain('/confidentialite')
    expect(html).toContain('/cgv')
    expect(html).toContain('bonjour@comora.fr')
  })

  it("échappe le nom de l'église et les valeurs saisies", () => {
    expect(html).not.toContain('<b>X</b>')
    expect(html).toContain('Église &lt;b&gt;X&lt;/b&gt;')
    expect(esc(`"<a>'&`)).toBe('&quot;&lt;a&gt;&#39;&amp;')
    expect(emailButton({ label: '<x>', url: 'https://a.fr' })).toContain('&lt;x&gt;')
  })
})

describe('modèles des e-mails de connexion Supabase', () => {
  it.each(Object.entries(AUTH_TEMPLATES))('%s : le fichier est à jour (npm run emails:build)', (_k, t) => {
    expect(readFileSync(join(root, 'supabase/templates', t.file), 'utf8')).toBe(t.html + '\n')
  })

  it('sont tous branchés dans supabase/config.toml avec leur objet', () => {
    const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8')
    for (const [key, t] of Object.entries(AUTH_TEMPLATES)) {
      expect(config).toContain(`[auth.email.template.${key}]`)
      expect(config).toContain(`subject = "${t.subject}"`)
    }
  })

  it('contiennent le lien Supabase et aucun texte anglais par défaut', () => {
    for (const key of ['confirmation', 'magic_link', 'recovery', 'invite', 'email_change']) {
      expect(AUTH_TEMPLATES[key].html).toContain('{{ .ConfirmationURL }}')
    }
    for (const t of Object.values(AUTH_TEMPLATES)) expect(t.html).not.toMatch(/Confirm your|Reset Password|Follow this link/i)
  })
})
