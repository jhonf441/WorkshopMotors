import { i18n } from './dwc-host.js'
'use strict'

// The Advisor of Motors without Vue (Advisor.vue draws it): the limits the machine uses NOW (object model) and the ones
// each mode file sets (sys/mode*.g, only when the machine has them), what they mean for each axis (distance to reach the
// speed, pulse rate, voltage the motor asks for), the best results of the step tests, the advice, and copying a
// suggested line.
//   node --test test/advisor.test.js   (from vue/WorkshopMotors)

export const MODE_FILES = { Laser: 'modelaser.g', CNC: 'modecnc.g', FFF: 'modefff.g' };
const FULL_STEPS = 200;
const CONFIG_FILE = 'sys/config.g';

// "M203 X18000 Y18000 Z600 ; comment" -> {X: 18000, Y: 18000, Z: 600}
// (only unindented lines = the ones that always run, not inside an if)
export function parseCode(text, code) {
	const res = {};
	const re = new RegExp('^' + code + '\\s+([^;\\n]*)', 'gmi');
	let m;
	while ((m = re.exec(String(text || ''))) !== null) {
		m[1].replace(/([A-DF-Z])\s*(-?[\d.]+)/gi, (_, axis, val) => {
			res[axis.toUpperCase()] = parseFloat(val);
		});
	}
	return res;
}

// The limits a mode file sets: max speed (M203, mm/min), acceleration (M201, mm/s²), jerk (M566, mm/min)
export function limitsOfFile(text) {
	return { M203: parseCode(text, 'M203'), M201: parseCode(text, 'M201'), M566: parseCode(text, 'M566') };
}

// The limits in use now, from the object model (move.axes[]: speed and jerk in mm/min like M203 / M566, acceleration in
// mm/s² like M201): what the machine really does, whatever file or macro set them
export function activeLimits(axes) {
	const out = { M203: {}, M201: {}, M566: {} };
	for (const a of axes || []) {
		if (!a || !a.letter) {
			continue;
		}
		if (a.speed > 0) out.M203[a.letter] = a.speed;
		if (a.acceleration > 0) out.M201[a.letter] = a.acceleration;
		if (a.jerk > 0) out.M566[a.letter] = a.jerk;
	}
	return out;
}

// One axis under some limits:
//   v (mm/s), a (mm/s²), j (mm/min); dArrives = distance to reach v from standstill (v² / 2a);
//   hz = pulses per second of each motor at v, pctRef = its share of the reference rate (refHz: the ceiling measured in
//   Measure, or dc42's table for one motor);
//   with the data of the motors (the one asking for the most voltage decides): pctV = share of the supply voltage the
//   motor asks for at v, vTorque = the speed (mm/s) where it reaches 90 % of it.
// The voltage is the classic estimate: back-EMF per turn 2*pi*rps * T / (sqrt2 * I_rated), plus the inductance
// 2*pi * (rps * steps/4) * L * I_peak (I_peak = sqrt2 * configured current). Near VIN the current cannot rise and the
// torque drops.
export function limitRow(limits, axis, om, refHz, motors, vin) {
	const o = om || {};
	const v = limits && limits.M203[axis] != null ? limits.M203[axis] / 60 : null;
	const a = limits && limits.M201[axis] != null ? limits.M201[axis] : null;
	const j = limits && limits.M566[axis] != null ? limits.M566[axis] : null;
	const spm = o.stepsPerMm || null;
	const f = { axis, v, a, j, dArrives: null, hz: null, pctRef: null, pctV: null, vTorque: null };
	if (v != null && a) {
		f.dArrives = v * v / (2 * a);
	}
	if (v != null && spm) {
		f.hz = v * spm;
		if (refHz) {
			f.pctRef = f.hz / refHz * 100;
		}
	}
	let motor = null;
	for (const d of (motors || []).filter(x => x.valid && x.inductance_mh && x.torque_ncm)) {
		if (!motor || d.inductance_mh * d.current_a > motor.inductance_mh * motor.current_a) {
			motor = d;
		}
	}
	if (motor && v != null && spm && vin > 0) {
		const micro = (o.microstepping && o.microstepping.value) || 16;
		const mmByTurn = FULL_STEPS * micro / spm;
		const voltsPerRps = 2 * Math.PI * (motor.torque_ncm / 100) / (Math.SQRT2 * motor.current_a) +
			2 * Math.PI * (FULL_STEPS / 4) * (motor.inductance_mh / 1000) * (Math.SQRT2 * (o.current || 0) / 1000);
		f.pctV = voltsPerRps * (v / mmByTurn) / vin * 100;
		f.vTorque = (0.9 * vin / voltsPerRps) * mmByTurn;
	}
	return f;
}

