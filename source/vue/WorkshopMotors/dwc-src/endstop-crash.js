import { i18n } from './dwc-host.js'
'use strict'

// "Configure crash" as an end stop: guided calibration of StallGuard for sensorless homing
// (Motors > Crash > Sensorless end stop; item 25, 2026-10-12). Pure functions
// (without Vue) to test them with node:
//   node --test test/endstop-crash.test.js   (from vue/WorkshopMotors)
//
// Sources (RepRapFirmware 3.6, docs.duet3d.com):
//  - "Stall detection and sensorless homing" (User_manual/Connecting_hardware/Sensors_stall_detection):
//    TMC2160/5160 (6HC, 3HC, 1HCL) = stallGuard2, works in spreadCycle; TMC2209 (Mini 5+, 1LC) and
//    TMC2240 (Roto) = stallGuard4, only in stealthChop (M569 D3, and M569's V sets up to what
//    speed it stays in stealthChop). It is not reliable at low speed: M915 H = minimum full steps
//    per second (200 by default). Less current (M913) = detects more easily. "Set the S
//    parameter to the lowest value at which you do not get false stall reports". Homing:
//    M574 <axis><1|2> S3 in config.g and M915 <axis> ... R0 F0; in the homing files M913 lowers the
//    current and G1 H1 goes to the stop.
//  - G-code M915: S from -64 to +63 (TMC2209: -128 to +127); lower = more sensitive; less than -10 is
//    not recommended; F1 = one reading every 4 full steps; R0 nothing, R1 notifies, R2/R3 event
//    (driver-stall.g). In 3.6.0+ a G1 H1/H3/H4 with a crash end stop is rejected if the speed does not
//    reach (or is too high, in TMC2209/2240) to detect.
//  - G-code M574: S3 = crash, for all the motors of the axis at the first one that jams; S4 = each
//    motor on its own. It must go after M584.
//  - G-code G1: H4 = stops when the end stop activates and updates the position (RRF 3.2+). The G1 H1-H4 do not
//    apply the M208 limits (GCodes.cpp: only moveType 0 goes through LimitPosition).
//  - RRF 3.6 code (TMC51xx.cpp CheckStallDetectionEnabled): with the driver outside spreadCycle
//    -> "driver %u is not in spreadCycle mode"; if speed in full steps/s < H -> "move is too
//    slow for driver %u to detect stall".
//
// Generic: axes, drivers, boards and end stops come from the object model (move.axes, boards,
// sensors.endstops); nothing fixed from the workshop.

import { block } from './enable.js'
import { readM569, readM915 } from './charts.js'
import { sha256, utf8 } from './sha256.js'

export { readM569, readM915 };

// ---- Drivers: which chip each board has ----

// chipKey / noteKey: keys relative to plugins.WorkshopMotors, translated when familyBoard() is called (never at
// load time: DWC can change its language without reloading)
const families = [
	{ re: /6XD|1XD/i, chipKey: 'crashFinal.external_driver', sg: 0, mode: null, sMin: 0, sMax: 0, noteKey: 'crashFinal.external_drivers_6xd_1xd_boards_have' },
	{ re: /1HCL|23CL/i, chipKey: 'crashFinal.chip_tmc2160_closed_loop', sg: 2, mode: 'spreadCycle', sMin: -64, sMax: 63, noteKey: 'crashFinal.in_closed_loop_there_is_no' },
	{ re: /6HC|3HC/i, chip: 'TMC2160/5160', sg: 2, mode: 'spreadCycle', sMin: -64, sMax: 63 },
	{ re: /Mini ?5|MINI5|1LC/i, chip: 'TMC2209', sg: 4, mode: 'stealthChop', sMin: -128, sMax: 127, noteKey: 'crashFinal.tmc2209_stallguard_only_works_in_stealthchop' },
	{ re: /1RR|Roto/i, chip: 'TMC2240', sg: 4, mode: 'stealthChop', sMin: -128, sMax: 127, noteKey: 'crashFinal.tmc2240_stallguard_only_works_in_stealthchop' },
	{ re: /^2|Duet ?2|WiFi|Ethernet|Maestro/i, chip: 'TMC2660', sg: 2, mode: null, sMin: -64, sMax: 63 }
];

const UNKNOWN = { chipKey: 'crashFinal.chip_unknown', sg: null, mode: null, sMin: -64, sMax: 63, noteKey: 'crashFinal.it_is_not_known_which_driver' };
const MAESTRO = { chip: 'TMC2224', sg: 0, mode: null, sMin: -64, sMax: 63, noteKey: 'crashFinal.the_duet_maestro_has_no_stallguard' };

