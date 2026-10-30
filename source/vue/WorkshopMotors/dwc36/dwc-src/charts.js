import i18n from '../../i18n'
'use strict'

// Charts of the motors and advanced report (Motors > Charts). Pure functions (without Vue) to be able to test them
// with node:   node --test test/charts.test.js   (from vue/WorkshopMotors)
//
// COST: everything comes from what the service ALREADY publishes (plugins.WorkshopService.data.motorReport, ~once per
// second with the Motors page open; the driver values every ~5 s) and from DWC's object model (board temperature,
// supply voltage). No reading is added. Only the advanced report, when someone asks for it, sends once
// M350/M92/M906/M203/M201/M566 and M569/M915 per driver (all read-only: without value parameters they only report).
//
// What each series is (docs-internal/MOTORES-DISENO.md section 4, checked against motor_status.py and RRF):
//   cruise          move.currentMove.topSpeed (mm/s): the cruise speed the planner gives the move being run, already
//                   limited by M203 / M201 / M566 (the requested F is not charted: the gap is the "held back" chip)
//   axis speed      that cruise speed for the axes with a driver out of standstill, capped at the axis maximum: exact
//                   on single-axis moves, an upper bound on diagonals (mm/s; M203 is the dashed line)
//   driver current  M906 x (CS_ACTUAL + 1) / (IRUN + 1) estimated by the service from DRV_STATUS (mA), or the raw
//                   CS_ACTUAL 0-31 scale when it cannot estimate; at rest it drops to the idle current
//   StallGuard min  "SG min" of M122: the lowest load margin of the driver since the previous reading (~5 s);
//                   0 = stalled; only valid in spreadCycle and above a minimum speed
//   board pulses    steps per second of the board: the sum over its drivers (the measured ceiling is the line)
//   late pulses     new M122 "hiccups" per reading (delays the step generator inserted)
//   MCU temperature boards[].mcuTemp (C)           supply voltage  boards[].vIn (V): the motors' supply
// Driver values and late pulses are sampled only when the service read the drivers again (drivers_read_at, m122_seq):
// repeating the last reading every second would draw steps that were not measured.
//
// Generic: axes, extruders, drivers and boards are discovered from the report and the object model.

import { faultsOfDriver, faultLabel } from './faults.js'

// ---- Data of a driver in the report ----

// Value for the driver's current chart, or null if there is no datum.
export function valueCurrent(d) {
	if (d && typeof d.cs_current_ma === 'number') {
		return d.cs_current_ma;
	}
	if (d && typeof d.cs_current === 'number') {
		return d.cs_current;
	}
	return null;
}

// The lowest StallGuard value of the driver since the previous M122 (one source only: M122 "SG min"). null = no datum.
export function valueStallGuard(d) {
	return d && d.m122 && typeof d.m122.sg_min === 'number' ? d.m122.sg_min : null;
}

// ---- Catalog of series ----

// Kinds of series and their unit. A unit that is a word is a key, translated when the catalog is built (never at load
// time: DWC can change its language without reloading). gapMs: a longer silence between two samples cuts the line.
const KINDS = {
	cruise: { unit: 'mm/s', gapMs: 5000 },
	speed: { unit: 'mm/s', gapMs: 5000 },
	current: { unit: 'mA', gapMs: 15000 },
	sg: { unitKey: 'charts.unit_sg', gapMs: 15000 },
	boardPulses: { unit: 'kHz', gapMs: 5000 },
	hiccups: { unitKey: 'charts.unit_count', gapMs: 15000 },
	boardTemp: { unit: '°C', gapMs: 5000 },
	vin: { unit: 'V', gapMs: 5000 }
};

export function kindInfo(kind) {
	const k = KINDS[kind] || { unit: '', gapMs: 5000 };
	return { unit: k.unitKey ? i18n.t('plugins.WorkshopMotors.' + k.unitKey) : k.unit, gapMs: k.gapMs };
}

