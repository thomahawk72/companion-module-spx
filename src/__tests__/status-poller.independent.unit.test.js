const test = require('node:test')
const assert = require('node:assert')
const { StatusPoller } = require('../status-poller')

// Uavhengig dekning skrevet av testagent-P2 (fiks-runde 1). Dupliserer ikke kodeagentens
// tester i status-poller.unit.test.js (andre poll() mens forste er i luften, generasjonsvakt
// mot restart, stop() rydder timer, start() maaler med en gang) — dekker heller fire
// spesifikke hull hovedagenten pekte paa: at getClient() faktisk leses paa nytt per kall og
// ikke caches ved konstruksjon, at stop() etterfulgt av start() aldri lar to timere leve
// samtidig, at et utestaaende kall fra en gammel generasjon ikke laaser inFlight for en ny
// generasjon (saa den nye pollingen faktisk kommer i gang), og at onStatus garantert aldri
// kalles etter stop() selv naar det gamle kallet til slutt resolverer. Ingen setTimeout for
// "aa vente litt" — alle promises styres eksplisitt med egne deferred()-objekter og
// mikrotask-flushing (await Promise.resolve()).

function deferred() {
	let resolve
	const promise = new Promise((res) => {
		resolve = res
	})
	return { promise, resolve }
}

function fakeTimers() {
	const active = new Set()
	let nextId = 1
	return {
		activeCount: () => active.size,
		setInterval: (fn, ms) => {
			const id = nextId++
			active.add(id)
			return id
		},
		clearInterval: (id) => {
			active.delete(id)
		},
	}
}

test('getClient() leses paa nytt for hvert poll-kall, ikke cachet ved konstruksjon', async () => {
	const onStatusCalls = []
	let getClientCalls = 0
	const clients = [
		{ get: async () => ({ ok: true, status: 200, body: 'v1' }) },
		{ get: async () => ({ ok: true, status: 200, body: 'v2' }) },
	]
	const poller = new StatusPoller({
		getClient: () => {
			const client = clients[getClientCalls]
			getClientCalls += 1
			return client
		},
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers: fakeTimers(),
	})

	await poller.poll()
	await poller.poll()

	assert.strictEqual(getClientCalls, 2, 'getClient() skal kalles ved hvert poll(), ikke bare ved konstruksjon')
	assert.deepStrictEqual(onStatusCalls, [
		{ status: 'ok', message: 'SPX v1' },
		{ status: 'ok', message: 'SPX v2' },
	])
})

test('start() etter stop() rydder forrige timer forst - aldri mer enn en aktiv timer om gangen', async () => {
	const timers = fakeTimers()
	const poller = new StatusPoller({
		getClient: () => ({ get: async () => ({ ok: true, status: 200, body: '1.0.0' }) }),
		onStatus: () => {},
		timers,
	})

	poller.start()
	assert.strictEqual(timers.activeCount(), 1, 'etter forste start() skal noeyaktig en timer vaere aktiv')

	poller.stop()
	assert.strictEqual(timers.activeCount(), 0, 'stop() skal rydde timeren')

	poller.start()
	assert.strictEqual(timers.activeCount(), 1, 'etter en ny start() skal fortsatt bare en timer vaere aktiv')

	poller.start()
	assert.strictEqual(
		timers.activeCount(),
		1,
		'et paafolgende start() (f.eks. fra flere configUpdated-lagringer) skal aldri legge paa en ekstra timer ved siden av',
	)
})

test('et utestaaende kall fra en tidligere generasjon laaser ikke inFlight for en ny generasjon', async () => {
	const staleCall = deferred()
	const freshCall = deferred()
	const getCalls = []
	const onStatusCalls = []
	const poller = new StatusPoller({
		getClient: () => ({
			get: () => {
				const d = getCalls.length === 0 ? staleCall : freshCall
				getCalls.push(d)
				return d.promise
			},
		}),
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers: fakeTimers(),
	})

	// Gammel generasjon: et poll() rekker aa saette inFlight = true foer noen restart skjer.
	const stalePromise = poller.poll()

	// start() teller generasjonen opp og trigger umiddelbart en ny poll(). Hvis inFlight fra
	// den gamle generasjonen laaste den nye ute, ville client.get() bare ha blitt kalt en gang.
	poller.start()

	assert.strictEqual(
		getCalls.length,
		2,
		'den nye generasjonens poll() skal ikke blokkeres av det gamle utestaaende kallet',
	)

	// Rydd opp: la begge kallene resolve slik at ingen unhandled rejection/timer henger igjen.
	staleCall.resolve({ ok: true, status: 200, body: 'gammel' })
	freshCall.resolve({ ok: true, status: 200, body: 'ny' })
	await stalePromise
	await Promise.resolve()
	await Promise.resolve()

	assert.strictEqual(onStatusCalls.length, 1, 'kun den nye generasjonens svar skal naa fram')
	assert.deepStrictEqual(onStatusCalls[0], { status: 'ok', message: 'SPX ny' })
})

test('onStatus kalles aldri etter stop(), selv om det utestaaende kallet resolverer med et gyldig svar', async () => {
	const pending = deferred()
	const onStatusCalls = []
	const poller = new StatusPoller({
		getClient: () => ({ get: () => pending.promise }),
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers: fakeTimers(),
	})

	const inFlight = poller.poll()
	poller.stop()

	// Det gamle kallet resolverer lenge etter stop() - som om SPX endelig svarte paa et
	// treigt kall etter at operatoeren allerede har lukket eller lagret om instansen.
	pending.resolve({ ok: true, status: 200, body: '9.9.9' })
	await inFlight
	await Promise.resolve()
	await Promise.resolve()

	assert.strictEqual(onStatusCalls.length, 0, 'onStatus skal ikke kalles for et svar som ankommer etter stop()')
})
