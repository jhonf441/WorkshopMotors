import { i18n } from './dwc-host.js'
'use strict'

// Enable / disable motors ("Enable" tab of Motors, 2026-10-12).
// Pure functions (without Vue) so they can be tested with node:
//   node --test test/enable.test.js   (from vue/WorkshopMotors)
//
// What RepRapFirmware 3.6 allows (see WorkshopService/dsf/motores_habilitar.py):
// - M18 <axes> E<n:m> / M17: per axis or extruder, with ALL its drivers together (local and CAN).
// - M18 / M17 without parameters: all. M18 removes the homing of each disabled axis.
// - There is no command for a single driver of an axis with several motors.
// - Any movement of the axis enables it again by itself.
// - RRF does not publish in the object model whether a motor is enabled. The service reads it from the
//   CHOPCONF register of each driver of the main board (report.boards[].drivers[].enabled:
//   true / false / null = unknown, e.g. CAN boards).
//
// The service sends it: API operation motors.disable | motors.enable {axes: ["X","Z","E0"] | ["all"]}
// (it checks again that there is no job and leaves the event in Activity). It also keeps which motors are released
// (motorReport.released): the level 4 risk bar and the lights come from there, not from this page.

import { enableState } from './motor-state.js'

const WITH_JOB = ['processing', 'paused', 'pausing', 'resuming', 'simulating', 'cancelling'];
const busy = ['busy', 'changingTool', 'starting', 'updating', 'halted', 'flashing', 'disconnected'];

// "board.driver" id from what the object model brings (text "0.4" or DWC's DriverId {board, driver})
export function idDriver(d) {
	if (d && typeof d === 'object' && 'board' in d && 'driver' in d) {
		return d.board + '.' + d.driver;
	}
	return String(d);
}

function boardOf(id) {
	const can = String(id).split('.')[0];
	return can === '0' ? 'main' : 'CAN ' + can; // 'principal' is an id (Enable.vue shows it translated)
}

// Map id -> true / false / null with what the service read
export function enabledByDriver(report) {
	const m = {};
	for (const b of (report && report.boards) || []) {
		for (const d of b.drivers || []) {
			if (d && d.id) {
				m[d.id] = typeof d.enabled === 'boolean' ? d.enabled : null;
			}
		}
	}
	return m;
}

// Axes and extruders with their drivers and what is known about each. state: the holding state of motor-state.js
// (enabled / released / partial / off / unknown / unpowered), with the list of released motors of the service.
export function motorsOf(om, report) {
	const move = (om && om.move) || {};
	const mapa = enabledByDriver(report);
	const withoutAlim = !!(report && report.without_power_supply);
	const released = new Set(report && Array.isArray(report.released) ? report.released.map(String) : []);
	const out = [];
	const arm = (base, ids) => {
		const drivers = ids.map(id => ({ id, board: boardOf(id), enabled: withoutAlim ? null : (id in mapa ? mapa[id] : null) }));
		return Object.assign(base, { drivers, state: enableState(drivers.map(d => d.enabled), withoutAlim, released.has(base.key)) });
	};
	(move.axes || []).forEach((a, i) => {
		if (!a || !a.letter) {
			return;
		}
		const ids = (a.drivers || []).map(idDriver);
		if (!ids.length) {
			return;
		}
		out.push(arm({ key: String(a.letter), kind: 'axis', index: i, label: i18n.t('plugins.WorkshopMotors.enable.axis_name', { axis: a.letter }), homed: !!a.homed, visible: a.visible !== false }, ids));
	});
	(move.extruders || []).forEach((x, i) => {
		if (!x) {
			return;
		}
		const ids = x.driver != null ? [idDriver(x.driver)] : (x.drivers || []).map(idDriver);
		if (!ids.length) {
			return;
		}
		out.push(arm({ key: 'E' + i, kind: 'extruder', index: i, label: i18n.t('plugins.WorkshopMotors.enable.extruder_name', { n: i }), homed: null, visible: true }, ids));
	});
	return out;
}

