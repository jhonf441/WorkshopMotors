'use strict';

// Rows of the start-up card of Motors (vue/_shared/StartupPanel.vue). Pure function (no imports): tests/startup-plugins.test.js
// loads it in node (it also checks that MACROS is what the plugin ships in sd/). The labels are keys of
// plugins.WorkshopMotors.startup.*.
//
// The macros are the plugin's OWN files (sdFiles, they travel with it and are updated with it), not examples: a row
// only turns red when the card finds the folder without them (the install did not copy them).
export const MACROS_DIR = '0:/sys/workshop/macros';
export const MACROS = ['axis-limits.g', 'axis-measure.g', 'axis-microstep.g', 'axis-move.g', 'axis-probe.g', 'axis-test.g', 'axis-touch.g', 'crash-cal.g', 'step-ceiling.g'];

// c = { reporte: bool,            the service published motorReport (it does only while this page is open)
//       nEjes, nDrivers,          axes with a driver and drivers found in the report
//       esperaVencida: bool,      the page has been open long enough for the report to be there by now
//       macros: [names] | null }  files found in MACROS_DIR; null = not read (no row: nothing is guessed)
export function rowsMotors(c) {
	const out = [];
	const has = !!(c && c.report);
	const nDrivers = (c && c.nDrivers) || 0;
	if (has || (c && c.waitExpired)) {
		out.push({
			id: 'drivers',
			state: has && nDrivers > 0 ? 'configured' : 'missing',
			label: 'row_drivers', what: 'row_drivers_what', why: 'row_drivers_for', ifMissing: 'row_drivers_missing',
			help: 'row_drivers_tip',
			params: { axes: (c && c.nAxes) || 0, drivers: nDrivers },
			texts: { configured: 'drivers_ok', missing: has ? 'drivers_none' : 'drivers_no_data' }
		});
	}
	if (c && Array.isArray(c.macros)) {
		const faltan = MACROS.filter(m => c.macros.indexOf(m) < 0);
		out.push({
			id: 'macros',
			state: faltan.length ? 'missing' : 'configured',
			label: 'row_macros', what: 'row_macros_what', why: 'row_macros_for', ifMissing: 'row_macros_missing',
			help: 'row_macros_tip',
			params: { n: faltan.length, list: faltan.join(', ') },
			texts: { configured: 'macros_ok', missing: 'macros_missing' }
		});
	}
	return out;
}
