<template>
	<div>
		<!-- ===================== Step ceiling ===================== -->
		<div class="text-subtitle-1 mb-1"><v-icon small class="mr-1">mdi-pulse</v-icon>{{ $t('plugins.WorkshopMotors.measure.your_board_s_pulse_ceiling') }}</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="explica text-body-2">
			<v-icon small color="info" class="mr-1">mdi-information</v-icon>
			{{ $t('plugins.WorkshopMotors.measure.ceiling_intro', { micro: MICRO }) }} <b>hiccups</b> {{ $t('plugins.WorkshopMotors.measure.pulses_it_didn_t_generate_in') }}
		</div>
		</details>
		<div class="d-flex flex-wrap mt-3" style="gap:6px">
			<v-chip v-for="r in reqCeiling" :key="r.text" small :color="r.ok ? 'success' : 'error'" outlined>
				<v-icon x-small left>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
			</v-chip>
		</div>
		<v-alert v-if="globals.workshopCeilingPending" dense type="warning" class="mt-3 mb-0" outlined>
			{{ $t('plugins.WorkshopMotors.measure.previous_measurement_interrupted', { axis: globals.workshopCeilingAxis }) }}
			<v-btn x-small color="warning" class="ml-2" :loading="restoring" @click="restoreCeiling()">{{ $t('plugins.WorkshopMotors.measure.restore') }}</v-btn>
		</v-alert>
		<v-row dense class="mt-3">
			<v-col cols="12" sm="3">
				<v-btn-toggle v-model="axisT" mandatory dense color="primary">
					<v-btn v-for="a in axes" :key="a.letter" small :value="a.letter">{{ a.letter }}</v-btn>
				</v-btn-toggle>
			</v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="kSince" :label="$t('plugins.WorkshopMotors.measure.from_khz')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="kUntil" :label="$t('plugins.WorkshopMotors.measure.to_khz')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="4" sm="2"><v-text-field v-model.number="kStep" :label="$t('plugins.WorkshopMotors.measure.step_khz')" type="number" dense outlined hide-details /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="distT" :label="$t('plugins.WorkshopMotors.common.travel_mm')" type="number" dense outlined hide-details /></v-col>
		</v-row>
		<div class="text-caption grey--text mt-1">
			{{ $t('plugins.WorkshopMotors.measure.khz_per_motor_n_steps', { n: segments.filter(t => t.ok).length }) }}
			<span v-if="segments.some(t => !t.ok)" class="warning--text">
				{{ $t('plugins.WorkshopMotors.measure.steps_over_max_speed', { khz: (segments.find(t => !t.ok) || {}).khz }) }}
			</span>.
			<span v-if="axisOM && motorsAxis > 1">{{ $t('plugins.WorkshopMotors.measure.axis_has_n_motors', { axis: axisT, n: motorsAxis }) }}</span>
		</div>
		<div class="d-flex flex-wrap align-center mt-3" style="gap:8px">
			<v-btn small :color="armedT ? 'amber darken-3' : 'primary'" :dark="armedT" :disabled="!canCeiling || runningT" @click="touchCeiling()">
				<v-icon left>{{ armedT ? 'mdi-alert' : 'mdi-play' }}</v-icon>
				{{ armedT ? $t('plugins.WorkshopMotors.common.tap_again_the_machine_will_move') : $t('plugins.WorkshopMotors.measure.measure_the_ceiling') }}
			</v-btn>
			<v-btn small v-if="runningT" outlined color="warning" :disabled="stopT" @click="stopT = true">
				{{ stopT ? $t('plugins.WorkshopMotors.measure.it_stops_after_this_step') : $t('plugins.WorkshopMotors.measure.stop_after_this_step') }}
			</v-btn>
			<span v-if="runningT" class="text-body-2">
				<v-progress-circular indeterminate size="16" width="2" class="mr-1" />{{ stateT }}
			</span>
		</div>
		<v-alert v-if="msgT" dense outlined :type="kindT" class="mt-3 mb-0">{{ msgT }}</v-alert>
		<div v-if="ceiling" class="mt-3 text-body-2">
			<b>{{ $t('plugins.WorkshopMotors.measure.measured') }}</b> {{ $t('plugins.WorkshopMotors.measure.khz_per_motor_value', { khz: ceiling.khz_per_motor }) }}
			<span class="grey--text">
				{{ $t('plugins.WorkshopMotors.measure.ceiling_detail', { date: ceiling.date, axis: ceiling.axis, micro: ceiling.micro }) }}<span v-if="ceiling.khz_fault">, {{ $t('plugins.WorkshopMotors.measure.with_hiccups_from', { khz: ceiling.khz_fault }) }}</span>,
				firmware {{ ceiling.firmware || '?' }}).
			</span>
			{{ $t('plugins.WorkshopMotors.measure.it_s_used_as_the_reference') }}
			<!-- deletes the measured file: second tap to confirm (DESIGN.md, "Confirm delete") -->
			<v-btn x-small :text="!armedDelete" :color="armedDelete ? 'error' : undefined" :dark="armedDelete" @click="touchDelete()">
				{{ armedDelete ? $t('plugins.WorkshopMotors.measure.tap_again_back_to_dc42') : $t('plugins.WorkshopMotors.measure.back_to_dc42_s_table') }}
			</v-btn>
		</div>
		<references :ceiling="ceiling" :report="report" />

		<v-divider class="my-5" />

		<!-- ===================== Corriente ===================== -->
		<div class="text-subtitle-1 mb-1"><v-icon small class="mr-1">mdi-current-dc</v-icon>{{ $t('plugins.WorkshopMotors.measure.real_current_of_each_motor_with') }}</div>
		<div class="explica text-body-2">
			<v-icon small color="info" class="mr-1">mdi-information</v-icon>
			{{ $t('plugins.WorkshopMotors.measure.what_the_page_shows_is_the') }} <b>{{ $t('plugins.WorkshopMotors.measure.configured') }}</b> {{ $t('plugins.WorkshopMotors.measure.value_m906_not_a_measurement_the') }} <b>{{ $t('plugins.WorkshopMotors.measure.dc_clamp_meter') }}</b>{{ $t('plugins.WorkshopMotors.measure.with_the_motor_still_each_coil') }}
			<b>{{ $t('plugins.WorkshopMotors.measure.never') }}</b> {{ $t('plugins.WorkshopMotors.measure.open_a_motor_wire_with_the') }}
		</div>
		<!-- the page was closed or reloaded with the motors still at full current at rest -->
		<v-alert v-if="idleLeft != null && !prepared" dense outlined type="warning" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopMotors.measure.idle_left_at_100', { pct: idleLeft }) }}
			<v-btn x-small color="warning" class="ml-2" :loading="preparing" :disabled="busy" @click="finishCurrent()">{{ $t('plugins.WorkshopMotors.measure.restore') }}</v-btn>
		</v-alert>
		<v-row dense class="mt-3">
			<v-col cols="12" sm="4">
				<v-select v-model="motorSel" :items="motorsList" item-text="text" item-value="key" :label="$t('plugins.WorkshopMotors.common.motor')" dense outlined hide-details />
			</v-col>
			<v-col cols="12" sm="8" class="d-flex align-center flex-wrap" style="gap:8px">
				<!-- level 2 (DESIGN.md: heats): double tap -->
				<v-btn v-if="!prepared" :color="armedPrepare ? 'amber darken-3' : 'primary'" :dark="armedPrepare" small :disabled="!motorChosen || busy || state === 'off'" :loading="preparing" @click="touchPrepare()">
					{{ armedPrepare ? $t('plugins.WorkshopMotors.measure.tap_again_energize') : $t('plugins.WorkshopMotors.measure.1_energize_at_100') }}
				</v-btn>
				<v-btn v-else small outlined color="warning" :loading="preparing" @click="finishCurrent()">{{ $t('plugins.WorkshopMotors.measure.finish_idle_reduction_comes_back') }}</v-btn>
				<span v-if="prepared" class="text-caption success--text">{{ $t('plugins.WorkshopMotors.measure.motors_energized_at_100_no_idle') }}</span>
			</v-col>
		</v-row>
		<div v-if="motorChosen" class="mt-2 text-body-2">
			{{ $t('plugins.WorkshopMotors.measure.configured_2') }} <b>{{ motorChosen.ma }} mA</b> {{ $t('plugins.WorkshopMotors.measure.rms_expected_peak') }} <b>{{ peakExpected }} mA</b>.
			{{ $t('plugins.WorkshopMotors.measure.clamp_hint', { ma: peakExpected }) }}
		</div>
		<v-row dense class="mt-2">
			<v-col cols="6" sm="2"><v-text-field v-model.number="medA" :label="$t('plugins.WorkshopMotors.measure.coil_a_ma')" type="number" dense outlined hide-details :disabled="!prepared" /></v-col>
			<v-col cols="6" sm="2"><v-text-field v-model.number="medB" :label="$t('plugins.WorkshopMotors.measure.coil_b_ma')" type="number" dense outlined hide-details :disabled="!prepared" /></v-col>
			<v-col cols="12" sm="8" class="d-flex align-center flex-wrap" style="gap:8px">
				<span v-if="resultCorrection" :class="Math.abs(resultCorrection.deviation) <= 10 ? 'success--text' : 'warning--text'">
					{{ $t('plugins.WorkshopMotors.measure.measured_peak_rms', { peak: resultCorrection.peakMa, rms: resultCorrection.rmsMa, dev: (resultCorrection.deviation >= 0 ? '+' : '') + resultCorrection.deviation }) }}
				</span>
				<v-btn small color="primary" :disabled="!resultCorrection" @click="saveCurrent()">{{ $t('plugins.WorkshopMotors.common.save') }}</v-btn>
			</v-col>
		</v-row>
		<div class="text-caption grey--text mt-1">
			{{ $t('plugins.WorkshopMotors.measure.up_to_10_is_normal_clamp') }}
		</div>
		<div v-if="currents.length" style="overflow-x:auto" class="mt-2">
			<table class="table-res">
				<thead><tr><th>{{ $t('plugins.WorkshopMotors.common.date') }}</th><th>{{ $t('plugins.WorkshopMotors.common.motor') }}</th><th>{{ $t('plugins.WorkshopMotors.measure.configured_3') }}</th><th>A / B</th><th>{{ $t('plugins.WorkshopMotors.measure.measured_rms') }}</th><th>{{ $t('plugins.WorkshopMotors.common.difference') }}</th></tr></thead>
				<tbody>
					<tr v-for="(c, k) in currents.slice().reverse().slice(0, 20)" :key="k">
						<td>{{ c.date }}</td><td>{{ c.motor }}</td><td>{{ c.configured_ma }} mA</td>
						<td>{{ c.a_ma }} / {{ c.b_ma }} mA</td><td>{{ c.measured_rms_ma }} mA</td>
						<td :class="Math.abs(c.deviation_pct) <= 10 ? 'success--text' : 'warning--text'">{{ c.deviation_pct >= 0 ? '+' : '' }}{{ c.deviation_pct }} %</td>
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
import References from './References.vue'
import { reserveMotion } from './workshop-api.js'
import { settings } from './settings.js' // shared settings files with revision (vue/_shared): .bak and "another person changed this"
import { sequenceBlock, withReservation, refusedText } from './sequence.js'

