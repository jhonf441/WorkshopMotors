'use strict'

// Number formats of the Motors page. Pure functions (no i18n: units are symbols): test/format.test.js.

// v with `dec` decimals, '--' when there is no number
export function num(v, dec) {
	if (typeof v !== 'number' || !isFinite(v)) {
		return '--';
	}
	const d = dec == null ? 0 : dec;
	const r = Number(v.toFixed(d));
	return (Object.is(r, -0) ? 0 : r).toFixed(d);
}

// A value with the precision it deserves: 2700 -> '2700', 85.3 -> '85.3', 0.042 -> '0.04'
export function smart(v) {
	if (typeof v !== 'number' || !isFinite(v)) {
		return '--';
	}
	const a = Math.abs(v);
	if (a < 0.005) {
		return '0';
	}
	return num(v, a >= 100 ? 0 : (a >= 1 ? 1 : 2));
}

// A speed stored in mm/min (RRF's unit: M203, F) shown in mm/s
export function mmMinToS(v) {
	return typeof v === 'number' && isFinite(v) ? v / 60 : null;
}

// Hz -> kHz with one decimal
export function khz(hz) {
	return num(typeof hz === 'number' ? hz / 1000 : hz, 1);
}

// An age in seconds, short: 8 -> '8 s', 65 -> '1:05', 3900 -> '1 h 05'
export function age(s) {
	if (typeof s !== 'number' || !isFinite(s) || s < 0) {
		return '--';
	}
	const t = Math.floor(s);
	if (t < 60) {
		return t + ' s';
	}
	if (t < 3600) {
		return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
	}
	return Math.floor(t / 3600) + ' h ' + String(Math.floor((t % 3600) / 60)).padStart(2, '0');
}

// part of whole in %, rounded; null without a whole
export function percent(part, whole) {
	if (typeof part !== 'number' || typeof whole !== 'number' || !(whole > 0)) {
		return null;
	}
	return Math.round(part / whole * 100);
}
