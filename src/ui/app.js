import {
  getProfile,
  saveProfile,
  getReadings,
  getAdherenceLog,
  getPrescriptionState,
  savePrescriptionState,
  clearAll,
  seedDemoDataIfEmpty
} from '../storage/store.js';

import { logReading, getAlertLevel } from '../logic/readings.js';
import { logAdherence, calculateAdherenceRate, getRefillStatus } from '../logic/adherence.js';
import { composeEscalationMessage } from '../escalation/escalation.js';
import { t, setLanguage, getCurrentLanguage, toggleLanguage } from '../i18n/i18n.js';

// Application State
let activePage = 'home';
let activeReadingType = 'BP';

document.addEventListener('DOMContentLoaded', () => {
  // Ensure demo data is available if fresh
  seedDemoDataIfEmpty();

  // Initialize UI
  setupNavigation();
  setupEventListeners();
  renderCurrentView();
});

function isWideScreen() {
  return typeof window !== 'undefined' && window.innerWidth >= 700;
}

function setupNavigation() {
  // Top toolbar navigation buttons
  document.querySelectorAll('.tbtn[data-p]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pageId = e.currentTarget.getAttribute('data-p');
      navigateToPage(pageId);
    });
  });

  // Right-edge tabs navigation
  document.querySelectorAll('.tab[data-t]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabId = e.currentTarget.getAttribute('data-t');
      navigateToPage(tabId);
    });
  });

  // Responsive layout change listener
  window.addEventListener('resize', () => {
    renderCurrentView();
  });
}

function navigateToPage(pageId) {
  activePage = pageId;
  renderCurrentView();
}

function updatePageVisibility() {
  const wide = isWideScreen();

  // Clear all page active classes
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active', 'active-left', 'active-right', 'active-single');
  });

  if (wide) {
    if (activePage === 'alert') {
      const alertEl = document.getElementById('alert');
      if (alertEl) alertEl.classList.add('active', 'active-single');
    } else if (activePage === 'escalation') {
      const escEl = document.getElementById('escalation');
      if (escEl) escEl.classList.add('active', 'active-single');
    } else if (activePage === 'log') {
      const left = document.getElementById('log');
      const right = document.getElementById('trends');
      if (left) left.classList.add('active', 'active-left');
      if (right) right.classList.add('active', 'active-right');
    } else if (activePage === 'settings') {
      const left = document.getElementById('settings');
      const right = document.getElementById('trends');
      if (left) left.classList.add('active', 'active-left');
      if (right) right.classList.add('active', 'active-right');
    } else {
      // Default: 'home' or 'trends' -> left: home, right: trends
      const left = document.getElementById('home');
      const right = document.getElementById('trends');
      if (left) left.classList.add('active', 'active-left');
      if (right) right.classList.add('active', 'active-right');
    }
  } else {
    // Single-page mobile layout
    const page = document.getElementById(activePage);
    if (page) page.classList.add('active');
  }

  // Update Toolbar buttons
  document.querySelectorAll('.tbtn[data-p]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-p') === activePage);
  });

  // Update Signature Tabs
  document.querySelectorAll('.tab[data-t]').forEach(tab => {
    tab.classList.toggle('selected', tab.getAttribute('data-t') === activePage);
  });
}

function renderCurrentView() {
  const profile = getProfile();
  const lang = getCurrentLanguage();

  updatePageVisibility();

  // Render any visible pages
  if (document.getElementById('home')?.classList.contains('active')) renderHomeScreen(profile, lang);
  if (document.getElementById('log')?.classList.contains('active')) renderLogScreen(profile, lang);
  if (document.getElementById('trends')?.classList.contains('active')) renderTrendsScreen(profile, lang);
  if (document.getElementById('settings')?.classList.contains('active')) renderSettingsScreen(profile, lang);
  if (document.getElementById('escalation')?.classList.contains('active')) renderEscalationScreen(profile, lang);
}

