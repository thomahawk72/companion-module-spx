const test = require('node:test')
const assert = require('node:assert')
const { SpxClient } = require('../spx-client')

// Uavhengig dekning skrevet av testagent-P3. Dupliserer ikke kodeagentens tester i
// spx-client.unit.test.js (spxError satt ved 200+feil, spxError undefined ved ekte suksess).
// Dekker heller kodeagentens forbehold: request() ble restrukturert til fire eksplisitte
// returpunkter (nettverksfeil / 501 / annen ikke-ok / suksess). Denne fila beviser at alle
// fire faktisk har spxError-nøkkelen (ikke bare tre av fire), at formen er lik på tvers av
// alle fire, og at spxError-utledning ikke lekker inn i grenene som skal returnere før den
// kjøres (501 og annen ikke-ok).

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

test('returpunkt 1 (nettverksfeil): spxError er en egen nøkkel med verdi undefined, ikke fraværende', async () => {
	const { spxClient } = buildStubClient({
		fetchImpl: async () => {
			throw new Error('ECONNREFUSED')
		},
	})
	const res = await spxClient.get('item/play')
	assert.ok(Object.prototype.hasOwnProperty.call(res, 'spxError'), 'spxError-nøkkelen mangler på nettverksfeil-veien')
	assert.strictEqual(res.spxError, undefined)
})

test('returpunkt 2 (501 fra Solo): spxError er undefined selv om kroppen inneholder et error-felt', async () => {
	// Beviser at 501-grenen returnerer FØR parseSpxError kjøres. Om noen flytter
	// spxError-utledningen foran 501-sjekken, blander dette seg med "not implemented"
	// og gir feil melding til operatøren.
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({
			ok: false,
			status: 501,
			text: async () => '{"error":"Invalid API key"}',
		}),
	})
	const res = await spxClient.get('item/play/123')
	assert.ok(Object.prototype.hasOwnProperty.call(res, 'spxError'))
	assert.strictEqual(res.spxError, undefined)
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 501)
	const warn = events.find(([level]) => level === 'warn')
	assert.ok(warn, 'forventet warn om SPX Solo-begrensning')
	assert.match(warn[1], /SPX Solo/)
	assert.strictEqual(
		events.find(([level]) => level === 'error'),
		undefined,
		'501-grenen skal ikke logge error for et error-felt den aldri leser',
	)
})

test('returpunkt 3 (annen ikke-ok, f.eks. 404): spxError er undefined selv med et error-felt i kroppen', async () => {
	const { spxClient, events } = buildStubClient({
		fetchImpl: async () => ({
			ok: false,
			status: 404,
			text: async () => '{"error":"Not Found"}',
		}),
	})
	const res = await spxClient.get('rundown/load')
	assert.ok(Object.prototype.hasOwnProperty.call(res, 'spxError'))
	assert.strictEqual(res.spxError, undefined)
	assert.strictEqual(res.ok, false)
	assert.strictEqual(res.status, 404)
})

test('returpunkt 4 (suksess): ok forblir true selv når spxError er satt — HTTP-betydningen av ok/status endres ikke', async () => {
	const { spxClient } = buildStubClient({
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			text: async () => '{"error":"API key does not match. Access denied."}',
		}),
	})
	const res = await spxClient.get('item/play')
	assert.strictEqual(res.ok, true, 'ok skal forbli HTTP-nivå sann, ikke flippes av spxError')
	assert.strictEqual(res.status, 200)
	assert.strictEqual(res.spxError, 'API key does not match. Access denied.')
})

test('alle fire returpunktene har nøyaktig samme nøkkelsett — formen er lik uansett vei ut', async () => {
	const scenarios = [
		buildStubClient({
			fetchImpl: async () => {
				throw new Error('ECONNREFUSED')
			},
		}),
		buildStubClient({ fetchImpl: async () => ({ ok: false, status: 501, text: async () => '' }) }),
		buildStubClient({ fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' }) }),
		buildStubClient({ fetchImpl: async () => ({ ok: true, status: 200, text: async () => 'OK' }) }),
	]
	const keySets = []
	for (const { spxClient } of scenarios) {
		const res = await spxClient.get('item/play')
		keySets.push(Object.keys(res).sort().join(','))
	}
	const expected = ['body', 'ok', 'spxError', 'status', 'url'].sort().join(',')
	for (const keys of keySets) {
		assert.strictEqual(keys, expected, `nøkkelsett avviker: ${keys}`)
	}
})

test('post() (ikke bare get()) setter også spxError ved en 200-feil i kroppen', async () => {
	// Kodeagentens tester øver kun get(). post() går gjennom samme request(), men det
	// bevises ikke andre steder — mutasjonstest for at spxError ikke ved en feil er
	// koblet til GET-spesifikk kode.
	const { spxClient } = buildStubClient({
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			text: async () => '{"error":"Invalid API key"}',
		}),
	})
	const res = await spxClient.post('item/select', { id: 3 })
	assert.strictEqual(res.spxError, 'Invalid API key')
})
