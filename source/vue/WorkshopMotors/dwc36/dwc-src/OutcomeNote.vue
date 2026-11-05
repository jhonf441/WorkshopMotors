<template>
	<!-- The result of an action of the page: a refusal of the session or the role is a calm note of its cause (<session-notice>, ESTANDAR 2) that names the action,
	     the role needed and the current one; any other result is the alert of its type. `text` is a string, or a failure kept as { error, label, action }
	     (session-refusal.js failureOf): its cause and sentence are computed here, so they follow the role and the language. -->
	<div v-if="line || cause">
		<session-notice v-if="cause" :kind="cause" needed="technician" :action="what" />
		<v-alert v-else dense outlined :type="type" class="mb-0">{{ line }}</v-alert>
	</div>
</template>

<script>
'use strict'

import SessionNotice from './SessionNotice.vue' // vue/_shared36
import { roleMixin } from './role-mixin.js' // vue/_shared36
import { failureActionNow, failureCauseNow, failureNow } from './session-refusal.js' // vue/_shared36

export default {
	components: { SessionNotice },
	mixins: [roleMixin],
	props: {
		text: { type: [String, Object], default: '' },
		// a refusal that is already known as a cause (motors-send.js answers with a failure, so this is only for a text that came with its own cause)
		kind: { type: String, default: '' },
		type: { type: String, default: 'error' }
	},
	computed: {
		failure() {
			return this.text && typeof this.text === 'object' ? this.text : null
		},
		cause() {
			void this.identityTick
			return this.failure ? failureCauseNow(this.failure) : this.kind
		},
		what() {
			void this.identityTick
			return this.failure ? failureActionNow(this.failure) : ''
		},
		line() {
			void this.identityTick
			return this.failure ? failureNow(this.failure, 'technician') : this.text
		}
	}
}
</script>
