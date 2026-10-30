<template>
	<v-container :style="secStyle" fluid class="pa-0 motors-page workshop-theme">
		<service-notice />
		<!-- header (DESIGN.md 3): the common page header; the chips say at a glance what matters -->
		<page-header :lead="$t('plugins.WorkshopMotors.page.lead')" icon="mdi-engine" :title="$t('plugins.WorkshopMotors.common.motors')" :reasons="headerReasons" :loading="waitingData">
			<v-chip v-for="c in summary.chips" :key="c.id" small outlined :color="c.color">
				<v-icon x-small left>{{ c.icon }}</v-icon>{{ $t('plugins.WorkshopMotors.page.' + c.key, c.params) }}
			</v-chip>
			<control-holder-chip :model="model" />
			<template v-slot:right>
				<span v-if="fresh.state === 'live'" class="text-caption motors-faint">{{ $t('plugins.WorkshopMotors.page.live') }}</span>
			</template>
			<template v-slot:startup><startup-panel plugin="WorkshopMotors" :defs="rowsStartup" /></template>
		</page-header>
		<!-- level 4 (DESIGN.md 5): motors without holding force, visible in every section while it lasts -->
		<released-band v-if="summary.released.length" :keys="summary.released" :report="report" :om="model" :live-job="liveJob" @open="goSection('release')" />
		<div class="mb-3">
			<div>
				<div class="st-layout">
					<side-tabs v-model="section" :items="sections" />
					<!-- one section at a time, mounted only while it is open (DESIGN.md 3) -->
					<div class="st-body">
						<state-section v-if="section === 'state'" :motors="motors" :report="report" :fresh="fresh" @release="goSection('release')" />
						<details-section v-else-if="section === 'details'" :report="report" :ceiling="ceiling" @charts="openCharts" />
						<charts-section v-else-if="section === 'charts'" :report="report" :om="model" :ceiling="ceiling" :preselect="chartsPreselect" />
						<advisor-section v-else-if="section === 'advisor'" :report="report" :axes="axesOM" :mode-current="modeMachine" :vin="vin" :tests="tests" :ceiling="ceiling" />
						<enable-section v-else-if="section === 'release'" :report="report" :om="model" :live-job="liveJob" />
						<axes-test v-else-if="section === 'test'" :axes="axesOM" :state="stateMachine" :mode="modeMachine" :globals="globals" :tests="tests" @reload="loadTests()" />
						<measure-section v-else-if="section === 'measure'" :axes="axesOM" :state="stateMachine" :globals="globals" :report="report" :ceiling="ceiling" @reload="loadCeiling()" />
						<crash-section v-else-if="section === 'crash'" :axes="axesOM" :state="stateMachine" :om="model" :report="report" :live-job="liveJob" />
					</div>
				</div>
			</div>
		</div>
	</v-container>
</template>

<script>
'use strict'

// WorkshopMotors page shell: header, level 4 band, side bar and one section at a time. What it shows comes from the
// motors report of WorkshopService (plugins.WorkshopService.data.motorReport) and DWC's object model; the state of each
// motor and the header chips are derived in motor-state.js. Design: docs-internal/MOTORES-DISENO.md.

import { sectionColor } from './section-colors.js'
import ServiceNotice from './ServiceNotice.vue'
import StartupPanel from './StartupPanel.vue' // start-up card (vue/_shared)
import PageHeader from './PageHeader.vue' // header of every page (vue/_shared)
import { levelOfColor } from './page-health.js'
import SideTabs from './SideTabs.vue'
import StateSection from './StateSection.vue'
import DetailsSection from './Details.vue'
import ChartsSection from './Charts.vue'
import AdvisorSection from './Advisor.vue'
import EnableSection from './Enable.vue'
import AxesTest, { thresholdAxis } from './AxesTest.vue'
import MeasureSection, { CEILING_FILE } from './Measure.vue'
import CrashSection from './CrashSection.vue'
import ReleasedBand from './ReleasedBand.vue'
import ControlHolderChip from './ControlHolderChip.vue' // who holds the movement (vue/_shared)
import { roleMixin } from './role-mixin.js' // what the role sees (vue/_shared)
import { rowsMotors, MACROS_DIR } from './startup-rows.js'
import { freshness, motorStates, pageSummary } from './motor-state.js'
import { parseTestsCsv } from './report-view.js'
import { restoreSection, sideItems, allowedSection } from './sections.js'
import { start as startRecord } from './record.js'
import { pluginOf } from './workshop-ids.js'
import { api } from './workshop-api.js'

