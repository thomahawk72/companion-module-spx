function checkResult(self, label, res) {
	// SPX svarer HTTP 200 med {error} i kroppen ved feil apikey, ikke 401. Derfor maa
	// spxError sjekkes foer res.ok, ellers ser en avvist kommando ut som suksess.
	if (res.spxError) {
		self.log('error', `${label} failed: ${res.spxError}`)
		return false
	}
	if (!res.ok) {
		self.log('error', `${label} failed: SPX responded ${res.status}`)
		return false
	}
	return true
}

async function runCommand(self, label, path, query = {}) {
	return checkResult(self, label, await self.client.get(path, query))
}

async function runPost(self, label, path, body) {
	return checkResult(self, label, await self.client.post(path, body))
}

function simpleAction(self, name, path) {
	return {
		name,
		options: [],
		callback: async () => {
			await runCommand(self, name, path)
		},
	}
}

const ID_OPTION = {
	type: 'textinput',
	label: 'Item ID (the itemID/epoch of the rundown item)',
	id: 'id',
	default: '0123456789',
	useVariables: true,
}

async function resolveId(self, context, raw, label) {
	const id = String(await context.parseVariablesInString(String(raw ?? ''))).trim()
	if (!id) {
		self.log('error', `${label}: no item ID given`)
		return undefined
	}
	return id
}

async function focusThenCommand(self, context, raw, commandPath, label) {
	const id = await resolveId(self, context, raw, label)
	if (!id) {
		return
	}
	const focused = await runCommand(self, label, `rundown/focusByID/${encodeURIComponent(id)}`)
	if (!focused) {
		return
	}
	await runCommand(self, label, commandPath)
}