// -----------------------------------------------------------------------------
// 1. HOME SCREEN (TODAY'S PAGE)
// -----------------------------------------------------------------------------
function renderHomeScreen(profile, lang) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dayNum = now.getDate();

  // Format Date Eyebrow
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsSw = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysSw = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];

  const mName = (lang === 'sw' ? monthsSw : monthsEn)[now.getMonth()];
  const dName = (lang === 'sw' ? daysSw : daysEn)[now.getDay()];
  const eyebrowEl = document.getElementById('home-date-eyebrow');
  if (eyebrowEl) eyebrowEl.textContent = `${dayNum} · ${mName} · ${dName}`;

  // Greeting Heading
  const greetingEl = document.getElementById('home-greeting-heading');
  const patientName = profile.displayName || 'Asha';
  const hour = now.getHours();
  let greet = 'Good morning';
  if (lang === 'sw') {
    greet = hour < 12 ? 'Habari ya asubuhi' : (hour < 16 ? 'Habari ya mchana' : 'Habari ya jioni');
  } else {
    greet = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
  }
  if (greetingEl) greetingEl.textContent = `${greet}, ${patientName}`;

  // Streak calculation
  const adhRate = calculateAdherenceRate(30);
  const streakEl = document.getElementById('home-streak-text');
  if (streakEl) {
    if (lang === 'sw') {
      streakEl.textContent = `Mwendelezo wa siku ${adhRate.currentStreak}. Safari yako ya afya inaendelea vizuri.`;
    } else {
      streakEl.textContent = `Day ${adhRate.currentStreak} of your record. Steady as it goes.`;
    }
  }

  // Stamp Button State (Bound to real adherence_log for today)
  const log = getAdherenceLog();
  const todayEntry = log.find(e => e.date === todayStr);
  const isTaken = todayEntry && todayEntry.taken;

  const stampBtn = document.getElementById('home-stamp-btn');
  const stampMain = document.getElementById('stamp-main-text');
  const stampSub = document.getElementById('stamp-sub-text');
  const stampHint = document.getElementById('stamp-hint-text');

  if (stampBtn) {
    if (isTaken) {
      stampBtn.className = 'stamp-btn done';
      if (stampMain) stampMain.textContent = lang === 'sw' ? 'IMETUMIKA' : 'TAKEN';
      if (stampSub) stampSub.textContent = lang === 'sw' ? 'LEO' : 'TODAY';
      if (stampHint) stampHint.textContent = lang === 'sw' ? 'Dawa ya leo imerekodiwa — gusa kubadilisha' : 'Logged for today — tap to toggle';
    } else {
      stampBtn.className = 'stamp-btn';
      if (stampMain) stampMain.textContent = lang === 'sw' ? 'PIGA CHAPA' : 'STAMP';
      if (stampSub) stampSub.textContent = lang === 'sw' ? 'LEO' : 'TODAY';
      if (stampHint) stampHint.textContent = lang === 'sw' ? 'Gusa kuthibitisha dawa ya leo' : 'Tap to stamp today\'s medication';
    }
  }

  // Month Eyebrow
  const monthEyebrow = document.getElementById('home-month-eyebrow');
  if (monthEyebrow) {
    monthEyebrow.textContent = lang === 'sw' ? `Ukurasa wa ${mName}` : `This month's page (${mName})`;
  }

  // Visa-Grid Streak Calendar (Bound to real adherence_log)
  const gridEl = document.getElementById('home-visa-grid');
  if (gridEl) {
    gridEl.innerHTML = '';
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const entry = log.find(e => e.date === dayStr);
      const isStamped = entry && entry.taken;
      const isToday = d === dayNum;

      const cell = document.createElement('div');
      let cClass = 'visa-day';
      if (isStamped) cClass += ' stamped';
      if (isToday) cClass += ' today';
      cell.className = cClass;
      cell.textContent = d;
      gridEl.appendChild(cell);
    }
  }

  // Refill Bar (Bound to real getRefillStatus())
  const refill = getRefillStatus();
  const refillText = document.getElementById('home-refill-text');
  const refillFill = document.getElementById('home-refill-bar-fill');
  if (refillText) {
    if (lang === 'sw') {
      refillText.textContent = `Siku ${refill.daysRemaining} za dawa zimebaki katika akiba yako.`;
    } else {
      refillText.textContent = `${refill.daysRemaining} days of medicine remain in your supply.`;
    }
  }
  if (refillFill) {
    const pct = Math.min(100, Math.max(5, (refill.daysRemaining / (refill.totalDays || 30)) * 100));
    refillFill.style.width = `${pct}%`;
    refillFill.style.background = refill.isReminderDue ? 'var(--stamp)' : 'var(--tab-ochre)';
  }
}

