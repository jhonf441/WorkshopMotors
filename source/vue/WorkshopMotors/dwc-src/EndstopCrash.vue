<template>
	<div>
		<div class="explica text-body-medium">
			<v-icon size="small" color="info" class="mr-1">mdi-information</v-icon>
			<b>{{ $t('plugins.WorkshopMotors.crashFinal.sensorless_endstop_stall_homing') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_1') }}
			<b>{{ $t('plugins.WorkshopMotors.crashFinal.no') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_2') }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.yes') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_3') }}
			<b>{{ $t('plugins.WorkshopMotors.crashFinal.intro_badly_calibrated') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_4') }}
		</div>

		<v-alert v-if="pending" density="compact" type="warning" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopMotors.crashFinal.previous_test_interrupted', { text: pending.text }) }}
			<v-btn size="x-small" color="warning" class="ml-2" :loading="restoring" @click="restorePending()">{{ $t('plugins.WorkshopMotors.common.restore_now') }}</v-btn>
		</v-alert>

		<!-- Eje -->
		<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.1_axis') }}</div>
		<div v-if="!list.length" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopMotors.crashFinal.there_are_no_axes_with_motors') }}</div>
		<v-btn-toggle class="ec-wrap" v-else v-model="letter" mandatory density="compact" color="primary">
			<v-btn v-for="e in list" :key="e.letter" size="small" :value="e.letter" :disabled="running">{{ e.letter }}</v-btn>
		</v-btn-toggle>
		<div v-if="axis" class="ec-chips d-flex flex-wrap mt-2" style="gap:6px">
			<v-chip size="small" variant="outlined">{{ $t('plugins.WorkshopMotors.crashFinal.n_motors_list', { n: axis.drivers.length, list: axis.drivers.map(d => d.id).join(', ') }) }}</v-chip>
			<v-chip size="small" variant="outlined" :color="axis.family.sg === 0 ? 'error' : (axis.family.sg == null ? 'warning' : '')">{{ axis.family.chip }}</v-chip>
			<v-chip size="small" variant="outlined" :color="finalIsCrash ? 'success' : ''">{{ $t('plugins.WorkshopMotors.crashFinal.endstop_label', { text: textFinal }) }}</v-chip>
			<v-chip v-for="d in axis.drivers" :key="'m' + d.id" size="small" variant="outlined">
				{{ d.id }}: {{ modes[d.id] || $t('plugins.WorkshopMotors.crashFinal.mode') }}{{ origM915[d.id] ? ' · M915 S' + origM915[d.id].s + ' H' + origM915[d.id].h : '' }}
			</v-chip>
			<v-btn size="x-small" variant="text" :loading="readingDrivers" :disabled="running" @click="readDrivers()">{{ $t('plugins.WorkshopMotors.crashFinal.read_again') }}</v-btn>
		</div>
		<v-alert v-if="axis && isVertical" density="compact" variant="outlined" type="warning" class="mt-2 mb-0">
			{{ $t('plugins.WorkshopMotors.crashFinal.looks_vertical', { axis: axis.letter }) }}
		</v-alert>
		<v-alert v-if="axis && coupled" density="compact" variant="outlined" type="info" class="mt-2 mb-0">
			{{ $t('plugins.WorkshopMotors.crashFinal.coupled_kinematics', { kin: kinematics, axis: axis.letter }) }}
		</v-alert>

		<!-- Ajustes -->
		<template v-if="axis">
			<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.2_how_it_moves_during_the') }}</div>
			<v-row density="compact" align="center">
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="v" :label="$t('plugins.WorkshopMotors.crashFinal.speed_mm_s')" type="number" min="1" density="compact" variant="outlined" hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="correction" :label="$t('plugins.WorkshopMotors.crashFinal.current')" type="number" min="20" max="100" density="compact" variant="outlined" hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="2">
					<v-text-field v-model.number="h" :label="$t('plugins.WorkshopMotors.crashFinal.h_steps_s')" type="number" min="20" density="compact" variant="outlined" hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="4">
					<v-btn-toggle class="ec-wrap" v-model="end" mandatory density="compact" color="primary">
						<v-btn size="x-small" :value="1" :disabled="running">{{ $t('plugins.WorkshopMotors.crashFinal.low_end_btn', { axis: axis.letter }) }}</v-btn>
						<v-btn size="x-small" :value="2" :disabled="running">{{ $t('plugins.WorkshopMotors.crashFinal.high_end_btn', { axis: axis.letter }) }}</v-btn>
					</v-btn-toggle>
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="length" :label="$t('plugins.WorkshopMotors.crashFinal.free_stretch_mm')" type="number" min="10" density="compact" variant="outlined" hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="overshoot" :label="$t('plugins.WorkshopMotors.crashFinal.go_past_the_limit_up_to')" type="number" min="1" max="20" density="compact" variant="outlined" hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-btn-toggle class="ec-wrap" v-model="f" mandatory density="compact" color="primary">
						<v-btn size="x-small" :value="0" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.one_reading_per_full_step_detects')">F0</v-btn>
						<v-btn size="x-small" :value="1" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.one_reading_every_4_steps_fewer')">F1</v-btn>
					</v-btn-toggle>
				</v-col>
				<v-col v-if="axis.drivers.length > 1" cols="6" sm="3">
					<v-btn-toggle class="ec-wrap" v-model="kindFinal" mandatory density="compact" color="primary">
						<v-btn size="x-small" value="S3" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.stops_all_motors_of_the_axis')">S3</v-btn>
						<v-btn size="x-small" value="S4" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.each_motor_stops_on_its_own')">S4</v-btn>
					</v-btn-toggle>
				</v-col>
			</v-row>
			<details class="wf-more">
				<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
			<div class="text-body-small text-medium-emphasis mt-1">
				{{ $t('plugins.WorkshopMotors.crashFinal.settings_note', { min: vMin == null ? '--' : vMin.toFixed(1), h, approach: approach, over: overshoot }) }}
			</div>
			</details>

			<div class="ec-chips d-flex flex-wrap mt-2" style="gap:6px">
				<v-chip v-for="r in reqs" :key="r.key" size="small" :color="r.ok ? 'success' : (r.blocks ? 'error' : 'warning')" variant="outlined">
					<v-icon size="x-small" start>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
				</v-chip>
			</div>

			<!-- Calibrar -->
			<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.3_find_the_sensitivity') }}</div>
			<div class="notices" :class="{ on: running }">
				<div class="notices-t">
					<v-icon size="small" color="error" class="mr-1">mdi-alert</v-icon>{{ running ? $t('plugins.WorkshopMotors.crashFinal.calibrating_the_machine_moves_on_its') : $t('plugins.WorkshopMotors.common.before_calibrating_read_this') }}
				</div>
				<ol>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.the_machine') }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.moves_by_itself') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.warn_1a', { axis: axis.letter, len: length }) }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.against_the_end_b') }}</b>
						{{ $t('plugins.WorkshopMotors.crashFinal.warn_1b', { end: end === 2 ? $t('plugins.WorkshopMotors.crashFinal.high') : $t('plugins.WorkshopMotors.crashFinal.low'), v }) }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.warn_2a') }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.may_not_detect_and_push') }}</b>
						{{ $t('plugins.WorkshopMotors.crashFinal.warn_2b', { over: overshoot, pct: correction }) }}</li>
					<li><b>{{ $t('plugins.WorkshopMotors.crashFinal.clear_the_path') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.warn_3') }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.warn_4', { axis: axis.letter }) }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.emergency_stop') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.top_of_dwc') }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.warn_5', { axis: axis.letter }) }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.nothing_is_saved_to_config_g') }}</li>
				</ol>
				<v-checkbox v-model="understood" :disabled="running" density="compact" hide-details class="mt-0"
					:label="$t('plugins.WorkshopMotors.crashFinal.understood_checkbox')" />
			</div>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<v-btn size="small" color="error" :disabled="!canBegin" @click="begin()">
					<v-icon start size="small">mdi-play</v-icon>{{ sweep && sweep.phase !== 'free' ? $t('plugins.WorkshopMotors.crashFinal.start_over') : $t('plugins.WorkshopMotors.common.calibrate') }}
				</v-btn>
				<v-btn v-if="running" size="small" variant="outlined" @click="stop = true">{{ $t('plugins.WorkshopMotors.crashFinal.stop_after_this_step') }}</v-btn>
				<span v-if="running" class="text-body-medium">
					<v-progress-circular indeterminate size="16" width="2" class="mr-1" />{{ state }}
				</span>
				<span v-else-if="reasonNoBegin" class="text-body-small text-medium-emphasis">{{ reasonNoBegin }}</span>
			</div>
			<v-alert v-if="error" density="compact" variant="outlined" type="error" class="mt-3 mb-0">{{ error }}</v-alert>

			<div v-if="steps.length" class="mt-3">
				<div v-for="(p, i) in steps" :key="i" class="text-body-medium">
					<v-icon size="x-small" :color="p.color" class="mr-1">{{ p.icon }}</v-icon>{{ p.text }}
				</div>
			</div>

			<!-- Against the stop: the user says what happened -->
			<div v-if="sweep && sweep.phase === 'stop' && !running" class="stop mt-3">
				<template v-if="lastStop">
					<div class="text-body-medium mb-2">
						{{ $t('plugins.WorkshopMotors.crashFinal.with_s', { s: lastStop.s }) }} <b>{{ lastStop.res.stopped ? $t('plugins.WorkshopMotors.crashFinal.stopped_at_mm', { mm: lastStop.res.route.toFixed(1) }) : $t('plugins.WorkshopMotors.crashFinal.travelled_mm_without_detecting', { mm: lastStop.res.requested }) }}</b>
						{{ $t('plugins.WorkshopMotors.crashFinal.what_did_you_see', { mm: approach }) }}
					</div>
					<div class="d-flex flex-wrap" style="gap:6px">
						<v-btn size="small" :color="suggested === 'well' ? 'primary' : ''" :variant="suggested !== 'well' ? 'outlined' : 'flat'" @click="answer('well')">{{ $t('plugins.WorkshopMotors.crashFinal.it_stopped_when_touching_the_end') }}</v-btn>
						<v-btn size="small" :color="suggested === 'before' ? 'primary' : ''" :variant="suggested !== 'before' ? 'outlined' : 'flat'" @click="answer('before')">{{ $t('plugins.WorkshopMotors.crashFinal.it_stopped_before_touching_it') }}</v-btn>
						<v-btn size="small" :color="suggested === 'followed' ? 'primary' : ''" :variant="suggested !== 'followed' ? 'outlined' : 'flat'" @click="answer('followed')">{{ $t('plugins.WorkshopMotors.crashFinal.it_kept_pushing_noise_skipping') }}</v-btn>
					</div>
				</template>
				<template v-else>
					<div class="text-body-medium mb-2">
						{{ $t('plugins.WorkshopMotors.crashFinal.no_false_until_s', { s: sweep.lastOk }) }}{{ sweep.fake != null ? ' ' + $t('plugins.WorkshopMotors.crashFinal.false_with_s', { s: sweep.fake }) : '' }}.
						{{ $t('plugins.WorkshopMotors.crashFinal.now_against_end_with') }} <b>S{{ sweep.candidate }}</b>{{ $t('plugins.WorkshopMotors.crashFinal.starts_at_mm_from_limit', { mm: approach }) }}
					</div>
					<v-btn size="small" color="error" :disabled="!canMove" @click="testStop()"><v-icon start size="small">mdi-arrow-collapse-horizontal</v-icon>{{ $t('plugins.WorkshopMotors.crashFinal.test_against_end_with_s', { s: sweep.candidate }) }}</v-btn>
				</template>
			</div>
			<v-alert v-if="sweep && sweep.phase === 'failure'" density="compact" variant="outlined" type="warning" class="mt-3 mb-0">{{ sweep.reason }}</v-alert>
			<v-alert v-if="sweep && sweep.phase === 'ready'" density="compact" variant="outlined" type="success" class="mt-3 mb-0">
				{{ $t('plugins.WorkshopMotors.crashFinal.sensitivity_found') }} <b>S{{ sweep.final }}</b>. {{ sweep.reason }} {{ $t('plugins.WorkshopMotors.crashFinal.review_and_save_below') }}
			</v-alert>

			<!-- Proposal for config.g -->
			<div class="text-title-small mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.4_save_to_config_g') }}</div>
			<v-row density="compact" align="center">
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="sProp" :label="$t('plugins.WorkshopMotors.crashFinal.sensitivity_s')" type="number" density="compact" variant="outlined" hide-details :disabled="running" />
				</v-col>
				<v-col cols="12" sm="9" class="text-body-small text-medium-emphasis">
					{{ $t('plugins.WorkshopMotors.crashFinal.lower_more_sensitive') }}
					{{ axis.family.sg === 4 ? $t('plugins.WorkshopMotors.crashFinal.tmc2209_2240_from_128_to_127') : $t('plugins.WorkshopMotors.crashFinal.from_64_to_63_the_docs') }}
				</v-col>
			</v-row>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<v-btn size="small" variant="outlined" :loading="readingConfig" :disabled="running || blocked" @click="prepareProposal()">
					<v-icon start size="small">mdi-file-compare</v-icon>{{ $t('plugins.WorkshopMotors.crashFinal.show_the_change_in_config_g') }}
				</v-btn>
				<span v-if="blocked" class="text-body-small text-medium-emphasis">{{ reasonBlock }}</span>
			</div>
			<template v-if="proposal">
				<div class="diff mt-2">
					<div v-for="(x, i) in proposal.diff" :key="i" :class="'d-' + x.kind">
						<template v-if="x.kind === 'cut'">...</template>
						<template v-else><span class="dn">{{ x.kind === 'deleted' ? x.a : x.b }}</span>{{ x.kind === 'added' ? '+ ' : (x.kind === 'deleted' ? '- ' : '  ') }}{{ x.text }}</template>
					</div>
					<div v-if="!proposal.diff.length" class="d-same">{{ $t('plugins.WorkshopMotors.crashFinal.config_g_already_has_these_lines') }}</div>
				</div>
				<div v-for="(c, i) in proposal.changes.filter(c => c.note)" :key="'n' + i" class="text-body-small mt-1">{{ c.note }}</div>
				<div v-for="(a, i) in proposal.notices" :key="'a' + i" class="text-body-small text-warning mt-1">{{ a }}</div>
				<div class="text-body-small text-medium-emphasis mt-1">
					{{ $t('plugins.WorkshopMotors.crashFinal.only_config_g_changes', { axis: axis.letter }) }}
					{{ serviceConfig === false ? $t('plugins.WorkshopMotors.crashFinal.without_the_service_save_a_copy') : $t(hasConfig ? 'plugins.WorkshopMotors.crashFinal.saved_through_the_service_it_leaves' : 'plugins.WorkshopMotors.crashFinal.saved_through_the_service_it_leaves_no_config') }}
				</div>
				<div v-if="proposal.diff.length" class="d-flex flex-wrap align-center mt-2" style="gap:8px">
					<v-checkbox v-model="checked" density="compact" hide-details class="mt-0" :label="$t('plugins.WorkshopMotors.crashFinal.i_reviewed_the_change')" />
					<v-btn size="small" color="primary" :disabled="!checked || saving || blocked" :loading="saving" @click="saveConfig()">{{ $t('plugins.WorkshopMotors.crashFinal.save_to_config_g') }}</v-btn>
				</div>
				<v-alert v-if="savedMsg" density="compact" variant="outlined" type="success" class="mt-2 mb-0">
					{{ savedMsg }}
					<v-btn size="x-small" variant="outlined" class="ml-2" :loading="applying" :disabled="blocked" @click="applyNow()">{{ $t('plugins.WorkshopMotors.crashFinal.apply_now_without_restarting') }}</v-btn>
				</v-alert>
				<div class="text-body-small mt-3">{{ $t('plugins.WorkshopMotors.crashFinal.homing_file_hint', { axis: axis.letter, file: 'sys/home' + axis.letter.toLowerCase() + '.g' }) }}</div>
				<pre class="homing">{{ textHoming }}</pre>
			</template>
		</template>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n, sendCode } from './dwc-host.js'