function nameBoard(b) {
	const can = Number(b && (b.canAddress != null ? b.canAddress : b.can_address)) || 0;
	const n = (b && (b.shortName || b.short_name || b.name)) || '';
	return (n ? n + ' ' : '') + (can === 0 ? i18n.t('plugins.WorkshopMotors.charts.main_paren') : '(CAN ' + can + ')');
}

// Series that can be charted now: [{ id, kind, group, name, unit, gapMs, limit, limitText, note }]
// ceiling: the step ceiling measured on this board (Measure; step-ceiling.json) or null.
export function catalog(report, om, ceiling) {
	const out = [];
	const t = (key, params) => i18n.t('plugins.WorkshopMotors.charts.' + key, params);
	const add = (id, kind, group, name, extra) => {
		const k = kindInfo(kind);
		out.push(Object.assign({ id, kind, group, name, unit: k.unit, gapMs: k.gapMs, limit: null, limitText: '', note: '' }, extra || {}));
	};
	add('cruise', 'cruise', t('group_motion'), t('cruise_speed'), { note: t('cruise_note') });
	for (const e of (report && report.entries) || []) {
		if (!e || !e.label) {
			continue;
		}
		const group = /^E\d+$/.test(e.label) ? t('extruder_name', { name: e.label }) : t('axis_name', { name: e.label });
		add('axis:' + e.label + ':speed', 'speed', group, t('speed_of_name', { name: e.label }), {
			limit: e.max_speed_mm_min ? e.max_speed_mm_min / 60 : null, limitText: i18n.t('plugins.WorkshopMotors.common.maximum_m203'), note: t('speed_note')
		});
		for (const d of e.drivers || []) {
			if (!d || !d.id) {
				continue;
			}
			const mA = typeof d.cs_current_ma === 'number';
			if (valueCurrent(d) != null) {
				add('drv:' + d.id + ':current', 'current', group, t('current_of_driver_id', { id: d.id }), {
					unit: mA ? 'mA' : t('scale_0_31'),
					limit: mA && e.current_ma ? e.current_ma : null,
					limitText: t('configured_m906'),
					note: t('current_note')
				});
			}
			if (valueStallGuard(d) != null || d.format === 'tmc51xx') {
				add('drv:' + d.id + ':sg', 'sg', group, t('stallguard_of_driver_id', { id: d.id }), { note: t('lower_more_load_on_the_motor'), emptyText: t('sg_empty') });
			}
		}
	}
	const boards = (om && Array.isArray(om.boards)) ? om.boards : [];
	for (const b of (report && report.boards) || []) {
		if (b && b.can_address != null) {
			const measured = b.is_local && ceiling && ceiling.khz_board > 0 ? ceiling.khz_board : null;
			add('board:' + b.can_address + ':pulses', 'boardPulses', t('group_boards'), t('pulses_of_name', { name: nameBoard(b) }), {
				limit: measured, limitText: t('measured_ceiling'), note: t('pulses_note')
			});
		}
	}
	if (report && report.board_capacity !== undefined) {
		add('board:hiccups', 'hiccups', t('group_boards'), t('late_pulses'), { note: t('late_pulses_note') });
	}
	boards.forEach(b => {
		if (!b) {
			return;
		}
		const can = Number(b.canAddress) || 0;
		if (b.vIn && typeof b.vIn.current === 'number') {
			add('board:' + can + ':vin', 'vin', t('group_boards'), t('vin_of_name', { name: nameBoard(b) }), { note: t('vin_note'), zeroBased: false });
		}
		if (b.mcuTemp && typeof b.mcuTemp.current === 'number') {
			add('board:' + can + ':temp', 'boardTemp', t('group_boards'), t('temperature_of_name', { name: nameBoard(b) }), { note: t('board_temperature_note'), zeroBased: false });
		}
	});
	return out;
}

