<template>
	<div>
		<div v-if="!report" class="text-body-2 motors-faint">{{ t('page.waiting_report') }}</div>
		<template v-else>
			<!-- board and step generation -->
			<div class="det-section">
				<div class="det-title"><v-icon small class="mr-1">mdi-chip</v-icon>{{ t('motors.board_and_pulse_generation') }}</div>
				<div class="det-tiles">
					<div class="det-tile" :class="hiccups.cls">
						<div class="det-label">{{ t('details.hiccups_title') }}</div>
						<div class="det-value">{{ hiccups.value }}</div>
						<div class="det-sub">{{ hiccups.sub }}</div>
					</div>
					<div class="det-tile">
						<div class="det-label">{{ t('details.board_rate') }}</div>
						<div class="det-value">{{ khz(boardRate) }}<small> kHz</small></div>
						<div class="det-sub">{{ ceilingNote }}</div>
					</div>
					<div class="det-tile">
						<div class="det-label">{{ t('details.speed_req_top') }}</div>
						<div class="det-value">{{ smart(report.requested_speed_mm_s) }} / {{ smart(report.top_speed_mm_s) }}<small> mm/s</small></div>
						<div class="det-sub">{{ limited ? t('motors.limited_by_m203_m201_m566') : t('motors.no_active_limit') }}</div>
					</div>
					<div class="det-tile">
						<div class="det-label">{{ t('motors.kinematics') }}</div>
						<div class="det-value det-value-small">{{ kinematicsText(report.kinematics, t) }}</div>
						<div class="det-sub">{{ kinematicsNote(report.kinematics, t) }}</div>
					</div>
				</div>
			</div>

			<!-- one block per axis / extruder -->
			<div v-for="e in entries" :key="'det-' + e.label" class="det-section">
				<div class="det-title d-flex align-center flex-wrap" style="gap:4px 8px">
					<span>{{ entryName(e) }}</span>
					<span class="text-caption motors-faint">{{ t('motors.n_motors', { n: (e.drivers || []).length }) }} &middot; 1/{{ e.microstepping }} &middot; {{ t('motors.steps_per_mm', { n: e.steps_per_mm }) }}</span>
					<v-spacer />
					<v-btn x-small text @click="$emit('charts', seriesOf(e))"><v-icon x-small left>mdi-chart-line</v-icon>{{ t('details.see_in_charts') }}</v-btn>
				</div>
				<div class="det-tiles">
					<div class="det-tile">
						<div class="det-label">{{ t('common.speed') }}</div>
						<div class="det-value">{{ smart(mmMinToS(e.current_speed_mm_min)) }}<small> / {{ smart(mmMinToS(e.max_speed_mm_min)) }} mm/s</small></div>
						<div class="det-sub">{{ speedSourceText(e.speed_source, t) }}</div>
					</div>
					<div class="det-tile">
						<div class="det-label">{{ t('motors.pulses_per_motor') }}</div>
						<div class="det-value">{{ khz(e.current_freq_hz) }}<small> / {{ khz(e.max_freq_hz) }} kHz</small></div>
						<div v-if="ref" class="det-sub">{{ t('motors.at_max_speed_uses_pct', { pct: num(e.max_freq_hz / (ref * 1000) * 100) }) }}</div>
					</div>
					<div class="det-tile">
						<div class="det-label">{{ t('motors.motor_rpm') }}</div>
						<div class="det-value">{{ num(e.current_rpm) }}<small> / {{ num(e.max_rpm) }}</small></div>
						<div class="det-sub">{{ t('details.rpm_note', { n: e.full_steps_per_rev || 200 }) }}</div>
					</div>
					<div class="det-tile">
						<div class="det-label">{{ t('motors.configured_current') }}</div>
						<div class="det-value">{{ e.current_ma != null ? e.current_ma : '--' }}<small> mA</small></div>
						<div class="det-sub">{{ t('motors.pct_moving_idle', { move: e.percent_current, idle: e.percent_stst_current }) }}</div>
					</div>
				</div>
				<div class="det-drivers">
					<div v-for="dr in e.drivers || []" :key="dr.id" class="det-driver">
						<div class="d-flex align-center flex-wrap" style="gap:6px">
							<v-icon small :color="driverLook(dr).color">{{ driverLook(dr).icon }}</v-icon>
							<b class="text-body-2">{{ t('details.driver_id', { id: dr.id }) }}</b>
							<span class="text-caption motors-faint">{{ driverState(dr) }}</span>
							<span v-if="formatText(dr.format, t)" class="text-caption motors-faint" :title="t('motors.where_this_driver_s_alerts_come')">&middot; {{ formatText(dr.format, t) }}</span>
							<v-spacer />
							<span v-if="powered && currentText(dr, t)" class="text-caption">{{ currentText(dr, t) }}</span>
						</div>
						<div class="d-flex flex-wrap mt-1" style="gap:4px">
							<v-chip v-for="f in faultsOf(dr)" :key="f.key" x-small dark :color="f.severity" :title="faultHint(f.key)">{{ faultLabel(f.key) }}</v-chip>
							<v-chip v-if="powered && !faultsOf(dr).length" x-small outlined color="success">{{ t('motors.no_alerts') }}</v-chip>
							<v-chip v-if="powered && dr.gstat && dr.gstat.reset_detected && !dr.gstat.driver_error_latched" x-small outlined color="grey" :title="t('details.gstat_reset_hint')">{{ t('motors.the_driver_restarted') }}</v-chip>
							<v-chip v-if="powered && dr.m122 && dr.m122.sg_min != null" x-small outlined :title="t('motors.stallguard_motor_load_lower_more_load')">{{ t('motors.sg_min_value', { n: dr.m122.sg_min }) }}</v-chip>
							<v-chip v-if="dr.m569" x-small outlined :title="t('motors.pulse_timing_and_driver_mode_m569')">{{ t('details.timing_mode', { timing: dr.m569.timing_raw, mode: dr.m569.mode }) }}</v-chip>
						</div>
						<div v-for="f in faultsOf(dr)" :key="'h' + f.key" class="text-caption mt-1" :class="f.severity + '--text'">{{ faultHint(f.key) }}</div>
					</div>
				</div>
			</div>

			<!-- boards and all their drivers (also the ones without an axis) -->
			<div class="det-section">
				<div class="det-title"><v-icon small class="mr-1">mdi-expansion-card</v-icon>{{ t('motors.boards_and_drivers') }}</div>
				<div class="det-tiles">
					<div v-for="b in report.boards || []" :key="'pl' + b.can_address" class="det-tile">
						<div class="det-label">{{ b.name || b.short_name }} <span class="motors-faint">&middot; {{ b.is_local ? t('motors.main') : 'CAN ' + b.can_address }}</span></div>
						<div class="det-value">{{ khz(b.combined_freq_hz) }}<small> {{ t('motors.khz_now') }}</small></div>
						<div class="det-sub">{{ (b.motors || []).length ? b.motors.map(x => x.label).join(', ') : t('motors.no_motors_assigned') }}</div>
					</div>
				</div>
				<v-text-field
					v-model="search" :label="t('motors.search_driver_board_axis_or_alert')" dense outlined hide-details clearable
					prepend-inner-icon="mdi-magnify" class="mt-3 mb-2" style="max-width:380px"
				/>
				<div class="det-scroll">
					<v-data-table :headers="headers" :items="rows" :search="search" dense :items-per-page="-1" hide-default-footer>
						<template #item.board="{ item }">
							{{ item.boardName }} <v-chip x-small outlined class="ml-1">{{ item.boardLabel }}</v-chip>
						</template>
						<template #item.assignedTo="{ item }">
							<v-chip v-if="item.assignedTo" x-small outlined color="info">{{ item.assignedTo }}</v-chip>
							<span v-else class="motors-faint">{{ t('motors.unassigned') }}</span>
						</template>
						<template #item.faultsText="{ item }">
							<v-chip v-if="!item.faults.length" x-small outlined :color="powered ? 'success' : 'grey'">{{ powered ? t('motors.no_alerts') : t('common.no_data') }}</v-chip>
							<v-chip v-for="f in item.faults" :key="f.key" x-small dark :color="f.severity" class="mr-1">{{ faultLabel(f.key) }}</v-chip>
						</template>
					</v-data-table>
				</div>
			</div>

			<!-- how it is measured -->
			<v-expansion-panels flat class="mt-2">
				<v-expansion-panel>
					<v-expansion-panel-header class="px-0"><span><v-icon small class="mr-1">mdi-help-circle-outline</v-icon>{{ t('motors.how_this_data_is_measured') }}</span></v-expansion-panel-header>
					<v-expansion-panel-content class="text-body-2 det-help">
						<p v-for="k in HELP" :key="k"><b>{{ t('details.help_' + k + '_title') }}</b> {{ t('details.help_' + k) }}</p>
					</v-expansion-panel-content>
				</v-expansion-panel>
			</v-expansion-panels>
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
import {
	speedSourceText, formatText, currentText, hiccupsTile, speedLimited, refKhz, boardRateHz, ceilingText, kinematicsText,
	kinematicsNote, driverRows
} from './report-view.js'

