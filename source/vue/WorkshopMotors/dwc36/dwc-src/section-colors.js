'use strict'

// The color of each section of the page (the family reads it as --wf-sec on the page root).

export const SECTION_COLORS = {
	state: '#43A047',
	details: '#1E88E5',
	charts: '#00ACC1',
	release: '#FFA000',
	advisor: '#7E57C2',
	test: '#26A69A',
	measure: '#F57C00',
	crash: '#E53935'
}

export function sectionColor(id) {
	return SECTION_COLORS[id] || '#7E57C2'
}
