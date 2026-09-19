const NOT_IN_SOLO = 501

function parseSpxError(text) {
	if (!text) {
		return undefined
	}
	let parsed
	try {
		parsed = JSON.parse(text)
	} catch (err) {
		return undefined
	}
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		if (typeof parsed.error === 'string' && parsed.error.trim()) {
			return parsed.error.trim()
		}
	}
	return undefined
}

class SpxClient {
	constructor({ host, port, apikey, timeoutMs, log, fetchImpl }) {
		this.host = host
		this.port = String(port)
		this.apikey = apikey || ''
		this.timeoutMs = timeoutMs || 5000
		this.log = log || (() => {})
		this.fetchImpl = fetchImpl || ((url, init) => fetch(url, init))
	}

	buildUrl(path, query = {}) {
		const params = new URLSearchParams(query)
		if (this.apikey) {
			params.set('apikey', this.apikey)
		}
		const qs = params.toString()
		const base = `http://${this.host}:${this.port}/api/v1/${path}`
		return qs ? `${base}?${qs}` : base
	}

	async request(path, { method = 'GET', query = {}, body = undefined } = {}) {
		const url = this.buildUrl(path, query)
		const init = { method, signal: AbortSignal.timeout(this.timeoutMs) }
		if (body !== undefined) {
			init.body = JSON.stringify(body)
			init.headers = { 'Content-Type': 'application/json' }
		}
		this.log('debug', `${method} ${url}`)
		let res
		let text
		try {
			res = await this.fetchImpl(url, init)
			text = await res.text()
		} catch (err) {
			const message = err && err.message ? err.message : String(err)
			this.log('error', `SPX request failed: ${method} ${url} — ${message}`)
			return { ok: false, status: 0, body: message, url, spxError: undefined }
		}
		if (res.status === NOT_IN_SOLO) {
			this.log(
				'warn',
				`SPX returned 501 for ${path}. This endpoint is not available in SPX Solo ` +
					`and requires SPX Production or Broadcast. Use the "by ID" actions instead.`,
			)
			return { ok: res.ok, status: res.status, body: text, url, spxError: undefined }
		}
		if (!res.ok) {
			this.log('warn', `SPX returned ${res.status} for ${path}: ${text}`)
			return { ok: res.ok, status: res.status, body: text, url, spxError: undefined }
		}
		const spxError = parseSpxError(text)
		if (spxError) {
			this.log('error', `SPX reported an error for ${path}: ${spxError}`)
		} else {
			this.log('debug', `SPX ${res.status}: ${text}`)
		}
		return { ok: res.ok, status: res.status, body: text, url, spxError }
	}

	async get(path, query = {}) {
		return this.request(path, { method: 'GET', query })
	}

	async post(path, body) {
		return this.request(path, { method: 'POST', body })
	}
}

SpxClient.NOT_IN_SOLO = NOT_IN_SOLO

module.exports = { SpxClient, NOT_IN_SOLO, parseSpxError }
