<template>
	<div>
		<!-- the head of the card (family CardHead): the title of the section and how fresh the data are, at the right -->
		<card-head icon="mdi-engine" :title="t('section_state')" :state="t(fw.key, fw.params)" :state-kind="fw.kind" />
		<div v-if="moveText" class="motor-move">
			<v-icon small class="motor-move-icon">mdi-axis-arrow</v-icon><span>{{ moveText }}</span>
			<span v-if="limited" class="wf-chip wf-state warn">{{ t('move_limited') }}</span>
		</div>
		<div v-if="fresh.state === 'stale'" class="wf-note is-warn mb-2" role="note"><v-icon :size="16" class="wf-note-icon" aria-hidden="true">mdi-clock-alert-outline</v-icon><span>{{ t('stale_note') }}</span></div>
		<div v-if="!motors.length" class="text-body-2 motors-faint">{{ report ? t('no_motors') : t('waiting_report') }}</div>
		<!-- one row of 48 per motor (FAMILIA-REDISENO 5, Motors): letter + name + one line of figures | the data chips of 24 at the right -->
		<div class="motor-list" :class="{ 'motor-dim': fresh.state !== 'live' }">
			<div v-for="m in motors" :key="m.key" class="wf-row motor-row" :class="{ 'motor-unused': m.unused }">
				<div class="motor-who">
					<span class="motor-letter" :class="'sev-' + m.severity" aria-hidden="true">{{ m.key }}</span>
					<div class="wf-row-txt">
						<div class="wf-row-name">{{ name(m) }}</div>
						<div class="wf-row-text motor-line">
							<template v-if="m.speedMmS !== null">
								<span :title="t('speed_hint')">{{ speedText(m) }}</span>
								<!-- MT-2: RRF does not publish the speed of each axis: the number is the cruise speed of the move, and says so here, not only in a tooltip -->
								<span v-if="m.moving" class="wf-chip motor-est" :title="t('speed_hint')">{{ t('speed_estimated') }}</span>
								<span> · </span>
							</template>
							<span v-if="currentText(m)" :title="t('current_hint')">{{ currentText(m) }} · </span>
							<span>{{ driversText(m) }}</span>
						</div>
						<v-progress-linear v-if="m.moving" :value="Math.min(100, m.pct || 0)" height="3" rounded class="motor-bar" :color="(m.pct || 0) >= 95 ? 'warning' : 'primary'" background-color="grey" background-opacity="0.25" />
						<div v-for="f in m.faults" :key="'h' + f.key" class="motor-hint" :class="'motor-hint-' + f.severity">{{ faultHint(f.key) }}</div>
					</div>
				</div>
				<div class="wf-row-control motor-chips">
					<span class="wf-chip wf-state" :class="enableKind(m)" :title="t('enable_' + m.enable + '_hint')">{{ t('enable_' + m.enable) }}</span>
					<span v-if="m.homed !== null" class="wf-chip wf-state" :class="m.homed ? 'ok' : 'warn'">{{ m.homed ? t('homed_yes') : t('homed_no') }}</span>
					<span v-for="f in m.faults" :key="f.key" class="wf-chip wf-state" :class="severityKind(f.severity)" :title="faultHint(f.key)">{{ faultLabel(f.key) }}</span>
					<span v-if="!m.faults.length && m.severity !== 'neutral'" class="wf-chip wf-state ok">{{ t('no_faults') }}</span>
					<span v-if="m.unused" class="wf-chip">{{ t('unused_in_mode', { mode }) }}</span>
				</div>
			</div>
		</div>
		<!-- a way to the "Release / enable" section (the same section of the side bar): plain navigation, so it is never locked here; that section
		     carries its own lock and reason. A text button of 32 under the list (FAMILIA-REDISENO 5: it was a big outlined button) -->
		<v-btn small text class="motor-go" @click="$emit('release')">
			<v-icon small left>mdi-engine-off-outline</v-icon>{{ t('go_release') }}<v-icon small right>mdi-arrow-right</v-icon>
		</v-btn>
	</div>
</template>

<script>
'use strict'

// Motors > State: one row per motor (axis or extruder) with what matters at a glance -- whether it has power and holding
// force, homing, the faults by name with what to do, then the speed, the current and the drivers. The states come already
// derived (motor-state.js); this component only shows them. Look: the family card head, rows of 48 and data chips of 24.

import { ENABLE_KIND, SEVERITY_KIND, freshWord } from './motor-state.js'
import { faultLabel, faultHint } from './faults.js'
import { num, smart } from './format.js'
import CardHead from './CardHead.vue' // vue/_shared36
export default {
	components: { CardHead },
	props: {
		motors: { type: Array, required: true },
		report: { type: Object, default: null },
		fresh: { type: Object, required: true },
		mode: { type: String, default: '' }
	},
	computed: {
		fw() {
			return freshWord(this.fresh);
		},
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
		enableKind(m) {
			return ENABLE_KIND[m.enable] || '';
		},
		severityKind(s) {
			return SEVERITY_KIND[s] || '';
		},
		speedText(m) {
			return (m.moving ? this.t('speed_now', { v: smart(m.speedMmS), pct: num(m.pct) }) : this.t('still')) + ' · ' + this.t('speed_max', { max: smart(m.maxMmS) });
		},
		currentText(m) {
			let s = '';
			if (m.nowMa !== null && m.nowPct !== null) {
				s = this.t('current_now', { ma: num(m.nowMa), pct: m.nowPct });
			} else if (m.configuredMa !== null) {
				s = this.t('current_configured', { ma: num(m.configuredMa) });
			}
			if (s && m.idlePct !== null && m.idlePct !== 100) {
				s += ' · ' + this.t('current_idle', { pct: m.idlePct });
			}
			return s;
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
.motor-move {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px 8px;
	margin: 0 0 8px;
	font-size: 13px;
}
.motor-move-icon {
	color: var(--wf-icon) !important;
}
.motor-dim {
	opacity: 0.6;
}
.motor-unused {
	opacity: 0.65;
}
.motor-row {
	align-items: start;
	padding: 6px 0;
}
.motor-who {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	min-width: 0;
}
/* the letter of the motor in a 32 px box whose border says the worst state of the motor (a meaning colour, DESIGN.md 2): the
   rows replace the grey cards with a coloured side bar of before */
.motor-letter {
	flex: none;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border: 2px solid var(--wf-control-line);
	border-radius: 8px;
	font-size: 16px;
	font-weight: 600;
	line-height: 1;
}
.motor-letter.sev-ok {
	border-color: var(--wf-ok);
}
.motor-letter.sev-warning {
	border-color: var(--wf-warn);
}
.motor-letter.sev-error {
	border-color: var(--wf-err);
}
.motor-line {
	font-variant-numeric: tabular-nums;
}
.motor-est {
	min-height: 20px;
	margin: 0 2px;
	padding: 0 6px;
}
.motor-bar {
	max-width: 320px;
	margin-top: 4px;
}
.motor-hint {
	margin-top: 2px;
	font-size: 12px;
	line-height: 1.35;
}
.motor-hint-error {
	color: var(--wf-c-error-text);
}
.motor-hint-warning {
	color: var(--wf-c-warning-text);
}
/* the chips wrap at the right of the row (below the name in a narrow card: the family .wf-row stacks under 420 px) */
.motor-chips {
	flex-wrap: wrap;
	justify-content: flex-end;
	max-width: 420px;
}
.motor-go {
	margin-top: 8px;
}
</style>
