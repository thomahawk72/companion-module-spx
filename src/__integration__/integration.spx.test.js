// Integrasjonstester mot en kjørende SPX Solo 1.4.1.
// Kjøres ikke av "verify.sh all" — se scripts/verify.conf. Kjør med:
//   scripts/verify.sh integration
// Krever SPX på 127.0.0.1:5656 og kontroller-siden åpen på
// /gc/MyFirstProject/MyFirstRundown.

const test = require('node:test')
const assert = require('node:assert')
const { SpxClient } = require('../spx-client')
const { evaluateStatus } = require('../status')

const client = new SpxClient({
	host: process.env.SPX_HOST || '127.0.0.1',
	port: process.env.SPX_PORT || '5656',
	apikey: process.env.SPX_APIKEY || '',
	timeoutMs: 5000,
	log: () => {},
})

// itemID fra DATAROOT/MyFirstProject/data/MyFirstRundown.json (NAME LEFT, lag 3).
const KJENT_ITEM = process.env.SPX_ITEM_ID || '1773083297693'

test('SPX svarer på version', async () => {
	const res = await client.get('version')
	assert.strictEqual(res.status, 200, `SPX svarte ikke 200 på /api/v1/version (${res.body})`)
})

test('version-svaret er JSON med product og version, ikke en ren streng', async () => {
	// Denne testen finnes fordi hele teamet først antok en ren versjonsstreng, og
	// statusmeldingen lekket hostname og rootFolder inn i Companion-UI-et.
	const res = await client.get('version')
	const parsed = JSON.parse(res.body)
	assert.strictEqual(typeof parsed.product, 'string')
	assert.strictEqual(typeof parsed.version, 'string')
	const verdict = evaluateStatus(res)
	assert.strictEqual(verdict.status, 'ok')
	assert.doesNotMatch(verdict.message, /hostname|rootFolder|\/Users\//)
})

test('endepunktene modulen bruker er åpne i Solo', async () => {
	for (const path of [
		'item/play',
		'item/continue',
		'item/stop',
		'rundown/focusFirst',
		'rundown/focusNext',
		'rundown/focusPrevious',
		'rundown/focusLast',
		`rundown/focusByID/${KJENT_ITEM}`,
		'rundown/stopAllLayers',
	]) {
		const res = await client.get(path)
		assert.strictEqual(res.status, 200, `${path} svarte ${res.status}`)
		assert.strictEqual(res.spxError, undefined, `${path} ga spxError: ${res.spxError}`)
	}
})

test('endepunktene modulen unngår er fortsatt sperret i Solo', async () => {
	// Vaktbikkje: begynner et av disse å svare 200 i en framtidig SPX-versjon, feiler
	// testen og forteller at de sammensatte handlingene kan forenkles.
	for (const path of [
		`item/play/${KJENT_ITEM}`,
		`item/continue/${KJENT_ITEM}`,
		`item/stop/${KJENT_ITEM}`,
		'controlRundownItemByID',
	]) {
		const res = await client.get(path)
		assert.strictEqual(res.status, 501, `${path} svarte ${res.status}, ikke 501`)
	}
})

test('rundown/load med ukjent fil gir ekte 404, ikke en skjult 200-feil', async () => {
	const res = await client.get('rundown/load', { file: 'FinnesIkke/HellerIkke' })
	assert.strictEqual(res.status, 404)
})

test('focusByID svarer med ren tekst, og klienten tolker det ikke som feil', async () => {
	const res = await client.get(`rundown/focusByID/${KJENT_ITEM}`)
	assert.strictEqual(res.ok, true)
	assert.strictEqual(res.spxError, undefined)
	assert.match(res.body, /Sent request to controller/)
})

test('et suksessvar har APIcmd og intet error-felt', async () => {
	const res = await client.get('item/play')
	const parsed = JSON.parse(res.body)
	assert.strictEqual(parsed.APIcmd, 'ItemPlay')
	assert.strictEqual(parsed.error, undefined)
})
