const test = require('node:test')
const assert = require('node:assert')
const { StatusPoller } = require('../status-poller')

function deferred() {
	let resolve
	const promise = new Promise((res) => {
		resolve = res
	})
	return { promise, resolve }
}

function fakeTimers() {
	const calls = []
	return {
		calls,
		setInterval: (fn, ms) => {
			calls.push({ fn, ms })
			return calls.length
		},
		clearInterval: () => {},
	}
}

test('et andre poll() mens det forste er i luften gjor ingenting', async () => {
	const first = deferred()
	let callCount = 0
	const onStatusCalls = []
	const poller = new StatusPoller({
		getClient: () => ({
			get: () => {
				callCount += 1
				return first.promise
			},
		}),
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers: fakeTimers(),
	})

	const p1 = poller.poll()
	const p2 = poller.poll()

	assert.strictEqual(callCount, 1)

	first.resolve({ ok: true, status: 200, body: '1.4.1' })
	await p1
	await p2

	assert.strictEqual(onStatusCalls.length, 1)
	assert.deepStrictEqual(onStatusCalls[0], { status: 'ok', message: 'SPX 1.4.1' })
})

test('et poll() fra en tidligere generasjon kaller ikke onStatus etter restart', async () => {
	const deferredByCall = [deferred(), deferred()]
	let callIndex = 0
	const onStatusCalls = []
	const poller = new StatusPoller({
		getClient: () => ({
			get: () => deferredByCall[callIndex++].promise,
		}),
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers: fakeTimers(),
	})

	const stalePoll = poller.poll()
	poller.start()

	deferredByCall[0].resolve({ ok: true, status: 200, body: 'stale' })
	await stalePoll

	assert.strictEqual(onStatusCalls.length, 0)

	deferredByCall[1].resolve({ ok: true, status: 200, body: 'fresh' })
	await Promise.resolve()
	await Promise.resolve()

	assert.strictEqual(onStatusCalls.length, 1)
	assert.deepStrictEqual(onStatusCalls[0], { status: 'ok', message: 'SPX fresh' })
})

test('stop() rydder timeren og et utestaende kall kaller ikke onStatus', async () => {
	const pending = deferred()
	const onStatusCalls = []
	const timers = fakeTimers()
	let clearedId
	timers.clearInterval = (id) => {
		clearedId = id
	}
	const poller = new StatusPoller({
		getClient: () => ({
			get: () => pending.promise,
		}),
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers,
	})

	poller.start()
	assert.strictEqual(timers.calls.length, 1)

	const outstanding = poller.poll()
	poller.stop()

	assert.strictEqual(clearedId, 1)
	pending.resolve({ ok: true, status: 200, body: '1.4.1' })
	await outstanding

	assert.strictEqual(onStatusCalls.length, 0)
})

test('start() gir en maaling med en gang, ikke forst etter intervalMs', async () => {
	let getCalls = 0
	const onStatusCalls = []
	const poller = new StatusPoller({
		getClient: () => ({
			get: () => {
				getCalls += 1
				return Promise.resolve({ ok: true, status: 200, body: '1.4.1' })
			},
		}),
		onStatus: (verdict) => onStatusCalls.push(verdict),
		timers: fakeTimers(),
	})

	poller.start()
	await Promise.resolve()
	await Promise.resolve()

	assert.strictEqual(getCalls, 1)
	assert.strictEqual(onStatusCalls.length, 1)
})