// -----------------------------------------------------------------------------
// 2. LOG READING SCREEN
// -----------------------------------------------------------------------------
function renderLogScreen(profile, lang) {
  const bpFields = document.getElementById('bp-input-fields');
  const glucoseFields = document.getElementById('glucose-input-fields');
  const typeBpBtn = document.getElementById('type-bp-btn');
  const typeGlucoseBtn = document.getElementById('type-glucose-btn');

  if (activeReadingType === 'BP') {
    if (bpFields) bpFields.style.display = 'block';
    if (glucoseFields) glucoseFields.style.display = 'none';
    if (typeBpBtn) typeBpBtn.className = 'tbtn active';
    if (typeGlucoseBtn) typeGlucoseBtn.className = 'tbtn';
    updateLiveBandEvaluation();
  } else {
    if (bpFields) bpFields.style.display = 'none';
    if (glucoseFields) glucoseFields.style.display = 'block';
    if (typeBpBtn) typeBpBtn.className = 'tbtn';
    if (typeGlucoseBtn) typeGlucoseBtn.className = 'tbtn active';
    updateLiveBandEvaluation();
  }
}

function updateLiveBandEvaluation() {
  const lang = getCurrentLanguage();
  const tagEl = document.getElementById('live-band-tag');
  if (!tagEl) return;

  if (activeReadingType === 'BP') {
    const sys = Number(document.getElementById('input-sys')?.value || 120);
    const dia = Number(document.getElementById('input-dia')?.value || 80);
    const evalRes = getAlertLevel('BP', { systolic: sys, diastolic: dia });

    tagEl.textContent = lang === 'sw' ? evalRes.displayBand.tag_sw : evalRes.displayBand.tag_en;
    if (evalRes.isEmergency || sys >= 160 || dia >= 100) {
      tagEl.className = 'band-tag band-high';
    } else if (sys >= 140 || dia >= 90) {
      tagEl.className = 'band-tag band-elevated';
    } else {
      tagEl.className = 'band-tag band-normal';
    }
  } else {
    const val = Number(document.getElementById('input-glucose')?.value || 100);
    const evalRes = getAlertLevel('GLUCOSE', { value: val, unit: 'mgdl' }, true);

    tagEl.textContent = lang === 'sw' ? evalRes.displayBand.tag_sw : evalRes.displayBand.tag_en;
    if (evalRes.isEmergency || val > 300 || val < 70) {
      tagEl.className = 'band-tag band-high';
    } else if (val >= 126) {
      tagEl.className = 'band-tag band-elevated';
    } else {
      tagEl.className = 'band-tag band-normal';
    }
  }
}

// -----------------------------------------------------------------------------
// 3. ESCALATION (SEALED LETTER)
// -----------------------------------------------------------------------------
function renderEscalationScreen(profile, lang) {
  const previewEl = document.getElementById('escalation-rendered-preview');
  const toggleEl = document.getElementById('escalation-toggle');
  const nameInput = document.getElementById('escalation-contact-name');
  const phoneInput = document.getElementById('escalation-contact-phone');

  // Render Real Dynamic Message Template
  const patientName = profile.displayName || 'Asha';
  const renderedMsg = composeEscalationMessage(patientName, lang);
  if (previewEl) previewEl.textContent = renderedMsg;

  // Toggle State (Real profile.optInEscalation)
  const isEnabled = Boolean(profile.optInEscalation);
  if (toggleEl) {
    toggleEl.className = isEnabled ? 'toggle' : 'toggle off';
  }

  // Populate Contact
  if (profile.escalationContact) {
    if (nameInput) nameInput.value = profile.escalationContact.name || 'Mary (CHW)';
    if (phoneInput) phoneInput.value = profile.escalationContact.phone || '+254 712 345 678';
  }
}

