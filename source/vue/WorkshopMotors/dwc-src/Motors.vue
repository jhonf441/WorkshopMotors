<template>
	<v-container :style="secStyle" ref="root" fluid class="pa-0 motors-page workshop-theme">
		<service-notice />
		<!-- header (DESIGN.md 3): the common page header; the chips say at a glance what matters -->
		<page-header :lead="$t('plugins.WorkshopMotors.page.lead')" icon="mdi-engine" :title="$t('plugins.WorkshopMotors.common.motors')" :reasons="headerReasons" :loading="waitingData">
			<v-chip v-for="c in summary.chips" :key="c.id" size="small" variant="outlined" :color="c.color">
				<v-icon size="x-small" start>{{ c.icon }}</v-icon>{{ $t('plugins.WorkshopMotors.page.' + c.key, c.params) }}
			</v-chip>
			<control-holder-chip :model="model" />
			<template #right>
				<span v-if="fresh.state === 'live'" class="text-body-small motors-faint">{{ $t('plugins.WorkshopMotors.page.live') }}</span>
			</template>
			<template #startup><startup-panel plugin="WorkshopMotors" :defs="rowsStartup" /></template>
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

<script setup>
// WorkshopMotors page shell: header, level 4 band, side bar and one section at a time. What it shows comes from the
// motors report of WorkshopService (plugins.WorkshopService.data.motorReport) and DWC's object model; the state of each
// motor and the header chips are derived in motor-state.js. Design: docs-internal/MOTORES-DISENO.md.
// The history of the charts is recorded by record.js, which index.js starts when DWC loads the plugin.

import { sectionColor } from './section-colors.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n, machineModel, modelPlugins } from './dwc-host.js'
import { useRole } from './use-role.js' // what the role sees (vue/_shared)
import ServiceNotice from './ServiceNotice.vue'
import StartupPanel from './StartupPanel.vue' // start-up card (vue/_shared)
import PageHeader from './PageHeader.vue' // header of every page (vue/_shared)
import SideTabs from './SideTabs.vue'
import StateSection from './StateSection.vue'
import DetailsSection from './Details.vue'
import ChartsSection from './Charts.vue'
import AdvisorSection from './Advisor.vue'
import EnableSection from './Enable.vue'
import AxesTest from './AxesTest.vue'
import MeasureSection from './Measure.vue'
import CrashSection from './CrashSection.vue'
import ReleasedBand from './ReleasedBand.vue'
import ControlHolderChip from './ControlHolderChip.vue' // who holds the movement (vue/_shared)
import { levelOfColor } from './page-health.js'
import { rowsMotors, MACROS_DIR } from './startup-rows.js'
import { freshness, motorStates, pageSummary } from './motor-state.js'
import { parseTestsCsv } from './report-view.js'
import { restoreSection, sideItems, allowedSection } from './sections.js'
import { CEILING_FILE, TESTS_FILE, thresholdAxis } from './test-limits.js'
import { pluginOf, dataOf } from './workshop-ids.js'
import { api } from './workshop-api.js'

const TAB_KEY = 'workshopMotorsTab' // the section (an id; an old tab number or id is still understood)

function readSection() {
	try {
		return allowedSection(restoreSection(localStorage.getItem(TAB_KEY)))
	} catch (e) {
		return allowedSection(restoreSection(null))
	}
}

const { canDo } = useRole()

const root = ref(null)
const section = ref(readSection())
const now = ref(Date.now())
const openedAt = Date.now()
const lastChangeAt = ref(null) // browser time of the last change of report.updated_at seen since the page opened
const ceiling = ref(null)
const tests = ref([])
const chartsPreselect = ref(null)
const startupMacros = ref(null) // start-up card: files found in the macros folder of the plugin (null = not read)
const startupWait = ref(false) // start-up card: the page has been open long enough for the driver report to be there
let startupTimer = null
let clock = null
let heartbeatTimer = null

const secStyle = computed(() => ({ '--wf-sec': sectionColor(section.value) }))
const model = computed(() => machineModel())
// the report as the service publishes it: the sections name the faults and the kinematics by their keys, so the
// labels the service publishes as {key, params} are not needed
const report = computed(() => dataOf(pluginOf(modelPlugins(), 'service'), 'motorReport') || null)
// live job ({active, name, ...}) published by the service
const liveJob = computed(() => dataOf(pluginOf(modelPlugins(), 'service'), 'liveJob') || null)
const fresh = computed(() => freshness({ hasReport: !!report.value, lastChangeMs: lastChangeAt.value, openedMs: openedAt, nowMs: now.value }))
const motors = computed(() => motorStates(report.value, model.value))
const summary = computed(() => pageSummary(motors.value, report.value, fresh.value))
// what the page header counts: the header chips in red or orange (the service problem and the session are added by it)
const headerReasons = computed(() => (summary.value.chips || [])
	.filter(c => levelOfColor(c.color) !== 'ok')
	.map(c => ({ level: levelOfColor(c.color), text: i18n.t('plugins.WorkshopMotors.page.' + c.key, c.params) })))
