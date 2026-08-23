import test from 'node:test';
import assert from 'node:assert/strict';

import { getAlertLevel, logReading, mmolToMgdl, mgdlToMmol } from '../src/logic/readings.js';
import { logAdherence, calculateAdherenceRate, getRefillStatus } from '../src/logic/adherence.js';
import { clearAll, savePrescriptionState, getAdherenceLog } from '../src/storage/store.js';

test('Adversarial: Extreme Physiological Reading Values', () => {
  // Extreme high systolic (300 mmHg) -> Emergency High BP
  const rHigh = getAlertLevel('BP', { systolic: 300, diastolic: 140 });
  assert.equal(rHigh.isEmergency, true);
  assert.equal(rHigh.emergencyDetails.type, 'EMERGENCY_HIGH_BP');

  // Extreme low systolic (50 mmHg) -> Emergency Low BP
  const rLow = getAlertLevel('BP', { systolic: 50, diastolic: 30 });
  assert.equal(rLow.isEmergency, true);
  assert.equal(rLow.emergencyDetails.type, 'EMERGENCY_LOW_BP');

  // Extreme glucose (800 mg/dL) -> Emergency High Glucose
  const gHigh = getAlertLevel('GLUCOSE', { value: 800, unit: 'mg/dL' });
  assert.equal(gHigh.isEmergency, true);
  assert.equal(gHigh.emergencyDetails.type, 'EMERGENCY_HIGH_GLUCOSE');

  // Extreme glucose low (20 mg/dL) -> Emergency Low Glucose
  const gLow = getAlertLevel('GLUCOSE', { value: 20, unit: 'mg/dL' });
  assert.equal(gLow.isEmergency, true);
  assert.equal(gLow.emergencyDetails.type, 'EMERGENCY_LOW_GLUCOSE');
});

test('Adversarial: Same-day duplicate check-in updates rather than corrupting log', () => {
  clearAll();
  logAdherence('regimen', '2026-08-22', 'missed', 'unwell');
  const log1 = getAdherenceLog();
  assert.equal(log1.length, 1);
  assert.equal(log1[0].status, 'missed');

  // Patient later takes medication and updates today's check-in
  logAdherence('regimen', '2026-08-22', 'took', 'feeling_fine');
  const log2 = getAdherenceLog();
  assert.equal(log2.length, 1, 'Should overwrite same-day entry, not duplicate');
  assert.equal(log2[0].status, 'took');
  assert.equal(log2[0].feelingState, 'feeling_fine');
});

test('Adversarial: Zero or depleted prescription supply behavior', () => {
  // Prescription depleted 10 days ago
  const psOverdue = { totalDays: 30, lastRefillDate: '2026-07-01' };
  const status = getRefillStatus(psOverdue, '2026-08-10');
  assert.equal(status.daysRemaining, 0);
  assert.equal(status.isOverdue, true);
  assert.equal(status.isReminderDue, true);
});

test('Adversarial: Unit conversions bidirectional precision', () => {
  // 5.5 mmol/L -> ~99.1 mg/dL
  const mgdl = mmolToMgdl(5.5);
  assert.ok(Math.abs(mgdl - 99.1) < 0.2);

  // 100 mg/dL -> ~5.6 mmol/L
  const mmol = mgdlToMmol(100);
  assert.ok(Math.abs(mmol - 5.6) < 0.2);
});