const ct = key => i18n.t('plugins.WorkshopMotors.' + key);

function family(f) {
	return { chip: f.chipKey ? ct(f.chipKey) : f.chip, sg: f.sg, mode: f.mode, sMin: f.sMin, sMax: f.sMax, note: f.noteKey ? ct(f.noteKey) : '' };
}

// What the service DISCOVERED about the boards (capabilities.get > capabilities.boards.items: shortName, chip, smart_drivers,
// closed_loop, known). The service owns the table of boards (boards_table.py); this page asks it first and only falls back to the
// names above with a service that has no capabilities. A board the service does not know, or a chip nobody told us about,
// is "unknown": no sensitivity range is invented for it.
const CHIPS = [
	{ re: /^TMC(2160|5160|5161)$/i, sg: 2, mode: 'spreadCycle', sMin: -64, sMax: 63 },
	{ re: /^TMC2209$/i, sg: 4, mode: 'stealthChop', sMin: -128, sMax: 127, noteKey: 'crashFinal.tmc2209_stallguard_only_works_in_stealthchop' },
	{ re: /^TMC2240$/i, sg: 4, mode: 'stealthChop', sMin: -128, sMax: 127, noteKey: 'crashFinal.tmc2240_stallguard_only_works_in_stealthchop' },
	{ re: /^TMC2660$/i, sg: 2, mode: null, sMin: -64, sMax: 63 }
];

function boardCaps(board, caps) {
	const list = caps && caps.capabilities && caps.capabilities.boards && caps.capabilities.boards.items;
	if (!Array.isArray(list) || !list.length) {
		return null;
	}
	const name = String((board && (board.shortName || board.name)) || '').toLowerCase();
	return list.find(b => b && b.short_name && String(b.short_name).toLowerCase() === name) || { known: false };
}

function familyFromCaps(c) {
	if (!c.known) {
		return family(UNKNOWN);
	}
	if (c.chip) {
		const f = CHIPS.find(x => x.re.test(String(c.chip)));
		if (!f) {
			return family(UNKNOWN);
		}
		const closed = c.closed_loop ? { noteKey: 'crashFinal.in_closed_loop_there_is_no' } : {};
		return family(Object.assign({}, f, { chip: String(c.chip) }, closed));
	}
	// a known board with no chip of its own: external drivers (6XD / 1XD)
	return c.smart_drivers === false ? family(families[0]) : family(UNKNOWN);
}

// board: the object model board of the driver; caps: capabilities.get (optional, see above)
export function familyBoard(board, caps) {
	const c = boardCaps(board, caps);
	if (c) {
		return familyFromCaps(c);
	}
	const n = String((board && (board.shortName || board.name)) || '');
	if (/Maestro/i.test(n)) {
		return family(MAESTRO);
	}
	for (const f of families) {
		if (n && f.re.test(n)) {
			return family(f);
		}
	}
	return family(UNKNOWN);
}

export function idDriver(d) {
	if (d && typeof d === 'object' && 'board' in d && 'driver' in d) {
		return d.board + '.' + d.driver;
	}
	const s = String(d);
	return s.indexOf('.') >= 0 ? s : '0.' + s;
}

export function boardOfDriver(om, id) {
	const can = Number(String(id).split('.')[0]) || 0;
	const boards = (om && Array.isArray(om.boards)) ? om.boards : [];
	return boards.find(b => b && (Number(b.canAddress) || 0) === can) || null;
}

// Letter in G-code: lowercase ones (RRF 3.5+) go with a quote: 'a
export function letterGcode(L) {
	const s = String(L || '');
	return s === s.toLowerCase() && s !== s.toUpperCase() ? "'" + s : s;
}

// ---- Axes that can be calibrated ----

const KIND_CRASH = { motorStallAny: 'S3', motorStallIndividual: 'S4' };

