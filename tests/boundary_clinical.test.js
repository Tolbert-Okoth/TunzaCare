import test from 'node:test';
import assert from 'node:assert/strict';

import { getAlertLevel } from '../src/logic/readings.js';
import { calculateAdherenceRate } from '../src/logic/adherence.js';

test('Boundary Clinical (Rule 8): 80% Adherence Threshold', () => {
  // Exact 80% -> Is Adherent
  const r80 = calculateAdherenceRate(null, 10, Array(8).fill({ date: '2026-08-01', status: 'took' }).concat(Array(2).fill({ date: '2026-08-01', status: 'missed' })), '2026-08-10');
  assert.equal(r80.rate, 80);
  assert.equal(r80.isAdherent, true);

  // 79% (e.g. 79/100) -> Non-Adherent
  const r79 = calculateAdherenceRate(null, 100, Array(79).fill({ date: '2026-08-01', status: 'took' }).concat(Array(21).fill({ date: '2026-08-01', status: 'missed' })), '2026-08-10');
  assert.equal(r79.rate, 79);
  assert.equal(r79.isAdherent, false);

  // 81% -> Is Adherent
  const r81 = calculateAdherenceRate(null, 100, Array(81).fill({ date: '2026-08-01', status: 'took' }).concat(Array(19).fill({ date: '2026-08-01', status: 'missed' })), '2026-08-10');
  assert.equal(r81.rate, 81);
  assert.equal(r81.isAdherent, true);
});

test('Boundary Clinical: Blood Pressure Display Bands (ISH Home Monitoring)', () => {
  // Normal: <130/85
  assert.equal(getAlertLevel('BP', { systolic: 129, diastolic: 84 }).displayBand.id, 'normal');

  // High-normal: 130–139 / 85–89
  assert.equal(getAlertLevel('BP', { systolic: 130, diastolic: 80 }).displayBand.id, 'high_normal');
  assert.equal(getAlertLevel('BP', { systolic: 125, diastolic: 85 }).displayBand.id, 'high_normal');
  assert.equal(getAlertLevel('BP', { systolic: 139, diastolic: 89 }).displayBand.id, 'high_normal');

  // Grade 1: 140–159 / 90–99
  assert.equal(getAlertLevel('BP', { systolic: 140, diastolic: 80 }).displayBand.id, 'grade_1');
  assert.equal(getAlertLevel('BP', { systolic: 125, diastolic: 90 }).displayBand.id, 'grade_1');
  assert.equal(getAlertLevel('BP', { systolic: 159, diastolic: 99 }).displayBand.id, 'grade_1');

  // Grade 2: >=160/100
  assert.equal(getAlertLevel('BP', { systolic: 160, diastolic: 80 }).displayBand.id, 'grade_2');
  assert.equal(getAlertLevel('BP', { systolic: 130, diastolic: 100 }).displayBand.id, 'grade_2');
});

test('Boundary Clinical: Blood Pressure Emergency Thresholds (>=200/100 or SBP <80)', () => {
  // SBP 199/99 -> Grade 2, NOT Emergency
  const r199 = getAlertLevel('BP', { systolic: 199, diastolic: 99 });
  assert.equal(r199.isEmergency, false);
  assert.equal(r199.displayBand.id, 'grade_2');

  // SBP 200/99 -> EMERGENCY
  const r200 = getAlertLevel('BP', { systolic: 200, diastolic: 99 });
  assert.equal(r200.isEmergency, true);
  assert.equal(r200.emergencyDetails.type, 'EMERGENCY_HIGH_BP');

  // DBP 150/100 -> EMERGENCY (DBP >= 100)
  const r100 = getAlertLevel('BP', { systolic: 150, diastolic: 100 });
  assert.equal(r100.isEmergency, true);
  assert.equal(r100.emergencyDetails.type, 'EMERGENCY_HIGH_BP');

  // SBP 80/50 -> NOT Emergency
  const r80 = getAlertLevel('BP', { systolic: 80, diastolic: 50 });
  assert.equal(r80.isEmergency, false);

  // SBP 79/50 -> EMERGENCY LOW (<80)
  const r79 = getAlertLevel('BP', { systolic: 79, diastolic: 50 });
  assert.equal(r79.isEmergency, true);
  assert.equal(r79.emergencyDetails.type, 'EMERGENCY_LOW_BP');
});