export default {
	props: {
		report: { type: Object, default: null },
		ceiling: { type: Object, default: null }
	},
	data() {
		return { search: '', HELP: ['hiccups', 'reference', 'speed', 'alerts'] };
	},
	computed: {
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
.det-section {
	margin-bottom: 18px;
	padding-bottom: 12px;
	border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}
.det-title {
	font-weight: 500;
	margin-bottom: 8px;
}
/* min(..., 100%): on a phone a card never asks for more than the width there is */
.det-tiles {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
	gap: 8px;
}
.det-tile {
	background: rgba(128, 128, 128, 0.08);
	border-radius: 8px;
	padding: 8px 12px;
	border-left: 3px solid transparent;
}
/* DESIGN.md section 2 */
.det-good {
	border-left-color: #2e7d32;
}
.det-bad {
	border-left-color: #c62828;
}
.det-label {
	font-size: 12px;
	color: var(--tp-faint, #9e9e9e);
}
.det-value {
	font-size: 20px;
	font-weight: 500;
	font-variant-numeric: tabular-nums;
}
.det-value small {
	font-size: 12px;
	color: var(--tp-faint, #9e9e9e);
	font-weight: 400;
}
.det-value-small {
	font-size: 16px;
}
.det-sub {
	font-size: 12px;
	color: var(--tp-faint, #9e9e9e);
}
.det-drivers {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
	gap: 8px;
	margin-top: 8px;
}
.det-driver {
	padding: 8px 10px;
	border: 1px solid rgba(128, 128, 128, 0.2);
	border-radius: 8px;
}
.det-scroll {
	overflow-x: auto;
}
.det-help p {
	margin-bottom: 8px;
}
</style>