// [{ letter, index, drivers: [{ id, board, family }], family (the most restrictive), homed, min, max,
//    stepsMm, micro, fsmm, speedMax (mm/s), current, pctCurrent,
//    final: { kind: 'S3'|'S4'|'other'|null, end: 1|2|null, textKind } }]
export function axesOf(om, caps) {
	const move = (om && om.move) || {};
	const endstops = (om && om.sensors && Array.isArray(om.sensors.endstops)) ? om.sensors.endstops : [];
	const out = [];
	(move.axes || []).forEach((a, i) => {
		if (!a || !a.letter || a.visible === false || !(a.drivers || []).length) {
			return;
		}
		const drivers = a.drivers.map(idDriver).map(id => {
			const board = boardOfDriver(om, id);
			return { id, board: board ? (board.shortName || board.name || '') : '', family: familyBoard(board, caps) };
		});
		// the family that rules is the most restrictive: external > unknown > whichever
		let family = drivers[0].family;
		for (const d of drivers) {
			if (d.family.sg === 0) {
				family = d.family;
				break;
			}
			if (d.family.sg == null) {
				family = d.family;
			}
		}
		const micro = (a.microstepping && a.microstepping.value) || 16;
		const fsmm = a.stepsPerMm ? a.stepsPerMm / micro : null;
		const end = endstops[i] || null;
		const kind = end ? (KIND_CRASH[end.type] || (end.type ? 'other' : null)) : null;
		out.push({
			letter: String(a.letter), index: i, drivers, family: family,
			homed: !!a.homed, min: a.min, max: a.max,
			stepsMm: a.stepsPerMm, micro, fsmm,
			speedMax: typeof a.speed === 'number' ? a.speed / 60 : null,
			current: a.current, pctCurrent: typeof a.percentCurrent === 'number' ? a.percentCurrent : 100,
			final: { kind: kind, end: end && typeof end.highEnd === 'boolean' ? (end.highEnd ? 2 : 1) : null, textKind: end ? String(end.type || '') : '' }
		});
	});
	return out;
}

// Minimum speed (mm/s) for the driver to measure: H full steps per second
export function speedMin(h, fsmm) {
	if (!(fsmm > 0) || !(h > 0)) {
		return null;
	}
	return h / fsmm;
}

// Reasonable initial values for an axis
export function valuesInitial(axis, m915Current) {
	const h = m915Current && m915Current.h > 0 ? m915Current.h : 200;
	const vmin = speedMin(h, axis && axis.fsmm) || 20;
	const vTop = axis && axis.speedMax ? axis.speedMax * 0.8 : 200;
	return {
		h,
		f: 0, // the doc suggests F0 for homing (F1 delays the detection)
		v: Math.max(5, Math.min(Math.ceil(vmin * 1.5), Math.floor(vTop))),
		correction: 40,
		length: 40,
		approach: 10,
		overshoot: 5,
		end: axis && axis.final && axis.final.end ? axis.final.end : 1,
		kindFinal: axis && axis.drivers && axis.drivers.length > 1 ? 'S4' : 'S3'
	};
}

