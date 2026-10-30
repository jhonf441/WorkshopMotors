import { i18n } from './dwc-host.js'
'use strict'

// The sequences of the page that move the machine (Test, Measure > step ceiling, Crash, Sensorless end stop) reserve the
// movement with the single owner of the service (WorkshopService motion_owner.py, API motion.reserve): while one runs,
// the jog and the other pages are refused with the reason, and the Release / enable section of this page waits.
// The G-code of the sequence still goes through DWC (sendCode): the reservation only keeps the others out.
//   node --test test/sequence.test.js   (from vue/WorkshopMotors)

import { machineFree, ownerMotion } from './machine-free.js'
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { deviceId } from './workshop-auth.js'

export const ORIGIN = 'WorkshopMotors';
export const RESERVE_S = 120; // a reservation lasts this long unless renewed
export const RENEW_MS = 60000; // renewed while the sequence runs (a hidden tab still runs a timer once a minute)

// What keeps a sequence from starting, or from going on (checked again before each step): a file job (also paused),
// a live job, or another origin holding the movement. '' = nothing. A busy machine does not count (the model may
// arrive late with the previous step) and neither does the reservation of this page.
// Two tabs (or two people) of THIS page share the origin, so machineFree lets the second one through: the owner's browser closes
// that gap. A reservation of this same origin that belongs to another browser blocks, and the text says who ("Beto has the
// control since 14:32"). The service refuses it anyway (motion.reserve); this only says so before.
// device: the id of this browser (the tests pass one; the page lets workshop-auth.js read it).
export function sequenceBlock(model, device) {
	const ml = machineFree(model, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings', allowBusy: true, origin: ORIGIN });
	if (['file', 'paused', 'live', 'reserved'].includes(ml.code)) return ml.reason;
	return otherBrowserText(ownerMotion(model), device);
}

function myDevice(device) {
	if (device !== undefined) return String(device || '');
	try {
		return deviceId();
	} catch (e) {
		return ''; // no browser (tests): nobody is "me"
	}
}

// '' when nobody holds it, the holder is this browser, or it is an owner the service does not name (an internal reservation)
function otherBrowserText(motion, device) {
	const o = motion && motion.owner;
	if (!o || !o.origin || !(o.device || o.name)) return '';
	const mine = myDevice(device);
	if (o.device && mine && mine.indexOf(String(o.device)) === 0) return '';
	const who = o.name || ts('control_other_device');
	if (!o.since) return ts('control_held_by', { who });
	const d = new Date(o.since * 1000);
	return ts('control_held_by_since', { who, since: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') });
}

// Runs fn() holding the reservation; renews it every RENEW_MS and releases it at the end (also after an error).
// Refused (another origin holds the machine, a job...): it throws ApiError motion_denied with the reason and fn does
// not run. A service without the API (service_outdated / unavailable): fn runs with the page's own checks, as before.
// reserveMotion: the one of workshop-api.js (a fake in the tests); timers: { setInterval, clearInterval } for the tests.
export async function withReservation(reserveMotion, text, fn, timers) {
	const tm = timers || { setInterval, clearInterval };
	let res = null;
	try {
		res = await reserveMotion(ORIGIN, 'sequence', text, RESERVE_S);
	} catch (e) {
		if (!e || (e.code !== 'service_outdated' && e.code !== 'unavailable')) {
			throw e;
		}
	}
	const renew = res ? tm.setInterval(() => { Promise.resolve().then(() => res.renew(RESERVE_S)).catch(() => {}); }, RENEW_MS) : null;
	try {
		return await fn();
	} finally {
		if (renew) {
			tm.clearInterval(renew);
		}
		if (res) {
			await Promise.resolve().then(() => res.release()).catch(() => {});
		}
	}
}

// A sequence refused before it started says so (not "interrupted": nothing moved). '' for any other error.
export function refusedText(e) {
	return e && e.code === 'motion_denied' ? i18n.t('plugins.WorkshopMotors.common.not_started', { reason: e.message || '' }) : '';
}
