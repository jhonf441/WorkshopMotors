import { i18n } from './dwc-host.js'
'use strict'

// Sends a release (M18) or an enable (M17) through the service (API motors.disable / motors.enable) and reads its
// answer. Used by the Release / enable section and by the level 4 band of the page. apiText is passed in (the client of
// vue/_shared/workshop-api.js; a fake in test/enable.test.js).

import { request, readResponse } from './enable.js'

export const ANSWER_MS = 15000; // "Actions that take time" (DESIGN.md 5): without an answer in 15 s, say so

// -> { ok, error, command }. The level 4 box of the page is the confirmation the service asks for to release.
export async function sendMotors(apiText, action, keys) {
	const req = request(action, keys);
	let timer = null;
	try {
		const answer = await Promise.race([
			apiText(req.op, req.args, { confirm: action === 'disable' }),
			new Promise(resolve => { timer = setTimeout(() => resolve(null), ANSWER_MS); })
		]);
		if (answer == null) {
			return { ok: false, error: i18n.t('plugins.WorkshopMotors.enable.the_service_did_not_answer_within'), command: '' };
		}
		return readResponse(answer);
	} catch (e) {
		return { ok: false, error: i18n.t('plugins.WorkshopMotors.enable.could_not_send') + ((e && e.message) || e), command: '' };
	} finally {
		clearTimeout(timer);
	}
}
