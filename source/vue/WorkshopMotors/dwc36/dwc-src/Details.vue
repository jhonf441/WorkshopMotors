<template>
	<div>
		<card-head icon="mdi-tune-vertical" :title="t('motors.details')" :state="fresh ? t('page.' + fw.key, fw.params) : ''" :state-kind="fw.kind" />
		<div v-if="!report" class="text-body-2 motors-faint">{{ t('page.waiting_report') }}</div>
		<template v-else>
			<!-- board and step generation: figures in the family grid of 160 (FAMILIA-REDISENO 3), no grey tiles -->
			<section class="wf-group">
				<h4 class="wf-group-title det-gtitle"><v-icon small class="det-gicon">mdi-chip</v-icon>{{ t('motors.board_and_pulse_generation') }}</h4>
				<div class="wf-stats">
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('details.hiccups_title') }}</span>
						<span class="wf-stat-value">{{ hiccups.value }}</span>
						<!-- with a reading: the family state dot (green 0, red when the board fell behind); without one, a plain grey line -->
						<span v-if="hiccups.cls" class="wf-state" :class="hiccups.cls === 'det-good' ? 'ok' : 'err'">{{ hiccups.sub }}</span>
						<span v-else class="det-sub">{{ hiccups.sub }}</span>
					</div>
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('details.board_rate') }}</span>
						<span class="wf-stat-value">{{ khz(boardRate) }}<small class="det-unit"> kHz</small></span>
						<span class="det-sub">{{ ceilingNote }}</span>
					</div>
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('details.speed_req_top') }}</span>
						<span class="wf-stat-value">{{ smart(report.requested_speed_mm_s) }} / {{ smart(report.top_speed_mm_s) }}<small class="det-unit"> mm/s</small></span>
						<span class="det-sub">{{ limited ? t('motors.limited_by_m203_m201_m566') : t('motors.no_active_limit') }}</span>
					</div>
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('motors.kinematics') }}</span>
						<span class="wf-stat-value det-value-small">{{ kinematicsText(report.kinematics, t) }}</span>
						<span class="det-sub">{{ kinematicsNote(report.kinematics, t) }}</span>
					</div>
				</div>
			</section>

			<!-- one group per axis / extruder: its figures and ONE table of its drivers (rows of 40) instead of a card per driver -->
			<section v-for="e in entries" :key="'det-' + e.label" class="wf-group">
				<div class="det-head">
					<h4 class="wf-group-title det-gtitle">{{ entryName(e) }}</h4>
					<span class="det-meta">{{ t('motors.n_motors', { n: (e.drivers || []).length }) }} &middot; 1/{{ e.microstepping }} &middot; {{ t('motors.steps_per_mm', { n: e.steps_per_mm }) }}</span>
					<v-btn small text class="det-charts" @click="$emit('charts', seriesOf(e))"><v-icon small left>mdi-chart-line</v-icon>{{ t('details.see_in_charts') }}</v-btn>
				</div>
				<div class="wf-stats">
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('common.speed') }}</span>
						<span class="wf-stat-value">{{ smart(mmMinToS(e.current_speed_mm_min)) }}<small class="det-unit"> / {{ smart(mmMinToS(e.max_speed_mm_min)) }} mm/s</small></span>
						<span class="det-sub">{{ speedSourceText(e.speed_source, t) }}</span>
					</div>
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('motors.pulses_per_motor') }}</span>
						<span class="wf-stat-value">{{ khz(e.current_freq_hz) }}<small class="det-unit"> / {{ khz(e.max_freq_hz) }} kHz</small></span>
						<span v-if="ref" class="det-sub">{{ t('motors.at_max_speed_uses_pct', { pct: num(e.max_freq_hz / (ref * 1000) * 100) }) }}</span>
					</div>
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('motors.motor_rpm') }}</span>
						<span class="wf-stat-value">{{ num(e.current_rpm) }}<small class="det-unit"> / {{ num(e.max_rpm) }}</small></span>
						<span class="det-sub">{{ t('details.rpm_note', { n: e.full_steps_per_rev || 200 }) }}</span>
					</div>
					<div class="wf-stat">
						<span class="wf-stat-label">{{ t('motors.configured_current') }}</span>
						<span class="wf-stat-value">{{ e.current_ma != null ? e.current_ma : '--' }}<small class="det-unit"> mA</small></span>
						<span class="det-sub">{{ t('motors.pct_moving_idle', { move: e.percent_current, idle: e.percent_stst_current }) }}</span>
					</div>
				</div>
				<div class="det-scroll">
					<table class="wf-table det-drivers">
						<thead>
							<tr><th>{{ t('common.driver') }}</th><th>{{ t('details.col_state') }}</th><th>{{ t('common.current') }}</th><th>{{ t('common.alerts') }}</th></tr>
						</thead>
						<tbody>
							<tr v-for="dr in e.drivers || []" :key="dr.id">
								<td class="det-nowrap"><v-icon small class="det-dicon" :color="driverLook(dr).color">{{ driverLook(dr).icon }}</v-icon><b>{{ dr.id }}</b></td>
								<td>
									<span>{{ driverState(dr) }}</span>
									<span v-if="formatText(dr.format, t)" class="det-faint" :title="t('motors.where_this_driver_s_alerts_come')"> &middot; {{ formatText(dr.format, t) }}</span>
								</td>
								<td class="det-nowrap">{{ powered && currentText(dr, t) ? currentText(dr, t) : '--' }}</td>
								<td>
									<span class="det-chips">
										<span v-for="f in faultsOf(dr)" :key="f.key" class="wf-chip wf-state" :class="f.severity === 'error' ? 'err' : 'warn'" :title="faultHint(f.key)">{{ faultLabel(f.key) }}</span>
										<span v-if="powered && !faultsOf(dr).length" class="wf-chip wf-state ok">{{ t('motors.no_alerts') }}</span>
										<span v-if="powered && dr.gstat && dr.gstat.reset_detected && !dr.gstat.driver_error_latched" class="wf-chip" :title="t('details.gstat_reset_hint')">{{ t('motors.the_driver_restarted') }}</span>
										<span v-if="powered && dr.m122 && dr.m122.sg_min != null" class="wf-chip" :title="t('motors.stallguard_motor_load_lower_more_load')">{{ t('motors.sg_min_value', { n: dr.m122.sg_min }) }}</span>
										<span v-if="dr.m569" class="wf-chip" :title="t('motors.pulse_timing_and_driver_mode_m569')">{{ t('details.timing_mode', { timing: dr.m569.timing_raw, mode: dr.m569.mode }) }}</span>
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<!-- what each fault means and what to do: written under the table, not only in a tooltip -->
				<template v-for="dr in e.drivers || []">
					<div v-for="f in faultsOf(dr)" :key="'h' + dr.id + f.key" class="det-hint" :class="'det-hint-' + f.severity">{{ t('details.driver_id', { id: dr.id }) }}: {{ faultHint(f.key) }}</div>
				</template>
			</section>

			<!-- boards and all their drivers (also the ones without an axis) -->
			<section class="wf-group">
				<h4 class="wf-group-title det-gtitle"><v-icon small class="det-gicon">mdi-expansion-card</v-icon>{{ t('motors.boards_and_drivers') }}</h4>
				<div class="wf-stats">
					<div v-for="b in report.boards || []" :key="'pl' + b.can_address" class="wf-stat">
						<span class="wf-stat-label">{{ b.name || b.short_name }} &middot; {{ b.is_local ? t('motors.main') : 'CAN ' + b.can_address }}</span>
						<span class="wf-stat-value">{{ khz(b.combined_freq_hz) }}<small class="det-unit"> {{ t('motors.khz_now') }}</small></span>
						<span class="det-sub">{{ (b.motors || []).length ? b.motors.map(x => x.label).join(', ') : t('motors.no_motors_assigned') }}</span>
					</div>
				</div>
				<v-text-field
					v-model="search" :label="t('motors.search_driver_board_axis_or_alert')" dense outlined hide-details clearable
					prepend-inner-icon="mdi-magnify" class="det-search"
				/>
				<div class="det-scroll">
					<table class="wf-table">
						<thead>
							<tr><th v-for="h in headers" :key="h.value">{{ h.text }}</th></tr>
						</thead>
						<tbody>
							<tr v-for="item in shownRows" :key="item.id">
								<td class="det-nowrap"><b>{{ item.id }}</b></td>
								<td>{{ item.boardName }} <span class="wf-chip">{{ item.boardLabel }}</span></td>
								<td>
									<span v-if="item.assignedTo" class="wf-chip">{{ item.assignedTo }}</span>
									<span v-else class="det-faint">{{ t('motors.unassigned') }}</span>
								</td>
								<td>
									<span class="det-chips">
										<span v-if="!item.faults.length" class="wf-chip" :class="powered ? 'wf-state ok' : ''">{{ powered ? t('motors.no_alerts') : t('common.no_data') }}</span>
										<span v-for="f in item.faults" :key="f.key" class="wf-chip wf-state" :class="f.severity === 'error' ? 'err' : 'warn'">{{ faultLabel(f.key) }}</span>
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>

			<!-- how it is measured: the one fold of the section, at the foot -->
			<help-fold class="mt-2" :title="t('motors.how_this_data_is_measured')" :items="HELP.map(k => ({ title: t('details.help_' + k + '_title'), what: t('details.help_' + k) }))" />
		</template>
	</div>