test('Boundary Clinical (USER ITEM 1): Glucose Nudge vs Emergency Boundaries', () => {
  // 1. Severe Hypoglycemia (<54 mg/dL) -> EMERGENCY, NOT Nudge
  const g53 = getAlertLevel('GLUCOSE', { value: 53, unit: 'mg/dL' });
  assert.equal(g53.isEmergency, true);
  assert.equal(g53.isNudge, false);
  assert.equal(g53.emergencyDetails.type, 'EMERGENCY_LOW_GLUCOSE');
  assert.equal(g53.emergencyDetails.requiresAcknowledgment, true);

  // 2. Mild Low (54 to 69 mg/dL) -> NUDGE, NOT Emergency (15-15 rule)
  const g54 = getAlertLevel('GLUCOSE', { value: 54, unit: 'mg/dL' });
  assert.equal(g54.isEmergency, false);
  assert.equal(g54.isNudge, true);
  assert.equal(g54.nudgeDetails.type, 'NUDGE_MILD_LOW');

  const g65 = getAlertLevel('GLUCOSE', { value: 65, unit: 'mg/dL' });
  assert.equal(g65.isEmergency, false);
  assert.equal(g65.isNudge, true);
  assert.equal(g65.nudgeDetails.type, 'NUDGE_MILD_LOW');

  const g69 = getAlertLevel('GLUCOSE', { value: 69, unit: 'mg/dL' });
  assert.equal(g69.isEmergency, false);
  assert.equal(g69.isNudge, true);

  // 3. Normal Fasting (70 to 99 mg/dL) -> No Nudge, No Emergency
  const g70 = getAlertLevel('GLUCOSE', { value: 70, unit: 'mg/dL' });
  assert.equal(g70.isEmergency, false);
  assert.equal(g70.isNudge, false);
  assert.equal(g70.displayBand.id, 'normal_fasting');

  const g99 = getAlertLevel('GLUCOSE', { value: 99, unit: 'mg/dL' });
  assert.equal(g99.isEmergency, false);
  assert.equal(g99.isNudge, false);
  assert.equal(g99.displayBand.id, 'normal_fasting');

  // 4. Prediabetes Range (100 to 125 mg/dL)
  const g100 = getAlertLevel('GLUCOSE', { value: 100, unit: 'mg/dL' });
  assert.equal(g100.isEmergency, false);
  assert.equal(g100.isNudge, false);
  assert.equal(g100.displayBand.id, 'prediabetes_range');

  const g125 = getAlertLevel('GLUCOSE', { value: 125, unit: 'mg/dL' });
  assert.equal(g125.isEmergency, false);
  assert.equal(g125.isNudge, false);
  assert.equal(g125.displayBand.id, 'prediabetes_range');

  // 5. Diabetes Range (126 to 300 mg/dL) -> Routine Diabetes Band, No Nudge
  const g126 = getAlertLevel('GLUCOSE', { value: 126, unit: 'mg/dL' });
  assert.equal(g126.isEmergency, false);
  assert.equal(g126.isNudge, false);
  assert.equal(g126.displayBand.id, 'diabetes_range');

  const g300 = getAlertLevel('GLUCOSE', { value: 300, unit: 'mg/dL' });
  assert.equal(g300.isEmergency, false);
  assert.equal(g300.isNudge, false);
  assert.equal(g300.displayBand.id, 'diabetes_range');

  // 6. Mild High Nudge (301 to 400 mg/dL) -> NUDGE, NOT Emergency
  const g301 = getAlertLevel('GLUCOSE', { value: 301, unit: 'mg/dL' });
  assert.equal(g301.isEmergency, false);
  assert.equal(g301.isNudge, true);
  assert.equal(g301.nudgeDetails.type, 'NUDGE_MILD_HIGH');

  const g350 = getAlertLevel('GLUCOSE', { value: 350, unit: 'mg/dL' });
  assert.equal(g350.isEmergency, false);
  assert.equal(g350.isNudge, true);
  assert.equal(g350.nudgeDetails.type, 'NUDGE_MILD_HIGH');

  const g400 = getAlertLevel('GLUCOSE', { value: 400, unit: 'mg/dL' });
  assert.equal(g400.isEmergency, false);
  assert.equal(g400.isNudge, true);

  // 7. Severe Hyperglycemia (>400 mg/dL) -> EMERGENCY, NOT Nudge
  const g401 = getAlertLevel('GLUCOSE', { value: 401, unit: 'mg/dL' });
  assert.equal(g401.isEmergency, true);
  assert.equal(g401.isNudge, false);
  assert.equal(g401.emergencyDetails.type, 'EMERGENCY_HIGH_GLUCOSE');
  assert.equal(g401.emergencyDetails.requiresAcknowledgment, true);
});
