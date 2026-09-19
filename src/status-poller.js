const { evaluateStatus } = require('./status')

const DEFAULT_INTERVAL_MS = 10000

class StatusPoller {
	constructor({ getClient, onStatus, intervalMs = DEFAULT_INTERVAL_MS, timers }) {
		this.getClient = getClient
		this.onStatus = onStatus
		this.intervalMs = intervalMs
		this.timers = timers || { setInterval, clearInterval }
		this.generation = 0
		this.inFlight = false
		this.timer = undefined
	}

	start() {
		this.stop()
		this.generation += 1
		this.inFlight = false
		this.poll()
		this.timer = this.timers.setInterval(() => this.poll(), this.intervalMs)
	}

	stop() {
		if (this.timer) {
			this.timers.clearInterval(this.timer)
			this.timer = undefined
		}
		this.generation += 1
		this.inFlight = false
	}

	async poll() {
		if (this.inFlight) {
			return
		}
		const generation = this.generation
		const client = this.getClient()
		this.inFlight = true
		try {
			const res = await client.get('version')
			if (generation !== this.generation) {
				return
			}
			this.onStatus(evaluateStatus(res))
		} finally {
			if (generation === this.generation) {
				this.inFlight = false
			}
		}
	}
}

module.exports = { StatusPoller, DEFAULT_INTERVAL_MS }