// A sample: { values: { series id: number }, last } with what there is now (without the series with no datum).
// last = what the previous sample saw ({ driversReadAt, m122Seq, hiccups }): the driver values go in only when the
// service read the drivers again, and the late pulses are the new hiccups since the previous M122 reading.
export function sample(report, om, last) {
	const m = {};
	const prev = last || {};
	const next = { driversReadAt: prev.driversReadAt, m122Seq: prev.m122Seq, hiccups: prev.hiccups };
	const put = (k, v) => {
		if (typeof v === 'number' && isFinite(v)) {
			m[k] = v;
		}
	};
	if (report) {
		put('cruise', typeof report.top_speed_mm_s === 'number' ? report.top_speed_mm_s : null);
		const powered = !report.without_power_supply;
		const fresh = powered && !report.idle && !!report.drivers_read_at && report.drivers_read_at !== prev.driversReadAt;
		next.driversReadAt = report.drivers_read_at;
		for (const e of report.entries || []) {
			if (!e || !e.label) {
				continue;
			}
			put('axis:' + e.label + ':speed', (e.current_speed_mm_min || 0) / 60);
			for (const d of e.drivers || []) {
				if (fresh && d && d.id) {
					put('drv:' + d.id + ':current', valueCurrent(d));
					put('drv:' + d.id + ':sg', valueStallGuard(d));
				}
			}
		}
		for (const b of report.boards || []) {
			if (b && b.can_address != null) {
				put('board:' + b.can_address + ':pulses', (b.combined_freq_hz || 0) / 1000);
			}
		}
		if (typeof report.m122_seq === 'number' && report.m122_seq !== prev.m122Seq && typeof report.hiccups_total === 'number') {
			// the service accumulates the hiccups of every M122 (each M122 resets the firmware's counter); a total that went
			// down means the service restarted: what it has now is all new
			if (typeof prev.hiccups === 'number' && prev.m122Seq != null) {
				put('board:hiccups', report.hiccups_total >= prev.hiccups ? report.hiccups_total - prev.hiccups : report.hiccups_total);
			}
			next.m122Seq = report.m122_seq;
			next.hiccups = report.hiccups_total;
		}
	}
	for (const b of (om && Array.isArray(om.boards)) ? om.boards : []) {
		if (!b) {
			continue;
		}
		const can = Number(b.canAddress) || 0;
		if (b.vIn) {
			put('board:' + can + ':vin', b.vIn.current);
		}
		if (b.mcuTemp) {
			put('board:' + can + ':temp', b.mcuTemp.current);
		}
	}
	return { values: m, last: next };
}

// ---- Compact history ----
// A shared array of times and an array of values per series (null = no datum in that
// sample). Much lighter than {t, y} per point and per series, and outside Vue's reactivity.

export function newHistory(maxSamples) {
	return { max: maxSamples || 3600, t: [], s: {} };
}

export function addSample(h, t, m) {
	const n = h.t.length;
	h.t.push(t);
	for (const k of Object.keys(m)) {
		if (!h.s[k]) {
			h.s[k] = new Array(n).fill(null);
		}
	}
	for (const k of Object.keys(h.s)) {
		h.s[k].push(k in m ? m[k] : null);
	}
	if (h.t.length > h.max) {
		const remove = h.t.length - h.max;
		h.t.splice(0, remove);
		for (const k of Object.keys(h.s)) {
			h.s[k].splice(0, remove);
		}
	}
	// series that no longer have any datum (motor removed from the config): out
	if (n % 300 === 0) {
		for (const k of Object.keys(h.s)) {
			if (h.s[k].every(v => v === null)) {
				delete h.s[k];
			}
		}
	}
	return h;
}

// First index with time >= desde
export function indexSince(h, since) {
	let it = 0;
	let hi = h.t.length;
	while (it < hi) {
		const mid = (it + hi) >> 1;
		if (h.t[mid] < since) {
			it = mid + 1;
		} else {
			hi = mid;
		}
	}
	return it;
}

