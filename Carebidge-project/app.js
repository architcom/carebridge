import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient('https://crddvvazctuugjyswigq.supabase.co', 'sb_publishable_-MG0bcuTHcVHeikqe1H5VQ_0GD_jCzu');
const $ = selector => document.querySelector(selector);
const page = document.body.dataset.page;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatDate = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const formatTime = value => { const [h, m] = String(value).split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const detail = (label, value) => `<div class="detail"><span>${label}</span><span>${escapeHtml(value || 'Not provided')}</span></div>`;
const errorText = error => escapeHtml(error?.message || 'Please try again.');
let user, role, ownProfile, doctorProfile;
let doctors = [], links = [], medicines = [], events = [], patients = [], readings = [];
let selectedPatientId = new URLSearchParams(location.search).get('id');
let notice = '', busy = false;

function readingState(r) {
  if (!r) return 'unclassified';
  // Screening flags only. The user's clinician must set clinical action thresholds.
  if (r.spo2 <= 92 || r.systolic >= 180 || r.diastolic >= 120 || r.systolic < 90) return 'critical';
  if (r.spo2 < 95 || r.systolic >= 130 || r.diastolic >= 80 || r.diastolic < 60 || r.heart_rate < 50 || r.heart_rate > 100) return 'intermediate';
  return 'normal';
}
function badge(r) {
  const state = readingState(r);
  return `<span class="status ${state}">${({ normal: 'Normal', intermediate: 'Intermediate', critical: 'Critical', unclassified: 'No reading' })[state]}</span>`;
}
function avatar(name) { return `<span class="avatar">${escapeHtml((name || 'P').slice(0, 2).toUpperCase())}</span>`; }
function header(kicker, title, subtitle, actions = '') {
  return `<div class="page-top"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="top-buttons">${actions}</div></div>`;
}
function setupMenu() {
  const button = $('#menu-button'), drawer = $('#drawer'), backdrop = $('#backdrop');
  const toggle = open => { drawer.hidden = !open; backdrop.hidden = !open; button.setAttribute('aria-expanded', String(open)); button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
  button.addEventListener('click', () => toggle(drawer.hidden));
  backdrop.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') toggle(false); });
  if (role === 'patient') {
    document.querySelectorAll('.drawer a[href="index.html"], .drawer a[href="doctor.html"]').forEach(link => link.hidden = true);
    $('.brand').href = 'patient.html';
    $('.top-right .avatar').href = 'patient.html';
  }
  const active = page === 'hub' ? 'index.html' : `${page}.html`;
  drawer.querySelectorAll('a').forEach(link => { if (link.getAttribute('href') === active) link.classList.add('active'); });
  const signout = $('.signin');
  signout.textContent = 'Sign out ↗'; signout.href = '#';
  signout.addEventListener('click', async event => { event.preventDefault(); await supabase.auth.signOut(); location.assign('login.html'); });
}

async function loadPatientProfile(patientId) {
  const { data, error } = await supabase.from('patient_profiles')
    .select('user_id,display_name,age,sex,care_focus,emergency_contact_name,emergency_contact_phone')
    .eq('user_id', patientId).maybeSingle();
  if (error) throw error;
  return data || { user_id: patientId, display_name: patientId === user.id ? (user.email?.split('@')[0] || 'Patient') : `Patient ${patientId.slice(0, 8)}` };
}
async function loadReadings(patientId) {
  const { data, error } = await supabase.from('vital_readings')
    .select('id,patient_id,systolic,diastolic,spo2,heart_rate,source,measured_at')
    .eq('patient_id', patientId).order('measured_at', { ascending: false }).limit(40);
  if (error) throw error;
  return data || [];
}
async function loadMedicines() {
  const { data, error } = await supabase.from('medicine_schedules')
    .select('id,medicine_name,scheduled_time,last_taken_on')
    .eq('patient_id', user.id).order('scheduled_time');
  if (error) throw error;
  medicines = data || [];
}
async function loadCareTeam() {
  const [list, connected] = await Promise.all([
    supabase.from('doctor_profiles').select('user_id,display_name,specialty,facility').order('display_name'),
    supabase.from('care_links').select('doctor_id,created_at').eq('patient_id', user.id)
  ]);
  if (list.error) throw list.error;
  if (connected.error) throw connected.error;
  doctors = list.data || []; links = connected.data || [];
}
async function loadDoctorProfile() {
  const { data, error } = await supabase.from('doctor_profiles')
    .select('user_id,display_name,specialty,facility').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data) { doctorProfile = data; return; }
  const newProfile = { user_id: user.id, display_name: user.email?.split('@')[0] || 'Doctor' };
  const saved = await supabase.from('doctor_profiles').upsert(newProfile, { onConflict: 'user_id' }).select('user_id,display_name,specialty,facility').single();
  if (saved.error) throw saved.error;
  doctorProfile = saved.data;
}
async function loadAssignedPatients() {
  const connected = await supabase.from('care_links').select('patient_id').eq('doctor_id', user.id);
  if (connected.error) throw connected.error;
  const ids = (connected.data || []).map(link => link.patient_id);
  if (!ids.length) { patients = []; return; }
  const [profiles, vitals] = await Promise.all([
    supabase.from('patient_profiles').select('user_id,display_name,age,sex,care_focus,emergency_contact_name,emergency_contact_phone').in('user_id', ids),
    supabase.from('vital_readings').select('patient_id,systolic,diastolic,spo2,heart_rate,source,measured_at').in('patient_id', ids).order('measured_at', { ascending: false }).limit(500)
  ]);
  if (profiles.error) throw profiles.error;
  if (vitals.error) throw vitals.error;
  const profileMap = new Map((profiles.data || []).map(profile => [profile.user_id, profile]));
  const recentMap = new Map();
  for (const reading of vitals.data || []) if (!recentMap.has(reading.patient_id)) recentMap.set(reading.patient_id, reading);
  patients = ids.map(id => ({ ...profileMap.get(id), user_id: id, display_name: profileMap.get(id)?.display_name || `Patient ${id.slice(0, 8)}`, latest: recentMap.get(id) || null }));
  if (!selectedPatientId || !ids.includes(selectedPatientId)) selectedPatientId = ids[0];
}
async function loadEvents() {
  const { data, error } = await supabase.from('emergency_events')
    .select('id,patient_id,patient_name,vital_snapshot,created_at')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  events = data || [];
}

function trend(values, min, max, label) {
  if (!values.length) return '<p class="note">No readings recorded yet.</p>';
  const spread = max - min || 1;
  const points = values.map((value, index) => `${values.length === 1 ? 300 : index * 600 / (values.length - 1)},${100 - (Math.max(min, Math.min(max, value)) - min) / spread * 82}`).join(' ');
  return `<svg class="chart" viewBox="0 0 600 110" preserveAspectRatio="none" role="img" aria-label="${label} history"><path d="M0 20H600 M0 60H600 M0 100H600" stroke="#edf1f3" stroke-width="1"/><polyline points="${points}" fill="none" stroke="#4bb8e4" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function vitalCards(history) {
  const latest = history[0];
  const ordered = [...history].reverse();
  const card = (title, value, unit, values, min, max, note) => `<div class="card pad"><div class="chart-top"><h2>${title}</h2><span class="eyebrow">${note}</span></div><div class="metric">${value}<small>${unit}</small></div>${trend(values, min, max, title)}<div class="axis"><span>${ordered.length ? escapeHtml(formatDate(ordered[0].measured_at)) : ''}</span><span>${ordered.length > 1 ? escapeHtml(formatDate(ordered.at(-1).measured_at)) : ''}</span></div></div>`;
  return card('Blood pressure', latest ? `${latest.systolic} / ${latest.diastolic}` : '—', 'mmHg', ordered.map(r => r.systolic), 70, 220, 'SYSTOLIC') +
    card('Oxygen saturation', latest?.spo2 ?? '—', '%', ordered.map(r => r.spo2), 80, 100, 'SpO₂') +
    card('Heart rate', latest?.heart_rate ?? '—', 'bpm', ordered.map(r => r.heart_rate), 35, 160, 'PULSE');
}
function urgentBanner(reading, profile) {
  if (readingState(reading) !== 'critical') return '';
  const phone = profile.emergency_contact_phone?.replace(/[^+\d]/g, '') || '';
  return `<section class="emergency" role="alert"><div><div class="eyebrow">URGENT READING FLAG</div><h2>Review this reading promptly</h2><p>This reading crossed a screening threshold. Repeat the measurement with a reliable device and contact a qualified clinician. If you have concerning symptoms or are in immediate danger, call your local emergency number. Carebidge does not dispatch emergency services.</p><strong>Emergency contact: ${escapeHtml(profile.emergency_contact_name || 'Not provided')}${phone ? ` · ${escapeHtml(profile.emergency_contact_phone)}` : ''}</strong></div>${phone ? `<a class="btn dark" href="tel:${phone}">Call contact</a>` : ''}</section>`;
}
function identityCard(profile, latest) {
  const name = profile.display_name || 'Patient';
  return `<section class="card pad patient-identity">${avatar(name)}<div><div class="eyebrow">PATIENT RECORD</div><h2>${escapeHtml(name)}</h2><p class="note">${escapeHtml(profile.age ? `${profile.age} years` : 'Age not entered')} · ${escapeHtml(profile.sex || 'Sex not entered')} · ${escapeHtml(profile.care_focus || 'Care focus not entered')}</p><p class="note">Last reading: ${latest ? escapeHtml(formatDate(latest.measured_at)) + ` · ${escapeHtml(latest.source)}` : 'None yet'}</p></div>${badge(latest)}</section>`;
}
function medicineRows() {
  if (!medicines.length) return '<p class="note">No medicines scheduled yet. Add a medicine and the time given by your clinician.</p>';
  const today = localDay(), now = new Date();
  return medicines.map(item => {
    const taken = item.last_taken_on === today;
    const [h, m] = item.scheduled_time.split(':').map(Number);
    const due = new Date(); due.setHours(h, m, 0, 0);
    const label = taken ? 'Taken today' : now > due ? 'Not taken · past time' : 'Not taken';
    return `<div class="medicine-row"><div><strong>${escapeHtml(item.medicine_name)}</strong><small>${escapeHtml(formatTime(item.scheduled_time))}</small></div><span class="status ${taken ? 'normal' : now > due ? 'intermediate' : 'unclassified'}">${label}</span><div class="medicine-actions"><button class="btn" data-med-action="toggle" data-id="${item.id}">${taken ? 'Undo' : 'Mark taken'}</button><button class="btn" data-med-action="delete" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.medicine_name)}">×</button></div></div>`;
  }).join('');
}
function updateMedicineTimer() {
  const target = $('#medicine-next'); if (!target) return;
  const list = $('#medicine-list');
  if (list) list.innerHTML = medicineRows();
  const pending = medicines.filter(item => item.last_taken_on !== localDay());
  if (!medicines.length) { target.textContent = 'No schedule yet.'; return; }
  if (!pending.length) { target.textContent = 'All scheduled medicines are marked taken today.'; return; }
  const first = pending[0], [h, m] = first.scheduled_time.split(':').map(Number);
  const due = new Date(); due.setHours(h, m, 0, 0);
  const minutes = Math.ceil(Math.abs(due - new Date()) / 60000);
  target.textContent = `${first.medicine_name}: ${due < new Date() ? 'past scheduled time by' : 'due in'} ${Math.floor(minutes / 60)}h ${minutes % 60}m (${formatTime(first.scheduled_time)}).`;
}
function medicinePanel() {
  return `<section class="card pad medicine-card"><div class="section-heading"><div><div class="eyebrow">DAILY TRACKER</div><h2>Medicine schedule</h2></div></div><p class="note" id="medicine-next"></p><div id="medicine-list">${medicineRows()}</div><form id="medicine-form" class="medicine-form"><label>Medicine name<input name="medicine_name" maxlength="100" required></label><label>Prescribed time<input name="scheduled_time" type="time" required></label><button class="btn dark">Add medicine</button></form><p id="medicine-message" class="form-message" role="status"></p><p class="note">Times are entered by you. A “taken” mark records your tap; it cannot verify ingestion. Follow your clinician’s instructions.</p></section>`;
}
function careTeamPanel() {
  const connected = links.map(link => doctors.find(doc => doc.user_id === link.doctor_id)).filter(Boolean);
  const options = doctors.filter(doc => !links.some(link => link.doctor_id === doc.user_id));
  return `<section class="card pad"><div class="section-heading"><h2>Connected doctors</h2><small>SHARED ACCESS</small></div><p class="note">Only doctors you connect can see your profile, readings, and SOS requests.</p><div id="connected-doctors">${connected.length ? connected.map(doc => `<div class="medicine-row"><strong>${escapeHtml(doc.display_name)}</strong><button class="btn" data-disconnect="${doc.user_id}">Disconnect</button></div>`).join('') : '<p class="note">No doctor connected. SOS cannot reach a doctor until you connect one.</p>'}</div>${options.length ? `<form id="connect-doctor-form" class="medicine-form"><label>Choose doctor<select name="doctor_id" required>${options.map(doc => `<option value="${doc.user_id}">${escapeHtml(doc.display_name)}${doc.facility ? ` · ${escapeHtml(doc.facility)}` : ''}</option>`).join('')}</select></label><button class="btn dark">Connect doctor</button></form>` : ''}<p id="care-team-message" class="form-message" role="status"></p></section>`;
}
function profileForm(profile) {
  return `<form id="profile-form" class="card pad profile-editor" hidden><h2>Your profile and emergency contact</h2><label>Name<input name="display_name" maxlength="80" value="${escapeHtml(profile.display_name || '')}" required></label><label>Age<input name="age" type="number" min="0" max="120" value="${escapeHtml(profile.age ?? '')}"></label><label>Sex<input name="sex" maxlength="40" value="${escapeHtml(profile.sex || '')}"></label><label>Care focus<input name="care_focus" maxlength="120" value="${escapeHtml(profile.care_focus || '')}"></label><label>Emergency contact name<input name="emergency_contact_name" maxlength="80" value="${escapeHtml(profile.emergency_contact_name || '')}"></label><label>Emergency contact phone<input name="emergency_contact_phone" type="tel" maxlength="30" value="${escapeHtml(profile.emergency_contact_phone || '')}"></label><button class="btn dark">Save profile</button><p id="profile-message" role="status"></p></form>`;
}
function readingForm() {
  return `<form id="reading-form" class="card pad reading-form"><h2>Record a reading</h2><p class="note">Enter measurements from your device. The graphs use only saved readings.</p><div class="reading-fields"><label>Systolic (mmHg)<input name="systolic" type="number" min="50" max="300" required></label><label>Diastolic (mmHg)<input name="diastolic" type="number" min="30" max="200" required></label><label>SpO₂ (%)<input name="spo2" type="number" min="50" max="100" required></label><label>Heart rate (bpm)<input name="heart_rate" type="number" min="25" max="250" required></label></div><button class="btn dark">Save reading</button><p id="reading-message" role="status"></p></form>`;
}
function renderPatient() {
  const own = role === 'patient';
  const profile = own ? ownProfile : patients.find(p => p.user_id === selectedPatientId);
  if (!profile) {
    $('#content').innerHTML = header('PROFILE / PATIENT', 'Patient profile', 'Select a connected patient from the main hub.', '<a class="btn" href="index.html">Main hub</a>');
    return;
  }
  const latest = readings[0];
  const actions = own ? '<button class="btn" id="edit-profile">Edit profile</button>' : '<a class="btn" href="index.html">← Main hub</a>';
  const sos = own ? `<section class="sos-panel card"><div class="eyebrow">PATIENT SAFETY</div><button class="sos-button" id="sos-button" type="button" ${links.length ? '' : 'disabled'}>SOS</button><h2>Need help?</h2><p>${links.length ? 'Post an SOS to your connected doctors’ in-app emergency log.' : 'Connect a doctor below to enable in-app SOS.'} For a real emergency, call your local emergency number. This app does not contact hospitals or emergency services.</p><p class="sos-feedback" id="sos-feedback" role="status">${escapeHtml(notice)}</p></section>` : '';
  $('#content').innerHTML = header('PROFILE / PATIENT', 'Patient profile', own ? 'Your profile and recorded vital readings.' : 'Recorded readings for your connected patient.', actions) + urgentBanner(latest, profile) + (own ? profileForm(profile) : '') + identityCard(profile, latest) + sos + `<div class="patient-monitor"><section class="patient-vitals"><div class="section-heading"><h2>Vitals monitor</h2><small>RECORDED HISTORY</small></div><div id="patient-charts">${vitalCards(readings)}</div>${own ? readingForm() : ''}<div class="card pad"><h2>Reading status</h2><p class="note">${latest ? `Current reference flag: <strong>${badge(latest)}</strong>.` : 'No reading recorded yet.'} This screen supports monitoring; it does not diagnose a condition or automatically dispatch emergency care.</p></div></section><aside class="patient-medicines">${own ? medicinePanel() + careTeamPanel() : `<section class="card pad"><h2>Care information</h2>${detail('Age', profile.age ? `${profile.age} years` : '')}${detail('Sex', profile.sex)}${detail('Care focus', profile.care_focus)}${detail('Emergency contact', profile.emergency_contact_name)}${detail('Contact phone', profile.emergency_contact_phone)}</section>`}</aside></div>`;
  if (own) bindPatientActions();
  updateMedicineTimer();
}
function bindPatientActions() {
  $('#edit-profile').addEventListener('click', () => { $('#profile-form').hidden = !$('#profile-form').hidden; });
  $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const row = { user_id: user.id, display_name: values.display_name.trim(), age: values.age ? Number(values.age) : null, sex: values.sex.trim(), care_focus: values.care_focus.trim(), emergency_contact_name: values.emergency_contact_name.trim(), emergency_contact_phone: values.emergency_contact_phone.trim(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('patient_profiles').upsert(row, { onConflict: 'user_id' });
    if (error) { $('#profile-message').textContent = error.message; return; }
    ownProfile = row; renderPatient();
  });
  $('#reading-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const row = { patient_id: user.id, systolic: Number(values.systolic), diastolic: Number(values.diastolic), spo2: Number(values.spo2), heart_rate: Number(values.heart_rate), source: 'manual' };
    if (row.systolic <= row.diastolic) { $('#reading-message').textContent = 'Systolic pressure must be higher than diastolic pressure.'; return; }
    const { error } = await supabase.from('vital_readings').insert(row);
    if (error) { $('#reading-message').textContent = error.message; return; }
    readings = await loadReadings(user.id); notice = 'Reading saved.'; renderPatient();
  });
  $('#sos-button').addEventListener('click', async () => {
    if (busy || !links.length) return; busy = true; $('#sos-button').disabled = true;
    const latest = readings[0];
    const snapshot = latest ? { systolic: latest.systolic, diastolic: latest.diastolic, spo2: latest.spo2, heart_rate: latest.heart_rate, measured_at: latest.measured_at } : {};
    const { data, error } = await supabase.from('emergency_events').insert({ patient_id: user.id, patient_name: (ownProfile.display_name || user.email?.split('@')[0] || 'Patient').slice(0, 80), vital_snapshot: snapshot }).select('id,created_at').single();
    busy = false;
    notice = error ? `SOS could not be posted: ${error.message}. Call your local emergency number if you need urgent help.` : `SOS posted at ${formatDate(data.created_at)} for your connected doctors to review.`;
    renderPatient();
  });
  $('#medicine-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const { error } = await supabase.from('medicine_schedules').insert({ patient_id: user.id, medicine_name: values.medicine_name.trim(), scheduled_time: values.scheduled_time });
    if (error) { $('#medicine-message').textContent = error.message; return; }
    await loadMedicines(); renderPatient();
  });
  $('#medicine-list').addEventListener('click', async event => {
    const button = event.target.closest('[data-med-action]'); if (!button) return;
    const item = medicines.find(m => m.id === button.dataset.id); if (!item) return;
    button.disabled = true;
    const result = button.dataset.medAction === 'delete'
      ? await supabase.from('medicine_schedules').delete().eq('id', item.id).eq('patient_id', user.id)
      : await supabase.from('medicine_schedules').update({ last_taken_on: item.last_taken_on === localDay() ? null : localDay() }).eq('id', item.id).eq('patient_id', user.id);
    if (result.error) { $('#medicine-message').textContent = result.error.message; button.disabled = false; return; }
    await loadMedicines(); renderPatient();
  });
  $('#connect-doctor-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const { error } = await supabase.from('care_links').insert({ patient_id: user.id, doctor_id: values.doctor_id });
    if (error) { $('#care-team-message').textContent = error.message; return; }
    await loadCareTeam(); renderPatient();
  });
  $('#connected-doctors').addEventListener('click', async event => {
    const button = event.target.closest('[data-disconnect]'); if (!button) return;
    const { error } = await supabase.from('care_links').delete().eq('patient_id', user.id).eq('doctor_id', button.dataset.disconnect);
    if (error) { $('#care-team-message').textContent = error.message; return; }
    await loadCareTeam(); renderPatient();
  });
}

