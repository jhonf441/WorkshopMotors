<template>
	<div>
		<div class="explica text-body-2">
			<v-icon small color="info" class="mr-1">mdi-information</v-icon>
			<template v-if="methodAxis === 'probe'">
				<b>{{ $t('plugins.WorkshopMotors.axesTest.how_it_works_z_with_the') }}</b> {{ $t('plugins.WorkshopMotors.axesTest.how_probe_text', { mm: threshold }) }}
			</template>
			<template v-else>
				<b>{{ $t('plugins.WorkshopMotors.axesTest.how_it_works') }}</b> {{ $t('plugins.WorkshopMotors.axesTest.how_switch_text', { mm: threshold }) }}
			</template>
		</div>

		<!-- Requirements -->
		<div class="d-flex flex-wrap mt-3" style="gap:6px">
			<v-chip v-for="r in requirements" :key="r.text" small :color="r.ok ? 'success' : 'error'" outlined>
				<v-icon x-small left>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
			</v-chip>
		</div>
		<div v-if="axesWithoutMethod.length" class="text-caption grey--text mt-2">
			{{ $t('plugins.WorkshopMotors.axesTest.can_t_be_tested') }} <span v-for="e in axesWithoutMethod" :key="e.letter">{{ e.letter }} ({{ e.reason }}) </span>
		</div>
		<v-alert v-if="pending" dense type="warning" class="mt-3 mb-0" outlined>
			{{ $t('plugins.WorkshopMotors.axesTest.previous_test_interrupted', { axis: pending.axis }) }}
			<v-btn x-small color="warning" class="ml-2" :loading="restoring" @click="restore()">{{ $t('plugins.WorkshopMotors.axesTest.restore_limits') }}</v-btn>
		</v-alert>

		<!-- Form -->
		<v-row dense class="mt-3">
			<v-col cols="12" sm="4">
				<v-btn-toggle v-model="axis" mandatory dense color="primary">
					<v-btn v-for="e in axesInfo" :key="e.letter" small :value="e.letter" :disabled="!e.method" :title="e.reason">
						{{ e.letter }}<v-icon v-if="e.method === 'probe'" x-small right>mdi-arrow-collapse-down</v-icon>
					</v-btn>
				</v-btn-toggle>
			</v-col>
			<v-col cols="12" sm="8" class="toggle-scroll">
				<v-btn-toggle v-model="kind" mandatory dense color="primary">
					<v-btn small value="speed">{{ $t('plugins.WorkshopMotors.axesTest.speed_ladder') }}</v-btn>
					<v-btn small value="acceleration">{{ $t('plugins.WorkshopMotors.axesTest.acceleration_ladder') }}</v-btn>
					<v-btn small value="once">{{ $t('plugins.WorkshopMotors.axesTest.one_test') }}</v-btn>
				</v-btn-toggle>
			</v-col>
		</v-row>
		<v-row dense class="mt-1">
			<template v-if="kind === 'speed'">
				<v-col cols="4" sm="2"><v-text-field v-model.number="vSince" :label="$t('plugins.WorkshopMotors.axesTest.from_mm_min')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="vUntil" :label="$t('plugins.WorkshopMotors.axesTest.to_mm_min')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="vStep" :label="$t('plugins.WorkshopMotors.axesTest.step_mm_min')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="accel" :label="$t('plugins.WorkshopMotors.axesTest.acceleration_mm_s')" type="number" dense outlined hide-details /></v-col>
			</template>
			<template v-else-if="kind === 'acceleration'">
				<v-col cols="4" sm="2"><v-text-field v-model.number="aSince" :label="$t('plugins.WorkshopMotors.axesTest.from_mm_s')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="aUntil" :label="$t('plugins.WorkshopMotors.axesTest.to_mm_s')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="4" sm="2"><v-text-field v-model.number="aStep" :label="$t('plugins.WorkshopMotors.axesTest.step_mm_s')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="speed" :label="$t('plugins.WorkshopMotors.axesTest.speed_mm_min')" type="number" dense outlined hide-details /></v-col>
			</template>
			<template v-else>
				<v-col cols="6" sm="2"><v-text-field v-model.number="speed" :label="$t('plugins.WorkshopMotors.axesTest.speed_mm_min')" type="number" dense outlined hide-details /></v-col>
				<v-col cols="6" sm="2"><v-text-field v-model.number="accel" :label="$t('plugins.WorkshopMotors.axesTest.acceleration_mm_s')" type="number" dense outlined hide-details /></v-col>
			</template>
			<v-col cols="3" sm="2"><v-text-field v-model.number="dist" :label="$t('plugins.WorkshopMotors.common.travel_mm')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="3" sm="2"><v-text-field v-model.number="reps" :label="$t('plugins.WorkshopMotors.axesTest.back_and_forth_moves')" type="number" dense outlined hide-details /></v-col>
		</v-row>
		<div class="text-caption grey--text mt-1">
			{{ $t('plugins.WorkshopMotors.axesTest.n_tests_minutes', { n: steps.length, min: minutesEstimated }) }}
			<span v-if="noticeDistance" class="warning--text">{{ noticeDistance }}</span>
			{{ $t('plugins.WorkshopMotors.axesTest.stops_by_itself_at_the_first') }}
		</div>

		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<v-btn small
				:color="armed ? 'amber darken-3' : 'primary'" :dark="armed" :disabled="!canBegin || running"
				@click="touchBegin()"
			>
				<v-icon left>{{ armed ? 'mdi-alert' : 'mdi-play' }}</v-icon>
				{{ armed ? $t('plugins.WorkshopMotors.common.tap_again_the_machine_will_move') : $t('plugins.WorkshopMotors.axesTest.start_test') }}
			</v-btn>
			<v-btn small v-if="running" outlined color="warning" @click="stopRequest = true" :disabled="stopRequest">
				{{ stopRequest ? $t('plugins.WorkshopMotors.axesTest.stops_when_this_step_finishes') : $t('plugins.WorkshopMotors.axesTest.stop_after_this_step') }}
			</v-btn>
			<span v-if="running" class="text-body-2">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />
				{{ $t('plugins.WorkshopMotors.axesTest.step_n_of_total', { n: stepCurrent + 1, total: steps.length, v: steps[stepCurrent].speed, a: steps[stepCurrent].accel }) }}
			</span>
		</div>
		<div class="text-caption grey--text mt-1">
			{{ $t('plugins.WorkshopMotors.axesTest.clear_the_work_area_and_keep') }}
		</div>
		<v-alert v-if="resultMsg" dense outlined :type="resultKind" class="mt-3 mb-0">{{ resultMsg }}</v-alert>

		<!-- History -->
		<div class="d-flex align-center mt-4 mb-1">
			<div class="text-subtitle-2">{{ $t('plugins.WorkshopMotors.axesTest.saved_results') }}</div>
			<v-spacer />
			<v-btn x-small text @click="$emit('reload')"><v-icon x-small left>mdi-refresh</v-icon>{{ $t('plugins.WorkshopMotors.axesTest.refresh') }}</v-btn>
		</div>
		<div v-if="!tests.length" class="text-caption grey--text">{{ $t('plugins.WorkshopMotors.axesTest.no_tests_yet_they_re_saved') }}</div>
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
						<td>{{ p.speed }} mm/min <span class="grey--text">({{ (p.speed / 60).toFixed(0) }} mm/s)</span></td>
						<td>{{ p.accel }} mm/s&sup2;</td>
						<td>{{ p.dist }} mm &times;{{ p.reps }}</td>
						<td :class="p.ok ? 'success--text' : 'error--text'">{{ p.dif >= 0 ? '+' : '' }}{{ p.dif.toFixed(3) }} mm</td>
						<td><v-chip x-small :color="p.ok ? 'success' : 'error'" text-color="white">{{ p.ok ? $t('plugins.WorkshopMotors.axesTest.ok') : $t('plugins.WorkshopMotors.axesTest.lost_steps') }}</v-chip></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { reserveMotion } from './workshop-api.js'