</template>

<script>
'use strict'

// Motors > Details: the board and its step generation, each axis / extruder with its drivers, every board with every
// driver (also the ones without an axis) and how each value is measured. The time series are in Charts ("See in
// charts" opens them with this axis selected). What it computes from the report lives in report-view.js (tested).

import { faultsOfDriver, faultLabel, faultHint, worstSeverity } from './faults.js'
import { num, smart, khz, mmMinToS } from './format.js'
import { freshWord } from './motor-state.js'
import HelpFold from './HelpFold.vue' // vue/_shared36
import CardHead from './CardHead.vue' // vue/_shared36
import {
	speedSourceText, formatText, currentText, hiccupsTile, speedLimited, refKhz, boardRateHz, ceilingText, kinematicsText,
	kinematicsNote, driverRows, rowsMatching
} from './report-view.js'

export default {
	components: { HelpFold, CardHead },
	props: {
		report: { type: Object, default: null },
		ceiling: { type: Object, default: null },
		fresh: { type: Object, default: null }
	},
	data() {
		return { search: '', HELP: ['hiccups', 'reference', 'speed', 'alerts'] };
	},
	computed: {
		fw() {
			return freshWord(this.fresh);
		},
		// the rows of the table of every driver that match the search (the id, the board, the axis or the alert as written)
		shownRows() {
			return rowsMatching(this.rows, this.search);
		},
		entries() {
			return ((this.report && this.report.entries) || []).filter(e => e && e.label);
		},
		powered() {
			return !!this.report && !this.report.without_power_supply;
		},
		hiccups() {
			return hiccupsTile(this.report, this.t);
		},
		boardRate() {
			return boardRateHz(this.report);
		},
		ceilingNote() {
			return ceilingText(this.ceiling, this.report, this.t);
		},
		ref() {
			return refKhz(this.ceiling, this.report);
		},
		limited() {
			return speedLimited(this.report);
		},
		headers() {
			return [
				{ text: this.t('common.driver'), value: 'id' },
				{ text: this.t('common.board'), value: 'board' },
				{ text: this.t('motors.assigned_to'), value: 'assignedTo' },
				{ text: this.t('common.alerts'), value: 'faultsText' }
			];
		},
		rows() {
			return driverRows(this.report, this.t, this.powered);
		}
	},
	methods: {
		num,
		smart,
		khz,
		mmMinToS,
		faultLabel,
		faultHint,
		speedSourceText,
		formatText,
		currentText,
		kinematicsText,
		kinematicsNote,
		// the page's translator: key relative to plugins.WorkshopMotors
		t(key, params) {
			return this.$t('plugins.WorkshopMotors.' + key, params);
		},
		entryName(e) {
			return /^E\d+$/.test(e.label) ? this.t('page.extruder_name', { key: e.label }) : this.t('motors.axis_name', { axis: e.label });
		},
		faultsOf(dr) {
			return this.powered ? faultsOfDriver(dr) : [];
		},
		driverState(dr) {
			if (!this.powered) {
				return this.t('page.enable_unpowered');
			}
			if (dr.m122 && dr.m122.state) {
				return dr.m122.state; // the firmware's own word (standstill, ok...): shown as it is
			}
			return dr.gstat_supported ? this.t('motors.waiting_m122') : this.t('motors.can_board_no_m122');
		},
		driverLook(dr) {
			if (!this.powered) {
				return { icon: 'mdi-power-plug-off-outline', color: 'grey' };
			}
			const w = worstSeverity(faultsOfDriver(dr));
			if (w === 'error') {
				return { icon: 'mdi-alert-octagon', color: 'error' };
			}
			return w === 'warning' ? { icon: 'mdi-alert', color: 'warning' } : { icon: 'mdi-check-circle-outline', color: 'success' };
		},
		// the series of Charts of this axis: its speed and the current and load of each of its drivers
		seriesOf(e) {
			const ids = ['axis:' + e.label + ':speed'];
			for (const dr of e.drivers || []) {
				ids.push('drv:' + dr.id + ':current', 'drv:' + dr.id + ':sg');
			}
			return ids;
		}
	}
};
</script>