function renderHub() {
  const selected = patients.find(p => p.user_id === selectedPatientId);
  const counts = { normal: 0, intermediate: 0, critical: 0, unclassified: 0 };
  readings.forEach(reading => counts[readingState(reading)]++);
  $('#content').innerHTML = header('YOUR WORKSPACE / OVERVIEW', 'Main hub', 'Connected patients and their recorded vital readings.', '<a class="btn dark" href="doctor.html">Doctor profile ↗</a>') +
    `<div class="stats">${[['Patients', patients.length], ['Normal', counts.normal], ['Intermediate', counts.intermediate], ['Critical', counts.critical]].map(([label, count]) => `<div class="stat"><label>${label}</label><strong>${count}</strong><small>${label === 'Patients' ? 'Connected to you' : 'Recorded readings'}</small></div>`).join('')}</div>` +
    `<div class="columns"><section><div class="section-heading"><h2>Vitals monitor</h2><small>RECORDED READINGS</small></div>${selected ? `<div class="card pad"><div class="section-heading"><h2>${escapeHtml(selected.display_name)}</h2>${badge(selected.latest)}</div><p class="note">${selected.latest ? `Last recorded ${escapeHtml(formatDate(selected.latest.measured_at))}` : 'No readings yet.'}</p><a class="btn blue-button" href="patient.html?id=${encodeURIComponent(selected.user_id)}">Open patient profile ↗</a></div><div id="charts">${vitalCards(readings)}</div>` : '<div class="card pad"><h2>No connected patients yet</h2><p class="note">A patient can connect to your doctor profile from their care team panel. Their profile and readings will appear here after they do.</p></div>'}</section><section><div class="section-heading"><h2>Patient overview</h2><small>${patients.length} CONNECTED</small></div><div class="card">${patients.length ? patients.map(p => `<button class="patient-row ${p.user_id === selectedPatientId ? 'selected' : ''}" data-patient="${p.user_id}">${avatar(p.display_name)}<span><div class="person-name">${escapeHtml(p.display_name)}</div><div class="person-meta">${p.latest ? `Updated ${escapeHtml(formatDate(p.latest.measured_at))}` : 'No readings yet'}</div></span>${badge(p.latest)}</button>`).join('') : '<div class="card-foot">No patients have connected yet.</div>'}</div><div class="card pad"><h2>Emergency alerts</h2><p class="note">${events.length ? `${events.length} SOS request${events.length === 1 ? '' : 's'} in the log.` : 'No SOS requests.'}</p><a class="btn" href="doctor.html#emergency-log">Open emergency log</a></div></section></div>`;
  document.querySelectorAll('[data-patient]').forEach(button => button.addEventListener('click', async () => { selectedPatientId = button.dataset.patient; readings = await loadReadings(selectedPatientId); renderHub(); }));
}
function eventRows() {
  return events.length ? events.map(event => {
    const r = event.vital_snapshot || {};
    const snapshot = r.systolic ? `Latest attached reading: ${escapeHtml(`${r.systolic}/${r.diastolic}`)} mmHg · SpO₂ ${escapeHtml(r.spo2)}% · ${escapeHtml(r.heart_rate)} bpm` : 'No reading attached';
    return `<article class="emergency-entry"><div><span class="status critical">SOS</span><strong>${escapeHtml(event.patient_name)}</strong><small>${escapeHtml(formatDate(event.created_at))}</small></div><p>${snapshot}</p><a class="btn" href="patient.html?id=${encodeURIComponent(event.patient_id)}">Open patient</a></article>`;
  }).join('') : '<p class="note">No SOS requests from connected patients.</p>';
}
function renderDoctor() {
  const d = doctorProfile;
  $('#content').innerHTML = header('PROFILE / CLINICIAN', 'Doctor profile', 'Your care team information and emergency monitor.', '<a class="btn" href="index.html">← Main hub</a>') +
    `<section class="card pad patient-identity">${avatar(d.display_name)}<div><div class="eyebrow">CLINICIAN RECORD</div><h2>${escapeHtml(d.display_name)}</h2><p class="note">${escapeHtml(user.email || '')}</p><p class="note">${escapeHtml(d.specialty || 'Specialty not entered')} · ${escapeHtml(d.facility || 'Facility not entered')}</p></div><button class="btn" id="edit-doctor">Edit profile</button></section>` +
    `<form id="doctor-form" class="card pad profile-editor" hidden><h2>Edit your clinician profile</h2><label>Name<input name="display_name" maxlength="80" value="${escapeHtml(d.display_name)}" required></label><label>Specialty<input name="specialty" maxlength="80" value="${escapeHtml(d.specialty || '')}"></label><label>Facility<input name="facility" maxlength="100" value="${escapeHtml(d.facility || '')}"></label><button class="btn dark">Save profile</button><p id="doctor-message" role="status"></p></form>` +
    `<div class="profile-metrics"><div class="card"><div class="eyebrow">CONNECTED PATIENTS</div><strong>${patients.length}</strong><small>shared with you</small></div><div class="card"><div class="eyebrow">SOS REQUESTS</div><strong id="sos-count">${events.length}</strong><small>in your log</small></div><div class="card"><div class="eyebrow">ACCOUNT</div><strong>Active</strong><small>signed in</small></div></div>` +
    `<section class="card pad emergency-log" id="emergency-log"><div class="section-heading"><div><div class="eyebrow">CARE TEAM / IN-APP MONITOR</div><h2>Emergency log</h2></div><span class="status critical" id="emergency-count">${events.length} SOS</span></div><p class="note">Patient SOS requests are saved here with timestamps. This is an in-app log, not an emergency dispatch service.</p><div id="emergency-log-list" aria-live="polite">${eventRows()}</div></section>`;
  $('#edit-doctor').addEventListener('click', () => { $('#doctor-form').hidden = !$('#doctor-form').hidden; });
  $('#doctor-form').addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const row = { user_id: user.id, display_name: values.display_name.trim(), specialty: values.specialty.trim(), facility: values.facility.trim(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('doctor_profiles').upsert(row, { onConflict: 'user_id' });
    if (error) { $('#doctor-message').textContent = error.message; return; }
    doctorProfile = row; renderDoctor();
  });
}

