import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, suggestMapping, parseMoney, parsePct, normalizeRows, type FieldMap } from './parse.js';

test('parseCsv handles quoted fields, embedded commas and escaped quotes', () => {
  const csv = 'Policy #,Insured,Premium\n"TR-1","Acme, Inc.","1,200.00"\nTR-2,"Bob ""The Hauler""",900\n';
  const { headers, rows } = parseCsv(csv);
  assert.deepEqual(headers, ['Policy #', 'Insured', 'Premium']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!['Insured'], 'Acme, Inc.');
  assert.equal(rows[0]!['Premium'], '1,200.00');
  assert.equal(rows[1]!['Insured'], 'Bob "The Hauler"');
});

test('parseCsv strips BOM and drops blank trailing lines', () => {
  const csv = '﻿A,B\n1,2\n\n';
  const { headers, rows } = parseCsv(csv);
  assert.deepEqual(headers, ['A', 'B']);
  assert.equal(rows.length, 1);
});

test('parseCsv handles a newline inside a quoted field', () => {
  const { rows } = parseCsv('A,B\n"line1\nline2",x\n');
  assert.equal(rows[0]!['A'], 'line1\nline2');
  assert.equal(rows[0]!['B'], 'x');
});

test('suggestMapping picks rate column over the commission amount', () => {
  const map = suggestMapping(['Policy Number', 'Written Premium', 'Commission Amount', 'Commission Rate', 'Transaction Type']);
  assert.equal(map.policyNumber, 'Policy Number');
  assert.equal(map.premiumAmount, 'Written Premium');
  assert.equal(map.commissionAmount, 'Commission Amount');
  assert.equal(map.commissionPct, 'Commission Rate');
  assert.equal(map.isRenewal, 'Transaction Type');
});

test('parseMoney handles symbols, commas and parenthesized negatives', () => {
  assert.equal(parseMoney('$1,234.50'), 1234.5);
  assert.equal(parseMoney('(123.45)'), -123.45);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('n/a'), null);
});

test('parsePct normalizes percent points and fractions to 0–1', () => {
  assert.equal(parsePct('15%'), 0.15);
  assert.equal(parsePct('15'), 0.15);
  assert.equal(parsePct('0.15'), 0.15);
  assert.equal(parsePct(''), null);
});

test('normalizeRows flags rows missing a commission amount', () => {
  const map: FieldMap = { policyNumber: 'Pol', commissionAmount: 'Comm', premiumAmount: 'Prem', commissionPct: 'Rate', isRenewal: 'Type' };
  const rows = [
    { Pol: 'TR-1', Prem: '1000', Comm: '150', Rate: '15%', Type: 'New' },
    { Pol: 'TR-2', Prem: '1000', Comm: '', Rate: '15%', Type: 'Renewal' },
    { Pol: '', Prem: '500', Comm: '75', Rate: '15%', Type: 'New' },
  ];
  const res = normalizeRows(rows, map);
  assert.equal(res.total, 3);
  assert.equal(res.valid, 1);
  assert.equal(res.flagged, 2);
  assert.equal(res.items[0]!.commissionAmount, 150);
  assert.equal(res.items[0]!.isRenewal, false);
  assert.equal(res.items[1]!.isRenewal, true);
  assert.equal(res.items[1]!.flagReason, 'missing or unparseable commission amount');
  assert.equal(res.items[2]!.flagReason, 'missing policy number');
  assert.ok(Math.abs(res.confidence - 1 / 3) < 1e-9);
});