// Requirements: [{ key, ok, text, blocks }]. op: { axis, om, liveJob, v, h, correction, f, modes: { id: 'spreadCycle'... },
// length, approach, overshoot, forSweep }
export function requirements(op) {
	const o = op || {};
	const e = o.axis;
	const out = [];
	if (!e) {
		return [{ key: 'axis', ok: false, text: i18n.t('plugins.WorkshopMotors.crashFinal.pick_an_axis'), blocks: true }];
	}
	const b = block(o.om, o.liveJob);
	out.push({ key: 'free', ok: !b.blocked, text: b.blocked ? b.reason : i18n.t('plugins.WorkshopMotors.crashFinal.machine_free_no_job_running'), blocks: true });
	const driverFamily = e.family;
	out.push({
		key: 'chip', ok: driverFamily.sg !== 0, blocks: driverFamily.sg === 0,
		text: driverFamily.sg === 0 ? driverFamily.note : 'Driver ' + driverFamily.chip + (driverFamily.sg ? ' (stallGuard' + driverFamily.sg + ')' : '') + (driverFamily.note ? ': ' + driverFamily.note : '')
	});
	if (driverFamily.mode) {
		const ids = e.drivers.map(d => d.id);
		const modes = o.modes || {};
		const known = ids.filter(id => modes[id]);
		const wrong = known.filter(id => String(modes[id]).toLowerCase().indexOf(driverFamily.mode.toLowerCase()) < 0);
		out.push({
			key: 'mode', ok: known.length > 0 && !wrong.length, blocks: wrong.length > 0,
			text: wrong.length
				? i18n.t('plugins.WorkshopMotors.crashFinal.driver_mode_needs', { drivers: wrong.join(', '), modes: wrong.map(id => modes[id]).join(', '), mode: driverFamily.mode, first: wrong[0], d: driverFamily.mode === 'spreadCycle' ? ' D2' : ' D3' })
				: (known.length ? i18n.t('plugins.WorkshopMotors.crashFinal.drivers_in_mode', { mode: driverFamily.mode }) : i18n.t('plugins.WorkshopMotors.crashFinal.reading_the_driver_mode_m569'))
		});
	}
	const vmin = speedMin(o.h, e.fsmm);
	if (vmin != null) {
		out.push({
			key: 'speed', ok: o.v >= vmin, blocks: !(o.v >= vmin),
			text: o.v >= vmin
				? i18n.t('plugins.WorkshopMotors.crashFinal.speed_ok_measures_from', { v: num(o.v), min: num(vmin), h: o.h })
				: i18n.t('plugins.WorkshopMotors.crashFinal.speed_too_low', { v: num(o.v), min: num(vmin), h: o.h })
		});
	}
	if (e.speedMax && o.v > e.speedMax) {
		out.push({ key: 'speedMax', ok: false, blocks: true, text: i18n.t('plugins.WorkshopMotors.crashFinal.speed_over_axis_max', { v: num(e.speedMax) }) });
	}
	out.push({
		key: 'correction', ok: o.correction >= 20 && o.correction <= 100, blocks: !(o.correction >= 20 && o.correction <= 100),
		text: i18n.t('plugins.WorkshopMotors.crashFinal.test_current_pct', { pct: o.correction }) + (e.current ? ' (~' + Math.round(e.current * o.correction / 100) + ' mA)' : '')
	});
	if (o.forSweep) {
		out.push({ key: 'homed', ok: e.homed, blocks: !e.homed, text: e.homed ? i18n.t('plugins.WorkshopMotors.crashFinal.axis_homed', { axis: e.letter }) : i18n.t('plugins.WorkshopMotors.crashFinal.home_axis_first', { axis: e.letter }) });
		const isCrash = e.final.kind === 'S3' || e.final.kind === 'S4';
		out.push({
			key: 'final', ok: isCrash, blocks: !isCrash,
			text: isCrash
				? (e.final.end === 2 ? i18n.t('plugins.WorkshopMotors.crashFinal.endstop_stall_high', { axis: e.letter, type: e.final.kind }) : i18n.t('plugins.WorkshopMotors.crashFinal.endstop_stall_low', { axis: e.letter, type: e.final.kind }))
				: i18n.t('plugins.WorkshopMotors.crashFinal.endstop_not_stall', { axis: e.letter, type: e.final.textKind || i18n.t('plugins.WorkshopMotors.crashFinal.no_endstop') })
		});
		if (typeof e.min === 'number' && typeof e.max === 'number') {
			const ok = e.max - e.min >= (o.length || 40) + 2 * (o.approach || 10);
			out.push({ key: 'route', ok, blocks: !ok, text: ok ? i18n.t('plugins.WorkshopMotors.crashFinal.travel_of_axis', { axis: e.letter, min: num(e.min), max: num(e.max) }) : i18n.t('plugins.WorkshopMotors.crashFinal.the_axis_is_too_short_for') });
		}
	}
	return out;
}

function num(v) {
	return typeof v === 'number' && isFinite(v) ? String(Math.round(v * 10) / 10) : '--';
}

// ---- Sensitivity sweep ----
// 'free' phase: short stretches through the middle of the travel, from the least sensitive to the most sensitive,
// until the first FALSE crash (there is nothing in the way). 'tope' phase: with the most sensitive one without
// false ones + a margin, against the real stop; the user says what happened.

export function sequence(family) {
	if (family && family.sg === 4) {
		return { start: 100, end: -60, step: 8, margin: 8, max: 127 };
	}
	// stallGuard2: the documentation does not recommend less than -10
	return { start: 16, end: -10, step: 2, margin: 2, max: 63 };
}

export function newSweep(family) {
	const sec = sequence(family);
	return { phase: 'free', sec, s: sec.start, lastOk: null, fake: null, candidate: null, attempts: [], reason: '', final: null, steps: 0 };
}

function aCap(b) {
	b.phase = 'stop';
	b.candidate = Math.min(b.sec.max, b.lastOk + b.sec.margin);
	return b;
}

