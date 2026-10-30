'use strict'

// Reference table of the pulse ceiling (Measure tab, References.vue). Pure functions (without Vue) so they can be
// tested with node: test/references.test.js.
//
// The table travels in the plugin (references.json) and the shared copy lives in the public repo; both have the same
// format. A row says WHAT was measured as data (motors + kind of moves), not as a sentence, so it is shown in the
// language of each DWC: { board, firmware, timing, motors, moves: 'long' | 'short', axis?, micro?, khz, source, date? }.
// source: 'dc42' (his public sheet) or 'measured' (a user of this plugin, through the "Share" button).

export const FORMAT = 'workshop-ceiling-pulses';
export const VERSION = 2;

// The rows of a table read from the plugin or from GitHub, or null when the data is not a table of this format.
export function readTable(json) {
	if (!json || typeof json !== 'object' || json.format !== FORMAT || !Array.isArray(json.rows)) {
		return null;
	}
	const rows = json.rows.filter(r => r && typeof r === 'object' && typeof r.khz === 'number' && r.khz > 0);
	return rows.length ? rows : null;
}

// "1 motor, long move (axis X, 1/256)"; t = the page's translator (key relative to plugins.WorkshopMotors)
export function caseText(row, t) {
	if (!row) {
		return '';
	}
	let text;
	if (row.moves === 'long' || row.moves === 'short') {
		const many = Number(row.motors) > 1;
		text = t('references.' + (many ? 'case_many_' : 'case_one_') + row.moves, { n: row.motors });
	} else {
		text = String(row.testCase || ''); // a row typed by hand in the shared table
	}
	if (row.axis) {
		text += ' (' + t('references.axis_micro', { axis: row.axis, micro: row.micro || '?' }) + ')';
	}
	return text;
}

export function sourceText(row, t) {
	if (!row) {
		return '';
	}
	return row.source === 'measured' ? t('references.source_measured') : String(row.source || '');
}

// The row a user shares from the Measure tab (it goes in the GitHub issue as JSON, ready to paste in the table).
// ceiling: the saved step-ceiling.json; board / firmware / timing: what this machine reports.
export function shareRow(ceiling, board, firmware, timing) {
	const c = ceiling || {};
	return {
		board: board || '?',
		firmware: firmware || c.firmware || '?',
		timing: timing || '?',
		motors: 1,
		moves: 'long',
		axis: c.axis || null,
		micro: c.micro || null,
		khz: c.khz_per_motor,
		source: 'measured',
		date: c.date || null
	};
}

// Timing of the pulses (M569 T) of the first local driver that reports it, or null.
export function timingOf(report) {
	for (const e of (report && report.entries) || []) {
		for (const d of (e && e.drivers) || []) {
			if (d && d.m569 && d.m569.dc42_ref && d.m569.dc42_ref.timing) {
				return d.m569.dc42_ref.timing;
			}
		}
	}
	return null;
}

// ---- the shared table: where it is read from, the offline copy and the download ----

// The table everybody shares: ONE file at the root of the repository of the plugin (data/references.json). The page reads it from there on
// opening and with "Update table"; the last good copy is kept in the browser, so it keeps working with no internet; without both the copy
// that travels in the plugin is shown. Anyone's measurement goes in through the "Share" button (an issue) and the owner adds the row to that file.
export const TABLE_URL = 'https://raw.githubusercontent.com/jhonf441/WorkshopMotors/main/data/references.json';
const CACHE_KEY = 'workshopMotorsReferences';

// The last table read from the repository: { rows, at } or null (no storage / nothing saved / not a table of this format)
export function readCache(storage) {
	try {
		const saved = JSON.parse(storage.getItem(CACHE_KEY));
		const rows = readTable(saved && saved.table);
		return rows ? { rows, at: saved.at || null } : null;
	} catch (e) {
		return null;
	}
}

export function writeCache(storage, table, at) {
	try {
		storage.setItem(CACHE_KEY, JSON.stringify({ table, at }));
	} catch (e) {
		/* private window or full: the table is just not kept */
	}
}

const CSV_COLUMNS = ['board', 'firmware', 'timing', 'motors', 'moves', 'axis', 'micro', 'khz', 'source', 'date'];

function csvCell(v) {
	const s = v == null ? '' : String(v);
	return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// The rows as a CSV (one line per row, the data columns of the format) for a spreadsheet
export function tableToCsv(rows) {
	const lines = [CSV_COLUMNS.join(',')];
	(rows || []).forEach(r => lines.push(CSV_COLUMNS.map(c => csvCell(r[c])).join(',')));
	return lines.join('\n') + '\n';
}

// The rows as the file of the format (the same one the repository holds), pretty printed
export function tableToJson(rows) {
	return JSON.stringify({ format: FORMAT, version: VERSION, rows: rows || [] }, null, '\t') + '\n';
}