// {t, y} points of a series from 'since' (epoch ms), reduced to maxPoints at most. When
// reducing, each stretch keeps its highest and lowest value (peaks are not lost).
export function points(h, id, since, maxPoints) {
	const vals = h.s[id];
	if (!vals) {
		return [];
	}
	const i0 = indexSince(h, since || 0);
	const pts = [];
	for (let i = i0; i < h.t.length; i++) {
		if (vals[i] !== null && vals[i] !== undefined) {
			pts.push({ t: h.t[i], y: vals[i] });
		}
	}
	const max = maxPoints || 600;
	if (pts.length <= max) {
		return pts;
	}
	const segments = Math.floor(max / 2);
	const step = pts.length / segments;
	const out = [];
	for (let k = 0; k < segments; k++) {
		const a = Math.floor(k * step);
		const b = Math.min(pts.length, Math.floor((k + 1) * step));
		let it = pts[a];
		let hi = pts[a];
		for (let i = a; i < b; i++) {
			if (pts[i].y < it.y) it = pts[i];
			if (pts[i].y > hi.y) hi = pts[i];
		}
		if (it === hi) {
			out.push(it);
		} else if (it.t < hi.t) {
			out.push(it, hi);
		} else {
			out.push(hi, it);
		}
	}
	return out;
}

// { n, min, max, avg, last, tMax } of a series from 'since'; null if there is no data.
export function summarySerial(h, id, since) {
	const vals = h.s[id];
	if (!vals) {
		return null;
	}
	let n = 0;
	let min = Infinity;
	let max = -Infinity;
	let sum = 0;
	let last = null;
	let tMax = null;
	for (let i = indexSince(h, since || 0); i < h.t.length; i++) {
		const v = vals[i];
		if (v === null || v === undefined) {
			continue;
		}
		n++;
		sum += v;
		if (v < min) min = v;
		if (v > max) {
			max = v;
			tMax = h.t[i];
		}
		last = v;
	}
	return n ? { n, min, max, avg: sum / n, last: last, tMax } : null;
}

// Save / read (sessionStorage). Only the last maxS seconds and with rounded values.
export function serialize(h, now, maxS) {
	const i0 = indexSince(h, now - (maxS || 1200) * 1000);
	const s = {};
	for (const k of Object.keys(h.s)) {
		s[k] = h.s[k].slice(i0).map(v => (v === null ? null : Math.round(v * 10) / 10));
	}
	return JSON.stringify({ v: 1, t: h.t.slice(i0), s });
}

export function deserialize(text, maxSamples, ahora, maxS) {
	const h = newHistory(maxSamples);
	try {
		const j = JSON.parse(text);
		if (!j || j.v !== 1 || !Array.isArray(j.t)) {
			return h;
		}
		const minT = (ahora || Date.now()) - (maxS || 3600) * 1000;
		const i0 = j.t.findIndex(t => t >= minT);
		if (i0 < 0) {
			return h;
		}
		h.t = j.t.slice(i0);
		for (const k of Object.keys(j.s || {})) {
			const a = j.s[k];
			if (Array.isArray(a) && a.length === j.t.length) {
				h.s[k] = a.slice(i0);
			}
		}
	} catch (e) {
		// dato corrupto: vacio
	}
	return h;
}

// ---- Alerts in the period ----
// Each time a fault appears on a driver an event is opened; when it disappears it is closed. An event keeps the KEY
// of the fault (named in the language of the page when shown: faultLabel), never a text.
// reg: { open: { 'driver|key': event }, events: [ { driver, axis, key, severity, since, until } ] }

export function newRecordAlerts() {
	return { open: {}, events: [] };
}

export function registerAlerts(reg, report, t, maxEvents) {
	const views = {};
	for (const e of (report && report.entries) || []) {
		for (const d of (e && e.drivers) || []) {
			if (!d || !d.id) {
				continue;
			}
			for (const f of faultsOfDriver(d)) {
				if (!f || !f.key) {
					continue;
				}
				const k = d.id + '|' + f.key;
				views[k] = true;
				if (!reg.open[k]) {
					const ev = { driver: d.id, axis: e.label, key: f.key, severity: f.severity, since: t, until: null };
					reg.open[k] = ev;
					reg.events.push(ev);
				}
			}
		}
	}
	for (const k of Object.keys(reg.open)) {
		if (!views[k]) {
			reg.open[k].until = t;
			delete reg.open[k];
		}
	}
	const max = maxEvents || 500;
	if (reg.events.length > max) {
		reg.events.splice(0, reg.events.length - max);
	}
	return reg;
}

