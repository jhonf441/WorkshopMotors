'use strict'

// What the Motors page shows at a glance, derived from the motors report of the service (motorReport) and DWC's object
// model: one state per motor (axis or extruder), the chips of the header and how fresh the data are.
// Pure functions (no Vue, no i18n: the page turns the keys into texts): test/motor-state.test.js.
// Design: docs-internal/MOTORES-DISENO.md (5.1 - 5.4).

import { mergeFaults, worstSeverity } from './faults.js'
import { age, mmMinToS, percent } from './format.js'

export const LIVE_S = 5; // a report that changed this long ago or less is "live" (the poller publishes every second)
export const GRACE_S = 10; // after opening the page, time to wait for the first new report (the heartbeat wakes the poller)

// How fresh the data are. t = { hasReport, lastChangeMs: browser time of the last change of report.updated_at seen
// since the page opened (null: none yet), openedMs, nowMs } -> { state: 'live' | 'stale' | 'waiting' | 'none', ageS }
// Browser times only: the page never compares its clock with the Pi's.
export function freshness(t) {
	if (t.lastChangeMs != null) {
		const ageS = Math.max(0, (t.nowMs - t.lastChangeMs) / 1000);
		return { state: ageS <= LIVE_S ? 'live' : 'stale', ageS };
	}
	if ((t.nowMs - t.openedMs) / 1000 < GRACE_S) {
		return { state: 'waiting', ageS: null };
	}
	return { state: t.hasReport ? 'stale' : 'none', ageS: null };
}

// The holding state of a motor from the enabled value of each of its drivers (true / false / null = cannot be read: CAN
// board, unknown chip, no reading yet) and the list of released motors the service keeps (motorReport.released):
//   'unpowered' the power supply is off           'enabled'  every known driver holds
//   'released'  released (an M18, here or anywhere: the service saw it holding before, or the API asked for it)
//   'off'       off but never seen holding: RRF leaves the drivers off after power-up until the first move, and an
//               extruder that is not used stays off. Not a release: no level 4 band
//   'partial'   some drivers of the motor off and others on      'unknown'  nothing can be read
export function enableState(values, powerOff, releasedByService) {
	if (powerOff) {
		return 'unpowered';
	}
	const known = (values || []).filter(v => typeof v === 'boolean');
	if (!known.length) {
		return releasedByService ? 'released' : 'unknown';
	}
	if (known.every(v => !v)) {
		return releasedByService ? 'released' : 'off';
	}
	return known.some(v => !v) ? 'partial' : 'enabled';
}

function driverInfo(d) {
	const id = String((d && d.id) || '');
	return {
		id,
		can: Number(id.split('.')[0]) || 0,
		enabled: d && typeof d.enabled === 'boolean' ? d.enabled : null,
		standstill: d && typeof d.in_standstill === 'boolean' ? d.in_standstill : null,
		currentMa: d && typeof d.cs_current_ma === 'number' ? d.cs_current_ma : null,
		sgMin: d && d.m122 && typeof d.m122.sg_min === 'number' ? d.m122.sg_min : null
	};
}

// "board.driver" of the object model ("0.4" or DWC's DriverId {board, driver})
function idOf(d) {
	return d && typeof d === 'object' && 'board' in d ? d.board + '.' + d.driver : String(d);
}

// The motors of the object model, as report entries without data (before the first report arrives)
function entriesOfModel(om) {
	const move = (om && om.move) || {};
	const out = [];
	(move.axes || []).forEach(a => {
		if (a && a.letter && a.visible !== false && (a.drivers || []).length) {
			out.push({ label: String(a.letter), drivers: a.drivers.map(id => ({ id: idOf(id) })), max_speed_mm_min: a.speed, current_ma: a.current });
		}
	});
	(move.extruders || []).forEach((x, i) => {
		const ids = x && x.driver != null ? [x.driver] : ((x && x.drivers) || []);
		if (ids.length) {
			out.push({ label: 'E' + i, drivers: ids.map(id => ({ id: idOf(id) })), max_speed_mm_min: x.speed, current_ma: x.current });
		}
	});
	return out;
}

function severityOf(faults, enable, hasData) {
	const worst = worstSeverity(faults);
	if (worst === 'error' || enable === 'released') {
		return 'error';
	}
	if (worst === 'warning' || enable === 'partial') {
		return 'warning';
	}
	return hasData && enable === 'enabled' ? 'ok' : 'neutral';
}

