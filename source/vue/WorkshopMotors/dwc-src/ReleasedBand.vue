<template>
	<!-- DESIGN.md level 4: the notice stays in view while it lasts and says how to end it -->
	<v-alert type="error" density="compact" prominent icon="mdi-engine-off" class="mb-3">
		<div class="d-flex align-center flex-wrap" style="gap:8px">
			<div class="flex-grow-1" style="min-width:220px">
				<div class="font-weight-medium">{{ t('banner_title', { list }) }}</div>
				<div class="text-body-medium">{{ t('banner_text') }}</div>
				<div v-if="lock.blocked" class="text-body-small mt-1">{{ lock.reason }}</div>
				<div v-if="result" class="text-body-medium mt-1">{{ result }}</div>
			</div>
			<v-btn
				size="small" :color="armedNow ? 'amber-darken-3' : 'white'" :variant="armedNow ? 'flat' : 'outlined'"
				:disabled="!usable" :loading="busy" @click="touchEnable()"
			>
				<v-icon size="small" start>{{ armedNow ? 'mdi-alert' : 'mdi-engine' }}</v-icon>{{ armedNow ? t('banner_tap_again', { list }) : t('banner_enable_all') }}
			</v-btn>
			<v-btn size="small" variant="text" @click="$emit('open')">{{ t('section_release') }}</v-btn>
		</div>
	</v-alert>
</template>

<script setup>
// The level 4 band of the Motors page: some motors have no holding force (released with M18, here or anywhere: the
// service keeps the list). It stays above every section while it lasts and enables them again with a double tap
// (level 2: a motor that gets current jumps to its nearest full step).

import { computed, onBeforeUnmount, ref } from 'vue'
import { i18n } from './dwc-host.js'
import { apiText } from './workshop-api.js'
import { machineFree } from './machine-free.js'
import { ts } from './shared-t.js'
import { serviceText, serviceDefaultKey } from './service-text.js'
import { block, tap, canUse } from './enable.js'
import { sendMotors } from './motors-send.js'

const props = defineProps({
	keys: { type: Array, required: true },
	report: { type: Object, default: null },
	om: { type: Object, required: true },
	liveJob: { type: [Object, Boolean], default: null }
})
defineEmits(['open'])

const armed = ref(null)
const busy = ref(false)
const result = ref('')
const now = ref(Date.now())
let disarmTimer = null

const list = computed(() => props.keys.join(', '))
const reserved = computed(() => {
	const f = machineFree(props.om, { t: ts, serviceText, serviceDefaultKey, purpose: 'settings', allowBusy: true })
	return f.code === 'reserved' ? f.reason : ''
})
const lock = computed(() => block(props.om, props.liveJob, { report: props.report, reserved: reserved.value }))
const usable = computed(() => canUse('enable', lock.value, true, busy.value))
const armedNow = computed(() => !!armed.value && now.value < armed.value.until)

onBeforeUnmount(() => clearTimeout(disarmTimer))

function t(key, params) {
	return i18n.t('plugins.WorkshopMotors.page.' + key, params)
}
function touchEnable() {
	if (!usable.value) {
		return
	}
	now.value = Date.now()
	const r = tap('enable', 'band', armedNow.value ? armed.value : null, now.value)
	armed.value = r.armed
	clearTimeout(disarmTimer)
	if (r.armed) {
		disarmTimer = setTimeout(() => { armed.value = null }, r.armed.until - now.value)
		return
	}
	send()
}
async function send() {
	busy.value = true
	result.value = ''
	const keys = props.keys.slice()
	const r = await sendMotors(apiText, 'enable', keys)
	busy.value = false
	result.value = r.ok ? t('banner_enabled', { list: keys.join(', ') }) : r.error
}
</script>
