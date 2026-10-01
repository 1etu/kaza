import './style.css';
import { SceneView } from './scene.js';
import { Presentation, VideoExport } from './presentation.js';
import { createProject, clone, validateProject, PARAMS, poseAt, speedAt, addPoseKey, blink, highBeamAt, calculations, events, explanationCues, duration, clamp, degrees, radians } from './simulation.js';

const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='fatih-3d-project-v1';
let project=createProject(),time=0,playing=false,rate=1,selected='bmw',tool='select',undoStack=[],redoStack=[],pendingDraw=null,drag=null,view;
let settings={boxes:true,labels:true,paths:false,buildings:true};
const presentation=new Presentation();
let video=null,videoEndAt=null;
let savedNotice='';
try {const saved=localStorage.getItem(STORAGE);if(saved){project=validateProject(JSON.parse(saved));savedNotice='Son yerel kayıt açıldı.';}} catch {savedNotice='Eski kayıt okunamadı. Başlangıç senaryosu açıldı.';}
if(project.narrativeRevision!==6){Object.assign(project.params,{bmwSpeed:60,passSpeed:65,transitSpeed:43,transitGap:55,brakeLead:0,laneBackStart:108,laneBackEnd:78});for(const o of project.objects)if(o.id.startsWith('fatih-light')&&o.z===6.8)o.z=18;project.narrativeRevision=6;localStorage.setItem(STORAGE,JSON.stringify(project));}

