'use strict'

// WorkshopMotors -- "Motors" page (formerly inside WorkshopService, split off 2026-10-08).
// Reads the data published by the WorkshopService backend
// (machine.model.plugins.get('WorkshopService').data) and asks it for things with
// its API (POST /machine/WorkshopService/api), so it needs that backend installed to show data.
// The route is /Plugins/Motors.

import './i18n-register.js'
import { registerRoute } from 'DuetWebControl'
import { onPluginUnload, removePluginRoute } from './dwc-host.js'
import './language-reload.js' // the page loads again when the DWC language changes (vue/_shared)
import './safe-saving.js' // power cut: save with a backup and in one step (vue/_shared)
import { start as startRecord, stop as stopRecord } from './record.js'

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
})

// the history of the charts records while DWC is open, whether or not the page is (record.js)
startRecord()

// DWC 3.7 does not undo anything when the plugin is stopped: take the page out and stop what runs by itself, so that a
// later start registers the new component and a single recorder (review #4)
onPluginUnload('WorkshopMotors', () => {
	removePluginRoute('/Plugins/Motors')
	stopRecord()
})