export const CEILING_FILE = '0:/sys/workshop/config/step-ceiling.json';
const CORRECTION_FILE = '0:/sys/workshop/config/current.json';
const drvId = d => (d && typeof d === 'object' && d.board != null ? d.board + '.' + d.driver : String(d));

async function readJson(path, def) {
	try {
		const r = await fetch('/machine/file/' + encodeURIComponent(path), { cache: 'no-store' });
		if (!r.ok) return def;
		return JSON.parse(await r.text());
	} catch (e) {
		return def;
	}
}

// The idle current factor (%) to put back after measuring with a clamp. Kept in the browser while the motors are at
// 100 %: if the page is closed or reloaded before "Finish", the next visit offers to restore it.
const IDLE_KEY = 'workshopMotorsIdleOrig';
const ARMED_MS = 4000;

function readIdleLeft() {
	try {
		const v = parseInt(localStorage.getItem(IDLE_KEY), 10);
		return v >= 0 && v < 100 ? v : null;
	} catch (e) {
		return null;
	}
}

function saveIdleLeft(v) {
	try {
		if (v == null) {
			localStorage.removeItem(IDLE_KEY);
		} else {
			localStorage.setItem(IDLE_KEY, String(v));
		}
	} catch (e) {
		// without localStorage: only the reminder after a reload is lost
	}
}

