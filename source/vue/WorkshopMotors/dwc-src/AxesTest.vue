<template>
	<div>
		<div class="explica text-body-medium">
			<v-icon size="small" color="info" class="mr-1">mdi-information</v-icon>
			<template v-if="methodAxis === 'probe'">
				<b>{{ $t('plugins.WorkshopMotors.axesTest.how_it_works_z_with_the') }}</b> {{ $t('plugins.WorkshopMotors.axesTest.how_probe_text', { mm: threshold }) }}
			</template>
			<template v-else>
				<b>{{ $t('plugins.WorkshopMotors.axesTest.how_it_works') }}</b> {{ $t('plugins.WorkshopMotors.axesTest.how_switch_text', { mm: threshold }) }}
			</template>
		</div>

		<!-- Requirements -->
		<div class="d-flex flex-wrap mt-3" style="gap:6px">
			<v-chip v-for="r in requirements" :key="r.text" size="small" :color="r.ok ? 'success' : 'error'" variant="outlined">
				<v-icon size="x-small" start>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
			</v-chip>
		</div>
		<div v-if="axesWithoutMethod.length" class="text-body-small text-medium-emphasis mt-2">
			{{ $t('plugins.WorkshopMotors.axesTest.can_t_be_tested') }} <span v-for="e in axesWithoutMethod" :key="e.letter">{{ e.letter }} ({{ e.reason }}) </span>
		</div>
		<v-alert v-if="pending" density="compact" type="warning" class="mt-3 mb-0" variant="outlined">
			{{ $t('plugins.WorkshopMotors.axesTest.previous_test_interrupted', { axis: pending.axis }) }}
			<v-btn size="x-small" color="warning" class="ml-2" :loading="restoring" @click="restore()">{{ $t('plugins.WorkshopMotors.axesTest.restore_limits') }}</v-btn>
		</v-alert>

		<!-- Form -->
		<v-row density="compact" class="mt-3">
			<v-col cols="12" sm="4">
				<v-btn-toggle v-model="axis" mandatory density="compact" color="primary">
					<v-btn v-for="e in axesInfo" :key="e.letter" size="small" :value="e.letter" :disabled="!e.method" :title="e.reason">
						{{ e.letter }}<v-icon v-if="e.method === 'probe'" size="x-small" end>mdi-arrow-collapse-down</v-icon>
					</v-btn>
				</v-btn-toggle>
			</v-col>
			<v-col cols="12" sm="8" class="toggle-scroll">
				<v-btn-toggle v-model="kind" mandatory density="compact" color="primary">
					<v-btn size="small" value="speed">{{ $t('plugins.WorkshopMotors.axesTest.speed_ladder') }}</v-btn>
					<v-btn size="small" value="acceleration">{{ $t('plugins.WorkshopMotors.axesTest.acceleration_ladder') }}</v-btn>
					<v-btn size="small" value="once">{{ $t('plugins.WorkshopMotors.axesTest.one_test') }}</v-btn>
				</v-btn-toggle>
			</v-col>
		</v-row>
		<v-row density="compact" class="mt-1">
			<template v-if="kind === 'speed'">
				<v-col cols="4" sm="2"><v-text-field v-model.number="vSince" :label="$t('plugins.WorkshopMotors.axesTest.from_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="vUntil" :label="$t('plugins.WorkshopMotors.axesTest.to_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="vStep" :label="$t('plugins.WorkshopMotors.axesTest.step_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="accel" :label="$t('plugins.WorkshopMotors.axesTest.acceleration_mm_s')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			</template>
			<template v-else-if="kind === 'acceleration'">
				<v-col cols="4" sm="2"><v-text-field v-model.number="aSince" :label="$t('plugins.WorkshopMotors.axesTest.from_mm_s')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="aUntil" :label="$t('plugins.WorkshopMotors.axesTest.to_mm_s')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="aStep" :label="$t('plugins.WorkshopMotors.axesTest.step_mm_s')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="speed" :label="$t('plugins.WorkshopMotors.axesTest.speed_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			</template>
			<template v-else>
				<v-col cols="6" sm="2"><v-text-field v-model.number="speed" :label="$t('plugins.WorkshopMotors.axesTest.speed_mm_min')" type="number" density="compact" variant="outlined" hide-details /></v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="accel" :label="$t('plugins.WorkshopMotors.axesTest.acceleration_mm_s')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			</template>
			<v-col cols="3" sm="2"><v-text-field v-model.number="dist" :label="$t('plugins.WorkshopMotors.common.travel_mm')" type="number" density="compact" variant="outlined" hide-details /></v-col>
			<v-col cols="3" sm="2"><v-text-field v-model.number="reps" :label="$t('plugins.WorkshopMotors.axesTest.back_and_forth_moves')" type="number" density="compact" variant="outlined" hide-details /></v-col>
		</v-row>
		<div class="text-body-small text-medium-emphasis mt-1">
			{{ $t('plugins.WorkshopMotors.axesTest.n_tests_minutes', { n: steps.length, min: minutesEstimated }) }}
			<span v-if="noticeDistance" class="text-warning">{{ noticeDistance }}</span>
			{{ $t('plugins.WorkshopMotors.axesTest.stops_by_itself_at_the_first') }}
		</div>

		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<v-btn size="small"
				:color="armed ? 'amber-darken-3' : 'primary'" :disabled="!canBegin || running"
				@click="touchBegin()"
			>
				<v-icon start>{{ armed ? 'mdi-alert' : 'mdi-play' }}</v-icon>
				{{ armed ? $t('plugins.WorkshopMotors.common.tap_again_the_machine_will_move') : $t('plugins.WorkshopMotors.axesTest.start_test') }}
			</v-btn>
			<v-btn size="small" v-if="running" variant="outlined" color="warning" @click="stopRequest = true" :disabled="stopRequest">
				{{ stopRequest ? $t('plugins.WorkshopMotors.axesTest.stops_when_this_step_finishes') : $t('plugins.WorkshopMotors.axesTest.stop_after_this_step') }}
			</v-btn>
			<span v-if="running" class="text-body-medium">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
				{{ $t('plugins.WorkshopMotors.axesTest.step_n_of_total', { n: stepCurrent + 1, total: steps.length, v: steps[stepCurrent].speed, a: steps[stepCurrent].accel }) }}
			</span>
		</div>
		<div class="text-body-small text-medium-emphasis mt-1">
			{{ $t('plugins.WorkshopMotors.axesTest.clear_the_work_area_and_keep') }}
		</div>
		<v-alert v-if="resultMsg" density="compact" variant="outlined" :type="resultKind" class="mt-3 mb-0">{{ resultMsg }}</v-alert>

		<!-- History -->
		<div class="d-flex align-center mt-4 mb-1">
			<div class="text-title-small">{{ $t('plugins.WorkshopMotors.axesTest.saved_results') }}</div>
			<v-spacer />
			<v-btn size="x-small" variant="text" @click="$emit('reload')"><v-icon size="x-small" start>mdi-refresh</v-icon>{{ $t('plugins.WorkshopMotors.axesTest.refresh') }}</v-btn>
		</div>
		<div v-if="!tests.length" class="text-body-small text-medium-emphasis">{{ $t('plugins.WorkshopMotors.axesTest.no_tests_yet_they_re_saved') }}</div>
		<div v-else style="overflow-x:auto">
			<table class="table-res">
				<thead>
					<tr><th>{{ $t('plugins.WorkshopMotors.common.date') }}</th><th>{{ $t('plugins.WorkshopMotors.common.mode') }}</th><th>{{ $t('plugins.WorkshopMotors.common.axis') }}</th><th>{{ $t('plugins.WorkshopMotors.common.speed') }}</th><th>{{ $t('plugins.WorkshopMotors.common.acceleration') }}</th><th>{{ $t('plugins.WorkshopMotors.axesTest.travel') }}</th><th>{{ $t('plugins.WorkshopMotors.common.difference') }}</th><th></th></tr>
				</thead>
				<tbody>
					<tr v-for="(p, k) in testsRecent" :key="k">
						<td>{{ p.dateShort }}</td>
						<td>{{ p.mode }}</td>
						<td>{{ p.axis }}</td>
						<td>{{ p.speed }} mm/min <span class="text-medium-emphasis">({{ (p.speed / 60).toFixed(0) }} mm/s)</span></td>
						<td>{{ p.accel }} mm/s&sup2;</td>
						<td>{{ p.dist }} mm &times;{{ p.reps }}</td>
						<td :class="p.ok ? 'text-success' : 'text-error'">{{ p.dif >= 0 ? '+' : '' }}{{ p.dif.toFixed(3) }} mm</td>
						<td><v-chip size="x-small" :color="p.ok ? 'success' : 'error'" variant="flat">{{ p.ok ? $t('plugins.WorkshopMotors.axesTest.ok') : $t('plugins.WorkshopMotors.axesTest.lost_steps') }}</v-chip></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n, machineModel, sendCode } from './dwc-host.js'
import { reserveMotion } from './workshop-api.js'
import { sequenceBlock, withReservation, refusedText } from './sequence.js'
import { thresholdAxis } from './test-limits.js'

const props = defineProps({
	axes: { type: Array, default: () => [] },
	state: { type: String, default: '' },
	mode: { type: String, default: '' },
	globals: { type: Object, default: () => ({}) },
	tests: { type: Array, default: () => [] }
})
const emit = defineEmits(['reload'])

const axis = ref('X')
const kind = ref('speed')
const vSince = ref(6000)
const vUntil = ref(24000)
const vStep = ref(3000)
const aSince = ref(500)
const aUntil = ref(3000)
const aStep = ref(500)
const speed = ref(12000)
const accel = ref(1000)
const dist = ref(300)
const reps = ref(5)
const armed = ref(false)
const running = ref(false)
const stepCurrent = ref(0)
const stopRequest = ref(false)
const resultMsg = ref(null)
const resultKind = ref('info')
const restoring = ref(false)
let armedTimer = null

// Request 2026-10-09: "what if the motor tests include
// Z and new motors that get assigned": the list comes from the machine.
// switch = physical limit switch (any axis, min or max);
// probe = Z with the BLTouch as limit switch (G30 S-1).
const axesInfo = computed(() => {
	const model = machineModel()
	const sensors = model.sensors || {}
	const ends = sensors.endstops || []
	const probes = sensors.probes || []
	// sensors.endstops is indexed like ALL the axes; props.axes has only the visible ones
	const all = (model.move && model.move.axes) || []
	return props.axes.map((a, i) => {
		const idx = all.indexOf(a)
		const is = ends[idx >= 0 ? idx : i]
		let method = null
		let reason = ''
		if (is && is.type === 'inputPin') {
			method = 'switch'
			reason = is.highEnd ? i18n.t('plugins.WorkshopMotors.axesTest.endstop_at_max') : i18n.t('plugins.WorkshopMotors.axesTest.endstop_at_min')
		} else if (a.letter === 'Z' && is && is.type === 'zProbeAsEndstop' && probes[0]) {
			method = 'probe'
			reason = i18n.t('plugins.WorkshopMotors.axesTest.measured_with_the_probe_bltouch')
		} else {
			reason = i18n.t('plugins.WorkshopMotors.axesTest.has_no_endstop_or_probe_to')
		}
		return { letter: a.letter, method: method, reason: reason, om: a }
	})
})
const axesWithoutMethod = computed(() => axesInfo.value.filter(e => !e.method))
const methodAxis = computed(() => {
	const e = axesInfo.value.find(x => x.letter === axis.value)
	return e ? e.method : null
})
const threshold = computed(() => thresholdAxis(axis.value))
const axisOM = computed(() => props.axes.find(a => a.letter === axis.value) || null)
const requirements = computed(() => {
	const x = props.axes.find(a => a.letter === 'X')
	const y = props.axes.find(a => a.letter === 'Y')
	const z = props.axes.find(a => a.letter === 'Z')
	const e = axisOM.value
	const r = [{ text: i18n.t('plugins.WorkshopMotors.axesTest.power_supply_on'), ok: props.state !== 'off' }]
	if (methodAxis.value === 'probe') {
		r.push({ text: i18n.t('plugins.WorkshopMotors.axesTest.home_x_y_and_z'), ok: !!(x && y && z && x.homed && y.homed && z.homed) })
	} else {
		r.push({ text: i18n.t('plugins.WorkshopMotors.axesTest.home_axis', { axis: axis.value }), ok: !!(e && e.homed) })
	}
	const mt = sequenceBlock(machineModel())
	r.push({ text: mt || i18n.t('plugins.WorkshopMotors.common.no_job_running'), ok: !mt && !['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(props.state) })
	r.push({ text: i18n.t('plugins.WorkshopMotors.axesTest.measurable_axis'), ok: !!methodAxis.value })
	return r
})
const pending = computed(() => {
	if (!props.globals.workshopTestPending) {
		return null
	}
	return { axis: props.globals.workshopTestAxis }
})
const steps = computed(() => {
	const list = []
	const cap = 40
	if (kind.value === 'speed') {
		if (!(vStep.value > 0) || !(vUntil.value >= vSince.value)) {
			return []
		}
		for (let v = vSince.value; v <= vUntil.value && list.length < cap; v += vStep.value) {
			list.push({ speed: Math.round(v), accel: accel.value })
		}
	} else if (kind.value === 'acceleration') {
		if (!(aStep.value > 0) || !(aUntil.value >= aSince.value)) {
			return []
		}
		for (let a = aSince.value; a <= aUntil.value && list.length < cap; a += aStep.value) {
			list.push({ speed: speed.value, accel: Math.round(a) })
		}
	} else if (speed.value > 0 && accel.value > 0) {
		list.push({ speed: speed.value, accel: accel.value })
	}
	return list.filter(p => p.speed > 0 && p.accel > 0)
})
const canBegin = computed(() => requirements.value.every(r => r.ok) && steps.value.length > 0 && !pending.value)
const routeReal = computed(() => {
	const om = axisOM.value
	if (!om) {
		return dist.value
	}
	if (methodAxis.value === 'probe') {
		const start = Math.max(10, om.min + 10)
		return Math.max(0, Math.min(dist.value, om.max - 5 - start))
	}
	return Math.max(0, Math.min(dist.value, om.max - 10 - (om.min + 15)))
})
const noticeDistance = computed(() => {
	// distance needed to accelerate and brake at the requested speed
	const max = steps.value.reduce((m, p) => {
		const v = p.speed / 60
		return Math.max(m, v * v / p.accel)
	}, 0)
	if (max > routeReal.value) {
		return i18n.t('plugins.WorkshopMotors.axesTest.travel_too_short', { mm: routeReal.value.toFixed(0), need: max.toFixed(0) })
	}
	return ''
})
const minutesEstimated = computed(() => {
	let s = 0
	for (const p of steps.value) {
		const v = p.speed / 60
		const t = routeReal.value / v + v / p.accel
		s += 2 * reps.value * t + 25 // + the measurements and the moves to the end stop
	}
	return Math.max(1, Math.round(s / 60))
})
const testsRecent = computed(() => props.tests.slice().reverse().slice(0, 30))

watch(axis, () => {
	disarm()
	valuesPerDefault()
})
watch(kind, () => disarm())

onMounted(() => {
	// if the chosen axis cannot be tested (or does not exist), the first one that can (the axis watcher then
	// fills the values); otherwise the values of this axis now, not the fixed ones above
	const e = methodAxis.value ? null : axesInfo.value.find(x => x.method)
	if (e && e.letter !== axis.value) {
		axis.value = e.letter
	} else {
		valuesPerDefault()
	}
})
onBeforeUnmount(() => clearTimeout(armedTimer))

function send(code, log) {
	return sendCode({ code, log })
}
// initial values according to the axis (Z is much slower than X/Y)
function valuesPerDefault() {
	const om = axisOM.value
	if (!om) return
	const v = om.speed || 6000
	const a = om.acceleration || 500
	const r = x => Math.max(30, Math.round(x / 10) * 10)
	vSince.value = r(v * 0.5)
	vUntil.value = r(v * 2)
	vStep.value = r(v * 0.25)
	speed.value = r(v)
	accel.value = Math.max(5, Math.round(a))
	aSince.value = Math.max(5, Math.round(a * 0.5))
	aUntil.value = Math.max(10, Math.round(a * 3))
	aStep.value = Math.max(5, Math.round(a * 0.5))
	dist.value = methodAxis.value === 'probe' ? 50 : 300
}
function disarm() {
	armed.value = false
	clearTimeout(armedTimer)
}
function touchBegin() {
	if (!armed.value) {
		armed.value = true
		clearTimeout(armedTimer)
		armedTimer = setTimeout(() => { armed.value = false }, 4000)
		return
	}
	disarm()
	run()
}
async function run() {
	running.value = true
	stopRequest.value = false
	resultMsg.value = null
	const letter = axis.value
	const list = steps.value.slice()
	let lastOk = null
	let failure = null
	try {
		// the jog and the other pages wait while it runs (WorkshopService motion owner)
		await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.axes_test', { axis: letter }), async () => {
			for (let k = 0; k < list.length; k++) {
				stepCurrent.value = k
				const p = list[k]
				// it is checked again before each step (not only when drawing the button)
				const mt = sequenceBlock(machineModel())
				if (mt) throw new Error(mt)
				const reply = await send(`M98 P"0:/sys/workshop/macros/axis-test.g" A"${letter}" F${p.speed} C${p.accel} D${Math.round(dist.value)} N${Math.round(reps.value)}`, true)
				if (/error|abort/i.test(reply || '')) {
					throw new Error(reply)
				}
				const g = await readLast(letter, p)
				if (g == null) {
					throw new Error(i18n.t('plugins.WorkshopMotors.axesTest.couldn_t_read_the_test_result'))
				}
				if (Math.abs(g) > thresholdAxis(letter)) {
					failure = { ...p, dif: g }
					break
				}
				lastOk = { ...p, dif: g }
				if (stopRequest.value) {
					break
				}
			}
		})
		if (failure) {
			resultKind.value = 'warning'
			resultMsg.value = i18n.t('plugins.WorkshopMotors.axesTest.lost_steps_at', { axis: letter, v: failure.speed, a: failure.accel, d: failure.dif.toFixed(2) }) + ' ' +
				(lastOk ? i18n.t('plugins.WorkshopMotors.axesTest.last_that_passed', { v: lastOk.speed, a: lastOk.accel }) + ' ' : '') +
				i18n.t('plugins.WorkshopMotors.axesTest.check_the_advisor_to_see_the')
		} else if (lastOk) {
			resultKind.value = 'success'
			resultMsg.value = i18n.t('plugins.WorkshopMotors.axesTest.no_lost_steps_up_to', { axis: letter, v: lastOk.speed, a: lastOk.accel })
		}
	} catch (e) {
		resultKind.value = 'error'
		resultMsg.value = refusedText(e) || i18n.t('plugins.WorkshopMotors.common.the_test_was_interrupted') + (e.message || e)
	} finally {
		running.value = false
		emit('reload')
	}
}
// global.workshopTestLast = "X,speed,accel,dif" (left by the macro)
// (axis/speed/accel are compared so as not to read the previous step's result)
async function readLast(letter, p) {
	for (let i = 0; i < 15; i++) {
		const s = machineModel().global
		const v = s && (typeof s.get === 'function' ? s.get('workshopTestLast') : s.workshopTestLast)
		if (v) {
			const parts = String(v).split(',')
			const dif = parseFloat(parts[3])
			if (parts[0] === letter && Math.abs(parseFloat(parts[1]) - Math.min(p.speed, 36000)) < 1 &&
				Math.abs(parseFloat(parts[2]) - p.accel) < 1 && !isNaN(dif)) {
				return dif
			}
		}
		await new Promise(r => setTimeout(r, 300))
	}
	return null
}
async function restore() {
	restoring.value = true
	try {
		const g = props.globals
		const e = g.workshopTestAxis
		if (/^[XYZUVWABC]$/.test(e || '') && g.workshopTestMode === props.mode) {
			await send(`M98 P"0:/sys/workshop/macros/axis-limits.g" L"${e}" V${g.workshopTestV} C${g.workshopTestAcc}`, true)
		}
		await send('set global.workshopTestPending = false', false)
	} finally {
		restoring.value = false
	}
}
</script>

<style scoped>
/* the three test kinds do not fit a phone in one row: they scroll instead of overflowing the page */
.toggle-scroll {
	overflow-x: auto;
}
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
	font-variant-numeric: tabular-nums;
}
</style>