// A job running or the machine busy: { blocked, reason }. extra (the Release / enable section):
//   report    the motors report: with the power supply off neither M17 nor M18 makes sense (and M18 removes the homing)
//   reserved  the reason of a reservation of the movement by another origin (machine-free.js, code 'reserved'): a
//             sequence (a test, a calibration) owns the machine
export function block(om, jobInLive, extra) {
	const st = (om && om.state && om.state.status) || '';
	const live = jobInLive && (typeof jobInLive === 'object' ? jobInLive.active : jobInLive);
	if (live) {
		return { blocked: true, reason: i18n.t('plugins.WorkshopMotors.enable.a_live_job_is_being_sent') };
	}
	if (WITH_JOB.indexOf(st) >= 0) {
		const f = om.job && om.job.file && om.job.file.fileName;
		const name = f ? String(f).split('/').pop() : '';
		return { blocked: true, reason: name ? i18n.t('plugins.WorkshopMotors.enable.job_running_named_position_lost', { name: name }) : i18n.t('plugins.WorkshopMotors.enable.job_running_position_lost') };
	}
	if (busy.indexOf(st) >= 0) {
		return { blocked: true, reason: i18n.t('plugins.WorkshopMotors.enable.machine_busy_wait', { state: st }) };
	}
	const x = extra || {};
	if (x.reserved) {
		return { blocked: true, reason: x.reserved };
	}
	if ((x.report && x.report.without_power_supply) || (x.report !== undefined && st === 'off')) {
		return { blocked: true, reason: i18n.t('plugins.WorkshopMotors.enable.power_off_nothing_to_do') };
	}
	return { blocked: false, reason: '' };
}

// How each action is confirmed (DESIGN.md section 5). Release (M18) = level 4: the fixed box of notices and the
// "Understood" box, then ONE tap (the box replaces the double tap, as in Crash). Enable (M17) = level 2: a motor that
// gets current jumps to its nearest full step: double tap. The "Understood" box is cleared after every release.
export const RULES = {
	disable: { level: 4, understood: true, doubleTap: false },
	enable: { level: 2, understood: false, doubleTap: true }
};
export const ARMED_MS = 4000;

// One tap on the button "id" of an action. armed = { id, until } of the button armed now (or null), now in ms.
// -> { fire, armed }: fire = send now; armed = what stays armed (the first tap of a double tap arms for ARMED_MS).
export function tap(action, id, armed, now) {
	const rule = RULES[action];
	if (!rule || !rule.doubleTap) {
		return { fire: true, armed: null };
	}
	if (armed && armed.id === id && now < armed.until) {
		return { fire: true, armed: null };
	}
	return { fire: false, armed: { id, until: now + ARMED_MS } };
}

// Whether a button of that action can be used now (the reason is shown next to the buttons)
export function canUse(action, lock, understood, busy) {
	const rule = RULES[action];
	return !!rule && !lock.blocked && !busy && (!rule.understood || !!understood);
}

// G-code the service is going to send (to show it). null keys = all.
export function command(action, keys) {
	const base = action === 'disable' ? 'M18' : 'M17';
	if (!keys) {
		return base;
	}
	const axes = keys.filter(c => !/^E\d+$/.test(c)).map(c => (c === c.toLowerCase() && c !== c.toUpperCase() ? "'" + c : c));
	const ext = keys.filter(c => /^E\d+$/.test(c)).map(c => c.slice(1));
	return base + ' ' + axes.concat(ext.length ? ['E' + ext.join(':')] : []).join(' ');
}

// API call for the service: { op, args }
export function request(action, keys) {
	return { op: 'motors.' + action, args: { axes: keys ? keys.slice() : ['all'] } };
}

function kinematicsOf(om) {
	const k = om && om.move && om.move.kinematics;
	return (k && k.name) || '';
}

function screwsZ(om) {
	const k = om && om.move && om.move.kinematics;
	const t = k && k.tiltCorrection;
	return (t && Array.isArray(t.screwX)) ? t.screwX.length : 0;
}

