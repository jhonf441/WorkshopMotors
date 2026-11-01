'use strict';

// The files of Motors handed to the browser through the shared exchange module (data-exchange-ui.js). The contents are made by pure files:
// report-file.js (the advanced report) and references.js (the pulse reference table); test/report-file.test.js and test/references.test.js
// run these functions over a fake browser.

import { exchangeExportCsv, exchangeExportJson, exchangeSave } from './data-exchange-ui.js';
import { exchangeFileName } from './data-exchange.js';
import { reportText } from './charts.js';
import { REPORT_FORMAT, REPORT_VERSION, REPORT_PLUGIN, reportTable, reportData } from './report-file.js';
import { FORMAT as REFERENCES_FORMAT, tableToCsv, tableToJson } from './references.js';

// Downloads the advanced report: kind 'csv' | 'json' | 'txt'; model: the object model of DWC (it names the machine in the JSON envelope).
// Returns false when the browser did not allow the download.
export function exportReport(kind, report, model) {
	if (kind === 'csv') {
		const table = reportTable(report);
		return exchangeExportCsv(REPORT_FORMAT, table.columns, table.rows).ok;
	}
	if (kind === 'json') {
		return exchangeExportJson({ format: REPORT_FORMAT, version: REPORT_VERSION, plugin: REPORT_PLUGIN, data: reportData(report), model }).ok;
	}
	return exchangeSave(exchangeFileName(REPORT_FORMAT, 'txt'), reportText(report), 'text/plain', false);
}

// Downloads the pulse reference table as shown now: kind 'csv' (the layout of the standard) or 'json' (the file of the repository, no envelope).
// Returns false when the browser did not allow the download.
export function exportReferences(kind, rows) {
	if (kind === 'csv') {
		const table = tableToCsv(rows);
		return exchangeExportCsv(REFERENCES_FORMAT, table.columns, table.rows).ok;
	}
	return exchangeSave(exchangeFileName(REFERENCES_FORMAT, 'json'), tableToJson(rows), 'application/json', false);
}
