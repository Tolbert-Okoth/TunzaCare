import test from 'node:test';
import assert from 'node:assert/strict';

import { getAlertLevel, logReading } from '../src/logic/readings.js';
import { clearAll, getReadings } from '../src/storage/store.js';

test('Emergency Invariant (Rule 3): Emergency Alerts Cannot Be Softened or Auto-Dismissed', () => {
  clearAll();

  // Test Case 1: Severe Hypertensive Crisis
  const bpEmergency = getAlertLevel('BP', { systolic: 205, diastolic: 110 });
  assert.equal(bpEmergency.isEmergency, true);
  assert.ok(bpEmergency.emergencyDetails);
  assert.equal(bpEmergency.emergencyDetails.requiresAcknowledgment, true);
  assert.ok(bpEmergency.emergencyDetails.title_en.length > 0);
  assert.ok(bpEmergency.emergencyDetails.title_sw.length > 0);
  assert.ok(bpEmergency.emergencyDetails.body_en.includes('medical attention right away'));

  // Test Case 2: Severe Hypotension
  const bpLow = getAlertLevel('BP', { systolic: 75, diastolic: 45 });
  assert.equal(bpLow.isEmergency, true);
  assert.equal(bpLow.emergencyDetails.type, 'EMERGENCY_LOW_BP');
  assert.equal(bpLow.emergencyDetails.requiresAcknowledgment, true);

  // Test Case 3: Severe Hypoglycemia
  const gLow = getAlertLevel('GLUCOSE', { value: 45, unit: 'mg/dL' });
  assert.equal(gLow.isEmergency, true);
  assert.equal(gLow.emergencyDetails.type, 'EMERGENCY_LOW_GLUCOSE');
  assert.equal(gLow.emergencyDetails.requiresAcknowledgment, true);
  assert.ok(gLow.emergencyDetails.body_en.includes('fast-acting sugar'));

  // Test Case 4: Severe Hyperglycemia
  const gHigh = getAlertLevel('GLUCOSE', { value: 450, unit: 'mg/dL' });
  assert.equal(gHigh.isEmergency, true);
  assert.equal(gHigh.emergencyDetails.type, 'EMERGENCY_HIGH_GLUCOSE');
  assert.equal(gHigh.emergencyDetails.requiresAcknowledgment, true);
  assert.ok(gHigh.emergencyDetails.body_en.includes('dangerously high'));

  // Test Case 5: Assert logged reading preserves emergency metadata
  const logged = logReading('BP', { systolic: 210, diastolic: 105 });
  assert.equal(logged.alertEvaluation.isEmergency, true);
  const fromStore = getReadings();
  assert.equal(fromStore[0].alertEvaluation.isEmergency, true);
  assert.equal(fromStore[0].alertEvaluation.emergencyDetails.requiresAcknowledgment, true);
});