// Result of a free stretch: { stopped } (true = it stopped before the end of the stretch = a false crash)
export function resultFree(b0, res) {
	const b = Object.assign({}, b0, { attempts: b0.attempts.slice() });
	b.steps++;
	if (res && res.stopped) {
		b.fake = b.s;
		if (b.lastOk == null) {
			b.phase = 'failure';
			b.reason = i18n.t('plugins.WorkshopMotors.crashFinal.least_sensitive_false_stalls', { s: b.s });
			return b;
		}
		return aCap(b);
	}
	b.lastOk = b.s;
	b.s -= b.sec.step;
	if (b.s < b.sec.end) {
		return aCap(b);
	}
	return b;
}

// Result against the stop: the user's answer 'well' | 'before' | 'followed'
export function resultCap(b0, response, route) {
	const b = Object.assign({}, b0, { attempts: b0.attempts.concat([{ s: b0.candidate, response: response, route: route == null ? null : route }]) });
	b.steps++;
	if (response === 'well') {
		b.phase = 'ready';
		b.final = b.candidate;
		b.reason = b.candidate <= b.lastOk ? i18n.t('plugins.WorkshopMotors.crashFinal.no_margin_a_more_sensitive_value') : '';
		return b;
	}
	if (b.attempts.length >= 8) {
		b.phase = 'failure';
		b.reason = i18n.t('plugins.WorkshopMotors.crashFinal.after_8_attempts_there_is_no');
		return b;
	}
	if (response === 'before') {
		const s = b.candidate + b.sec.step;
		if (s > b.sec.max) {
			b.phase = 'failure';
			b.reason = i18n.t('plugins.WorkshopMotors.crashFinal.it_stops_before_the_end_even');
			return b;
		}
		b.candidate = s;
		return b;
	}
	// 'followed': it did not detect the stop
	const s = b.candidate - b.sec.step;
	if (s < b.lastOk) {
		b.phase = 'failure';
		b.reason = i18n.t('plugins.WorkshopMotors.crashFinal.detect_end_needs_false', { s: b.fake });
		return b;
	}
	b.candidate = s;
	return b;
}

// Suggested answer according to what the macro measured (the user confirms)
export function hint(res) {
	if (!res) {
		return null;
	}
	return res.stopped ? 'well' : 'followed';
}

// ---- Macro of ONE step ----
// The page writes it on the card and calls it with M98: this way the axis letter is written (RRF does not
// allow variable axis letters) and the current is restored inside the same macro.

export const MACRO_STEP = '0:/sys/workshop/data/stall-step.g';

export function segmentFree(axis, largo, end, margin) {
	const m = margin == null ? 10 : margin;
	const it = axis.min + m;
	const hi = axis.max - m;
	const L = Math.max(5, Math.min(largo, hi - it));
	const center = (it + hi) / 2;
	// toward the end stop's end: low = toward min
	if (end === 2) {
		const a = Math.max(it, Math.min(center - L / 2, hi - L));
		return { start: a, length: L, dir: 1 };
	}
	const a = Math.min(hi, Math.max(center + L / 2, it + L));
	return { start: a, length: L, dir: -1 };
}

function r2(v) {
	return Math.round(v * 100) / 100;
}

