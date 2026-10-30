<template>
	<div>
		<div class="explica text-body-medium">
			<v-icon size="small" color="info" class="mr-1">mdi-information</v-icon>
			<b>{{ $t('plugins.WorkshopMotors.crash.crash_detection_of_the_jog_without') }}</b> {{ $t('plugins.WorkshopMotors.crash.in_that_mode_the_driver_stallguard') }} <b>{{ $t('plugins.WorkshopMotors.crash.it_does_not_protect_people') }}</b> {{ $t('plugins.WorkshopMotors.crash.nor_does_it_work_to_stop') }}
		</div>

		<!-- How it is configured now -->
		<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crash.how_it_is_now') }}</div>
		<div v-if="!cfg" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopMotors.crash.reading_jog_json') }}</div>
		<template v-else>
			<div class="d-flex flex-wrap" style="gap:16px">
				<div class="data"><div class="datum-t">{{ $t('plugins.WorkshopMotors.crash.maximum_speed_of_the_jog_without') }}</div><div class="datum-v">{{ vMax.toFixed(0) }} mm/s</div></div>
				<div v-for="e in axisRows" :key="e.letter" class="data">
					<div class="datum-t">{{ $t('plugins.WorkshopMotors.crash.axis_detects_from', { axis: e.letter }) }}</div>
					<div class="datum-v" :class="e.threshold > vMax ? 'text-error' : ''">{{ e.threshold.toFixed(0) }} mm/s</div>
				</div>
				<div class="data"><div class="datum-t">{{ $t('plugins.WorkshopMotors.crash.sensitivity') }}</div><div class="datum-v">{{ cfg.crashSens }}</div></div>
				<div class="data"><div class="datum-t">{{ $t('plugins.WorkshopMotors.crash.current_in_mode') }}</div><div class="datum-v">{{ cfg.correctionXY }} %</div></div>
			</div>
			<v-alert v-if="!cfg.crash" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">{{ $t('plugins.WorkshopMotors.crash.crash_detection_is_off_in_the') }}</v-alert>
			<v-alert v-else-if="neverDetects" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">
				{{ $t('plugins.WorkshopMotors.crash.never_measures_1', { v: vMax.toFixed(0) }) }} <b>{{ $t('plugins.WorkshopMotors.crash.never') }}</b> {{ $t('plugins.WorkshopMotors.crash.never_measures_2', { min: thresholdMax.toFixed(0) }) }}
			</v-alert>
			<div v-else class="text-body-small text-medium-emphasis mt-1">
				{{ $t('plugins.WorkshopMotors.crash.only_detects_above', { min: thresholdMax.toFixed(0), pct: Math.ceil(thresholdMax / vMax * 100) }) }}
			</div>
			<v-row density="compact" class="mt-2" align="center">
				<v-col cols="12" sm="6" md="4">
					<v-text-field v-model.number="sinceMms" :label="$t('plugins.WorkshopMotors.crash.detect_from_mm_s')" type="number" min="2" density="compact" variant="outlined" hide-details />
				</v-col>
				<v-col cols="12" sm="6" md="8" class="text-body-small text-medium-emphasis">
					{{ $t('plugins.WorkshopMotors.crash.lower_detects_slow') }}
					<b>{{ $t('plugins.WorkshopMotors.crash.if_you_change_it_recalibrate') }}</b>{{ $t('plugins.WorkshopMotors.crash.old_sensitivity_invalid') }}
				</v-col>
			</v-row>
		</template>

		<!-- Calibrar -->
		<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crash.calibrate_the_sensitivity') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-body-medium">
			{{ $t('plugins.WorkshopMotors.crash.the_axis_goes_back_and_forth') }} <b>{{ $t('plugins.WorkshopMotors.crash.free_space') }}</b> {{ $t('plugins.WorkshopMotors.crash.about_12_cm_around_where_it') }}
		</div>
		</details>
		<!-- 2026-10-10 ("add enough warnings when crash is going to be
configured"): level 4 = leaves the machine without a protection
while it lasts -> fixed warnings + Understood checkbox + notice
while it runs + how to cut it. -->
		<v-alert v-if="pending" density="compact" type="warning" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopMotors.crash.interrupted_1', { axis: pending }) }} <b>{{ $t('plugins.WorkshopMotors.crash.reduced_current') }}</b> {{ $t('plugins.WorkshopMotors.crash.interrupted_2') }}
			<v-btn size="x-small" color="warning" class="ml-2" :loading="restoring" @click="restore()">{{ $t('plugins.WorkshopMotors.common.restore_now') }}</v-btn>
		</v-alert>
		<div class="notices mt-3" :class="{ on: running }">
			<div class="notices-t">
				<v-icon size="small" color="orange-darken-2" class="mr-1">mdi-alert</v-icon>{{ running ? $t('plugins.WorkshopMotors.crash.calibrating_the_machine_moves_by_itself') : $t('plugins.WorkshopMotors.common.before_calibrating_read_this') }}
			</div>
			<ol>
				<li>{{ $t('plugins.WorkshopMotors.crash.the_machine') }} <b>{{ $t('plugins.WorkshopMotors.crash.moves_by_itself') }}</b>{{ $t('plugins.WorkshopMotors.crash.warn_1', { axes: axesSel === 'XY' ? $t('plugins.WorkshopMotors.crash.x_then_y') : axesSel }) }}</li>
				<li><b>{{ $t('plugins.WorkshopMotors.crash.clear_that_path') }}</b>{{ $t('plugins.WorkshopMotors.crash.warn_2') }} <b>{{ $t('plugins.WorkshopMotors.crash.away_from_material') }}</b> {{ $t('plugins.WorkshopMotors.crash.raise_z_if_close') }}</li>
				<li>{{ $t('plugins.WorkshopMotors.crash.while_calibrating') }} <b>{{ $t('plugins.WorkshopMotors.crash.real_crash_does_not_stop') }}</b>{{ $t('plugins.WorkshopMotors.crash.warn_3') }}</li>
				<li>{{ $t('plugins.WorkshopMotors.crash.motors_run_with_the') }} <b>{{ $t('plugins.WorkshopMotors.crash.reduced_current') }}</b> {{ $t('plugins.WorkshopMotors.crash.warn_4', { pct: cfg ? cfg.correctionXY : '--' }) }}</li>
				<li>{{ $t('plugins.WorkshopMotors.crash.keep_hand_near') }} <b>{{ $t('plugins.WorkshopMotors.crash.emergency_stop') }}</b> {{ $t('plugins.WorkshopMotors.crash.warn_5') }}</li>
				<li>{{ $t('plugins.WorkshopMotors.crash.warn_6a') }} <b>{{ $t('plugins.WorkshopMotors.crash.never_protects_people') }}</b> {{ $t('plugins.WorkshopMotors.crash.warn_6b') }}</li>
			</ol>
			<v-checkbox v-model="understood" :disabled="running" density="compact" hide-details class="mt-0" :label="$t('plugins.WorkshopMotors.crash.understood_i_cleared_the_path_and')" />
		</div>
		<div class="d-flex flex-wrap mt-2" style="gap:6px">
			<v-chip v-for="r in requirements" :key="r.text" size="small" :color="r.ok ? 'success' : 'error'" variant="outlined">
				<v-icon size="x-small" start>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
			</v-chip>
		</div>
		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<v-btn-toggle v-model="axesSel" mandatory density="compact" color="primary">
				<v-btn size="small" value="X">X</v-btn>
				<v-btn size="small" value="Y">Y</v-btn>
				<v-btn size="small" value="XY">{{ $t('plugins.WorkshopMotors.crash.x_and_y') }}</v-btn>
			</v-btn-toggle>
			<!-- level 4 (DESIGN.md): the box and the checkbox already confirm; without a double tap -->
			<v-btn size="small" color="error" :disabled="!can || running || !understood || !!pending" @click="touchBegin()">
				<v-icon start>mdi-play</v-icon>{{ $t('plugins.WorkshopMotors.common.calibrate') }}
			</v-btn>
			<span v-if="running" class="text-body-medium">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
				{{ axisCurrent }}: {{ stateCal || $t('plugins.WorkshopMotors.crash.starting') }}
			</span>
		</div>
		<div v-if="!understood" class="text-body-small text-medium-emphasis mt-1">{{ $t('plugins.WorkshopMotors.common.tick_understood_in_the_box_to') }}</div>

		<v-alert v-if="error" density="compact" variant="outlined" type="error" class="mt-3 mb-0">{{ error }}</v-alert>
		<div v-if="Object.keys(results).length" class="mt-3">
			<div v-for="(r, e) in results" :key="e" class="text-body-medium">
				<b>{{ e }}:</b>
				<template v-if="r.res === -999">{{ $t('plugins.WorkshopMotors.crash.res_least_sensitive_false', { s: r.fake }) }}</template>
				<template v-else>{{ $t('plugins.WorkshopMotors.crash.res_no_false_until', { s: r.res - 2 }) }}<template v-if="r.fake != null"> {{ $t('plugins.WorkshopMotors.crash.res_false_at', { s: r.fake }) }}</template>{{ $t('plugins.WorkshopMotors.crash.res_recommended') }} <b>{{ r.res }}</b>.</template>
			</div>
			<div v-if="recommended != null" class="text-body-small mt-2">
				{{ $t('plugins.WorkshopMotors.crash.save_note_1') }} <b>{{ $t('plugins.WorkshopMotors.crash.lower') }}</b> {{ $t('plugins.WorkshopMotors.crash.save_note_2') }} <b>{{ $t('plugins.WorkshopMotors.crash.higher') }}</b> {{ $t('plugins.WorkshopMotors.crash.save_note_3') }}
			</div>
			<div v-if="recommended != null" class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<span class="text-body-medium">{{ $t('plugins.WorkshopMotors.crash.for_the_jog_a_single_one') }} <b>{{ recommended }}</b> {{ $t('plugins.WorkshopMotors.crash.now_value', { v: cfg && cfg.crashSens }) }}</span>
				<v-btn size="small" color="primary" :loading="saving" @click="save()">{{ $t('plugins.WorkshopMotors.crash.save_to_the_jog_without_limits') }}</v-btn>
			</div>
			<v-alert v-if="savedMsg" density="compact" variant="outlined" type="success" class="mt-2 mb-0">{{ savedMsg }}</v-alert>
		</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { i18n, machineModel, sendCode } from './dwc-host.js'
import { api, reserveMotion } from './workshop-api.js'
import { settings } from './settings.js' // shared settings files with revision (vue/_shared)
import { machineFree } from './machine-free.js' // file job, paused or live (vue/_shared)
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { ORIGIN, withReservation, refusedText } from './sequence.js'

// Calibrating the crash is a sequence that changes the motors' sensitivity: moving is
// free with a paused job or a still live job, but this is NOT (2026-10-12): it is blocked.
// The reservation of this page (taken while it runs) does not block it.
function freeCalibrate(model, op) {
	const ml = machineFree(model, Object.assign({ t: ts, serviceText, serviceDefaultKey, origin: ORIGIN }, op))
	if (ml.free && ml.code === 'paused') return { free: false, code: 'paused', reason: i18n.t('plugins.WorkshopMotors.crash.there_is_a_paused_job_resume') }
	if (ml.confirm) return { free: false, code: 'live', reason: ml.reason }
	return ml
}

const JOG_FILE = '0:/sys/workshop/config/jog.json'
const FREE_DEF = { crash: true, crashSens: 8, crashSteps: 100, speedPct: 25, correctionXY: 50 }
const SENS_START = 16
const SENS_END = -12

async function readJson(path, def) {
	try {
		const r = await fetch('/machine/file/' + encodeURIComponent(path), { cache: 'no-store' })
		if (!r.ok) return def
		return JSON.parse((await r.text()).replace(/^\uFEFF/, ''))
	} catch (e) {
		return def
	}
}

const props = defineProps({
	axes: { type: Array, default: () => [] },
	state: { type: String, default: '' }
})

const file = ref(null) // the whole sys/workshop/config/jog.json
const cfg = ref(null) // file.free with default values
const sinceMms = ref(null)
const axesSel = ref('X')
const armed = ref(false)
const running = ref(false)
const axisCurrent = ref('')
const results = ref({})
const error = ref(null)
const saving = ref(false)
const savedMsg = ref(null)
const understood = ref(false)
const restoring = ref(false)
let armedTimer = null

function readGlobal(k) {
	const g = machineModel().global
	return g && (typeof g.get === 'function' ? g.get(k) : g[k])
}
// every order of this page is written to the console log
function send(code) {
	return sendCode({ code, log: true })
}

const feedMax = computed(() => {
	const f = file.value && file.value.feedMax
	return typeof f === 'number' && f > 0 ? f : 6000
})
const vMax = computed(() => cfg.value ? (feedMax.value / 60) * (cfg.value.speedPct / 100) : 0)
const stepsSince = computed(() => {
	if (!cfg.value) return 100
	if (sinceMms.value > 0) {
		const fs = Math.max(...['X', 'Y'].map(L => {
			const a = props.axes.find(x => x && x.letter === L)
			const micro = (a && a.microstepping && a.microstepping.value) || 16
			return a && a.stepsPerMm ? a.stepsPerMm / micro : 5
		}))
		return Math.max(20, Math.min(400, Math.round(sinceMms.value * fs)))
	}
	return cfg.value.crashSteps
})
// full steps per mm of X / Y and from what speed the driver measures
const axisRows = computed(() => {
	const steps = stepsSince.value
	return ['X', 'Y'].map(L => {
		const a = props.axes.find(x => x && x.letter === L)
		const micro = (a && a.microstepping && a.microstepping.value) || 16
		const fsmm = a && a.stepsPerMm ? a.stepsPerMm / micro : 5
		return { letter: L, fsmm, threshold: steps / fsmm, homed: !!(a && a.homed) }
	})
})
const thresholdMax = computed(() => Math.max(...axisRows.value.map(e => e.threshold)))
const neverDetects = computed(() => cfg.value && vMax.value < thresholdMax.value)
const freeActive = computed(() => readGlobal('jogFree') === true)
// axis of a calibration cut halfway (crash-cal.g leaves crashCalPending)
const pending = computed(() => {
	if (running.value) return ''
	const v = readGlobal('crashCalPending')
	return typeof v === 'string' ? v : ''
})
const stateCal = computed(() => readGlobal('crashCalState') || '')
// Motion audit (2.0): before it only looked at state == idle and with a live job
// there is idle between lines. machineFree also sees the live one.
const freeNow = computed(() => freeCalibrate(machineModel()))
const requirements = computed(() => {
	const sel = axesSel.value === 'XY' ? ['X', 'Y'] : [axesSel.value]
	return [
		{ ok: sel.every(L => (axisRows.value.find(e => e.letter === L) || {}).homed), text: i18n.t('plugins.WorkshopMotors.crash.home_axes', { axes: sel.join(' ' + i18n.t('plugins.WorkshopMotors.crash.and') + ' ') }) },
		{ ok: freeNow.value.free, text: freeNow.value.free ? i18n.t('plugins.WorkshopMotors.crash.machine_free') : freeNow.value.reason },
		{ ok: !freeActive.value, text: i18n.t('plugins.WorkshopMotors.crash.without_limits_mode_off') },
		{ ok: !neverDetects.value, text: i18n.t('plugins.WorkshopMotors.crash.speed_high_enough_to_measure') }
	]
})
const can = computed(() => !!cfg.value && requirements.value.every(r => r.ok))
const recommended = computed(() => {
	const v = Object.values(results.value).filter(r => r.res !== -999).map(r => r.res)
	if (!v.length || v.length < Object.keys(results.value).length) return null
	return Math.max(...v) // the least sensitive of the axes: without false ones in any
})

onMounted(() => load())
onBeforeUnmount(() => clearTimeout(armedTimer))

async function load() {
	const a = await readJson(JOG_FILE, {})
	file.value = a && typeof a === 'object' ? a : {}
	cfg.value = Object.assign({}, FREE_DEF, file.value.free || {})
}
function touchBegin() {
	// it is looked at again on tap: the page's state arrives every ~2 s
	const ml = freeCalibrate(machineModel())
	if (!ml.free) {
		error.value = i18n.t('plugins.WorkshopMotors.crash.cannot_calibrate_reason', { reason: ml.reason })
		return
	}
	if (understood.value) {
		run().then(() => { understood.value = false }) // next time, read it again
		return
	}
	if (!armed.value) {
		armed.value = true
		clearTimeout(armedTimer)
		armedTimer = setTimeout(() => { armed.value = false }, 4000)
		return
	}
	armed.value = false
	clearTimeout(armedTimer)
	run().then(() => { understood.value = false }) // next time, read it again
}
async function run() {
	running.value = true
	error.value = null
	savedMsg.value = null
	results.value = {}
	const sel = axesSel.value === 'XY' ? ['X', 'Y'] : [axesSel.value]
	const v = Math.round(vMax.value * 10) / 10
	try {
		// the jog and the other pages wait while it runs (WorkshopService motion owner)
		await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.crash', { axes: sel.join(' ') }), async () => {
			for (const L of sel) {
				axisCurrent.value = L
				// and before each axis (with X and Y, a live job could open a job in between);
				// busy passes: the model may arrive late with the previous axis
				const ml = freeCalibrate(machineModel(), { allowBusy: true })
				if (!ml.free) throw new Error(ml.reason)
				const row = axisRows.value.find(e => e.letter === L)
				// second, slower pass, near where it starts to measure
				const w = Math.round(Math.min(v, row.threshold * 1.25) * 10) / 10
				const reply = await send(`M98 P"0:/sys/workshop/macros/crash-cal.g" A"${L}" V${v} W${w < v ? w : 0} C${cfg.value.correctionXY} H${stepsSince.value} S${SENS_START} B${SENS_END} L120`)
				if (/error|abort/i.test(reply || '')) throw new Error(reply)
				let res = null
				for (let i = 0; i < 15 && res == null; i++) {
					res = readGlobal('crashCalRes')
					if (res == null) await new Promise(r => setTimeout(r, 300))
				}
				if (res == null) throw new Error(i18n.t('plugins.WorkshopMotors.crash.could_not_read_result_of_axis', { axis: L }))
				results.value[L] = { res, fake: readGlobal('crashCalFake') }
			}
		})
	} catch (e) {
		error.value = refusedText(e) || i18n.t('plugins.WorkshopMotors.crash.calibration_interrupted_error', { error: e.message || String(e) })
	} finally {
		running.value = false
	}
}
async function restore() {
	restoring.value = true
	try {
		for (const c of ['M913 X100 Y100', 'M915 X Y R0', 'set global.crashCal = false', 'set global.crashCalPending = ""']) {
			await send(c)
		}
	} catch (e) {
		error.value = i18n.t('plugins.WorkshopMotors.common.could_not_restore') + (e.message || e)
	} finally {
		restoring.value = false
	}
}
async function save() {
	saving.value = true
	try {
		// through the settings store with revision (vue/_shared/settings.js): the rest of jog.json is kept even if someone else saved meanwhile
		await settings.save('jog', data => {
			data.free = Object.assign({}, FREE_DEF, data.free || {}, { crashSteps: stepsSince.value, crashSens: recommended.value })
		})
		api('activity.log', { type: 'calibration', text: i18n.t('plugins.WorkshopMotors.crash.log_saved', { s: recommended.value, v: thresholdMax.value.toFixed(0) }) }).catch(() => {})
		savedMsg.value = i18n.t('plugins.WorkshopMotors.crash.saved_uses_s_from_v', { s: recommended.value, v: thresholdMax.value.toFixed(0) })
		await load()
		sinceMms.value = null
	} catch (e) {
		error.value = i18n.t('plugins.WorkshopMotors.common.could_not_save') + (e.message || e)
	} finally {
		saving.value = false
	}
}
</script>

<style scoped>
.explica {
	background: rgba(25, 118, 210, 0.08);
	border-radius: 6px;
	padding: 8px 12px;
}
.notices {
	border: 1px solid rgba(255, 152, 0, 0.6);
	border-radius: 6px;
	padding: 8px 12px;
	background: rgba(255, 152, 0, 0.06);
	font-size: 13px;
}
.notices.on {
	border-width: 2px;
	border-color: #e65100;
	background: rgba(230, 81, 0, 0.12);
}
.notices-t {
	font-weight: 600;
	margin-bottom: 4px;
}
.notices ol {
	padding-left: 20px;
}
.datum-t {
	font-size: 12px;
	color: var(--tp-faint, #9e9e9e);
}
.datum-v {
	font-size: 18px;
	font-weight: 500;
	font-variant-numeric: tabular-nums;
}
</style>