// Per mode+axis: highest speed and highest acceleration that passed, and the lowest that failed of each. The CSV does
// not say whether the test was a speed ladder or an acceleration ladder (2026-10-09): the CAUSE of each failure is
// deduced from those that passed -- if that speed already passed in another test and that acceleration did not, it
// failed by acceleration; the reverse, by speed; if it cannot be known, it counts for both.
export function bestTests(tests) {
	const groups = {};
	for (const p of tests || []) {
		(groups[p.mode + '|' + p.axis] = groups[p.mode + '|' + p.axis] || []).push(p);
	}
	const r = {};
	Object.keys(groups).forEach(k => {
		const L = groups[k];
		const ok = L.filter(p => p.ok);
		const x = { okV: null, okA: null, failV: null, failA: null, failVA: null };
		ok.forEach(p => {
			if (x.okV == null || p.speed > x.okV) { x.okV = p.speed; }
			if (x.okA == null || p.accel > x.okA) { x.okA = p.accel; }
		});
		L.filter(p => !p.ok).forEach(p => {
			const speedStep = ok.some(o => o.speed >= p.speed);
			const accelStep = ok.some(o => o.accel >= p.accel);
			const bySpeed = !speedStep || (speedStep === accelStep);
			const byAccel = !accelStep || (speedStep === accelStep);
			if (bySpeed && (x.failV == null || p.speed < x.failV)) { x.failV = p.speed; }
			if (byAccel && (x.failA == null || p.accel < x.failA)) { x.failA = p.accel; x.failVA = p.speed; }
		});
		r[k] = x;
	});
	return r;
}

// The data of the motors (sys/workshop/config/motors.json v2): {version: 2, general: {...}, axes: {Z: {...}},
// drivers: {"0.5": {...}}}. The form keys:
// 'general', 'axis:Z' and 'drv:0.5' (one motor of an axis with several); those that are not there inherit:
// motor -> its axis -> general.
export function formFromMotorFile(j) {
	const form = d => ({
		model: (d && d.model) || '',
		current_a: (d && d.current_a) || '',
		inductance_mh: (d && d.inductance_mh) || '',
		torque_ncm: (d && d.torque_ncm) || '',
		steps_per_rev: (d && d.steps_per_rev) || ''
	});
	const f = { general: form(j && j.general) };
	Object.keys((j && j.axes) || {}).forEach(e => { f['axis:' + e] = form(j.axes[e]); });
	Object.keys((j && j.drivers) || {}).forEach(d => { f['drv:' + d] = form(j.drivers[d]); });
	return f;
}

// The file to save from the form (the inverse of formFromMotorFile)
export function motorFileFromForm(form) {
	const clean = d => ({
		model: d.model || '',
		current_a: parseFloat(d.current_a) || null,
		inductance_mh: parseFloat(d.inductance_mh) || null,
		torque_ncm: parseFloat(d.torque_ncm) || null,
		steps_per_rev: parseInt(d.steps_per_rev, 10) || null
	});
	const gen = clean(form.general || {});
	const data = { version: 2, general: gen, axes: {}, drivers: {} };
	Object.keys(form).forEach(k => {
		if (k.startsWith('axis:')) data.axes[k.slice('axis:'.length)] = clean(form[k]);
		else if (k.startsWith('drv:')) data.drivers[k.slice('drv:'.length)] = clean(form[k]);
	});
	return data;
}