// op: { axis, mode: 'free'|'stop', end, v, correction, h, f, s, length, approach, overshoot }
export function macroStep(op) {
	const e = op.axis;
	const L = letterGcode(e.letter);
	const correctionRevert = Math.round(e.pctCurrent || 100);
	let start;
	let dist;
	let dir;
	if (op.mode === 'stop') {
		dir = op.end === 2 ? 1 : -1;
		start = dir < 0 ? e.min + op.approach : e.max - op.approach;
		dist = op.approach + op.overshoot;
	} else {
		const t = segmentFree(e, op.length, op.end, Math.max(10, op.approach || 10));
		dir = t.dir;
		start = t.start;
		dist = t.length;
	}
	const fGo = Math.round(Math.min(3000, (e.speedMax || 50) * 60));
	const st = 'state.status';
	const lines = [
		'; ' + MACRO_STEP.replace('0:/', '') + ' -- written by WorkshopMotors (Motors > Crash > Sensorless endstop)',
		'; for ONE step of the calibration and rewritten on every step. Axis ' + e.letter + ', ' + (op.mode === 'stop' ? 'against the end stop' : 'free stretch') + ', M915 S' + op.s + '.',
		'var en = exists(global.workshopLanguage) ? (global.workshopLanguage == "en") : false   ; messages in English (DWC language)',
		'if ' + ['processing', 'paused', 'pausing', 'resuming', 'simulating'].map(x => st + ' == "' + x + '"').join(' || '),
		'  abort {var.en ? "Sensorless endstop: a job is running" : "Final sin sensor: hay un trabajo en curso"}',
		'if !move.axes[' + e.index + '].homed',
		'  abort {var.en ? "Sensorless endstop: home ' + e.letter + ' first" : "Final sin sensor: primero haz homing de ' + e.letter + '"}',
		'if !exists(global.endCrashPending)',
		'  global endCrashPending = ""',
		'if !exists(global.endCrashCorrection)',
		'  global endCrashCorrection = 100',
		'if !exists(global.endCrashRes)',
		'  global endCrashRes = ""',
		'if !exists(global.endCrashN)',
		'  global endCrashN = 0',
		'set global.endCrashRes = ""',
		'M400',
		'G90',
		'; go to the start without detecting anything (normal move, inside the limits)',
		'G53 G1 ' + L + r2(start) + ' F' + fGo + ' S0',
		'M400',
		'set global.endCrashCorrection = ' + correctionRevert,
		'set global.endCrashPending = "' + e.letter + '"',
		'M913 ' + L + Math.round(op.correction),
		'M915 ' + L + ' S' + Math.round(op.s) + ' F' + (op.f ? 1 : 0) + ' H' + Math.round(op.h),
		'G4 P200',
		'var p0 = move.axes[' + e.index + '].machinePosition',
		'G91',
		'G1 H4 ' + L + r2(dir * dist) + ' F' + Math.round(op.v * 60) + ' S0',
		'G90',
		'M400',
		'var rec = abs(move.axes[' + e.index + '].machinePosition - var.p0)',
		'M913 ' + L + correctionRevert,
		'set global.endCrashPending = ""',
		'set global.endCrashRes = "FINCHOQUE " ^ var.rec ^ " ' + r2(dist) + '"',
		'set global.endCrashN = global.endCrashN + 1',
		'echo global.endCrashRes'
	];
	if (op.mode === 'stop') {
		lines.push('; move away from the end stop', 'G91', 'G1 ' + L + r2(-dir * op.approach) + ' F' + fGo + ' S0', 'G90', 'M400');
	}
	return lines.join('\n') + '\n';
}

// "FINCHOQUE 12.3 40" -> { recorrido, pedido, detenido }
export function readStep(text) {
	const m = /FINCHOQUE\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(String(text || ''));
	if (!m) {
		return null;
	}
	const route = parseFloat(m[1]);
	const request = parseFloat(m[2]);
	return { route: route, requested: request, stopped: route < request - 0.5 };
}

// Commands to leave M915 as it was before the test (originals: [{ id, s, f, h }])
export function commandsRestore(originals) {
	return (originals || []).filter(o => o && o.id && typeof o.s === 'number').map(o => 'M915 P' + o.id + ' S' + o.s + ' F' + (o.f ? 1 : 0) + ' H' + (o.h > 0 ? o.h : 200));
}

// ---- Proposal for config.g ----

function withoutComment(l) {
	return String(l).replace(/;.*$/, '').trim();
}

function tokens(l) {
	return withoutComment(l).split(/\s+/).filter(Boolean);
}

function isCmd(l, cmd) {
	return new RegExp('^\\s*(?:N\\d+\\s+)?' + cmd + '(?![\\d.])', 'i').test(withoutComment(l)) && tokens(l).length > 0;
}

const letters = 'XYZUVWABCD';

// Axis letters a line mentions (M574 X1 Y2 -> ['X', 'Y']; M915 X Y S3 -> ['X', 'Y'])
export function axesOfLine(l) {
	const out = [];
	for (const t of tokens(l).slice(1)) {
		const m = /^'?([A-Za-z])/.exec(t);
		if (!m) {
			continue;
		}
		const ch = t[0] === "'" ? m[1].toLowerCase() : m[1];
		if (t[0] === "'" || letters.indexOf(ch) >= 0) {
			// in M915 / M574 the parameter letters (S, F, H, R, T, P, K) are not axes
			if (t[0] !== "'" && 'SFHRTPKE'.indexOf(ch) >= 0) {
				continue;
			}
			out.push(ch);
		}
	}
	return out;
}

function valueLetter(l, letter) {
	for (const t of tokens(l).slice(1)) {
		if (t[0].toUpperCase() === letter.toUpperCase() && t[0] !== "'") {
			return t.slice(1);
		}
	}
	return null;
}

