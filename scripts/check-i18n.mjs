/**
 * check-i18n.mjs
 * Compares all locale files against zh.json (reference).
 * Exits with code 1 if any locale is missing keys — blocks git commit.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES_DIR = join(__dirname, '../messages')
const REFERENCE_LOCALE = 'zh'
const CHECK_LOCALES = ['en', 'ko', 'ja', 'es', 'fr']

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? flatKeys(v, full)
      : [full]
  })
}

const ref = JSON.parse(readFileSync(join(MESSAGES_DIR, `${REFERENCE_LOCALE}.json`), 'utf8'))
const refKeys = new Set(flatKeys(ref))

let hasError = false

for (const locale of CHECK_LOCALES) {
  const target = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  const targetKeys = new Set(flatKeys(target))
  const missing = [...refKeys].filter(k => !targetKeys.has(k))
  const extra   = [...targetKeys].filter(k => !refKeys.has(k))

  if (missing.length > 0) {
    console.error(`\n❌ ${locale}.json missing ${missing.length} keys:`)
    missing.slice(0, 20).forEach(k => console.error(`   - ${k}`))
    if (missing.length > 20) console.error(`   ... and ${missing.length - 20} more`)
    hasError = true
  } else {
    console.log(`✅ ${locale}.json — all ${refKeys.size} keys present`)
  }

  if (extra.length > 0) {
    console.warn(`⚠️  ${locale}.json has ${extra.length} extra keys not in zh.json (harmless but check if intended)`)
  }
}

if (hasError) {
  console.error('\n💡 Run: node scripts/sync-i18n.mjs  to auto-fill missing keys from zh.json as placeholders')
  process.exit(1)
}
