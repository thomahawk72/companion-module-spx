const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const { getActionDefinitions } = require('./src/actions')
const { SpxClient } = require('./src/spx-client')
const { StatusPoller } = require('./src/status-poller')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config

		this.buildClient()

		this.updateStatus(InstanceStatus.Connecting)

		this.setActionDefinitions(getActionDefinitions(this))

		this.startStatusPolling()
	}
	// When module gets deleted
	async destroy() {
		this.stopStatusPolling()
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		this.config = config
		this.buildClient()
		this.startStatusPolling()
	}

	startStatusPolling() {
		if (!this.statusPoller) {
			this.statusPoller = new StatusPoller({
				getClient: () => this.client,
				onStatus: (verdict) => this.applyStatus(verdict),
			})
		}
		this.statusPoller.start()
	}

	stopStatusPolling() {
		if (this.statusPoller) {
			this.statusPoller.stop()
		}
	}

	applyStatus(verdict) {
		const map = {
			ok: InstanceStatus.Ok,
			connection_failure: InstanceStatus.ConnectionFailure,
			bad_config: InstanceStatus.BadConfig,
			unknown_warning: InstanceStatus.UnknownWarning,
		}
		this.updateStatus(map[verdict.status], verdict.message)
	}

	buildClient() {
		this.client = new SpxClient({
			host: this.config.host,
			port: this.config.port,
			apikey: this.config.apikey,
			timeoutMs: this.config.timeout,
			log: (level, message) => this.log(level, message),
		})
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'Controls SPX Graphics Controller over its HTTP API. ' +
					'Several endpoints are only available with an SPX Production or ' +
					'Broadcast license; the "by ID" actions work around this on SPX Solo.',
			},
			{
				type: 'textinput',
				label: 'Target IP',
				id: 'host',
				width: 6,
				regex: Regex.IP,
				default: '127.0.0.1',
				required: true,
			},
			{
				type: 'textinput',
				label: 'Target port',
				id: 'port',
				width: 6,
				regex: Regex.PORT,
				default: '5656',
				required: true,
			},
			{
				type: 'textinput',
				label: 'API key (leave empty if SPX has no apikey set)',
				id: 'apikey',
				width: 12,
				default: '',
			},
			{
				type: 'number',
				label: 'Request timeout (ms)',
				id: 'timeout',
				width: 6,
				min: 500,
				max: 30000,
				default: 5000,
			},
		]
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
