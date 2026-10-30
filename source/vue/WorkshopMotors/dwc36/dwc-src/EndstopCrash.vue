<template>
	<div>
		<div class="explica text-body-2">
			<v-icon small color="info" class="mr-1">mdi-information</v-icon>
			<b>{{ $t('plugins.WorkshopMotors.crashFinal.sensorless_endstop_stall_homing') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_1') }}
			<b>{{ $t('plugins.WorkshopMotors.crashFinal.no') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_2') }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.yes') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_3') }}
			<b>{{ $t('plugins.WorkshopMotors.crashFinal.intro_badly_calibrated') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.intro_4') }}
		</div>

		<v-alert v-if="pending" dense type="warning" class="mt-3 mb-0">
			{{ $t('plugins.WorkshopMotors.crashFinal.previous_test_interrupted', { text: pending.text }) }}
			<v-btn x-small color="warning" class="ml-2" :loading="restoring" @click="restorePending()">{{ $t('plugins.WorkshopMotors.common.restore_now') }}</v-btn>
		</v-alert>

		<!-- Eje -->
		<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.1_axis') }}</div>
		<div v-if="!list.length" class="text-caption grey--text">{{ $t('plugins.WorkshopMotors.crashFinal.there_are_no_axes_with_motors') }}</div>
		<v-btn-toggle class="ec-wrap" v-else v-model="letter" mandatory dense color="primary">
			<v-btn v-for="e in list" :key="e.letter" small :value="e.letter" :disabled="running">{{ e.letter }}</v-btn>
		</v-btn-toggle>
		<div v-if="axis" class="ec-chips d-flex flex-wrap mt-2" style="gap:6px">
			<v-chip small outlined>{{ $t('plugins.WorkshopMotors.crashFinal.n_motors_list', { n: axis.drivers.length, list: axis.drivers.map(d => d.id).join(', ') }) }}</v-chip>
			<v-chip small outlined :color="axis.family.sg === 0 ? 'error' : (axis.family.sg == null ? 'warning' : '')">{{ axis.family.chip }}</v-chip>
			<v-chip small outlined :color="finalIsCrash ? 'success' : ''">{{ $t('plugins.WorkshopMotors.crashFinal.endstop_label', { text: textFinal }) }}</v-chip>
			<v-chip v-for="d in axis.drivers" :key="'m' + d.id" small outlined>
				{{ d.id }}: {{ modes[d.id] || $t('plugins.WorkshopMotors.crashFinal.mode') }}{{ origM915[d.id] ? ' · M915 S' + origM915[d.id].s + ' H' + origM915[d.id].h : '' }}
			</v-chip>
			<v-btn x-small text :loading="readingDrivers" :disabled="running" @click="readDrivers()">{{ $t('plugins.WorkshopMotors.crashFinal.read_again') }}</v-btn>
		</div>
		<v-alert v-if="axis && isVertical" dense outlined type="warning" class="mt-2 mb-0">
			{{ $t('plugins.WorkshopMotors.crashFinal.looks_vertical', { axis: axis.letter }) }}
		</v-alert>
		<v-alert v-if="axis && coupled" dense outlined type="info" class="mt-2 mb-0">
			{{ $t('plugins.WorkshopMotors.crashFinal.coupled_kinematics', { kin: kinematics, axis: axis.letter }) }}
		</v-alert>

		<!-- Ajustes -->
		<template v-if="axis">
			<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.2_how_it_moves_during_the') }}</div>
			<v-row dense align="center">
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="v" :label="$t('plugins.WorkshopMotors.crashFinal.speed_mm_s')" type="number" min="1" dense outlined hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="correction" :label="$t('plugins.WorkshopMotors.crashFinal.current')" type="number" min="20" max="100" dense outlined hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="2">
					<v-text-field v-model.number="h" :label="$t('plugins.WorkshopMotors.crashFinal.h_steps_s')" type="number" min="20" dense outlined hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="4">
					<v-btn-toggle class="ec-wrap" v-model="end" mandatory dense color="primary">
						<v-btn x-small :value="1" :disabled="running">{{ $t('plugins.WorkshopMotors.crashFinal.low_end_btn', { axis: axis.letter }) }}</v-btn>
						<v-btn x-small :value="2" :disabled="running">{{ $t('plugins.WorkshopMotors.crashFinal.high_end_btn', { axis: axis.letter }) }}</v-btn>
					</v-btn-toggle>
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="length" :label="$t('plugins.WorkshopMotors.crashFinal.free_stretch_mm')" type="number" min="10" dense outlined hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="overshoot" :label="$t('plugins.WorkshopMotors.crashFinal.go_past_the_limit_up_to')" type="number" min="1" max="20" dense outlined hide-details :disabled="running" />
				</v-col>
				<v-col cols="6" sm="3">
					<v-btn-toggle class="ec-wrap" v-model="f" mandatory dense color="primary">
						<v-btn x-small :value="0" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.one_reading_per_full_step_detects')">F0</v-btn>
						<v-btn x-small :value="1" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.one_reading_every_4_steps_fewer')">F1</v-btn>
					</v-btn-toggle>
				</v-col>
				<v-col v-if="axis.drivers.length > 1" cols="6" sm="3">
					<v-btn-toggle class="ec-wrap" v-model="kindFinal" mandatory dense color="primary">
						<v-btn x-small value="S3" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.stops_all_motors_of_the_axis')">S3</v-btn>
						<v-btn x-small value="S4" :disabled="running" :title="$t('plugins.WorkshopMotors.crashFinal.each_motor_stops_on_its_own')">S4</v-btn>
					</v-btn-toggle>
				</v-col>
			</v-row>
			<details class="wf-more">
				<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
			<div class="text-caption grey--text mt-1">
				{{ $t('plugins.WorkshopMotors.crashFinal.settings_note', { min: vMin == null ? '--' : vMin.toFixed(1), h, approach: approach, over: overshoot }) }}
			</div>
			</details>

			<div class="ec-chips d-flex flex-wrap mt-2" style="gap:6px">
				<v-chip v-for="r in reqs" :key="r.key" small :color="r.ok ? 'success' : (r.blocks ? 'error' : 'warning')" outlined>
					<v-icon x-small left>{{ r.ok ? 'mdi-check' : 'mdi-close' }}</v-icon>{{ r.text }}
				</v-chip>
			</div>

			<!-- Calibrar -->
			<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.3_find_the_sensitivity') }}</div>
			<div class="notices" :class="{ on: running }">
				<div class="notices-t">
					<v-icon small color="error" class="mr-1">mdi-alert</v-icon>{{ running ? $t('plugins.WorkshopMotors.crashFinal.calibrating_the_machine_moves_on_its') : $t('plugins.WorkshopMotors.common.before_calibrating_read_this') }}
				</div>
				<ol>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.the_machine') }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.moves_by_itself') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.warn_1a', { axis: axis.letter, len: length }) }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.against_the_end_b') }}</b>
						{{ $t('plugins.WorkshopMotors.crashFinal.warn_1b', { end: end === 2 ? $t('plugins.WorkshopMotors.crashFinal.high') : $t('plugins.WorkshopMotors.crashFinal.low'), v }) }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.warn_2a') }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.may_not_detect_and_push') }}</b>
						{{ $t('plugins.WorkshopMotors.crashFinal.warn_2b', { over: overshoot, pct: correction }) }}</li>
					<li><b>{{ $t('plugins.WorkshopMotors.crashFinal.clear_the_path') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.warn_3') }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.warn_4', { axis: axis.letter }) }} <b>{{ $t('plugins.WorkshopMotors.crashFinal.emergency_stop') }}</b> {{ $t('plugins.WorkshopMotors.crashFinal.top_of_dwc') }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.warn_5', { axis: axis.letter }) }}</li>
					<li>{{ $t('plugins.WorkshopMotors.crashFinal.nothing_is_saved_to_config_g') }}</li>
				</ol>
				<v-checkbox v-model="understood" :disabled="running" dense hide-details class="mt-0"
					:label="$t('plugins.WorkshopMotors.crashFinal.understood_checkbox')" />
			</div>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<v-btn small color="error" :disabled="!canBegin" @click="begin()">
					<v-icon left small>mdi-play</v-icon>{{ sweep && sweep.phase !== 'free' ? $t('plugins.WorkshopMotors.crashFinal.start_over') : $t('plugins.WorkshopMotors.common.calibrate') }}
				</v-btn>
				<v-btn v-if="running" small outlined @click="stop = true">{{ $t('plugins.WorkshopMotors.crashFinal.stop_after_this_step') }}</v-btn>
				<span v-if="running" class="text-body-2">
					<v-progress-circular indeterminate size="16" width="2" class="mr-1" />{{ state }}
				</span>
				<span v-else-if="reasonNoBegin" class="text-caption grey--text">{{ reasonNoBegin }}</span>
			</div>
			<v-alert v-if="error" dense outlined type="error" class="mt-3 mb-0">{{ error }}</v-alert>

			<div v-if="steps.length" class="mt-3">
				<div v-for="(p, i) in steps" :key="i" class="text-body-2">
					<v-icon x-small :color="p.color" class="mr-1">{{ p.icon }}</v-icon>{{ p.text }}
				</div>
			</div>

			<!-- Against the stop: the user says what happened -->
			<div v-if="sweep && sweep.phase === 'stop' && !running" class="stop mt-3">
				<template v-if="lastStop">
					<div class="text-body-2 mb-2">
						{{ $t('plugins.WorkshopMotors.crashFinal.with_s', { s: lastStop.s }) }} <b>{{ lastStop.res.stopped ? $t('plugins.WorkshopMotors.crashFinal.stopped_at_mm', { mm: lastStop.res.route.toFixed(1) }) : $t('plugins.WorkshopMotors.crashFinal.travelled_mm_without_detecting', { mm: lastStop.res.requested }) }}</b>
						{{ $t('plugins.WorkshopMotors.crashFinal.what_did_you_see', { mm: approach }) }}
					</div>
					<div class="d-flex flex-wrap" style="gap:6px">
						<v-btn small :color="suggested === 'well' ? 'primary' : ''" :outlined="suggested !== 'well'" @click="answer('well')">{{ $t('plugins.WorkshopMotors.crashFinal.it_stopped_when_touching_the_end') }}</v-btn>
						<v-btn small :color="suggested === 'before' ? 'primary' : ''" :outlined="suggested !== 'before'" @click="answer('before')">{{ $t('plugins.WorkshopMotors.crashFinal.it_stopped_before_touching_it') }}</v-btn>
						<v-btn small :color="suggested === 'followed' ? 'primary' : ''" :outlined="suggested !== 'followed'" @click="answer('followed')">{{ $t('plugins.WorkshopMotors.crashFinal.it_kept_pushing_noise_skipping') }}</v-btn>
					</div>
				</template>
				<template v-else>
					<div class="text-body-2 mb-2">
						{{ $t('plugins.WorkshopMotors.crashFinal.no_false_until_s', { s: sweep.lastOk }) }}{{ sweep.fake != null ? ' ' + $t('plugins.WorkshopMotors.crashFinal.false_with_s', { s: sweep.fake }) : '' }}.
						{{ $t('plugins.WorkshopMotors.crashFinal.now_against_end_with') }} <b>S{{ sweep.candidate }}</b>{{ $t('plugins.WorkshopMotors.crashFinal.starts_at_mm_from_limit', { mm: approach }) }}
					</div>
					<v-btn small color="error" :disabled="!canMove" @click="testStop()"><v-icon left small>mdi-arrow-collapse-horizontal</v-icon>{{ $t('plugins.WorkshopMotors.crashFinal.test_against_end_with_s', { s: sweep.candidate }) }}</v-btn>
				</template>
			</div>
			<v-alert v-if="sweep && sweep.phase === 'failure'" dense outlined type="warning" class="mt-3 mb-0">{{ sweep.reason }}</v-alert>
			<v-alert v-if="sweep && sweep.phase === 'ready'" dense outlined type="success" class="mt-3 mb-0">
				{{ $t('plugins.WorkshopMotors.crashFinal.sensitivity_found') }} <b>S{{ sweep.final }}</b>. {{ sweep.reason }} {{ $t('plugins.WorkshopMotors.crashFinal.review_and_save_below') }}
			</v-alert>

			<!-- Proposal for config.g -->
			<div class="text-subtitle-2 mt-4 mb-1">{{ $t('plugins.WorkshopMotors.crashFinal.4_save_to_config_g') }}</div>
			<v-row dense align="center">
				<v-col cols="6" sm="3">
					<v-text-field v-model.number="sProp" :label="$t('plugins.WorkshopMotors.crashFinal.sensitivity_s')" type="number" dense outlined hide-details :disabled="running" />
				</v-col>
				<v-col cols="12" sm="9" class="text-caption grey--text">
					{{ $t('plugins.WorkshopMotors.crashFinal.lower_more_sensitive') }}
					{{ axis.family.sg === 4 ? $t('plugins.WorkshopMotors.crashFinal.tmc2209_2240_from_128_to_127') : $t('plugins.WorkshopMotors.crashFinal.from_64_to_63_the_docs') }}
				</v-col>
			</v-row>
			<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
				<v-btn small outlined :loading="readingConfig" :disabled="running || blocked" @click="prepareProposal()">
					<v-icon left small>mdi-file-compare</v-icon>{{ $t('plugins.WorkshopMotors.crashFinal.show_the_change_in_config_g') }}
				</v-btn>
				<span v-if="blocked" class="text-caption grey--text">{{ reasonBlock }}</span>
			</div>
			<template v-if="proposal">
				<div class="diff mt-2">
					<div v-for="(x, i) in proposal.diff" :key="i" :class="'d-' + x.kind">
						<template v-if="x.kind === 'cut'">...</template>
						<template v-else><span class="dn">{{ x.kind === 'deleted' ? x.a : x.b }}</span>{{ x.kind === 'added' ? '+ ' : (x.kind === 'deleted' ? '- ' : '  ') }}{{ x.text }}</template>
					</div>
					<div v-if="!proposal.diff.length" class="d-same">{{ $t('plugins.WorkshopMotors.crashFinal.config_g_already_has_these_lines') }}</div>
				</div>
				<div v-for="(c, i) in proposal.changes.filter(c => c.note)" :key="'n' + i" class="text-caption mt-1">{{ c.note }}</div>
				<div v-for="(a, i) in proposal.notices" :key="'a' + i" class="text-caption warning--text mt-1">{{ a }}</div>
				<div class="text-caption grey--text mt-1">
					{{ $t('plugins.WorkshopMotors.crashFinal.only_config_g_changes', { axis: axis.letter }) }}
					{{ serviceConfig === false ? $t('plugins.WorkshopMotors.crashFinal.without_the_service_save_a_copy') : $t(hasConfig ? 'plugins.WorkshopMotors.crashFinal.saved_through_the_service_it_leaves' : 'plugins.WorkshopMotors.crashFinal.saved_through_the_service_it_leaves_no_config') }}
				</div>
				<div v-if="proposal.diff.length" class="d-flex flex-wrap align-center mt-2" style="gap:8px">
					<v-checkbox v-model="checked" dense hide-details class="mt-0" :label="$t('plugins.WorkshopMotors.crashFinal.i_reviewed_the_change')" />
					<v-btn small color="primary" :disabled="!checked || saving || blocked" :loading="saving" @click="saveConfig()">{{ $t('plugins.WorkshopMotors.crashFinal.save_to_config_g') }}</v-btn>
				</div>
				<v-alert v-if="savedMsg" dense outlined type="success" class="mt-2 mb-0">
					{{ savedMsg }}
					<v-btn x-small outlined class="ml-2" :loading="applying" :disabled="blocked" @click="applyNow()">{{ $t('plugins.WorkshopMotors.crashFinal.apply_now_without_restarting') }}</v-btn>
				</v-alert>
				<div class="text-caption mt-3">{{ $t('plugins.WorkshopMotors.crashFinal.homing_file_hint', { axis: axis.letter, file: 'sys/home' + axis.letter.toLowerCase() + '.g' }) }}</div>
				<pre class="homing">{{ textHoming }}</pre>
			</template>
		</template>
	</div>
</template>

<script>
import i18n from '../../i18n'

'use strict'

import { mapActions } from 'vuex'
import { api, reserveMotion } from './workshop-api.js'
import { workshopProfile } from './machine-profile.js' // what the service discovered about the boards (vue/_shared)
import { withReservation, refusedText } from './sequence.js'
import {
	axesOf as axes, valuesInitial, requirements, speedMin, newSweep, resultFree, resultCap, hint, macroStep, MACRO_STEP,
	readStep, commandsRestore, proposeConfig, diffLines, hintHoming, requestSaved, newTx, readJson, readM569, readM915, letterGcode
} from './endstop-crash.js'
import { block } from './enable.js'
import { sha256 } from './sha256.js'
import { pluginActive } from './workshop-ids.js' // the configurator is another plugin: nothing about it when it is absent

const CONFIG = '0:/sys/config.g';
const ORIG_KEY = 'workshopEndCrashOrig';
const RISK_ID = 'motors-sensorless-endstop';

function url(p) {
	return '/machine/file/' + encodeURIComponent(p);
}

function write(p, content) {
	return fetch(url(p), { method: 'PUT', body: content, headers: { 'Content-Type': 'application/octet-stream' } }).then(r => {
		if (!r.ok) {
			throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.could_not_write_http', { path: p, status: r.status }));
		}
	});
}

function readLocal() {
	try {
		return JSON.parse(localStorage.getItem(ORIG_KEY) || 'null');
	} catch (e) {
		return null;
	}
}

function saveLocal(v) {
	try {
		if (v) {
			localStorage.setItem(ORIG_KEY, JSON.stringify(v));
		} else {
			localStorage.removeItem(ORIG_KEY);
		}
	} catch (e) {
		// without localStorage: only the restore notice is lost
	}
}

export default {
	props: {
		om: { type: Object, default: null },
		report: { type: Object, default: null },
		liveJob: { type: Object, default: null }
	},
	data() {
		return {
			letter: null,
			v: 30, correction: 40, h: 200, f: 0, length: 40, approach: 10, overshoot: 5, end: 1, kindFinal: 'S3',
			modes: {},
			origM915: {},
			readingDrivers: false,
			understood: false,
			running: false,
			stop: false,
			state: '',
			error: null,
			sweep: null,
			steps: [],
			lastStop: null,
			sProp: 3,
			proposal: null,
			readingConfig: false,
			checked: false,
			saving: false,
			savedMsg: null,
			applying: false,
			serviceConfig: null,
			restoring: false,
			caps: null, // capabilities.get: the chip of each board as the service discovered it (null = not known: the names are used)
			origLocal: readLocal()
		};
	},
	computed: {
		hasConfig() {
			return pluginActive(this.$store, 'config');
		},
		list() {
			return axes(this.om, this.caps);
		},
		axis() {
			return this.list.find(e => e.letter === this.letter) || null;
		},
		kinematics() {
			const k = this.om && this.om.move && this.om.move.kinematics;
			return (k && k.name) || '';
		},
		coupled() {
			return /core|delta|scara|polar|hangprinter/i.test(this.kinematics);
		},
		isVertical() {
			return !!this.axis && (this.axis.letter.toUpperCase() === 'Z' || /delta/i.test(this.kinematics));
		},
		finalIsCrash() {
			return !!this.axis && (this.axis.final.kind === 'S3' || this.axis.final.kind === 'S4');
		},
		textFinal() {
			const end = this.axis && this.axis.final;
			if (!end || !end.kind) {
				return i18n.t('plugins.WorkshopMotors.crashFinal.no_endstop');
			}
			const kind = end.kind === 'other' ? end.textKind : i18n.t('plugins.WorkshopMotors.crashFinal.by_stall_type', { type: end.kind });
			return end.end === 2 ? i18n.t('plugins.WorkshopMotors.crashFinal.type_high_end', { type: kind }) : i18n.t('plugins.WorkshopMotors.crashFinal.type_low_end', { type: kind });
		},
		vMin() {
			return this.axis ? speedMin(this.h, this.axis.fsmm) : null;
		},
		reqs() {
			return requirements({
				axis: this.axis, om: this.om, liveJob: this.liveJob, v: this.v, h: this.h, correction: this.correction, f: this.f,
				modes: this.modes, forSweep: true, length: this.length, approach: this.approach, overshoot: this.overshoot
			});
		},
		blocked() {
			return block(this.om, this.liveJob).blocked;
		},
		reasonBlock() {
			return block(this.om, this.liveJob).reason;
		},
		paramsOk() {
			return this.overshoot >= 1 && this.overshoot <= 20 && this.length >= 10 && this.h >= 20 && this.h <= 2000 && this.v > 0;
		},
		canMove() {
			return !!this.axis && !this.running && this.understood && this.paramsOk && this.reqs.every(r => !r.blocks) && !this.pending;
		},
		canBegin() {
			return this.canMove;
		},
		reasonNoBegin() {
			if (!this.axis) return '';
			if (this.pending) return i18n.t('plugins.WorkshopMotors.crashFinal.first_restore_the_previous_test');
			const r = this.reqs.find(x => x.blocks);
			if (r) return r.text;
			if (!this.paramsOk) return i18n.t('plugins.WorkshopMotors.crashFinal.check_the_values_past_the_limit');
			if (!this.understood) return i18n.t('plugins.WorkshopMotors.common.tick_understood_in_the_box_to');
			return '';
		},
		// test cut halfway: reduced current (macro) or a test M915 (page)
		pending() {
			if (this.running) {
				return null;
			}
			const g = this.readGlobal('endCrashPending');
			if (typeof g === 'string' && g) {
				return { kind: 'current', letter: g, text: i18n.t('plugins.WorkshopMotors.crashFinal.axis_left_reduced_current', { axis: g }) };
			}
			if (this.origLocal && this.origLocal.drivers && this.origLocal.drivers.length) {
				return { kind: 'm915', letter: this.origLocal.letter, text: i18n.t('plugins.WorkshopMotors.crashFinal.sensitivity_left_test_value', { axis: this.origLocal.letter }) };
			}
			return null;
		},
		suggested() {
			return this.lastStop ? hint(this.lastStop.res) : null;
		},
		textHoming() {
			if (!this.axis) return '';
			const rec = typeof this.axis.max === 'number' && typeof this.axis.min === 'number' ? this.axis.max - this.axis.min : 300;
			return hintHoming({ letter: this.axis.letter, end: this.end, v: this.v, correction: this.correction, route: rec, pctBack: this.axis.pctCurrent });
		}
	},
	watch: {
		list: {
			immediate: true,
			handler(l) {
				if (!this.letter && l.length) {
					const crash = l.find(e => e.final.kind === 'S3' || e.final.kind === 'S4');
					this.letter = (crash || l[0]).letter;
				}
			}
		},
		letter() {
			this.restartAxis();
		}
	},
	mounted() {
		workshopProfile.get().then(() => { this.caps = workshopProfile.snapshot().caps; });
		if (this.letter) {
			this.restartAxis();
		}
	},
	beforeDestroy() {
		this.stop = true;
	},
	methods: {
		...mapActions('machine', ['sendCode']),
		readGlobal(k) {
			const g = this.om && this.om.global;
			return g && (typeof g.get === 'function' ? g.get(k) : g[k]);
		},
		restartAxis() {
			if (!this.axis) {
				return;
			}
			const initial = valuesInitial(this.axis, null);
			Object.assign(this, { v: initial.v, correction: initial.correction, h: initial.h, f: initial.f, length: initial.length, approach: initial.approach, overshoot: initial.overshoot, end: initial.end, kindFinal: initial.kindFinal });
			this.sweep = null;
			this.steps = [];
			this.lastStop = null;
			this.proposal = null;
			this.savedMsg = null;
			this.error = null;
			this.sProp = this.axis.family.sg === 4 ? 60 : 3;
			this.readDrivers();
		},
		async send(code) {
			return String(await this.sendCode({ code, log: false }) || '');
		},
		// Mode (M569) and current sensitivity (M915) of the axis drivers: read-only, once
		async readDrivers() {
			if (!this.axis || this.running) {
				return;
			}
			this.readingDrivers = true;
			const modes = {};
			const orig = {};
			try {
				for (const d of this.axis.drivers) {
					try {
						const m = readM569(await this.send('M569 P' + d.id));
						if (m.mode) modes[d.id] = m.mode;
						const s = readM915(await this.send('M915 P' + d.id));
						if (s.length) orig[d.id] = { id: d.id, s: s[0].s, f: s[0].filter, h: s[0].h };
					} catch (e) {
						// board that does not respond: it stays without data
					}
				}
			} finally {
				this.modes = modes;
				this.origM915 = orig;
				this.readingDrivers = false;
			}
			const first = Object.values(orig)[0];
			if (first && !this.sweep) {
				this.h = first.h > 0 ? first.h : this.h;
				const initial = valuesInitial(this.axis, first);
				this.v = initial.v;
				this.sProp = first.s;
			}
		},
		async startRisk() {
			const t = window.__workshop;
			if (t && typeof t.riskStart === 'function') {
				try {
					// both languages: every screen shows the risk bar in its own
					const text = (l) => i18n.t('plugins.WorkshopMotors.crashFinal.risk_text', l, { axis: this.axis.letter });
					await t.riskStart(RISK_ID, { es: text('es'), en: text('en') }, 600);
				} catch (e) {
					// without the service the notice stays only on this page
				}
			}
		},
		finishRisk() {
			const t = window.__workshop;
			if (t && typeof t.riskFinish === 'function') {
				Promise.resolve(t.riskFinish(RISK_ID)).catch(() => {});
			}
		},
		// One step: writes the macro with the axis letter and runs it
		async step(mode, s) {
			const g = macroStep({
				axis: this.axis, mode: mode, end: this.end, v: this.v, correction: this.correction, h: this.h, f: this.f, s,
				length: this.length, approach: this.approach, overshoot: this.overshoot
			});
			await write(MACRO_STEP, g);
			const n0 = this.readGlobal('endCrashN');
			const reply = String(await this.sendCode({ code: 'M98 P"' + MACRO_STEP + '"', log: true }) || '');
			let res = readStep(reply);
			if (!res) {
				if (/error|abort/i.test(reply)) {
					throw new Error(reply.replace(/^Error:\s*/i, ''));
				}
				for (let i = 0; i < 20 && !res; i++) {
					await new Promise(r => setTimeout(r, 250));
					if (this.readGlobal('endCrashN') !== n0) {
						res = readStep(this.readGlobal('endCrashRes'));
					}
				}
			}
			if (!res) {
				throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.could_not_read_the_result_of') + (reply ? i18n.t('plugins.WorkshopMotors.crashFinal.the_board_replied') + reply : ''));
			}
			return res;
		},
		async withRisk(fn) {
			this.running = true;
			this.stop = false;
			this.error = null;
			const originals = Object.values(this.origM915);
			if (originals.length) {
				this.origLocal = { letter: this.axis.letter, drivers: originals };
				saveLocal(this.origLocal);
			}
			await this.startRisk();
			try {
				// the jog and the other pages wait while it runs (WorkshopService motion owner)
				await withReservation(reserveMotion, i18n.t('plugins.WorkshopMotors.sequence.endstop', { axis: this.axis.letter }), fn);
			} catch (e) {
				this.error = refusedText(e) || i18n.t('plugins.WorkshopMotors.common.the_test_was_interrupted') + (e.message || e);
			} finally {
				await this.restoreM915();
				if (!originals.length) {
					this.steps.push({ icon: 'mdi-alert', color: 'warning', text: i18n.t('plugins.WorkshopMotors.crashFinal.could_not_read_the_previous_sensitivity') });
				}
				this.running = false;
				this.state = '';
				this.finishRisk();
			}
		},
		async restoreM915() {
			const orig = this.origLocal;
			if (!orig) {
				return;
			}
			try {
				for (const c of commandsRestore(orig.drivers)) {
					await this.send(c);
				}
				this.origLocal = null;
				saveLocal(null);
			} catch (e) {
				this.error = (this.error ? this.error + ' ' : '') + i18n.t('plugins.WorkshopMotors.crashFinal.could_not_return_to_the_previous');
			}
		},
		async begin() {
			if (!this.canBegin) {
				return;
			}
			this.sweep = newSweep(this.axis.family);
			this.steps = [];
			this.lastStop = null;
			this.savedMsg = null;
			this.proposal = null;
			await this.withRisk(async () => {
				while (this.sweep.phase === 'free' && !this.stop) {
					const s = this.sweep.s;
					this.state = i18n.t('plugins.WorkshopMotors.crashFinal.free_stretch_with_s_n', { s });
					const res = await this.step('free', s);
					this.steps.push(res.stopped
						? { icon: 'mdi-alert', color: 'warning', text: i18n.t('plugins.WorkshopMotors.crashFinal.step_false_stall', { s, mm: res.route.toFixed(1), total: res.requested }) }
						: { icon: 'mdi-check', color: 'success', text: i18n.t('plugins.WorkshopMotors.crashFinal.step_no_false', { s, mm: res.requested }) });
					this.sweep = resultFree(this.sweep, res);
				}
				if (this.stop && this.sweep.phase === 'free') {
					this.steps.push({ icon: 'mdi-stop', color: 'grey', text: i18n.t('plugins.WorkshopMotors.crashFinal.stopped_on_request') });
				}
			});
		},
		async testStop() {
			if (!this.canMove || !this.sweep || this.sweep.phase !== 'stop') {
				return;
			}
			const s = this.sweep.candidate;
			await this.withRisk(async () => {
				this.state = i18n.t('plugins.WorkshopMotors.crashFinal.against_end_with_s_n', { s });
				const res = await this.step('stop', s);
				this.lastStop = { s, res };
				this.steps.push({ icon: 'mdi-arrow-collapse-horizontal', color: 'info', text: res.stopped ? i18n.t('plugins.WorkshopMotors.crashFinal.step_end_stopped', { s, mm: res.route.toFixed(1) }) : i18n.t('plugins.WorkshopMotors.crashFinal.step_end_not_stopped', { s, mm: res.requested }) });
			});
		},
		answer(r) {
			const t = this.lastStop;
			this.sweep = resultCap(this.sweep, r, t ? t.res.route : null);
			this.steps.push({ icon: 'mdi-account-check', color: 'primary', text: i18n.t('plugins.WorkshopMotors.crashFinal.your_answer_with_s') + (t ? t.s : '?') + ': ' + { well: i18n.t('plugins.WorkshopMotors.crashFinal.stopped_when_touching_the_end'), before: i18n.t('plugins.WorkshopMotors.crashFinal.stopped_early'), followed: i18n.t('plugins.WorkshopMotors.crashFinal.kept_pushing') }[r] });
			this.lastStop = null;
			if (this.sweep.phase === 'ready') {
				this.sProp = this.sweep.final;
				this.prepareProposal();
			}
		},
		async restorePending() {
			this.restoring = true;
			try {
				const p = this.pending;
				if (p && p.kind === 'current') {
					const turn = this.readGlobal('endCrashCorrection');
					await this.send('M913 ' + letterGcode(p.letter) + (typeof turn === 'number' ? turn : 100));
					await this.send('set global.endCrashPending = ""');
				}
				await this.restoreM915();
			} catch (e) {
				this.error = i18n.t('plugins.WorkshopMotors.common.could_not_restore') + (e.message || e);
			} finally {
				this.restoring = false;
			}
		},
		// ---- config.g ----
		async readConfig() {
			const r = await fetch(url(CONFIG), { cache: 'no-store' });
			if (!r.ok) {
				throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.could_not_read_config_http', { status: r.status }));
			}
			const bytes = new Uint8Array(await r.arrayBuffer());
			return { bytes, text: new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, '') };
		},
		date() {
			const d = new Date();
			const p = n => ('0' + n).slice(-2);
			return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
		},
		async prepareProposal() {
			if (!this.axis || typeof this.sProp !== 'number' || isNaN(this.sProp)) {
				return;
			}
			this.readingConfig = true;
			this.error = null;
			this.checked = false;
			this.savedMsg = null;
			try {
				const c = await this.readConfig();
				const lim = this.axis.family.sg === 4 ? 127 : 63;
				const s = Math.max(-lim - 1, Math.min(lim, Math.round(this.sProp)));
				const p = proposeConfig(c.text, { letter: this.axis.letter, end: this.end, kindFinal: this.axis.drivers.length > 1 ? this.kindFinal : 'S3', s, f: this.f, h: Math.round(this.h), date: this.date() });
				this.proposal = Object.assign(p, { before: c.text, bytes: c.bytes, sha: sha256(c.bytes), diff: diffLines(c.text, p.text, 2), s });
			} catch (e) {
				this.error = i18n.t('plugins.WorkshopMotors.crashFinal.could_not_prepare_the_change') + (e.message || e);
				this.proposal = null;
			} finally {
				this.readingConfig = false;
			}
		},
		// API of WorkshopService config.<op>; without the service: { ok: false, error: 'without-handler' }
		async callConfig(op, args) {
			try {
				const r = await api('config.' + op, args || {});
				return r && typeof r === 'object' ? r : readJson(String(r || ''));
			} catch (e) {
				const without = ['service_outdated', 'unavailable', 'unknown_op'].includes(e && e.code);
				return { ok: false, error: without ? 'without-handler' : (e && e.message) || String(e) };
			}
		},
		async saveConfig() {
			const p = this.proposal;
			if (!p || block(this.om, this.liveJob).blocked) {
				return;
			}
			this.saving = true;
			this.error = null;
			try {
				const now = await this.readConfig();
				if (sha256(now.bytes) !== p.sha) {
					throw new Error(i18n.t('plugins.WorkshopMotors.crashFinal.config_g_changed_since_you_read'));
				}
				const reason = i18n.t('plugins.WorkshopMotors.crashFinal.log_sensorless_endstop', { axis: this.axis.letter, s: p.s });
				const screen = 'wm-' + Math.random().toString(36).slice(2, 8);
				const lock = await this.callConfig('lock', { owner: screen, who: 'WorkshopMotors' });
				let backup = null;
				if (lock.ok) {
					this.serviceConfig = true;
					try {
						const tx = newTx();
						const staged = requestSaved({ path: CONFIG, text: p.text, bytesPrevious: p.bytes, tx, reason: reason });
						await write(staged.folder + '/' + staged.file, staged.bytes);
						await write(staged.folder + '/manifest.json', JSON.stringify(staged.manifest, null, 1));
						const r = await this.callConfig('commit', { tx, owner: screen });
						if (!r.ok) {
							throw new Error(r.error || i18n.t('plugins.WorkshopMotors.crashFinal.the_service_could_not_save'));
						}
						backup = r.snapshot || null;
					} finally {
						await this.callConfig('unlock', { owner: screen }).catch(() => {});
					}
				} else if (lock.error === 'without-handler' || /handler|unknown|no respond/i.test(lock.error || '')) {
					// without the service's safe saving: .bak copy and direct PUT
					this.serviceConfig = false;
					const d = new Date();
					const stamp = d.toISOString().replace(/[-:]/g, '').slice(0, 15);
					await write(CONFIG + '.bak-' + stamp, p.bytes);
					await write(CONFIG, p.text);
					backup = 'config.g.bak-' + stamp;
				} else {
					throw new Error(lock.error || i18n.t('plugins.WorkshopMotors.crashFinal.another_screen_is_saving_the_configuration'));
				}
				api('activity.log', { type: 'calibration', text: reason }).catch(() => {});
				this.savedMsg = backup ? i18n.t('plugins.WorkshopMotors.crashFinal.saved_config_with_copy', { copy: backup }) : i18n.t('plugins.WorkshopMotors.crashFinal.saved_config');
				this.checked = false;
			} catch (e) {
				this.error = i18n.t('plugins.WorkshopMotors.common.could_not_save') + (e.message || e);
			} finally {
				this.saving = false;
			}
		},
		// Sends the new lines now (without comments): valid until the next restart
		async applyNow() {
			if (!this.proposal || block(this.om, this.liveJob).blocked) {
				return;
			}
			this.applying = true;
			try {
				for (const c of this.proposal.changes) {
					const line = String(c.after || '').replace(/;.*$/, '').trim();
					if (line && c.kind !== 'same') {
						const r = await this.send(line);
						if (/error/i.test(r)) {
							throw new Error(line + ': ' + r);
						}
					}
				}
				this.savedMsg = i18n.t('plugins.WorkshopMotors.crashFinal.applied_home') + this.axis.letter + i18n.t('plugins.WorkshopMotors.crashFinal.carefully_hand_near_the_emergency_stop');
			} catch (e) {
				this.error = i18n.t('plugins.WorkshopMotors.crashFinal.could_not_apply') + (e.message || e);
			} finally {
				this.applying = false;
			}
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
.notices {
	border: 1px solid rgba(198, 40, 40, 0.6);
	border-radius: 6px;
	padding: 8px 12px;
	background: rgba(198, 40, 40, 0.06);
	font-size: 13px;
}
.notices.on {
	border-width: 2px;
	border-color: #c62828;
	background: rgba(198, 40, 40, 0.14);
}
.notices-t {
	font-weight: 600;
	margin-bottom: 4px;
}
.notices ol {
	padding-left: 20px;
}
.stop {
	border: 1px solid rgba(128, 128, 128, 0.3);
	border-radius: 6px;
	padding: 8px 12px;
}
.diff,
.homing {
	font-family: monospace;
	font-size: 12px;
	border: 1px solid rgba(128, 128, 128, 0.3);
	border-radius: 6px;
	padding: 6px 8px;
	overflow-x: auto;
	white-space: pre;
}
.diff .dn {
	display: inline-block;
	min-width: 3.5em;
	color: var(--tp-faint, #9e9e9e);
}
.d-added {
	background: rgba(46, 125, 50, 0.18);
}
.d-deleted {
	background: rgba(198, 40, 40, 0.18);
}
.d-cut,
.d-same {
	color: var(--tp-faint, #9e9e9e);
}
</style>

<style>
/* phone: toggle groups wrap and chips break their text instead of pushing the page wider (not scoped: reaches inside the Vuetify chip) */
.ec-wrap {
	flex-wrap: wrap;
	height: auto !important;
	max-width: 100%;
}
.ec-chips .v-chip {
	max-width: 100%;
	height: auto !important;
	min-height: 24px;
	white-space: normal;
}
.ec-chips .v-chip .v-chip__content {
	max-width: 100%;
	white-space: normal;
	overflow-wrap: anywhere;
}
</style>