// -----------------------------------------------------------------------------
// 4. TRENDS (THE LEDGER)
// -----------------------------------------------------------------------------
function renderTrendsScreen(profile, lang) {
  const container = document.getElementById('ledger-entries-list');
  if (!container) return;

  const readings = getReadings().slice().reverse();
  container.innerHTML = '';

  if (readings.length === 0) {
    container.innerHTML = `
      <div class="ledger-line" style="border:none; padding:16px 0;">
        <span style="color:var(--ink-soft); font-style:italic;">
          ${lang === 'sw' ? 'Daftari yako haina rekodi bado — weka kipimo chako cha kwanza.' : 'Your ledger is empty — write your first entry.'}
        </span>
      </div>
    `;
    return;
  }

  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsSw = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];

  readings.forEach((r, idx) => {
    const d = new Date(r.timestamp);
    const mName = (lang === 'sw' ? monthsSw : monthsEn)[d.getMonth()];
    const dateStr = `${mName} ${String(d.getDate()).padStart(2, '0')}`;

    let valStr = '';
    let tagText = '';
    let tagClass = 'band-normal';

    if (r.type === 'BP') {
      const sys = r.values.systolic;
      const dia = r.values.diastolic;
      valStr = `${sys} / ${dia}`;
      const evalRes = getAlertLevel('BP', { systolic: sys, diastolic: dia });
      tagText = lang === 'sw' ? evalRes.displayBand.tag_sw : evalRes.displayBand.tag_en;
      if (evalRes.isEmergency || sys >= 160 || dia >= 100) tagClass = 'band-high';
      else if (sys >= 140 || dia >= 90) tagClass = 'band-elevated';
      else tagClass = 'band-normal';
    } else {
      const val = r.values.value;
      valStr = `${val} mg/dL`;
      const evalRes = getAlertLevel('GLUCOSE', { value: val, unit: 'mgdl' });
      tagText = lang === 'sw' ? evalRes.displayBand.tag_sw : evalRes.displayBand.tag_en;
      if (evalRes.isEmergency || val > 300 || val < 70) tagClass = 'band-high';
      else if (val >= 126) tagClass = 'band-elevated';
      else tagClass = 'band-normal';
    }

    const row = document.createElement('div');
    row.className = 'ledger-line';
    if (idx === readings.length - 1) row.style.borderBottom = 'none';

    row.innerHTML = `
      <span class="date">${dateStr}</span>
      <span class="val">${valStr}</span>
      <span class="band-tag ${tagClass}">${tagText}</span>
    `;
    container.appendChild(row);
  });
}

// -----------------------------------------------------------------------------
// 5. SETTINGS (REGISTRY PAGE)
// -----------------------------------------------------------------------------
function renderSettingsScreen(profile, lang) {
  const nameInput = document.getElementById('settings-name-input');
  if (nameInput) nameInput.value = profile.displayName || 'Asha';

  const refillDays = document.getElementById('settings-refill-days');
  const ps = getPrescriptionState();
  if (refillDays) refillDays.value = ps.totalDays || 30;

  const enChip = document.getElementById('lang-en-chip');
  const swChip = document.getElementById('lang-sw-chip');
  if (enChip) enChip.className = lang === 'en' ? 'lang-chip selected' : 'lang-chip';
  if (swChip) swChip.className = lang === 'sw' ? 'lang-chip selected' : 'lang-chip';
}