// Warnings about what is going to happen. motors: the affected ones, from motorsOf().
export function notices(action, motors, om) {
	const out = [];
	const axes = motors.filter(m => m.kind === 'axis');
	const kin = kinematicsOf(om);
	if (action === 'disable') {
		if (axes.length) {
			const withHoming = axes.filter(m => m.homed).map(m => m.key);
			out.push(i18n.t('plugins.WorkshopMotors.enable.position_lost_axes_not_homed', { axes: (withHoming.length ? withHoming : axes.map(m => m.key)).join(', ') }));
			out.push(i18n.t('plugins.WorkshopMotors.enable.motor_without_force'));
		}
		const vertical = axes.filter(m => m.key.toUpperCase() === 'Z' || kin === 'delta');
		if (vertical.length) {
			out.push(i18n.t('plugins.WorkshopMotors.enable.vertical_axis_can_fall', { axes: vertical.map(m => m.key).join(', ') }));
		}
		const z = axes.find(m => m.key.toUpperCase() === 'Z' && m.drivers.length > 1);
		if (z) {
			out.push(i18n.t('plugins.WorkshopMotors.enable.z_independent_motors', { n: z.drivers.length, drivers: z.drivers.map(d => d.id).join(', '), g32: screwsZ(om) > 1 ? ' (G32)' : '' }));
		}
		if (axes.length && kin && kin !== 'cartesian') {
			out.push(i18n.t('plugins.WorkshopMotors.enable.kinematics_home_all', { kin }));
		}
		if (motors.some(m => m.kind === 'extruder')) {
			out.push(i18n.t('plugins.WorkshopMotors.enable.extruder_released'));
		}
		out.push(i18n.t('plugins.WorkshopMotors.enable.any_move_reenables'));
	} else {
		const without = axes.filter(m => !m.homed).map(m => m.key);
		if (without.length) {
			out.push(i18n.t('plugins.WorkshopMotors.enable.enable_no_position_axes', { axes: without.join(', ') }));
		}
		if (motors.length) {
			out.push(i18n.t('plugins.WorkshopMotors.enable.motor_may_jump'));
		}
	}
	return out;
}

// Level 4 (DESIGN.md, user's decision 2026-10-12): releasing motors leaves the machine without the
// protection of motors with force while it lasts. What is ALWAYS shown next to the buttons.
// A function, not a constant: the texts follow DWC's language when it changes without a reload.
export function noticesLevel4() {
	return [
		i18n.t('plugins.WorkshopMotors.enable.the_released_motors_have_no_force'),
		i18n.t('plugins.WorkshopMotors.enable.a_vertical_axis_z_can_fall'),
		i18n.t('plugins.WorkshopMotors.enable.while_released_do_not_use_the'),
		i18n.t('plugins.WorkshopMotors.enable.to_stop_it_enable_again_and')
	];
}

// What the still motors do (move.idle: M906 I / T, before M84 S)
export function textIdle(om) {
	const idle = om && om.move && om.move.idle;
	if (!idle || typeof idle.factor !== 'number') {
		return '';
	}
	const t = typeof idle.timeout === 'number' ? Math.round(idle.timeout) : null;
	if (idle.factor <= 0) {
		return t != null ? i18n.t('plugins.WorkshopMotors.enable.idle_off_after_s', { s: t }) : i18n.t('plugins.WorkshopMotors.enable.idle_off');
	}
	const pct = Math.round(idle.factor * 100);
	return t != null ? i18n.t('plugins.WorkshopMotors.enable.idle_reduce_after_s', { s: t, pct }) : i18n.t('plugins.WorkshopMotors.enable.idle_reduce', { pct });
}

// Answer of the service (JSON text or an error message)
export function readResponse(text) {
	const t = String(text || '').trim();
	try {
		const j = JSON.parse(t);
		if (j && typeof j === 'object') {
			return { ok: !!j.ok, error: j.error || '', command: j.command || '' };
		}
	} catch (e) {
		// it is not JSON: message from the service or the board
	}
	if (/No existe el handler|WorkshopService|unknown operation/i.test(t)) {
		return { ok: false, error: i18n.t('plugins.WorkshopMotors.enable.the_workshopservice_service_does_not_have'), command: '' };
	}
	return { ok: false, error: t || i18n.t('plugins.WorkshopMotors.common.the_service_did_not_answer'), command: '' };
}
