'use strict'

// Motors page: what the Details section shows from the service's report (plugins.WorkshopService.data.motorReport,
// built by WorkshopService dsf/motor_status.py). Pure functions (without Vue) so they can be tested with node:
// test/report-view.test.js. The state of each motor at a glance is in motor-state.js.
// The texts come from the page's translator t(key, params), key relative to plugins.WorkshopMotors, called when the
// page draws (never at load time: DWC can change its language without reloading).
// They tolerate an old backend: absent fields -> empty text / null, never "undefined".

import { FAULTS, faultsOfDriver } from './faults.js'

// Where each axis's speed comes from (entry.speed_source)
const SPEED_SOURCE = {
	motion_current: 'motors.from_the_current_move',
	still: 'motors.still',
	position: 'motors.from_position_approximate',
	without_datum: 'common.no_data',
	vector: 'motors.approx_for_the_whole_move' // backend older than 2026-10-12
};

export function speedSourceText(source, t) {
	return SPEED_SOURCE[source] ? t(SPEED_SOURCE[source]) : '';
}

// With which bit map the driver state was decoded (driver.format)
const DRIVER_FORMAT = {
	rrf: 'motors.firmware_status',
	tmc51xx: 'motors.tmc2160_5160_register',
	tmc22xx: 'motors.tmc2209_register'
};

export function formatText(format, t) {
	return DRIVER_FORMAT[format] ? t(DRIVER_FORMAT[format]) : '';
}

// Real driver current: in mA if the backend estimated it, otherwise the CS_ACTUAL scale (0-31).
// With neither of the two (unknown chip or CAN board): '' -> it is not shown.
export function currentText(d, t) {
	if (!d) {
		return '';
	}
	if (typeof d.cs_current_ma === 'number') {
		return t('motors.ma_now', { ma: d.cs_current_ma.toFixed(0) });
	}
	if (typeof d.cs_current === 'number') {
		return 'CS ' + d.cs_current + '/' + (typeof d.cs_current_max === 'number' ? d.cs_current_max : 31);
	}
	return '';
}

// Late step pulses of the last M122 (RRF "hiccups", both rings), or null when the service did not read it
export function hiccups(report) {
	const bc = report && report.board_capacity;
	return bc ? (Number(bc.hiccups_ring0) || 0) + (Number(bc.hiccups_ring1) || 0) : null;
}

// The tile of Details: { cls: 'det-good' | 'det-bad' | '', value, sub }. Without a reading (power supply off, no M122
// yet) nothing is green: there is no number.
export function hiccupsTile(report, t) {
	const n = report && !report.without_power_supply ? hiccups(report) : null;
	if (n == null) {
		return { cls: '', value: '--', sub: t('details.hiccups_none') };
	}
	const total = typeof report.hiccups_total === 'number' ? ' · ' + t('details.hiccups_total', { n: report.hiccups_total }) : '';
	return { cls: n ? 'det-bad' : 'det-good', value: String(n), sub: t(n ? 'details.hiccups_bad' : 'details.hiccups_ok') + total };
}

// The move runs slower than requested (M203 / M201 / M566 hold it back)
export function speedLimited(report) {
	return !!report && report.top_speed_mm_s > 0 && report.top_speed_mm_s < report.requested_speed_mm_s - 0.1;
}

// dc42's reference row for the pulse timing of the first local driver that reports it, or null
export function dc42Of(report) {
	for (const e of (report && report.entries) || []) {
		for (const d of (e && e.drivers) || []) {
			if (d && d.m569 && d.m569.dc42_ref) {
				return d.m569.dc42_ref;
			}
		}
	}
	return null;
}

// Pulse reference in kHz for ONE motor: the ceiling MEASURED on this board (Measure) or dc42's table for the pulse
// timing of the drivers; null if there is neither.
export function refKhz(ceiling, report) {
	if (ceiling && ceiling.khz_per_motor > 0) {
		return ceiling.khz_per_motor;
	}
	const r = dc42Of(report);
	return r ? r.a_motor_length_khz : null;
}

