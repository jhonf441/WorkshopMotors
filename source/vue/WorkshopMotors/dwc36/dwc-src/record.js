'use strict'

// The single history of the Motors page (the Charts section draws from it). It starts when DWC
// loads the plugin (whether or not the page is open) and stores a sample each time the service publishes a new
// report (motorReport.updated_at). It does NOT ask the board for anything: it only looks at the object model DWC
// already has. The history stays OUTSIDE Vue's reactivity (thousands of numbers in one array per series); the
// sections find out through R.tick.
// Rate: about one sample per second while the Motors page is open (its heartbeat keeps the service's poller
// awake); with the page closed the service publishes only changes and a keepalive about once a minute and does not
// read the drivers (WorkshopService dsf/viewers.py), so the history between visits is sparse.
// It is saved to sessionStorage every 30 s (the last 20 min): it survives reloading the tab.

import Vue from 'vue'
import store from '@/store'
import { pluginOf } from './workshop-ids.js'
import { newHistory, addSample as add, sample, registerAlerts, newRecordAlerts, serialize, deserialize } from './charts.js'

export const MAX_S = 3600; // one hour at 1 sample/s
const KEY = 'workshopMotorsChart';
const SAVE_S = 1200;

export const historyOf = { h: newHistory(MAX_S), alerts: newRecordAlerts() };
export const R = Vue.observable({ tick: 0, since: Date.now() });

function readReport() {
	const pm = pluginOf(store.state.machine.model.plugins, 'service');
	if (!pm || !pm.data) {
		return null;
	}
	// the alerts are recorded by the KEY of the fault (named in the language of the page when shown)
	return (typeof pm.data.get === 'function') ? pm.data.get('motorReport') : pm.data.motorReport;
}

function save() {
	try {
		sessionStorage.setItem(KEY, serialize(historyOf.h, Date.now(), SAVE_S));
	} catch (e) {
		// full or blocked: not critical
	}
}

let started = false;
let last = null; // what the previous sample saw (charts.js sample): driver values only after a new reading
export function start() {
	if (started) {
		return;
	}
	started = true;
	try {
		const t = sessionStorage.getItem(KEY);
		if (t) {
			historyOf.h = deserialize(t, MAX_S, Date.now(), MAX_S);
			if (historyOf.h.t.length) {
				R.since = historyOf.h.t[0];
			}
		}
	} catch (e) {
		// without sessionStorage
	}
	// updated_at is watched (a string that changes every poller cycle): the report object is mutated in place,
	// a watch on the whole object would not fire.
	store.watch(
		() => {
			const r = readReport();
			return r ? r.updated_at : null;
		},
		(upd) => {
			const r = readReport();
			if (!upd || !r) {
				return;
			}
			const t = Date.now();
			const s = sample(r, store.state.machine.model, last);
			last = s.last;
			add(historyOf.h, t, s.values);
			registerAlerts(historyOf.alerts, r, t);
			R.tick++;
		}
	);
	setInterval(save, 30000);
	window.addEventListener('beforeunload', save);
}
