<template>
	<div>
		<v-tabs v-model="sub" height="38" show-arrows class="mb-3">
			<v-tab v-if="hasJog"><v-icon size="small" start>mdi-gamepad-variant-outline</v-icon>{{ $t('plugins.WorkshopMotors.motors.jog_without_limits') }}</v-tab>
			<v-tab><v-icon size="small" start>mdi-home-import-outline</v-icon>{{ $t('plugins.WorkshopMotors.motors.sensorless_endstop') }}</v-tab>
		</v-tabs>
		<!-- v-if: each part mounts only when shown (the sensorless end stop reads M569 / M915 of the drivers when it opens) -->
		<crash-jog v-if="hasJog && sub === 0" :axes="axes" :state="state" />
		<endstop-crash v-else :om="om" :report="report" :live-job="liveJob" />
	</div>
</template>

<script setup>
// Motors > Crash: StallGuard of the jog without limits (only with the Jog plugin) and as an end stop (sensorless homing).

import { computed, ref } from 'vue'
import CrashJog from './Crash.vue'
import EndstopCrash from './EndstopCrash.vue'
import { pluginActive } from './workshop-ids.js' // the crash detection of the jog belongs to the Jog plugin

defineProps({
	axes: { type: Array, default: () => [] },
	state: { type: String, default: '' },
	om: { type: Object, default: null },
	report: { type: Object, default: null },
	liveJob: { type: [Object, Boolean], default: null }
})

const sub = ref(0)
const hasJog = computed(() => pluginActive('jog'))
</script>