// -----------------------------------------------------------------------------
// EVENT LISTENERS & WIRING
// -----------------------------------------------------------------------------
function setupEventListeners() {
  // 1. Adherence Stamp Button Click (Real Data Bound)
  const stampBtn = document.getElementById('home-stamp-btn');
  if (stampBtn) {
    stampBtn.addEventListener('click', () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const log = getAdherenceLog();
      const todayEntry = log.find(e => e.date === todayStr);
      const newStatus = !(todayEntry && todayEntry.taken);

      logAdherence(todayStr, newStatus, 'hypertension');
      renderHomeScreen(getProfile(), getCurrentLanguage());
    });
  }

  // 2. Language Toggle Button
  const langSwitchBtn = document.getElementById('lang-switch-btn');
  if (langSwitchBtn) {
    langSwitchBtn.addEventListener('click', () => {
      toggleLanguage();
      renderCurrentView();
    });
  }

  // 3. Log Reading Inputs Live Preview
  ['input-sys', 'input-dia', 'input-glucose'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateLiveBandEvaluation);
    }
  });

  // Reading Type Toggle Buttons
  const typeBpBtn = document.getElementById('type-bp-btn');
  const typeGlucoseBtn = document.getElementById('type-glucose-btn');
  if (typeBpBtn) {
    typeBpBtn.addEventListener('click', () => {
      activeReadingType = 'BP';
      renderLogScreen(getProfile(), getCurrentLanguage());
    });
  }
  if (typeGlucoseBtn) {
    typeGlucoseBtn.addEventListener('click', () => {
      activeReadingType = 'GLUCOSE';
      renderLogScreen(getProfile(), getCurrentLanguage());
    });
  }

  // 4. Save Reading Button (Real Submission & Routing)
  const saveReadingBtn = document.getElementById('save-reading-btn');
  if (saveReadingBtn) {
    saveReadingBtn.addEventListener('click', () => {
      const lang = getCurrentLanguage();
      let loggedRec = null;
      let evalRes = null;

      if (activeReadingType === 'BP') {
        const sys = Number(document.getElementById('input-sys')?.value || 120);
        const dia = Number(document.getElementById('input-dia')?.value || 80);
        evalRes = getAlertLevel('BP', { systolic: sys, diastolic: dia });
        loggedRec = logReading('BP', { systolic: sys, diastolic: dia });
      } else {
        const val = Number(document.getElementById('input-glucose')?.value || 100);
        evalRes = getAlertLevel('GLUCOSE', { value: val, unit: 'mgdl' }, true);
        loggedRec = logReading('GLUCOSE', { value: val, unit: 'mgdl' }, true);
      }

      if (evalRes.isEmergency) {
        // Route to Emergency Page with Real Logged Values
        const readingHuge = document.getElementById('emergency-reading-val');
        const emergencyBody = document.getElementById('emergency-body-text');
        if (readingHuge) {
          readingHuge.textContent = activeReadingType === 'BP'
            ? `${loggedRec.values.systolic}/${loggedRec.values.diastolic}`
            : `${loggedRec.values.value} mg/dL`;
        }
        if (emergencyBody) {
          emergencyBody.textContent = lang === 'sw'
            ? evalRes.emergencyDetails.body_sw
            : evalRes.emergencyDetails.body_en;
        }
        navigateToPage('alert');
      } else {
        // Route to Ledger / Trends
        navigateToPage('trends');
      }
    });
  }

  const cancelReadingBtn = document.getElementById('cancel-reading-btn');
  if (cancelReadingBtn) {
    cancelReadingBtn.addEventListener('click', () => {
      navigateToPage('home');
    });
  }

  // 5. Emergency Acknowledgment Button
  const emergencyAckBtn = document.getElementById('emergency-ack-btn');
  if (emergencyAckBtn) {
    emergencyAckBtn.addEventListener('click', () => {
      navigateToPage('home');
    });
  }

  // 6. Escalation Toggle & Contact Update
  const escToggle = document.getElementById('escalation-toggle');
  if (escToggle) {
    escToggle.addEventListener('click', () => {
      const profile = getProfile();
      const newState = !profile.optInEscalation;
      saveProfile({ optInEscalation: newState });
      renderEscalationScreen(getProfile(), getCurrentLanguage());
    });
  }

  const saveContactBtn = document.getElementById('save-escalation-contact-btn');
  if (saveContactBtn) {
    saveContactBtn.addEventListener('click', () => {
      const name = document.getElementById('escalation-contact-name')?.value || 'Mary (CHW)';
      const phone = document.getElementById('escalation-contact-phone')?.value || '+254 712 345 678';
      saveProfile({
        escalationContact: { name: name.trim(), phone: phone.trim() }
      });
      alert('✓ Contact details saved.');
      renderEscalationScreen(getProfile(), getCurrentLanguage());
    });
  }

  // 7. Settings Actions
  const saveProfileBtn = document.getElementById('settings-save-profile-btn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      const name = document.getElementById('settings-name-input')?.value || 'Asha';
      saveProfile({ displayName: name.trim() });
      alert('✓ Name updated.');
      renderCurrentView();
    });
  }

  const enChip = document.getElementById('lang-en-chip');
  const swChip = document.getElementById('lang-sw-chip');
  if (enChip) enChip.addEventListener('click', () => { setLanguage('en'); renderCurrentView(); });
  if (swChip) swChip.addEventListener('click', () => { setLanguage('sw'); renderCurrentView(); });

  const recordRefillBtn = document.getElementById('settings-record-refill-btn');
  if (recordRefillBtn) {
    recordRefillBtn.addEventListener('click', () => {
      const days = Number(document.getElementById('settings-refill-days')?.value || 30);
      savePrescriptionState({
        totalDays: days,
        lastRefillDate: new Date().toISOString().split('T')[0],
        daysRemaining: days
      });
      alert('✓ Refill recorded today.');
      renderCurrentView();
    });
  }

  // Local-only Data Export
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const allData = {
        profile: getProfile(),
        readings: getReadings(),
        adherence: getAdherenceLog(),
        prescription: getPrescriptionState()
      };
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tunzacare_ledger_${Date.now()}.json`;
      a.click();
    });
  }

  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset ledger data back to defaults?')) {
        clearAll();
        seedDemoDataIfEmpty();
        renderCurrentView();
      }
    });
  }
}
