const DEFAULT_TIMEOUT_MS = 5000
const MIN_TIMEOUT_MS = 500

module.exports = [
	/*
	 * Remember that once an upgrade script has been added it cannot be removed.
	 *
	 * 2.0.1 added the "API key" and "Request timeout" fields. A connection created by
	 * 2.0.0 has neither, and Companion renders a missing number field as 0 — which
	 * violates the field's min of 500 and greys out Save, so the operator cannot save
	 * the connection at all until they type a value. This fills both fields in.
	 *
	 * host and port are deliberately left alone. The default port changed from 5000 to
	 * 5656, but rewriting a working connection would break installations running SPX on
	 * its own default port.
	 */
	function fillInFieldsAddedIn201(context, props) {
		const config = props && props.config
		if (!config) {
			return { updatedConfig: null, updatedActions: [], updatedFeedbacks: [] }
		}

		let changed = false

		if (typeof config.timeout !== 'number' || config.timeout < MIN_TIMEOUT_MS) {
			config.timeout = DEFAULT_TIMEOUT_MS
			changed = true
		}

		if (typeof config.apikey !== 'string') {
			config.apikey = ''
			changed = true
		}

		return {
			updatedConfig: changed ? config : null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
]
