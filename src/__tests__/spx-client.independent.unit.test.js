const test = require('node:test')
const assert = require('node:assert')
const { SpxClient } = require('../spx-client')

// Uavhengig dekning skrevet av testagent-P1. Dupliserer ikke kodeagentens tester
// i spx-client.unit.test.js (buildUrl uten query/med apikey, nettverksfeil, 501,
// AbortSignal-tilstedeværelse) — dekker heller kanttilfeller de ikke rører:
// post(), suksessvei, ikke-501-feil, apikey-kollisjon i query, port-koersjon,
// timeout-verdi som faktisk sendes videre, og standardverdier når log/fetchImpl
// utelates helt.

function buildStubClient(overrides = {}) {
	const events = []
	const spxClient = new SpxClient({
		host: '127.0.0.1',
		port: '5656',
		apikey: '',
		timeoutMs: 5000,
		log: (level, message) => events.push([level, message]),
		...overrides,
	})
	return { spxClient, events }
}

test('post sender JSON-kropp med Content-Type og metode POST, ingen body i GET', async () => {
	let capturedInit
	const { spxClient } = buildStubClient({
		fetchImpl: async (_url, init) => {
			capturedInit = init
			return { ok: true, status: 200, text: async () => 'OK' }
		},
	})
	await spxClient.post('item/select', { id: 3 })
	assert.strictEqual(capturedInit.method, 'POST')
	assert.strictEqual(capturedInit.headers['Content-Type'], 'application/json')
	assert.strictEqual(capturedInit.body, '{"id":3}')
})

test('get sender ingen body og ingen headers-felt', async () => {
	let capturedInit
	const { spxClient } = buildStubClient({
		fetchImpl: async (_url, init) => {
			capturedInit = init
			return { ok: true, status: 200, text: async () => 'OK' }
		},
	})
	await spxClient.get('version')
	assert.strictEqual(capturedInit.body, undefined)
	assert.strictEqual(capturedInit.headers, undefined)
})

test('vellykket kall returnerer status og body uendret og logger kun debug', async () => {
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'PLAYING' }),
	})
	const res = await spxClient.get('item/state')
	assert.strictEqual(res.ok, true)
	assert.strictEqual(res.status, 200)
	assert.strictEqual(res.body, 'PLAYING')
	assert.ok(events.length > 0, 'forventet minst én loggmelding')
	assert.ok(
		events.every(([level]) => level === 'debug'),
		`forventet kun debug-logging ved suksess, fikk: ${JSON.stringify(events)}`,
	)
})

test('get logger warn med statuskode og kroppstekst ved ikke-501-feil, uten å nevne SPX Solo', async () => {
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({ ok: false, status: 404, text: async () => 'Not Found' }),
	})
	const res = await spxClient.get('item/does-not-exist')
	assert.strictEqual(res.status, 404)
	assert.strictEqual(res.ok, false)
	const warn = events.find(([level]) => level === 'warn')
	assert.ok(warn, 'forventet en warn-linje for 404')
	assert.match(warn[1], /404/)
	assert.match(warn[1], /Not Found/)
	assert.doesNotMatch(warn[1], /SPX Solo/)
})

test('501-varselet peker på Production eller Broadcast, ikke bare på SPX Solo', async () => {
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({
			ok: false,
			status: 501,
			text: async () => '{"status":501,"message":"Not Implemented"}',
		}),
	})
	await spxClient.get('rundown/next')
	const warn = events.find(([level]) => level === 'warn')
	assert.ok(warn, 'forventet en warn-linje')
	assert.match(warn[1], /Production|Broadcast/)
})

test('buildUrl: klientens apikey overstyrer en apikey som følger med i query', () => {
	const { spxClient } = buildStubClient({ apikey: 'client-key' })
	const url = spxClient.buildUrl('item/play', { apikey: 'query-key', foo: 'bar' })
	assert.strictEqual(url, 'http://127.0.0.1:5656/api/v1/item/play?apikey=client-key&foo=bar')
})

test('buildUrl fungerer med numerisk port (koersjon til streng)', () => {
	const { spxClient } = buildStubClient({ port: 8080 })
	assert.strictEqual(spxClient.buildUrl('version'), 'http://127.0.0.1:8080/api/v1/version')
})