// One state per motor: [{ key, kind, homed, drivers, enable, faults, severity, speedMmS, maxMmS, pct, moving,
// configuredMa, nowMa, nowPct, runPct, idlePct }]
export function motorStates(report, om) {
	const powerOff = report ? !!report.without_power_supply : !!(om && om.state && om.state.status === 'off');
	const released = new Set(report && Array.isArray(report.released) ? report.released.map(String) : []);
	const homed = {};
	for (const a of (om && om.move && om.move.axes) || []) {
		if (a && a.letter) {
			homed[a.letter] = !!a.homed;
		}
	}
	const entries = report && Array.isArray(report.entries) ? report.entries.filter(e => e && e.label) : entriesOfModel(om);
	return entries.map(e => {
		const key = String(e.label);
		const kind = /^E\d+$/.test(key) ? 'extruder' : 'axis';
		const drivers = (e.drivers || []).map(driverInfo);
		const enable = enableState(drivers.map(d => d.enabled), powerOff, released.has(key));
		const faults = powerOff || !report ? [] : mergeFaults(e.drivers || []);
		const currents = drivers.map(d => d.currentMa).filter(v => v != null);
		const nowMa = powerOff || !currents.length ? null : Math.max(...currents);
		const speedMmS = report && !powerOff ? (mmMinToS(e.current_speed_mm_min) || 0) : null;
		const maxMmS = mmMinToS(e.max_speed_mm_min);
		return {
			key,
			kind,
			homed: kind === 'axis' && key in homed ? homed[key] : null,
			drivers,
			enable,
			faults,
			severity: severityOf(faults, enable, !!report && !powerOff),
			speedMmS,
			maxMmS,
			pct: speedMmS == null ? null : (typeof e.pct_of_max === 'number' ? e.pct_of_max : percent(speedMmS, maxMmS)),
			moving: !!speedMmS,
			configuredMa: typeof e.current_ma === 'number' ? e.current_ma : null,
			nowMa,
			nowPct: percent(nowMa, e.current_ma),
			runPct: typeof e.percent_current === 'number' ? e.percent_current : null,
			idlePct: typeof e.percent_stst_current === 'number' ? e.percent_stst_current : null
		};
	});
}

// Missed step pulses of the last M122 reading (RRF "hiccups": delays the step generator had to insert)
export function hiccupsNow(report) {
	const bc = report && report.board_capacity;
	return bc ? (bc.hiccups_ring0 || 0) + (bc.hiccups_ring1 || 0) : 0;
}

// The header: chips (in order of importance) + the keys of the released motors (the level 4 band).
// chip = { id, color, icon, key (plugins.WorkshopMotors.page.<key>), params }
export function pageSummary(motors, report, fresh) {
	const chips = [];
	if (fresh.state === 'waiting') {
		chips.push({ id: 'data', color: 'grey', icon: 'mdi-timer-sand', key: 'chip_waiting' });
	} else if (fresh.state === 'none') {
		chips.push({ id: 'data', color: 'grey', icon: 'mdi-lan-disconnect', key: 'chip_no_data' });
	} else if (fresh.state === 'stale') {
		chips.push({ id: 'data', color: 'warning', icon: 'mdi-clock-alert-outline', key: fresh.ageS == null ? 'chip_stale_unknown' : 'chip_stale', params: { age: age(fresh.ageS) } });
	}
	const powerOff = motors.some(m => m.enable === 'unpowered');
	if (powerOff) {
		chips.push({ id: 'power', color: 'grey', icon: 'mdi-power-plug-off-outline', key: 'chip_power_off' });
	}
	const released = motors.filter(m => m.enable === 'released' || m.enable === 'partial').map(m => m.key);
	if (released.length) {
		chips.push({ id: 'released', color: 'error', icon: 'mdi-engine-off', key: 'chip_released', params: { list: released.join(', ') } });
	}
	let bad = released.length > 0;
	if (report && !powerOff) {
		const errors = motors.filter(m => worstSeverity(m.faults) === 'error').length;
		const warnings = motors.filter(m => worstSeverity(m.faults) === 'warning').length;
		if (errors) {
			chips.push({ id: 'faults', color: 'error', icon: 'mdi-alert-octagon', key: 'chip_faults', params: { n: errors } });
		} else if (warnings) {
			chips.push({ id: 'faults', color: 'warning', icon: 'mdi-alert', key: 'chip_warnings', params: { n: warnings } });
		}
		const hic = hiccupsNow(report);
		if (hic) {
			chips.push({ id: 'hiccups', color: 'error', icon: 'mdi-timer-alert-outline', key: 'chip_hiccups', params: { n: hic } });
		}
		bad = bad || errors > 0 || warnings > 0 || hic > 0;
		if (!bad && fresh.state === 'live') {
			chips.push({ id: 'ok', color: 'success', icon: 'mdi-check-circle-outline', key: 'chip_ok' });
		}
	}
	return { chips, released, powerOff };
}

// Colors of the meaning (DESIGN.md section 2) of a motor state and of a card
export const ENABLE_COLOR = { enabled: 'success', released: 'error', partial: 'warning', off: 'grey', unknown: 'grey', unpowered: 'grey' };
export const ENABLE_ICON = {
	enabled: 'mdi-engine', released: 'mdi-engine-off', partial: 'mdi-engine-off-outline', off: 'mdi-sleep',
	unknown: 'mdi-help-circle-outline', unpowered: 'mdi-power-plug-off-outline'
};
