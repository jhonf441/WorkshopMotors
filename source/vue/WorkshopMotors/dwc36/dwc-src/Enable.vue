<template>
	<div>
		<div class="text-body-2 mb-2">{{ e('disabling_a_motor_cuts_its_current') }}</div>

		<!-- Level 4 (DESIGN.md): fixed notices + "Understood"; with it ticked ONE tap releases (the box replaces the double tap) -->
		<v-alert dense outlined type="error" class="mb-3 enabled-level4">
			<div class="text-subtitle-2">{{ e('releasing_motors_the_machine_is_without') }}</div>
			<ul class="text-caption">
				<li v-for="(a, i) in noticesLevel4" :key="i">{{ a }}</li>
			</ul>
			<v-checkbox v-model="understood" dense hide-details class="mt-1 mb-0 pt-0" :disabled="lock.blocked" :label="e('understood_i_will_release_the_motors')" />
		</v-alert>

		<v-alert v-if="!atLeast('technician')" dense outlined type="info" class="mb-3">{{ e('role_cannot_release') }}</v-alert>
		<v-alert v-if="lock.blocked" dense outlined type="warning" class="mb-3">{{ lock.reason }}</v-alert>
		<div v-if="textIdle" class="text-caption enabled-faint mb-2">{{ textIdle }}</div>

		<div class="enabled-grid">
			<div v-for="m in motors" :key="m.key" class="enabled-card" :class="'enabled-' + m.state">
				<div class="d-flex align-center flex-wrap" style="gap:6px">
					<v-checkbox
						:input-value="sel.indexOf(m.key) >= 0" dense hide-details class="mt-0 pt-0"
						:disabled="lock.blocked || busy" @change="choose(m.key, $event)"
					/>
					<span class="enabled-name">{{ m.label }}</span>
					<v-spacer />
					<v-chip x-small :outlined="m.state !== 'released'" :dark="m.state === 'released'" :color="stateColor(m.state)" :title="s('enable_' + m.state + '_hint')">
						<v-icon x-small left>{{ stateIcon(m.state) }}</v-icon>{{ s('enable_' + m.state) }}
					</v-chip>
				</div>
				<div class="d-flex flex-wrap mt-1" style="gap:4px">
					<v-chip v-if="m.kind === 'axis'" x-small outlined :color="m.homed ? 'success' : 'warning'">
						{{ m.homed ? s('homed_yes') : s('homed_no') }}
					</v-chip>
					<v-chip v-if="!m.visible" x-small outlined color="grey">{{ e('hidden_axis') }}</v-chip>
					<v-chip v-if="pending(m.key)" x-small outlined color="info">
						<v-progress-circular indeterminate size="10" width="2" class="mr-1" />{{ e('confirming') }}
					</v-chip>
				</div>
				<div class="mt-2">
					<div v-for="d in m.drivers" :key="d.id" class="enabled-driver">
						<v-icon x-small :color="driverColor(d.enabled)">{{ driverIcon(d.enabled) }}</v-icon>
						<span>{{ $t('plugins.WorkshopMotors.details.driver_id', { id: d.id }) }}</span>
						<span class="enabled-faint">&middot; {{ d.board === 'main' ? e('main_board') : d.board }}</span>
						<v-spacer />
						<span class="enabled-faint">{{ textDriver(d) }}</span>
					</div>
				</div>
				<div class="d-flex flex-wrap mt-2" style="gap:6px">
					<v-btn small outlined color="error" :disabled="!canRelease || !holding(m)" :title="holding(m) ? undefined : e('already_released')" @click="touch('disable', [m.key], m.key)">
						<v-icon small left>mdi-engine-off-outline</v-icon>{{ e('release_one') }}
					</v-btn>
					<v-btn
						small :color="isArmed('enable', m.key) ? 'amber darken-3' : undefined" :dark="isArmed('enable', m.key)"
						:outlined="!isArmed('enable', m.key)" :disabled="!canEnable || m.state === 'enabled'" :title="m.state === 'enabled' ? e('already_enabled') : undefined" @click="touch('enable', [m.key], m.key)"
					>
						<v-icon small left>{{ isArmed('enable', m.key) ? 'mdi-alert' : 'mdi-engine-outline' }}</v-icon>
						{{ isArmed('enable', m.key) ? e('tap_again_enable') + m.key : $t('plugins.WorkshopMotors.common.enable') }}
					</v-btn>
				</div>
			</div>
		</div>
		<div v-if="!motors.length" class="text-caption enabled-faint">{{ e('there_are_no_axes_or_extruders') }}</div>

		<!-- the selection and all -->
		<div class="enabled-bar mt-3">
			<div class="d-flex align-center flex-wrap" style="gap:6px">
				<span class="text-subtitle-2 mr-1">{{ e('selected_list', { list: sel.length ? sel.join(', ') : e('none') }) }}</span>
				<v-btn small text :disabled="lock.blocked || busy" @click="sel = motors.map(m => m.key)">{{ e('select_all') }}</v-btn>
				<v-btn small text :disabled="!sel.length" @click="sel = []">{{ e('none_2') }}</v-btn>
			</div>
			<div class="d-flex flex-wrap mt-2" style="gap:6px">
				<v-btn small outlined color="error" :disabled="!canRelease || !sel.length || !anyHolding(selMotors)" @click="touch('disable', sel.slice(), 'sel')">
					<v-icon small left>mdi-engine-off-outline</v-icon>{{ e('release_selected') }}
				</v-btn>
				<v-btn
					small :color="isArmed('enable', 'sel') ? 'amber darken-3' : undefined" :dark="isArmed('enable', 'sel')"
					:outlined="!isArmed('enable', 'sel')" :disabled="!canEnable || !sel.length || !anyNotEnabled(selMotors)" @click="touch('enable', sel.slice(), 'sel')"
				>
					<v-icon small left>{{ isArmed('enable', 'sel') ? 'mdi-alert' : 'mdi-engine-outline' }}</v-icon>
					{{ isArmed('enable', 'sel') ? e('tap_again_enable') + sel.join(', ') : e('enable_selected') }}
				</v-btn>
				<v-spacer />
				<v-btn small outlined color="error" :disabled="!canRelease || !motors.length || !anyHolding(motors)" @click="touch('disable', null, 'all')">
					<v-icon small left>mdi-engine-off</v-icon>{{ e('release_all') }}
				</v-btn>
				<v-btn
					small :color="isArmed('enable', 'all') ? 'amber darken-3' : undefined" :dark="isArmed('enable', 'all')"
					:outlined="!isArmed('enable', 'all')" :disabled="!canEnable || !motors.length || !anyNotEnabled(motors)" @click="touch('enable', null, 'all')"
				>
					<v-icon small left>{{ isArmed('enable', 'all') ? 'mdi-alert' : 'mdi-engine' }}</v-icon>
					{{ isArmed('enable', 'all') ? e('tap_again_enable_all') : e('enable_all') }}
				</v-btn>
			</div>
			<!-- what is going to happen: for the selection, or for what is armed -->
			<div v-if="noticesView.list.length" class="enabled-notices mt-2" :class="{ 'enabled-notices-armed': !!armed }">
				<div class="text-caption font-weight-medium">
					{{ armed ? e('tap_again_to_confirm') : e('if_you_release_the_selection') }} &middot; {{ noticesView.command }}
				</div>
				<ul class="text-caption">
					<li v-for="(a, i) in noticesView.list" :key="i">{{ a }}</li>
				</ul>
			</div>
		</div>

		<div v-if="!understood && !lock.blocked" class="text-caption enabled-faint mt-2">{{ e('to_release_first_tick_understood') }}</div>
		<div v-if="busy" class="text-caption mt-2">{{ e('sending') }}</div>
		<v-alert v-if="result" dense outlined :type="result.ok ? 'success' : 'error'" class="mt-2 mb-0">{{ result.text }}</v-alert>

		<v-expansion-panels flat class="mt-2">
			<v-expansion-panel>
				<v-expansion-panel-header class="px-0"><span><v-icon small class="mr-1">mdi-help-circle-outline</v-icon>{{ e('what_can_and_cannot_be_done') }}</span></v-expansion-panel-header>
				<v-expansion-panel-content class="text-body-2">
					<p><b>{{ e('per_axis_or_extruder_not_per') }}</b> {{ e('the_firmware_reprapfirmware_enables_and') }}</p>
					<p><b>{{ e('commands') }}</b> {{ e('m18_x_one_axis_m18_e0') }}</p>
					<p><b>{{ e('they_enable_themselves') }}</b> {{ e('any_move_of_that_axis_jog') }}</p>
					<p><b>{{ e('idle') }}</b> {{ e('motors_at_rest_are_not_disabled') }}</p>
					<details class="wf-more">
						<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
					<p><b>{{ e('how_the_state_is_known') }}</b> {{ e('the_firmware_does_not_publish_it') }}</p>
					</details>
				</v-expansion-panel-content>
			</v-expansion-panel>
		</v-expansion-panels>
	</div>