// Proposes the lines for config.g. op: { letter, end: 1|2, kindFinal: 'S3'|'S4', s, f, h, date }
// -> { text, changes: [{ kind: 'replacement'|'added'|'same', line (1..n of the new text), before, after, note }], notices }
export function proposeConfig(textConfig, op) {
	const eol = /\r\n/.test(textConfig) ? '\r\n' : '\n';
	const finalWithJump = /\n$/.test(textConfig);
	const lines = String(textConfig || '').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
	const L = String(op.letter);
	const Lg = letterGcode(L);
	const date = op.date || '';
	const note = ' ; sensorless homing of ' + L + (date ? ' (' + date + ', Motors > Crash)' : ' (Motors > Crash)');
	const newM574 = 'M574 ' + Lg + op.end + ' ' + (op.kindFinal || 'S3') + note;
	const changes = [];
	const notices = [];

	const search = cmd => lines.map((l, i) => ({ l, i })).filter(x => isCmd(x.l, cmd) && axesOfLine(x.l).indexOf(L) >= 0);

	// M574
	let idx574 = -1;
	const m574 = search('M574');
	if (m574.length) {
		const last = m574[m574.length - 1];
		const axesL = axesOfLine(last.l);
		const kind = valueLetter(last.l, 'S');
		const endCurrent = valueLetter(last.l, L);
		const same = axesL.length === 1 && ('S' + kind) === (op.kindFinal || 'S3') && String(endCurrent) === String(op.end);
		if (same) {
			idx574 = last.i;
			changes.push({ kind: 'same', before: last.l, after: last.l, i: last.i });
		} else if (axesL.length === 1) {
			changes.push({ kind: 'replacement', before: last.l, after: newM574, i: last.i });
			lines[last.i] = newM574;
			idx574 = last.i;
		} else {
			lines.splice(last.i + 1, 0, newM574);
			changes.push({ kind: 'added', before: null, after: newM574, i: last.i + 1, note: i18n.t('plugins.WorkshopMotors.crashFinal.line_above_several_axes_replace', { axis: L }) });
			idx574 = last.i + 1;
		}
	} else {
		const all574 = lines.map((l, i) => (isCmd(l, 'M574') ? i : -1)).filter(i => i >= 0);
		const all584 = lines.map((l, i) => (isCmd(l, 'M584') ? i : -1)).filter(i => i >= 0);
		const pos = all574.length ? all574[all574.length - 1] + 1 : (all584.length ? all584[all584.length - 1] + 1 : lines.length);
		lines.splice(pos, 0, newM574);
		changes.push({ kind: 'added', before: null, after: newM574, i: pos });
		idx574 = pos;
	}

	// M915
	const m915 = search('M915');
	let r = 0;
	if (m915.length) {
		const rv = valueLetter(m915[m915.length - 1].l, 'R');
		if (rv !== null && /^\d$/.test(rv)) {
			r = parseInt(rv, 10);
		}
	}
	const newM915 = 'M915 ' + Lg + ' S' + op.s + ' F' + (op.f ? 1 : 0) + ' H' + op.h + ' R' + r + note;
	if (m915.length) {
		const last = m915[m915.length - 1];
		if (axesOfLine(last.l).length === 1) {
			changes.push({ kind: 'replacement', before: last.l, after: newM915, i: last.i });
			lines[last.i] = newM915;
		} else {
			lines.splice(last.i + 1, 0, newM915);
			changes.push({ kind: 'added', before: null, after: newM915, i: last.i + 1, note: i18n.t('plugins.WorkshopMotors.crashFinal.line_above_several_axes_only', { axis: L }) });
		}
		if (r) {
			notices.push(i18n.t('plugins.WorkshopMotors.crashFinal.previous_m915_had_r', { r }));
		}
	} else {
		lines.splice(idx574 + 1, 0, newM915);
		changes.push({ kind: 'added', before: null, after: newM915, i: idx574 + 1 });
	}
	if (lines.some(l => isCmd(l, 'M915') && !axesOfLine(l).length && /\bP/.test(withoutComment(l)))) {
		notices.push(i18n.t('plugins.WorkshopMotors.crashFinal.m915_by_driver_number', { axis: L }));
	}
	// number the lines of the new text
	const text = lines.join(eol) + (finalWithJump ? eol : '');
	const newLines = text.replace(/\r\n/g, '\n').split('\n');
	for (const c of changes) {
		c.line = newLines.indexOf(c.after) + 1;
		delete c.i;
	}
	return { text: text, changes: changes, notices: notices };
}