import { sequenceBlock, withReservation, refusedText } from './sequence.js'

export const THRESHOLD_MM = 0.1;
// Step-loss threshold per axis: with a switch (G1 H4) ~0.1 mm; Z is measured
// with the probe (G30 S-1, repeatability ~0.01 mm) and a whole Z step is
// ~0.04 mm, so 0.03 mm is used.
export function thresholdAxis(axis) {
	return axis === 'Z' ? 0.03 : THRESHOLD_MM;
}

export default {
	props: {
		axes: { type: Array, default: () => [] },
		state: { type: String, default: '' },
		mode: { type: String, default: '' },
		globals: { type: Object, default: () => ({}) },
		tests: { type: Array, default: () => [] }
	},
	data() {
		return {
				axis: 'X',
			kind: 'speed',
			vSince: 6000,
			vUntil: 24000,
			vStep: 3000,
			aSince: 500,
			aUntil: 3000,
			aStep: 500,
			speed: 12000,
			accel: 1000,
			dist: 300,
			reps: 5,
			armed: false,
			armedTimer: null,
			running: false,
			stepCurrent: 0,
			stopRequest: false,
			resultMsg: null,
			resultKind: 'info',
			restoring: false
		};
	},
		computed: {
			// Request 2026-10-09: "what if the motor tests include
			// Z and new motors that get assigned": the list comes from the machine.
			// switch = physical limit switch (any axis, min or max);
			// probe = Z with the BLTouch as limit switch (G30 S-1).
			axesInfo() {
				const sensors = this.$store.state.machine.model.sensors || {};
				const ends = sensors.endstops || [];
				const probes = sensors.probes || [];
				// sensors.endstops is indexed like ALL the axes; this.axes has only the visible ones
				const all = (this.$store.state.machine.model.move && this.$store.state.machine.model.move.axes) || [];
				return this.axes.map((a, i) => {
					const idx = all.indexOf(a);
					const is = ends[idx >= 0 ? idx : i];
					let method = null;
					let reason = '';
					if (is && is.type === 'inputPin') {
						method = 'switch';
						reason = is.highEnd ? i18n.t('plugins.WorkshopMotors.axesTest.endstop_at_max') : i18n.t('plugins.WorkshopMotors.axesTest.endstop_at_min');
					} else if (a.letter === 'Z' && is && is.type === 'zProbeAsEndstop' && probes[0]) {
						method = 'probe';
						reason = i18n.t('plugins.WorkshopMotors.axesTest.measured_with_the_probe_bltouch');
					} else {
						reason = i18n.t('plugins.WorkshopMotors.axesTest.has_no_endstop_or_probe_to');
					}
					return { letter: a.letter, method: method, reason: reason, om: a };
				});
			},
			axesWithoutMethod() {
				return this.axesInfo.filter(e => !e.method);
			},
			methodAxis() {
				const e = this.axesInfo.find(x => x.letter === this.axis);
				return e ? e.method : null;
			},
			threshold() {
				return thresholdAxis(this.axis);
			},
			axisOM() {
				return this.axes.find(a => a.letter === this.axis) || null;
			},
			requirements() {
				const x = this.axes.find(a => a.letter === 'X');
				const y = this.axes.find(a => a.letter === 'Y');
				const z = this.axes.find(a => a.letter === 'Z');
				const e = this.axisOM;
				const r = [{ text: i18n.t('plugins.WorkshopMotors.axesTest.power_supply_on'), ok: this.state !== 'off' }];
				if (this.methodAxis === 'probe') {
					r.push({ text: i18n.t('plugins.WorkshopMotors.axesTest.home_x_y_and_z'), ok: !!(x && y && z && x.homed && y.homed && z.homed) });
				} else {
					r.push({ text: i18n.t('plugins.WorkshopMotors.axesTest.home_axis', { axis: this.axis }), ok: !!(e && e.homed) });
				}
				const mt = sequenceBlock(this.$store.state.machine.model);
				r.push({ text: mt || i18n.t('plugins.WorkshopMotors.common.no_job_running'), ok: !mt && !['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(this.state) });
				r.push({ text: i18n.t('plugins.WorkshopMotors.axesTest.measurable_axis'), ok: !!this.methodAxis });
				return r;
			},
		canBegin() {
			return this.requirements.every(r => r.ok) && this.steps.length > 0 && !this.pending;
		},
		pending() {
			if (!this.globals.workshopTestPending) {
				return null;
			}
			return { axis: this.globals.workshopTestAxis };
		},
		steps() {
			const list = [];
			const cap = 40;
			if (this.kind === 'speed') {
				if (!(this.vStep > 0) || !(this.vUntil >= this.vSince)) {
					return [];
				}
				for (let v = this.vSince; v <= this.vUntil && list.length < cap; v += this.vStep) {
					list.push({ speed: Math.round(v), accel: this.accel });
				}
			} else if (this.kind === 'acceleration') {
				if (!(this.aStep > 0) || !(this.aUntil >= this.aSince)) {
					return [];
				}
				for (let a = this.aSince; a <= this.aUntil && list.length < cap; a += this.aStep) {
					list.push({ speed: this.speed, accel: Math.round(a) });
				}
			} else if (this.speed > 0 && this.accel > 0) {
				list.push({ speed: this.speed, accel: this.accel });
			}
			return list.filter(p => p.speed > 0 && p.accel > 0);
		},
		routeReal() {
			const om = this.axisOM;
			if (!om) {
				return this.dist;
			}
				if (this.methodAxis === 'probe') {
					const start = Math.max(10, om.min + 10);
					return Math.max(0, Math.min(this.dist, om.max - 5 - start));
				}
				return Math.max(0, Math.min(this.dist, om.max - 10 - (om.min + 15)));
		},
		noticeDistance() {
			// distance needed to accelerate and brake at the requested speed
			const max = this.steps.reduce((m, p) => {
				const v = p.speed / 60;
				return Math.max(m, v * v / p.accel);
			}, 0);
			if (max > this.routeReal) {
				return i18n.t('plugins.WorkshopMotors.axesTest.travel_too_short', { mm: this.routeReal.toFixed(0), need: max.toFixed(0) });
			}
			return '';
		},
		minutesEstimated() {
			let s = 0;
			for (const p of this.steps) {
				const v = p.speed / 60;
				const t = this.routeReal / v + v / p.accel;
				s += 2 * this.reps * t + 25; // + the measurements and the moves to the end stop
			}
			return Math.max(1, Math.round(s / 60));
		},
		testsRecent() {
			return this.tests.slice().reverse().slice(0, 30);
		}
	},
		watch: {
			axis() {
				this.disarm();
				this.valuesPerDefault();
			},
		kind() {
			this.disarm();
		}
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
	},
		mounted() {
			// if the chosen axis cannot be tested (or does not exist), the first one that can (the axis watcher then
			// fills the values); otherwise the values of this axis now, not the fixed ones of data()
			const e = this.methodAxis ? null : this.axesInfo.find(x => x.method);
			if (e && e.letter !== this.axis) {
				this.axis = e.letter;
			} else {
				this.valuesPerDefault();
			}
		},
		methods: {
			...mapActions('machine', ['sendCode']),
			// initial values according to the axis (Z is much slower than X/Y)
			valuesPerDefault() {
				const om = this.axisOM;
				if (!om) return;
				const v = om.speed || 6000;
				const a = om.acceleration || 500;
				const r = x => Math.max(30, Math.round(x / 10) * 10);
				this.vSince = r(v * 0.5);
				this.vUntil = r(v * 2);
				this.vStep = r(v * 0.25);
				this.speed = r(v);
				this.accel = Math.max(5, Math.round(a));
				this.aSince = Math.max(5, Math.round(a * 0.5));
				this.aUntil = Math.max(10, Math.round(a * 3));
				this.aStep = Math.max(5, Math.round(a * 0.5));
				this.dist = this.methodAxis === 'probe' ? 50 : 300;
			},
		disarm() {
			this.armed = false;
			clearTimeout(this.armedTimer);
		},
		touchBegin() {
			if (!this.armed) {
				this.armed = true;
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armed = false; }, 4000);
				return;
			}
			this.disarm();
			this.run();
		},
		async run() {
			this.running = true;
			this.stopRequest = false;
			this.resultMsg = null;
			const letter = this.axis;
			const steps = this.steps.slice();
			let lastOk = null;
			let failure = null;
			try {
				// the jog and the other pages wait while it runs (WorkshopService motion owner)
				await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.axes_test', { axis: letter }), async () => {
					for (let k = 0; k < steps.length; k++) {
						this.stepCurrent = k;
						const p = steps[k];
						// it is checked again before each step (not only when drawing the button)
						const mt = sequenceBlock(this.$store.state.machine.model);
						if (mt) throw new Error(mt);
						const reply = await this.sendCode({
							code: `M98 P"0:/sys/workshop/macros/axis-test.g" A"${letter}" F${p.speed} C${p.accel} D${Math.round(this.dist)} N${Math.round(this.reps)}`,
							log: true
						});
						if (/error|abort/i.test(reply || '')) {
							throw new Error(reply);
						}
						const g = await this.readLast(letter, p);
						if (g == null) {
							throw new Error(i18n.t('plugins.WorkshopMotors.axesTest.couldn_t_read_the_test_result'));
						}
						if (Math.abs(g) > thresholdAxis(letter)) {
							failure = { ...p, dif: g };
							break;
						}
						lastOk = { ...p, dif: g };
						if (this.stopRequest) {
							break;
						}
					}
				});
				if (failure) {
					this.resultKind = 'warning';
					this.resultMsg = i18n.t('plugins.WorkshopMotors.axesTest.lost_steps_at', { axis: letter, v: failure.speed, a: failure.accel, d: failure.dif.toFixed(2) }) + ' ' +
						(lastOk ? i18n.t('plugins.WorkshopMotors.axesTest.last_that_passed', { v: lastOk.speed, a: lastOk.accel }) + ' ' : '') +
						i18n.t('plugins.WorkshopMotors.axesTest.check_the_advisor_to_see_the');
				} else if (lastOk) {
					this.resultKind = 'success';
					this.resultMsg = i18n.t('plugins.WorkshopMotors.axesTest.no_lost_steps_up_to', { axis: letter, v: lastOk.speed, a: lastOk.accel });
				}
			} catch (e) {
				this.resultKind = 'error';
				this.resultMsg = refusedText(e) || i18n.t('plugins.WorkshopMotors.common.the_test_was_interrupted') + (e.message || e);
			} finally {
				this.running = false;
				this.$emit('reload');
			}
		},
		// global.workshopTestLast = "X,speed,accel,dif" (left by the macro)
		// (axis/speed/accel are compared so as not to read the previous step's result)
		async readLast(axis, p) {
			for (let i = 0; i < 15; i++) {
				const s = this.$store.state.machine.model.global;
				const v = s && (typeof s.get === 'function' ? s.get('workshopTestLast') : s.workshopTestLast);
				if (v) {
					const parts = String(v).split(',');
					const dif = parseFloat(parts[3]);
					if (parts[0] === axis && Math.abs(parseFloat(parts[1]) - Math.min(p.speed, 36000)) < 1 &&
						Math.abs(parseFloat(parts[2]) - p.accel) < 1 && !isNaN(dif)) {
						return dif;
					}
				}
				await new Promise(r => setTimeout(r, 300));
			}
			return null;
		},
		async restore() {
			this.restoring = true;
			try {
				const g = this.globals;
				const e = g.workshopTestAxis;
					if (/^[XYZUVWABC]$/.test(e || '') && g.workshopTestMode === this.mode) {
						await this.sendCode({ code: `M98 P"0:/sys/workshop/macros/axis-limits.g" L"${e}" V${g.workshopTestV} C${g.workshopTestAcc}`, log: true });
					}
				await this.sendCode({ code: 'set global.workshopTestPending = false', log: false });
			} finally {
				this.restoring = false;
			}
		}
	}
};
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
