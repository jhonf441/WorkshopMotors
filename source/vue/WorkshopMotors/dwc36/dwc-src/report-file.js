'use strict';

// The advanced motor report (Charts.vue) as files of the exchange standard (docs-internal/DATA-EXCHANGE.md). Pure functions of the report
// object of armReport() (charts.js), so they run in node: test/report-file.test.js.
//
//   CSV   one row per driver, the fixed columns of REPORT_COLUMNS (English keys, never translated; the values are the ones the
//         firmware and the page measure, not sentences): reportTable(report) -> { columns, rows } for exchangeCsv.
//   JSON  the envelope `workshop-motors-report` (version 1): reportData(report) is its `data`. Times are ISO 8601 (UTC), faults are
//         their keys (faults.js), the direction is 'forward' | 'backward'; nothing in it depends on the language of the page.
//   Text  the report to read (translated by charts.js reportText): it is not data and has no envelope.
// export-files.js hands them to the browser through the shared exchange module.

export const REPORT_FORMAT = 'workshop-motors-report';
export const REPORT_VERSION = 1;
export const REPORT_PLUGIN = 'WorkshopMotors';
export const REPORT_COLUMNS = ['motor', 'board', 'driver', 'microsteps', 'interpolated', 'steps_mm', 'current_ma', 'max_speed_mm_min', 'accel_mm_s2',
	'jerk_mm_min', 'direction', 'mode', 'timing', 'm915_s', 'm915_f', 'm915_h', 'measured_max_speed_mm_min', 'max_pulses_hz', 'max_current',
	'stallguard_min', 'alerts_now', 'alerts_period'];

// the number rounded to a whole, or null when there is none
function whole(v) {
	return typeof v === 'number' && isFinite(v) ? Math.round(v) : null;
}

function iso(ms) {
	const d = new Date(ms);
	return typeof ms === 'number' && isFinite(ms) && ms > 0 && !isNaN(d.getTime()) ? d.toISOString() : null;
}

// "40.1" -> { board: '40', driver: '1' }; an id without a board ("3") -> { board: null, driver: '3' }. Apart in the CSV so a spreadsheet does not read 40.1 as a number.
function splitDriver(id) {
	const t = String(id);
	const at = t.indexOf('.');
	return at < 0 ? { board: null, driver: t } : { board: t.slice(0, at), driver: t.slice(at + 1) };
}

// The fault keys, in one cell: "otpw ot" (a key has no spaces)
function keys(list) {
	return (list || []).join(' ');
}

// The table of the CSV: { columns, rows } with one row (an object keyed by the columns) per driver of every motor
export function reportTable(r) {
	const rows = [];
	for (const m of (r && r.motors) || []) {
		for (const d of m.drivers) {
			const id = splitDriver(d.id);
			const p = d.m569 || {};
			rows.push({
				motor: m.key, board: id.board, driver: id.driver, microsteps: m.micro, interpolated: m.interpolated, steps_mm: m.stepsMm, current_ma: m.current,
				max_speed_mm_min: m.speedMax, accel_mm_s2: m.accel, jerk_mm_min: m.jerk, direction: p.direction, mode: p.mode, timing: p.timing,
				m915_s: d.m915 ? d.m915.s : null, m915_f: d.m915 ? d.m915.filter : null, m915_h: d.m915 ? d.m915.h : null,
				measured_max_speed_mm_min: whole(m.speedMaxMeasurement), max_pulses_hz: whole(m.pulsesMaxMeasured), max_current: whole(d.currentMax),
				stallguard_min: d.stallGuardMin, alerts_now: d.state ? keys(d.state.alerts) : null, alerts_period: keys((d.alerts || []).map(ev => ev.key))
			});
		}
	}
	return { columns: REPORT_COLUMNS, rows };
}

function eventData(ev) {
	return { driver: ev.driver, axis: ev.axis, key: ev.key, severity: ev.severity, since: iso(ev.since), until: iso(ev.until) };
}

function driverData(d) {
	return {
		id: d.id,
		m569: { direction: d.m569.direction, mode: d.m569.mode, timing: d.m569.timing, enable: d.m569.enable, reply: d.m569Text },
		m915: d.m915 ? { stallThreshold: d.m915.s, filter: d.m915.filter, fullStepsPerSecond: d.m915.h } : null,
		state: d.state ? Object.assign({}, d.state, { alerts: d.state.alerts.slice() }) : null,
		currentMax: d.currentMax,
		stallGuardMin: d.stallGuardMin,
		alerts: (d.alerts || []).map(eventData)
	};
}

function motorData(m) {
	const out = {};
	['key', 'kind', 'stepsMm', 'micro', 'interpolated', 'current', 'speedMax', 'accel', 'jerk', 'pctCurrent', 'pctIdle', 'speedMaxMeasurement', 'pulsesMaxMeasured', 'speedNow']
		.forEach(k => { out[k] = m[k] === undefined ? null : m[k]; });
	out.drivers = m.drivers.map(driverData);
	return out;
}

// The `data` of the envelope: the report without any text of the page (no title, fault labels or translated directions)
export function reportData(r) {
	const x = r || {};
	return {
		period: { since: iso(x.since), until: iso(x.until) },
		machine: x.machine || {},
		motors: (x.motors || []).map(motorData),
		alerts: (x.alerts || []).map(eventData),
		rrf: x.rrf || {}
	};
}
