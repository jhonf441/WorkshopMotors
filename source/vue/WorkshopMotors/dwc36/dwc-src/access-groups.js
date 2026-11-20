'use strict'

// The operations each group of sensitive buttons of the Motors page asks of the service (auth.can), so ONE sentence under the group says why it is locked
// (reason-mixin.js, access-reason.js). Pure: no imports. The names are the ones of dsf/permissions.json; a test compares both and the API contract.
//
//   ENABLE_OPS    enable the motors (M17): the buttons "Enable", "Enable selected", "Enable all" and the band of released motors   motors.enable
//   RELEASE_OPS   release the motors (M18): the buttons "Release", "Release selected", "Release all"                              motors.disable
//   HOLD_OPS      the two together: ONE sentence under the buttons of the Release / enable section (enable first: the lower role)
//   CONFIG_OPS    save the sensorless endstop change to config.g with the service (lock, commit, unlock)                         config.lock, config.commit, config.unlock
//   SCREEN_OPS    everything the page asks when it opens, in one call
//
// There is no stop operation here: the motors have no "stop" button on this page (the sequences of the Test, Measure and Crash sections stop with a
// local flag, "Stop after this step", that no permission gates), and nothing in this file may ever name one.
// The Motors page has no reads of its own in the service (the report comes through the object model), so the call has no reading to add.

export const ENABLE_OPS = Object.freeze(['motors.enable'])
export const RELEASE_OPS = Object.freeze(['motors.disable'])
export const HOLD_OPS = Object.freeze(['motors.enable', 'motors.disable'])
export const CONFIG_OPS = Object.freeze(['config.lock', 'config.commit', 'config.unlock'])

// the groups that carry a sentence, by name: the structure test walks this list
export const GROUPS = Object.freeze({ hold: HOLD_OPS, enable: ENABLE_OPS, config: CONFIG_OPS })

export const SCREEN_OPS = Object.freeze(Array.from(new Set([].concat(HOLD_OPS, CONFIG_OPS))))

// every operation of the group is allowed by `can` (a function op -> boolean)
export function groupAllowed(ops, can) {
	return ops.every(op => can(op))
}
