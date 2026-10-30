<template>
	<div>
		<div v-if="fresh.state === 'stale'" class="text-body-medium text-warning mb-2">
			<v-icon size="small" color="warning" class="mr-1">mdi-clock-alert-outline</v-icon>{{ t('stale_note') }}
		</div>
		<div v-if="!motors.length" class="text-body-medium motors-faint">{{ report ? t('no_motors') : t('waiting_report') }}</div>
		<div class="motor-grid" :class="{ 'motor-dim': fresh.state !== 'live' }">
			<div v-for="m in motors" :key="m.key" class="motor-card" :class="'sev-' + m.severity">
				<div class="d-flex align-center flex-wrap" style="gap:6px">
					<span class="motor-letter">{{ m.key }}</span>
					<span class="text-body-small motors-faint">{{ name(m) }}</span>
					<v-spacer />
					<v-chip size="small" :color="enableColor(m)" :variant="m.enable === 'released' ? 'flat' : 'outlined'" :title="t('enable_' + m.enable + '_hint')">
						<v-icon size="x-small" start>{{ enableIcon(m) }}</v-icon>{{ t('enable_' + m.enable) }}
					</v-chip>
				</div>
				<div class="d-flex flex-wrap mt-2" style="gap:4px">
					<v-chip v-if="m.homed !== null" size="x-small" variant="outlined" :color="m.homed ? 'success' : 'warning'">{{ m.homed ? t('homed_yes') : t('homed_no') }}</v-chip>
					<v-chip v-for="f in m.faults" :key="f.key" size="x-small" variant="flat" :color="f.severity" :title="faultHint(f.key)">
						<v-icon size="x-small" start>{{ f.severity === 'error' ? 'mdi-alert-octagon' : 'mdi-alert' }}</v-icon>{{ faultLabel(f.key) }}
					</v-chip>
					<v-chip v-if="!m.faults.length && m.severity !== 'neutral'" size="x-small" variant="outlined" color="success">{{ t('no_faults') }}</v-chip>
				</div>
				<div v-for="f in m.faults" :key="'h' + f.key" class="text-body-small mt-1" :class="'text-' + f.severity">{{ faultHint(f.key) }}</div>
				<template v-if="m.speedMmS !== null">
					<div class="motor-line mt-2" :title="t('speed_hint')">
						{{ m.moving ? t('speed_now', { v: smart(m.speedMmS), pct: num(m.pct) }) : t('still') }}<span class="motors-faint"> · {{ t('speed_max', { max: smart(m.maxMmS) }) }}</span>
					</div>
					<v-progress-linear :model-value="Math.min(100, m.pct || 0)" height="4" rounded :color="(m.pct || 0) >= 95 ? 'warning' : 'primary'" bg-color="grey" bg-opacity="0.25" />
				</template>
				<div v-if="currentText(m)" class="motor-line mt-1" :title="t('current_hint')">
					{{ currentText(m) }}<span v-if="m.idlePct !== null && m.idlePct !== 100" class="motors-faint"> · {{ t('current_idle', { pct: m.idlePct }) }}</span>
				</div>
				<div class="text-body-small motors-faint mt-1">{{ driversText(m) }}</div>
			</div>
		</div>
		<div v-if="moveText" class="text-body-medium mt-3 d-flex align-center flex-wrap" style="gap:6px">
			<v-icon size="small">mdi-axis-arrow</v-icon>{{ moveText }}
			<v-chip v-if="limited" size="x-small" variant="outlined" color="warning">{{ t('move_limited') }}</v-chip>
		</div>
		<v-btn size="small" variant="text" class="mt-2 px-1" @click="$emit('release')">
			<v-icon size="small" start>mdi-engine-off-outline</v-icon>{{ t('to_release') }}
		</v-btn>
	</div>
</template>

<script setup>
// Motors > State: one card per motor (axis or extruder) with what matters at a glance -- whether it has power and
// holding force, homing, the faults by name with what to do, then the current and the speed. The states come already
// derived (motor-state.js); this component only shows them.

import { computed } from 'vue'
import { i18n } from './dwc-host.js'
import { ENABLE_COLOR, ENABLE_ICON } from './motor-state.js'
import { faultLabel, faultHint } from './faults.js'
import { num, smart } from './format.js'

const props = defineProps({
	motors: { type: Array, required: true },
	report: { type: Object, default: null },
	fresh: { type: Object, required: true }
})
defineEmits(['release'])

const moving = computed(() => !!props.report && (props.report.top_speed_mm_s > 0 || props.report.requested_speed_mm_s > 0))
const moveText = computed(() => {
	if (!moving.value) {
		return ''
	}
	return t('move_line', { req: smart(props.report.requested_speed_mm_s), top: smart(props.report.top_speed_mm_s) })
})
// the planner went slower than the move asked: a limit (speed, acceleration, jerk) is holding it back
const limited = computed(() => moving.value && props.report.top_speed_mm_s < props.report.requested_speed_mm_s - 0.1)

function t(key, params) {
	return i18n.t('plugins.WorkshopMotors.page.' + key, params)
}
function name(m) {
	return t(m.kind === 'extruder' ? 'extruder_name' : 'axis_name', { key: m.key })
}
function enableColor(m) {
	return ENABLE_COLOR[m.enable] || 'grey'
}
function enableIcon(m) {
	return ENABLE_ICON[m.enable] || 'mdi-help-circle-outline'
}
function currentText(m) {
	if (m.nowMa !== null && m.nowPct !== null) {
		return t('current_now', { ma: num(m.nowMa), pct: m.nowPct })
	}
	return m.configuredMa !== null ? t('current_configured', { ma: num(m.configuredMa) }) : ''
}
function driversText(m) {
	const list = m.drivers.map(d => d.id).join(', ')
	const can = (m.drivers.find(d => d.can) || {}).can
	return can ? t('drivers_can', { list, n: can }) : t('drivers_main', { list })
}
</script>

<style scoped>
.motor-grid {
	display: grid;
	/* min(..., 100%): on a phone a card never asks for more than the width there is */
	grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
	gap: 10px;
}
.motor-dim {
	opacity: 0.6;
}
.motor-card {
	background: rgba(128, 128, 128, 0.08);
	border-radius: 8px;
	padding: 10px 12px;
	border-left: 4px solid #455a64;
}
/* DESIGN.md section 2: the fill of each meaning */
.motor-card.sev-ok {
	border-left-color: #2e7d32;
}
.motor-card.sev-warning {
	border-left-color: #e65100;
}
.motor-card.sev-error {
	border-left-color: #c62828;
}
.motor-letter {
	font-size: 26px;
	font-weight: 600;
	line-height: 1;
}
.motor-line {
	font-size: 13px;
	font-variant-numeric: tabular-nums;
}
</style>
