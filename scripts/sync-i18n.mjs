/**
 * sync-i18n.mjs
 * Adds missing keys to all locale files, copying values from zh.json as
 * placeholder (prefixed with "[NEEDS TRANSLATION] ").
 * Safe to run multiple times — only adds, never overwrites existing keys.
 *
 * Usage: node scripts/sync-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES_DIR = join(__dirname, '../messages')
const REFERENCE_LOCALE = 'zh'
const SYNC_LOCALES = ['en', 'ko', 'ja', 'es', 'fr']

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => o?.[k], obj)
}

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {}
    cur = cur[keys[i]]
  }
  cur[keys[keys.length - 1]] = value
}

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? flatKeys(v, full)
      : [full]
  })
}

const ref = JSON.parse(readFileSync(join(MESSAGES_DIR, `${REFERENCE_LOCALE}.json`), 'utf8'))
const refKeys = flatKeys(ref)

for (const locale of SYNC_LOCALES) {
  const path = join(MESSAGES_DIR, `${locale}.json`)
  const target = JSON.parse(readFileSync(path, 'utf8'))
  const targetKeys = new Set(flatKeys(target))

  let added = 0
  for (const key of refKeys) {
    if (!targetKeys.has(key)) {
      const zhValue = getNestedValue(ref, key)
      const placeholder = typeof zhValue === 'string'
        ? `[TODO:${locale}] ${zhValue}`
        : zhValue
      setNestedValue(target, key, placeholder)
      added++
    }
  }

  if (added > 0) {
    writeFileSync(path, JSON.stringify(target, null, 2) + '\n', 'utf8')
    console.log(`✅ ${locale}.json — added ${added} placeholder keys`)
  } else {
    console.log(`✓  ${locale}.json — already in sync`)
  }
}

console.log('\nDone. Search for "[TODO:" in messages/ to find keys needing real translation.')
