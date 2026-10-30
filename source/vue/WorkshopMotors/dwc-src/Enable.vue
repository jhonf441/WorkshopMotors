<template>
	<div>
		<div class="text-body-medium mb-2">{{ e('disabling_a_motor_cuts_its_current') }}</div>

		<!-- Level 4 (DESIGN.md): fixed notices + "Understood"; with it ticked ONE tap releases (the box replaces the double tap) -->
		<v-alert density="compact" variant="outlined" type="error" class="mb-3 enabled-level4">
			<div class="text-title-small">{{ e('releasing_motors_the_machine_is_without') }}</div>
			<ul class="text-body-small">
				<li v-for="(a, i) in noticesLevel4" :key="i">{{ a }}</li>
			</ul>
			<v-checkbox v-model="understood" density="compact" hide-details class="mt-1 mb-0 pt-0" :disabled="lock.blocked" :label="e('understood_i_will_release_the_motors')" />
		</v-alert>

		<v-alert v-if="!atLeast('technician')" density="compact" variant="outlined" type="info" class="mb-3">{{ e('role_cannot_release') }}</v-alert>
		<v-alert v-if="lock.blocked" density="compact" variant="outlined" type="warning" class="mb-3">{{ lock.reason }}</v-alert>
		<div v-if="textIdle" class="text-body-small enabled-faint mb-2">{{ textIdle }}</div>

		<div class="enabled-grid">
			<div v-for="m in motors" :key="m.key" class="enabled-card" :class="'enabled-' + m.state">
				<div class="d-flex align-center flex-wrap" style="gap:6px">
					<v-checkbox
						:model-value="sel.indexOf(m.key) >= 0" density="compact" hide-details class="mt-0 pt-0"
						:disabled="lock.blocked || busy" @update:model-value="choose(m.key, $event)"
					/>
					<span class="enabled-name">{{ m.label }}</span>
					<v-spacer />
					<v-chip size="x-small" :variant="m.state !== 'released' ? 'outlined' : 'flat'" :color="stateColor(m.state)" :title="s('enable_' + m.state + '_hint')">
						<v-icon size="x-small" start>{{ stateIcon(m.state) }}</v-icon>{{ s('enable_' + m.state) }}
					</v-chip>
				</div>
				<div class="d-flex flex-wrap mt-1" style="gap:4px">
					<v-chip v-if="m.kind === 'axis'" size="x-small" variant="outlined" :color="m.homed ? 'success' : 'warning'">
						{{ m.homed ? s('homed_yes') : s('homed_no') }}
					</v-chip>
					<v-chip v-if="!m.visible" size="x-small" variant="outlined" color="grey">{{ e('hidden_axis') }}</v-chip>
					<v-chip v-if="pending(m.key)" size="x-small" variant="outlined" color="info">
						<v-progress-circular indeterminate size="10" width="2" class="mr-1" />{{ e('confirming') }}
					</v-chip>
				</div>
				<div class="mt-2">
					<div v-for="d in m.drivers" :key="d.id" class="enabled-driver">
						<v-icon size="x-small" :color="driverColor(d.enabled)">{{ driverIcon(d.enabled) }}</v-icon>
						<span>{{ $t('plugins.WorkshopMotors.details.driver_id', { id: d.id }) }}</span>
						<span class="enabled-faint">&middot; {{ d.board === 'main' ? e('main_board') : d.board }}</span>
						<v-spacer />
						<span class="enabled-faint">{{ textDriver(d) }}</span>
					</div>
				</div>
				<div class="d-flex flex-wrap mt-2" style="gap:6px">
					<v-btn size="small" variant="outlined" color="error" :disabled="!canRelease || !holding(m)" :title="holding(m) ? undefined : e('already_released')" @click="touch('disable', [m.key], m.key)">
						<v-icon size="small" start>mdi-engine-off-outline</v-icon>{{ e('release_one') }}
					</v-btn>
					<v-btn
						size="small" :color="isArmed('enable', m.key) ? 'amber-darken-3' : undefined"
						:variant="!isArmed('enable', m.key) ? 'outlined' : 'flat'" :disabled="!canEnable || m.state === 'enabled'" :title="m.state === 'enabled' ? e('already_enabled') : undefined" @click="touch('enable', [m.key], m.key)"
					>
						<v-icon size="small" start>{{ isArmed('enable', m.key) ? 'mdi-alert' : 'mdi-engine-outline' }}</v-icon>
						{{ isArmed('enable', m.key) ? e('tap_again_enable') + m.key : $t('plugins.WorkshopMotors.common.enable') }}
					</v-btn>
				</div>
			</div>
		</div>
		<div v-if="!motors.length" class="text-body-small enabled-faint">{{ e('there_are_no_axes_or_extruders') }}</div>

		<!-- the selection and all -->
		<div class="enabled-bar mt-3">
			<div class="d-flex align-center flex-wrap" style="gap:6px">
				<span class="text-title-small mr-1">{{ e('selected_list', { list: sel.length ? sel.join(', ') : e('none') }) }}</span>
				<v-btn size="small" variant="text" :disabled="lock.blocked || busy" @click="sel = motors.map(m => m.key)">{{ e('select_all') }}</v-btn>
				<v-btn size="small" variant="text" :disabled="!sel.length" @click="sel = []">{{ e('none_2') }}</v-btn>
			</div>
			<div class="d-flex flex-wrap mt-2" style="gap:6px">
				<v-btn size="small" variant="outlined" color="error" :disabled="!canRelease || !sel.length || !anyHolding(selMotors)" @click="touch('disable', sel.slice(), 'sel')">
					<v-icon size="small" start>mdi-engine-off-outline</v-icon>{{ e('release_selected') }}
				</v-btn>
				<v-btn
					size="small" :color="isArmed('enable', 'sel') ? 'amber-darken-3' : undefined"
					:variant="!isArmed('enable', 'sel') ? 'outlined' : 'flat'" :disabled="!canEnable || !sel.length || !anyNotEnabled(selMotors)" @click="touch('enable', sel.slice(), 'sel')"
				>
					<v-icon size="small" start>{{ isArmed('enable', 'sel') ? 'mdi-alert' : 'mdi-engine-outline' }}</v-icon>
					{{ isArmed('enable', 'sel') ? e('tap_again_enable') + sel.join(', ') : e('enable_selected') }}
				</v-btn>
				<v-spacer />
				<v-btn size="small" variant="outlined" color="error" :disabled="!canRelease || !motors.length || !anyHolding(motors)" @click="touch('disable', null, 'all')">
					<v-icon size="small" start>mdi-engine-off</v-icon>{{ e('release_all') }}
				</v-btn>
				<v-btn
					size="small" :color="isArmed('enable', 'all') ? 'amber-darken-3' : undefined"
					:variant="!isArmed('enable', 'all') ? 'outlined' : 'flat'" :disabled="!canEnable || !motors.length || !anyNotEnabled(motors)" @click="touch('enable', null, 'all')"
				>
					<v-icon size="small" start>{{ isArmed('enable', 'all') ? 'mdi-alert' : 'mdi-engine' }}</v-icon>
					{{ isArmed('enable', 'all') ? e('tap_again_enable_all') : e('enable_all') }}
				</v-btn>
			</div>
			<!-- what is going to happen: for the selection, or for what is armed -->
			<div v-if="noticesView.list.length" class="enabled-notices mt-2" :class="{ 'enabled-notices-armed': !!armed }">
				<div class="text-body-small font-weight-medium">
					{{ armed ? e('tap_again_to_confirm') : e('if_you_release_the_selection') }} &middot; {{ noticesView.command }}
				</div>
				<ul class="text-body-small">
					<li v-for="(a, i) in noticesView.list" :key="i">{{ a }}</li>
				</ul>
			</div>
		</div>

		<div v-if="!understood && !lock.blocked" class="text-body-small enabled-faint mt-2">{{ e('to_release_first_tick_understood') }}</div>
		<div v-if="busy" class="text-body-small mt-2">{{ e('sending') }}</div>
		<v-alert v-if="result" density="compact" variant="outlined" :type="result.ok ? 'success' : 'error'" class="mt-2 mb-0">{{ result.text }}</v-alert>

		<v-expansion-panels variant="accordion" class="mt-2">
			<v-expansion-panel>
				<v-expansion-panel-title class="px-0"><span><v-icon size="small" class="mr-1">mdi-help-circle-outline</v-icon>{{ e('what_can_and_cannot_be_done') }}</span></v-expansion-panel-title>
				<v-expansion-panel-text class="text-body-medium">
					<p><b>{{ e('per_axis_or_extruder_not_per') }}</b> {{ e('the_firmware_reprapfirmware_enables_and') }}</p>
					<p><b>{{ e('commands') }}</b> {{ e('m18_x_one_axis_m18_e0') }}</p>
					<p><b>{{ e('they_enable_themselves') }}</b> {{ e('any_move_of_that_axis_jog') }}</p>
					<p><b>{{ e('idle') }}</b> {{ e('motors_at_rest_are_not_disabled') }}</p>
					<details class="wf-more">
						<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
					<p><b>{{ e('how_the_state_is_known') }}</b> {{ e('the_firmware_does_not_publish_it') }}</p>
					</details>
				</v-expansion-panel-text>
			</v-expansion-panel>
		</v-expansion-panels>
	</div>