$('app').innerHTML=`
<header id="toolbar">
  <button id="driver" aria-pressed="true">Sürücü koltuğu</button>
  <button id="bird" aria-pressed="false">Kuşbakışı</button>
  <button id="record-video">Videoyu indir</button>
  <label><input id="auto-explain" type="checkbox" checked> Açıklamalar</label>
  <button id="orbit" hidden aria-pressed="false">Serbest 3D</button>
  <button id="overview" class="advanced-only" hidden>Tüm güzergâh</button>
  <label class="advanced-only" hidden><input type="checkbox" id="follow" checked> BMW’yi izle</label>
  <span class="divider"></span>
  <button id="save" class="advanced-only" hidden>Projeyi kaydet</button><button id="open" class="advanced-only" hidden>Proje aç</button>
  <button id="shot" class="advanced-only" hidden>PNG al</button><button id="csv" hidden>Hareket CSV</button>
  <button id="report" hidden>Hesap dökümü</button><button id="references" class="advanced-only" hidden>Referanslar</button>
  <button id="help" class="advanced-only" hidden>Yardım</button><button id="toggle-panel" aria-pressed="false">Düzenle</button>
  <input type="file" id="file" accept=".json,application/json" hidden>
</header>
<nav id="tools" hidden aria-label="Sahne düzenleme araçları">
  <span>Araç:</span>
  <button data-tool="select" aria-pressed="true">Seç</button>
  <button data-tool="move" aria-pressed="false">Taşı</button>
  <button data-tool="pen" aria-pressed="false">Kalem</button>
  <button data-tool="arrow" aria-pressed="false">Ok</button>
  <button data-tool="rect" aria-pressed="false">Dikdörtgen</button>
  <button data-tool="measure" aria-pressed="false">Mesafe</button>
  <button data-tool="note" aria-pressed="false">Not</button>
  <input type="color" id="draw-color" value="#d63824" aria-label="Çizim rengi">
  <input id="note-text" placeholder="Sahneye eklenecek not" maxlength="150" aria-label="Not metni">
  <label><input id="time-scoped" type="checkbox"> Sadece bu an (±1 sn)</label>
  <button id="undo" disabled>Geri al</button><button id="redo" disabled>Yinele</button>
  <button id="clear-drawings">Çizimleri sil</button>
  <label><input id="boxes" type="checkbox" checked> Kutular</label>
  <label><input id="labels" type="checkbox" checked> Etiketler</label>
  <label><input id="paths" type="checkbox"> Yolları izle</label>
  <label><input id="buildings" type="checkbox" checked> Binalar</label>
</nav>
<main id="workspace">
  <div id="viewport">
    <div id="scene-caption" hidden><strong id="phase">Yaklaşım</strong><br><span id="telemetry"></span><br><span id="signal-state"></span></div>
    <div id="notice" hidden></div>
    <div id="driver-hud"></div>
    <dialog id="explanation" aria-labelledby="explanation-title" aria-describedby="explanation-text">
      <div class="explanation-heading"><strong id="explanation-title"></strong><button id="close-explanation" autofocus>Kapat</button></div>
      <span id="hold-count" hidden></span>
      <p id="explanation-text"></p>
      <div id="evidence-photo" hidden>
        <div class="signal-explanation"><span class="red-flasher"></span><b>KIRMIZI FLAŞÖR</b><span class="stop-symbol">DUR</span></div>
        <div class="reference-pair"><img id="original-photo" src="/references/fatih-yaklasim.png" alt="Orijinal fotoğraf: kavşak, ışık ve DUR levhası">
        <svg viewBox="740 180 135 160" role="img" aria-label="Orijinal fotoğraftaki ışık ve DUR levhasının yakın görünümü"><image href="/references/fatih-yaklasim.png" width="1223" height="848"/></svg></div>
        <small>Orijinal fotoğraf levhanın konumunu gösterir. Olay anının kaydı değildir.</small>
      </div>
    </dialog>
  </div>
  <aside id="inspector" hidden aria-label="Araç ve senaryo düzenleyici">
    <fieldset><legend>Sahne nesneleri</legend><div id="actor-list"></div>
      <select id="object-select" aria-label="Levha veya ışık seç"><option value="">Levha / ışık seç…</option></select>
      <button id="focus">Seçilene yaklaş</button>
    </fieldset>
    <fieldset><legend id="selected-title">Seçili araç</legend>
      <div id="selection-editor"></div>
    </fieldset>
    <details id="calc-details" hidden><summary>Hesaplar</summary><div id="calculations"></div></details>
    <details id="param-details"><summary>Hız, fren, zaman ve geometri</summary>
      <p class="small">Başlangıç değerleri ölçüm değildir. Hız değişince başlangıç mesafesi değişir; temas zamanı sabit tutulur.</p>
      <form id="params-form">${PARAMS.map(([k,label,unit,min,max,step])=>`<div class="row"><label for="p-${k}">${label}<br><span class="small">${unit}</span></label><input id="p-${k}" name="${k}" type="number" min="${min}" max="${max}" step="${step}" required></div>`).join('')}<button type="submit">Parametreleri uygula</button></form>
    </details>
    <details><summary>Proje notları ve konum anahtarları</summary>
      <label class="field">Notlar<textarea id="project-notes" placeholder="Ölçüm, tutanak veya düzeltme notu"></textarea></label>
      <button id="save-notes">Notları kaydet</button><div id="keys"></div>
    </details>
    <button id="reset">Başlangıç senaryosuna dön</button>
    <p class="small">Düzenlemeler bu tarayıcıda saklanır. Avukata göndermek için “Projeyi kaydet” ile JSON dosyası alın.</p>
  </aside>
</main>
<footer id="timeline">
  <div id="transport">
    <button id="start" title="Başa dön">|◀</button>
  <button id="back-frame" class="advanced-only" hidden title="Bir kare geri">◀ Kare</button>
    <button id="play">▶ Oynat</button>
    <button id="forward-frame" class="advanced-only" hidden title="Bir kare ileri">Kare ▶</button>
    <label>Hız <select id="rate"><option value="-2">−2×</option><option value="-1">−1× geri</option><option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
    <input id="scrub" aria-label="Simülasyon zamanı" type="range" min="0" step="0.01">
    <input id="time-input" aria-label="Zaman saniye" type="number" min="0" step="0.01"><span id="duration"></span>
    <label class="advanced-only" hidden><input id="pause-contact" type="checkbox"> Temasta dur</label>
    <span id="status" role="status"></span>
  </div>
  <div id="events" hidden aria-label="Olay anları"></div>
</footer>
<dialog id="reference-dialog"><button data-close> Kapat </button><h2>Konum ve görüntü referansları</h2>
  <p>Yol eksenleri ve bina tabanları OpenStreetMap verisinden alındı. Kaldırımlar, ışıklar ve levhalar fotoğraflara göre yaklaşık yerleştirildi.</p>
  <p>Haritadaki kol adları Dinlenç Caddesi ve Umut Sokak. Kullanıcının “Meydan Cd.” tanımı geliş kolunda korundu. Işıkların olay anındaki flaşör durumu kullanıcı beyanıdır.</p>
  <div class="photos">
    <figure><img src="/references/fatih-yaklasim.png" alt="Kullanıcının paylaştığı DUR levhalı kavşak görünümü"><figcaption>Kullanıcı fotoğrafı 1 · Corolla’nın geliş kolundaki DUR ve ışıklar.</figcaption></figure>
    <figure><img src="/references/meydan-giris.png" alt="Kullanıcının paylaştığı yokuş ve trafik adası"><figcaption>Kullanıcı fotoğrafı 2 · Yokuş ve trafik adası.</figcaption></figure>
    <figure><img src="/references/junction-north.jpg" alt="Fatih yönünden kavşak Street View görüntüsü"><figcaption>Google Street View · BMW’nin yaklaşım yönü.</figcaption></figure>
    <figure><img src="/references/corolla-approach.jpg" alt="Corolla geliş yönünden kavşak Street View görüntüsü"><figcaption>Google Street View · DUR levhası, yön levhası ve Doğtaş köşesi.</figcaption></figure>
    <figure><img src="/references/junction-east.jpg" alt="Doğtaş köşesi ve karşıdaki yokuş"><figcaption>Google Street View · Doğtaş ve yokuş.</figcaption></figure>
    <figure><img src="/references/google-pano.jpg" alt="Kullanıcının bağlantısındaki Nautilus girişi"><figcaption>Kullanıcının gönderdiği panorama · Nautilus girişi.</figcaption></figure>
  </div>
  <p>Görüntüler kaza anını göstermez. Gösterilen yeşil ışıklar simülasyona aktarılmadı.</p>
  <p><a href="https://www.google.com/maps/@?api=1&map_action=pano&pano=mkVtLCCyWz_Gr-8r8_mPwQ&heading=15" target="_blank" rel="noopener">Google Street View · kavşak</a> · <a href="https://www.openstreetmap.org/#map=19/41.0007743/29.0330451" target="_blank" rel="noopener">OpenStreetMap · konum ve katkıda bulunanlar</a></p>
</dialog>
<dialog id="help-dialog" class="help"><button data-close>Kapat</button><h2>Kullanım</h2>
  <ol><li>Oynatın veya alt zaman çubuğunu sürükleyin. Olay düğmeleri ilgili ana gider.</li><li>Kuşbakışı veya Sürücü koltuğu görünümünü seçin. Serbest 3D görünümünde fareyle döndürün.</li><li>Düzenleme aracı seçince oynatma durur. Bir aracı seçin, Taşı ile zeminde sürükleyin veya X / Z / açı alanlarını değiştirin.</li><li>Kalemle sürükleyin. Ok, dikdörtgen ve mesafe için iki noktaya tıklayın. Not için metni yazıp zemine tıklayın.</li><li>Projeyi kaydet ile düzenlemeleri indirin. Proje aç ile aynı JSON dosyasını yeniden yükleyin.</li></ol>
  <p><b>Kısayollar:</b> Boşluk: oynat/dur. ← / →: 1/30 saniye. Shift + ← / →: 1 saniye. Home: başa dön. Ctrl+Z: geri al. Ctrl+Y: yinele. Escape: çizimi iptal et.</p>
  <p><b>Kamera:</b> Kuşbakışında tekerlek yakınlaştırır, sağ fare sürüklemesi görüntüyü kaydırır. Serbest 3D’de sol fare döndürür. Tüm güzergâh bütün yaklaşımı gösterir.</p>
  <p><b>Konum anahtarı:</b> Bir aracı taşıyınca o saniye için konum anahtarı oluşur. Komşu anahtarlar arasında yumuşak geçiş uygulanır. Bu işlem temasın uyumunu değiştirebilir.</p>
  <p><b>Hesap sınırı:</b> 1 sahne birimi = 1 metre. Hız ve fren mesafesi kinematik olarak hesaplanır. Savrulma, kullanıcı anlatımını gösteren düzenlenebilir hareket yoludur. Kütle, sürtünme ve hasar ölçümü olmadığı için çarpışma dinamiği veya kusur hesabı yapılmaz.</p>
  <p><b>İlk değerler:</b> BMW yaklaşımı 60 km/sa, hafif hızlanma sonrası 65 km/sa. Çarpışmadan önce fren yok. Corolla yaklaşımı 24 km/sa. Kesin hızlar ve araç ölçüleri ölçülmedi.</p>
  <p><b>Mesafe aracı:</b> Modelin yatay düzlemindeki mesafeyi verir. Arazi üzerinde yapılmış bir ölçüm değildir.</p>
</dialog>`.replaceAll('="/references/',`="${import.meta.env.BASE_URL}references/`);

