// Versions disponibles via bolls.life (proxy interne : /api/bible)
export const BIBLE_VERSIONS = [
  { id: 'BDS',   name: 'Bible du Semeur'          },
  { id: 'NBS',   name: 'Nouvelle Bible Segond 2002' },
  { id: 'FRLSG', name: 'Louis Segond 1910'         },
  { id: 'FRDBY', name: 'Darby (FR)'                },
  { id: 'KJV',   name: 'King James (EN)'           },
]

// Noms normalisés → numéro de livre (1-66)
function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

const BOOK_MAP: Record<string, number> = {
  // Ancien Testament
  'genese':1,'gen':1,'gn':1,
  'exode':2,'ex':2,
  'levitique':3,'lev':3,'lv':3,
  'nombres':4,'nb':4,
  'deuteronome':5,'deut':5,'dt':5,
  'josue':6,'jos':6,
  'juges':7,'jug':7,
  'ruth':8,'rt':8,
  '1 samuel':9,'1sam':9,'1s':9,
  '2 samuel':10,'2sam':10,'2s':10,
  '1 rois':11,'1r':11,
  '2 rois':12,'2r':12,
  '1 chroniques':13,'1ch':13,'1chron':13,
  '2 chroniques':14,'2ch':14,'2chron':14,
  'esdras':15,'esd':15,
  'nehemie':16,'neh':16,
  'esther':17,'est':17,
  'job':18,'jb':18,
  'psaumes':19,'ps':19,'psaume':19,
  'proverbes':20,'prov':20,'pr':20,
  'ecclesiaste':21,'eccl':21,'qo':21,
  'cantique':22,'cant':22,'ct':22,'cantique des cantiques':22,
  'esaie':23,'esai':23,'es':23,'isaie':23,'is':23,
  'jeremie':24,'jer':24,'jr':24,
  'lamentations':25,'lam':25,
  'ezechiel':26,'ez':26,
  'daniel':27,'dn':27,'da':27,
  'osee':28,'os':28,
  'joel':29,'jl':29,
  'amos':30,'am':30,
  'abdias':31,'abd':31,
  'jonas':32,'jon':32,
  'michee':33,'mi':33,
  'nahum':34,'na':34,
  'habacuc':35,'hab':35,
  'sophonie':36,'soph':36,'so':36,
  'aggee':37,'agg':37,'ag':37,
  'zacharie':38,'zach':38,'za':38,
  'malachie':39,'mal':39,
  // Nouveau Testament
  'matthieu':40,'matt':40,'mt':40,
  'marc':41,'mc':41,'mr':41,
  'luc':42,'lc':42,
  'jean':43,'jn':43,
  'actes':44,'ac':44,'actes des apotres':44,
  'romains':45,'rom':45,'rm':45,
  '1 corinthiens':46,'1cor':46,'1co':46,
  '2 corinthiens':47,'2cor':47,'2co':47,
  'galates':48,'gal':48,
  'ephesiens':49,'eph':49,'ep':49,
  'philippiens':50,'phil':50,'ph':50,
  'colossiens':51,'col':51,
  '1 thessaloniciens':52,'1thess':52,'1th':52,
  '2 thessaloniciens':53,'2thess':53,'2th':53,
  '1 timothee':54,'1tim':54,'1tm':54,
  '2 timothee':55,'2tim':55,'2tm':55,
  'tite':56,'tt':56,
  'philemon':57,'phm':57,
  'hebreux':58,'heb':58,
  'jacques':59,'jac':59,'ja':59,
  '1 pierre':60,'1pier':60,'1p':60,
  '2 pierre':61,'2pier':61,'2p':61,
  '1 jean':62,'1jn':62,'1j':62,
  '2 jean':63,'2jn':63,'2j':63,
  '3 jean':64,'3jn':64,'3j':64,
  'jude':65,'jd':65,
  'apocalypse':66,'apoc':66,'ap':66,'revelation':66,
}

export type ParsedRef = { bookNum: number; chapter: number; verseStart: number; verseEnd: number }

export function parseReference(ref: string): ParsedRef | null {
  const s = ref.trim()
  const match = s.match(/^(\d?\s*[A-Za-zÀ-ÿ\s]+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
  if (!match) return null

  const bookRaw  = normalize(match[1])
  const chapter  = parseInt(match[2], 10)
  const vStart   = parseInt(match[3], 10)
  const vEnd     = match[4] ? parseInt(match[4], 10) : vStart

  const bookNum = BOOK_MAP[bookRaw]
  if (!bookNum) return null
  return { bookNum, chapter, verseStart: vStart, verseEnd: vEnd }
}

export type BibleResult = { text: string; display: string; versionName: string }

export async function fetchBibleVerse(
  ref: string,
  version: string,
): Promise<BibleResult | { error: string }> {
  const parsed = parseReference(ref)
  if (!parsed) {
    return { error: `Référence non reconnue : "${ref}"\nExemple : "Jean 3:16" ou "Ps 23:1-3"` }
  }

  const { bookNum, chapter, verseStart, verseEnd } = parsed

  try {
    // Passe par le proxy Next.js pour éviter les problèmes CORS
    const url = `/api/bible?translation=${version}&book=${bookNum}&chapter=${chapter}`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { error: body.error ?? `Erreur serveur (${res.status})` }
    }

    // bolls.life retourne [{ pk, verse, text }, ...]
    const data: { pk: number; verse: number; text: string }[] = await res.json()

    const lines: string[] = []
    for (let v = verseStart; v <= verseEnd; v++) {
      const entry = data.find(d => d.verse === v)
      if (entry) lines.push(entry.text.trim())
    }

    if (lines.length === 0) {
      return { error: 'Verset introuvable dans cette version' }
    }

    const verRange    = verseStart === verseEnd ? `${verseStart}` : `${verseStart}-${verseEnd}`
    const versionName = BIBLE_VERSIONS.find(v => v.id === version)?.name ?? version

    // Reconstruit un nom de livre lisible depuis la référence (pas fourni par bolls.life)
    const bookLabel = ref.trim().match(/^(\d?\s*[A-Za-zÀ-ÿ\s]+?)\s+\d/)?.[1]?.trim() ?? ''
    const display   = `${bookLabel} ${chapter}:${verRange}`.trim()

    return { text: lines.join('\n'), display, versionName }
  } catch {
    return { error: 'Impossible de contacter la source biblique — vérifie ta connexion' }
  }
}
