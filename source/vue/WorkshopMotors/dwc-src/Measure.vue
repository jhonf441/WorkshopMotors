<template>
	<div>
		<!-- ===================== Step ceiling ===================== -->
		<div class="text-title-medium mb-1"><v-icon size="small" class="mr-1">mdi-pulse</v-icon>{{ $t('plugins.WorkshopMotors.measure.your_board_s_pulse_ceiling') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="explica text-body-medium">
			<v-icon size="small" color="info" class="mr-1">mdi-information</v-icon>
			{{ $t('plugins.WorkshopMotors.measure.ceiling_intro', { micro: MICRO }) }} <b>hiccups</b> {{ $t('plugins.WorkshopMotors.measure.pulses_it_didn_t_generate_in') }}
		</div>
		</details>
		<div class="d-flex flex-wrap mt-3" style="gap:6px">
			<v-chip v-for="r in reqCeiling" :key="r.text" size="small" :color="r.ok ? 'success' : 'error'" variant="outlined">
				<v-icon size="x-small" start>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
			</v-chip>
		</div>
		<v-alert v-if="globals.workshopCeilingPending" density="compact" type="warning" class="mt-3 mb-0" variant="outlined">
			{{ $t('plugins.WorkshopMotors.measure.previous_measurement_interrupted', { axis: globals.workshopCeilingAxis }) }}
			<v-btn size="x-small" color="warning" class="ml-2" :loading="restoring" @click="restoreCeiling()">{{ $t('plugins.WorkshopMotors.measure.restore') }}</v-btn>
		</v-alert>
		<v-row density="compact" class="mt-3">
			<v-col cols="12" sm="3">
				<v-btn-toggle v-model="axisT" mandatory density="compact" color="primary">
					<v-btn v-for="a in axes" :key="a.letter" size="small" :value="a.letter">{{ a.letter }}</v-btn>
				</v-btn-toggle>
			</v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="kSince" :label="$t('plugins.WorkshopMotors.measure.from_khz')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="kUntil" :label="$t('plugins.WorkshopMotors.measure.to_khz')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="kStep" :label="$t('plugins.WorkshopMotors.measure.step_khz')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="distT" :label="$t('plugins.WorkshopMotors.common.travel_mm')" type="number" density="compact" variant="outlined" hide-details /></v-col>
		</v-row>
		<div class="text-body-small text-medium-emphasis mt-1">
			{{ $t('plugins.WorkshopMotors.measure.khz_per_motor_n_steps', { n: segments.filter(t => t.ok).length }) }}
			<span v-if="segments.some(t => !t.ok)" class="text-warning">
				{{ $t('plugins.WorkshopMotors.measure.steps_over_max_speed', { khz: (segments.find(t => !t.ok) || {}).khz }) }}
			</span>.
			<span v-if="axisOM && motorsAxis > 1">{{ $t('plugins.WorkshopMotors.measure.axis_has_n_motors', { axis: axisT, n: motorsAxis }) }}</span>
		</div>
		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<v-btn size="small" :color="armedT ? 'amber-darken-3' : 'primary'" :disabled="!canCeiling || runningT" @click="touchCeiling()">
				<v-icon start>{{ armedT ? 'mdi-alert' : 'mdi-play' }}</v-icon>
				{{ armedT ? $t('plugins.WorkshopMotors.common.tap_again_the_machine_will_move') : $t('plugins.WorkshopMotors.measure.measure_the_ceiling') }}
			</v-btn>
			<v-btn size="small" v-if="runningT" variant="outlined" color="warning" :disabled="stopT" @click="stopT = true">
				{{ stopT ? $t('plugins.WorkshopMotors.measure.it_stops_after_this_step') : $t('plugins.WorkshopMotors.measure.stop_after_this_step') }}
			</v-btn>
			<span v-if="runningT" class="text-body-medium">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />{{ stateT }}
			</span>
		</div>
		<v-alert v-if="msgT" density="compact" variant="outlined" :type="kindT" class="mt-3 mb-0">{{ msgT }}</v-alert>
		<div v-if="ceiling" class="mt-3 text-body-medium">
			<b>{{ $t('plugins.WorkshopMotors.measure.measured') }}</b> {{ $t('plugins.WorkshopMotors.measure.khz_per_motor_value', { khz: ceiling.khz_per_motor }) }}
			<span class="text-medium-emphasis">
				{{ $t('plugins.WorkshopMotors.measure.ceiling_detail', { date: ceiling.date, axis: ceiling.axis, micro: ceiling.micro }) }}<span v-if="ceiling.khz_fault">, {{ $t('plugins.WorkshopMotors.measure.with_hiccups_from', { khz: ceiling.khz_fault }) }}</span>,
				firmware {{ ceiling.firmware || '?' }}).
			</span>
			{{ $t('plugins.WorkshopMotors.measure.it_s_used_as_the_reference') }}
			<!-- deletes the measured file: second tap to confirm (DESIGN.md, "Confirm delete") -->
			<v-btn size="x-small" :variant="armedDelete ? 'flat' : 'text'" :color="armedDelete ? 'error' : undefined" @click="touchDelete()">
				{{ armedDelete ? $t('plugins.WorkshopMotors.measure.tap_again_back_to_dc42') : $t('plugins.WorkshopMotors.measure.back_to_dc42_s_table') }}
			</v-btn>
		</div>
		<references :ceiling="ceiling" :report="report" />

		<v-divider class="my-5" />

		<!-- ===================== Corriente ===================== -->
		<div class="text-title-medium mb-1"><v-icon size="small" class="mr-1">mdi-current-dc</v-icon>{{ $t('plugins.WorkshopMotors.measure.real_current_of_each_motor_with') }}</div>
		<div class="explica text-body-medium">
			<v-icon size="small" color="info" class="mr-1">mdi-information</v-icon>
			{{ $t('plugins.WorkshopMotors.measure.what_the_page_shows_is_the') }} <b>{{ $t('plugins.WorkshopMotors.measure.configured') }}</b> {{ $t('plugins.WorkshopMotors.measure.value_m906_not_a_measurement_the') }} <b>{{ $t('plugins.WorkshopMotors.measure.dc_clamp_meter') }}</b>{{ $t('plugins.WorkshopMotors.measure.with_the_motor_still_each_coil') }}
			<b>{{ $t('plugins.WorkshopMotors.measure.never') }}</b> {{ $t('plugins.WorkshopMotors.measure.open_a_motor_wire_with_the') }}
		</div>
		<!-- the page was closed or reloaded with the motors still at full current at rest -->
		<v-alert v-if="idleLeft != null && !prepared" density="compact" variant="outlined" type="warning" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopMotors.measure.idle_left_at_100', { pct: idleLeft }) }}
			<v-btn size="x-small" color="warning" class="ml-2" :loading="preparing" :disabled="busy" @click="finishCurrent()">{{ $t('plugins.WorkshopMotors.measure.restore') }}</v-btn>
		</v-alert>
		<v-row density="compact" class="mt-3">
			<v-col cols="12" sm="4">
				<v-select v-model="motorSel" :items="motorsList" item-title="text" item-value="key" :label="$t('plugins.WorkshopMotors.common.motor')" density="compact" variant="outlined" hide-details />
			</v-col>
			<v-col cols="12" sm="8" class="d-flex align-center flex-wrap" style="gap:8px">
				<!-- level 2 (DESIGN.md: heats): double tap -->
				<v-btn v-if="!prepared" :color="armedPrepare ? 'amber-darken-3' : 'primary'" size="small" :disabled="!motorChosen || busy || state === 'off'" :loading="preparing" @click="touchPrepare()">
					{{ armedPrepare ? $t('plugins.WorkshopMotors.measure.tap_again_energize') : $t('plugins.WorkshopMotors.measure.1_energize_at_100') }}
				</v-btn>
				<v-btn v-else size="small" variant="outlined" color="warning" :loading="preparing" @click="finishCurrent()">{{ $t('plugins.WorkshopMotors.measure.finish_idle_reduction_comes_back') }}</v-btn>
				<span v-if="prepared" class="text-body-small text-success">{{ $t('plugins.WorkshopMotors.measure.motors_energized_at_100_no_idle') }}</span>
			</v-col>
		</v-row>
		<div v-if="motorChosen" class="mt-2 text-body-medium">
			{{ $t('plugins.WorkshopMotors.measure.configured_2') }} <b>{{ motorChosen.ma }} mA</b> {{ $t('plugins.WorkshopMotors.measure.rms_expected_peak') }} <b>{{ peakExpected }} mA</b>.
			{{ $t('plugins.WorkshopMotors.measure.clamp_hint', { ma: peakExpected }) }}
		</div>
		<v-row density="compact" class="mt-2">
			<v-col cols="6" sm="2"><v-text-field v-model.number="medA" :label="$t('plugins.WorkshopMotors.measure.coil_a_ma')" type="number" density="compact" variant="outlined" hide-details :disabled="!prepared" /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="medB" :label="$t('plugins.WorkshopMotors.measure.coil_b_ma')" type="number" density="compact" variant="outlined" hide-details :disabled="!prepared" /></v-col>
			<v-col cols="12" sm="8" class="d-flex align-center flex-wrap" style="gap:8px">
				<span v-if="resultCorrection" :class="Math.abs(resultCorrection.deviation) <= 10 ? 'text-success' : 'text-warning'">
					{{ $t('plugins.WorkshopMotors.measure.measured_peak_rms', { peak: resultCorrection.peakMa, rms: resultCorrection.rmsMa, dev: (resultCorrection.deviation >= 0 ? '+' : '') + resultCorrection.deviation }) }}
				</span>
				<v-btn size="small" color="primary" :disabled="!resultCorrection" @click="saveCurrent()">{{ $t('plugins.WorkshopMotors.common.save') }}</v-btn>
			</v-col>
		</v-row>
		<div class="text-body-small text-medium-emphasis mt-1">
			{{ $t('plugins.WorkshopMotors.measure.up_to_10_is_normal_clamp') }}
		</div>
		<div v-if="currents.length" style="overflow-x:auto" class="mt-2">
			<table class="table-res">
				<thead><tr><th>{{ $t('plugins.WorkshopMotors.common.date') }}</th><th>{{ $t('plugins.WorkshopMotors.common.motor') }}</th><th>{{ $t('plugins.WorkshopMotors.measure.configured_3') }}</th><th>A / B</th><th>{{ $t('plugins.WorkshopMotors.measure.measured_rms') }}</th><th>{{ $t('plugins.WorkshopMotors.common.difference') }}</th></tr></thead>
				<tbody>
					<tr v-for="(c, k) in currents.slice().reverse().slice(0, 20)" :key="k">
						<td>{{ c.date }}</td><td>{{ c.motor }}</td><td>{{ c.configured_ma }} mA</td>
						<td>{{ c.a_ma }} / {{ c.b_ma }} mA</td><td>{{ c.measured_rms_ma }} mA</td>
						<td :class="Math.abs(c.deviation_pct) <= 10 ? 'text-success' : 'text-warning'">{{ c.deviation_pct >= 0 ? '+' : '' }}{{ c.deviation_pct }} %</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n, machineModel, sendCode } from './dwc-host.js'
