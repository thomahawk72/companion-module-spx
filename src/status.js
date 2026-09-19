function formatOkMessage(rawBody) {
	const text = String(rawBody).trim()
	let parsed
	try {
		parsed = JSON.parse(text)
	} catch (err) {
		parsed = undefined
	}
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		// Parset som objekt: aldri ekko raakroppen herfra, selv om felt mangler eller er
		// falsy — raakroppen kan inneholde oppsettdetaljer (hostname, filstier) vi ikke skal
		// vise i Companion-statusen.
		const product = typeof parsed.product === 'string' && parsed.product.trim() ? parsed.product.trim() : undefined
		const version = parsed.version ? parsed.version : undefined
		if (product && version) {
			return `${product} ${version}`
		}
		if (product) {
			return product
		}
		if (version) {
			return `SPX ${version}`
		}
		return 'SPX'
	}
	return text ? `SPX ${text}` : 'SPX'
}

function evaluateStatus(res) {
	if (res.ok) {
		return { status: 'ok', message: formatOkMessage(res.body) }
	}
	if (res.status === 0) {
		return { status: 'connection_failure', message: res.body }
	}
	if (res.status === 401 || res.status === 403) {
		return {
			status: 'bad_config',
			message: 'SPX rejected the request. Check the API key in the module config.',
		}
	}
	return { status: 'unknown_warning', message: `SPX responded ${res.status}: ${res.body}` }
}

module.exports = { evaluateStatus }
