'use strict'

// The sections of the Motors page (side bar, vue/_shared/SideTabs.vue). Pure (no Vue): test/report-view.test.js.
// Two groups (F3-V, 2026-10-21): HEALTH (state, details, charts, releasing the motors) and COMMISSIONING (what changes or moves
// the machine). label / group: keys relative to plugins.WorkshopMotors, translated when the bar is drawn.

import { visibleItems, pickAllowed } from './role-view.js'

// `min` = the lowest role that sees the section (role-view.js; none = everybody). Health is for everybody; commissioning
// (Advisor, Test, Measure, Crash: they change the configuration or move the machine) is for a technician or an administrator.
export const SECTIONS = [
	{ id: 'state', icon: 'mdi-engine', label: 'page.section_state', group: 'page.group_health' },
	{ id: 'details', icon: 'mdi-tune-vertical', label: 'motors.details', group: 'page.group_health' },
	{ id: 'charts', icon: 'mdi-chart-multiple', label: 'common.charts', group: 'page.group_health' },
	{ id: 'release', icon: 'mdi-engine-off-outline', label: 'page.section_release', group: 'page.group_health', min: 'operator' },
	{ id: 'advisor', icon: 'mdi-lightbulb-on-outline', label: 'motors.advisor', group: 'page.group_setup', min: 'technician' },
	{ id: 'test', icon: 'mdi-test-tube', label: 'common.test', group: 'page.group_setup', min: 'technician' },
	{ id: 'measure', icon: 'mdi-gauge', label: 'motors.measure', group: 'page.group_setup', min: 'technician' },
	{ id: 'crash', icon: 'mdi-car-brake-alert', label: 'motors.crash', group: 'page.group_setup', min: 'technician' }
];

// The sections the current role sees (can = a replacement of workshopCan, for the tests)
export function visibleSections(can) {
	return visibleItems(SECTIONS, can);
}

// `wanted` when the role may open it, otherwise the first one it may
export function allowedSection(wanted, can) {
	return pickAllowed(SECTIONS, wanted, can);
}

// The section saved in the browser (its id), or the first one
export function restoreSection(stored) {
	const s = stored == null ? '' : String(stored);
	return SECTIONS.some(x => x.id === s) ? s : SECTIONS[0].id;
}

// The items of the side bar; t(key) = the page's translator (key relative to plugins.WorkshopMotors)
export function sideItems(t, can) {
	return visibleSections(can).map(s => ({ id: s.id, icon: s.icon, label: t(s.label), group: t(s.group) }));
}
