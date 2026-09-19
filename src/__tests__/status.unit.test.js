const test = require('node:test')
const assert = require('node:assert')
const { evaluateStatus } = require('../status')

test('200 fra version gir Ok', () => {
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body: '1.4.1' }), {
		status: 'ok',
		message: 'SPX 1.4.1',
	})
})

test('nettverksfeil gir ConnectionFailure med feilteksten', () => {
	assert.deepStrictEqual(evaluateStatus({ ok: false, status: 0, body: 'ECONNREFUSED' }), {
		status: 'connection_failure',
		message: 'ECONNREFUSED',
	})
})

test('401 gir BadConfig med hint om apikey', () => {
	const res = evaluateStatus({ ok: false, status: 401, body: 'Unauthorized' })
	assert.strictEqual(res.status, 'bad_config')
	assert.match(res.message, /API key/)
})

test('annen HTTP-feil gir UnknownWarning', () => {
	const res = evaluateStatus({ ok: false, status: 500, body: 'boom' })
	assert.strictEqual(res.status, 'unknown_warning')
	assert.match(res.message, /500/)
})

test('200 med ekte JSON fra SPX gir produkt og versjon', () => {
	const body = JSON.stringify({
		vendor: 'SPX Graphics',
		product: 'SPX Solo',
		version: '1.4.1',
		id: 'c61e5605',
		hostname: 'SPX-HOST-EXAMPLE',
		rootFolder: '/Users/noen/SPX',
	})
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body }), {
		status: 'ok',
		message: 'SPX Solo 1.4.1',
	})
})

test('statusmeldingen lekker ikke hostname eller filsti', () => {
	const body = JSON.stringify({
		product: 'SPX Solo',
		version: '1.4.1',
		hostname: 'SPX-HOST-EXAMPLE',
		rootFolder: '/Users/noen/SPX',
	})
	const res = evaluateStatus({ ok: true, status: 200, body })
	assert.doesNotMatch(res.message, /hostname|rootFolder|SPX-HOST-|\/Users\//)
})

test('200 med ren tekst i stedet for JSON faller tilbake på teksten', () => {
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body: '1.4.1' }), {
		status: 'ok',
		message: 'SPX 1.4.1',
	})
})

test('200 med JSON uten product bruker bare versjonen', () => {
	const body = JSON.stringify({ version: '1.4.1' })
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body }), {
		status: 'ok',
		message: 'SPX 1.4.1',
	})
})

test('tom version med product gir bare produktnavnet, ikke raatekst', () => {
	const body = JSON.stringify({
		product: 'SPX Solo',
		version: '',
		hostname: 'SPX-HOST-EXAMPLE',
		rootFolder: '/Users/noen/SPX',
	})
	const res = evaluateStatus({ ok: true, status: 200, body })
	assert.deepStrictEqual(res, { status: 'ok', message: 'SPX Solo' })
	assert.doesNotMatch(res.message, /hostname|rootFolder|SPX-HOST-|\/Users\//)
})

test('tom version uten product gir bare SPX, ikke raatekst', () => {
	const body = JSON.stringify({ version: '', hostname: 'SPX-HOST-EXAMPLE' })
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body }), {
		status: 'ok',
		message: 'SPX',
	})
})

test('product og version begge til stede gir fortsatt produkt+versjon (uendret)', () => {
	const body = JSON.stringify({ product: 'SPX Solo', version: '1.4.1' })
	assert.deepStrictEqual(evaluateStatus({ ok: true, status: 200, body }), {
		status: 'ok',
		message: 'SPX Solo 1.4.1',
	})
})

test('JSON-objekt helt uten version-felt gir SPX, ikke raatekst', () => {
	const body = JSON.stringify({ noe: 'annet', hostname: 'SPX-HOST-EXAMPLE' })
	const res = evaluateStatus({ ok: true, status: 200, body })
	assert.deepStrictEqual(res, { status: 'ok', message: 'SPX' })
	assert.doesNotMatch(res.message, /hostname|SPX-AM-/)
})