const TAB_KEY = 'workshopMotorsTab'; // the section (an id; an old tab number or id is still understood)
const TESTS_FILE = '0:/sys/workshop/data/axis-test.csv';

// the history of the charts: it records while DWC is open, whether or not this page is (record.js)
startRecord();

function readSection() {
	try {
		return allowedSection(restoreSection(localStorage.getItem(TAB_KEY)));
	} catch (e) {
		return allowedSection(restoreSection(null));
	}
}

export default {
	mixins: [roleMixin],
	components: { PageHeader, ControlHolderChip, ServiceNotice, StartupPanel, SideTabs, StateSection, DetailsSection, ChartsSection, AdvisorSection, EnableSection, AxesTest, MeasureSection, CrashSection, ReleasedBand },
	data() {
		return {
			section: readSection(),
			now: Date.now(),
			openedAt: Date.now(),
			lastChangeAt: null, // browser time of the last change of report.updated_at seen since the page opened
			ceiling: null,
			tests: [],
			chartsPreselect: null,
			startupMacros: null, // start-up card: files found in the macros folder of the plugin (null = not read)
			startupWait: false // start-up card: the page has been open long enough for the driver report to be there
		};
	},
	computed: {
		secStyle() {
			return { '--wf-sec': sectionColor(this.section) }
		},
		model() {
			return this.$store.state.machine.model;
		},
		pluginData() {
			const pm = pluginOf(this.model.plugins, 'service');
			return (pm && pm.data) || null;
		},
		// the report as the service publishes it: the sections name the faults and the kinematics by their keys, so the
		// labels the service publishes as {key, params} are not needed
		report() {
			const d = this.pluginData;
			return (d && (typeof d.get === 'function' ? d.get('motorReport') : d.motorReport)) || null;
		},
		// live job ({active, name, ...}) published by the service
		liveJob() {
			const d = this.pluginData;
			return (d && (typeof d.get === 'function' ? d.get('liveJob') : d.liveJob)) || null;
		},
		fresh() {
			return freshness({ hasReport: !!this.report, lastChangeMs: this.lastChangeAt, openedMs: this.openedAt, nowMs: this.now });
		},
		motors() {
			return motorStates(this.report, this.model);
		},
		// what the page header counts: the header chips in red or orange (the service problem and the session are added by it)
		headerReasons() {
			return (this.summary.chips || [])
				.filter(c => levelOfColor(c.color) !== 'ok')
				.map(c => ({ level: levelOfColor(c.color), text: this.$t('plugins.WorkshopMotors.page.' + c.key, c.params) }));
		},
		// no data from the motors yet: the header does not claim everything is fine
		waitingData() {
			return (this.summary.chips || []).some(c => c.id === 'data');
		},
		summary() {
			return pageSummary(this.motors, this.report, this.fresh);
		},
		sections() {
			return sideItems(k => this.$t('plugins.WorkshopMotors.' + k), op => this.canDo(op));
		},
		// start-up card: drivers in the report of the service and the macros of the plugin
		rowsStartup() {
			const entries = (this.report && this.report.entries) || [];
			return rowsMotors({
				report: !!this.report,
				nAxes: entries.length,
				nDrivers: entries.reduce((n, e) => n + ((e.drivers && e.drivers.length) || 0), 0),
				waitExpired: this.startupWait,
				macros: this.startupMacros
			});
		},
		axesOM() {
			return (this.model.move && this.model.move.axes) ? this.model.move.axes.filter(a => a && a.visible !== false) : [];
		},
		modeMachine() {
			return (this.model.state && this.model.state.machineMode) || '';
		},
		stateMachine() {
			return (this.model.state && this.model.state.status) || '';
		},
		vin() {
			const b = this.model.boards && this.model.boards[0];
			const v = b && b.vIn && b.vIn.current;
			return v > 5 ? v : 24;
		},
		// globals left by the macros of the plugin (axis-test.g, step-ceiling.g): an interrupted run is offered a restore
		globals() {
			const g = this.model.global;
			const read = k => (g && (typeof g.get === 'function' ? g.get(k) : g[k]));
			return {
				workshopTestPending: read('workshopTestPending') === true,
				workshopTestAxis: read('workshopTestAxis') || '',
				workshopTestV: read('workshopTestV'),
				workshopTestAcc: read('workshopTestAcc'),
				workshopTestMode: read('workshopTestMode') || '',
				workshopCeilingPending: read('workshopCeilingPending') === true,
				workshopCeilingAxis: read('workshopCeilingAxis') || ''
			};
		}
	},
	watch: {
		// the role changed (logged in, out): a section the new role does not see is left for the first one it sees
		sections(list) {
			if (!list.some(x => x.id === this.section)) {
				this.section = allowedSection(this.section, op => this.canDo(op));
			}
		},
		section(v) {
			try {
				localStorage.setItem(TAB_KEY, v);
			} catch (e) {
				// without localStorage: the section is not remembered
			}
			if (v === 'advisor' || v === 'test') {
				this.loadTests();
			}
		},
		// a watch on the report object would not fire (it is patched in place): its updated_at changes every cycle
		'report.updated_at'(v) {
			if (v) {
				this.lastChangeAt = Date.now();
			}
		}
	},
	mounted() {
		this.loadCeiling();
		this.loadMacrosStartup();
		if (this.section === 'advisor' || this.section === 'test') {
			this.loadTests();
		}
		this._startupWait = setTimeout(() => { this.startupWait = true; }, 20000);
		this._clock = setInterval(() => { this.now = Date.now(); }, 1000);
		// Heartbeat (DCS load, 2026-10-12): WorkshopService reads the drivers (M122 / M569 / M569.2) only while this page is
		// visible; without a heartbeat for 30 s it slows down (dsf/viewers.py). Every 10 s, only with the tab visible.
		this._heartbeat = setInterval(() => this.heartbeat(), 10000);
		this.heartbeat();
	},
	beforeDestroy() {
		clearInterval(this._clock);
		clearInterval(this._heartbeat);
		clearTimeout(this._startupWait);
	},
	methods: {
		heartbeat() {
			if (document.hidden || !this.$el || this.$el.isConnected === false) return;
			api('view.heartbeat', { topic: 'motors' }).catch(() => {});
		},
		// opens a section only when the role sees it (a technician-only section from a link of a health section does nothing)
		goSection(id) {
			if (this.sections.some(x => x.id === id)) {
				this.section = id;
			}
		},
		openCharts(ids) {
			this.chartsPreselect = { ids: ids.slice(), at: Date.now() };
			this.section = 'charts';
		},
		// start-up card: which files the macros folder has (the folder missing = none; any other answer = not known)
		async loadMacrosStartup() {
			try {
				const r = await fetch('/machine/directory/' + encodeURIComponent(MACROS_DIR), { cache: 'no-store' });
				if (r.status === 404) {
					this.startupMacros = [];
					return;
				}
				const d = r.ok ? await r.json() : null;
				this.startupMacros = Array.isArray(d) ? d.map(f => f.name || f.Name) : null;
			} catch (e) {
				this.startupMacros = null;
			}
		},
		// Step ceiling MEASURED on this board (Measure); null = the dc42 table is the reference
		async loadCeiling() {
			try {
				const r = await fetch('/machine/file/' + encodeURIComponent(CEILING_FILE), { cache: 'no-store' });
				const j = r.ok ? JSON.parse(await r.text()) : null;
				this.ceiling = j && j.khz_per_motor > 0 ? j : null;
			} catch (e) {
				this.ceiling = null;
			}
		},
		async loadTests() {
			try {
				const r = await fetch('/machine/file/' + encodeURIComponent(TESTS_FILE), { cache: 'no-store' });
				this.tests = r.ok ? parseTestsCsv(await r.text(), thresholdAxis) : [];
			} catch (e) {
				this.tests = [];
			}
		}
	}
};
</script>

<style>
.motors-page .motors-faint {
	color: var(--tp-faint, #9e9e9e);
}
</style>
