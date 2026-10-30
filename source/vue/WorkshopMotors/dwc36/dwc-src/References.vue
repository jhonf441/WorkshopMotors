<template>
	<div class="mt-4">
		<div class="text-subtitle-2 d-flex align-center flex-wrap" style="gap:6px">
			<v-icon small>mdi-table-large</v-icon>{{ $t('plugins.WorkshopMotors.references.references_to_compare') }}
			<v-chip x-small label outlined :color="shared ? 'success' : 'grey'">{{ shared ? $t('plugins.WorkshopMotors.references.shared_table_up_to_date') : $t('plugins.WorkshopMotors.references.copy_included_in_the_plugin') }}</v-chip>
		</div>
		<details class="wf-more">
			<summary>{{ $t('plugins.WorkshopMotors.common.how_it_works') }}</summary>
		<div class="text-caption grey--text mb-2">
			{{ $t('plugins.WorkshopMotors.references.table_note') }}{{ timing ? ' (M569 T' + timing + ')' : '' }}.
		</div>
		</details>
		<div class="ref-scroll">
			<v-simple-table dense class="ref-table">
				<thead>
					<tr><th>{{ $t('plugins.WorkshopMotors.common.board') }}</th><th>{{ $t('plugins.WorkshopMotors.references.firmware') }}</th><th>{{ $t('plugins.WorkshopMotors.references.timing') }}</th><th>{{ $t('plugins.WorkshopMotors.references.case') }}</th><th class="text-right">{{ $t('plugins.WorkshopMotors.references.khz_motor') }}</th><th>{{ $t('plugins.WorkshopMotors.references.source') }}</th></tr>
				</thead>
				<tbody>
					<tr v-if="ceiling" class="ref-mine">
						<td>{{ board || $t('plugins.WorkshopMotors.references.this_board') }}</td><td>{{ ceiling.firmware || '?' }}</td><td>{{ timing || '?' }}</td>
						<td>{{ $t('plugins.WorkshopMotors.references.axis_micro', { axis: ceiling.axis, micro: ceiling.micro }) }}</td><td class="text-right"><b>{{ ceiling.khz_per_motor }}</b></td><td>{{ $t('plugins.WorkshopMotors.references.your_measurement') }}</td>
					</tr>
					<tr v-for="(f, i) in rows" :key="i" :class="{ 'ref-same': timing && String(f.timing) === String(timing) }">
						<td>{{ f.board }}</td><td>{{ f.firmware }}</td><td>{{ f.timing }}</td><td>{{ caseOf(f) }}</td>
						<td class="text-right">{{ f.khz }}</td><td>{{ sourceOf(f) }}</td>
					</tr>
				</tbody>
			</v-simple-table>
		</div>
		<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
			<v-btn v-if="ceiling" small outlined color="primary" @click="share()">
				<v-icon left small>mdi-share-variant-outline</v-icon>{{ $t('plugins.WorkshopMotors.references.share_my_measurement') }}
			</v-btn>
			<span class="text-caption grey--text">
				{{ ceiling ? $t('plugins.WorkshopMotors.references.opens_a_github_issue_already_filled') : $t('plugins.WorkshopMotors.references.measure_your_board_s_ceiling_above') }}
			</span>
		</div>
		<div class="d-flex flex-wrap align-center mt-2" style="gap:8px">
			<v-btn small outlined :loading="refreshing" @click="update()">
				<v-icon left small>mdi-refresh</v-icon>{{ $t('plugins.WorkshopMotors.references.update_table') }}
			</v-btn>
			<v-btn small outlined @click="download('csv')">
				<v-icon left small>mdi-download</v-icon>{{ $t('plugins.WorkshopMotors.references.download_csv') }}
			</v-btn>
			<v-btn small outlined @click="download('json')">
				<v-icon left small>mdi-code-json</v-icon>{{ $t('plugins.WorkshopMotors.references.download_json') }}
			</v-btn>
			<span class="text-caption grey--text">{{ failed ? $t('plugins.WorkshopMotors.references.update_failed') : (updatedAt ? $t('plugins.WorkshopMotors.references.updated_on', { date: updatedAt.slice(0, 10) }) : '') }}</span>
		</div>
	</div>
