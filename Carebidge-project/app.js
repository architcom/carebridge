import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Carebidge demonstration data. No vital readings on these pages come from a device.
const ranges = [
  {min:35,max:40,sys:[90,120],dia:[60,80],riskSys:[121,139],riskDia:[81,89]},
  {min:40,max:45,sys:[95,122],dia:[60,80],riskSys:[123,139],riskDia:[81,89]},
  {min:45,max:50,sys:[95,124],dia:[60,82],riskSys:[125,139],riskDia:[83,89]},
  {min:50,max:55,sys:[95,126],dia:[60,83],riskSys:[127,139],riskDia:[84,89]},
  {min:55,max:60,sys:[95,128],dia:[60,85],riskSys:[129,139],riskDia:[86,89]},
  {min:60,max:65,sys:[100,130],dia:[60,85],riskSys:[131,139],riskDia:[86,89]},
  {min:65,max:70,sys:[100,134],dia:[60,85],riskSys:[135,139],riskDia:[86,89]},
];
const patients = [
  {id:'CB-1042',name:'Maya Sharma',age:52,sex:'Female',initials:'MS',bp:[118,78],spo2:98,heart:74,condition:'Hypertension monitoring',room:'204 A',last:'2 min ago'},
  {id:'CB-1048',name:'Arjun Mehta',age:64,sex:'Male',initials:'AM',bp:[136,88],spo2:93,heart:106,condition:'Cardiac observation',room:'203 B',last:'4 min ago'},
  {id:'CB-1056',name:'Nisha Rao',age:43,sex:'Female',initials:'NR',bp:[184,122],spo2:88,heart:126,condition:'Acute observation',room:'201 A',last:'1 min ago',emergencyContactName:'Kiran Rao (demo)'},
  {id:'CB-1061',name:'Dev Patel',age:39,sex:'Male',initials:'DP',bp:[112,73],spo2:99,heart:68,condition:'Routine wellness',room:'205 C',last:'6 min ago'},
  {id:'CB-1068',name:'Farah Khan',age:58,sex:'Female',initials:'FK',bp:[133,88],spo2:94,heart:109,condition:'Respiratory follow-up',room:'206 A',last:'3 min ago'},
  {id:'CB-1072',name:'Ravi Das',age:67,sex:'Male',initials:'RD',bp:[129,82],spo2:97,heart:82,condition:'Post-op recovery',room:'207 B',last:'5 min ago'},
];
const $ = (selector) => document.querySelector(selector);
const page = document.body.dataset.page;
const selectedId = sessionStorage.getItem('carebidge-patient') || patients[0].id;
let selected = patients.find(p => p.id === selectedId) || patients[0];
let filter = 'all';
let running = true;
let tick = 0;
const within = (v, range) => v >= range[0] && v <= range[1];
function status(p) {
  const [sys,dia]=p.bp, r=ranges.find((x,i) => p.age >= x.min && (i===ranges.length-1 ? p.age<=x.max : p.age<x.max));
  if(!r) return 'unclassified';
  if(sys<90||sys>=180||dia<60||dia>=120||p.heart<50||p.heart>120||p.spo2<90) return 'critical';
  if(within(sys,r.riskSys)||within(dia,r.riskDia)||within(p.heart,[101,120])||within(p.spo2,[90,94])) return 'intermediate';
  if(within(sys,r.sys)&&within(dia,r.dia)&&within(p.heart,[60,100])&&within(p.spo2,[95,100])) return 'normal';
  return 'unclassified';
}
const badge=p=>`<span class="status ${status(p)}">${status(p)[0].toUpperCase()+status(p).slice(1)}</span>`;
const avatar=p=>`<span class="avatar">${p.initials}</span>`;
function header(kicker,title,subtitle,extra='') {return `<div class="page-top"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="top-buttons">${extra}</div></div>`}
function wave(base,variation,n=26){return Array.from({length:n},(_,i)=>Math.round(base+Math.sin(i*.6+tick*.25)*variation*.55+(Math.random()-.5)*variation)).map(v=>v)}
function chart(values,min,max,color='#4bb8e4'){
  const coords=values.map((v,i)=>`${(i/(values.length-1)*600).toFixed(1)},${(100-(v-min)/(max-min)*86).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 600 110" preserveAspectRatio="none" role="img" aria-label="Simulated trend chart"><path d="M0 20H600 M0 60H600 M0 100H600" stroke="#edf1f3" stroke-width="1"/><polyline points="${coords}" fill="none" stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg><div class="axis"><span>30 MIN AGO</span><span>20 MIN</span><span>10 MIN</span><span>NOW</span></div>`;
}
function vitalCard(name,value,unit,values,min,max,description,extra=''){
  return `<div class="card pad"><div class="chart-top"><h2>${name}</h2><span class="eyebrow">${description}</span></div><div class="metric">${value}<small>${unit}</small></div>${chart(values,min,max)}${extra}</div>`;
}
function renderCharts(){
  if(page!=='hub')return;
  const p=selected;
  $('#charts').innerHTML=
    vitalCard('Blood pressure',`${p.bp[0]} / ${p.bp[1]}`,'mmHg',wave(p.bp[0],7),80,200,'SYSTOLIC',`<div class="chart-key"><i class="keyline"></i>Systolic <i class="keyline grey"></i>Diastolic: ${p.bp[1]} mmHg</div>`)+
    vitalCard('Oxygen saturation',p.spo2,'%',wave(p.spo2,2),84,101,'SpO₂')+
    vitalCard('Heart rate',p.heart,'bpm',wave(p.heart,9),45,140,'PULSE');
}
function renderRoster(){
  const shown=patients.filter(p=>filter==='all'||status(p)===filter);
  $('#roster').innerHTML=shown.length?shown.map(p=>`<button type="button" class="patient-row ${selected.id===p.id?'selected':''}" data-id="${p.id}">${avatar(p)}<span><div class="person-name">${p.name}</div><div class="person-meta">${p.id} · ${p.age} yrs · ${p.room}</div></span>${badge(p)}</button>`).join(''):'<div class="card-foot">No patients in this category.</div>';
  document.querySelectorAll('.patient-row').forEach(button=>button.addEventListener('click',()=>{
    selected=patients.find(p=>p.id===button.dataset.id);sessionStorage.setItem('carebidge-patient',selected.id);renderRoster();renderCharts();
    $('#selected-name').textContent=selected.name;$('#patient-link').href='patient.html';
  }));
}
function renderHub(){
  const counts={all:patients.length,normal:0,intermediate:0,critical:0};patients.forEach(p=>{const key=status(p);if(key in counts&&key!=='all')counts[key]++});
  $('#content').innerHTML=header('YOUR WORKSPACE / OVERVIEW','Main hub','A clear view of your patients and their latest simulated vital signs.',`<button class="btn" id="simulation">Pause simulation</button><a class="btn dark" href="doctor.html">Doctor profile ↗</a>`)+
  `<div class="stats">${[['all','Total patients','All patients'],['normal','Normal','Within reference ranges'],['intermediate','Intermediate','Needs review'],['critical','Critical','Priority attention']].map(([key,title,note])=>`<button class="stat ${filter===key&&filter!=='all'?'active':''}" data-filter="${key}"><label>${title}</label><strong>${counts[key]}</strong><small>${note} ↗</small></button>`).join('')}</div>`+
  `<div class="columns"><section><div class="section-heading"><h2>Vitals monitor</h2><small><span class="live-dot">●</span> SIMULATED · 30 MIN VIEW</small></div><div class="section-heading"><select id="patient-select" aria-label="Select patient">${patients.map(p=>`<option value="${p.id}" ${p.id===selected.id?'selected':''}>${p.name} · ${p.id}</option>`).join('')}</select><small id="selected-name">${selected.name}</small></div><div id="charts"></div><div class="card pad"><div class="section-heading"><h2>Reference guide</h2><small>AGES 35–70</small></div><p class="note">Normal, Intermediate, and Critical map to the supplied spreadsheet’s Stable, At Risk, and Very Severe ranges. These are demonstration labels and are not medical decisions.</p><a class="btn blue-button" id="patient-link" href="patient.html">Open patient profile ↗</a></div></section><section><div class="section-heading"><h2>Patient overview</h2><small>SELECT A ROW TO VIEW VITALS</small></div><div class="card"><div class="roster-title"><h2>Monitored patients</h2><small>${patients.length} DEMO PROFILES</small></div><div id="roster"></div><div class="card-foot">Values are fictional. Status updates as the simulation runs.</div></div><div class="card pad spotlight"><div class="eyebrow">CARE IN MOTION</div><h2>Every vital tells<br>part of the story.</h2><p class="subtitle">Explore a patient’s profile for their latest readings and care notes.</p><a class="btn blue-button" href="patient.html">View patient ↗</a></div><div class="card pad"><div class="section-heading"><h2>Recent activity</h2><small>DEMO FEED</small></div><div class="activity"><i></i><div><p>Vitals refreshed for monitored patients</p><small>Simulation · just now</small></div></div><div class="activity"><i></i><div><p>Care team reviewed the daily overview</p><small>Dr. Aanya Sen · earlier today</small></div></div></div></section></div>`;
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button&&filter!=='all'));renderRoster()}));
  $('#patient-select').addEventListener('change',e=>{selected=patients.find(p=>p.id===e.target.value);sessionStorage.setItem('carebidge-patient',selected.id);renderRoster();renderCharts();$('#selected-name').textContent=selected.name});
  $('#simulation').addEventListener('click',e=>{running=!running;e.currentTarget.textContent=running?'Pause simulation':'Resume simulation'});
  renderRoster();renderCharts();
  setInterval(()=>{if(!running)return;tick++;patients.forEach(p=>{const baseline=baseReadings[p.id];p.bp=[Math.round(baseline.bp[0]+(Math.random()-.5)*4),Math.round(baseline.bp[1]+(Math.random()-.5)*3)];p.spo2=Math.max(85,Math.min(100,Math.round(baseline.spo2+(Math.random()-.5)*2)));p.heart=Math.round(baseline.heart+(Math.random()-.5)*5)});renderRoster();renderCharts()},5000);
}
const baseReadings=Object.fromEntries(patients.map(p=>[p.id,{bp:[...p.bp],spo2:p.spo2,heart:p.heart}]));
function detail(a,b){return `<div class="detail"><span>${a}</span><span>${b}</span></div>`}
function renderDoctor(){
  $('#content').innerHTML=header('PROFILE / CLINICIAN','Doctor profile','Meet the clinician in this demonstration care team.',`<a class="btn" href="index.html">← Main hub</a><a class="btn dark" href="patient.html">Patient profile ↗</a>`)+
  `<div class="profile"><div class="card profile-side"><span class="avatar">AS</span><h2>Dr. Aanya Sen</h2><p class="subtitle">Internal medicine</p><span class="status normal">Available</span><hr>${detail('Clinician ID','DR-0284')}${detail('Experience','12 years')}${detail('Department','Internal medicine')}${detail('Location','Carebidge Central')}<hr><div class="eyebrow">DEMO PROFILE</div><p class="note">Profile details are fictional placeholders.</p></div><section><div class="profile-metrics"><div class="card"><div class="eyebrow">ASSIGNED PATIENTS</div><strong>${patients.length}</strong><small>demo profiles</small></div><div class="card"><div class="eyebrow">FOLLOW-UPS</div><strong>03</strong><small>scheduled today</small></div><div class="card"><div class="eyebrow">SHIFT</div><strong>Day</strong><small>09:00–17:00</small></div></div><div class="profile-grid"><div class="card pad"><h2>About the clinician</h2><p class="note">Dr. Sen supports coordinated patient monitoring and routine follow-up. This card demonstrates how provider information could appear alongside a patient’s vital trends.</p><span class="pill">Internal medicine</span><span class="pill">Preventive care</span></div><div class="card pad"><h2>Today's schedule</h2><div class="schedule"><span class="time">09:30</span><span>Morning rounds<small>Ward A</small></span></div><div class="schedule"><span class="time">11:15</span><span>Patient follow-up<small>Room 203 B</small></span></div><div class="schedule"><span class="time">14:00</span><span>Care team review<small>Conference room</small></span></div></div><div class="card pad"><h2>Assigned patients</h2>${patients.slice(0,4).map(p=>`<div class="schedule"><span class="avatar tiny">${p.initials}</span><span>${p.name}<small>${p.id} · ${p.room}</small></span>${badge(p)}</div>`).join('')}</div><div class="card pad"><h2>Care approach</h2><p class="note">A shared view of readings can support timely conversations between patients and clinicians. The data here is simulated for interface demonstration.</p><a class="btn blue-button" href="index.html">Open main hub ↗</a></div></div></section></div>`;
}
function setupMenu(){const button=$('#menu-button'),drawer=$('#drawer'),backdrop=$('#backdrop');const toggle=open=>{drawer.hidden=!open;backdrop.hidden=!open;button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close menu':'Open menu')};button.addEventListener('click',()=>toggle(drawer.hidden));backdrop.addEventListener('click',()=>toggle(false));document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false)});drawer.querySelectorAll('a').forEach(a=>{if(a.getAttribute('href')===(page==='hub'?'index.html':page+'.html'))a.classList.add('active')})}
const supabase=createClient('https://crddvvazctuugjyswigq.supabase.co','sb_publishable_-MG0bcuTHcVHeikqe1H5VQ_0GD_jCzu');
let currentRole=null;
let currentUser=null;
let alertDemo=false;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

async function bootstrap(){
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user?.email_confirmed_at){window.location.replace('login.html');return}
  currentUser=user;
  const {data:roleRow,error:roleError}=await supabase.from('user_roles').select('role').eq('user_id',user.id).single();
  if(roleError||!roleRow){$('#content').textContent='Your account has no assigned role. Ask the administrator to run roles_schema.sql.';return}
  currentRole=roleRow.role;
  if(currentRole==='patient'&&page!=='patient'){window.location.replace('patient.html');return}
  if(currentRole==='patient'){
    const {data:profile,error:profileError}=await supabase.from('patient_profiles').select('display_name,age,sex,care_focus,emergency_contact_name,emergency_contact_phone').eq('user_id',user.id).maybeSingle();
    if(profileError){$('#content').textContent='Unable to load your patient profile. Please try again.';return}
    const name=escapeHtml(profile?.display_name||user.email?.split('@')[0]||'Patient');
    selected={id:'YOUR PROFILE',name,initials:name.slice(0,2).toUpperCase(),age:profile?.age||52,sex:escapeHtml(profile?.sex||'Not provided'),bp:[118,78],spo2:98,heart:74,condition:escapeHtml(profile?.care_focus||'Daily wellness monitoring'),room:'Not assigned',last:'Simulated now',emergencyContactName:escapeHtml(profile?.emergency_contact_name||''),emergencyContactPhone:escapeHtml(profile?.emergency_contact_phone||''),email:escapeHtml(user.email||'')};
    document.querySelectorAll('.drawer a[href="index.html"],.drawer a[href="doctor.html"]').forEach(a=>a.hidden=true);
    $('.brand').href='patient.html';
    $('.top-right .avatar').href='patient.html';
  }
  setupMenu();
  if(page==='hub')renderHub();else if(page==='patient')renderPatient();else renderDoctor();
  const link=$('.signin');link.textContent='Sign out ↗';link.href='#';
  link.addEventListener('click',async event=>{event.preventDefault();await supabase.auth.signOut();window.location.assign('login.html')});
}
bootstrap().catch(()=>{$('#content').textContent='Could not load Carebidge. Check your connection and refresh.'});

function renderPatient(){
  const p=alertDemo?{...selected,bp:[184,122],spo2:88,heart:126}:selected;
  const isCritical=status(p)==='critical';
  const patientOnly=currentRole==='patient';
  const contact=p.emergencyContactName||'Not provided';
  const phone=p.emergencyContactPhone||'';
  const callable=phone.replace(/[^+\d]/g,'');
  const actions=patientOnly?`<button class="btn" id="edit-profile">Edit details</button><button class="btn" id="test-alert">${alertDemo?'End alert demo':'Simulate critical reading'}</button>`:`<a class="btn" href="index.html">← Main hub</a><button class="btn" id="test-alert">${alertDemo?'End alert demo':'Simulate critical reading'}</button>`;
  const emergency=isCritical?`<section class="emergency" role="alert"><div><span class="eyebrow">CRITICAL READING · DEMO ALERT</span><h2>Urgent review recommended</h2><p>The simulated reading crossed a critical reference range. Recheck with a validated device and contact a qualified clinician. If this is a real emergency, use your local emergency number.</p><strong>Emergency contact: ${contact}${phone?' · '+phone:''}</strong></div>${callable?`<a class="btn dark" href="tel:${callable}">Call contact</a>`:''}</section>`:'';
  const editor=patientOnly?`<form id="profile-form" class="card pad profile-editor" hidden><h2>Edit your profile and emergency contact</h2><label>Name<input name="display_name" maxlength="80" value="${p.name}" required></label><label>Age<input name="age" type="number" min="35" max="70" value="${p.age}" required></label><label>Sex<input name="sex" maxlength="40" value="${p.sex==='Not provided'?'':p.sex}"></label><label>Care focus<input name="care_focus" maxlength="120" value="${p.condition}"></label><label>Emergency contact name<input name="emergency_contact_name" maxlength="80" value="${p.emergencyContactName||''}"></label><label>Emergency contact phone<input name="emergency_contact_phone" type="tel" maxlength="30" value="${p.emergencyContactPhone||''}"></label><button class="btn dark" type="submit">Save details</button><p id="profile-message" role="status"></p></form>`:'';
  $('#content').innerHTML=header('PROFILE / PATIENT','Patient profile',patientOnly?'Your information and simulated vital signs.':'A closer look at this demonstration patient.',actions)+emergency+editor+
    `<div class="profile"><div class="card profile-side">${avatar(p)}<h2>${p.name}</h2><p class="subtitle">${patientOnly?p.email:`Patient ID ${p.id}`}</p>${badge(p)}<hr>${detail('Age / sex',`${p.age} / ${p.sex}`)}${detail('Room',p.room)}${detail('Last reading',p.last)}${detail('Care focus',p.condition)}<hr><div class="eyebrow">EMERGENCY CONTACT</div><p class="note">${contact}${phone?' · '+phone:''}</p></div><section><div class="profile-metrics"><div class="card"><div class="eyebrow">BLOOD PRESSURE</div><strong>${p.bp.join(' / ')}</strong><small>mmHg · simulated</small></div><div class="card"><div class="eyebrow">OXYGEN</div><strong>${p.spo2}%</strong><small>SpO₂ · simulated</small></div><div class="card"><div class="eyebrow">HEART RATE</div><strong>${p.heart}</strong><small>bpm · simulated</small></div></div><div class="profile-grid"><div class="card pad"><h2>Care overview</h2><p class="note">${p.name} · ${p.condition}. The vital signs shown here are simulated for this demonstration.</p><span class="pill">Daily monitoring</span></div><div class="card pad"><h2>Reference interpretation</h2><p class="note">Current display state: <strong>${status(p).toUpperCase()}</strong>. Based on age ${p.age} and the supplied spreadsheet ranges. This is not a diagnosis.</p></div><div class="card pad"><h2>Recent observations</h2>${detail('Blood pressure',`${p.bp.join(' / ')} mmHg`)}${detail('Oxygen saturation',`${p.spo2}%`)}${detail('Pulse',`${p.heart} bpm`)}</div><div class="card pad"><h2>Care notes</h2><p class="note">Confirm concerning readings with a validated device and a qualified clinician. The emergency alert appears only in this browser; it does not send a message or place a call automatically.</p></div></div></section></div>`;
  $('#test-alert').addEventListener('click',()=>{alertDemo=!alertDemo;renderPatient()});
  if(patientOnly){
    $('#edit-profile').addEventListener('click',()=>{$('#profile-form').hidden=!$('#profile-form').hidden});
    $('#profile-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
      const values=Object.fromEntries(new FormData(form));
      const record={user_id:currentUser.id,display_name:values.display_name.trim(),age:Number(values.age),sex:values.sex.trim(),care_focus:values.care_focus.trim(),emergency_contact_name:values.emergency_contact_name.trim(),emergency_contact_phone:values.emergency_contact_phone.trim(),updated_at:new Date().toISOString()};
      const {error}=await supabase.from('patient_profiles').upsert(record,{onConflict:'user_id'});
      if(error){$('#profile-message').textContent=error.message;return}
      selected={...selected,name:escapeHtml(record.display_name),initials:escapeHtml(record.display_name.slice(0,2).toUpperCase()),age:record.age,sex:escapeHtml(record.sex||'Not provided'),condition:escapeHtml(record.care_focus||'Daily wellness monitoring'),emergencyContactName:escapeHtml(record.emergency_contact_name),emergencyContactPhone:escapeHtml(record.emergency_contact_phone)};
      renderPatient();
    });
  }
}
