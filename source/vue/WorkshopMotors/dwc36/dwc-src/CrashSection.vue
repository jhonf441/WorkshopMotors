<template>
	<div>
		<v-tabs v-model="sub" height="38" show-arrows class="mb-3">
			<v-tab v-if="hasJog"><v-icon small left>mdi-gamepad-variant-outline</v-icon>{{ $t('plugins.WorkshopMotors.motors.jog_without_limits') }}</v-tab>
			<v-tab><v-icon small left>mdi-home-import-outline</v-icon>{{ $t('plugins.WorkshopMotors.motors.sensorless_endstop') }}</v-tab>
		</v-tabs>
		<!-- v-if: each part mounts only when shown (the sensorless end stop reads M569 / M915 of the drivers when it opens) -->
		<crash-jog v-if="hasJog && sub === 0" :axes="axes" :state="state" />
		<endstop-crash v-else :om="om" :report="report" :live-job="liveJob" />
	</div>
</template>

<script>
'use strict'

// Motors > Crash: StallGuard of the jog without limits (only with the Jog plugin) and as an end stop (sensorless homing).

import CrashJog from './Crash.vue'
import EndstopCrash from './EndstopCrash.vue'
import { pluginActive } from './workshop-ids.js' // the crash detection of the jog belongs to the Jog plugin

export default {
	components: { CrashJog, EndstopCrash },
	props: {
		axes: { type: Array, default: () => [] },
		state: { type: String, default: '' },
		om: { type: Object, default: null },
		report: { type: Object, default: null },
		liveJob: { type: [Object, Boolean], default: null }
	},
	data() {
		return { sub: 0 };
	},
	computed: {
		hasJog() {
			return pluginActive(this.$store, 'jog');
		}
	}
};
</script>