import { api, reserveMotion } from './workshop-api.js'
import { workshopProfile } from './machine-profile.js' // what the service discovered about the boards (vue/_shared)
import { withReservation, refusedText } from './sequence.js'
import {
	axesOf, valuesInitial, requirements, speedMin, newSweep, resultFree, resultCap, hint, macroStep, MACRO_STEP,
	readStep, commandsRestore, proposeConfig, diffLines, hintHoming, requestSaved, newTx, readJson, readM569, readM915, letterGcode
} from './endstop-crash.js'
import { block } from './enable.js'
import { sha256 } from './sha256.js'
import { pluginActive } from './workshop-ids.js' // the configurator is another plugin: nothing about it when it is absent

const CONFIG = '0:/sys/config.g'
const ORIG_KEY = 'workshopEndCrashOrig'
const RISK_ID = 'motors-sensorless-endstop'

function url(p) {
	return '/machine/file/' + encodeURIComponent(p)
}

function write(p, content) {
	return fetch(url(p), { method: 'PUT', body: content, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => {
		if (!r.ok) {
			throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.could_not_write_http', { path: p, status: r.status }))
		}
	})
}

function readLocal() {
	try {
		return JSON.parse(localStorage.getItem(ORIG_KEY) || 'null')
	} catch (e) {
		return null
	}
}

function saveLocal(v) {
	try {
		if (v) {
			localStorage.setItem(ORIG_KEY, JSON.stringify(v))
		} else {
			localStorage.removeItem(ORIG_KEY)
		}
	} catch (e) {
		// without localStorage: only the restore notice is lost
	}
}

const props = defineProps({
	om: { type: Object, default: null },
	report: { type: Object, default: null },
	liveJob: { type: [Object, Boolean], default: null }
})

const letter = ref(null)
const v = ref(30)
const correction = ref(40)
const h = ref(200)
const f = ref(0)
const length = ref(40)
const approach = ref(10)
const overshoot = ref(5)
const end = ref(1)
const kindFinal = ref('S3')
const modes = ref({})
const origM915 = ref({})
const readingDrivers = ref(false)
const understood = ref(false)
const running = ref(false)
const stop = ref(false)
const state = ref('')
const error = ref(null)
const sweep = ref(null)
const steps = ref([])
const lastStop = ref(null)
const sProp = ref(3)
const proposal = ref(null)
const readingConfig = ref(false)
const checked = ref(false)
const saving = ref(false)
const savedMsg = ref(null)
const applying = ref(false)
const serviceConfig = ref(null)
const restoring = ref(false)
const caps = ref(null) // capabilities.get: the chip of each board as the service discovered it (null = not known: the names are used)
const origLocal = ref(readLocal())

function readGlobal(k) {
	const g = props.om && props.om.global
	return g && (typeof g.get === 'function' ? g.get(k) : g[k])
}
function sendLogged(code) {
	return sendCode({ code, log: true })
}

const hasConfig = computed(() => pluginActive('config'))
const list = computed(() => axesOf(props.om, caps.value))
const axis = computed(() => list.value.find(e => e.letter === letter.value) || null)
const kinematics = computed(() => {
	const k = props.om && props.om.move && props.om.move.kinematics
	return (k && k.name) || ''
})
const coupled = computed(() => /core|delta|scara|polar|hangprinter/i.test(kinematics.value))
const isVertical = computed(() => !!axis.value && (axis.value.letter.toUpperCase() === 'Z' || /delta/i.test(kinematics.value)))
const finalIsCrash = computed(() => !!axis.value && (axis.value.final.kind === 'S3' || axis.value.final.kind === 'S4'))
const textFinal = computed(() => {
	const fin = axis.value && axis.value.final
	if (!fin || !fin.kind) {
		return i18n.t('plugins.WorkshopMotors.crashFinal.no_endstop')
	}
	const kind = fin.kind === 'other' ? fin.textKind : i18n.t('plugins.WorkshopMotors.crashFinal.by_stall_type', { type: fin.kind })
	return fin.end === 2 ? i18n.t('plugins.WorkshopMotors.crashFinal.type_high_end', { type: kind }) : i18n.t('plugins.WorkshopMotors.crashFinal.type_low_end', { type: kind })
})
const vMin = computed(() => axis.value ? speedMin(h.value, axis.value.fsmm) : null)
const reqs = computed(() => requirements({
	axis: axis.value, om: props.om, liveJob: props.liveJob, v: v.value, h: h.value, correction: correction.value, f: f.value,
	modes: modes.value, forSweep: true, length: length.value, approach: approach.value, overshoot: overshoot.value
}))
const blocked = computed(() => block(props.om, props.liveJob).blocked)
const reasonBlock = computed(() => block(props.om, props.liveJob).reason)
const paramsOk = computed(() => overshoot.value >= 1 && overshoot.value <= 20 && length.value >= 10 && h.value >= 20 && h.value <= 2000 && v.value > 0)
// test cut halfway: reduced current (macro) or a test M915 (page)
const pending = computed(() => {
	if (running.value) {
		return null
	}
	const g = readGlobal('endCrashPending')
	if (typeof g === 'string' && g) {
		return { kind: 'current', letter: g, text: i18n.t('plugins.WorkshopMotors.crashFinal.axis_left_reduced_current', { axis: g }) }
	}
	const o = origLocal.value
	if (o && o.drivers && o.drivers.length) {
		return { kind: 'm915', letter: o.letter, text: i18n.t('plugins.WorkshopMotors.crashFinal.sensitivity_left_test_value', { axis: o.letter }) }
	}
	return null
})
const canMove = computed(() => !!axis.value && !running.value && understood.value && paramsOk.value && reqs.value.every(r => !r.blocks) && !pending.value)
const canBegin = computed(() => canMove.value)
const reasonNoBegin = computed(() => {
	if (!axis.value) return ''
	if (pending.value) return i18n.t('plugins.WorkshopMotors.crashFinal.first_restore_the_previous_test')
	const r = reqs.value.find(x => x.blocks)
	if (r) return r.text
	if (!paramsOk.value) return i18n.t('plugins.WorkshopMotors.crashFinal.check_the_values_past_the_limit')
	if (!understood.value) return i18n.t('plugins.WorkshopMotors.common.tick_understood_in_the_box_to')
	return ''
})
const suggested = computed(() => lastStop.value ? hint(lastStop.value.res) : null)
const textHoming = computed(() => {
	if (!axis.value) return ''
	const rec = typeof axis.value.max === 'number' && typeof axis.value.min === 'number' ? axis.value.max - axis.value.min : 300
	return hintHoming({ letter: axis.value.letter, end: end.value, v: v.value, correction: correction.value, route: rec, pctBack: axis.value.pctCurrent })
})

watch(list, l => {
	if (!letter.value && l.length) {
		const crash = l.find(e => e.final.kind === 'S3' || e.final.kind === 'S4')
		letter.value = (crash || l[0]).letter
	}
}, { immediate: true })
watch(letter, () => restartAxis())

onMounted(() => {
	workshopProfile.get().then(() => { caps.value = workshopProfile.snapshot().caps })
	if (letter.value) {
		restartAxis()
	}
})
onBeforeUnmount(() => { stop.value = true })

function restartAxis() {
	if (!axis.value) {
		return
	}
	const initial = valuesInitial(axis.value, null)
	v.value = initial.v
	correction.value = initial.correction
	h.value = initial.h
	f.value = initial.f
	length.value = initial.length
	approach.value = initial.approach
	overshoot.value = initial.overshoot
	end.value = initial.end
	kindFinal.value = initial.kindFinal
	sweep.value = null
	steps.value = []
	lastStop.value = null
	proposal.value = null
	savedMsg.value = null
	error.value = null
	sProp.value = axis.value.family.sg === 4 ? 60 : 3
	readDrivers()
}
async function send(code) {
	return String(await sendCode({ code, log: false }) || '')
}
// Mode (M569) and current sensitivity (M915) of the axis drivers: read-only, once
async function readDrivers() {
	if (!axis.value || running.value) {
		return
	}
	readingDrivers.value = true
	const found = {}
	const orig = {}
	try {
		for (const d of axis.value.drivers) {
			try {
				const m = readM569(await send('M569 P' + d.id))
				if (m.mode) found[d.id] = m.mode
				const s = readM915(await send('M915 P' + d.id))
				if (s.length) orig[d.id] = { id: d.id, s: s[0].s, f: s[0].filter, h: s[0].h }
			} catch (e) {
				// board that does not respond: it stays without data
			}
		}
	} finally {
		modes.value = found
		origM915.value = orig
		readingDrivers.value = false
	}
	const first = Object.values(orig)[0]
	if (first && !sweep.value) {
		h.value = first.h > 0 ? first.h : h.value
		const initial = valuesInitial(axis.value, first)
		v.value = initial.v
		sProp.value = first.s
	}
}
async function startRisk() {
	const t = window.__workshop
	if (t && typeof t.riskStart === 'function') {
		try {
			// both languages: every screen shows the risk bar in its own
			const text = (l) => i18n.t('plugins.WorkshopMotors.crashFinal.risk_text', l, { axis: axis.value.letter })
			await t.riskStart(RISK_ID, { es: text('es'), en: text('en') }, 600)
		} catch (e) {
			// without the service the notice stays only on this page
		}
	}
}
function finishRisk() {
	const t = window.__workshop
	if (t && typeof t.riskFinish === 'function') {
		Promise.resolve(t.riskFinish(RISK_ID)).catch(() => {})
	}
}
// One step: writes the macro with the axis letter and runs it
async function step(mode, s) {
	const g = macroStep({
		axis: axis.value, mode: mode, end: end.value, v: v.value, correction: correction.value, h: h.value, f: f.value, s,
		length: length.value, approach: approach.value, overshoot: overshoot.value
	})
	await write(MACRO_STEP, g)
	const n0 = readGlobal('endCrashN')
	const reply = String(await sendLogged('M98 P"' + MACRO_STEP + '"') || '')
	let res = readStep(reply)
	if (!res) {
		if (/error|abort/i.test(reply)) {
			throw new Error(reply.replace(/^Error:\s*/i, ''))
		}
		for (let i = 0; i < 20 && !res; i++) {
			await new Promise(r => setTimeout(r, 250))
			if (readGlobal('endCrashN') !== n0) {
				res = readStep(readGlobal('endCrashRes'))
			}
		}
	}
	if (!res) {
		throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.could_not_read_the_result_of') + (reply ? i18n.t('plugins.WorkshopMotors.crashFinal.the_board_replied') + reply : ''))
	}
	return res
}
async function withRisk(fn) {
	running.value = true
	stop.value = false
	error.value = null
	const originals = Object.values(origM915.value)
	if (originals.length) {
		origLocal.value = { letter: axis.value.letter, drivers: originals }
		saveLocal(origLocal.value)
	}
	await startRisk()
	try {
		// the jog and the other pages wait while it runs (WorkshopService motion owner)
		await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.endstop', { axis: axis.value.letter }), fn)
	} catch (e) {
		error.value = refusedText(e) || i18n.t('plugins.WorkshopMotors.common.the_test_was_interrupted') + (e.message || e)
	} finally {
		await restoreM915()
		if (!originals.length) {
			steps.value.push({ icon: 'mdi-alert', color: 'warning', text: i18n.t('plugins.WorkshopMotors.crashFinal.could_not_read_the_previous_sensitivity') })
		}
		running.value = false
		state.value = ''
		finishRisk()
	}
}
async function restoreM915() {
	const orig = origLocal.value
	if (!orig) {
		return
	}
	try {
		for (const c of commandsRestore(orig.drivers)) {
			await send(c)
		}
		origLocal.value = null
		saveLocal(null)
	} catch (e) {
		error.value = (error.value ? error.value + ' ' : '') + i18n.t('plugins.WorkshopMotors.crashFinal.could_not_return_to_the_previous')
	}
}
async function begin() {
	if (!canBegin.value) {
		return
	}
	sweep.value = newSweep(axis.value.family)
	steps.value = []
	lastStop.value = null
	savedMsg.value = null
	proposal.value = null
	await withRisk(async () => {
		while (sweep.value.phase === 'free' && !stop.value) {
			const s = sweep.value.s
			state.value = i18n.t('plugins.WorkshopMotors.crashFinal.free_stretch_with_s_n', { s })
			const res = await step('free', s)
			steps.value.push(res.stopped
				? { icon: 'mdi-alert', color: 'warning', text: i18n.t('plugins.WorkshopMotors.crashFinal.step_false_stall', { s, mm: res.route.toFixed(1), total: res.requested }) }
				: { icon: 'mdi-check', color: 'success', text: i18n.t('plugins.WorkshopMotors.crashFinal.step_no_false', { s, mm: res.requested }) })
			sweep.value = resultFree(sweep.value, res)
		}
		if (stop.value && sweep.value.phase === 'free') {
			steps.value.push({ icon: 'mdi-stop', color: 'grey', text: i18n.t('plugins.WorkshopMotors.crashFinal.stopped_on_request') })
		}
	})
}
async function testStop() {
	if (!canMove.value || !sweep.value || sweep.value.phase !== 'stop') {
		return
	}
	const s = sweep.value.candidate
	await withRisk(async () => {
		state.value = i18n.t('plugins.WorkshopMotors.crashFinal.against_end_with_s_n', { s })
		const res = await step('stop', s)
		lastStop.value = { s, res }
		steps.value.push({ icon: 'mdi-arrow-collapse-horizontal', color: 'info', text: res.stopped ? i18n.t('plugins.WorkshopMotors.crashFinal.step_end_stopped', { s, mm: res.route.toFixed(1) }) : i18n.t('plugins.WorkshopMotors.crashFinal.step_end_not_stopped', { s, mm: res.requested }) })
	})
}
function answer(r) {
	const t = lastStop.value
	sweep.value = resultCap(sweep.value, r, t ? t.res.route : null)
	steps.value.push({ icon: 'mdi-account-check', color: 'primary', text: i18n.t('plugins.WorkshopMotors.crashFinal.your_answer_with_s') + (t ? t.s : '?') + ': ' + { well: i18n.t('plugins.WorkshopMotors.crashFinal.stopped_when_touching_the_end'), before: i18n.t('plugins.WorkshopMotors.crashFinal.stopped_early'), followed: i18n.t('plugins.WorkshopMotors.crashFinal.kept_pushing') }[r] })
	lastStop.value = null
	if (sweep.value.phase === 'ready') {
		sProp.value = sweep.value.final
		prepareProposal()
	}
}
async function restorePending() {
	restoring.value = true
	try {
		const p = pending.value
		if (p && p.kind === 'current') {
			const turn = readGlobal('endCrashCorrection')
			await send('M913 ' + letterGcode(p.letter) + (typeof turn === 'number' ? turn : 100))
			await send('set global.endCrashPending = ""')
		}
		await restoreM915()
	} catch (e) {
		error.value = i18n.t('plugins.WorkshopMotors.common.could_not_restore') + (e.message || e)
	} finally {
		restoring.value = false
	}
}
// ---- config.g ----
async function readConfig() {
	const r = await fetch(url(CONFIG), { cache: 'no-store' })
	if (!r.ok) {
		throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.could_not_read_config_http', { status: r.status }))
	}
	const bytes = new Uint8Array(await r.arrayBuffer())
	return { bytes, text: new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '') }
}
function date() {
	const d = new Date()
	const p = n => ('0' + n).slice(-2)
	return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
async function prepareProposal() {
	if (!axis.value || typeof sProp.value !== 'number' || isNaN(sProp.value)) {
		return
	}
	readingConfig.value = true
	error.value = null
	checked.value = false
	savedMsg.value = null
	try {
		const c = await readConfig()
		const lim = axis.value.family.sg === 4 ? 127 : 63
		const s = Math.max(-lim - 1, Math.min(lim, Math.round(sProp.value)))
		const p = proposeConfig(c.text, { letter: axis.value.letter, end: end.value, kindFinal: axis.value.drivers.length > 1 ? kindFinal.value : 'S3', s, f: f.value, h: Math.round(h.value), date: date() })
		proposal.value = Object.assign(p, { before: c.text, bytes: c.bytes, sha: sha256(c.bytes), diff: diffLines(c.text, p.text, 2), s })
	} catch (e) {
		error.value = i18n.t('plugins.WorkshopMotors.crashFinal.could_not_prepare_the_change') + (e.message || e)
		proposal.value = null
	} finally {
		readingConfig.value = false
	}
}
// API of WorkshopService config.<op>; without the service: { ok: false, error: 'without-handler' }
async function callConfig(op, args) {
	try {
		const r = await api('config.' + op, args || {})
		return r && typeof r === 'object' ? r : readJson(String(r || ''))
	} catch (e) {
		const without = ['service_outdated', 'unavailable', 'unknown_op'].includes(e && e.code)
		return { ok: false, error: without ? 'without-handler' : (e && e.message) || String(e) }
	}
}
async function saveConfig() {
	const p = proposal.value
	if (!p || block(props.om, props.liveJob).blocked) {
		return
	}
	saving.value = true
	error.value = null
	try {
		const now = await readConfig()
		if (sha256(now.bytes) !== p.sha) {
			throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.config_g_changed_since_you_read'))
		}
		const reason = i18n.t('plugins.WorkshopMotors.crashFinal.log_sensorless_endstop', { axis: axis.value.letter, s: p.s })
		const screen = 'wm-' + Math.random().toString(36).slice(2, 8)
		const lock = await callConfig('lock', { owner: screen, who: 'WorkshopMotors' })
		let backup = null
		if (lock.ok) {
			serviceConfig.value = true
			try {
				const tx = newTx()
				const staged = requestSaved({ path: CONFIG, text: p.text, bytesPrevious: p.bytes, tx, reason: reason })
				await write(staged.folder + '/' + staged.file, staged.bytes)
				await write(staged.folder + '/manifest.json', JSON.stringify(staged.manifest, null, 1))
				const r = await callConfig('commit', { tx, owner: screen })
				if (!r.ok) {
					throw new Error(r.error || i18n.t('plugins.WorkshopMotors.crashFinal.the_service_could_not_save'))
				}
				backup = r.snapshot || null
			} finally {
				await callConfig('unlock', { owner: screen }).catch(() => {})
			}
		} else if (lock.error === 'without-handler' || /handler|unknown|no respond/i.test(lock.error || '')) {
			// without the service's safe saving: .bak copy and direct PUT
			serviceConfig.value = false
			const d = new Date()
			const stamp = d.toISOString().replace(/[-:]/g, '').slice(0, 15)
			await write(CONFIG + '.bak-' + stamp, p.bytes)
			await write(CONFIG, p.text)
			backup = 'config.g.bak-' + stamp
		} else {
			throw new Error(lock.error || i18n.t('plugins.WorkshopMotors.crashFinal.another_screen_is_saving_the_configuration'))
		}
		api('activity.log', { type: 'calibration', text: reason }).catch(() => {})
		savedMsg.value = backup ? i18n.t('plugins.WorkshopMotors.crashFinal.saved_config_with_copy', { copy: backup }) : i18n.t('plugins.WorkshopMotors.crashFinal.saved_config')
		checked.value = false
	} catch (e) {
		error.value = i18n.t('plugins.WorkshopMotors.common.could_not_save') + (e.message || e)
	} finally {
		saving.value = false
	}
}
// Sends the new lines now (without comments): valid until the next restart
async function applyNow() {
	if (!proposal.value || block(props.om, props.liveJob).blocked) {
		return
	}
	applying.value = true
	try {
		for (const c of proposal.value.changes) {
			const line = String(c.after || '').replace(/;.*$/, '').trim()
			if (line && c.kind !== 'same') {
				const r = await send(line)
				if (/error/i.test(r)) {
					throw new Error(line + ': ' + r)
				}
			}
		}
		savedMsg.value = i18n.t('plugins.WorkshopMotors.crashFinal.applied_home') + axis.value.letter + i18n.t('plugins.WorkshopMotors.crashFinal.carefully_hand_near_the_emergency_stop')
	} catch (e) {
		error.value = i18n.t('plugins.WorkshopMotors.crashFinal.could_not_apply') + (e.message || e)
	} finally {
		applying.value = false
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
	border: 1px solid rgba(198, 40, 40, 0.6);
	border-radius: 6px;
	padding: 8px 12px;
	background: rgba(198, 40, 40, 0.06);
	font-size: 13px;
}
.notices.on {
	border-width: 2px;
	border-color: #c62828;
	background: rgba(198, 40, 40, 0.14);
}
.notices-t {
	font-weight: 600;
	margin-bottom: 4px;
}
.notices ol {
	padding-left: 20px;
}
.stop {
	border: 1px solid rgba(128, 128, 128, 0.3);
	border-radius: 6px;
	padding: 8px 12px;
}
.diff,
.homing {
	font-family: monospace;
	font-size: 12px;
	border: 1px solid rgba(128, 128, 128, 0.3);
	border-radius: 6px;
	padding: 6px 8px;
	overflow-x: auto;
	white-space: pre;
}
.diff .dn {
	display: inline-block;
	min-width: 3.5em;
	color: var(--tp-faint, #9e9e9e);
}
.d-added {
	background: rgba(46, 125, 50, 0.18);
}
.d-deleted {
	background: rgba(198, 40, 40, 0.18);
}
.d-cut,
.d-same {
	color: var(--tp-faint, #9e9e9e);
}
</style>

<style>
/* phone: toggle groups wrap and chips break their text instead of pushing the page wider (not scoped: reaches inside the Vuetify chip) */
.ec-wrap {
	flex-wrap: wrap;
	height: auto !important;
	max-width: 100%;
}
.ec-chips .v-chip {
	max-width: 100%;
	height: auto !important;
	min-height: 24px;
	white-space: normal;
}
.ec-chips .v-chip .v-chip__content {
	max-width: 100%;
	white-space: normal;
	overflow-wrap: anywhere;
}
</style>
