const test = require('node:test')
const assert = require('node:assert')
const { SpxClient, parseSpxError } = require('../spx-client')

function makeClient(overrides = {}) {
	const logged = []
	const client = new SpxClient({
		host: '127.0.0.1',
		port: '5656',
		apikey: '',
		timeoutMs: 5000,
		log: (level, message) => logged.push([level, message]),
		...overrides,
	})
	return { client, logged }
}

test('buildUrl setter sammen host, port og sti uten apikey', () => {
	const { client } = makeClient()
	assert.strictEqual(client.buildUrl('item/play'), 'http://127.0.0.1:5656/api/v1/item/play')
})

test('buildUrl legger på apikey når den er satt', () => {
	const { client } = makeClient({ apikey: 'hemmelig' })
	assert.strictEqual(client.buildUrl('item/play'), 'http://127.0.0.1:5656/api/v1/item/play?apikey=hemmelig')
})

test('buildUrl URL-koder query-verdier', () => {
	const { client } = makeClient()
	assert.strictEqual(
		client.buildUrl('rundown/load', { file: 'My Project/My Rundown' }),
		'http://127.0.0.1:5656/api/v1/rundown/load?file=My+Project%2FMy+Rundown',
	)
})

test('get returnerer ok:false og logger error ved nettverksfeil', async () => {
	const { client, logged } = makeClient({
		fetchImpl: async () => {
			throw new Error('ECONNREFUSED')
		},
	})
	const res = await client.get('item/play')
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 0)
	assert.match(res.body, /ECONNREFUSED/)
	assert.ok(logged.some(([level]) => level === 'error'))
})

test('get logger warn med forklarende tekst ved 501 fra Solo', async () => {
	const { client, logged } = makeClient({
		fetchImpl: async () => ({
			ok: false,
			status: 501,
			text: async () => '{"status":501,"message":"Not Implemented"}',
		}),
	})
	const res = await client.get('item/play/123')
	assert.strictEqual(res.status, 501)
	const warn = logged.find(([level]) => level === 'warn')
	assert.ok(warn, 'forventet en warn-linje')
	assert.match(warn[1], /SPX Solo/)
})

test('get returnerer ok:false og logger error når res.text() kaster', async () => {
	const { client, logged } = makeClient({
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			text: async () => {
				throw new Error('stream avbrutt')
			},
		}),
	})
	const res = await client.get('item/play')
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 0)
	assert.match(res.body, /stream avbrutt/)
	assert.ok(logged.some(([level]) => level === 'error'))
})

test('get sender AbortSignal med timeout', async () => {
	let sawSignal = false
	const { client } = makeClient({
		fetchImpl: async (_url, init) => {
			sawSignal = init && init.signal instanceof AbortSignal
			return { ok: true, status: 200, text: async () => 'OK' }
		},
	})
	await client.get('version')
	assert.strictEqual(sawSignal, true)
})

test('parseSpxError finner feilmeldingen SPX gjemmer i en 200-respons', () => {
	assert.strictEqual(parseSpxError('{"error":"Invalid API key"}'), 'Invalid API key')
})

test('parseSpxError returnerer undefined for et ekte suksessvar', () => {
	assert.strictEqual(parseSpxError('{"status":200,"message":"OK","APIcmd":"ItemPlay"}'), undefined)
})

test('parseSpxError tåler ren tekst, som focusByID svarer med', () => {
	assert.strictEqual(parseSpxError('Sent request to controller: {"APIcmd":"RundownFocusByID"}'), undefined)
})

test('parseSpxError tåler tom kropp og ugyldig JSON', () => {
	assert.strictEqual(parseSpxError(''), undefined)
	assert.strictEqual(parseSpxError('ikke json'), undefined)
	assert.strictEqual(parseSpxError('null'), undefined)
	assert.strictEqual(parseSpxError('[1,2,3]'), undefined)
})

test('parseSpxError ignorerer tom error-streng', () => {
	assert.strictEqual(parseSpxError('{"error":""}'), undefined)
})

test('get setter spxError og logger error når SPX svarer 200 med feil i kroppen', async () => {
	const { client, logged } = makeClient({
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			text: async () => '{"error":"Invalid API key"}',
		}),
	})
	const res = await client.get('item/play')
	assert.strictEqual(res.status, 200)
	assert.strictEqual(res.spxError, 'Invalid API key')
	const err = logged.find(([level]) => level === 'error')
	assert.ok(err, 'forventet en error-linje')
	assert.match(err[1], /Invalid API key/)
})

test('get lar spxError være undefined ved ekte suksess', async () => {
	const { client } = makeClient({
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			text: async () => '{"status":200,"message":"OK","APIcmd":"ItemPlay"}',
		}),
	})
	const res = await client.get('item/play')
	assert.strictEqual(res.spxError, undefined)
})
