<template>
	<div>
		<!-- ===== Charts a eleccion ===== -->
		<div class="text-title-small mb-1"><v-icon size="small" class="mr-1">mdi-chart-multiple</v-icon>{{ $t('plugins.WorkshopMotors.common.charts') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-body-small text-medium-emphasis mb-2">
			{{ $t('plugins.WorkshopMotors.charts.pick_one_or_several_they_use') }}
		</div>
		</details>
		<v-autocomplete
			v-model="sel" :items="itemsSelector" item-title="name" item-value="id" multiple chips closable-chips
			density="compact" variant="outlined" hide-details clearable :label="$t('plugins.WorkshopMotors.charts.charts_to_show')" :no-data-text="$t('plugins.WorkshopMotors.charts.waiting_for_data_from_the_service')"
		/>
		<div class="d-flex flex-wrap align-center mt-2" style="gap:6px">
			<v-btn size="x-small" variant="outlined" @click="addKind(['cruise', 'speed'])">{{ $t('plugins.WorkshopMotors.charts.speed_of_all') }}</v-btn>
			<v-btn size="x-small" variant="outlined" @click="addKind('current')">{{ $t('plugins.WorkshopMotors.charts.current_of_all') }}</v-btn>
			<v-btn size="x-small" variant="outlined" @click="addKind('sg')">{{ $t('plugins.WorkshopMotors.charts.stallguard_of_all') }}</v-btn>
			<v-btn size="x-small" variant="outlined" @click="addKind(['boardPulses', 'hiccups', 'vin', 'boardTemp'])">{{ $t('plugins.WorkshopMotors.charts.board_series') }}</v-btn>
			<v-btn size="x-small" variant="outlined" @click="addTodo()">{{ $t('plugins.WorkshopMotors.charts.all') }}</v-btn>
			<v-btn size="x-small" variant="text" @click="sel = []">{{ $t('plugins.WorkshopMotors.charts.remove_all') }}</v-btn>
			<v-spacer />
			<span class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopMotors.charts.period') }}</span>
			<v-btn-toggle v-model="spanMin" mandatory density="compact" color="primary">
				<v-btn v-for="r in SPANS" :key="r" size="x-small" :value="r">{{ r < 60 ? r + ' min' : '1 h' }}</v-btn>
			</v-btn-toggle>
			<v-btn-toggle v-model="columns" mandatory density="compact" color="primary">
				<v-btn size="x-small" :value="1" :title="$t('plugins.WorkshopMotors.charts.one_per_row')"><v-icon size="x-small">mdi-view-agenda-outline</v-icon></v-btn>
				<v-btn size="x-small" :value="2" :title="$t('plugins.WorkshopMotors.charts.two_per_row')"><v-icon size="x-small">mdi-view-grid-outline</v-icon></v-btn>
			</v-btn-toggle>
		</div>
		<div v-if="historyShort" class="text-body-small text-medium-emphasis mt-1">
			{{ $t('plugins.WorkshopMotors.charts.data_since_min', { n: minutesData }) }}
		</div>
		<div v-if="!(sel && sel.length)" class="text-body-small text-medium-emphasis mt-3">{{ $t('plugins.WorkshopMotors.charts.no_chart_selected') }}</div>
		<v-row density="compact" class="mt-2">
			<v-col v-for="g in charts" :key="g.serial.id" cols="12" :md="columns === 2 ? 6 : 12">
				<div class="chart-card">
					<div class="d-flex align-center flex-wrap" style="gap:6px">
						<span class="text-body-medium font-weight-medium">{{ g.serial.name }}</span>
						<span class="text-body-small text-medium-emphasis">{{ g.serial.group }}</span>
						<v-spacer />
						<span v-if="g.summary" class="text-body-small">
							{{ $t('plugins.WorkshopMotors.charts.max') }} <b>{{ fmt(g.summary.max) }}</b> &middot; {{ $t('plugins.WorkshopMotors.charts.min_avg', { min: fmt(g.summary.min), avg: fmt(g.summary.avg) }) }}
						</span>
						<v-btn size="x-small" icon :title="$t('plugins.WorkshopMotors.charts.remove')" @click="remove(g.serial.id)"><v-icon size="x-small">mdi-close</v-icon></v-btn>
					</div>
					<div class="text-body-small text-medium-emphasis">
						{{ g.serial.note }}<span v-if="g.serial.limit"> &middot; <span class="chart-dash" :style="{ borderColor: REFERENCE_COLOR }" /> {{ g.serial.limitText }}</span>
					</div>
					<!-- one series per chart, the same blue in all (dataviz slot 1), the reference dashed grey; the same window
						 for every chart (it ends now: a silence shows at the right) and the line cut where there was no data -->
					<!-- no sample in the window: no empty axes, a line that says why there is none (and what to do) -->
					<div v-if="!g.pts.length" class="text-body-small mt-2 mb-1" style="opacity:.8">{{ g.serial.emptyText || $t('plugins.WorkshopMotors.charts.no_data_in_period') }}</div>
					<detail-chart
						v-else
						:history="g.pts" :color="color" :unit="g.serial.unit" :label="g.serial.name" :legend="false"
						:limit="g.serial.limit" :limit-label="g.serial.limitText" :limit-color="REFERENCE_COLOR"
						:gap-ms="g.serial.gapMs" :x-min="since" :x-max="now" :zero-based="g.serial.zeroBased !== false"
						:height="columns === 2 ? 150 : 180"
					/>
				</div>
			</v-col>
		</v-row>

		<!-- faults of the drivers in the period: events (when they started and ended), not a curve -->
		<div class="text-title-small mt-4 mb-1"><v-icon size="small" class="mr-1">mdi-alert-outline</v-icon>{{ $t('plugins.WorkshopMotors.charts.alerts_in_the_period') }}</div>
		<div v-if="!alertRows.length" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopMotors.charts.no_alerts_in_period') }}</div>
		<div v-else class="table-scroll">
			<v-table density="compact">
				<thead>
					<tr>
						<th>{{ $t('plugins.WorkshopMotors.charts.alert_since') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.alert_until') }}</th>
						<th>{{ $t('plugins.WorkshopMotors.common.driver') }}</th><th>{{ $t('plugins.WorkshopMotors.common.axis') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.alert_fault') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(a, i) in alertRows" :key="i">
						<td>{{ hourShort(a.since) }}</td>
						<td>{{ a.until ? hourShort(a.until) : $t('plugins.WorkshopMotors.charts.alert_ongoing') }}</td>
						<td>{{ a.driver }}</td>
						<td>{{ a.axis }}</td>
						<td><v-icon size="x-small" :color="a.severity" class="mr-1">{{ a.severity === 'error' ? 'mdi-alert-octagon' : 'mdi-alert' }}</v-icon>{{ faultLabel(a.key) }}</td>
					</tr>
				</tbody>
			</v-table>
		</div>

		<!-- ===== Reporte avanzado ===== -->
		<v-divider class="my-4" />
		<div class="text-title-small mb-1"><v-icon size="small" class="mr-1">mdi-file-chart-outline</v-icon>{{ $t('plugins.WorkshopMotors.charts.advanced_report_of_all_motors') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-body-small text-medium-emphasis mb-2">
			{{ $t('plugins.WorkshopMotors.charts.report_intro', { period: spanMin < 60 ? spanMin + ' min' : '1 h' }) }}
		</div>
		</details>
		<div class="d-flex flex-wrap align-center" style="gap:8px">
			<v-btn size="small" color="primary" :loading="reading" :disabled="reading" @click="generate()">
				<v-icon start size="small">mdi-file-search-outline</v-icon>{{ $t('plugins.WorkshopMotors.charts.generate_report') }}
			</v-btn>
			<template v-if="rep">
				<v-btn size="small" variant="outlined" @click="download('txt')"><v-icon start size="small">mdi-download</v-icon>{{ $t('plugins.WorkshopMotors.charts.text') }}</v-btn>
				<v-btn size="small" variant="outlined" @click="download('csv')"><v-icon start size="small">mdi-download</v-icon>{{ $t('plugins.WorkshopMotors.charts.spreadsheet_csv') }}</v-btn>
				<v-btn size="small" variant="outlined" @click="download('json')"><v-icon start size="small">mdi-download</v-icon>JSON</v-btn>
			</template>
			<span v-if="reading" class="text-body-small">{{ $t('plugins.WorkshopMotors.charts.reading_progress', { what: progress }) }}</span>
			<span v-if="slow" class="text-body-small text-warning">{{ $t('plugins.WorkshopMotors.charts.the_board_is_slow_to_answer') }}</span>
		</div>
		<v-alert v-if="errorRep" density="compact" variant="outlined" type="error" class="mt-2 mb-0">{{ errorRep }}</v-alert>

		<template v-if="rep">
			<div class="d-flex flex-wrap mt-3" style="gap:6px">
				<v-chip size="small" variant="outlined">{{ rep.machine.board || $t('plugins.WorkshopMotors.charts.board_lower') }}{{ rep.machine.firmware ? ' · RRF ' + rep.machine.firmware : '' }}</v-chip>
				<v-chip size="small" variant="outlined">{{ $t('plugins.WorkshopMotors.charts.n_motors_n_drivers', { m: rep.motors.length, d: totalDrivers }) }}</v-chip>
				<v-chip size="small" variant="outlined" :color="rep.alerts.length ? 'warning' : 'success'">
					<v-icon size="x-small" start>{{ rep.alerts.length ? 'mdi-alert' : 'mdi-check' }}</v-icon>{{ $t('plugins.WorkshopMotors.charts.n_alerts_in_period', { n: rep.alerts.length }) }}
				</v-chip>
				<v-chip v-if="withoutResponse" size="small" variant="outlined" color="warning">{{ $t('plugins.WorkshopMotors.charts.n_commands_no_reply', { n: withoutResponse }) }}</v-chip>
				<span class="text-body-small text-medium-emphasis align-self-center">{{ $t('plugins.WorkshopMotors.charts.generated_at', { time: hourShort(rep.generated) }) }}</span>
			</div>
			<div class="table-scroll mt-2">
				<v-table density="compact">
					<thead>
						<tr>
							<th>{{ $t('plugins.WorkshopMotors.common.motor') }}</th><th>{{ $t('plugins.WorkshopMotors.common.driver') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.microstepping') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.steps_mm') }}</th><th>{{ $t('plugins.WorkshopMotors.common.current') }}</th><th>{{ $t('plugins.WorkshopMotors.common.max_speed') }}</th>
							<th>{{ $t('plugins.WorkshopMotors.charts.accel') }}</th><th>{{ $t('plugins.WorkshopMotors.common.jerk') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.mode_direction') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.stall_m915') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.measured_speed') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.max_current') }}</th>
							<th>{{ $t('plugins.WorkshopMotors.charts.sg_min') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.now') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.alerts_in_the_period') }}</th>
						</tr>
					</thead>
					<tbody>
						<template v-for="m in rep.motors" :key="m.key">
							<tr v-for="(d, i) in m.drivers" :key="m.key + d.id">
								<td><b v-if="i === 0">{{ m.key }}</b></td>
								<td>{{ d.id }}</td>
								<td>1/{{ m.micro }}{{ m.interpolated ? ' (i)' : '' }}</td>
								<td>{{ fmt(m.stepsMm, 2) }}</td>
								<td>{{ fmt(m.current, 0) }} mA</td>
								<td>{{ fmt(m.speedMax, 0) }}</td>
								<td>{{ fmt(m.accel, 0) }}</td>
								<td>{{ fmt(m.jerk, 0) }}</td>
								<td>{{ d.m569.mode || '--' }}<span v-if="d.m569.address"> &middot; {{ d.m569.address }}</span></td>
								<td>{{ d.m915 ? 'S' + d.m915.s + ' F' + d.m915.filter + ' H' + d.m915.h : '--' }}</td>
								<td>{{ fmt(m.speedMaxMeasurement, 0) }}</td>
								<td>{{ d.currentMax == null ? '--' : fmt(d.currentMax, 0) }}</td>
								<td>{{ d.stallGuardMin == null ? '--' : d.stallGuardMin }}</td>
								<td>
									<span v-if="!d.state" class="text-medium-emphasis">{{ $t('plugins.WorkshopMotors.common.no_data') }}</span>
									<v-chip v-else-if="!d.state.alerts.length && !d.state.gstatError" size="x-small" variant="outlined" color="success">{{ $t('plugins.WorkshopMotors.charts.ok') }}</v-chip>
									<v-chip v-for="a in (d.state ? d.state.alerts : [])" :key="a" size="x-small" variant="outlined" color="warning" class="mr-1">{{ a }}</v-chip>
								</td>
								<td>
									<span v-if="!d.alerts.length" class="text-medium-emphasis">{{ $t('plugins.WorkshopMotors.charts.none') }}</span>
									<span v-else>{{ d.alerts.map(ev => faultLabel(ev.key)).join(', ') }}</span>
								</td>
							</tr>
						</template>
					</tbody>
				</v-table>
			</div>
			<div class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopMotors.charts.speeds_in_mm_min_acceleration_in') }}</div>
		</template>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { i18n, sendCode } from './dwc-host.js'
import DetailChart from './DetailChart.vue'
import { catalog as catalogOf, points, summarySerial, commandsReport, armReport, reportText, reportCsv, nameFile, alertsSince, motorsConfig } from './charts.js'
import { historyOf, R } from './record.js'
import { faultLabel } from './faults.js'
import { seriesColor, REFERENCE_COLOR } from './chart-data.js'

const SEL_KEY = 'workshopMotorsChartSel'
const SPAN_KEY = 'workshopMotorsChartSpan'
const SPANS = [1, 5, 15, 30, 60]

function readLocal(k, def) {
	try {
		const v = JSON.parse(localStorage.getItem(k))
		return v == null ? def : v
	} catch (e) {
		return def
	}
}
function saveLocal(k, v) {
	try {
		localStorage.setItem(k, JSON.stringify(v))
	} catch (e) {
		// without localStorage
	}
}

function withTime(p, ms) {
	let t
	return Promise.race([
		p.finally(() => clearTimeout(t)),
		new Promise((resolve, reject) => { t = setTimeout(() => reject(new Error(i18n.t('plugins.WorkshopMotors.charts.no_reply_in_s', { s: Math.round(ms / 1000) }))), ms) })
	])
}

const props = defineProps({
	report: { type: Object, default: null },
	om: { type: Object, default: null },
	ceiling: { type: Object, default: null }, // the step ceiling measured on this board (its line on the board pulses)
	// { ids, at }: series to show, chosen in another section (Details > See in Charts)
	preselect: { type: Object, default: null }
})

const theme = useTheme()

const now = ref(Date.now())
const sel = ref(readLocal(SEL_KEY, null))
const spanMin = ref(SPANS.indexOf(readLocal(SPAN_KEY, 5)) >= 0 ? readLocal(SPAN_KEY, 5) : 5)
const columns = ref(2)
const reading = ref(false)
const slow = ref(false)
const progress = ref('')
const errorRep = ref(null)
const rep = ref(null)
let clock = null

const catalog = computed(() => catalogOf(props.report, props.om, props.ceiling))
// the series color of the theme of DWC (light / dark steps of the same blue)
const color = computed(() => seriesColor(!!(theme && theme.global.current.value.dark)))
// the window of every chart: the period chosen, ending now (a clock of 1 s moves it even when no data arrive)
const since = computed(() => now.value - spanMin.value * 60000)
const alertRows = computed(() => {
	void R.tick
	return alertsSince(historyOf.alerts, since.value).slice().reverse()
})
const itemsSelector = computed(() => {
	const out = []
	let group = null
	for (const s of catalog.value) {
		if (s.group !== group) {
			group = s.group
			out.push({ type: 'subheader', title: group })
		}
		out.push(s)
	}
	return out
})
const charts = computed(() => {
	void R.tick
	const byId = {}
	catalog.value.forEach(s => { byId[s.id] = s })
	return (sel.value || []).filter(id => byId[id]).map(id => ({
		serial: byId[id],
		pts: points(historyOf.h, id, since.value, 600),
		summary: summarySerial(historyOf.h, id, since.value)
	}))
})
const minutesData = computed(() => {
	void R.tick
	const t0 = historyOf.h.t.length ? historyOf.h.t[0] : Date.now()
	return Math.max(0, Math.round((Date.now() - t0) / 60000))
})
const historyShort = computed(() => minutesData.value < spanMin.value)
const totalDrivers = computed(() => rep.value ? rep.value.motors.reduce((n, m) => n + m.drivers.length, 0) : 0)
const withoutResponse = computed(() => {
	if (!rep.value) {
		return 0
	}
	return Object.values(rep.value.rrf).filter(v => /^\(error|^$/.test(String(v || ''))).length
})

watch(() => props.preselect, p => {
	if (p && Array.isArray(p.ids) && p.ids.length) {
		sel.value = p.ids.slice()
	}
}, { immediate: true })
watch(sel, v => saveLocal(SEL_KEY, v))
watch(spanMin, v => saveLocal(SPAN_KEY, v))
watch(catalog, c => {
	// first time: the speed of each axis
	if (sel.value === null && c.length > 1) {
		sel.value = c.filter(s => s.kind === 'speed' && /^axis:[^E]/.test(s.id)).map(s => s.id) // axes, not extruders
	}
}, { immediate: true })

onMounted(() => {
	clock = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => clearInterval(clock))

function fmt(v, dec) {
	if (typeof v !== 'number' || !isFinite(v)) {
		return '--'
	}
	const d = dec == null ? (Math.abs(v) >= 100 ? 0 : 1) : dec
	return v.toFixed(d)
}
function hourShort(t) {
	return new Date(t).toLocaleTimeString()
}
function addKind(kinds) {
	const list = Array.isArray(kinds) ? kinds : [kinds]
	const added = catalog.value.filter(s => list.indexOf(s.kind) >= 0).map(s => s.id)
	sel.value = Array.from(new Set((sel.value || []).concat(added)))
}
function addTodo() {
	sel.value = catalog.value.map(s => s.id)
}
function remove(id) {
	sel.value = (sel.value || []).filter(x => x !== id)
}
// the report commands are not written to the console log
function sendQuiet(code) {
	return sendCode({ code, log: false })
}
async function generate() {
	reading.value = true
	slow.value = false
	errorRep.value = null
	const ids = []
	for (const m of motorsConfig(props.om)) {
		for (const id of m.drivers) {
			if (ids.indexOf(id) < 0) {
				ids.push(id)
			}
		}
	}
	const cmds = commandsReport(ids)
	const rrf = {}
	try {
		for (let i = 0; i < cmds.length; i++) {
			progress.value = cmds[i] + ' (' + (i + 1) + '/' + cmds.length + ')'
			const notice = setTimeout(() => { slow.value = true }, 15000)
			try {
				rrf[cmds[i]] = String(await withTime(sendQuiet(cmds[i]), 30000) || '').trim()
			} catch (e) {
				rrf[cmds[i]] = i18n.t('plugins.WorkshopMotors.charts.error_paren', { error: e.message || String(e) })
			} finally {
				clearTimeout(notice)
				slow.value = false
			}
		}
		const ahora = Date.now()
		const from = ahora - spanMin.value * 60000
		rep.value = armReport({
			om: props.om, report: props.report, history: historyOf.h, since: from, now: ahora,
			alerts: alertsSince(historyOf.alerts, from), rrf
		})
	} catch (e) {
		errorRep.value = i18n.t('plugins.WorkshopMotors.charts.could_not_build_the_report') + (e.message || e)
	} finally {
		reading.value = false
		progress.value = ''
	}
}
function download(kind) {
	if (!rep.value) {
		return
	}
	let data
	let mime
	if (kind === 'csv') {
		data = reportCsv(rep.value)
		mime = 'text/csv'
	} else if (kind === 'json') {
		data = JSON.stringify(rep.value, null, 1)
		mime = 'application/json'
	} else {
		data = reportText(rep.value)
		mime = 'text/plain'
	}
	const url = URL.createObjectURL(new Blob([data], { type: mime + ';charset=utf-8' }))
	const a = document.createElement('a')
	a.href = url
	a.download = nameFile('motors', kind, rep.value.generated)
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	setTimeout(() => URL.revokeObjectURL(url), 2000)
}
</script>

<style scoped>
.chart-card {
	border: 1px solid rgba(128, 128, 128, 0.2);
	border-radius: 8px;
	padding: 6px 10px 4px;
}
.table-scroll {
	overflow-x: auto;
}
/* the dashed reference line, drawn in the caption instead of a legend box */
.chart-dash {
	display: inline-block;
	width: 18px;
	border-top: 2px dashed;
	vertical-align: middle;
}
.table-scroll td,
.table-scroll th {
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}
</style>