<style scoped>
/* the pieces come from the family (.wf-group, .wf-stats / .wf-stat, .wf-table, .wf-chip, .wf-state): here only the layout of this section */
.det-gtitle {
	display: flex;
	align-items: center;
	gap: 6px;
}
.det-gicon {
	color: var(--wf-icon) !important;
}
.det-head {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px 8px;
	margin-bottom: 8px;
}
.det-head .wf-group-title {
	margin: 0;
}
.det-meta {
	font-size: 12px;
	opacity: 0.75;
}
.det-charts {
	margin-left: auto;
}
/* the unit after a figure: smaller and quieter than the value */
.det-unit {
	font-size: 12px;
	font-weight: 400;
	opacity: 0.75;
}
.det-value-small {
	font-size: 16px;
}
.det-sub {
	font-size: 12px;
	opacity: 0.75;
}
.det-scroll {
	overflow-x: auto;
	margin-top: 12px;
}
.det-nowrap {
	white-space: nowrap;
}
.det-dicon {
	margin-right: 6px;
}
.det-faint {
	opacity: 0.75;
}
.det-chips {
	display: inline-flex;
	flex-wrap: wrap;
	gap: 4px;
	padding: 4px 0;
}
.det-hint {
	margin-top: 6px;
	font-size: 12px;
	line-height: 1.35;
}
.det-hint-error {
	color: var(--wf-c-error-text);
}
.det-hint-warning {
	color: var(--wf-c-warning-text);
}
.det-search {
	max-width: 380px;
	margin-top: 12px;
}
</style>
