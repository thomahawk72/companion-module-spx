const test = require('node:test')
const assert = require('node:assert')
const upgrades = require('../../upgrades')

const run = (config) => upgrades[0]({}, { config, actions: [], feedbacks: [] })

test('en tilkobling fra 2.0.0 får timeout og apikey fylt inn', () => {
	// 2.0.0 hadde bare host og port. Uten timeout rendrer Companion feltet som 0,
	// som bryter min:500 og graar ut Save — tilkoblingen kan ikke lagres.
	const res = run({ host: '127.0.0.1', port: '5000' })
	assert.strictEqual(res.updatedConfig.timeout, 5000)
	assert.strictEqual(res.updatedConfig.apikey, '')
})

test('host og port røres aldri', () => {
	const res = run({ host: '10.0.0.7', port: '5000' })
	assert.strictEqual(res.updatedConfig.host, '10.0.0.7')
	assert.strictEqual(res.updatedConfig.port, '5000')
})

test('en verdi operatøren allerede har satt beholdes', () => {
	const res = run({ host: '127.0.0.1', port: '5656', timeout: 12000, apikey: 'hemmelig' })
	assert.strictEqual(res.updatedConfig, null, 'ingenting å endre skal gi null')
})

test('en ugyldig timeout under minimum rettes opp', () => {
	assert.strictEqual(run({ timeout: 0 }).updatedConfig.timeout, 5000)
	assert.strictEqual(run({ timeout: 10 }).updatedConfig.timeout, 5000)
})

test('tom config tåles uten å kaste', () => {
	assert.doesNotThrow(() => run(undefined))
	assert.doesNotThrow(() => run(null))
	assert.deepStrictEqual(run(null).updatedActions, [])
})
