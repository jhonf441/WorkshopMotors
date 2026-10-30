'use strict'

// Constants shared by the Motors sections that cannot live in a <script setup> (a .vue file cannot export them).

// the file with the step ceiling MEASURED on this board (Measure writes it, Motors reads it)
export const CEILING_FILE = '0:/sys/workshop/config/step-ceiling.json'

// the history of the axis tests (axis-test.g appends to it)
export const TESTS_FILE = '0:/sys/workshop/data/axis-test.csv'

export const THRESHOLD_MM = 0.1

// Step-loss threshold per axis: with a switch (G1 H4) ~0.1 mm; Z is measured
// with the probe (G30 S-1, repeatability ~0.01 mm) and a whole Z step is
// ~0.04 mm, so 0.03 mm is used.
export function thresholdAxis(axis) {
	return axis === 'Z' ? 0.03 : THRESHOLD_MM
}
