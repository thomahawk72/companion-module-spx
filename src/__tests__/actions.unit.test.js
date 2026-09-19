const test = require('node:test')
const assert = require('node:assert')
const { getActionDefinitions } = require('../actions')

function makeSelf(getImpl) {
	const calls = []
	const self = {
		logged: [],
		log: (level, message) => self.logged.push([level, message]),
		client: {
			get:
				getImpl ||
				(async (path, query = {}) => {
					calls.push({ path, query })
					return { ok: true, status: 200, body: 'OK', spxError: undefined }
				}),
		},
	}
	return { self, calls }
}

const context = { parseVariablesInString: async (s) => s }

test('de ni Solo-handlingene finnes med uendrede actionId-er', () => {
	const { self } = makeSelf()
	const actions = getActionDefinitions(self)
	for (const id of [
		'play',
		'continue',
		'stop',
		'focusFirst',
		'focusNext',
		'focusPrevious',
		'focusLast',
		'stopAllLayers',
		'openRundown',
	]) {
		assert.ok(actions[id], `mangler actionId ${id}`)
	}
})

test('de enkle handlingene treffer riktig endepunkt', async () => {
	const forventet = {
		play: 'item/play',
		continue: 'item/continue',
		stop: 'item/stop',
		focusFirst: 'rundown/focusFirst',
		focusNext: 'rundown/focusNext',
		focusPrevious: 'rundown/focusPrevious',
		focusLast: 'rundown/focusLast',
		stopAllLayers: 'rundown/stopAllLayers',
	}
	for (const [id, path] of Object.entries(forventet)) {
		const { self, calls } = makeSelf()
		await getActionDefinitions(self)[id].callback({ actionId: id, options: {} }, context)
		assert.deepStrictEqual(calls, [{ path, query: {} }], `${id} traff feil endepunkt`)
	}
})

test('openRundown sender file som query, ikke i stien', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).openRundown.callback(
		{ actionId: 'openRundown', options: { rundown: 'MyFirstProject/MyFirstRundown' } },
		context,
	)
	assert.deepStrictEqual(calls, [{ path: 'rundown/load', query: { file: 'MyFirstProject/MyFirstRundown' } }])
})

test('openRundown tåler prosjektnavn med mellomrom og ampersand', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).openRundown.callback(
		{ actionId: 'openRundown', options: { rundown: 'Min Sending & Co/Kveld' } },
		context,
	)
	assert.deepStrictEqual(calls[0].query, { file: 'Min Sending & Co/Kveld' })
})

test('openRundown ekspanderer Companion-variabler', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).openRundown.callback(
		{ actionId: 'openRundown', options: { rundown: '$(internal:custom_rundown)' } },
		{ parseVariablesInString: async () => 'MyFirstProject/Kveld' },
	)
	assert.deepStrictEqual(calls[0].query, { file: 'MyFirstProject/Kveld' })
})

test('en handling logger error når SPX svarer 200 med feil i kroppen', async () => {
	const { self } = makeSelf(async () => ({
		ok: true,
		status: 200,
		body: '{"error":"Invalid API key"}',
		spxError: 'Invalid API key',
	}))
	await getActionDefinitions(self).play.callback({ actionId: 'play', options: {} }, context)
	const err = self.logged.find(([level]) => level === 'error')
	assert.ok(err, 'handlingen skal melde fra når SPX rapporterer feil')
	assert.match(err[1], /Start focused item/)
})

test('play_ID fokuserer først og spiller etterpå, i den rekkefølgen', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).play_ID.callback({ actionId: 'play_ID', options: { id: '1773083297693' } }, context)
	assert.deepStrictEqual(calls, [
		{ path: 'rundown/focusByID/1773083297693', query: {} },
		{ path: 'item/play', query: {} },
	])
})

test('continue_ID og stop_ID bruker samme mønster', async () => {
	for (const [id, andreKall] of [
		['continue_ID', 'item/continue'],
		['stop_ID', 'item/stop'],
	]) {
		const { self, calls } = makeSelf()
		await getActionDefinitions(self)[id].callback({ actionId: id, options: { id: '42' } }, context)
		assert.deepStrictEqual(
			calls,
			[
				{ path: 'rundown/focusByID/42', query: {} },
				{ path: andreKall, query: {} },
			],
			`${id} sendte feil kall`,
		)
	}
})

test('play_ID sender ikke play-kallet hvis fokus-kallet feiler på HTTP-nivå', async () => {
	const calls = []
	const { self } = makeSelf(async (path) => {
		calls.push(path)
		return path.startsWith('rundown/focusByID')
			? { ok: false, status: 0, body: 'ECONNREFUSED', spxError: undefined }
			: { ok: true, status: 200, body: 'OK', spxError: undefined }
	})
	await getActionDefinitions(self).play_ID.callback({ actionId: 'play_ID', options: { id: '42' } }, context)
	assert.deepStrictEqual(calls, ['rundown/focusByID/42'], 'play-kallet skulle ikke vært sendt')
	assert.ok(self.logged.some(([level]) => level === 'error'))
})

