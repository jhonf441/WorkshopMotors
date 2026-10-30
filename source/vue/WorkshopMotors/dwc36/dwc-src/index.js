'use strict'

// WorkshopMotors -- "Motors" page (formerly inside WorkshopService, split off 2026-10-08).
// Reads the data published by the WorkshopService backend
// (machine.model.plugins.get('WorkshopService').data) and asks it for things with
// its API (POST /machine/WorkshopService/api), so it needs that backend installed to show data.
// The route is /Plugins/Motors.

import './i18n-register.js'
import { registerRoute } from '../../routes'
import './safe-saving.js' // power cut: save with a backup and in one step (vue/_shared)

import motors from './Motors.vue'
import './theme.css'

registerRoute(motors, {
	Plugins: {
		WorkshopMotors: {
			icon: 'mdi-engine',
			caption: 'plugins.WorkshopMotors.common.motors',
			path: '/Plugins/Motors'
		}
	}
});

// a bookmark or a link to the old Spanish address keeps working
