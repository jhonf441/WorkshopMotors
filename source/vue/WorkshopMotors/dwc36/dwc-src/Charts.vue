<template>
	<div>
		<!-- ===== Charts a eleccion ===== -->
		<div class="text-subtitle-2 mb-1"><v-icon small class="mr-1">mdi-chart-multiple</v-icon>{{ $t('plugins.WorkshopMotors.common.charts') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-caption grey--text mb-2">
			{{ $t('plugins.WorkshopMotors.charts.pick_one_or_several_they_use') }}
		</div>
		</details>
		<v-autocomplete
			v-model="sel" :items="itemsSelector" item-text="name" item-value="id" multiple chips small-chips deletable-chips
			dense outlined hide-details clearable :label="$t('plugins.WorkshopMotors.charts.charts_to_show')" :no-data-text="$t('plugins.WorkshopMotors.charts.waiting_for_data_from_the_service')"
		/>
		<div class="d-flex flex-wrap align-center mt-2" style="gap:6px">
			<v-btn x-small outlined @click="addKind(['cruise', 'speed'])">{{ $t('plugins.WorkshopMotors.charts.speed_of_all') }}</v-btn>
			<v-btn x-small outlined @click="addKind('current')">{{ $t('plugins.WorkshopMotors.charts.current_of_all') }}</v-btn>
			<v-btn x-small outlined @click="addKind('sg')">{{ $t('plugins.WorkshopMotors.charts.stallguard_of_all') }}</v-btn>
			<v-btn x-small outlined @click="addKind(['boardPulses', 'hiccups', 'vin', 'boardTemp'])">{{ $t('plugins.WorkshopMotors.charts.board_series') }}</v-btn>
			<v-btn x-small outlined @click="addTodo()">{{ $t('plugins.WorkshopMotors.charts.all') }}</v-btn>
			<v-btn x-small text @click="sel = []">{{ $t('plugins.WorkshopMotors.charts.remove_all') }}</v-btn>
			<v-spacer />
			<span class="text-caption grey--text">{{ $t('plugins.WorkshopMotors.charts.period') }}</span>
			<v-btn-toggle v-model="spanMin" mandatory dense color="primary">
				<v-btn v-for="r in SPANS" :key="r" x-small :value="r">{{ r < 60 ? r + ' min' : '1 h' }}</v-btn>
			</v-btn-toggle>
			<v-btn-toggle v-model="columns" mandatory dense color="primary">
				<v-btn x-small :value="1" :title="$t('plugins.WorkshopMotors.charts.one_per_row')"><v-icon x-small>mdi-view-agenda-outline</v-icon></v-btn>
				<v-btn x-small :value="2" :title="$t('plugins.WorkshopMotors.charts.two_per_row')"><v-icon x-small>mdi-view-grid-outline</v-icon></v-btn>
			</v-btn-toggle>
		</div>
		<div v-if="historyShort" class="text-caption grey--text mt-1">
			{{ $t('plugins.WorkshopMotors.charts.data_since_min', { n: minutesData }) }}
		</div>
		<div v-if="!(sel && sel.length)" class="text-caption grey--text mt-3">{{ $t('plugins.WorkshopMotors.charts.no_chart_selected') }}</div>
		<v-row dense class="mt-2">
			<v-col v-for="g in charts" :key="g.serial.id" cols="12" :md="columns === 2 ? 6 : 12">
				<div class="chart-card">
					<div class="d-flex align-center flex-wrap" style="gap:6px">
						<span class="text-body-2 font-weight-medium">{{ g.serial.name }}</span>
						<span class="text-caption grey--text">{{ g.serial.group }}</span>
						<v-spacer />
						<span v-if="g.summary" class="text-caption">
							{{ $t('plugins.WorkshopMotors.charts.max') }} <b>{{ fmt(g.summary.max) }}</b> &middot; {{ $t('plugins.WorkshopMotors.charts.min_avg', { min: fmt(g.summary.min), avg: fmt(g.summary.avg) }) }}
						</span>
						<v-btn x-small icon :title="$t('plugins.WorkshopMotors.charts.remove')" @click="remove(g.serial.id)"><v-icon x-small>mdi-close</v-icon></v-btn>
					</div>
					<div class="text-caption grey--text">
						{{ g.serial.note }}<span v-if="g.serial.limit"> &middot; <span class="chart-dash" :style="{ borderColor: REFERENCE_COLOR }" /> {{ g.serial.limitText }}</span>
					</div>
					<!-- one series per chart, the same blue in all (dataviz slot 1), the reference dashed grey; the same window
						 for every chart (it ends now: a silence shows at the right) and the line cut where there was no data -->
					<!-- no sample in the window: no empty axes, a line that says why there is none (and what to do) -->
					<div v-if="!g.pts.length" class="text-caption mt-2 mb-1" style="opacity:.8">{{ g.serial.emptyText || $t('plugins.WorkshopMotors.charts.no_data_in_period') }}</div>
					<detail-chart
						v-else
						:history="g.pts" :color="color" :unit="g.serial.unit" :label="g.serial.name" :legend="false"
						:limit="g.serial.limit" :limit-label="g.serial.limitText" :limit-color="REFERENCE_COLOR"
						:gap-ms="g.serial.gapMs" :x-min="since" :x-max="now" :zero-based="g.serial.zeroBased !== false"
						:height="columns === 2 ? 150 : 180"
					/>
				</div>
			</v-col>
		</v-row>

		<!-- faults of the drivers in the period: events (when they started and ended), not a curve -->
		<div class="text-subtitle-2 mt-4 mb-1"><v-icon small class="mr-1">mdi-alert-outline</v-icon>{{ $t('plugins.WorkshopMotors.charts.alerts_in_the_period') }}</div>
		<div v-if="!alertRows.length" class="text-caption grey--text">{{ $t('plugins.WorkshopMotors.charts.no_alerts_in_period') }}</div>
		<div v-else class="table-scroll">
			<v-simple-table dense>
				<thead>
					<tr>
						<th>{{ $t('plugins.WorkshopMotors.charts.alert_since') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.alert_until') }}</th>
						<th>{{ $t('plugins.WorkshopMotors.common.driver') }}</th><th>{{ $t('plugins.WorkshopMotors.common.axis') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.alert_fault') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(a, i) in alertRows" :key="i">
						<td>{{ hourShort(a.since) }}</td>
						<td>{{ a.until ? hourShort(a.until) : $t('plugins.WorkshopMotors.charts.alert_ongoing') }}</td>
						<td>{{ a.driver }}</td>
						<td>{{ a.axis }}</td>
						<td><v-icon x-small :color="a.severity" class="mr-1">{{ a.severity === 'error' ? 'mdi-alert-octagon' : 'mdi-alert' }}</v-icon>{{ faultLabel(a.key) }}</td>
					</tr>
				</tbody>
			</v-simple-table>
		</div>

		<!-- ===== Reporte avanzado ===== -->
		<v-divider class="my-4" />
		<div class="text-subtitle-2 mb-1"><v-icon small class="mr-1">mdi-file-chart-outline</v-icon>{{ $t('plugins.WorkshopMotors.charts.advanced_report_of_all_motors') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-caption grey--text mb-2">
			{{ $t('plugins.WorkshopMotors.charts.report_intro', { period: spanMin < 60 ? spanMin + ' min' : '1 h' }) }}
		</div>
		</details>
		<div class="d-flex flex-wrap align-center" style="gap:8px">
			<v-btn small color="primary" :loading="reading" :disabled="reading" @click="generate()">
				<v-icon left small>mdi-file-search-outline</v-icon>{{ $t('plugins.WorkshopMotors.charts.generate_report') }}
			</v-btn>
			<template v-if="rep">
				<v-btn small outlined @click="download('txt')"><v-icon left small>mdi-download</v-icon>{{ $t('plugins.WorkshopMotors.charts.text') }}</v-btn>
				<v-btn small outlined @click="download('csv')"><v-icon left small>mdi-download</v-icon>{{ $t('plugins.WorkshopMotors.charts.spreadsheet_csv') }}</v-btn>
				<v-btn small outlined @click="download('json')"><v-icon left small>mdi-download</v-icon>JSON</v-btn>
			</template>
			<span v-if="reading" class="text-caption">{{ $t('plugins.WorkshopMotors.charts.reading_progress', { what: progress }) }}</span>
			<span v-if="slow" class="text-caption warning--text">{{ $t('plugins.WorkshopMotors.charts.the_board_is_slow_to_answer') }}</span>
		</div>
		<v-alert v-if="errorRep" dense outlined type="error" class="mt-2 mb-0">{{ errorRep }}</v-alert>

		<template v-if="rep">
			<div class="d-flex flex-wrap mt-3" style="gap:6px">
				<v-chip small outlined>{{ rep.machine.board || $t('plugins.WorkshopMotors.charts.board_lower') }}{{ rep.machine.firmware ? ' · RRF ' + rep.machine.firmware : '' }}</v-chip>
				<v-chip small outlined>{{ $t('plugins.WorkshopMotors.charts.n_motors_n_drivers', { m: rep.motors.length, d: totalDrivers }) }}</v-chip>
				<v-chip small outlined :color="rep.alerts.length ? 'warning' : 'success'">
					<v-icon x-small left>{{ rep.alerts.length ? 'mdi-alert' : 'mdi-check' }}</v-icon>{{ $t('plugins.WorkshopMotors.charts.n_alerts_in_period', { n: rep.alerts.length }) }}
				</v-chip>
				<v-chip v-if="withoutResponse" small outlined color="warning">{{ $t('plugins.WorkshopMotors.charts.n_commands_no_reply', { n: withoutResponse }) }}</v-chip>
				<span class="text-caption grey--text align-self-center">{{ $t('plugins.WorkshopMotors.charts.generated_at', { time: hourShort(rep.generated) }) }}</span>
			</div>
			<div class="table-scroll mt-2">
				<v-simple-table dense>
					<thead>
						<tr>
							<th>{{ $t('plugins.WorkshopMotors.common.motor') }}</th><th>{{ $t('plugins.WorkshopMotors.common.driver') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.microstepping') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.steps_mm') }}</th><th>{{ $t('plugins.WorkshopMotors.common.current') }}</th><th>{{ $t('plugins.WorkshopMotors.common.max_speed') }}</th>
							<th>{{ $t('plugins.WorkshopMotors.charts.accel') }}</th><th>{{ $t('plugins.WorkshopMotors.common.jerk') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.mode_direction') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.stall_m915') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.measured_speed') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.max_current') }}</th>
							<th>{{ $t('plugins.WorkshopMotors.charts.sg_min') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.now') }}</th><th>{{ $t('plugins.WorkshopMotors.charts.alerts_in_the_period') }}</th>
						</tr>
					</thead>
					<tbody>
						<template v-for="m in rep.motors">
							<tr v-for="(d, i) in m.drivers" :key="m.key + d.id">
								<td><b v-if="i === 0">{{ m.key }}</b></td>
								<td>{{ d.id }}</td>
								<td>1/{{ m.micro }}{{ m.interpolated ? ' (i)' : '' }}</td>
								<td>{{ fmt(m.stepsMm, 2) }}</td>
								<td>{{ fmt(m.current, 0) }} mA</td>
								<td>{{ fmt(m.speedMax, 0) }}</td>
								<td>{{ fmt(m.accel, 0) }}</td>
								<td>{{ fmt(m.jerk, 0) }}</td>
								<td>{{ d.m569.mode || '--' }}<span v-if="d.m569.address"> &middot; {{ d.m569.address }}</span></td>
								<td>{{ d.m915 ? 'S' + d.m915.s + ' F' + d.m915.filter + ' H' + d.m915.h : '--' }}</td>
								<td>{{ fmt(m.speedMaxMeasurement, 0) }}</td>
								<td>{{ d.currentMax == null ? '--' : fmt(d.currentMax, 0) }}</td>
								<td>{{ d.stallGuardMin == null ? '--' : d.stallGuardMin }}</td>
								<td>
									<span v-if="!d.state" class="grey--text">{{ $t('plugins.WorkshopMotors.common.no_data') }}</span>
									<v-chip v-else-if="!d.state.alerts.length && !d.state.gstatError" x-small outlined color="success">{{ $t('plugins.WorkshopMotors.charts.ok') }}</v-chip>
									<v-chip v-for="a in (d.state ? d.state.alerts : [])" :key="a" x-small outlined color="warning" class="mr-1">{{ a }}</v-chip>
								</td>
								<td>
									<span v-if="!d.alerts.length" class="grey--text">{{ $t('plugins.WorkshopMotors.charts.none') }}</span>
									<span v-else>{{ d.alerts.map(ev => faultLabel(ev.key)).join(', ') }}</span>
								</td>
							</tr>
						</template>
					</tbody>
				</v-simple-table>
			</div>
			<div class="text-caption grey--text mt-1">{{ $t('plugins.WorkshopMotors.charts.speeds_in_mm_min_acceleration_in') }}</div>
		</template>
	</div>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import DetailChart from './DetailChart.vue'
import { catalog as catalog, points, summarySerial, commandsReport, armReport, reportText, reportCsv, nameFile, alertsSince, motorsConfig } from './charts.js'
import { historyOf, R } from './record.js'
import { faultLabel } from './faults.js'
import { seriesColor, REFERENCE_COLOR } from './chart-data.js'

const SEL_KEY = 'workshopMotorsChartSel';
const SPAN_KEY = 'workshopMotorsChartSpan';
const spans = [1, 5, 15, 30, 60];

function readLocal(k, def) {
	try {
		const v = JSON.parse(localStorage.getItem(k));
		return v == null ? def : v;
	} catch (e) {
		return def;
	}
}
function saveLocal(k, v) {
	try {
		localStorage.setItem(k, JSON.stringify(v));
	} catch (e) {
		// without localStorage
	}
}

function withTime(p, ms) {
	let t;
	return Promise.race([
		p.finally(() => clearTimeout(t)),
		new Promise((resolve, reject) => { t = setTimeout(() => reject(new Error(i18n.t('plugins.WorkshopMotors.charts.no_reply_in_s', { s: Math.round(ms / 1000) }))), ms); })
	]);
}

export default {
	components: { DetailChart },
	props: {
		report: { type: Object, default: null },
		om: { type: Object, default: null },
		ceiling: { type: Object, default: null }, // the step ceiling measured on this board (its line on the board pulses)
		// { ids, at }: series to show, chosen in another section (Details > See in Charts)
		preselect: { type: Object, default: null }
	},
	data() {
		return {
			SPANS: spans,
			REFERENCE_COLOR,
			now: Date.now(),
			sel: readLocal(SEL_KEY, null),
			spanMin: spans.indexOf(readLocal(SPAN_KEY, 5)) >= 0 ? readLocal(SPAN_KEY, 5) : 5,
			columns: 2,
			reading: false,
			slow: false,
			progress: '',
			errorRep: null,
			rep: null,
			repText: '',
			repCsv: ''
		};
	},
	computed: {
		catalog() {
			return catalog(this.report, this.om, this.ceiling);
		},
		// the series color of the theme of DWC (light / dark steps of the same blue)
		color() {
			return seriesColor(!!(this.$vuetify && this.$vuetify.theme && this.$vuetify.theme.dark));
		},
		alertRows() {
			void R.tick;
			return alertsSince(historyOf.alerts, this.since).slice().reverse();
		},
		itemsSelector() {
			const out = [];
			let group = null;
			for (const s of this.catalog) {
				if (s.group !== group) {
					group = s.group;
					out.push({ header: group });
				}
				out.push(s);
			}
			return out;
		},
		// the window of every chart: the period chosen, ending now (a clock of 1 s moves it even when no data arrive)
		since() {
			return this.now - this.spanMin * 60000;
		},
		charts() {
			void R.tick;
			const byId = {};
			this.catalog.forEach(s => { byId[s.id] = s; });
			return (this.sel || []).filter(id => byId[id]).map(id => ({
				serial: byId[id],
				pts: points(historyOf.h, id, this.since, 600),
				summary: summarySerial(historyOf.h, id, this.since)
			}));
		},
		minutesData() {
			void R.tick;
			const t0 = historyOf.h.t.length ? historyOf.h.t[0] : Date.now();
			return Math.max(0, Math.round((Date.now() - t0) / 60000));
		},
		historyShort() {
			return this.minutesData < this.spanMin;
		},
		totalDrivers() {
			return this.rep ? this.rep.motors.reduce((n, m) => n + m.drivers.length, 0) : 0;
		},
		withoutResponse() {
			if (!this.rep) {
				return 0;
			}
			return Object.values(this.rep.rrf).filter(v => /^\(error|^$/.test(String(v || ''))).length;
		}
	},
	watch: {
		preselect: {
			immediate: true,
			handler(p) {
				if (p && Array.isArray(p.ids) && p.ids.length) {
					this.sel = p.ids.slice();
				}
			}
		},
		sel(v) {
			saveLocal(SEL_KEY, v);
		},
		spanMin(v) {
			saveLocal(SPAN_KEY, v);
		},
		catalog: {
			immediate: true,
			handler(c) {
				// first time: the speed of each axis
				if (this.sel === null && c.length > 1) {
					this.sel = c.filter(s => s.kind === 'speed' && /^axis:[^E]/.test(s.id)).map(s => s.id); // axes, not extruders
				}
			}
		}
	},
	mounted() {
		this._clock = setInterval(() => { this.now = Date.now(); }, 1000);
	},
	beforeDestroy() {
		clearInterval(this._clock);
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		faultLabel,
		fmt(v, dec) {
			if (typeof v !== 'number' || !isFinite(v)) {
				return '--';
			}
			const d = dec == null ? (Math.abs(v) >= 100 ? 0 : 1) : dec;
			return v.toFixed(d);
		},
		hourShort(t) {
			return new Date(t).toLocaleTimeString();
		},
		addKind(kinds) {
			const ts = Array.isArray(kinds) ? kinds : [kinds];
			const nuevos = this.catalog.filter(s => ts.indexOf(s.kind) >= 0).map(s => s.id);
			this.sel = Array.from(new Set((this.sel || []).concat(nuevos)));
		},
		addTodo() {
			this.sel = this.catalog.map(s => s.id);
		},
		remove(id) {
			this.sel = (this.sel || []).filter(x => x !== id);
		},
		async generate() {
			this.reading = true;
			this.slow = false;
			this.errorRep = null;
			const ids = [];
			for (const m of motorsConfig(this.om)) {
				for (const id of m.drivers) {
					if (ids.indexOf(id) < 0) {
						ids.push(id);
					}
				}
			}
			const cmds = commandsReport(ids);
			const rrf = {};
			try {
				for (let i = 0; i < cmds.length; i++) {
					this.progress = cmds[i] + ' (' + (i + 1) + '/' + cmds.length + ')';
					const notice = setTimeout(() => { this.slow = true; }, 15000);
					try {
						rrf[cmds[i]] = String(await withTime(this.sendCode({ code: cmds[i], log: false }), 30000) || '').trim();
					} catch (e) {
						rrf[cmds[i]] = i18n.t('plugins.WorkshopMotors.charts.error_paren', { error: e.message || String(e) });
					} finally {
						clearTimeout(notice);
						this.slow = false;
					}
				}
				const ahora = Date.now();
				const since = ahora - this.spanMin * 60000;
				this.rep = armReport({
					om: this.om, report: this.report, history: historyOf.h, since: since, now: ahora,
					alerts: alertsSince(historyOf.alerts, since), rrf
				});
			} catch (e) {
				this.errorRep = i18n.t('plugins.WorkshopMotors.charts.could_not_build_the_report') + (e.message || e);
			} finally {
				this.reading = false;
				this.progress = '';
			}
		},
		download(kind) {
			if (!this.rep) {
				return;
			}
			let data;
			let mime;
			if (kind === 'csv') {
				data = reportCsv(this.rep);
				mime = 'text/csv';
			} else if (kind === 'json') {
				data = JSON.stringify(this.rep, null, 1);
				mime = 'application/json';
			} else {
				data = reportText(this.rep);
				mime = 'text/plain';
			}
			const url = URL.createObjectURL(new Blob([data], { type: mime + ';charset=utf-8' }));
			const a = document.createElement('a');
			a.href = url;
			a.download = nameFile('motors', kind, this.rep.generated);
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 2000);
		}
	}
};
</script>

<style scoped>
.chart-card {
	border: 1px solid rgba(128, 128, 128, 0.2);
	border-radius: 8px;
	padding: 6px 10px 4px;
}
.table-scroll {
	overflow-x: auto;
}
/* the dashed reference line, drawn in the caption instead of a legend box */
.chart-dash {
	display: inline-block;
	width: 18px;
	border-top: 2px dashed;
	vertical-align: middle;
}
.table-scroll td,
.table-scroll th {
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}
</style>
