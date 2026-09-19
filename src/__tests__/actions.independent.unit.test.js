const test = require('node:test')
const assert = require('node:assert')
const { getActionDefinitions } = require('../actions')

// Uavhengig dekning skrevet av testagent-P3. Dupliserer ikke kodeagentens tester i
// actions.unit.test.js (de ni ID-ene finnes, riktig endepunkt, openRundown-query,
// variabelekspansjon, error-logging ved spxError). Dekker heller: at de seks fremtidige
// ID-ene IKKE finnes ennå, at simpleAction har tomt options-array, at navnene faktisk
// stemmer med brief-tabellen, og — det som mangler helt i kodeagentens tester —
// runCommand sin andre feilgren (ok:false uten spxError, dvs. en ren HTTP-feil fra SPX).

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

// Vakt mot at et steg legger til mer enn det skal. Settet er nå komplett for 2.0.1:
// de fjorten actionId-ene fra 2.0.0, pluss focusByID som er ny.
test('getActionDefinitions returnerer NOYAKTIG de seksten actionId-ene, ingen flere', () => {
	const { self } = makeSelf()
	const actions = getActionDefinitions(self)
	const actual = Object.keys(actions).sort()
	const expected = [
		'continue',
		'continue_ID',
		'controlRundownItem',
		'focusByID',
		'focusFirst',
		'focusLast',
		'focusNext',
		'focusPrevious',
		'openRundown',
		'play',
		'play_ID',
		'stop',
		'stopAllLayers',
		'stop_ID',
		'directplayout',
		'invokeTemplateFunction',
	].sort()
	assert.deepStrictEqual(actual, expected)
})

test('alle femten actionId-ene fra 2.0.0 finnes, pluss den nye focusByID', () => {
	const { self } = makeSelf()
	const actions = getActionDefinitions(self)
	// De fjorten fra 2.0.0 som skal overleve oppgraderingen, slik at eksisterende knapper
	// i Companion ikke blir stumme, pluss focusByID som er ny i 2.0.1.
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
		'directplayout',
		'invokeTemplateFunction',
		'focusByID',
	]) {
		assert.ok(actions[id], `mangler actionId ${id}`)
	}
})

test('de åtte enkle handlingene har tomt options-array', () => {
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
	]) {
		assert.deepStrictEqual(actions[id].options, [], `${id} skal ha tomt options-array`)
	}
})

test('handlingenes navn stemmer med brief-tabellen', () => {
	const { self } = makeSelf()
	const actions = getActionDefinitions(self)
	const expectedNames = {
		play: 'Start focused item',
		continue: 'Continue focused item',
		stop: 'Stop focused item',
		focusFirst: 'Focus on the first item',
		focusNext: 'Focus on the next item',
		focusPrevious: 'Focus on the previous item',
		focusLast: 'Focus on the last item',
		stopAllLayers: 'Stop all layers',
		openRundown: 'Open rundown',
	}
	for (const [id, name] of Object.entries(expectedNames)) {
		assert.strictEqual(actions[id].name, name, `${id} har feil navn`)
	}
})

test('openRundown sitt eneste options-felt matcher grensesnittet fra brief', () => {
	const { self } = makeSelf()
	const opt = getActionDefinitions(self).openRundown.options
	assert.strictEqual(opt.length, 1)
	assert.deepStrictEqual(opt[0], {
		type: 'textinput',
		label: 'project/file',
		id: 'rundown',
		default: 'MyFirstProject/MyFirstRundown',
		useVariables: true,
	})
})

test('en handling logger error med sitt eget navn ved en RENDYRKET HTTP-feil (ok:false, INGEN spxError)', async () => {
	// Dette er runCommand sin andre feilgren (if (!res.ok)). Kodeagentens eneste
	// feiltest dekker spxError-grenen; denne grenen er utestet før nå. Mutasjonstest:
	// fjernes !res.ok-sjekken i runCommand, blir denne testen rød.
	const { self } = makeSelf(async () => ({
		ok: false,
		status: 500,
		body: 'Internal Server Error',
		spxError: undefined,
	}))
	await getActionDefinitions(self).stop.callback({ actionId: 'stop', options: {} }, context)
	const err = self.logged.find(([level]) => level === 'error')
	assert.ok(err, 'handlingen skal logge error ved HTTP-feil uten spxError')
	assert.match(err[1], /Stop focused item/)
	assert.match(err[1], /500/)
})

test('en vellykket handling logger IKKE error', async () => {
	const { self } = makeSelf()
	await getActionDefinitions(self).play.callback({ actionId: 'play', options: {} }, context)
	assert.strictEqual(
		self.logged.find(([level]) => level === 'error'),
		undefined,
	)
})

test('openRundown med tom streng som variabel-ekspansjon sender fortsatt file-query (ingen skjult validering som feiler stille)', async () => {
	const { self, calls } = makeSelf()
	await getActionDefinitions(self).openRundown.callback(
		{ actionId: 'openRundown', options: { rundown: '$(internal:tom)' } },
		{ parseVariablesInString: async () => '' },
	)
	assert.deepStrictEqual(calls, [{ path: 'rundown/load', query: { file: '' } }])
})

test('hver enkel handling kaller self.client.get nøyaktig én gang per klikk', async () => {
	let callCount = 0
	const { self } = makeSelf(async () => {
		callCount += 1
		return { ok: true, status: 200, body: 'OK', spxError: undefined }
	})
	await getActionDefinitions(self).focusNext.callback({ actionId: 'focusNext', options: {} }, context)
	assert.strictEqual(callCount, 1)
})