</template>

<script>
'use strict'

// Motors > Release / enable: M18 / M17 per axis or extruder, the selection or all, through the service's API.
// Release = level 4 (fixed notices + "Understood", then one tap); enable = level 2 (double tap): RULES of enable.js.
// The risk bar and the lights of "motors without force" come from the service (motorReport.released), whoever released
// them: this page only sends the orders and shows the state.

import { apiText } from './workshop-api.js'
import { machineFree } from './machine-free.js'
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { motorsOf, block, command, notices, textIdle, noticesLevel4, tap, canUse } from './enable.js'
import { ENABLE_COLOR, ENABLE_ICON } from './motor-state.js'
import { sendMotors, ANSWER_MS } from './motors-send.js'
import { roleMixin } from './role-mixin.js' // what the role may do (vue/_shared)

export default {
	mixins: [roleMixin],
	props: {
		report: { type: Object, default: null },
		om: { type: Object, required: true },
		liveJob: { type: [Object, Boolean], default: null }
	},
	data() {
		return {
			sel: [],
			armed: null, // { id, until, action, keys } of the armed double tap
			busy: false,
			result: null,
			waiting: null, // { keys, seq, until }: the reading of the drivers that confirms the order
			understood: false,
			now: Date.now()
		};
	},
	computed: {
		motors() {
			return motorsOf(this.om, this.report);
		},
		reserved() {
			const f = machineFree(this.om, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings', allowBusy: true });
			return f.code === 'reserved' ? f.reason : '';
		},
		lock() {
			return block(this.om, this.liveJob, { report: this.report, reserved: this.reserved });
		},
		// what each button can do depends on the real state of the motor: a holding motor has nothing to enable, a released one nothing to release
		selMotors() {
			return this.motors.filter(m => this.sel.indexOf(m.key) >= 0);
		},
		canRelease() {
			return this.atLeast('technician') && canUse('disable', this.lock, this.understood, this.busy);
		},
		canEnable() {
			return this.atLeast('operator') && canUse('enable', this.lock, this.understood, this.busy);
		},
		noticesLevel4() {
			return noticesLevel4();
		},
		textIdle() {
			return textIdle(this.om);
		},
		// what is going to happen: the armed order, or a release of the selection
		noticesView() {
			const action = this.armed ? this.armed.action : 'disable';
			const keys = this.armed ? this.armed.keys : (this.sel.length ? this.sel : null);
			if (!this.armed && !this.sel.length) {
				return { list: [], command: '' };
			}
			const affected = keys ? this.motors.filter(m => keys.indexOf(m.key) >= 0) : this.motors;
			return { list: notices(action, affected, this.om), command: command(action, keys) };
		}
	},
	watch: {
		'report.enabled_seq'(seq) {
			if (this.waiting && typeof seq === 'number' && seq > this.waiting.seq) {
				this.waiting = null;
			}
		},
		'lock.blocked'(b) {
			if (b) {
				this.disarm();
				this.understood = false;
			}
		}
	},
	mounted() {
		this._clock = setInterval(() => {
			this.now = Date.now();
			if (this.waiting && this.now > this.waiting.until) {
				this.waiting = null;
			}
			if (this.armed && this.now >= this.armed.until) {
				this.armed = null;
			}
		}, 500);
	},
	beforeDestroy() {
		clearInterval(this._clock);
	},
	methods: {
		holding(m) {
			return m.state !== 'released' && m.state !== 'off' && m.state !== 'unpowered';
		},
		anyHolding(list) {
			return list.some(m => this.holding(m));
		},
		anyNotEnabled(list) {
			return list.some(m => m.state !== 'enabled');
		},
		e(key, params) {
			return this.$t('plugins.WorkshopMotors.enable.' + key, params);
		},
		s(key, params) {
			return this.$t('plugins.WorkshopMotors.page.' + key, params);
		},
		choose(key, on) {
			const i = this.sel.indexOf(key);
			if (on && i < 0) {
				this.sel.push(key);
			} else if (!on && i >= 0) {
				this.sel.splice(i, 1);
			}
		},
		isArmed(action, id) {
			return !!this.armed && this.armed.action === action && this.armed.id === action + ':' + id;
		},
		disarm() {
			this.armed = null;
		},
		// one tap: a release fires at once (the level 4 box already confirmed it); an enable arms first (double tap)
		touch(action, keys, id) {
			if (!canUse(action, this.lock, this.understood, this.busy)) {
				return;
			}
			this.now = Date.now();
			const name = action + ':' + id;
			const r = tap(action, name, this.armed && this.armed.action === action ? this.armed : null, this.now);
			this.result = null;
			if (r.armed) {
				this.armed = Object.assign({ action, keys }, r.armed);
				return;
			}
			this.disarm();
			this.send(action, keys);
		},
		async send(action, keys) {
			this.busy = true;
			const seq = this.report && typeof this.report.enabled_seq === 'number' ? this.report.enabled_seq : null;
			const r = await sendMotors(apiText, action, keys);
			this.busy = false;
			if (!r.ok) {
				this.result = { ok: false, text: r.error };
				return;
			}
			const list = keys || this.motors.map(m => m.key);
			if (seq != null) {
				this.waiting = { keys: list, seq, until: Date.now() + ANSWER_MS };
			}
			const cmd = r.command || command(action, keys);
			const what = keys ? keys.join(', ') : this.e('all_lower');
			this.result = {
				ok: true,
				text: action === 'disable'
					? this.e('disabled_list_cmd', { list: what, cmd }) + ' ' + this.e('home_the_machine_before_working_again')
					: this.e('enabled_list_cmd', { list: what, cmd })
			};
			if (action === 'disable') {
				this.sel = [];
				this.understood = false; // the next release: read the notices again
			}
		},
		pending(key) {
			return !!this.waiting && this.waiting.keys.indexOf(key) >= 0;
		},
		stateColor(state) {
			return ENABLE_COLOR[state] || 'grey';
		},
		stateIcon(state) {
			return ENABLE_ICON[state] || 'mdi-help-circle-outline';
		},
		driverColor(v) {
			return v === true ? 'success' : (v === false ? 'grey' : 'grey');
		},
		driverIcon(v) {
			if (v === true) return 'mdi-checkbox-blank-circle';
			if (v === false) return 'mdi-checkbox-blank-circle-outline';
			return 'mdi-help-circle-outline';
		},
		textDriver(d) {
			if (this.report && this.report.without_power_supply) return this.e('no_power');
			if (d.enabled === true) return this.e('st_enabled');
			if (d.enabled === false) return this.e('st_disabled');
			return d.board === 'main' ? this.e('no_data_yet') : this.e('cannot_be_read_can');
		}
	}
};
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