import References from './References.vue'
import { reserveMotion } from './workshop-api.js'
import { settings } from './settings.js' // shared settings files with revision (vue/_shared): .bak and "another person changed this"
import { sequenceBlock, withReservation, refusedText } from './sequence.js'

const CORRECTION_FILE = '0:/sys/workshop/config/current.json'
const drvId = d => (d && typeof d === 'object' && d.board != null ? d.board + '.' + d.driver : String(d))

async function readJson(path, def) {
	try {
		const r = await fetch('/machine/file/' + encodeURIComponent(path), { cache: 'no-store' })
		if (!r.ok) return def
		return JSON.parse(await r.text())
	} catch (e) {
		return def
	}
}

// The idle current factor (%) to put back after measuring with a clamp. Kept in the browser while the motors are at
// 100 %: if the page is closed or reloaded before "Finish", the next visit offers to restore it.
const IDLE_KEY = 'workshopMotorsIdleOrig'
const ARMED_MS = 4000
const MICRO = 256

function readIdleLeft() {
	try {
		const v = parseInt(localStorage.getItem(IDLE_KEY), 10)
		return v >= 0 && v < 100 ? v : null
	} catch (e) {
		return null
	}
}

function saveIdleLeft(v) {
	try {
		if (v == null) {
			localStorage.removeItem(IDLE_KEY)
		} else {
			localStorage.setItem(IDLE_KEY, String(v))
		}
	} catch (e) {
		// without localStorage: only the reminder after a reload is lost
	}
}