test('get bruker konfigurert timeoutMs i AbortSignal.timeout', async () => {
	const originalTimeout = AbortSignal.timeout
	const seenValues = []
	AbortSignal.timeout = (ms) => {
		seenValues.push(ms)
		return originalTimeout.call(AbortSignal, ms)
	}
	try {
		const { spxClient } = buildStubClient({
			timeoutMs: 1234,
			fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'OK' }),
		})
		await spxClient.get('version')
		assert.deepStrictEqual(seenValues, [1234])
	} finally {
		AbortSignal.timeout = originalTimeout
	}
})

test('get faller tilbake på 5000ms når timeoutMs ikke er oppgitt', async () => {
	const originalTimeout = AbortSignal.timeout
	const seenValues = []
	AbortSignal.timeout = (ms) => {
		seenValues.push(ms)
		return originalTimeout.call(AbortSignal, ms)
	}
	try {
		const { spxClient } = buildStubClient({
			timeoutMs: undefined,
			fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'OK' }),
		})
		await spxClient.get('version')
		assert.deepStrictEqual(seenValues, [5000])
	} finally {
		AbortSignal.timeout = originalTimeout
	}
})

test('konstruktøren aksepterer manglende log og fetchImpl uten å kaste', async () => {
	const originalFetch = global.fetch
	global.fetch = async () => ({ ok: true, status: 200, text: async () => 'OK' })
	try {
		const spxClient = new SpxClient({ host: '127.0.0.1', port: '5656', apikey: '', timeoutMs: 5000 })
		const res = await spxClient.get('version')
		assert.strictEqual(res.ok, true)
		assert.strictEqual(res.status, 200)
	} finally {
		global.fetch = originalFetch
	}
})

test('fetchImpl faller tilbake på global fetch når den ikke er oppgitt', async () => {
	const originalFetch = global.fetch
	let calledWith
	global.fetch = async (url, init) => {
		calledWith = { url, init }
		return { ok: true, status: 200, text: async () => 'OK' }
	}
	try {
		const { spxClient } = buildStubClient({ fetchImpl: undefined })
		await spxClient.get('item/play')
		assert.strictEqual(calledWith.url, 'http://127.0.0.1:5656/api/v1/item/play')
		assert.strictEqual(calledWith.init.method, 'GET')
	} finally {
		global.fetch = originalFetch
	}
})

// Reverifisering fiks-runde 1: text() flyttet inn i try/catch sammen med fetchImpl-kallet.
// Kodeagentens egen nye test dekker kun status 200 der text() kaster. Det interessante
// kanttilfellet er status 501: rekkefølgen i koden sjekker res.status FØR text() kalles for
// warn-grenene, men text() kastes FØR res.status i det hele tatt rekker å bli undersøkt siden
// begge nå ligger i samme try. Denne testen beviser at en 501 med en ødelagt kropp aldri når
// fram til den villedende "SPX Solo/Production/Broadcast"-teksten, men i stedet gir samme
// generiske feilsvar som enhver annen transportfeil.
test('501-respons der res.text() kaster gir generisk feilsvar, ikke et villedende 501-varsel', async () => {
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({
			ok: false,
			status: 501,
			text: async () => {
				throw new Error('stream avbrutt')
			},
		}),
	})
	const res = await spxClient.get('item/play/123')
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 0)
	assert.match(res.body, /stream avbrutt/)
	const warn = events.find(([level]) => level === 'warn')
	assert.strictEqual(warn, undefined, 'skal ikke logge noen warn når kroppen ikke kan leses')
	const error = events.find(([level]) => level === 'error')
	assert.ok(error, 'forventet en error-linje')
	assert.doesNotMatch(error[1], /SPX Solo|Production|Broadcast/)
})

// Samme kanttilfelle for en vanlig (ikke-501) feilstatus, for å bekrefte at det ikke er
// 501-spesifikk logikk som redder oss her, men selve try/catch-plasseringen.
test('404-respons der res.text() kaster gir også generisk feilsvar, ikke et statuskode-warn', async () => {
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({
			ok: false,
			status: 404,
			text: async () => {
				throw new Error('stream avbrutt')
			},
		}),
	})
	const res = await spxClient.get('item/does-not-exist')
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 0)
	assert.match(res.body, /stream avbrutt/)
	assert.strictEqual(
		events.find(([level]) => level === 'warn'),
		undefined,
	)
	assert.ok(events.find(([level]) => level === 'error'))
})