// What is advisable to put in the axis's homing file (it is not written by itself: each machine has
// its own). op: { letter, end, v, correction, route, pctBack }
export function hintHoming(op) {
	const L = letterGcode(op.letter);
	const dir = op.end === 2 ? 1 : -1;
	const rec = Math.round((op.route || 300) * 1.1);
	return [
		'M400',
		'M913 ' + L + Math.round(op.correction) + '            ; lower the current for homing',
		'G91',
		'G1 H1 ' + L + (dir * rec) + ' F' + Math.round(op.v * 60) + '  ; toward the stop until the driver detects the stall',
		'G1 H2 ' + L + (-dir * 5) + ' F' + Math.round(op.v * 60),
		'G90',
		'M400',
		'M913 ' + L + Math.round(op.pctBack || 100) + '           ; back to the normal current'
	].join('\n');
}

// ---- Line-by-line differences (to display) ----

// [{ kind: 'same'|'deleted'|'added', a (old line n), b (new line n), text }], only the stretches with
// changes and 'context' lines around; '...' between stretches ({ kind: 'cut' }).
export function diffLines(old, next, context) {
	const A = String(old || '').replace(/\r\n/g, '\n').split('\n');
	const B = String(next || '').replace(/\r\n/g, '\n').split('\n');
	// trim what is equal at the start and at the end (config.g can be long)
	let start = 0;
	while (start < A.length && start < B.length && A[start] === B[start]) start++;
	let endA = A.length;
	let endB = B.length;
	while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) {
		endA--;
		endB--;
	}
	const a = A.slice(start, endA);
	const b = B.slice(start, endB);
	const n = a.length;
	const m = b.length;
	const dp = [];
	for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}
	const all = [];
	for (let k = 0; k < start; k++) all.push({ kind: 'same', a: k + 1, b: k + 1, text: A[k] });
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && a[i] === b[j]) {
			all.push({ kind: 'same', a: start + i + 1, b: start + j + 1, text: a[i] });
			i++;
			j++;
		} else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
			all.push({ kind: 'deleted', a: start + i + 1, b: null, text: a[i] });
			i++;
		} else {
			all.push({ kind: 'added', a: null, b: start + j + 1, text: b[j] });
			j++;
		}
	}
	for (let k = endA; k < A.length; k++) all.push({ kind: 'same', a: k + 1, b: k + 1 + (endB - endA), text: A[k] });
	const c = context == null ? 2 : context;
	const view = all.map(() => false);
	all.forEach((x, k) => {
		if (x.kind !== 'same') {
			for (let q = Math.max(0, k - c); q <= Math.min(all.length - 1, k + c); q++) view[q] = true;
		}
	});
	const out = [];
	let before = true;
	all.forEach((x, k) => {
		if (view[k]) {
			if (!before && out.length) {
				out.push({ kind: 'cut' });
			}
			out.push(x);
			before = true;
		} else {
			before = false;
		}
	});
	return out;
}

// ---- Saving with the service (API config.commit) ----

export const STAGING = '0:/sys/workshop/data/config-staging';

export function newTx(date, random) {
	const d = date || new Date();
	const p = n => ('0' + n).slice(-2);
	const r = random !== undefined ? String(random) : Math.random().toString(36).slice(2, 8);
	return 'wm-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' + r.replace(/[^A-Za-z0-9]/g, '');
}

// bytesAnteriores: Uint8Array of what was read from the card (null = it did not exist)
export function requestSaved(op) {
	const bytes = utf8(op.text);
	const file = '0-' + String(op.path).split('/').pop().replace(/[^\w.-]/g, '_');
	const manifest = {
		version: 1,
		tx: op.tx,
		files: [{
			path: String(op.path).replace(/^\d+:\//, ''),
			file: file,
			sha: sha256(bytes),
			sha_previous: op.bytesPrevious ? sha256(op.bytesPrevious) : null
		}],
		set: [],
		reason: op.reason || '',
		who: op.who || 'WorkshopMotors',
		rrf: op.rrf || '',
		mode: op.mode || ''
	};
	return { folder: STAGING + '/' + op.tx, file: file, bytes, manifest: manifest };
}

// JSON answer of the service, or a readable error
export function readJson(text) {
	const t = String(text || '').trim();
	try {
		const j = JSON.parse(t);
		if (j && typeof j === 'object') {
			return j;
		}
	} catch (e) {
		// no es JSON
	}
	return { ok: false, error: /No existe el handler/i.test(t) ? 'without-handler' : (t || i18n.t('plugins.WorkshopMotors.common.the_service_did_not_answer')) };
}