</template>

<script setup>
// Motors > Release / enable: M18 / M17 per axis or extruder, the selection or all, through the service's API.
// Release = level 4 (fixed notices + "Understood", then one tap); enable = level 2 (double tap): RULES of enable.js.
// The risk bar and the lights of "motors without force" come from the service (motorReport.released), whoever released
// them: this page only sends the orders and shows the state.

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { i18n } from './dwc-host.js'
import { useRole } from './use-role.js' // what the role may do (vue/_shared)
import { apiText } from './workshop-api.js'
import { machineFree } from './machine-free.js'
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { motorsOf, block, command, notices, textIdle as idleTextOf, noticesLevel4 as level4Notices, tap, canUse } from './enable.js'
import { ENABLE_COLOR, ENABLE_ICON } from './motor-state.js'
import { sendMotors, ANSWER_MS } from './motors-send.js'

const props = defineProps({
	report: { type: Object, default: null },
	om: { type: Object, required: true },
	liveJob: { type: [Object, Boolean], default: null }
})

const { atLeast } = useRole()

const sel = ref([])
const armed = ref(null) // { id, until, action, keys } of the armed double tap
const busy = ref(false)
const result = ref(null)
const waiting = ref(null) // { keys, seq, until }: the reading of the drivers that confirms the order
const understood = ref(false)
const now = ref(Date.now())
let clock = null

