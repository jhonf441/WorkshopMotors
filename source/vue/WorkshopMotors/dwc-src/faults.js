import { i18n } from './dwc-host.js'
'use strict'

// Faults of the drivers in the motors report (WorkshopService motor_status.py: flags[].key of DRIVER_FAULTS, plus the
// GSTAT latch). The page names every fault by its key with its own texts (plugins.WorkshopMotors.faults.<key> and
// <key>_hint: what it means and what to do); the label the service publishes is not used, so it does not matter whether
// it comes as a text or as {key, params}. Pure functions: test/faults.test.js.

// key -> severity (the RRF masks: StandardDriverStatus ErrorMask / WarningMask)
export const FAULTS = {
	otpw: 'warning', // over-temperature pre-warning (~120 C)
	ot: 'error', // over-temperature shutdown (~150 C)
	s2ga: 'error', s2gb: 'error', // short to ground, phase A / B
	s2vsa: 'error', s2vsb: 'error', // short to supply (low side), phase A / B
	ola: 'warning', olb: 'warning', // open load (only meaningful while stepping)
	ext: 'error', // external driver error
	pos_tol: 'warning', pos_lost: 'error', setting_error: 'warning', mov_ilegal: 'error', // closed loop
	gstat: 'error' // GSTAT drv_err latched: a fault happened at some point since the register was cleared
};

const RANK = { error: 2, warning: 1 };

// A backend older than 2026-10-12 (without "format") read the 6HC with the wrong bit map: at rest its flags are false.
export function isIdleOld(d) {
	return !!d && !('format' in d) && !!d.in_standstill;
}

// [{ key, severity }] of one driver, errors first
export function faultsOfDriver(d) {
	if (!d || isIdleOld(d)) {
		return [];
	}
	const out = [];
	for (const f of Array.isArray(d.flags) ? d.flags : []) {
		if (f && f.key && !out.some(x => x.key === f.key)) {
			out.push({ key: String(f.key), severity: FAULTS[f.key] || (f.severity === 'error' ? 'error' : 'warning') });
		}
	}
	if (d.gstat && d.gstat.driver_error_latched) {
		out.push({ key: 'gstat', severity: 'error' });
	}
	return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

// The faults of several drivers (one motor): [{ key, severity, drivers: [ids] }], errors first
export function mergeFaults(drivers) {
	const out = [];
	for (const d of drivers || []) {
		for (const f of faultsOfDriver(d)) {
			const have = out.find(x => x.key === f.key);
			if (have) {
				have.drivers.push(d.id);
			} else {
				out.push({ key: f.key, severity: f.severity, drivers: [d.id] });
			}
		}
	}
	return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

// 'error' | 'warning' | null
export function worstSeverity(faults) {
	let w = null;
	for (const f of faults || []) {
		if (f.severity === 'error') {
			return 'error';
		}
		if (f.severity === 'warning') {
			w = 'warning';
		}
	}
	return w;
}

function known(key) {
	return Object.prototype.hasOwnProperty.call(FAULTS, key);
}

// The name of a fault in the language of DWC (an unknown key from a newer service: "Fault <key>")
export function faultLabel(key) {
	return known(key) ? i18n.t('plugins.WorkshopMotors.faults.' + key) : i18n.t('plugins.WorkshopMotors.faults.unknown', { key });
}

// What it means and what to do
export function faultHint(key) {
	return known(key) ? i18n.t('plugins.WorkshopMotors.faults.' + key + '_hint') : '';
}