function status(text){$('status').textContent=text;}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(project));status('Yerel kayıt güncellendi.');}catch{status('Yerel kayıt dolu. Projeyi dosyaya kaydedin.');}}
function checkpoint(){undoStack.push(clone(project));if(undoStack.length>60)undoStack.shift();redoStack=[];updateHistory();}
function updateHistory(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;}
function commit(fn){checkpoint();fn();view.syncProject(project);refreshProject();persist();}
function pause(){playing=false;$('play').textContent='▶ Oynat';}
function seek(t){pause();time=clamp(Number(t)||0,0,duration(project));presentation.reset(time,explanationCues(project));render(true);}
function setTool(next){pause();tool=next;pendingDraw=null;view.rebuildAnnotations();document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));view.controls.enabled=view.mode!=='driver'&&tool==='select';view.renderer.domElement.style.cursor=tool==='select'?'default':tool==='move'?'grab':'crosshair';if(tool!=='select'&&view.mode==='driver'){setMode('bird');}status(tool==='select'?'Araç veya levhaya tıklayın.':tool==='move'?'Bir nesneyi seçip zeminde sürükleyin.':tool==='pen'?'Zemin üzerinde sürükleyerek çizin.':tool==='note'?'Not metnini yazın, zemine tıklayın.':'Başlangıç ve bitiş noktalarına tıklayın.');}
function setMode(mode){view.setMode(mode);$('follow').checked=view.follow;document.querySelectorAll('#bird,#driver,#orbit').forEach(b=>b.setAttribute('aria-pressed',String(b.id===mode)));$('driver-hud').hidden=mode!=='driver';view.controls.enabled=mode!=='driver'&&tool==='select';render(true);}
function select(id){if(!id)return;selected=id;pause();refreshSelection();render(true);}
function refreshProject(){
  presentation.reset(time,explanationCues(project));
  const d=duration(project);time=clamp(time,0,d);$('scrub').max=d;$('time-input').max=d;$('duration').textContent=`/ ${d.toFixed(2)} s`;
  for(const [k] of PARAMS)$(`p-${k}`).value=project.params[k];
  $('project-notes').value=project.notes;
  $('actor-list').innerHTML=project.vehicles.map(v=>`<button class="actor ${selected===v.id?'selected':''}" style="--actor-color:${v.boxColor}" data-actor="${v.id}">${escapeHtml(v.name)}</button>`).join('');
  document.querySelectorAll('[data-actor]').forEach(b=>b.onclick=()=>select(b.dataset.actor));
  $('object-select').innerHTML='<option value="">Levha / ışık seç…</option>'+project.objects.map(o=>`<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  $('events').innerHTML=events(project).map(e=>`<button data-event-time="${e.t}">${escapeHtml(e.label)} · ${e.t.toFixed(2)} s</button>`).join('');
  document.querySelectorAll('[data-event-time]').forEach(b=>b.onclick=()=>seek(Number(b.dataset.eventTime)));
  refreshSelection();refreshCalculations();updateHistory();render(true);
}
function refreshCalculations(){
  const c=calculations(project),p=project.params;
  $('calculations').innerHTML=`<table><tbody>
    <tr><td>v = hız / 3,6</td><td>${c.v.toFixed(2)} m/s</td></tr>
    <tr><td>Tepki yolu · v × t</td><td>${c.reactionDistance.toFixed(2)} m</td></tr>
    <tr><td>Fren yolu · v² / (2a)</td><td>${c.brakingDistance.toFixed(2)} m</td></tr>
    <tr><td>Toplam duruş yolu</td><td>${c.stoppingDistance.toFixed(2)} m</td></tr>
    <tr><td>Modelde temas hızı</td><td>${c.impactSpeed.toFixed(1)} km/sa</td></tr>
    <tr><td>Temasta kutu aralığı</td><td>${c.gap.toFixed(3)} m</td></tr>
  </tbody></table><p class="small">a = ${p.brakeDecel} m/s²; tepki = ${p.reactionTime} s. Yatay yol ve sabit fren ivmesi varsayımı. Tepki süresi yalnız duruş hesabında kullanılır.</p>
  <p class="small">Savrulma açısı ${p.spinDegrees}°, süresi ${p.slideDuration} s: çizilmiş hareket. Ölçülmüş sonuç değildir.</p>
  ${c.problems.map(s=>`<p class="small warn">${escapeHtml(s)}</p>`).join('')}`;
}
function refreshSelection(){
  const vehicle=project.vehicles.find(v=>v.id===selected),o=vehicle??project.objects.find(o=>o.id===selected);
  if(!o)return;const pose=vehicle?poseAt(selected,time,project):o;
  $('selected-title').textContent=vehicle?'Seçili araç':'Seçili levha / ışık';
  document.querySelectorAll('[data-actor]').forEach(b=>b.classList.toggle('selected',b.dataset.actor===selected));
  $('object-select').value=vehicle?'':selected;
  $('selection-editor').innerHTML=`<p>${escapeHtml(o.name)}</p><form id="pose-form">
    <div class="row"><label for="edit-x">X · sağa (m)</label><input id="edit-x" type="number" step="0.01" value="${pose.x.toFixed(2)}" min="-500" max="500" required></div>
    <div class="row"><label for="edit-z">Z · geriye (m)</label><input id="edit-z" type="number" step="0.01" value="${pose.z.toFixed(2)}" min="-500" max="500" required></div>
    <div class="row"><label for="edit-heading">Yön açısı (°)</label><input id="edit-heading" type="number" step="0.1" value="${degrees(pose.heading).toFixed(1)}" min="-720" max="720" required></div>
    <button type="submit">${vehicle?'Bu ana konum anahtarı ekle':'Nesnenin konumunu uygula'}</button></form>
    ${vehicle?`<p class="small">${escapeHtml(vehicle.source)}</p>
      <div class="row"><label for="edit-signal">Sinyal</label><select id="edit-signal"><option value="auto">Senaryoya göre</option><option value="left">Sol</option><option value="right">Sağ</option><option value="hazard">Dörtlü</option><option value="off">Kapalı</option></select></div>
      <details><summary>Ad, renk ve araç ölçüleri</summary><form id="vehicle-form">
      <label class="field">Ad <input id="edit-name" value="${escapeHtml(vehicle.name)}" maxlength="150" required></label>
      <label class="field">Gövde rengi <input id="edit-color" type="color" value="${vehicle.color}"></label>
      ${[['width','Genişlik'],['length','Uzunluk'],['height','Yükseklik']].map(([k,label])=>`<div class="row"><label for="edit-${k}">${label} (m)</label><input id="edit-${k}" type="number" min="0.5" max="12" step="0.01" value="${vehicle[k]}" required></div>`).join('')}
      <button type="submit">Araç bilgilerini uygula</button></form></details>
      <button id="clear-keys">Bu aracın konum anahtarlarını sil</button>`:
      o.type==='light'?`<div class="row"><label for="edit-light">Flaşör rengi</label><select id="edit-light"><option value="amber">Sarı</option><option value="red">Kırmızı</option></select></div>`:'<p class="small">Fotoğraftan yaklaşık konum. Taşı aracı ile düzeltilebilir.</p>'}`;
  $('pose-form').onsubmit=e=>{e.preventDefault();pause();const p={x:Number($('edit-x').value),z:Number($('edit-z').value),heading:radians(Number($('edit-heading').value))};commit(()=>{if(vehicle)addPoseKey(project,selected,time,p);else Object.assign(o,p);});};
  if(vehicle){
    $('edit-signal').value=vehicle.signalOverride??'auto';$('edit-signal').onchange=e=>{const value=e.target.value;commit(()=>vehicle.signalOverride=value);};
    $('vehicle-form').onsubmit=e=>{e.preventDefault();const vals={name:$('edit-name').value,color:$('edit-color').value,width:Number($('edit-width').value),length:Number($('edit-length').value),height:Number($('edit-height').value)};commit(()=>Object.assign(vehicle,vals));};
    $('clear-keys').onclick=()=>commit(()=>delete project.edits[selected]);
  } else if(o.type==='light'){$('edit-light').value=o.mode;$('edit-light').onchange=e=>{const mode=e.target.value;commit(()=>o.mode=mode);};}
  $('keys').innerHTML=Object.entries(project.edits).map(([id,keys])=>`<p class="small">${escapeHtml(project.vehicles.find(v=>v.id===id).short)}: ${keys.map(k=>`${k.t.toFixed(2)} s`).join(', ')}</p>`).join('')||'<p class="small">Henüz konum anahtarı yok.</p>';
}
let lastUI=-1;
function render(force=false){
  view?.render(time,selected,settings);
  const hold=presentation.hold;
  if(hold){
    $('explanation-title').textContent=hold.title;$('explanation-text').textContent=hold.text;$('evidence-photo').hidden=!hold.photo;
    if(!$('explanation').open)$('explanation').showModal();
  }else if($('explanation').open)$('explanation').close();
  video?.draw(view.renderer.domElement,hold,$('original-photo'),highBeamAt(time,project),time);
  if(!force&&Math.abs(time-lastUI)<.08)return;lastUI=time;
  $('scrub').value=time;$('time-input').value=time.toFixed(2);
  const phase=events(project).filter(e=>e.t<=time+.001).at(-1);$('phase').textContent=phase?.label??'Yaklaşım';
  const a=poseAt('bmw',time,project),b=poseAt('corolla',time,project),as=speedAt('bmw',time,project),bs=speedAt('corolla',time,project);
  $('telemetry').textContent=`t = ${time.toFixed(2)} s · BMW ${as.toFixed(1)} km/sa · Corolla ${bs.toFixed(1)} km/sa`;
  const flash=blink(time,project.params.flashPeriod)?'YANIK':'sönük';
  const signLabel={left:'SOL',right:'SAĞ',off:'kapalı',hazard:'DÖRTLÜ'};
  const fl=project.objects.find(o=>o.id==='fatih-light-right').mode==='amber'?'SARI':'KIRMIZI',ml=project.objects.find(o=>o.id==='meydan-light-right').mode==='red'?'KIRMIZI':'SARI';
  $('signal-state').textContent=`Fatih: ${fl} ${flash} · Meydan: ${ml} ${flash} + DUR · BMW sinyali: ${signLabel[a.signal]}`;
  $('driver-hud').textContent=`${a.signal==='left'?'◀ ':''}${as.toFixed(0)} km/sa${a.signal==='right'?' ▶':''}${highBeamAt(time,project)?' · SELEKTÖR':''}`;
  $('driver-hud').style.color=highBeamAt(time,project)?'#91c5ff':'#f4f5ee';
  if(!playing&&!$('selection-editor').contains(document.activeElement)){
    const p=project.vehicles.some(v=>v.id===selected)?poseAt(selected,time,project):project.objects.find(o=>o.id===selected);
    if(p&&$('edit-x')){$('edit-x').value=p.x.toFixed(2);$('edit-z').value=p.z.toFixed(2);$('edit-heading').value=degrees(p.heading).toFixed(1);}
  }
}
function download(name,blob){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
function downloadText(name,text,type='text/plain;charset=utf-8'){download(name,new Blob([text],{type}));}
function report(){
  const c=calculations(project),p=project.params;
  return `FATİH SOKAK — 3D CANLANDIRMA HESAP DÖKÜMÜ\n${project.basis}\n\nKAYNAK\nKullanıcı anlatımı ve paylaşılan iki fotoğraf. Google Street View kavşak görüntüleri. Yol eksenleri ve bina tabanları: © OpenStreetMap contributors / ODbL.\n\nBEYAN\nSiyah BMW, plaka 34 UA 4014. Orta şeritte duran ve dörtlüsü yanan aracı geçmek için sol sinyal ile sola geçiş. Solda beyaz Transit. Sağ sinyal ile önceki şeride dönüş. Fatih yönünde sarı flaşör. Soldan gelen beyaz Corolla, iki kişi. Geliş kolunda DUR ve kırmızı flaşör. Corolla yolun karşısındaki yokuşa yönelir, BMW önünde frenler ve durur. BMW ön bölümü Corolla sağ yanına, ön yolcu ve arka kapı arasına temas eder. Corolla döner ve levhaya ulaşır. Bu ifadeler bağımsız olarak doğrulanmadı.\n\nVARSAYIMLAR\nKesin hız, araç yılı, ölçüler, yol genişliği, fren başlangıcı ve son konumlar bilinmiyor. Kullanıcı hız için kesin ölçüm vermedi. 60 km/sa başlangıç değeri örnektir. Fotoğraftaki ışıklar olay anındaki ışık durumunu kanıtlamaz. Levha temas noktası varsayımdır.\n\nPARAMETRELER\n${PARAMS.map(([k,label,unit])=>`${label}: ${p[k]} ${unit}`).join('\n')}\n\nFORMÜLLER\nv = km/sa / 3.6 = ${c.v.toFixed(4)} m/s\nTepki yolu = v × tepki süresi = ${c.reactionDistance.toFixed(4)} m\nFren yolu = v² / (2a) = ${c.brakingDistance.toFixed(4)} m\nToplam duruş yolu = ${c.stoppingDistance.toFixed(4)} m\nFren sonrası teorik temas hızı = max(0, v - a × fren süresi) = ${c.impactSpeed.toFixed(4)} km/sa\nHesap yatay yol ve sabit fren ivmesini varsayar. Tepki süresi sadece duruş hesabına girer.\n\nHAREKET YÖNTEMİ\n1 birim = 1 metre. Zaman saniye. BMW şerit geçişi beşinci dereceden yumuşak geçiş fonksiyonu ile hesaplanır. Corolla yolu yay uzunluğu tablosuyla örneklenir. Anlık hız, konumun sayısal türevidir. Temas zamanı senaryo girdisidir. Hız değişince yaklaşımın başlangıç mesafesi değişir. Konum anahtarları bu yola ek düzeltme uygular.\nTemas aralığı: ${c.gap.toFixed(5)} m (ayırıcı eksen testi). Pozitif değer aralık, negatif değer örtüşmedir.\nCorolla temas sonrası çizilmiş yol üzerinde ${p.slideDuration} saniyede ${p.spinDegrees} derece döner. Levha konumu son noktayı belirler. BMW temas sonrası yol: ${p.postBmwDistance} m. Bunlar momentum veya hasar hesabından türetilmedi.\n\nKONTROL NOTLARI\n${c.problems.join('\n')||'Parametre kontrolünde ek uyarı yok.'}\n\nZAMAN ÇİZELGESİ\n${events(project).map(e=>`${e.t.toFixed(3)} s — ${e.label}`).join('\n')}\n\nPROJE NOTLARI\n${project.notes||'Not yok.'}\n\nDüzenlenebilir tam veri JSON proje dosyasındadır. Bu döküm kusur veya hukuki sonuç belirlemez.\n`;
}

try {view=new SceneView($('viewport'),project);} catch(error){$('viewport').innerHTML=`<div id="error">3D görüntü başlatılamadı. WebGL 2 destekli güncel bir tarayıcı kullanın.<pre>${escapeHtml(error.message)}</pre></div>`;throw error;}
view.onManualCamera=()=>{$('follow').checked=false;};
refreshProject();status(savedNotice||'Hazır. Başlangıç hızları ve süreler düzenlenebilir.');
for(const mode of ['bird','driver','orbit'])$(mode).onclick=()=>setMode(mode);
$('overview').onclick=()=>{view.overview();$('follow').checked=false;$('driver-hud').hidden=true;document.querySelectorAll('#bird,#driver,#orbit').forEach(b=>b.setAttribute('aria-pressed',String(b.id==='bird')));render(true);};
$('follow').onchange=e=>view.follow=e.target.checked;
$('toggle-panel').onclick=()=>{const show=$('inspector').hidden;pause();$('inspector').hidden=!show;$('tools').hidden=!show;$('events').hidden=!show;document.querySelectorAll('.advanced-only').forEach(el=>el.hidden=!show);$('toggle-panel').setAttribute('aria-pressed',String(show));};
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
for(const k of Object.keys(settings))$(k).onchange=e=>{settings[k]=e.target.checked;render(true);};
$('play').onclick=()=>{if(playing)pause();else{setTool('select');if(rate>0&&time>=duration(project)){time=0;presentation.reset(0,explanationCues(project));}if(rate<0&&time<=0)time=duration(project);playing=true;$('play').textContent='❚❚ Durdur';}};
$('auto-explain').onchange=()=>{if(!$('auto-explain').checked)presentation.cancel();};
$('close-explanation').onclick=()=>{presentation.cancel();$('explanation').close();render(true);};
$('explanation').addEventListener('cancel',event=>event.preventDefault());
$('record-video').onclick=()=>{
  if(video?.active){video.stop();pause();return;}
  try{
    pause();time=0;rate=1;$('rate').value='1';setTool('select');presentation.reset(0,explanationCues(project));videoEndAt=null;
    video=new VideoExport(blob=>{download('fatih-gece-aciklama.webm',blob);$('record-video').textContent='Videoyu indir';$('record-video').disabled=false;status('Video indirildi.');});
    video.start();playing=true;$('play').textContent='❚❚ Durdur';$('record-video').textContent='Kaydı bitir';status('Video hazırlanıyor. Açıklamalar videoya ekleniyor.');
  }catch(error){status(error.message);}
};
$('start').onclick=()=>seek(0);$('back-frame').onclick=()=>seek(time-1/30);$('forward-frame').onclick=()=>seek(time+1/30);
$('rate').onchange=e=>rate=Number(e.target.value);$('scrub').oninput=e=>seek(e.target.value);$('time-input').onchange=e=>seek(e.target.value);
$('object-select').onchange=e=>select(e.target.value);$('focus').onclick=()=>{view.focus(selected);$('follow').checked=false;render(true);};
$('undo').onclick=()=>{if(!undoStack.length)return;pause();redoStack.push(clone(project));project=undoStack.pop();view.syncProject(project);refreshProject();persist();};
$('redo').onclick=()=>{if(!redoStack.length)return;pause();undoStack.push(clone(project));project=redoStack.pop();view.syncProject(project);refreshProject();persist();};
$('clear-drawings').onclick=()=>commit(()=>project.annotations=[]);
$('params-form').onsubmit=e=>{e.preventDefault();pause();const next=clone(project);for(const [k] of PARAMS)next.params[k]=Number($(`p-${k}`).value);try{validateProject(next);commit(()=>project=next);}catch(error){status(error.message);}};
$('save-notes').onclick=()=>{const text=$('project-notes').value;commit(()=>project.notes=text);};
$('reset').onclick=()=>{pause();commit(()=>{project=createProject();time=0;selected='bmw';});status('Başlangıç senaryosu açıldı. Geri al ile önceki projeye dönebilirsiniz.');};
$('save').onclick=()=>downloadText('fatih-3d-proje.json',JSON.stringify(project,null,2),'application/json');
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>8e6)throw new Error('Proje dosyası 8 MB sınırını aşıyor.');const next=validateProject(JSON.parse(await file.text()));pause();commit(()=>{project=next;time=0;selected='bmw';});status('Proje açıldı.');}catch(error){status(`Dosya açılamadı: ${error.message}`);}e.target.value='';};
$('report').onclick=()=>downloadText('fatih-hesap-dokumu.txt',report());
$('csv').onclick=()=>{
  const rows=['zaman_s;arac;x_m;z_m;aci_derece;hiz_km_sa;fren;sinyal;fazor_yanik'];
  for(let t=0;t<=duration(project)+.0001;t+=.1)for(const v of project.vehicles){const p=poseAt(v.id,t,project);rows.push([t.toFixed(3),v.id,p.x.toFixed(4),p.z.toFixed(4),degrees(p.heading).toFixed(3),speedAt(v.id,t,project).toFixed(3),p.brake?1:0,p.signal,blink(t,project.params.indicatorPeriod)?1:0].join(';'));}
  downloadText('fatih-hareket-verisi.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');
};
$('shot').onclick=()=>{
  pause();render(true);const source=view.renderer.domElement,c=document.createElement('canvas');c.width=source.width;c.height=source.height+96;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0);ctx.fillStyle='#222';ctx.font='18px Arial';
  ctx.fillText(`Fatih Sokak · t = ${time.toFixed(2)} s · ${$('phase').textContent} · ${$('telemetry').textContent}`,16,source.height+27,c.width-32);
  ctx.font='15px Arial';ctx.fillText('Beyana dayalı canlandırma. Hızlar, ölçüler ve savrulma varsayımdır. Ölçümle doğrulanmış rekonstrüksiyon değildir.',16,source.height+55,c.width-32);
  ctx.fillText('Yol eksenleri / bina tabanları: © OpenStreetMap contributors. Işık durumu: kullanıcı beyanı.',16,source.height+78,c.width-32);
  c.toBlob(blob=>{if(blob)download(`fatih-${time.toFixed(2)}s.png`,blob);});
};
$('references').onclick=()=>$('reference-dialog').showModal();$('help').onclick=()=>$('help-dialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

const canvas=view.renderer.domElement;
function annotation(type,point){return {id:crypto.randomUUID(),type,points:[point],color:$('draw-color').value,text:$('note-text').value.trim(),start:$('time-scoped').checked?Math.max(0,time-1):0,end:$('time-scoped').checked?time+1:60};}
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  if(tool==='select'){const id=view.pick(e.clientX,e.clientY);if(id)select(id);return;}
  pause();const point=view.groundPoint(e.clientX,e.clientY);if(!point)return;
  if(tool==='move'){
    const id=view.pick(e.clientX,e.clientY);if(id)select(id);else return;
    const vehicle=project.vehicles.find(v=>v.id===selected),pose=vehicle?poseAt(selected,time,project):project.objects.find(o=>o.id===selected);
    checkpoint();drag={start:point,pose:{...pose},id:selected,vehicle:!!vehicle};canvas.setPointerCapture(e.pointerId);return;
  }
  if(tool==='note'){if(!$('note-text').value.trim()){status('Önce not metnini yazın.');return;}commit(()=>project.annotations.push(annotation('note',point)));return;}
  if(tool==='pen'){pendingDraw=annotation(tool,point);canvas.setPointerCapture(e.pointerId);return;}
  if(!pendingDraw){pendingDraw=annotation(tool,point);status('Bitiş noktasına tıklayın.');}
  else {pendingDraw.points=[pendingDraw.points[0],point];const drawing=pendingDraw;pendingDraw=null;commit(()=>project.annotations.push(drawing));}
});
canvas.addEventListener('pointermove',e=>{
  if(!drag&&!pendingDraw)return;const point=view.groundPoint(e.clientX,e.clientY);if(!point)return;
  if(drag){
    const pose={x:drag.pose.x+point[0]-drag.start[0],z:drag.pose.z+point[1]-drag.start[1],heading:drag.pose.heading};
    if(drag.vehicle)addPoseKey(project,drag.id,time,pose);else Object.assign(project.objects.find(o=>o.id===drag.id),pose);
    render(true);return;
  }
  if(tool==='pen'){const last=pendingDraw.points.at(-1);if(Math.hypot(point[0]-last[0],point[1]-last[1])>.08)pendingDraw.points.push(point);}
  else pendingDraw.points=[pendingDraw.points[0],point];
  view.rebuildAnnotations(pendingDraw);render(true);
});
canvas.addEventListener('pointerup',e=>{
  if(drag){drag=null;view.rebuildPaths();refreshSelection();refreshCalculations();persist();}
  if(tool==='pen'&&pendingDraw){const drawing=pendingDraw;pendingDraw=null;if(drawing.points.length>1)commit(()=>project.annotations.push(drawing));}
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel',()=>{drag=null;pendingDraw=null;view.rebuildAnnotations();refreshSelection();persist();});
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
  if(e.code==='Space'){e.preventDefault();$('play').click();}
  else if(e.key==='ArrowLeft'){e.preventDefault();seek(time-(e.shiftKey?1:1/30));}
  else if(e.key==='ArrowRight'){e.preventDefault();seek(time+(e.shiftKey?1:1/30));}
  else if(e.key==='Home'){e.preventDefault();seek(0);}
  else if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();}
  else if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();$('redo').click();}
  else if(e.key==='Escape'){pendingDraw=null;view.rebuildAnnotations();setTool('select');}
});
let previous=performance.now();
function frame(now){
  const dt=Math.min((now-previous)/1000,.1);previous=now;
  if(playing&&!presentation.hold){let next=clamp(presentation.advance(time,dt,rate,explanationCues(project),$('auto-explain').checked),0,duration(project));if($('pause-contact').checked&&time<project.params.collisionTime&&next>=project.params.collisionTime){next=project.params.collisionTime;pause();}time=next;if(time===0||time===duration(project)){pause();if(video?.active)videoEndAt=now+.5*1000;}}
  if(video?.active&&videoEndAt!==null&&now>=videoEndAt){video.stop();videoEndAt=null;}
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only diagnostics let the local test suite inspect the rendered state.
window.simulation={getState:()=>({time,playing,hold:presentation.hold?{...presentation.hold}:null,recording:video?.active??false,mode:view.mode,selected,tool,project:clone(project),settings:{...settings},drawCalls:view.renderer.info.render.calls}),projectToScreen:(x,z,y)=>view.projectToScreen(x,z,y)};