async function bootstrap() {
  const response = await supabase.auth.getUser();
  user = response.data.user;
  if (response.error || !user?.email_confirmed_at) { location.replace('login.html'); return; }
  const roleResult = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
  if (roleResult.error) throw roleResult.error;
  role = roleResult.data.role;
  if (role === 'patient' && page !== 'patient') { location.replace('patient.html'); return; }
  setupMenu();
  if (role === 'patient') {
    [ownProfile, readings] = await Promise.all([loadPatientProfile(user.id), loadReadings(user.id)]);
    await Promise.all([loadMedicines(), loadCareTeam()]);
    $('.top-right .avatar').textContent = (ownProfile.display_name || 'P').slice(0, 2).toUpperCase();
    renderPatient();
    setInterval(updateMedicineTimer, 30000);
    setInterval(async () => {
      try {
        const prior = readings[0]?.id;
        readings = await loadReadings(user.id);
        if (prior !== readings[0]?.id && !document.activeElement?.closest('form')) renderPatient();
      } catch {}
    }, 30000);
  } else {
    await Promise.all([loadDoctorProfile(), loadAssignedPatients(), loadEvents()]);
    $('.top-right .avatar').textContent = (doctorProfile.display_name || 'D').slice(0, 2).toUpperCase();
    if (page === 'doctor') renderDoctor();
    else if (page === 'hub') { if (selectedPatientId) readings = await loadReadings(selectedPatientId); renderHub(); }
    else { if (selectedPatientId && patients.some(p => p.user_id === selectedPatientId)) readings = await loadReadings(selectedPatientId); renderPatient(); }
    setInterval(async () => {
      try {
        await loadEvents();
        if (page === 'doctor') { $('#emergency-log-list').innerHTML = eventRows(); $('#emergency-count').textContent = `${events.length} SOS`; $('#sos-count').textContent = events.length; }
      } catch {}
    }, 8000);
    if (page === 'hub') setInterval(async () => { try { await loadAssignedPatients(); if (selectedPatientId) readings = await loadReadings(selectedPatientId); renderHub(); } catch {} }, 30000);
  }
}
bootstrap().catch(error => { $('#content').innerHTML = `<div class="card pad"><h2>Could not load Carebidge</h2><p class="note">${errorText(error)}</p></div>`; });
