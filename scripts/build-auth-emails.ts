import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AUTH_TEMPLATES } from '../lib/email/auth-templates'

const dir = join(process.cwd(), 'supabase', 'templates')
mkdirSync(dir, { recursive: true })
for (const t of Object.values(AUTH_TEMPLATES)) writeFileSync(join(dir, t.file), t.html + '\n')
console.log(`${Object.keys(AUTH_TEMPLATES).length} modèles écrits dans supabase/templates/`)
