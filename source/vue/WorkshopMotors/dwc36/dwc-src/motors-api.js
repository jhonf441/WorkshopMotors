'use strict'

// apiText of workshop-api.js flattens every error to "Error: <message>", so a refusal (no session, role too low) loses its code
// and reaches the page as a raw red text. This one keeps the error of a REFUSAL (the page says its cause, motors-send.js) and
// flattens the rest the same way.

import { api } from './workshop-api.js'

export async function apiTextKeepRefusals(op, args, opts = {}) {
	try {
		const r = await api(op, args, opts)
		return typeof r === 'string' ? r : JSON.stringify(r)
	} catch (e) {
		if (e && (e.code === 'cancelled' || e.code === 'login_required' || e.code === 'forbidden')) throw e
		return 'Error: ' + (e && e.message ? e.message : e)
	}
}