// Where a suggested speed / acceleration line goes: the file of the current mode when the machine has it, else config.g
export function fileForLines(mode, modesFound) {
	return MODE_FILES[mode] && modesFound && modesFound[mode] ? 'sys/' + MODE_FILES[mode] : CONFIG_FILE;
}

const t = (key, params) => i18n.t('plugins.WorkshopMotors.advisor.' + key, params);
const round100 = x => Math.round(x / 100) * 100;

// The advice, in this order: hiccups of the board, current of each axis, then per axis with the limits in use: distance
// to reach the speed, pulses, voltage, tests. Each one: { level: error | notice | ok | info, title, text, line?, file? }
//   report   motorReport of the service (board_capacity: the late pulses)
//   axes     visible axes of the object model (current: M906)
//   motors   { letter: [the data of each motor of the axis] }
//   rows     { letter: limitRow() with the limits in use }
//   tests    bestTests(); mode: the machine mode (the tests are kept per mode); file: fileForLines(); vin: supply volts
export function advice({ report, axes, motors, rows, tests, mode, file, vin }) {
	const out = [];
	const cap = report && report.board_capacity;
	if (cap && (cap.hiccups_ring0 + cap.hiccups_ring1) > 0) {
		out.push({ level: 'error', title: t('the_board_didn_t_generate_some'), text: t('lower_the_max_speed_or_the') });
	}

	// current: per axis, with the data of ITS motors (if the axis has different motors the one with the lowest rated
	// current is used: M906 is a single one per axis and cannot be exceeded in any). The suggested line only sets the
	// axis current: the idle factor (M906 I) is the same for every axis and stays as it is.
	const well = [];
	const withoutData = [];
	for (const om of axes || []) {
		const axis = om && om.letter;
		const iSet = om ? om.current : null;
		if (!axis || !iSet) {
			continue;
		}
		const ds = (motors[axis] || []).filter(d => d.valid);
		if (!ds.length) {
			withoutData.push(axis);
			continue;
		}
		const nom = Math.min.apply(null, ds.map(d => d.current_a));
		const pct = iSet / (nom * 1000) * 100;
		const recMin = Math.round(nom * 500 / 100) * 100;
		const recMax = Math.round(nom * 850 / 100) * 100;
		if (pct > 90) {
			out.push({ level: 'error', title: t('current_too_high', { axis, ma: iSet, pct: pct.toFixed(0), a: nom }),
				text: t('duet_recommends_50_85_of_rated'), line: `M906 ${axis}${recMax}`, file: CONFIG_FILE });
		} else if (pct < 45) {
			out.push({ level: 'notice', title: t('current_low', { axis, ma: iSet, pct: pct.toFixed(0), a: nom }),
				text: t('with_low_current_the_motor_loses'), line: `M906 ${axis}${recMax}`, file: CONFIG_FILE });
		} else {
			well.push(t('current_ok_detail', { axis, ma: iSet, pct: pct.toFixed(0), min: recMin, max: recMax }));
		}
	}
	if (well.length) {
		out.push({ level: 'ok', title: t('current_ok_on_n_axes', { n: well.length }), text: well.join(' · ') });
	}
	if (withoutData.length) {
		out.push({ level: 'info', title: t('no_motor_data_for', { axes: withoutData.join(', ') }), text: t('enter_the_rated_current_below_general') });
	}

	for (const om of axes || []) {
		const axis = om && om.letter;
		const f = axis ? rows[axis] : null;
		if (!f || f.v == null || f.a == null) {
			continue;
		}
		// acceleration: distance to reach the speed (the suggestion does not exceed 80% of the highest acceleration
		// tested without losing steps)
		const p = tests[mode + '|' + axis];
		const capA = p && p.failA != null && p.okA != null ? round100(p.okA * 0.8) : null;
		if (f.dArrives > 60 && !(capA != null && capA <= f.a)) {
			const suggested = Math.min(capA != null ? capA : 3000, round100(f.a * 3));
			const laser = mode === 'Laser' ? ' ' + t('also_with_the_laser_the_areas') : '';
			out.push({ level: 'notice', title: t('accel_distance', { axis, a: f.a, d: f.dArrives.toFixed(0), v: f.v.toFixed(0) }),
				text: t('when_engraving_and_cutting_short_lines') + laser + ' ' + t('try_accel_ladder_first'),
				line: `M201 ${axis}${suggested}`, file });
		}
		if (f.pctRef != null) {
			out.push(f.pctRef > 80
				? { level: 'notice', title: t('pulse_rate_high', { axis, pct: f.pctRef.toFixed(0) }), text: t('you_re_close_to_the_board') }
				: { level: 'ok', title: t('pulse_rate_ok', { axis, pct: f.pctRef.toFixed(0) }), text: t('pulses_aren_t_what_limits_the') });
		}
		if (f.pctV != null && f.vTorque != null) {
			out.push(f.pctV > 90
				? { level: 'error', title: t('voltage_high', { axis, v: f.v.toFixed(0), pct: f.pctV.toFixed(0), vin: vin.toFixed(0) }), text: t('voltage_high_text', { v: f.vTorque.toFixed(0) }) }
				: { level: 'ok', title: t('torque_ok', { axis, v: f.vTorque.toFixed(0) }), text: t('torque_ok_text', { pct: f.pctV.toFixed(0) }) });
		}
		if (p) {
			if (p.failV != null) {
				const there = f.v * 60 >= p.failV;
				out.push({ level: there ? 'error' : 'notice',
					title: t('lost_steps_speed', { axis, v: p.failV }) + (there ? ' -- ' + t('your_max_already_there', { v: Math.round(f.v * 60) }) : ''),
					text: t('highest_speed_passed', { v: p.okV != null ? p.okV + ' mm/min' : t('none_f') }),
					line: p.okV ? `M203 ${axis}${round100(p.okV * 0.8)}` : null, file });
			} else if (p.okV != null) {
				out.push({ level: 'ok', title: t('speed_tested_ok', { axis, v: p.okV }), text: t('no_lost_steps_you_can_try') });
			}
			if (p.failA != null) {
				const there = f.a >= p.failA;
				out.push({ level: there ? 'error' : 'notice',
					title: t('lost_steps_accel', { axis, a: p.failA }) + (p.failVA ? ' ' + t('at_speed_paren', { v: p.failVA }) : '') + (there ? ' -- ' + t('your_accel_already_there', { a: f.a }) : ''),
					text: t('highest_accel_passed', { a: p.okA != null ? p.okA + ' mm/s²' : t('none_f') }),
					line: p.okA ? `M201 ${axis}${round100(p.okA * 0.8)}` : null, file });
			} else if (p.okA != null) {
				out.push({ level: 'ok', title: t('accel_tested_ok', { axis, a: p.okA }),
					text: p.okA > f.a ? t('accel_margin', { a: f.a, max: round100(p.okA * 0.8) }) : t('no_lost_steps_with_the_configured') });
			} else {
				out.push({ level: 'info', title: t('accel_not_tested', { axis }), text: t('run_an_acceleration_ladder_in_the') });
			}
		} else if (axis === 'X' || axis === 'Y') {
			out.push({ level: 'info', title: t('no_tests_in_mode', { axis }), text: t('run_a_ladder_in_the_test') });
		}
	}
	return out;
}

// Copies a text -> Promise<boolean>. navigator.clipboard only exists on https or localhost: DWC on the workshop network
// is plain http, so the old way (a hidden textarea + execCommand) is the one that works there. env: { navigator,
// document } for the tests.
export async function copyText(text, env) {
	const nav = env ? env.navigator : (typeof navigator !== 'undefined' ? navigator : null);
	const doc = env ? env.document : (typeof document !== 'undefined' ? document : null);
	try {
		if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
			await nav.clipboard.writeText(String(text));
			return true;
		}
	} catch (e) {
		// refused (permission, focus): the old way below
	}
	if (!doc || !doc.body) {
		return false;
	}
	try {
		const ta = doc.createElement('textarea');
		ta.value = String(text);
		ta.setAttribute('readonly', '');
		ta.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0;';
		doc.body.appendChild(ta);
		ta.select();
		const ok = doc.execCommand('copy');
		doc.body.removeChild(ta);
		return !!ok;
	} catch (e) {
		return false;
	}
}