// Steps per second the main board generates now: the sum over its drivers (an axis with two motors counts twice)
export function boardRateHz(report) {
	const b = ((report && report.boards) || []).find(x => x && x.is_local);
	return b && typeof b.combined_freq_hz === 'number' ? b.combined_freq_hz : null;
}

// What the board rate is compared with: the measured ceiling of the whole board, or dc42's reference for one motor
export function ceilingText(ceiling, report, t) {
	if (ceiling && ceiling.khz_board > 0) {
		const rate = boardRateHz(report) || 0;
		return t('details.ceiling_measured', { khz: ceiling.khz_board, pct: Math.round(rate / (ceiling.khz_board * 1000) * 100) });
	}
	const r = dc42Of(report);
	return r ? t('details.ceiling_dc42', { khz: r.a_motor_length_khz, timing: r.timing }) : t('details.ceiling_none');
}

const KINEMATICS = ['cartesian', 'coreXY', 'coreXZ', 'linearDelta', 'rotaryDelta', 'scara', 'polar', 'hangprinter'];
const KIN_NOTES = ['cartesian', 'coreXY', 'coreXZ', 'linearDelta', 'rotaryDelta'];

// The kinematics in the language of the page (the service publishes the RRF name: "cartesian", "coreXY"...)
export function kinematicsText(name, t) {
	return KINEMATICS.indexOf(name) >= 0 ? t('details.kin_' + name) : (name || '--');
}

// How the motors share the step ceiling with that kinematics
export function kinematicsNote(name, t) {
	return t('details.kin_note_' + (KIN_NOTES.indexOf(name) >= 0 ? name : 'other'));
}

// The name of a fault through the page's translator (an unknown key from a newer service: "Fault <key>")
export function faultText(key, t) {
	return Object.prototype.hasOwnProperty.call(FAULTS, key) ? t('faults.' + key) : t('faults.unknown', { key });
}

// One row per driver of every board, for the searchable table of Details. "board" and "faultsText" carry the visible
// texts: v-data-table searches the VALUES of the row, not what the slots draw. powered = false: no faults (the
// drivers are not read with the power supply off).
export function driverRows(report, t, powered) {
	const rows = [];
	for (const b of (report && report.boards) || []) {
		const boardName = b.name || b.short_name || '';
		const boardLabel = b.is_local ? t('motors.main_lower') : 'CAN ' + b.can_address;
		for (const d of b.drivers || []) {
			const faults = powered === false ? [] : faultsOfDriver(d);
			rows.push({
				id: d.id,
				board: boardName + ' ' + boardLabel,
				boardName,
				boardLabel,
				assignedTo: d.assigned_to || '',
				faults,
				faultsText: faults.map(f => faultText(f.key, t)).join(', ')
			});
		}
	}
	return rows;
}

// sys/workshop/data/axis-test.csv (written by the axis-test.g macro):
// date,mode,axis,speed,accel,distance,reps,...,difference -> [{ date, dateShort, mode, axis, speed, accel, dist, reps, dif, ok }]
// threshold(axis): the step-loss threshold of that axis in mm (AxesTest.vue).
export function parseTestsCsv(text, threshold) {
	const lines = String(text || '').split(/\r?\n/).slice(1).filter(l => l.trim());
	return lines.map(l => {
		const c = l.split(',');
		const dif = parseFloat(c[9]);
		const date = c[0] || '';
		return {
			date,
			dateShort: date.replace('T', ' ').slice(5, 16),
			mode: c[1],
			axis: c[2],
			speed: Math.round(parseFloat(c[3])),
			accel: Math.round(parseFloat(c[4])),
			dist: Math.round(parseFloat(c[5])),
			reps: Math.round(parseFloat(c[6])),
			dif: isNaN(dif) ? 0 : dif,
			ok: !isNaN(dif) && Math.abs(dif) <= threshold(c[2])
		};
	}).filter(p => p.axis);
}
