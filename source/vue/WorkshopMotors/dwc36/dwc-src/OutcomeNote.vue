<template>
	<!-- The result of an action of the page: a refusal of the session or the role is a calm note of its cause (<session-notice>, ESTANDAR 2), any other
	     result is the alert of its type. `kind` comes from refusedOf() (sequence.js); '' draws the alert. -->
	<div v-if="text">
		<session-notice v-if="kind" :kind="kind" :text="text" />
		<v-alert v-else dense outlined :type="type" class="mb-0">{{ text }}</v-alert>
	</div>
</template>

<script>
'use strict'

import SessionNotice from './SessionNotice.vue' // vue/_shared36

export default {
	components: { SessionNotice },
	props: {
		text: { type: String, default: '' },
		kind: { type: String, default: '' },
		type: { type: String, default: 'error' }
	}
}
</script>