test('play_ID sender ikke play-kallet når SPX skjuler en feil i en 200-respons', async () => {
	const calls = []
	const { self } = makeSelf(async (path) => {
		calls.push(path)
		return path.startsWith('rundown/focusByID')
			? { ok: true, status: 200, body: '{"error":"Invalid API key"}', spxError: 'Invalid API key' }
			: { ok: true, status: 200, body: 'OK', spxError: undefined }
	})
	await getActionDefinitions(self).play_ID.callback({ actionId: 'play_ID', options: { id: '42' } }, context)
	assert.deepStrictEqual(calls, ['rundown/focusByID/42'])
	assert.ok(self.logged.some(([level, msg]) => level === 'error' && /Invalid API key/.test(msg)))
})

test('focusByID finnes som egen handling og gjør bare ett kall', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).focusByID.callback({ actionId: 'focusByID', options: { id: '99' } }, context)
	assert.deepStrictEqual(calls, [{ path: 'rundown/focusByID/99', query: {} }])
})

test('ID-en URL-kodes, så en ID med skråstrek ikke blir til en ny sti', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).play_ID.callback({ actionId: 'play_ID', options: { id: 'a b/c' } }, context)
	assert.strictEqual(calls[0].path, 'rundown/focusByID/a%20b%2Fc')
})

test('tom ID gir error og ingen nettverkskall', async () => {
	for (const tom of ['', '   ']) {
		const { self, calls } = makeSelf()
		await getActionDefinitions(self).play_ID.callback({ actionId: 'play_ID', options: { id: tom } }, context)
		assert.deepStrictEqual(calls, [], `tom ID (${JSON.stringify(tom)}) skulle ikke gitt kall`)
		assert.ok(self.logged.some(([level]) => level === 'error'))
	}
})

test('ID-en ekspanderes fra Companion-variabel før den brukes', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).play_ID.callback(
		{ actionId: 'play_ID', options: { id: '$(internal:custom_item)' } },
		{ parseVariablesInString: async () => '1773083297693' },
	)
	assert.strictEqual(calls[0].path, 'rundown/focusByID/1773083297693')
})

test('controlRundownItem laster rundown, fokuserer og kommanderer i rekkefølge', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).controlRundownItem.callback(
		{
			actionId: 'controlRundownItem',
			options: { file: 'MyFirstProject/MyFirstRundown', id: '42', command: 'stop' },
		},
		context,
	)
	assert.deepStrictEqual(calls, [
		{ path: 'rundown/load', query: { file: 'MyFirstProject/MyFirstRundown' } },
		{ path: 'rundown/focusByID/42', query: {} },
		{ path: 'item/stop', query: {} },
	])
})

test('controlRundownItem stopper hvis rundownen ikke finnes', async () => {
	const calls = []
	const { self } = makeSelf(async (path) => {
		calls.push(path)
		return path === 'rundown/load'
			? { ok: false, status: 404, body: 'not found', spxError: undefined }
			: { ok: true, status: 200, body: 'OK', spxError: undefined }
	})
	await getActionDefinitions(self).controlRundownItem.callback(
		{
			actionId: 'controlRundownItem',
			options: { file: 'Finnes/Ikke', id: '42', command: 'play' },
		},
		context,
	)
	assert.deepStrictEqual(calls, ['rundown/load'])
	assert.ok(self.logged.some(([level]) => level === 'error'))
})

test('alle femten actionId-ene fra 2.0.0 finnes igjen etter P4, bortsett fra de to i P5', () => {
	const { self } = makeSelf()
	const actions = getActionDefinitions(self)
	for (const id of [
		'play',
		'play_ID',
		'continue',
		'continue_ID',
		'stop',
		'stop_ID',
		'focusFirst',
		'focusNext',
		'focusPrevious',
		'focusLast',
		'stopAllLayers',
		'openRundown',
		'controlRundownItem',
		'focusByID',
	]) {
		assert.ok(actions[id], `mangler actionId ${id}`)
	}
})

// --- P5: endepunkter som krever SPX Production/Broadcast ---
// Begge gir 501 i Solo, men ID-ene kan ikke fjernes uten aa knekke eksisterende knapper.
// De var dessuten direkte oedelagte i 2.0.0, og det rettes her.