export function alertsSince(reg, since) {
	return reg.events.filter(ev => ev.until === null || ev.until >= since);
}

// ---- Reporte avanzado ----

// What is asked of RRF (read only). ids: drivers '0.0', '40.1'...
export function commandsReport(ids) {
	const out = ['M350', 'M92', 'M906', 'M203', 'M201', 'M566'];
	for (const id of ids || []) {
		out.push('M569 P' + id);
		out.push('M915 P' + id);
	}
	return out;
}

// "Drive 0 runs forwards, active low enable, timing fast, mode spreadCycle, ccr 0x10053, ..."
export function readM569(text) {
	const t = String(text || '');
	const r = { address: null, mode: null, timing: null, enable: null };
	let m = /runs\s+(forwards|backwards|in reverse|reverse)/i.exec(t);
	if (m) {
		r.address = /forward/i.test(m[1]) ? i18n.t('plugins.WorkshopMotors.charts.dir_forward') : i18n.t('plugins.WorkshopMotors.charts.dir_backward');
	}
	m = /mode\s+([A-Za-z][A-Za-z ]*?)(?:,|\(|$)/i.exec(t);
	if (m) {
		r.mode = m[1].trim();
	}
	m = /timing\s+([^,]+)/i.exec(t);
	if (m) {
		r.timing = m[1].trim();
	}
	m = /active\s+(high|low)\s+enable/i.exec(t);
	if (m) {
		r.enable = m[1].toLowerCase();
	}
	return r;
}

// "Driver 0: stall threshold 3, filter off, full steps/sec 200 (16.7 mm/sec), coolstep ..."
// -> [{ driver: '0' | '0.0' | null, s, filtro, h }]
export function readM915(text) {
	const out = [];
	const re = /(?:Drive(?:r)?\s+([\d.]+)\s*:?\s*)?stall threshold\s+(-?\d+),\s*filter\s+(on|off),\s*full steps\/s(?:ec)?\s+(\d+)/gi;
	let m;
	while ((m = re.exec(String(text || ''))) !== null) {
		out.push({ driver: m[1] || null, s: parseInt(m[2], 10), filter: m[3].toLowerCase() === 'on' ? 1 : 0, h: parseInt(m[4], 10) });
	}
	return out;
}

function num(v, dec) {
	if (typeof v !== 'number' || !isFinite(v)) {
		return '--';
	}
	const f = Math.pow(10, dec == null ? 1 : dec);
	return String(Math.round(v * f) / f);
}

function hour(t) {
	if (!t) {
		return '--';
	}
	const d = new Date(t);
	const p = n => ('0' + n).slice(-2);
	return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function idsOf(list) {
	return (list || []).map(d => (d && typeof d === 'object' && 'board' in d) ? d.board + '.' + d.driver : String(d));
}

// Motors of the object model with their configuration: [{ key, kind, drivers, stepsMm, micro,
// interpolated, current, speedMax, accel, jerk, pctCurrent, pctIdle }]
export function motorsConfig(om) {
	const move = (om && om.move) || {};
	const out = [];
	const arm = (key, kind, x, ids) => ({
		key: key, kind: kind, drivers: ids,
		stepsMm: x.stepsPerMm, micro: x.microstepping ? x.microstepping.value : null,
		interpolated: x.microstepping ? !!x.microstepping.interpolated : null,
		current: x.current, speedMax: x.speed, accel: x.acceleration, jerk: x.jerk,
		pctCurrent: x.percentCurrent, pctIdle: x.percentStstCurrent
	});
	(move.axes || []).forEach(a => {
		if (a && a.letter && (a.drivers || []).length) {
			out.push(arm(String(a.letter), 'axis', a, idsOf(a.drivers)));
		}
	});
	(move.extruders || []).forEach((x, i) => {
		if (!x) {
			return;
		}
		const ids = x.driver != null ? idsOf([x.driver]) : idsOf(x.drivers);
		if (ids.length) {
			out.push(arm('E' + i, 'extruder', x, ids));
		}
	});
	return out;
}

// Everything in the report in one object: { title, generated, since, until, machine, motors: [{ ..., drivers:
// [{ id, m569, m569Text, m915, state, currentMax, stallGuardMin, alerts }] }], alerts, rrf }
export function armReport(op) {
	const o = op || {};
	const om = o.om || {};
	const report = o.report || {};
	const h = o.history || newHistory();
	const since = o.since || 0;
	const rrf = o.rrf || {};
	const events = o.alerts || [];
	const inputs = {};
	for (const e of report.entries || []) {
		if (e && e.label) {
			inputs[e.label] = e;
		}
	}
	const b0 = (om.boards && om.boards[0]) || {};
	const machine = {
		board: b0.name || b0.shortName || '',
		firmware: b0.firmwareVersion || '',
		boards: (om.boards || []).filter(Boolean).map(b => nameBoard(b)),
		kinematics: (om.move && om.move.kinematics && om.move.kinematics.name) || report.kinematics || '',
		mode: (om.state && om.state.machineMode) || '',
		state: (om.state && om.state.status) || '',
		idle: om.move && om.move.idle ? om.move.idle : null
	};
	const max = (id) => summarySerial(h, id, since);
	const motors = motorsConfig(om).map(m => {
		const e = inputs[m.key] || {};
		const drvRep = {};
		for (const d of e.drivers || []) {
			drvRep[d.id] = d;
		}
		// the speed series is in mm/s; the report speaks mm/min like M203. Pulses = speed x steps/mm (the same curve)
		const speed = max('axis:' + m.key + ':speed');
		return Object.assign({}, m, {
			speedMaxMeasurement: speed ? speed.max * 60 : null,
			pulsesMaxMeasured: speed && m.stepsMm ? speed.max * m.stepsMm : null,
			speedNow: typeof e.current_speed_mm_min === 'number' ? e.current_speed_mm_min : null,
			drivers: m.drivers.map(id => {
				const d = drvRep[id] || null;
				const currentStats = max('drv:' + id + ':current');
				const sg = max('drv:' + id + ':sg');
				const m915 = readM915(rrf['M915 P' + id]);
				return {
					id,
					m569: readM569(rrf['M569 P' + id]),
					m569Text: String(rrf['M569 P' + id] || '').trim(),
					m915: m915.length ? m915[0] : null,
					state: d ? {
						alerts: faultsOfDriver(d).filter(f => f.key !== 'gstat').map(f => faultLabel(f.key)),
						idle: typeof d.in_standstill === 'boolean' ? d.in_standstill : null,
						enabled: typeof d.enabled === 'boolean' ? d.enabled : null,
						current: valueCurrent(d),
						currentInMa: typeof d.cs_current_ma === 'number',
						stallGuard: valueStallGuard(d),
						gstatError: !!(d.gstat && d.gstat.driver_error_latched)
					} : null,
					currentMax: currentStats ? currentStats.max : null,
					stallGuardMin: sg ? sg.min : null,
					alerts: events.filter(ev => ev.driver === id)
				};
			})
		});
	});
	return {
		title: i18n.t('plugins.WorkshopMotors.charts.motor_report'),
		generated: o.now || Date.now(),
		since: since,
		until: o.now || Date.now(),
		machine: machine,
		motors: motors,
		alerts: events,
		rrf
	};
}

function sn(v) {
	return v === null || v === undefined ? '--' : (v ? i18n.t('plugins.WorkshopMotors.charts.yes_lower') : i18n.t('plugins.WorkshopMotors.charts.no_lower'));
}

// Text to download (or copy). r = armReport()
export function reportText(r) {
	const L = [];
	L.push(r.title + ' -- ' + hour(r.generated));
	L.push(i18n.t('plugins.WorkshopMotors.charts.rep_period', { from: hour(r.since), to: hour(r.until) }));
	L.push('');
	L.push('== ' + i18n.t('plugins.WorkshopMotors.charts.rep_machine') + ' ==');
	L.push(i18n.t('plugins.WorkshopMotors.charts.rep_board', { board: r.machine.board || '--' }) + (r.machine.firmware ? ' (firmware ' + r.machine.firmware + ')' : ''));
	if (r.machine.boards.length > 1) {
		L.push(i18n.t('plugins.WorkshopMotors.charts.rep_boards', { list: r.machine.boards.join(', ') }));
	}
	L.push(i18n.t('plugins.WorkshopMotors.charts.rep_kin_mode_state', { kin: r.machine.kinematics || '--', mode: r.machine.mode || '--', state: r.machine.state || '--' }));
	if (r.machine.idle && typeof r.machine.idle.factor === 'number') {
		L.push(i18n.t('plugins.WorkshopMotors.charts.rep_idle', { pct: Math.round(r.machine.idle.factor * 100), s: num(r.machine.idle.timeout, 0) }));
	}
	L.push('');
	L.push('== ' + i18n.t('plugins.WorkshopMotors.charts.rep_per_motor') + ' ==');
	for (const m of r.motors) {
		L.push('');
		L.push((m.kind === 'axis' ? i18n.t('plugins.WorkshopMotors.charts.axis_name', { name: m.key }) : i18n.t('plugins.WorkshopMotors.charts.extruder_name', { name: m.key })) + ' -- drivers ' + m.drivers.map(d => d.id).join(', '));
		L.push('  ' + i18n.t('plugins.WorkshopMotors.charts.rep_microsteps', { n: m.micro == null ? '--' : m.micro }) + (m.interpolated ? ' ' + i18n.t('plugins.WorkshopMotors.charts.rep_with_interpolation') : ''));
		L.push('  ' + i18n.t('plugins.WorkshopMotors.charts.rep_steps_mm', { n: num(m.stepsMm, 3) }));
		L.push('  ' + i18n.t('plugins.WorkshopMotors.charts.rep_current', { ma: num(m.current, 0) }) + (typeof m.pctCurrent === 'number' && m.pctCurrent !== 100 ? ' ' + i18n.t('plugins.WorkshopMotors.charts.rep_current_now_pct', { pct: m.pctCurrent }) : ''));
		L.push('  ' + i18n.t('plugins.WorkshopMotors.charts.rep_max_speed', { v: num(m.speedMax, 0), m: num(m.speedMaxMeasurement, 0) }));
		L.push('  ' + i18n.t('plugins.WorkshopMotors.charts.rep_accel_jerk', { a: num(m.accel, 0), j: num(m.jerk, 0) }));
		L.push('  ' + i18n.t('plugins.WorkshopMotors.charts.rep_max_pulses', { hz: num(m.pulsesMaxMeasured, 0) }));
		for (const d of m.drivers) {
			L.push('  Driver ' + d.id + ':');
			const p = d.m569;
			L.push('    ' + i18n.t('plugins.WorkshopMotors.charts.rep_m569', { dir: p.address || '--', mode: p.mode || '--', timing: p.timing || '--' }));
			if (d.m915) {
				L.push('    ' + i18n.t('plugins.WorkshopMotors.charts.rep_m915', { s: d.m915.s, f: d.m915.filter, h: d.m915.h }));
			}
			if (d.state) {
				L.push('    ' + i18n.t('plugins.WorkshopMotors.charts.rep_now', { alerts: d.state.alerts.length ? i18n.t('plugins.WorkshopMotors.charts.rep_alerts_list', { list: d.state.alerts.join(', ') }) : i18n.t('plugins.WorkshopMotors.charts.rep_no_alerts'), idle: sn(d.state.idle), enabled: sn(d.state.enabled) })
					+ (d.state.current != null ? ' · ' + i18n.t('plugins.WorkshopMotors.charts.rep_current_now', { v: num(d.state.current, 0) }) + (d.state.currentInMa ? ' mA' : ' ' + i18n.t('plugins.WorkshopMotors.charts.rep_scale_0_31')) : '')
					+ (d.state.gstatError ? ' · ' + i18n.t('plugins.WorkshopMotors.charts.rep_gstat_error') : ''));
			}
			L.push('    ' + i18n.t('plugins.WorkshopMotors.charts.rep_max_current_min_sg', { c: num(d.currentMax, 0), sg: num(d.stallGuardMin, 0) }));
			L.push('    ' + i18n.t('plugins.WorkshopMotors.charts.rep_alerts_in_period', { list: d.alerts.length ? d.alerts.map(ev => faultLabel(ev.key) + ' (' + (ev.until ? i18n.t('plugins.WorkshopMotors.charts.rep_from_to', { from: hour(ev.since), to: hour(ev.until) }) : i18n.t('plugins.WorkshopMotors.charts.rep_from_ongoing', { from: hour(ev.since) })) + ')').join('; ') : i18n.t('plugins.WorkshopMotors.charts.rep_none_f') }));
		}
	}
	L.push('');
	L.push('== ' + i18n.t('plugins.WorkshopMotors.charts.rep_alerts_title') + ' ==');
	if (!r.alerts.length) {
		L.push(i18n.t('plugins.WorkshopMotors.charts.rep_none_dot'));
	}
	for (const ev of r.alerts) {
		L.push((ev.until ? i18n.t('plugins.WorkshopMotors.charts.rep_from_to', { from: hour(ev.since), to: hour(ev.until) }) : hour(ev.since) + ' ' + i18n.t('plugins.WorkshopMotors.charts.rep_ongoing_paren')) + ' · driver ' + ev.driver + ' (' + ev.axis + ') · ' + faultLabel(ev.key));
	}
	L.push('');
	L.push('== ' + i18n.t('plugins.WorkshopMotors.charts.rep_rrf_replies') + ' ==');
	for (const k of Object.keys(r.rrf)) {
		L.push('> ' + k);
		L.push(String(r.rrf[k] == null ? '' : r.rrf[k]).trim() || i18n.t('plugins.WorkshopMotors.charts.no_response'));
	}
	return L.join('\n') + '\n';
}

function csvField(v) {
	const s = v === null || v === undefined ? '' : String(v);
	return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// One row per driver (for a spreadsheet)
export function reportCsv(r) {
	const cab = ['motor', 'driver', 'microsteps', 'interpolated', 'steps_mm', 'current_mA', 'max_speed_mm_min', 'accel_mm_s2', 'jerk_mm_min',
		'direction', 'mode', 'timing', 'm915_s', 'm915_f', 'm915_h', 'measured_max_speed_mm_min', 'max_pulses_hz', 'max_current', 'stallguard_min',
		'alerts_now', 'alerts_period'];
	const rows = [cab.join(',')];
	for (const m of r.motors) {
		for (const d of m.drivers) {
			rows.push([
				m.key, d.id, m.micro, m.interpolated, m.stepsMm, m.current, m.speedMax, m.accel, m.jerk,
				d.m569.address, d.m569.mode, d.m569.timing,
				d.m915 ? d.m915.s : '', d.m915 ? d.m915.filter : '', d.m915 ? d.m915.h : '',
				m.speedMaxMeasurement == null ? '' : Math.round(m.speedMaxMeasurement), m.pulsesMaxMeasured == null ? '' : Math.round(m.pulsesMaxMeasured),
				d.currentMax == null ? '' : Math.round(d.currentMax), d.stallGuardMin == null ? '' : d.stallGuardMin,
				d.state ? d.state.alerts.join(' / ') : '', d.alerts.map(ev => faultLabel(ev.key)).join(' / ')
			].map(csvField).join(','));
		}
	}
	return rows.join('\n') + '\n';
}

export function nameFile(prefix, ext, date) {
	const d = date ? new Date(date) : new Date();
	const p = n => ('0' + n).slice(-2);
	return prefix + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.' + ext;
}