const props = defineProps({
	axes: { type: Array, default: () => [] },
	state: { type: String, default: '' },
	globals: { type: Object, default: () => ({}) },
	report: { type: Object, default: null },
	ceiling: { type: Object, default: null }
})
const emit = defineEmits(['reload'])

const axisT = ref('X')
const kSince = ref(50)
const kUntil = ref(300)
const kStep = ref(25)
const distT = ref(300)
const armedT = ref(false)
const runningT = ref(false)
const stopT = ref(false)
const stateT = ref('')
const msgT = ref(null)
const kindT = ref('info')
const restoring = ref(false)
const armedDelete = ref(false)
// current
const motorSel = ref(null)
const prepared = ref(false)
const preparing = ref(false)
const armedPrepare = ref(false)
let idleOrig = null
const idleLeft = ref(readIdleLeft())
const medA = ref(null)
const medB = ref(null)
const currents = ref([])
let armedTimer = null
let armedDeleteTimer = null
let armedPrepareTimer = null

const busy = computed(() => !!sequenceBlock(machineModel()) || ['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(props.state))
const axisOM = computed(() => props.axes.find(a => a.letter === axisT.value) || null)
const motorsAxis = computed(() => ((axisOM.value && axisOM.value.drivers) || []).length || 1)
// stretches: kHz per motor -> mechanical speed at 1/MICRO
const segments = computed(() => {
	const om = axisOM.value
	if (!om || !(kStep.value > 0) || !(kUntil.value >= kSince.value)) return []
	const micro = (om.microstepping && om.microstepping.value) || 16
	const spmHigh = (om.stepsPerMm || 80) * MICRO / micro
	const out = []
	for (let k = kSince.value; k <= kUntil.value && out.length < 40; k += kStep.value) {
		const speed = Math.round(k * 1000 / spmHigh * 60)
		out.push({ khz: k, speed: speed, ok: speed >= 60 && speed <= (om.speed || 0) })
	}
	return out
})
const reqCeiling = computed(() => {
	const om = axisOM.value
	return [
		{ text: i18n.t('plugins.WorkshopMotors.measure.power_supply_on'), ok: props.state !== 'off' },
		{ text: i18n.t('plugins.WorkshopMotors.measure.home_axis', { axis: axisT.value }), ok: !!(om && om.homed) },
		{ text: (busy.value && sequenceBlock(machineModel())) || i18n.t('plugins.WorkshopMotors.common.no_job_running'), ok: !busy.value },
		{ text: i18n.t('plugins.WorkshopMotors.measure.the_service_counts_hiccups'), ok: !!(props.report && props.report.hiccups_total != null && props.report.m122_seq != null) }
	]
})
const canCeiling = computed(() => reqCeiling.value.every(r => r.ok) && segments.value.some(t => t.ok) && !props.globals.workshopCeilingPending)
const motorsList = computed(() => {
	const out = []
	props.axes.forEach(a => {
		const ds = (a.drivers || []).map(drvId)
		ds.forEach(d => out.push({ key: a.letter + '|' + d, text: ds.length > 1 ? `${a.letter} - motor ${d}` : `${a.letter} (driver ${d})`, axis: a.letter, drv: d, ma: a.current || 0 }))
	})
	return out
})
const motorChosen = computed(() => motorsList.value.find(m => m.key === motorSel.value) || null)
const peakExpected = computed(() => motorChosen.value ? Math.round(motorChosen.value.ma * Math.SQRT2) : 0)
const resultCorrection = computed(() => {
	const a = medA.value
	const b = medB.value
	if (!motorChosen.value || !(a >= 0) || !(b >= 0) || (a === 0 && b === 0) || a === null || b === null) return null
	const peak = Math.sqrt(a * a + b * b)
	const rms = peak / Math.SQRT2
	const configured = motorChosen.value.ma || 1
	return { peakMa: Math.round(peak), rmsMa: Math.round(rms), deviation: Math.round((rms / configured - 1) * 100) }
})

watch(axisT, () => disarm())

onMounted(async () => {
	const c = await readJson(CORRECTION_FILE, [])
	currents.value = Array.isArray(c) ? c : []
	if (!motorSel.value && motorsList.value.length) motorSel.value = motorsList.value[0].key
})
onBeforeUnmount(() => {
	clearTimeout(armedTimer)
	clearTimeout(armedDeleteTimer)
	clearTimeout(armedPrepareTimer)
	if (prepared.value) finishCurrent()
})

// every order of this page is written to the console log
function send(code) {
	return sendCode({ code, log: true })
}
function disarm() {
	armedT.value = false
	clearTimeout(armedTimer)
}
function touchCeiling() {
	if (!armedT.value) {
		armedT.value = true
		clearTimeout(armedTimer)
		armedTimer = setTimeout(() => { armedT.value = false }, 4000)
		return
	}
	disarm()
	const mt = sequenceBlock(machineModel())
	if (mt) {
		kindT.value = 'error'
		msgT.value = mt
		return
	}
	measureCeiling()
}
function waitfor(ms) {
	return new Promise(r => setTimeout(r, ms))
}
// waits for a NEW M122 reading (after seqSince) and returns hiccups_total
async function hiccupsAfter(seqSince) {
	for (let i = 0; i < 40; i++) {
		const r = props.report
		if (r && r.m122_seq > seqSince) return r.hiccups_total
		await waitfor(500)
	}
	throw new Error(i18n.t('plugins.WorkshopMotors.measure.the_service_did_not_read_m122'))
}
async function measureCeiling() {
	runningT.value = true
	stopT.value = false
	msgT.value = null
	const letter = axisT.value
	const todo = segments.value.filter(t => t.ok)
	let ok = null
	let fault = null
	try {
		// the jog and the other pages wait while it runs (WorkshopService motion owner)
		await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.ceiling', { axis: letter }), async () => {
			// base: no hiccups from before
			stateT.value = i18n.t('plugins.WorkshopMotors.measure.waiting_for_an_m122_reading')
			let base = await hiccupsAfter(props.report.m122_seq)
			for (let k = 0; k < todo.length; k++) {
				const t = todo[k]
				// changes the microstep: it is checked again before each stretch
				const mt = sequenceBlock(machineModel())
				if (mt) throw new Error(mt)
				stateT.value = i18n.t('plugins.WorkshopMotors.measure.step_n_of_total', { n: k + 1, total: todo.length, khz: t.khz, v: t.speed, micro: MICRO })
				const reply = await send(`M98 P"0:/sys/workshop/macros/step-ceiling.g" A"${letter}" F${t.speed} D${Math.round(distT.value)} N3 M${MICRO}`)
				if (/error|abort/i.test(reply || '')) throw new Error(reply)
				const total = await hiccupsAfter(props.report.m122_seq)
				const added = total - base
				base = total
				if (added > 0) {
					fault = { ...t, hic: added }
					break
				}
				ok = t
				if (stopT.value) break
			}
		})
		if (ok) {
			const data = {
				date: new Date().toISOString().slice(0, 16).replace('T', ' '),
				axis: letter,
				micro: MICRO,
				motors: motorsAxis.value,
				khz_ok: ok.khz,
				khz_fault: fault ? fault.khz : null,
				// equivalent to ONE motor (like dc42's table): what the board
				// sustained in total (kHz per motor x motors of the axis)
				khz_per_motor: ok.khz * motorsAxis.value,
				khz_board: ok.khz * motorsAxis.value,
				firmware: firmware()
			}
			await settings.save('step-ceiling', () => data)
			emit('reload')
			kindT.value = fault ? 'success' : 'info'
			msgT.value = fault
				? i18n.t('plugins.WorkshopMotors.measure.ceiling_found', { ok: ok.khz, bad: fault.khz, n: fault.hic, axis: letter })
				: i18n.t('plugins.WorkshopMotors.measure.ceiling_not_reached', { ok: ok.khz, axis: letter })
		} else if (fault) {
			kindT.value = 'warning'
			msgT.value = i18n.t('plugins.WorkshopMotors.measure.hiccups_first_step', { khz: fault.khz })
		}
	} catch (e) {
		kindT.value = 'error'
		msgT.value = refusedText(e) || i18n.t('plugins.WorkshopMotors.measure.measurement_interrupted_error', { error: e.message || String(e) })
	} finally {
		runningT.value = false
		stateT.value = ''
	}
}
function firmware() {
	const b = (machineModel().boards || [])[0]
	return b ? b.firmwareVersion : null
}
async function restoreCeiling() {
	restoring.value = true
	try {
		await send('M98 P"0:/sys/workshop/macros/step-ceiling.g" R1')
	} finally {
		restoring.value = false
	}
}
// first tap arms for 4 s, the second deletes the measured ceiling
function touchDelete() {
	if (!armedDelete.value) {
		armedDelete.value = true
		clearTimeout(armedDeleteTimer)
		armedDeleteTimer = setTimeout(() => { armedDelete.value = false }, ARMED_MS)
		return
	}
	armedDelete.value = false
	clearTimeout(armedDeleteTimer)
	deleteCeiling()
}
async function deleteCeiling() {
	// an empty object is "no measured ceiling" (Motors.vue reads khz_per_motor): the old one stays as .bak
	await settings.save('step-ceiling', () => ({}))
	emit('reload')
}
// --- current ---
function touchPrepare() {
	if (!armedPrepare.value) {
		armedPrepare.value = true
		clearTimeout(armedPrepareTimer)
		armedPrepareTimer = setTimeout(() => { armedPrepare.value = false }, ARMED_MS)
		return
	}
	armedPrepare.value = false
	clearTimeout(armedPrepareTimer)
	prepareCurrent()
}
async function prepareCurrent() {
	if (sequenceBlock(machineModel())) return
	preparing.value = true
	try {
		const move = machineModel().move
		const idle = move && move.idle
		// a reduction left over by an unfinished measurement is the real original, not today's 100 %
		idleOrig = idleLeft.value != null ? idleLeft.value : (idle && idle.factor != null ? Math.round(idle.factor * 100) : 30)
		saveIdleLeft(idleOrig)
		await send('M906 I100')
		await send('M17 ' + motorChosen.value.axis)
		prepared.value = true
		medA.value = null
		medB.value = null
	} finally {
		preparing.value = false
	}
}
async function finishCurrent() {
	preparing.value = true
	try {
		const back = idleOrig != null ? idleOrig : (idleLeft.value != null ? idleLeft.value : 30)
		await send('M906 I' + back)
		saveIdleLeft(null)
		idleLeft.value = null
	} finally {
		prepared.value = false
		preparing.value = false
	}
}
async function saveCurrent() {
	const r = resultCorrection.value
	const m = motorChosen.value
	if (!r || !m) return
	const entry = {
		date: new Date().toISOString().slice(0, 16).replace('T', ' '),
		motor: m.text, axis: m.axis, driver: m.drv,
		configured_ma: m.ma, a_ma: medA.value, b_ma: medB.value,
		measured_rms_ma: r.rmsMa, deviation_pct: r.deviation
	}
	// added to the list the service has NOW (another person may have saved a measurement meanwhile)
	const saved = await settings.save('current', cur => (Array.isArray(cur) ? cur : []).concat([entry]))
	currents.value = Array.isArray(saved.value) ? saved.value : currents.value.concat([entry])
}
</script>

<style scoped>
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
.table-res {
	width: 100%;
	border-collapse: collapse;
	font-size: 13px;
}
.table-res th {
	text-align: left;
	font-weight: 500;
	color: var(--tp-faint, #9e9e9e);
	padding: 4px 8px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.3);
	white-space: nowrap;
}
.table-res td {
	padding: 4px 8px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.12);
	white-space: nowrap;
}
</style>