function getActionDefinitions(self) {
	return {
		play: simpleAction(self, 'Start focused item', 'item/play'),
		continue: simpleAction(self, 'Continue focused item', 'item/continue'),
		stop: simpleAction(self, 'Stop focused item', 'item/stop'),
		focusFirst: simpleAction(self, 'Focus on the first item', 'rundown/focusFirst'),
		focusNext: simpleAction(self, 'Focus on the next item', 'rundown/focusNext'),
		focusPrevious: simpleAction(self, 'Focus on the previous item', 'rundown/focusPrevious'),
		focusLast: simpleAction(self, 'Focus on the last item', 'rundown/focusLast'),
		stopAllLayers: simpleAction(self, 'Stop all layers', 'rundown/stopAllLayers'),
		openRundown: {
			name: 'Open rundown',
			options: [
				{
					type: 'textinput',
					label: 'project/file',
					id: 'rundown',
					default: 'MyFirstProject/MyFirstRundown',
					useVariables: true,
				},
			],
			callback: async (action, context) => {
				const rundown = await context.parseVariablesInString(action.options.rundown)
				await runCommand(self, 'Open rundown', 'rundown/load', { file: rundown })
			},
		},
		focusByID: {
			name: 'Focus item by ID',
			description:
				'Focuses the rundown item with the given itemID, without playing it. Requires the ' +
				'SPX controller page to be open on the rundown that contains the item.',
			options: [ID_OPTION],
			callback: async (action, context) => {
				const id = await resolveId(self, context, action.options.id, 'Focus item by ID')
				if (!id) {
					return
				}
				await runCommand(self, 'Focus item by ID', `rundown/focusByID/${encodeURIComponent(id)}`)
			},
		},
		play_ID: {
			name: 'Start item by ID',
			description:
				'Focuses the item by ID and then starts it. Two sequential API calls, because ' +
				'item/play/:id is not available in SPX Solo. Requires the SPX controller page ' +
				'to be open on the rundown that contains the item.',
			options: [ID_OPTION],
			callback: async (action, context) => {
				await focusThenCommand(self, context, action.options.id, 'item/play', 'Start item by ID')
			},
		},
		continue_ID: {
			name: 'Continue item by ID',
			description:
				'Focuses the item by ID and then continues it. Two sequential API calls, because ' +
				'item/continue/:id is not available in SPX Solo. Requires the SPX controller page ' +
				'to be open on the rundown that contains the item.',
			options: [ID_OPTION],
			callback: async (action, context) => {
				await focusThenCommand(self, context, action.options.id, 'item/continue', 'Continue item by ID')
			},
		},
		stop_ID: {
			name: 'Stop item by ID',
			description:
				'Focuses the item by ID and then stops it. Two sequential API calls, because ' +
				'item/stop/:id is not available in SPX Solo. Requires the SPX controller page ' +
				'to be open on the rundown that contains the item.',
			options: [ID_OPTION],
			callback: async (action, context) => {
				await focusThenCommand(self, context, action.options.id, 'item/stop', 'Stop item by ID')
			},
		},
		controlRundownItem: {
			name: 'Play/Stop/Continue an item from a known rundown',
			description:
				'Loads the given rundown, focuses the item by ID and then sends the chosen command. ' +
				'Three sequential API calls, because controlRundownItemByID is not available in SPX ' +
				'Solo. rundown/load reloads the controller page, so allow it a moment before the ' +
				'next button press.',
			options: [
				{
					type: 'textinput',
					label: 'project/file',
					id: 'file',
					default: 'MyFirstProject/MyFirstRundown',
					useVariables: true,
				},
				ID_OPTION,
				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					default: 'play',
					choices: [
						{ id: 'play', label: 'Play' },
						{ id: 'stop', label: 'Stop' },
						{ id: 'continue', label: 'Continue' },
					],
				},
			],
			callback: async (action, context) => {
				const label = 'Play/Stop/Continue an item from a known rundown'
				const file = await context.parseVariablesInString(action.options.file)
				const loaded = await runCommand(self, label, 'rundown/load', { file })
				if (!loaded) {
					return
				}
				await focusThenCommand(self, context, action.options.id, `item/${action.options.command}`, label)
			},
		},

		directplayout: {
			name: 'Direct playout (requires SPX Production/Broadcast)',
			description:
				'Not available in SPX Solo, where SPX answers 501 Not Implemented. ' + 'Kept for licensed installations.',
			options: [
				{
					type: 'textinput',
					label: 'JSON body',
					id: 'body',
					default:
						'{"casparServer":"OVERLAY","casparChannel":"1","casparLayer":"20",' +
						'"webplayoutLayer":"20","relativeTemplatePath":' +
						'"vendor/pack/templatefile.html","command":"play"}',
					useVariables: true,
				},
			],
			callback: async (action, context) => {
				const label = 'Direct playout'
				const raw = await context.parseVariablesInString(String(action.options.body ?? ''))
				let parsed
				try {
					parsed = JSON.parse(raw)
				} catch (err) {
					self.log('error', `${label}: JSON body is not valid JSON — ${err.message}`)
					return
				}
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					self.log('error', `${label}: JSON body must be an object`)
					return
				}
				await runPost(self, label, 'directplayout', parsed)
			},
		},

		invokeTemplateFunction: {
			name: 'Invoke template function (requires SPX Production/Broadcast)',
			description:
				'Not available in SPX Solo, where SPX answers 501 Not Implemented. ' + 'Kept for licensed installations.',
			options: [
				{ type: 'textinput', label: 'playserver', id: 'playserver', default: 'OVERLAY' },
				{ type: 'textinput', label: 'playchannel', id: 'playchannel', default: '1' },
				{ type: 'textinput', label: 'playlayer', id: 'playlayer', default: '19' },
				{ type: 'textinput', label: 'webplayout', id: 'webplayout', default: '19' },
				{
					type: 'textinput',
					label: 'relpath',
					id: 'relpath',
					default: 'vendor/pack/templatefile.html',
				},
				{
					type: 'textinput',
					label: 'customFunction',
					id: 'customFunction',
					default: 'myCustomTemplateFunction',
					useVariables: true,
				},
				{ type: 'textinput', label: 'params', id: 'params', default: '', useVariables: true },
			],
			callback: async (action, context) => {
				// 2.0.0 leste playserver, playchannel og de andre som frie variabler i stedet for
				// fra options, og kastet ReferenceError uansett lisens.
				const o = action.options || {}
				await runCommand(self, 'Invoke template function', 'invokeTemplateFunction', {
					playserver: o.playserver ?? '',
					playchannel: o.playchannel ?? '',
					playlayer: o.playlayer ?? '',
					webplayout: o.webplayout ?? '',
					relpath: o.relpath ?? '',
					function: await context.parseVariablesInString(String(o.customFunction ?? '')),
					params: await context.parseVariablesInString(String(o.params ?? '')),
				})
			},
		},
	}
}

module.exports = { getActionDefinitions }