export default {
	components: { References },
	props: {
		axes: { type: Array, default: () => [] },
		state: { type: String, default: '' },
		globals: { type: Object, default: () => ({}) },
		report: { type: Object, default: null },
		ceiling: { type: Object, default: null }
	},
	data() {
		return {
			MICRO: 256,
			axisT: 'X',
			kSince: 50,
			kUntil: 300,
			kStep: 25,
			distT: 300,
			armedT: false,
			armedTimer: null,
			runningT: false,
			stopT: false,
			stateT: '',
			msgT: null,
			kindT: 'info',
			restoring: false,
			armedDelete: false,
			// current
			motorSel: null,
			prepared: false,
			preparing: false,
			armedPrepare: false,
			idleOrig: null,
			idleLeft: readIdleLeft(),
			medA: null,
			medB: null,
			currents: []
		};
	},
	computed: {
		busy() {
			return !!sequenceBlock(this.$store.state.machine.model) || ['processing', 'paused', 'pausing', 'resuming', 'simulating'].includes(this.state);
		},
		axisOM() {
			return this.axes.find(a => a.letter === this.axisT) || null;
		},
		motorsAxis() {
			return ((this.axisOM && this.axisOM.drivers) || []).length || 1;
		},
		// stretches: kHz per motor -> mechanical speed at 1/MICRO
		segments() {
			const om = this.axisOM;
			if (!om || !(this.kStep > 0) || !(this.kUntil >= this.kSince)) return [];
			const micro = (om.microstepping && om.microstepping.value) || 16;
			const spmHigh = (om.stepsPerMm || 80) * this.MICRO / micro;
			const out = [];
			for (let k = this.kSince; k <= this.kUntil && out.length < 40; k += this.kStep) {
				const speed = Math.round(k * 1000 / spmHigh * 60);
				out.push({ khz: k, speed: speed, ok: speed >= 60 && speed <= (om.speed || 0) });
			}
			return out;
		},
		reqCeiling() {
			const om = this.axisOM;
			return [
				{ text: i18n.t('plugins.WorkshopMotors.measure.power_supply_on'), ok: this.state !== 'off' },
				{ text: i18n.t('plugins.WorkshopMotors.measure.home_axis', { axis: this.axisT }), ok: !!(om && om.homed) },
				{ text: (this.busy && sequenceBlock(this.$store.state.machine.model)) || i18n.t('plugins.WorkshopMotors.common.no_job_running'), ok: !this.busy },
				{ text: i18n.t('plugins.WorkshopMotors.measure.the_service_counts_hiccups'), ok: !!(this.report && this.report.hiccups_total != null && this.report.m122_seq != null) }
			];
		},
		canCeiling() {
			return this.reqCeiling.every(r => r.ok) && this.segments.some(t => t.ok) && !this.globals.workshopCeilingPending;
		},
		motorsList() {
			const out = [];
			this.axes.forEach(a => {
				const ds = (a.drivers || []).map(drvId);
				ds.forEach(d => out.push({ key: a.letter + '|' + d, text: ds.length > 1 ? `${a.letter} - motor ${d}` : `${a.letter} (driver ${d})`, axis: a.letter, drv: d, ma: a.current || 0 }));
			});
			return out;
		},
		motorChosen() {
			return this.motorsList.find(m => m.key === this.motorSel) || null;
		},
		peakExpected() {
			return this.motorChosen ? Math.round(this.motorChosen.ma * Math.SQRT2) : 0;
		},
		resultCorrection() {
			if (!this.motorChosen || !(this.medA >= 0) || !(this.medB >= 0) || (this.medA === 0 && this.medB === 0) || this.medA === null || this.medB === null) return null;
			const peak = Math.sqrt(this.medA * this.medA + this.medB * this.medB);
			const rms = peak / Math.SQRT2;
			const configured = this.motorChosen.ma || 1;
			return { peakMa: Math.round(peak), rmsMa: Math.round(rms), deviation: Math.round((rms / configured - 1) * 100) };
		}
	},
	watch: {
		axisT() { this.disarm(); }
	},
	async mounted() {
		const c = await readJson(CORRECTION_FILE, []);
		this.currents = Array.isArray(c) ? c : [];
		if (!this.motorSel && this.motorsList.length) this.motorSel = this.motorsList[0].key;
	},
	beforeDestroy() {
		clearTimeout(this.armedTimer);
		clearTimeout(this._armedDeleteTimer);
		clearTimeout(this._armedPrepareTimer);
		if (this.prepared) this.finishCurrent();
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		disarm() {
			this.armedT = false;
			clearTimeout(this.armedTimer);
		},
		touchCeiling() {
			if (!this.armedT) {
				this.armedT = true;
				clearTimeout(this.armedTimer);
				this.armedTimer = setTimeout(() => { this.armedT = false; }, 4000);
				return;
			}
			this.disarm();
			const mt = sequenceBlock(this.$store.state.machine.model);
			if (mt) {
				this.kindT = 'error';
				this.msgT = mt;
				return;
			}
			this.measureCeiling();
		},
		waitfor(ms) {
			return new Promise(r => setTimeout(r, ms));
		},
		// waits for a NEW M122 reading (after 'desde') and returns hiccups_total
		async hiccupsAfter(seqSince) {
			for (let i = 0; i < 40; i++) {
				const r = this.report;
				if (r && r.m122_seq > seqSince) return r.hiccups_total;
				await this.waitfor(500);
			}
			throw new Error(i18n.t('plugins.WorkshopMotors.measure.the_service_did_not_read_m122'));
		},
		async measureCeiling() {
			this.runningT = true;
			this.stopT = false;
			this.msgT = null;
			const letter = this.axisT;
			const segments = this.segments.filter(t => t.ok);
			let ok = null;
			let fault = null;
			try {
				// the jog and the other pages wait while it runs (WorkshopService motion owner)
				await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.ceiling', { axis: letter }), async () => {
					// base: no hiccups from before
					this.stateT = i18n.t('plugins.WorkshopMotors.measure.waiting_for_an_m122_reading');
					let base = await this.hiccupsAfter(this.report.m122_seq);
					for (let k = 0; k < segments.length; k++) {
						const t = segments[k];
						// changes the microstep: it is checked again before each stretch
						const mt = sequenceBlock(this.$store.state.machine.model);
						if (mt) throw new Error(mt);
						this.stateT = i18n.t('plugins.WorkshopMotors.measure.step_n_of_total', { n: k + 1, total: segments.length, khz: t.khz, v: t.speed, micro: this.MICRO });
						const reply = await this.sendCode({ code: `M98 P"0:/sys/workshop/macros/step-ceiling.g" A"${letter}" F${t.speed} D${Math.round(this.distT)} N3 M${this.MICRO}`, log: true });
						if (/error|abort/i.test(reply || '')) throw new Error(reply);
						const total = await this.hiccupsAfter(this.report.m122_seq);
						const added = total - base;
						base = total;
						if (added > 0) {
							fault = { ...t, hic: added };
							break;
						}
						ok = t;
						if (this.stopT) break;
					}
				});
				if (ok) {
					const data = {
						date: new Date().toISOString().slice(0, 16).replace('T', ' '),
						axis: letter,
						micro: this.MICRO,
						motors: this.motorsAxis,
						khz_ok: ok.khz,
						khz_fault: fault ? fault.khz : null,
						// equivalent to ONE motor (like dc42's table): what the board
						// sustained in total (kHz per motor x motors of the axis)
						khz_per_motor: ok.khz * this.motorsAxis,
						khz_board: ok.khz * this.motorsAxis,
						firmware: this.firmware()
					};
					await settings.save('step-ceiling', () => data);
					this.$emit('reload');
					this.kindT = fault ? 'success' : 'info';
					this.msgT = fault
						? i18n.t('plugins.WorkshopMotors.measure.ceiling_found', { ok: ok.khz, bad: fault.khz, n: fault.hic, axis: letter })
						: i18n.t('plugins.WorkshopMotors.measure.ceiling_not_reached', { ok: ok.khz, axis: letter });
				} else if (fault) {
					this.kindT = 'warning';
					this.msgT = i18n.t('plugins.WorkshopMotors.measure.hiccups_first_step', { khz: fault.khz });
				}
			} catch (e) {
				this.kindT = 'error';
				this.msgT = refusedText(e) || i18n.t('plugins.WorkshopMotors.measure.measurement_interrupted_error', { error: e.message || String(e) });
			} finally {
				this.runningT = false;
				this.stateT = '';
			}
		},
		firmware() {
			const b = (this.$store.state.machine.model.boards || [])[0];
			return b ? b.firmwareVersion : null;
		},
		async restoreCeiling() {
			this.restoring = true;
			try {
				await this.sendCode({ code: 'M98 P"0:/sys/workshop/macros/step-ceiling.g" R1', log: true });
			} finally {
				this.restoring = false;
			}
		},
		// first tap arms for 4 s, the second deletes the measured ceiling
		touchDelete() {
			if (!this.armedDelete) {
				this.armedDelete = true;
				clearTimeout(this._armedDeleteTimer);
				this._armedDeleteTimer = setTimeout(() => { this.armedDelete = false; }, ARMED_MS);
				return;
			}
			this.armedDelete = false;
			clearTimeout(this._armedDeleteTimer);
			this.deleteCeiling();
		},
		async deleteCeiling() {
			// an empty object is "no measured ceiling" (Motors.vue reads khz_per_motor): the old one stays as .bak
			await settings.save('step-ceiling', () => ({}));
			this.$emit('reload');
		},
		// --- current ---
		touchPrepare() {
			if (!this.armedPrepare) {
				this.armedPrepare = true;
				clearTimeout(this._armedPrepareTimer);
				this._armedPrepareTimer = setTimeout(() => { this.armedPrepare = false; }, ARMED_MS);
				return;
			}
			this.armedPrepare = false;
			clearTimeout(this._armedPrepareTimer);
			this.prepareCurrent();
		},
		async prepareCurrent() {
			if (sequenceBlock(this.$store.state.machine.model)) return;
			this.preparing = true;
			try {
				const idle = this.$store.state.machine.model.move && this.$store.state.machine.model.move.idle;
				// a reduction left over by an unfinished measurement is the real original, not today's 100 %
				this.idleOrig = this.idleLeft != null ? this.idleLeft : (idle && idle.factor != null ? Math.round(idle.factor * 100) : 30);
				saveIdleLeft(this.idleOrig);
				await this.sendCode({ code: 'M906 I100', log: true });
				await this.sendCode({ code: 'M17 ' + this.motorChosen.axis, log: true });
				this.prepared = true;
				this.medA = null;
				this.medB = null;
			} finally {
				this.preparing = false;
			}
		},
		async finishCurrent() {
			this.preparing = true;
			try {
				const back = this.idleOrig != null ? this.idleOrig : (this.idleLeft != null ? this.idleLeft : 30);
				await this.sendCode({ code: 'M906 I' + back, log: true });
				saveIdleLeft(null);
				this.idleLeft = null;
			} finally {
				this.prepared = false;
				this.preparing = false;
			}
		},
		async saveCurrent() {
			const r = this.resultCorrection;
			const m = this.motorChosen;
			if (!r || !m) return;
			const entry = {
				date: new Date().toISOString().slice(0, 16).replace('T', ' '),
				motor: m.text, axis: m.axis, driver: m.drv,
				configured_ma: m.ma, a_ma: this.medA, b_ma: this.medB,
				measured_rms_ma: r.rmsMa, deviation_pct: r.deviation
			};
			// added to the list the service has NOW (another person may have saved a measurement meanwhile)
			const saved = await settings.save('current', cur => (Array.isArray(cur) ? cur : []).concat([entry]));
			this.currents = Array.isArray(saved.value) ? saved.value : this.currents.concat([entry]);
		}
	}
};
</script>

<style scoped>
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
}
</style>
