const test = require('node:test')
const assert = require('node:assert')
const manifest = require('../../companion/manifest.json')

// Modulidentiteten er en global invariant: endres den, mister alle eksisterende
// knapper i Companion koblingen sin. Denne testen er vakthund, ikke dekning.

test('modul-ID er uendret fra 2.0.0', () => {
	assert.strictEqual(manifest.id, 'spx-graphics-controller')
})

test('legacyIds beholder spx-gc', () => {
	assert.ok(Array.isArray(manifest.legacyIds))
	assert.ok(manifest.legacyIds.includes('spx-gc'))
})

test('runtime er node18 over nodejs-ipc', () => {
	assert.strictEqual(manifest.runtime.type, 'node18')
	assert.strictEqual(manifest.runtime.api, 'nodejs-ipc')
	assert.strictEqual(manifest.runtime.entrypoint, '../main.js')
})