const motors = computed(() => motorsOf(props.om, props.report))
const reserved = computed(() => {
	const f = machineFree(props.om, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings', allowBusy: true })
	return f.code === 'reserved' ? f.reason : ''
})
const lock = computed(() => block(props.om, props.liveJob, { report: props.report, reserved: reserved.value }))
// what each button can do depends on the real state of the motor: a holding motor has nothing to enable, a released one nothing to release
const selMotors = computed(() => motors.value.filter(m => sel.value.indexOf(m.key) >= 0))
function holding(m) {
	return m.state !== 'released' && m.state !== 'off' && m.state !== 'unpowered'
}
const anyHolding = list => list.some(m => holding(m))
const anyNotEnabled = list => list.some(m => m.state !== 'enabled')
const canRelease = computed(() => atLeast('technician') && canUse('disable', lock.value, understood.value, busy.value))
const canEnable = computed(() => atLeast('operator') && canUse('enable', lock.value, understood.value, busy.value))
const noticesLevel4 = computed(() => level4Notices())
const textIdle = computed(() => idleTextOf(props.om))
// what is going to happen: the armed order, or a release of the selection
const noticesView = computed(() => {
	const action = armed.value ? armed.value.action : 'disable'
	const keys = armed.value ? armed.value.keys : (sel.value.length ? sel.value : null)
	if (!armed.value && !sel.value.length) {
		return { list: [], command: '' }
	}
	const affected = keys ? motors.value.filter(m => keys.indexOf(m.key) >= 0) : motors.value
	return { list: notices(action, affected, props.om), command: command(action, keys) }
})

watch(() => props.report && props.report.enabled_seq, seq => {
	if (waiting.value && typeof seq === 'number' && seq > waiting.value.seq) {
		waiting.value = null
	}
})
watch(() => lock.value.blocked, b => {
	if (b) {
		disarm()
		understood.value = false
	}
})

onMounted(() => {
	clock = setInterval(() => {
		now.value = Date.now()
		if (waiting.value && now.value > waiting.value.until) {
			waiting.value = null
		}
		if (armed.value && now.value >= armed.value.until) {
			armed.value = null
		}
	}, 500)
})
onBeforeUnmount(() => clearInterval(clock))

function e(key, params) {
	return i18n.t('plugins.WorkshopMotors.enable.' + key, params)
}
function s(key, params) {
	return i18n.t('plugins.WorkshopMotors.page.' + key, params)
}
function choose(key, on) {
	const i = sel.value.indexOf(key)
	if (on && i < 0) {
		sel.value.push(key)
	} else if (!on && i >= 0) {
		sel.value.splice(i, 1)
	}
}
function isArmed(action, id) {
	return !!armed.value && armed.value.action === action && armed.value.id === action + ':' + id
}
function disarm() {
	armed.value = null
}
// one tap: a release fires at once (the level 4 box already confirmed it); an enable arms first (double tap)
function touch(action, keys, id) {
	if (!canUse(action, lock.value, understood.value, busy.value)) {
		return
	}
	now.value = Date.now()
	const name = action + ':' + id
	const r = tap(action, name, armed.value && armed.value.action === action ? armed.value : null, now.value)
	result.value = null
	if (r.armed) {
		armed.value = Object.assign({ action, keys }, r.armed)
		return
	}
	disarm()
	send(action, keys)
}
async function send(action, keys) {
	busy.value = true
	const seq = props.report && typeof props.report.enabled_seq === 'number' ? props.report.enabled_seq : null
	const r = await sendMotors(apiText, action, keys)
	busy.value = false
	if (!r.ok) {
		result.value = { ok: false, text: r.error }
		return
	}
	const list = keys || motors.value.map(m => m.key)
	if (seq != null) {
		waiting.value = { keys: list, seq, until: Date.now() + ANSWER_MS }
	}
	const cmd = r.command || command(action, keys)
	const what = keys ? keys.join(', ') : e('all_lower')
	result.value = {
		ok: true,
		text: action === 'disable'
			? e('disabled_list_cmd', { list: what, cmd }) + ' ' + e('home_the_machine_before_working_again')
			: e('enabled_list_cmd', { list: what, cmd })
	}
	if (action === 'disable') {
		sel.value = []
		understood.value = false // the next release: read the notices again
	}
}
function pending(key) {
	return !!waiting.value && waiting.value.keys.indexOf(key) >= 0
}
function stateColor(state) {
	return ENABLE_COLOR[state] || 'grey'
}
function stateIcon(state) {
	return ENABLE_ICON[state] || 'mdi-help-circle-outline'
}
function driverColor(v) {
	return v === true ? 'success' : 'grey'
}
function driverIcon(v) {
	if (v === true) return 'mdi-checkbox-blank-circle'
	if (v === false) return 'mdi-checkbox-blank-circle-outline'
	return 'mdi-help-circle-outline'
}
function textDriver(d) {
	if (props.report && props.report.without_power_supply) return e('no_power')
	if (d.enabled === true) return e('st_enabled')
	if (d.enabled === false) return e('st_disabled')
	return d.board === 'main' ? e('no_data_yet') : e('cannot_be_read_can')
}
</script>

<style scoped>
/* min(..., 100%): on a phone a card never asks for more than the width there is */
.enabled-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
	gap: 10px;
}
.enabled-card {
	background: rgba(128, 128, 128, 0.08);
	border-radius: 8px;
	padding: 10px 12px;
	border-left: 4px solid #455a64;
}
/* DESIGN.md section 2: the fill of each meaning */
.enabled-card.enabled-enabled {
	border-left-color: #2e7d32;
}
.enabled-card.enabled-partial {
	border-left-color: #e65100;
}
.enabled-card.enabled-released {
	border-left-color: #c62828;
}
.enabled-name {
	font-size: 16px;
	font-weight: 600;
}
.enabled-driver {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
}
.enabled-faint {
	color: var(--tp-faint, #9e9e9e);
}
.enabled-bar {
	padding: 10px 12px;
	border: 1px solid rgba(128, 128, 128, 0.25);
	border-radius: 8px;
}
.enabled-level4 ul {
	margin: 2px 0 0;
	padding-left: 18px;
}
.enabled-notices {
	padding: 6px 10px;
	border-left: 3px solid #e65100;
	background: rgba(230, 81, 0, 0.06);
	border-radius: 4px;
}
.enabled-notices-armed {
	border-left-color: #ff8f00;
	background: rgba(255, 143, 0, 0.12);
}
.enabled-notices ul {
	margin: 2px 0 0;
	padding-left: 18px;
}
</style>