</template>

<script>
import i18n from '../../i18n'

'use strict'

// Reference table of the pulse ceiling (2026-10-10, request: "you should
// leave the reference [dc42] talks about ... in case someone measures it can be
// updated for everyone"). The copy of references.json travels in the plugin; the
// shared one lives in the public repo (source/vue/<Id>/dwc-src/references.json)
// and is read from GitHub. To add a measurement: a notice (issue) with the data.
// Format and texts of the rows: references.js.
import REF from './references.json'
import { readTable, caseText, sourceText, shareRow, timingOf, readCache, writeCache, tableToCsv, tableToJson, TABLE_URL } from './references.js'

const REPO = 'WorkshopMotors';
const pt = (key, params) => i18n.t('plugins.WorkshopMotors.' + key, params);
const rt = (key, params) => pt('references.' + key, params);

export default {
	props: {
		ceiling: { type: Object, default: null },
		report: { type: Object, default: null }
	},
	data() {
		const cached = readCache(window.localStorage);
		return { rows: cached ? cached.rows : (readTable(REF) || []), shared: !!cached, updatedAt: cached ? cached.at : null, refreshing: false, failed: false };
	},
	computed: {
		model() {
			return this.$store.state.machine.model;
		},
		board() {
			const b = this.model.boards && this.model.boards[0];
			return b ? (b.name || b.shortName || '') : '';
		},
		timing() {
			return timingOf(this.report);
		}
	},
	mounted() {
		this.load();
	},
	methods: {
		// reads the shared table from the repository; on a failure (no internet, repository not public, file missing) what was shown stays
		async load() {
			try {
				const res = await fetch(TABLE_URL, { cache: 'no-store' });
				const table = res.ok ? await res.json() : null;
				const found = readTable(table);
				if (!found) throw new Error('no table');
				this.rows = found;
				this.shared = true;
				this.failed = false;
				this.updatedAt = new Date().toISOString();
				writeCache(window.localStorage, table, this.updatedAt);
			} catch (e) {
				this.failed = true;
			}
		},
		async update() {
			this.refreshing = true;
			await this.load();
			this.refreshing = false;
		},
		// the table as it is shown now (the shared one or the copy of the plugin) as a file for a spreadsheet or to compare
		download(kind) {
			const csv = kind === 'csv';
			const blob = new Blob([csv ? tableToCsv(this.rows) : tableToJson(this.rows)], { type: csv ? 'text/csv' : 'application/json' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = 'workshop-pulse-references.' + (csv ? 'csv' : 'json');
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		},
		caseOf(row) {
			return caseText(row, pt);
		},
		sourceOf(row) {
			return sourceText(row, pt);
		},
		share() {
			const t = this.ceiling || {};
			const fw = (this.model.boards && this.model.boards[0] && this.model.boards[0].firmwareVersion) || t.firmware || '?';
			const row = shareRow(t, this.board, fw, this.timing);
			const title = rt('issue_title', { board: row.board, fw, khz: t.khz_per_motor });
			const body = [
				rt('issue_intro'),
				'',
				'- ' + rt('issue_board', { v: row.board }),
				`- Firmware: ${fw}`,
				'- ' + rt('issue_timing', { v: row.timing }),
				'- ' + rt('issue_axis', { axis: t.axis, micro: t.micro }),
				'- ' + rt('issue_no_hiccups_until', { khz: t.khz_per_motor }) + ' ' + (t.khz_fault ? rt('issue_hiccups_from', { khz: t.khz_fault }) : rt('issue_no_hiccups_seen')),
				'- ' + rt('issue_date', { v: t.date || '' }),
				'',
				rt('issue_row'),
				'```json',
				JSON.stringify(row),
				'```'
			].join('\n');
			const url = `https://github.com/jhonf441/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
			window.open(url, '_blank', 'noopener');
		}
	}
}
</script>

<style scoped>
.ref-scroll { overflow-x: auto; }
.ref-table td, .ref-table th { white-space: nowrap; }
.ref-table .ref-same td { background: rgba(25, 118, 210, 0.10); }
.ref-table .ref-mine td { background: rgba(46, 125, 50, 0.14); }
</style>
