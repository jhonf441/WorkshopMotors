<template>
	<!-- DESIGN.md level 4: the notice stays in view while it lasts and says how to end it -->
	<v-alert type="error" dense prominent icon="mdi-engine-off" class="mb-3">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<div class="flex-grow-1" style="min-width:220px">
				<div class="font-weight-medium">{{ t('banner_title', { list }) }}</div>
				<div class="text-body-2">{{ t('banner_text') }}</div>
				<div v-if="lock.blocked" class="text-caption mt-1">{{ lock.reason }}</div>
				<div v-if="result" class="text-body-2 mt-1">{{ result }}</div>
			</div>
			<v-btn
				small :color="armedNow ? 'amber darken-3' : 'white'" :outlined="!armedNow" :dark="armedNow" :light="!armedNow"
				:disabled="!usable" :loading="busy" @click="touchEnable()"
			>
				<v-icon small left>{{ armedNow ? 'mdi-alert' : 'mdi-engine' }}</v-icon>{{ armedNow ? t('banner_tap_again', { list }) : t('banner_enable_all') }}
			</v-btn>
			<v-btn small text dark @click="$emit('open')">{{ t('section_release') }}</v-btn>
		</div>
	</v-alert>
</template>

<script>
'use strict'

// The level 4 band of the Motors page: some motors have no holding force (released with M18, here or anywhere: the
// service keeps the list). It stays above every section while it lasts and enables them again with a double tap
// (level 2: a motor that gets current jumps to its nearest full step).

import { apiText } from './workshop-api.js'
import { machineFree } from './machine-free.js'
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { block, tap, canUse } from './enable.js'
import { sendMotors } from './motors-send.js'

export default {
	props: {
		keys: { type: Array, required: true },
		report: { type: Object, default: null },
		om: { type: Object, required: true },
		liveJob: { type: [Object, Boolean], default: null }
	},
	data() {
		return { armed: null, busy: false, result: '', now: Date.now() };
	},
	computed: {
		list() {
			return this.keys.join(', ');
		},
		reserved() {
			const f = machineFree(this.om, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings', allowBusy: true });
			return f.code === 'reserved' ? f.reason : '';
		},
		lock() {
			return block(this.om, this.liveJob, { report: this.report, reserved: this.reserved });
		},
		usable() {
			return canUse('enable', this.lock, true, this.busy);
		},
		armedNow() {
			return !!this.armed && this.now < this.armed.until;
		}
	},
	beforeDestroy() {
		clearTimeout(this._disarm);
	},
	methods: {
		t(key, params) {
			return this.$t('plugins.WorkshopMotors.page.' + key, params);
		},
		touchEnable() {
			if (!this.usable) {
				return;
			}
			this.now = Date.now();
			const r = tap('enable', 'band', this.armedNow ? this.armed : null, this.now);
			this.armed = r.armed;
			clearTimeout(this._disarm);
			if (r.armed) {
				this._disarm = setTimeout(() => { this.armed = null; }, r.armed.until - this.now);
				return;
			}
			this.send();
		},
		async send() {
			this.busy = true;
			this.result = '';
			const keys = this.keys.slice();
			const r = await sendMotors(apiText, 'enable', keys);
			this.busy = false;
			this.result = r.ok ? this.t('banner_enabled', { list: keys.join(', ') }) : r.error;
		}
	}
};
</script>
