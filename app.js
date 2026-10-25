/* BodyTape v1.0 — offline-friendly personal measurement tracker.
   Only this device stores user-entered data. GitHub Pages serves the app code, not measurements. */
(() => {
  'use strict';
  const STORAGE_KEY = 'bodytape_local_v1';
  const KEYS = ['neck','waist','abdomen','hip','chest','arm','thigh','weight'];
  const DEFINITIONS = [
    {key:'neck',label:'Neck',hint:'Just below Adam’s apple'},
    {key:'waist',label:'Waist',hint:'Midway between lowest rib and top of hip'},
    {key:'abdomen',label:'Abdomen at navel',hint:'Directly across the belly button'},
    {key:'hip',label:'Hip',hint:'Widest part of buttocks'},
    {key:'chest',label:'Chest',hint:'Around chest at nipple level'},
    {key:'arm',label:'Upper arm',hint:'Right arm, halfway shoulder to elbow'},
    {key:'thigh',label:'Thigh',hint:'Right thigh, 15 cm above kneecap'},
    {key:'weight',label:'Body weight',hint:'Morning, same scale when possible'}
  ];
  const VALID = {neck:[20,65],waist:[40,200],abdomen:[40,200],hip:[40,210],chest:[40,200],arm:[15,80],thigh:[25,110],weight:[25,350]};
  const GUIDE = [
    ['01','Neck','Keep head straight. Wrap the tape around the neck just below the Adam’s apple. Keep it level and gently snug, without compressing skin.'],
    ['02','Waist','Find the bottom of the lowest palpable rib and the top of the hip bone. Take the midpoint and measure there after a normal exhale. Keep the tape horizontal. Always use this same landmark for your waist trend.'],
    ['03','Abdomen at navel','Wrap the tape horizontally around the belly button, relaxed and after a gentle exhale. Do not suck in the abdomen. This measurement, not the separate waist measurement, is used in the male Navy body-fat equation.'],
    ['04','Hip','Stand upright with feet together. Wrap the tape around the widest part of the buttocks and keep it parallel to the floor.'],
    ['05','Chest','Stand upright with arms relaxed. Wrap tape around chest at nipple level and measure without taking a deep breath.'],
    ['06','Upper arm','Choose the right arm. Relax it at your side and measure halfway between your shoulder tip and elbow. Do not flex.'],
    ['07','Thigh','On the right leg, mark a fixed point 15 cm above the top of the kneecap. Stand relaxed and measure at this same point each time.'],
    ['08','Weight','Use the same scale, on a hard floor, ideally after the toilet and before breakfast. Day-to-day fluctuations are normal; compare averages.']
  ];
  const $ = id => document.getElementById(id);
  const round=(n,d=1)=>Number(n).toFixed(d);
  const num=(n)=>Number.isFinite(n)?n:null;
  const isValidDate=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s+'T12:00:00').getTime()) && new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const formatDate=(s,short=false)=>isValidDate(s)?new Date(s+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:short?'short':'long',...(short?{}:{year:'numeric'})}):'Unknown date';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const baseState=()=>({version:1,profile:{heightCm:null,goalWaistCm:null,units:'metric',theme:'light'},records:[]});
  let store=baseState();let activeScreen='overview';let activeChart='waist';let editingId=null;let toastTimeout;
  let persisted=true;

  function validateStore(obj) {
    if(!obj || typeof obj!=='object'||obj.version!==1||!Array.isArray(obj.records)||obj.records.length>10000||!obj.profile||typeof obj.profile!=='object')throw new Error('This is not a valid BodyTape v1 backup.');
    const profile=obj.profile;
    const checkPref=(x,min,max)=>x===null||x===undefined||x===''?null:(typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max?x:(()=>{throw new Error('Backup has an invalid profile value.');})());
    const parsed={version:1,profile:{heightCm:checkPref(profile.heightCm,100,250),goalWaistCm:checkPref(profile.goalWaistCm,40,150),units:profile.units==='imperial'?'imperial':'metric',theme:profile.theme==='dark'?'dark':'light'},records:[]};
    const ids=new Set();
    obj.records.forEach((r,i)=>{
      if(!r||typeof r!=='object'||!isValidDate(r.date))throw new Error('A backup reading has an invalid date.');
      const n={id:(typeof r.id==='string'&&r.id.length<100?r.id:`backup-${i}`),date:r.date,createdAt:typeof r.createdAt==='number'&&Number.isFinite(r.createdAt)?r.createdAt:i,notes:typeof r.notes==='string'?r.notes.slice(0,400):''};
      while(ids.has(n.id))n.id+='-1';ids.add(n.id);
      let validCount=0;
      KEYS.forEach(k=>{const x=r[k];if(x===null||x===undefined||x===''){n[k]=null;return;}if(typeof x!=='number'||!Number.isFinite(x)||x<VALID[k][0]||x>VALID[k][1])throw new Error(`Backup contains an invalid ${k} reading.`);n[k]=x;validCount++;});
      if(!validCount)throw new Error('A backup record has no measurements.');
      parsed.records.push(n);
    });
    return parsed;
  }
  function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)store=validateStore(JSON.parse(raw));}catch(e){console.warn('Unable to load saved measurements:',e);store=baseState();persisted=false;showToast('Saved data could not be read. Import your backup to restore it.');}}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));persisted=true;return true;}catch(e){persisted=false;showToast('Could not save to device storage. Export a backup instead.');return false;}}
  function showToast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),3600);}
  function sorted(){return [...store.records].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);}
  function latest(pred){return sorted().find(pred)||null;}
  function unit(k){return k==='weight'?(store.profile.units==='imperial'?'lb':'kg'):(store.profile.units==='imperial'?'in':'cm');}
  function toDisplay(n,k){if(!Number.isFinite(n))return null;return store.profile.units==='imperial'?(k==='weight'?n*2.2046226218:n/2.54):n;}
  function fromDisplay(n,k){return store.profile.units==='imperial'?(k==='weight'?n/2.2046226218:n*2.54):n;}
  function displayNum(n,k,d=1){return Number.isFinite(n)?`${round(toDisplay(n,k),d)}`:'—';}
  function shortNum(n,d=2){return Number.isFinite(n)?round(n,d):'—';}
  function bmi(r){const h=store.profile.heightCm;return r&&r.weight&&h?r.weight/((h/100)**2):null;}
  function whtr(r){const h=store.profile.heightCm;return r&&r.waist&&h?r.waist/h:null;}
  function whr(r){return r&&r.waist&&r.hip?r.waist/r.hip:null;}
  // Male US Navy circumference equation. Inputs must be inches.
  function navy(r){const h=store.profile.heightCm;if(!r||!h||!r.abdomen||!r.neck||r.abdomen<=r.neck)return null;
    const x=(r.abdomen-r.neck)/2.54, y=h/2.54;
    const value=86.010*Math.log10(x)-70.041*Math.log10(y)+36.76;
    return Number.isFinite(value)&&value>2&&value<65?value:null;
  }
  const recentBy=k=>latest(r=>Number.isFinite(r[k]));
  const allNums=arr=>arr.filter(Number.isFinite);
  function drawStat(label,value,suffix,status,statusClass=''){return `<div class="stat-card"><div class="stat-caption">${label}</div><div class="stat-number">${value}<small>${suffix}</small></div><div class="stat-status ${statusClass}">${esc(status)}</div></div>`;}
  function renderOverview(){
    $('today-date').textContent=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    const current=recentBy('waist');const waist=current?.waist??null,goal=store.profile.goalWaistCm;
    $('hero-waist').innerHTML=waist!==null?`${esc(displayNum(waist,'waist'))}<span>${unit('waist')}</span>`:`—<span>${unit('waist')}</span>`;
    $('hero-date').textContent=current?`Measured ${formatDate(current.date)} · Relaxed waist`:'No waist reading yet — log your first check-in';
    $('hero-goal').textContent=goal!==null?`${displayNum(goal,'waist')} ${unit('waist')}`:'Set a goal in Settings';
    const waistHistory=[...store.records].filter(r=>Number.isFinite(r.waist)).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);
    if(waistHistory.length&&goal!==null){
      const first=waistHistory[0].waist;const progress=first>goal?Math.max(0,Math.min(100,(first-waist)/(first-goal)*100)):(waist<=goal?100:0);
      $('hero-progress-bar').style.width=progress+'%';
      const diff=first-waist;
      $('hero-delta').textContent=waist<=goal?'Goal reached':Math.abs(diff)<.05?'Your starting point':`${diff>0?'−':'+'}${displayNum(Math.abs(diff),'waist')} ${unit('waist')} vs start`;
    } else {$('hero-progress-bar').style.width='0%';$('hero-delta').textContent='Your starting point';}
    const br=latest(r=>bmi(r)!==null), wr=latest(r=>whtr(r)!==null),hr=latest(r=>whr(r)!==null),nr=latest(r=>navy(r)!==null),we=latest(r=>r.weight!==null);
    const b=bmi(br),w=whtr(wr),h=whr(hr),n=navy(nr);
    $('overview-stats').innerHTML=
      drawStat('BMI',shortNum(b,1),'',b===null?'Enter height & weight':b<18.5?'Below 18.5':b<25?'Conventional normal':'25 or above',b!==null&&b>=18.5&&b<25?'good':b!==null?'caution':'')+
      drawStat('Waist / height',shortNum(w,3),'',w===null?'Need height & waist':w<.5?'Below 0.50':'At or above 0.50',w!==null&&w<.5?'good':w!==null?'caution':'')+
      drawStat('Waist / hip',shortNum(h,3),'',h===null?'Need waist & hip':h<.9?'Below 0.90':'Above 0.90 (male cutoff)',h!==null&&h<.9?'good':h!==null?'caution':'')+
      drawStat('Body fat (est.)',shortNum(n,1),n===null?'':'%',n===null?'Needs height, neck & navel':'Navy tape method · approximate');
    if(w!==null&&h!==null){$('insight-title').textContent=w<.5?'Your waist-to-height ratio is reassuring':'A waist-to-height ratio worth watching';$('insight-text').textContent=(w<.5?'Your waist is below half your height. ':'Your waist is at least half your height. ') +(h>=.9?'Your waist-to-hip ratio is above 0.90; because the hip measurement also affects this ratio, interpret the two indicators together.':'Your waist-to-hip ratio is below 0.90.')+' These measurements screen for patterns; they do not measure visceral fat.';}
    else {$('insight-title').textContent='Measure what matters, consistently';$('insight-text').textContent='Record a relaxed waist measurement every 2 weeks. Your ratios and body-fat estimate appear when the relevant measurements and height are available.';}
    $('chart-subtitle').textContent=`${store.records.length} saved ${store.records.length===1?'check-in':'check-ins'}`;
    renderChart();
  }
  function chartPoints(){const chronological=[...store.records].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);return chronological.map(r=>({date:r.date,val:activeChart==='waist'?r.waist:activeChart==='weight'?r.weight:navy(r)})).filter(x=>Number.isFinite(x.val));}
  function renderChart(){const el=$('trend-chart'),points=chartPoints();
    const label=activeChart==='waist'?`Waist (${unit('waist')})`:activeChart==='weight'?`Weight (${unit('weight')})`:'Estimated body fat (%)';
    el.setAttribute('aria-label',`${label} progress chart with ${points.length} readings`);
    if(!points.length){el.innerHTML='<div class="chart-empty">No values for this chart yet.<br>Add a check-in to start your trend.</div>';return;}
    const vals=points.map(p=>activeChart==='bodyfat'?p.val:toDisplay(p.val,activeChart));
    const minV=Math.min(...vals),maxV=Math.max(...vals),range=Math.max(maxV-minV,activeChart==='bodyfat'?2:activeChart==='weight'?2:2);
    const lo=Math.max(0,minV-range*.45),hi=maxV+range*.45;const x0=50,x1=620,y0=24,y1=163;
    const X=i=>points.length===1?(x0+x1)/2:x0+(x1-x0)*i/(points.length-1);
    const Y=v=>y1-(v-lo)/(hi-lo)*(y1-y0);
    let grid='';for(let i=0;i<4;i++){const yy=y0+(y1-y0)*i/3;const tick=hi-(hi-lo)*i/3;grid+=`<line x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-dasharray="4 5"/><text x="${x0-9}" y="${yy+4}" text-anchor="end" fill="var(--muted)" font-size="12">${Number(tick.toFixed(1))}</text>`;}
    const path=vals.map((v,i)=>`${i?'L':'M'} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const circles=vals.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="${i===vals.length-1?'5.5':'3.7'}" fill="var(--primary)" stroke="var(--surface)" stroke-width="2"/>`).join('');
    const dates=points.length>1?`<text x="${x0}" y="191" fill="var(--muted)" font-size="12">${formatDate(points[0].date,true)}</text><text x="${x1}" y="191" fill="var(--muted)" font-size="12" text-anchor="end">${formatDate(points[points.length-1].date,true)}</text>`:`<text x="${(x0+x1)/2}" y="191" text-anchor="middle" fill="var(--muted)" font-size="12">${formatDate(points[0].date,true)} · Add another check-in to see a trend</text>`;
    el.innerHTML=`<svg viewBox="0 0 640 200" role="img" aria-label="${esc(label)}: ${points.length} points"><defs><linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#87cba5" stop-opacity="0.26"/><stop offset="100%" stop-color="#87cba5" stop-opacity="0"/></linearGradient></defs>${grid}${points.length>1?`<path d="${path} L ${X(vals.length-1)} ${y1} L ${X(0)} ${y1} Z" fill="url(#area-gradient)"/><path d="${path}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`:''}${circles}${dates}</svg>`;
  }
  function renderFieldInputs(){const unitName=store.profile.units==='imperial'?'in':'cm';$('measurement-fields').innerHTML=DEFINITIONS.map(d=>`<label class="field"><span>${esc(d.label)} <small>(${d.key==='weight'?unit('weight'):unitName})</small></span><input type="number" inputmode="decimal" id="m-${d.key}" step="0.1" min="0" placeholder="e.g. ${d.key==='weight'?'70':d.key==='waist'?'85':'—'}" autocomplete="off"><span class="field-hint">${esc(d.hint)}</span></label>`).join('');
    DEFINITIONS.forEach(d=>$('m-'+d.key).addEventListener('input',renderPreview));
  }
  function getFormReading(){const r={};for(const k of KEYS){const raw=$('m-'+k).value.trim();r[k]=raw===''?null:fromDisplay(Number(raw),k);}return r;}
  function renderPreview(){const r=getFormReading();const vals=[];const w=whtr(r),h=whr(r),b=bmi(r),n=navy(r);
    if(Number.isFinite(w))vals.push(['Waist/height',round(w,3)]);
    if(Number.isFinite(h))vals.push(['Waist/hip',round(h,3)]);
    if(Number.isFinite(b))vals.push(['BMI',round(b,1)]);
    if(Number.isFinite(n))vals.push(['Body fat (est.)',round(n,1)+'%']);
    $('form-preview').innerHTML=vals.length?`<div class="preview-values">${vals.map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>`:'Add values to see your calculated ratios. Height can be set in Settings.';
  }
  function resetForm(){editingId=null;$('measurement-form').reset();$('entry-date').value=today();$('add-title').innerHTML='A few numbers, <em>one clearer picture.</em>';$('save-button').innerHTML='<svg class="ico"><use href="#i-check"></use></svg> Save measurements';$('cancel-edit').hidden=true;$('form-error').hidden=true;renderPreview();}
  function saveForm(ev){ev.preventDefault();const date=$('entry-date').value,reading=getFormReading();
    if(!isValidDate(date)){showFormError('Choose a valid measurement date.');return;}
    if(date>today()){showFormError('Choose today or a previous date.');return;}
    if(!KEYS.some(k=>Number.isFinite(reading[k]))){showFormError('Enter at least one body measurement.');return;}
    for(const k of KEYS){if(reading[k]!==null&&(!Number.isFinite(reading[k])||reading[k]<VALID[k][0]||reading[k]>VALID[k][1])){showFormError(`${DEFINITIONS.find(d=>d.key===k).label} seems out of range. Please check the value and units.`);return;}}
    const existing=store.records.find(r=>r.id===editingId);
    const record={id:editingId||makeId(),date,createdAt:existing?.createdAt??Date.now(),notes:$('entry-notes').value.trim().slice(0,400),...reading};
    if(existing)store.records=store.records.map(r=>r.id===editingId?record:r);else store.records.push(record);
    if(!persist()){showFormError('Device storage is unavailable. Your entry was not safely saved.');return;}
    const wasEdit=!!editingId;resetForm();renderAll();navigate('overview');showToast(wasEdit?'Measurement updated':'Measurement saved on this device');
  }
  function showFormError(msg){$('form-error').textContent=msg;$('form-error').hidden=false;}
  function makeId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`r-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  function renderHistory(){const arr=sorted();$('history-count').textContent=`${arr.length} ${arr.length===1?'entry':'entries'}`;
    if(!arr.length){$('history-list').innerHTML='<div class="empty-state"><svg class="ico"><use href="#i-chart"></use></svg><h3>No history yet</h3><p>Your first check-in will appear here.</p></div>';return;}
    $('history-list').innerHTML=arr.map(r=>{const important=[['Waist',r.waist,'waist'],['Navel',r.abdomen,'abdomen'],['Weight',r.weight,'weight'],['Body fat*',navy(r),'bodyfat']];return `<article class="history-entry"><div class="history-head"><div><div class="history-title">${esc(formatDate(r.date))}</div>${r.notes?`<div class="history-note">${esc(r.notes)}</div>`:''}</div><div class="history-actions"><button class="tiny-icon" type="button" data-edit="${esc(r.id)}" aria-label="Edit ${esc(r.date)}"><svg class="ico"><use href="#i-edit"></use></svg></button><button class="tiny-icon" type="button" data-delete="${esc(r.id)}" aria-label="Delete ${esc(r.date)}"><svg class="ico"><use href="#i-trash"></use></svg></button></div></div><div class="history-metrics">${important.map(([lab,v,k])=>`<div class="history-metric"><b>${Number.isFinite(v)?(k==='bodyfat'?round(v,1)+'%':displayNum(v,k)+' '+unit(k)):'—'}</b><span>${lab}</span></div>`).join('')}</div></article>`;}).join('');
    $('history-list').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editRecord(b.dataset.edit)));
    $('history-list').querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteRecord(b.dataset.delete)));
  }
  function editRecord(id){const r=store.records.find(x=>x.id===id);if(!r)return;resetForm();editingId=id;$('entry-date').value=r.date;$('entry-notes').value=r.notes||'';KEYS.forEach(k=>{const v=r[k];$('m-'+k).value=Number.isFinite(v)?round(toDisplay(v,k),1):'';});$('add-title').innerHTML='Update your <em>check-in.</em>';$('save-button').innerHTML='<svg class="ico"><use href="#i-check"></use></svg> Update measurements';$('cancel-edit').hidden=false;renderPreview();navigate('add');}
  function deleteRecord(id){const r=store.records.find(x=>x.id===id);if(!r)return;if(!confirm(`Delete the measurement from ${formatDate(r.date)}? This cannot be undone unless you have a backup.`))return;store.records=store.records.filter(x=>x.id!==id);if(!persist())return;renderAll();showToast('Check-in removed');}
  function renderSettings(){const u=store.profile.units;$('setting-height').value=store.profile.heightCm!==null?round(toDisplay(store.profile.heightCm,'height'),1):'';$('setting-goal').value=store.profile.goalWaistCm!==null?round(toDisplay(store.profile.goalWaistCm,'waist'),1):'';
    $('height-unit').textContent='('+unit('height')+')';$('goal-unit').textContent='('+unit('waist')+')';
    document.querySelectorAll('[data-unit]').forEach(b=>{const selected=b.dataset.unit===u;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  }
  function saveSettings(ev){ev.preventDefault();const h=$('setting-height').value.trim(),g=$('setting-goal').value.trim();let height=null,goal=null;
    if(h!==''){height=fromDisplay(Number(h),'height');if(!Number.isFinite(height)||height<100||height>250){showToast('Height must be a realistic value.');return;}}
    if(g!==''){goal=fromDisplay(Number(g),'waist');if(!Number.isFinite(goal)||goal<40||goal>150){showToast('Check your waist goal value.');return;}}
    store.profile.heightCm=height;store.profile.goalWaistCm=goal;if(!persist())return;renderAll();showToast('Preferences saved');
  }
  function switchUnits(newUnits){if(!['metric','imperial'].includes(newUnits)||newUnits===store.profile.units)return;
    // Do not silently discard unsaved settings values.
    const h=$('setting-height').value.trim(),g=$('setting-goal').value.trim();
    const draftH=h!==''?fromDisplay(Number(h),'height'):null,draftG=g!==''?fromDisplay(Number(g),'waist'):null;
    store.profile.units=newUnits;renderAll();
    $('setting-height').value=Number.isFinite(draftH)?round(toDisplay(draftH,'height'),1):'';
    $('setting-goal').value=Number.isFinite(draftG)?round(toDisplay(draftG,'waist'),1):'';
    if(activeScreen==='add'&&editingId)editRecord(editingId);else if(activeScreen==='add')resetForm();
    persist();
  }
  function renderGuide(){ $('guide-list').innerHTML=GUIDE.map(([i,title,description])=>`<details class="guide-item"><summary>${esc(i)} &nbsp; ${esc(title)}</summary><p>${esc(description)}</p></details>`).join('');}
  function exportFile(name,contents,type){try{const blob=new Blob([contents],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('File prepared — save it somewhere safe');}catch(e){showToast('Unable to export file on this browser.');}}
  function exportJson(){exportFile(`bodytape-backup-${today()}.json`,JSON.stringify({...store,exportedAt:new Date().toISOString()},null,2),'application/json');}
  function exportCsv(){const header=['date',...KEYS.map(k=>k==='weight'?'weight_kg':`${k}_cm`),'bmi','waist_to_height','waist_to_hip','navy_body_fat_estimate_pct','notes'];const csv=(s)=>'"'+String(s??'').replace(/"/g,'""')+'"';const rows=[header.map(csv).join(',')];sorted().forEach(r=>{rows.push([r.date,...KEYS.map(k=>r[k]??''),bmi(r)?.toFixed(2)??'',whtr(r)?.toFixed(3)??'',whr(r)?.toFixed(3)??'',navy(r)?.toFixed(2)??'',r.notes||''].map(csv).join(','));});exportFile(`bodytape-history-${today()}.csv`, '\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8;');}
  async function importJson(event){const file=event.target.files?.[0];if(!file)return;
    try{if(file.size>5*1024*1024)throw new Error('File is too large for a BodyTape backup.');const parsed=validateStore(JSON.parse(await file.text()));if(store.records.length&&!confirm(`Replace all ${store.records.length} existing entries with ${parsed.records.length} imported entries? Back up your current data first.`))return;
      const old=store;store=parsed;if(!persist()){store=old;throw new Error('Unable to save the imported data on this device.');}resetForm();renderAll();navigate('overview');showToast(`Imported ${parsed.records.length} ${parsed.records.length===1?'reading':'readings'} successfully`);
    }catch(e){alert(`Import failed: ${e.message}`);}finally{event.target.value='';}
  }
  function clearData(){if(!store.records.length){showToast('There are no saved readings to erase.');return;}if(!confirm('Permanently erase ALL body measurement readings on this device? Export a JSON backup first.'))return;if(!confirm('Final confirmation: delete your entire measurement history?'))return;store.records=[];if(!persist())return;resetForm();renderAll();navigate('overview');showToast('All readings erased');}
  function renderAll(){renderFieldInputs();renderOverview();renderHistory();renderSettings();}
  function navigate(screen){if(!['overview','add','history','guide','settings'].includes(screen))return;
    activeScreen=screen;
    document.querySelectorAll('.screen').forEach(s=>{const isCurrent=s.id===`screen-${screen}`;s.hidden=!isCurrent;s.classList.toggle('active',isCurrent);});
    document.querySelectorAll('.bottom-nav button').forEach(b=>{const cur=b.dataset.go===screen;b.classList.toggle('active',cur);if(cur)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function init(){load();renderGuide();renderAll();$('entry-date').value=today();renderPreview();
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.go==='add'&&activeScreen!=='add')resetForm();navigate(b.dataset.go);}));
    document.querySelectorAll('[data-chart]').forEach(b=>b.addEventListener('click',()=>{activeChart=b.dataset.chart;document.querySelectorAll('[data-chart]').forEach(c=>{c.classList.toggle('selected',c===b);c.setAttribute('aria-pressed',String(c===b));});renderChart();}));
    document.querySelectorAll('[data-unit]').forEach(b=>b.addEventListener('click',()=>switchUnits(b.dataset.unit)));
    $('measurement-form').addEventListener('submit',saveForm);$('settings-form').addEventListener('submit',saveSettings);$('cancel-edit').addEventListener('click',()=>{resetForm();navigate('history');});
    $('export-json').addEventListener('click',exportJson);$('export-csv').addEventListener('click',exportCsv);$('import-button').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',importJson);$('clear-data').addEventListener('click',clearData);
    $('theme-toggle').addEventListener('click',()=>{store.profile.theme=store.profile.theme==='dark'?'light':'dark';setTheme();persist();});setTheme();
    if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  function setTheme(){document.documentElement.setAttribute('data-theme',store.profile.theme);document.querySelector('meta[name="theme-color"]').setAttribute('content',store.profile.theme==='dark'?'#0c1615':'#0d3434');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
