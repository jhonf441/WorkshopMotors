<template>
	<div>
		<div v-if="fresh.state === 'stale'" class="text-body-2 warning--text mb-2">
			<v-icon small color="warning" class="mr-1">mdi-clock-alert-outline</v-icon>{{ t('stale_note') }}
		</div>
		<div v-if="!motors.length" class="text-body-2 motors-faint">{{ report ? t('no_motors') : t('waiting_report') }}</div>
		<div class="motor-grid" :class="{ 'motor-dim': fresh.state !== 'live' }">
			<div v-for="m in motors" :key="m.key" class="motor-card" :class="'sev-' + m.severity">
				<div class="d-flex align-center flex-wrap" style="gap:6px">
					<span class="motor-letter">{{ m.key }}</span>
					<span class="text-caption motors-faint">{{ name(m) }}</span>
					<v-spacer />
					<v-chip small :color="enableColor(m)" :outlined="m.enable !== 'released'" :dark="m.enable === 'released'" :title="t('enable_' + m.enable + '_hint')">
						<v-icon x-small left>{{ enableIcon(m) }}</v-icon>{{ t('enable_' + m.enable) }}
					</v-chip>
				</div>
				<div class="d-flex flex-wrap mt-2" style="gap:4px">
					<v-chip v-if="m.homed !== null" x-small outlined :color="m.homed ? 'success' : 'warning'">{{ m.homed ? t('homed_yes') : t('homed_no') }}</v-chip>
					<v-chip v-for="f in m.faults" :key="f.key" x-small dark :color="f.severity" :title="faultHint(f.key)">
						<v-icon x-small left>{{ f.severity === 'error' ? 'mdi-alert-octagon' : 'mdi-alert' }}</v-icon>{{ faultLabel(f.key) }}
					</v-chip>
					<v-chip v-if="!m.faults.length && m.severity !== 'neutral'" x-small outlined color="success">{{ t('no_faults') }}</v-chip>
				</div>
				<div v-for="f in m.faults" :key="'h' + f.key" class="text-caption mt-1" :class="f.severity + '--text'">{{ faultHint(f.key) }}</div>
				<template v-if="m.speedMmS !== null">
					<div class="motor-line mt-2" :title="t('speed_hint')">
						{{ m.moving ? t('speed_now', { v: smart(m.speedMmS), pct: num(m.pct) }) : t('still') }}<span class="motors-faint"> · {{ t('speed_max', { max: smart(m.maxMmS) }) }}</span>
					</div>
					<v-progress-linear :value="Math.min(100, m.pct || 0)" height="4" rounded :color="(m.pct || 0) >= 95 ? 'warning' : 'primary'" background-color="grey" background-opacity="0.25" />
				</template>
				<div v-if="currentText(m)" class="motor-line mt-1" :title="t('current_hint')">
					{{ currentText(m) }}<span v-if="m.idlePct !== null && m.idlePct !== 100" class="motors-faint"> · {{ t('current_idle', { pct: m.idlePct }) }}</span>
				</div>
				<div class="text-caption motors-faint mt-1">{{ driversText(m) }}</div>
			</div>
		</div>
		<div v-if="moveText" class="text-body-2 mt-3 d-flex align-center flex-wrap" style="gap:6px">
			<v-icon small>mdi-axis-arrow</v-icon>{{ moveText }}
			<v-chip v-if="limited" x-small outlined color="warning">{{ t('move_limited') }}</v-chip>
		</div>
		<v-btn small text class="mt-2 px-1" @click="$emit('release')">
			<v-icon small left>mdi-engine-off-outline</v-icon>{{ t('to_release') }}
		</v-btn>
	</div>
</template>

<script>
'use strict'

// Motors > State: one card per motor (axis or extruder) with what matters at a glance -- whether it has power and
// holding force, homing, the faults by name with what to do, then the current and the speed. The states come already
// derived (motor-state.js); this component only shows them.

import { ENABLE_COLOR, ENABLE_ICON } from './motor-state.js'
import { faultLabel, faultHint } from './faults.js'
import { num, smart } from './format.js'

export default {
	props: {
		motors: { type: Array, required: true },
		report: { type: Object, default: null },
		fresh: { type: Object, required: true }
	},
	computed: {
		moving() {
			return !!this.report && (this.report.top_speed_mm_s > 0 || this.report.requested_speed_mm_s > 0);
		},
		moveText() {
			if (!this.moving) {
				return '';
			}
			return this.t('move_line', { req: smart(this.report.requested_speed_mm_s), top: smart(this.report.top_speed_mm_s) });
		},
		// the planner went slower than the move asked: a limit (speed, acceleration, jerk) is holding it back
		limited() {
			return this.moving && this.report.top_speed_mm_s < this.report.requested_speed_mm_s - 0.1;
		}
	},
	methods: {
		num,
		smart,
		faultLabel,
		faultHint,
		t(key, params) {
			return this.$t('plugins.WorkshopMotors.page.' + key, params);
		},
		name(m) {
			return this.t(m.kind === 'extruder' ? 'extruder_name' : 'axis_name', { key: m.key });
		},
		enableColor(m) {
			return ENABLE_COLOR[m.enable] || 'grey';
		},
		enableIcon(m) {
			return ENABLE_ICON[m.enable] || 'mdi-help-circle-outline';
		},
		currentText(m) {
			if (m.nowMa !== null && m.nowPct !== null) {
				return this.t('current_now', { ma: num(m.nowMa), pct: m.nowPct });
			}
			return m.configuredMa !== null ? this.t('current_configured', { ma: num(m.configuredMa) }) : '';
		},
		driversText(m) {
			const list = m.drivers.map(d => d.id).join(', ');
			const can = (m.drivers.find(d => d.can) || {}).can;
			return can ? this.t('drivers_can', { list, n: can }) : this.t('drivers_main', { list });
		}
	}
};
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
