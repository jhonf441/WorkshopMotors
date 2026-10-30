<template>
	<div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-body-medium text-medium-emphasis mb-3">{{ $t('plugins.WorkshopMotors.advisor.intro') }}</div>
		</details>

		<!-- Advice -->
		<div class="tips">
			<div v-for="(c, k) in tips" :key="k" class="tip" :class="'c-' + c.level">
				<v-icon size="small" class="mr-2 mt-1" :color="colorLevel(c.level)">{{ iconLevel(c.level) }}</v-icon>
				<div>
					<div class="text-body-medium font-weight-medium">{{ c.title }}</div>
					<div class="text-body-medium text-grey-lighten-1">{{ c.text }}</div>
					<div v-if="c.line" class="line-cfg mt-1">
						<code>{{ c.line }}</code>
						<span class="text-body-small text-medium-emphasis ml-2">{{ $t('plugins.WorkshopMotors.advisor.in') }} <code>{{ c.file }}</code></span>
						<v-btn size="x-small" icon :title="$t('plugins.WorkshopMotors.advisor.copy_line')" :aria-label="$t('plugins.WorkshopMotors.advisor.copy_line')" @click="copy(c.line)">
							<v-icon size="x-small" :color="copied === c.line ? 'success' : undefined">{{ copied === c.line ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
						</v-btn>
						<span v-if="copyFailed === c.line" class="text-body-small text-warning">{{ $t('plugins.WorkshopMotors.advisor.copy_failed') }}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Limits: the ones in use now and the ones of each mode file -->
		<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.advisor.limits') }}</div>
		<div style="overflow-x:auto">
			<table class="table-modes">
				<thead>
					<tr>
						<th>{{ $t('plugins.WorkshopMotors.common.mode') }}</th><th>{{ $t('plugins.WorkshopMotors.common.axis') }}</th><th>{{ $t('plugins.WorkshopMotors.common.max_speed') }}</th><th>{{ $t('plugins.WorkshopMotors.common.acceleration') }}</th><th>{{ $t('plugins.WorkshopMotors.common.jerk') }}</th>
						<th :title="$t('plugins.WorkshopMotors.advisor.distance_needed_to_reach_max_speed')">{{ $t('plugins.WorkshopMotors.advisor.reaches_speed_in') }}</th>
						<th :title="$t('plugins.WorkshopMotors.advisor.pulses_per_second_of_each_motor')">{{ $t('plugins.WorkshopMotors.advisor.pulses_at_max_speed') }}</th>
						<th v-if="showVoltage" :title="$t('plugins.WorkshopMotors.advisor.estimate_of_how_much_of_the')">{{ $t('plugins.WorkshopMotors.advisor.voltage_used') }}</th>
					</tr>
				</thead>
				<tbody>
					<template v-for="g in groups" :key="g.id">
						<tr v-for="(f, idx) in g.rows" :key="g.id + f.axis" :class="{ 'mode-current': g.id === 'now' }">
							<td v-if="idx === 0" :rowspan="g.rows.length" class="mode-cell">
								{{ g.name }}<div v-if="g.note" class="text-body-small" :class="g.id === 'now' ? 'text-success' : 'text-medium-emphasis'">{{ g.note }}</div>
							</td>
							<td>{{ f.axis }}</td>
							<td>{{ f.v != null ? f.v.toFixed(0) + ' mm/s' : '--' }}</td>
							<td>{{ f.a != null ? f.a.toFixed(0) + ' mm/s²' : '--' }}</td>
							<td>{{ f.j != null ? (f.j / 60).toFixed(1) + ' mm/s' : '--' }}</td>
							<td :class="f.dArrives > 60 ? 'text-warning' : ''">{{ f.dArrives != null ? f.dArrives.toFixed(0) + ' mm' : '--' }}</td>
							<td>
								{{ f.hz != null ? (f.hz / 1000).toFixed(1) + ' kHz' : '--' }}
								<span v-if="f.pctRef != null" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopMotors.advisor.pct_ref', { pct: f.pctRef.toFixed(0) }) }}</span>
							</td>
							<td v-if="showVoltage" :class="f.pctV > 90 ? 'text-error' : (f.pctV > 70 ? 'text-warning' : '')">
								{{ f.pctV != null ? f.pctV.toFixed(0) + '%' : '--' }}
							</td>
						</tr>
					</template>
				</tbody>
			</table>
		</div>
		<div v-if="loading" class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopMotors.advisor.reading_sys_mode_g') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-body-small text-medium-emphasis mt-1">
			{{ $t('plugins.WorkshopMotors.advisor.table_note') }}
		</div>
		</details>

		<!-- Motor data -->
		<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.advisor.your_motors_data') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-body-small text-medium-emphasis mb-2">
			{{ $t('plugins.WorkshopMotors.advisor.motor_data_note', { v: vin.toFixed(0) }) }}
		</div>
		</details>
		<div style="overflow-x:auto">
			<table class="table-motor">
				<thead>
					<tr><th>{{ $t('plugins.WorkshopMotors.advisor.for') }}</th><th>{{ $t('plugins.WorkshopMotors.advisor.model') }}</th><th>{{ $t('plugins.WorkshopMotors.advisor.rated_current_a') }}</th><th>{{ $t('plugins.WorkshopMotors.advisor.inductance_mh') }}</th><th>{{ $t('plugins.WorkshopMotors.advisor.torque_n_cm') }}</th><th>{{ $t('plugins.WorkshopMotors.advisor.steps_per_rev') }}</th><th></th></tr>
				</thead>
				<tbody>
					<tr v-for="f in rowsMotor" :key="f.key" :class="{ 'sub-row': f.level === 2 }">
						<td class="purpose">
							<b>{{ f.title }}</b>
							<div class="text-medium-emphasis text-body-small">{{ f.sub }}</div>
						</td>
						<template v-if="f.own">
							<td><v-text-field v-model="motorForm[f.key].model" density="compact" variant="outlined" hide-details :placeholder="$t('plugins.WorkshopMotors.advisor.optional')" /></td>
							<td><v-text-field v-model="motorForm[f.key].current_a" type="number" step="0.1" density="compact" variant="outlined" hide-details /></td>
							<td><v-text-field v-model="motorForm[f.key].inductance_mh" type="number" step="0.1" density="compact" variant="outlined" hide-details /></td>
							<td><v-text-field v-model="motorForm[f.key].torque_ncm" type="number" step="1" density="compact" variant="outlined" hide-details /></td>
							<td><v-text-field v-model="motorForm[f.key].steps_per_rev" type="number" :title="$t('plugins.WorkshopMotors.advisor.steps_per_rev_tip')" step="200" min="24" max="1000" placeholder="200" density="compact" variant="outlined" hide-details /></td>
							<td><v-btn v-if="f.key !== 'general'" size="x-small" variant="text" @click="removeOwn(f.key)">{{ $t('plugins.WorkshopMotors.advisor.use_inherited', { what: f.inherits }) }}</v-btn></td>
						</template>
						<template v-else>
							<td colspan="5" class="text-medium-emphasis">{{ $t('plugins.WorkshopMotors.advisor.uses_inherited', { what: f.inherits }) }}{{ f.summary ? ': ' + f.summary : '' }}</td>
							<td><v-btn size="x-small" variant="text" color="primary" @click="doOwn(f.key)">{{ $t('plugins.WorkshopMotors.advisor.own_data') }}</v-btn></td>
						</template>
					</tr>
				</tbody>
			</table>
		</div>
		<v-btn size="small" color="primary" class="mt-2" :loading="savingMotor" @click="saveMotor()">{{ $t('plugins.WorkshopMotors.common.save') }}</v-btn>
		<div v-if="motorMsg" class="text-body-small mt-1" :class="motorMsgError ? 'text-error' : 'text-success'">{{ motorMsg }}</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { i18n } from './dwc-host.js'
import { settings } from './settings.js' // shared settings files with revision (vue/_shared)
import { MODE_FILES, limitsOfFile, activeLimits, limitRow, bestTests, fileForLines, advice, copyText, formFromMotorFile, motorFileFromForm } from './advisor.js'

const MOTOR_FILE = '0:/sys/workshop/config/motors.json'
// readable driver id: DWC's store gives {board, driver} objects
const drvId = d => (d && typeof d === 'object' && d.board != null ? d.board + '.' + d.driver : String(d))
const COPIED_MS = 1500

async function readFile(path) {
	const r = await fetch('/machine/file/' + encodeURIComponent(path), { cache: 'no-store' })
	if (!r.ok) {
		throw new Error('HTTP ' + r.status)
	}
	return r.text()
}

const props = defineProps({
	report: { type: Object, default: null },
	axes: { type: Array, default: () => [] },
	modeCurrent: { type: String, default: '' },
	vin: { type: Number, default: 24 },
	tests: { type: Array, default: () => [] },
	ceiling: { type: Object, default: null } // pulse ceiling measured in Measure
})

const loading = ref(true)
const modes = ref({}) // the limits of each mode file found (sys/mode*.g)
// Request 2026-10-09: "the motor data should be able to be per motor and per axis if they are different"
// (advisor.js formFromMotorFile: 'general', 'axis:Z', 'drv:0.5'; motor -> its axis -> general)
const motorForm = ref(formFromMotorFile({}))
const savingMotor = ref(false)
const motorMsg = ref(null)
const motorMsgError = ref(false)
const copied = ref(null)
const copyFailed = ref(null)
let copiedTimer = null

const rowsMotor = computed(() => {
	const rows = [{ key: 'general', title: i18n.t('plugins.WorkshopMotors.advisor.general'), sub: i18n.t('plugins.WorkshopMotors.advisor.every_motor_without_its_own_data'), own: true, level: 0 }]
	const res = d => {
		const c = parseFloat(d && d.current_a)
		return c > 0 ? (d.model ? d.model + ', ' : '') + c + ' A' : ''
	}
	props.axes.forEach(a => {
		const k = 'axis:' + a.letter
		const drv = (a.drivers || []).map(drvId)
		rows.push({
			key: k, title: i18n.t('plugins.WorkshopMotors.advisor.axis_name', { axis: a.letter }), level: 1,
			sub: drv.length > 1 ? i18n.t('plugins.WorkshopMotors.advisor.n_motors_drivers', { n: drv.length, list: drv.join(', ') }) : (drv[0] ? 'driver ' + drv[0] : ''),
			own: !!motorForm.value[k], inherits: i18n.t('plugins.WorkshopMotors.advisor.the_general_one'), summary: res(motorForm.value.general)
		})
		if (drv.length > 1) {
			drv.forEach(d => {
				const kd = 'drv:' + d
				const parent = motorForm.value[k] ? motorForm.value[k] : motorForm.value.general
				rows.push({
					key: kd, title: 'Motor ' + d, level: 2, sub: i18n.t('plugins.WorkshopMotors.advisor.of_axis_name', { axis: a.letter }),
					own: !!motorForm.value[kd], parentAxis: motorForm.value[k] ? a.letter : null, inherits: motorForm.value[k] ? i18n.t('plugins.WorkshopMotors.advisor.the_one_of_axis_name', { axis: a.letter }) : i18n.t('plugins.WorkshopMotors.advisor.the_general_one'), summary: res(parent)
				})
			})
		}
	})
	return rows
})
const refHz = computed(() => {
	// reference pulse rate: the one MEASURED on this board (Measure) or, if
	// there is none, dc42's (1 motor) according to the driver timing
	if (props.ceiling && props.ceiling.khz_per_motor > 0) {
		return props.ceiling.khz_per_motor * 1000
	}
	for (const e of (props.report && props.report.entries) || []) {
		for (const d of e.drivers || []) {
			if (d.m569 && d.m569.dc42_ref) {
				return d.m569.dc42_ref.a_motor_length_khz * 1000
			}
		}
	}
	return null
})
// the data of each motor of each axis (motor -> its axis -> general)
const motorsByAxis = computed(() => {
	const out = {}
	props.axes.forEach(a => {
		const drv = (a.drivers || []).map(drvId)
		out[a.letter] = drv.length ? drv.map(d => motorOf(a.letter, d)) : [motorOf(a.letter)]
	})
	return out
})
// The table: the limits in use NOW (object model) first, then the ones of each mode file the machine has
const groups = computed(() => {
	const rowsOf = limits => props.axes.map(a => limitRow(limits, a.letter, a, refHz.value, motorsByAxis.value[a.letter], props.vin)).filter(f => f.v != null)
	const out = [{ id: 'now', name: i18n.t('plugins.WorkshopMotors.advisor.now'), note: i18n.t('plugins.WorkshopMotors.advisor.now_note'), rows: rowsOf(activeLimits(props.axes)) }]
	Object.keys(MODE_FILES).filter(m => modes.value[m]).forEach(m => {
		out.push({ id: m, name: nameMode(m), note: m === props.modeCurrent ? i18n.t('plugins.WorkshopMotors.advisor.in_use') : '', rows: rowsOf(modes.value[m]) })
	})
	return out.filter(g => g.rows.length)
})
const showVoltage = computed(() => groups.value.some(g => g.rows.some(f => f.pctV != null)))
const tips = computed(() => {
	const rows = {}
	const now = groups.value.find(g => g.id === 'now')
	;(now ? now.rows : []).forEach(f => { rows[f.axis] = f })
	return advice({
		report: props.report, axes: props.axes, motors: motorsByAxis.value, rows, tests: bestTests(props.tests),
		mode: props.modeCurrent, file: fileForLines(props.modeCurrent, modes.value), vin: props.vin
	})
})

onMounted(() => load())
onBeforeUnmount(() => clearTimeout(copiedTimer))

function nameMode(m) {
	return { Laser: i18n.t('plugins.WorkshopMotors.advisor.laser'), CNC: 'CNC', FFF: i18n.t('plugins.WorkshopMotors.common.3d_printing') }[m] || m
}
async function load() {
	loading.value = true
	const found = {}
	for (const m of Object.keys(MODE_FILES)) {
		try {
			found[m] = limitsOfFile(await readFile('0:/sys/' + MODE_FILES[m]))
		} catch (e) {
			// a machine without that mode file: only the limits in use
		}
	}
	modes.value = found
	try {
		applyMotor(JSON.parse(await readFile(MOTOR_FILE)))
	} catch (e) {
		applyMotor({})
	}
	loading.value = false
}
function applyMotor(j) {
	motorForm.value = formFromMotorFile(j)
}
function dataMotor(d) {
	const c = parseFloat(d && d.current_a)
	return {
		valid: c > 0,
		current_a: c,
		inductance_mh: parseFloat(d && d.inductance_mh) || null,
		torque_ncm: parseFloat(d && d.torque_ncm) || null,
		steps_per_rev: parseInt(d && d.steps_per_rev, 10) || null,
		model: (d && d.model) || ''
	}
}
// effective data of a motor (driver) of an axis: motor -> axis -> general
function motorOf(axis, drv) {
	const f = motorForm.value
	return dataMotor((drv && f['drv:' + drv]) || f['axis:' + axis] || f.general)
}
function doOwn(key) {
	// a motor of an axis with its own data starts from that axis, otherwise from the general data
	const row = key.indexOf('drv:') === 0 ? rowsMotor.value.find(x => x.key === key) : null
	let src = motorForm.value.general
	if (row && row.parentAxis) {
		src = motorForm.value['axis:' + row.parentAxis] || src
	}
	motorForm.value[key] = Object.assign({}, src)
}
function removeOwn(key) {
	delete motorForm.value[key]
}
async function saveMotor() {
	savingMotor.value = true
	motorMsg.value = null
	try {
		// through the settings store with revision (vue/_shared/settings.js): the service keeps a .bak, and if someone else saved
		// meanwhile it says so ("another person changed this") instead of erasing their work
		await settings.save('motors', () => motorFileFromForm(motorForm.value))
		// check by reading it back (a save may not apply without an error)
		applyMotor((await settings.load('motors')).value || {})
		motorMsg.value = i18n.t('plugins.WorkshopMotors.advisor.saved')
		motorMsgError.value = false
	} catch (e) {
		motorMsg.value = i18n.t('plugins.WorkshopMotors.common.could_not_save') + e.message
		motorMsgError.value = true
	} finally {
		savingMotor.value = false
	}
}
function colorLevel(n) {
	return { error: 'error', notice: 'warning', ok: 'success', info: 'info' }[n]
}
function iconLevel(n) {
	return { error: 'mdi-alert-octagon', notice: 'mdi-alert', ok: 'mdi-check-circle', info: 'mdi-information' }[n]
}
// the button shows a check for a moment; without a clipboard it says to select the line by hand
async function copy(line) {
	const ok = await copyText(line)
	copied.value = ok ? line : null
	copyFailed.value = ok ? null : line
	clearTimeout(copiedTimer)
	copiedTimer = setTimeout(() => { copied.value = null }, COPIED_MS)
}
</script>

<style scoped>
.table-motor {
	width: 100%;
	border-collapse: collapse;
	font-size: 13px;
}
.table-motor th {
	text-align: left;
	font-weight: 500;
	color: var(--tp-faint, #9e9e9e);
	padding: 4px 6px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.3);
	white-space: nowrap;
}
.table-motor td {
	padding: 4px 6px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.12);
	min-width: 90px;
}
.table-motor td.purpose {
	white-space: nowrap;
}
.table-motor tr.sub-row td.purpose {
	padding-left: 22px;
}
.tip {
	display: flex;
	align-items: flex-start;
	padding: 8px 10px;
	border-radius: 6px;
	margin-bottom: 6px;
	background: rgba(128, 128, 128, 0.08);
	border-left: 3px solid transparent;
}
.c-error { border-left-color: #EF5350; }
.c-notice { border-left-color: #FFA726; }
.c-ok { border-left-color: #66BB6A; }
.c-info { border-left-color: #29B6F6; }
.line-cfg code {
	font-size: 12px;
}
.table-modes {
	width: 100%;
	border-collapse: collapse;
	font-size: 13px;
}
.table-modes th {
	text-align: left;
	font-weight: 500;
	color: var(--tp-faint, #9e9e9e);
	padding: 4px 8px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.3);
	white-space: nowrap;
}
.table-modes td {
	padding: 4px 8px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.12);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}
.mode-current td {
	background: rgba(102, 187, 106, 0.06);
}
.mode-cell {
	vertical-align: top;
	font-weight: 500;
}
</style>