// no data from the motors yet: the header does not claim everything is fine
const waitingData = computed(() => (summary.value.chips || []).some(c => c.id === 'data'))
const sections = computed(() => sideItems(k => i18n.t('plugins.WorkshopMotors.' + k), op => canDo(op)))
// start-up card: drivers in the report of the service and the macros of the plugin
const rowsStartup = computed(() => {
	const entries = (report.value && report.value.entries) || []
	return rowsMotors({
		report: !!report.value,
		nAxes: entries.length,
		nDrivers: entries.reduce((n, e) => n + ((e.drivers && e.drivers.length) || 0), 0),
		waitExpired: startupWait.value,
		macros: startupMacros.value
	})
})
const axesOM = computed(() => (model.value.move && model.value.move.axes) ? model.value.move.axes.filter(a => a && a.visible !== false) : [])
const modeMachine = computed(() => (model.value.state && model.value.state.machineMode) || '')
const stateMachine = computed(() => (model.value.state && model.value.state.status) || '')
const vin = computed(() => {
	const b = model.value.boards && model.value.boards[0]
	const v = b && b.vIn && b.vIn.current
	return v > 5 ? v : 24
})
// globals left by the macros of the plugin (axis-test.g, step-ceiling.g): an interrupted run is offered a restore
const globals = computed(() => {
	const g = model.value.global
	const read = k => (g && (typeof g.get === 'function' ? g.get(k) : g[k]))
	return {
		workshopTestPending: read('workshopTestPending') === true,
		workshopTestAxis: read('workshopTestAxis') || '',
		workshopTestV: read('workshopTestV'),
		workshopTestAcc: read('workshopTestAcc'),
		workshopTestMode: read('workshopTestMode') || '',
		workshopCeilingPending: read('workshopCeilingPending') === true,
		workshopCeilingAxis: read('workshopCeilingAxis') || ''
	}
})

// the role changed (logged in, out): a section the new role does not see is left for the first one it sees
watch(sections, list => {
	if (!list.some(x => x.id === section.value)) {
		section.value = allowedSection(section.value, op => canDo(op))
	}
})
watch(section, v => {
	try {
		localStorage.setItem(TAB_KEY, v)
	} catch (e) {
		// without localStorage: the section is not remembered
	}
	if (v === 'advisor' || v === 'test') {
		loadTests()
	}
})
// a watch on the report object would not fire (it is patched in place): its updated_at changes every cycle
watch(() => report.value && report.value.updated_at, v => {
	if (v) {
		lastChangeAt.value = Date.now()
	}
})

onMounted(() => {
	loadCeiling()
	loadMacrosStartup()
	if (section.value === 'advisor' || section.value === 'test') {
		loadTests()
	}
	startupTimer = setTimeout(() => { startupWait.value = true }, 20000)
	clock = setInterval(() => { now.value = Date.now() }, 1000)
	// Heartbeat (DCS load, 2026-10-12): WorkshopService reads the drivers (M122 / M569 / M569.2) only while this page is
	// visible; without a heartbeat for 30 s it slows down (dsf/viewers.py). Every 10 s, only with the tab visible.
	heartbeatTimer = setInterval(() => heartbeat(), 10000)
	heartbeat()
})
onBeforeUnmount(() => {
	clearInterval(clock)
	clearInterval(heartbeatTimer)
	clearTimeout(startupTimer)
})

function heartbeat() {
	const el = root.value && (root.value.$el || root.value)
	if (document.hidden || !el || el.isConnected === false) return
	api('view.heartbeat', { topic: 'motors' }).catch(() => {})
}
// opens a section only when the role sees it (a technician-only section from a link of a health section does nothing)
function goSection(id) {
	if (sections.value.some(x => x.id === id)) {
		section.value = id
	}
}
function openCharts(ids) {
	chartsPreselect.value = { ids: ids.slice(), at: Date.now() }
	section.value = 'charts'
}
// start-up card: which files the macros folder has (the folder missing = none; any other answer = not known)
async function loadMacrosStartup() {
	try {
		const r = await fetch('/machine/directory/' + encodeURIComponent(MACROS_DIR), { cache: 'no-store' })
		if (r.status === 404) {
			startupMacros.value = []
			return
		}
		const d = r.ok ? await r.json() : null
		startupMacros.value = Array.isArray(d) ? d.map(f => f.name || f.Name) : null
	} catch (e) {
		startupMacros.value = null
	}
}
// Step ceiling MEASURED on this board (Measure); null = the dc42 table is the reference
async function loadCeiling() {
	try {
		const r = await fetch('/machine/file/' + encodeURIComponent(CEILING_FILE), { cache: 'no-store' })
		const j = r.ok ? JSON.parse(await r.text()) : null
		ceiling.value = j && j.khz_per_motor > 0 ? j : null
	} catch (e) {
		ceiling.value = null
	}
}
async function loadTests() {
	try {
		const r = await fetch('/machine/file/' + encodeURIComponent(TESTS_FILE), { cache: 'no-store' })
		tests.value = r.ok ? parseTestsCsv(await r.text(), thresholdAxis) : []
	} catch (e) {
		tests.value = []
	}
}
</script>

<style>
.motors-page .motors-faint {
	color: var(--tp-faint, #9e9e9e);
}
</style>