function makeSelfP5(overrides = {}) {
	const calls = []
	const self = {
		logged: [],
		log: (level, message) => self.logged.push([level, message]),
		client: {
			get:
				overrides.get ||
				(async (path, query = {}) => {
					calls.push({ method: 'GET', path, query })
					return { ok: true, status: 200, body: 'OK', spxError: undefined }
				}),
			post:
				overrides.post ||
				(async (path, body) => {
					calls.push({ method: 'POST', path, body })
					return { ok: true, status: 200, body: 'OK', spxError: undefined }
				}),
		},
	}
	return { self, calls }
}

test('de to P5-handlingene finnes med uendrede actionId-er', () => {
	const { self } = makeSelfP5()
	const actions = getActionDefinitions(self)
	assert.ok(actions.directplayout, 'mangler actionId directplayout')
	assert.ok(actions.invokeTemplateFunction, 'mangler actionId invokeTemplateFunction')
})

test('directplayout sender parset JSON som objekt, ikke som streng', async () => {
	const { self, calls } = makeSelfP5()
	await getActionDefinitions(self).directplayout.callback(
		{ actionId: 'directplayout', options: { body: '{"casparServer":"OVERLAY","command":"play"}' } },
		context,
	)
	assert.deepStrictEqual(calls, [
		{ method: 'POST', path: 'directplayout', body: { casparServer: 'OVERLAY', command: 'play' } },
	])
})

test('directplayout logger error og sender ingenting ved ugyldig JSON', async () => {
	const { self, calls } = makeSelfP5()
	await getActionDefinitions(self).directplayout.callback(
		{ actionId: 'directplayout', options: { body: 'ikke json' } },
		context,
	)
	assert.deepStrictEqual(calls, [], 'skulle ikke sendt noe')
	assert.ok(self.logged.some(([level]) => level === 'error'))
})

test('directplayout avviser JSON som ikke er et objekt', async () => {
	for (const raw of ['[1,2,3]', '"bare en streng"', 'null', '42']) {
		const { self, calls } = makeSelfP5()
		await getActionDefinitions(self).directplayout.callback(
			{ actionId: 'directplayout', options: { body: raw } },
			context,
		)
		assert.deepStrictEqual(calls, [], `${raw} skulle ikke gitt kall`)
		assert.ok(
			self.logged.some(([level]) => level === 'error'),
			`${raw} skulle gitt error`,
		)
	}
})

test('directplayout melder fra naar SPX svarer 501 i Solo', async () => {
	const { self } = makeSelfP5({
		post: async () => ({ ok: false, status: 501, body: '{"message":"Not Implemented"}', spxError: undefined }),
	})
	await getActionDefinitions(self).directplayout.callback(
		{ actionId: 'directplayout', options: { body: '{"command":"play"}' } },
		context,
	)
	assert.ok(self.logged.some(([level, msg]) => level === 'error' && /501/.test(msg)))
})

test('invokeTemplateFunction leser alle felter fra options, ikke fra frie variabler', async () => {
	const { self, calls } = makeSelfP5()
	await getActionDefinitions(self).invokeTemplateFunction.callback(
		{
			actionId: 'invokeTemplateFunction',
			options: {
				playserver: 'OVERLAY',
				playchannel: '1',
				playlayer: '19',
				webplayout: '19',
				relpath: 'pk/Sangtekst/template/sangtekst.html',
				customFunction: 'myFn',
				params: 'Hello World',
			},
		},
		context,
	)
	assert.deepStrictEqual(calls, [
		{
			method: 'GET',
			path: 'invokeTemplateFunction',
			query: {
				playserver: 'OVERLAY',
				playchannel: '1',
				playlayer: '19',
				webplayout: '19',
				relpath: 'pk/Sangtekst/template/sangtekst.html',
				function: 'myFn',
				params: 'Hello World',
			},
		},
	])
})

test('invokeTemplateFunction kaster ikke naar options mangler felter', async () => {
	const { self } = makeSelfP5()
	await getActionDefinitions(self).invokeTemplateFunction.callback(
		{ actionId: 'invokeTemplateFunction', options: {} },
		context,
	)
	// 2.0.0 kastet ReferenceError her fordi den leste udefinerte frie variabler.
	assert.ok(true, 'kom hit uten aa kaste')
})

test('invokeTemplateFunction ekspanderer variabler i customFunction og params', async () => {
	const { self, calls } = makeSelfP5()
	await getActionDefinitions(self).invokeTemplateFunction.callback(
		{
			actionId: 'invokeTemplateFunction',
			options: { customFunction: '$(x)', params: '$(y)' },
		},
		{ parseVariablesInString: async (s) => (s === '$(x)' ? 'ekte' : 'verdi') },
	)
	assert.strictEqual(calls[0].query.function, 'ekte')
	assert.strictEqual(calls[0].query.params, 'verdi')
})
