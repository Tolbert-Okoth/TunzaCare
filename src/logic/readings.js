/**
 * TunzaCare Readings Logic (/src/logic/readings.js)
 * 
 * - Immutable reading log entry creation
 * - Dual-output alert & display band classifier (getAlertLevel)
 * - Single source of truth from clinical_thresholds.json
 * - Descriptive, non-diagnostic output
 */

import thresholds from '../data/clinical_thresholds.json' with { type: 'json' };
import { appendReading, getReadings } from '../storage/store.js';

export function mmolToMgdl(mmol) {
  return Number((Number(mmol) * thresholds.blood_glucose.conversion_factor).toFixed(1));
}

export function mgdlToMmol(mgdl) {
  return Number((Number(mgdl) / thresholds.blood_glucose.conversion_factor).toFixed(1));
}

/**
 * Classifies a reading into an informational display band AND emergency/nudge flags.
 * Two distinct outputs: display band is informational; emergency flag is safety-critical.
 * 
 * @param {'BP' | 'GLUCOSE'} type
 * @param {object} values { systolic, diastolic } for BP, or { value, unit, isFasting } for GLUCOSE
 * @returns {object} { displayBand, isEmergency, emergencyDetails, isNudge, nudgeDetails }
 */
export function getAlertLevel(type, values) {
  if (type === 'BP') {
    const sys = Number(values.systolic);
    const dia = Number(values.diastolic);
    const bpConf = thresholds.blood_pressure;

    // 1. Emergency Safety Checks (NCT01504022)
    // SBP >= 200 OR DBP >= 100 OR SBP < 80
    const isEmergencyHigh = sys >= bpConf.emergency_thresholds.high_systolic || dia >= bpConf.emergency_thresholds.high_diastolic;
    const isEmergencyLow = sys < bpConf.emergency_thresholds.low_systolic;
    const isEmergency = isEmergencyHigh || isEmergencyLow;

    let emergencyDetails = null;
    if (isEmergency) {
      emergencyDetails = {
        type: isEmergencyHigh ? 'EMERGENCY_HIGH_BP' : 'EMERGENCY_LOW_BP',
        severity: 'CRITICAL',
        title_en: 'This reading needs attention now',
        title_sw: 'Kipimo hiki kinahitaji uangalizi wa haraka sasa',
        body_en: 'This is high or low enough that it needs medical attention right away. Please contact a health worker or go to a facility now.',
        body_sw: 'Kipimo hiki kiko juu au chini sana na kinahitaji matibabu ya haraka. Tafadhali wasiliana na mhudumu wa afya au nenda kwenye kituo cha afya sasa.',
        requiresAcknowledgment: true
      };
    }

    // 2. Informational Display Bands (ISH Home Monitoring)
    // Normal: <130/85 (SBP < 130 AND DBP < 85)
    // High-normal: 130–139/85–89 (SBP in 130..139 OR DBP in 85..89)
    // Grade 1: 140–159/90–99 (SBP in 140..159 OR DBP in 90..99)
    // Grade 2: >=160/100 (SBP >= 160 OR DBP >= 100)
    let displayBandId = 'normal';
    if (sys >= 160 || dia >= 100) {
      displayBandId = 'grade_2';
    } else if (sys >= 140 || dia >= 90) {
      displayBandId = 'grade_1';
    } else if (sys >= 130 || dia >= 85) {
      displayBandId = 'high_normal';
    } else {
      displayBandId = 'normal';
    }

    const bandInfo = bpConf.bands.find(b => b.id === displayBandId);

    return {
      type: 'BP',
      displayBand: {
        id: bandInfo.id,
        name_en: bandInfo.name_en,
        name_sw: bandInfo.name_sw,
        tag_en: `Falls in the ${bandInfo.name_en} range`,
        tag_sw: `Kiko katika ${bandInfo.name_sw}`
      },
      isEmergency,
      emergencyDetails,
      isNudge: false,
      nudgeDetails: null
    };
  }

  if (type === 'GLUCOSE') {
    const rawVal = Number(values.value);
    const unit = values.unit || 'mg/dL';
    const mgdl = unit === 'mmol/L' ? mmolToMgdl(rawVal) : rawVal;
    const gConf = thresholds.blood_glucose;

    // 1. Emergency Safety Checks (ADA 2025: <54 or >400 mg/dL)
    const isSevereLow = mgdl < gConf.emergency_thresholds.severe_low_mgdl;
    const isSevereHigh = mgdl > gConf.emergency_thresholds.severe_high_mgdl;
    const isEmergency = isSevereLow || isSevereHigh;

    let emergencyDetails = null;
    if (isEmergency) {
      emergencyDetails = {
        type: isSevereLow ? 'EMERGENCY_LOW_GLUCOSE' : 'EMERGENCY_HIGH_GLUCOSE',
        severity: 'CRITICAL',
        title_en: isSevereLow ? 'Dangerously Low Blood Sugar' : 'Dangerously High Blood Sugar',
        title_sw: isSevereLow ? 'Kiwango cha Sukari Kiko Chini Sana' : 'Kiwango cha Sukari Kiko Juu Sana',
        body_en: isSevereLow
          ? 'This is dangerously low. If you have fast-acting sugar (juice, glucose tablets, regular soda), take it now and recheck in 15 minutes. If you feel confused or cannot treat yourself, get help immediately.'
          : 'This is dangerously high — please contact a health worker or go to a facility now, especially if you feel unwell, confused, or notice fruity-smelling breath.',
        body_sw: isSevereLow
          ? 'Kiwango hiki kiko chini mno. Ikiwa una sukari ya haraka (juisi, vidonge vya sukari, soda ya kawaida), tumia sasa na upime tena baada ya dakika 15. Ukihisi kizunguzungu kikubwa, pata msaada mara moja.'
          : 'Kiwango hiki kiko juu sana — tafadhali wasiliana na mhudumu wa afya au nenda kwenye kituo cha afya sasa, hasa ukihisi kichefuchefu au udhaifu mkubwa.',
        requiresAcknowledgment: true
      };
    }

    // 2. Milder In-App Nudges (<70 mg/dL and >300 mg/dL when not already emergency)
    let isNudge = false;
    let nudgeDetails = null;
    if (!isEmergency) {
      if (mgdl < gConf.nudge_thresholds.mild_low_mgdl) {
        // Between 54 and 69 mg/dL
        isNudge = true;
        nudgeDetails = {
          type: 'NUDGE_MILD_LOW',
          title_en: 'Mildly Low Blood Sugar',
          title_sw: 'Sukari Iko Chini Kidogo',
          body_en: 'Consider the 15-15 rule: have 15g of fast-acting carbohydrate (e.g. 1/2 cup juice or 3 sugar cubes) and recheck in 15 minutes.',
          body_sw: 'Zingatia kanuni ya 15-15: tumia gramu 15 za sukari ya haraka (k.m. nusu kikombe cha juisi au vijiko 3 vya sukari) na upime tena baada ya dakika 15.'
        };
      } else if (mgdl > gConf.nudge_thresholds.mild_high_mgdl) {
        // Between 301 and 400 mg/dL
        isNudge = true;
        nudgeDetails = {
          type: 'NUDGE_MILD_HIGH',
          title_en: 'Elevated Blood Sugar',
          title_sw: 'Sukari Iko Juu',
          body_en: 'Monitor closely, drink plenty of water, and consider contacting your health worker if it does not improve.',
          body_sw: 'Fuatilia kwa ukaribu, kunywa maji ya kutosha, na wasiliana na mhudumu wako wa afya isipopungua.'
        };
      }
    }

    // 3. Informational Display Bands (ADA Fasting: 70-99, 100-125, >=126)
    let displayBandId = 'normal_fasting';
    if (mgdl >= 126) {
      displayBandId = 'diabetes_range';
    } else if (mgdl >= 100) {
      displayBandId = 'prediabetes_range';
    } else {
      displayBandId = 'normal_fasting';
    }

    const bandInfo = gConf.fasting_bands.find(b => b.id === displayBandId) || gConf.fasting_bands[0];

    return {
      type: 'GLUCOSE',
      displayBand: {
        id: bandInfo.id,
        name_en: bandInfo.name_en,
        name_sw: bandInfo.name_sw,
        tag_en: `Falls in the ${bandInfo.name_en} range`,
        tag_sw: `Kiko katika ${bandInfo.name_sw}`
      },
      isEmergency,
      emergencyDetails,
      isNudge,
      nudgeDetails
    };
  }

  throw new Error(`Unsupported reading type: ${type}`);
}

/**
 * Logs an immutable reading.
 * If editing an earlier entry, creates a new entry referencing the original with a note.
 */
export function logReading(type, values, timestamp = null, notes = '', correctionForId = null) {
  const alertEvaluation = getAlertLevel(type, values);

  const entry = {
    type,
    values,
    timestamp: timestamp || new Date().toISOString(),
    notes: (notes || '').trim(),
    isCorrection: Boolean(correctionForId),
    originalReadingId: correctionForId || null,
    alertEvaluation
  };

  const saved = appendReading(entry);
  return { entry: saved, alertEvaluation };
}

export { getReadings };
