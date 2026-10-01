// Units: meters, seconds, radians. Local -Z follows Fatih toward Onur.
export const VERSION = 1;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * t * (10 + t * (-15 + 6 * t)); };
export const radians = d => d * Math.PI / 180;
export const degrees = r => r * 180 / Math.PI;
export const clone = x => JSON.parse(JSON.stringify(x));
export const DEFAULT_PARAMS = {
  bmwSpeed: 60, passSpeed: 65, corollaSpeed: 24, transitSpeed: 43, transitGap: 55,
  brakeDecel: 6, brakeLead: 0, reactionTime: 1,
  corollaDecel: 3.8, corollaStopLead: 0.55,
  collisionTime: 13.2, laneWidth: 3.3, laneOutStart: 172,
  laneOutEnd: 143, laneBackStart: 108, laneBackEnd: 78,
  obstacleZ: 119, spinDegrees: 145, slideDuration: 2.8,
  postBmwDistance: 6.5, flashPeriod: 1, indicatorPeriod: 0.8,
};
export const PARAMS = [
  ['bmwSpeed', 'BMW yaklaşım hızı', 'km/sa', 15, 100, 1],
  ['passSpeed', 'Sağdan geçiş sırasında hız', 'km/sa', 15, 110, 1],
  ['corollaSpeed', 'Corolla yaklaşım hızı', 'km/sa', 5, 60, 1],
  ['transitSpeed', 'Transit hızı', 'km/sa', 10, 80, 1],
  ['transitGap', 'Transit başlangıç mesafesi', 'm', 10, 90, 1],
  ['brakeDecel', 'BMW fren ivmesi', 'm/s²', 1, 10, 0.1],
  ['brakeLead', 'BMW freni → temas', 's', 0, 2, 0.05],
  ['reactionTime', 'Hesap için tepki süresi', 's', 0, 3, 0.1],
  ['corollaDecel', 'Corolla fren ivmesi', 'm/s²', 1, 10, 0.1],
  ['corollaStopLead', 'Corolla duruşu → temas', 's', 0, 3, 0.05],
  ['collisionTime', 'İlk temas zamanı', 's', 10, 20, 0.1],
  ['laneWidth', 'Şerit genişliği', 'm', 2.8, 4.2, 0.1],
  ['laneOutStart', 'Sola geçiş başlangıcı Z', 'm', 130, 230, 1],
  ['laneOutEnd', 'Sola geçiş bitişi Z', 'm', 125, 180, 1],
  ['laneBackStart', 'Geri geçiş başlangıcı Z', 'm', 60, 110, 1],
  ['laneBackEnd', 'Geri geçiş bitişi Z', 'm', 20, 100, 1],
  ['obstacleZ', 'Duran araç Z', 'm', 90, 140, 1],
  ['spinDegrees', 'Corolla dönüş açısı', '°', -250, 250, 5],
  ['slideDuration', 'Corolla savrulma süresi', 's', 1, 6, 0.1],
  ['postBmwDistance', 'BMW temas sonrası yol', 'm', 0, 18, 0.5],
  ['flashPeriod', 'Trafik flaşörü periyodu', 's', 0.4, 2, 0.1],
  ['indicatorPeriod', 'Araç sinyali periyodu', 's', 0.4, 1.5, 0.1],
];
export const VEHICLES = [
  { id: 'bmw', name: 'Siyah BMW · 34 UA 4014', short: 'A · BMW', color: '#191c22', boxColor: '#1677d2', width: 1.82, length: 4.7, height: 1.46, kind: 'bmw', source: 'Kullanıcı beyanı. Model yılı ve ölçüler bilinmiyor.' },
  { id: 'corolla', name: 'Beyaz Corolla · 2 kişi', short: 'B · COROLLA', color: '#edece6', boxColor: '#d76a20', width: 1.8, length: 4.63, height: 1.45, kind: 'corolla', source: 'Kullanıcı beyanı. İki kişi. Model yılı ve plaka bilinmiyor.' },
  { id: 'transit', name: 'Soldaki beyaz Transit', short: 'C · TRANSIT', color: '#eeeae0', boxColor: '#8463b5', width: 2.05, length: 5.53, height: 2.45, kind: 'van', source: 'Kullanıcı beyanı. Başlangıç mesafesi ve hız varsayım.' },
  { id: 'stopped', name: 'Dörtlüsü açık duran araç', short: 'D · DURAN ARAÇ', color: '#929d9b', boxColor: '#8b7822', width: 1.8, length: 4.5, height: 1.5, kind: 'sedan', source: 'Kullanıcı beyanı. Marka, renk ve tam konum bilinmiyor.' },
];
export const DEFAULT_OBJECTS = [
  { id: 'fatih-light-left', type: 'light', name: 'Fatih · sarı flaşör / sol', x: -6.1, z: 18, heading: 0, mode: 'amber' },
  { id: 'fatih-light-right', type: 'light', name: 'Fatih · sarı flaşör / sağ', x: 7.2, z: 18, heading: 0, mode: 'amber' },
  { id: 'meydan-light-left', type: 'light', name: 'Meydan · kırmızı flaşör / sol', x: -8.9, z: -10.8, heading: -2.32, mode: 'red' },
  { id: 'meydan-light-right', type: 'light', name: 'Meydan · kırmızı flaşör / sağ', x: -12.1, z: -4.3, heading: -2.32, mode: 'red' },
  { id: 'stop-sign', type: 'stop', name: 'Corolla yönündeki DUR levhası', x: -13.3, z: -4.6, heading: -2.32 },
  { id: 'direction-sign', type: 'direction', name: 'Acıbadem / Çevreyolu / Avrasya levhası', x: -9.3, z: -10.7, heading: -2.32 },
  { id: 'impact-sign', type: 'chevron', name: 'Savrulma sonundaki levha (konum varsayım)', x: 8.4, z: -8.6, heading: 0 },
  { id: 'cabinet', type: 'cabinet', name: 'Ada üzerindeki elektrik dolabı', x: 10.2, z: -7.5, heading: 0 },
];
export function createProject() {
  return { version: VERSION, title: 'Fatih Sokak / Meydan bağlantısı',
    params: { ...DEFAULT_PARAMS }, vehicles: clone(VEHICLES), objects: clone(DEFAULT_OBJECTS),
    edits: {}, annotations: [], notes: '', createdAt: new Date().toISOString(),
    basis: 'Kullanıcı anlatımına dayalı 3D canlandırma. Ölçümle doğrulanmış kaza rekonstrüksiyonu değildir.',
  };
}
export const duration = p => p.params.collisionTime + Math.max(6, p.params.slideDuration + 2);
export const groundHeight = (x, z) => x > 20 && Math.abs(z) < 14 ? Math.min(8, (x - 20) * 0.07) : 0;
export function roadCenterX(z) {
  const points=[[0,0],[76.454,0],[113.139,-.562],[186.784,1.857],[240.577,4.57],[299.26,7.168]];
  for(let i=1;i<points.length;i++)if(z<=points[i][0])return lerp(points[i-1][1],points[i][1],clamp((z-points[i-1][0])/(points[i][0]-points[i-1][0]),0,1));
  return points.at(-1)[1];
}
export function blink(t, period = 1, phase = 0) {
  return ((Math.max(0, t + phase) % period) / period) < 0.5;
}
export function highBeamAt(t,project) {
  const timeline=events(project),left=timeline.find(e=>e.label==='Sola geçiş').t,back=timeline.find(e=>e.label==='Şeride dönüş').t;
  if(t>=left&&t<back)return false;
  return [Math.max(.2,left-1),back+.2,back+1.5,back+2.8].some(start=>[0,.26].some(offset=>t>=start+offset&&t<start+offset+.14));
}

// Arc length table prevents the crossing car from speeding up at spline joints.
const ROUTE = [[-140,-72],[-110,-59],[-78,-45],[-48,-33],[-28,-24],[-19,-18],[-11,-8],[-7,-2],[-4,0],[0.45,0],[6,0]];
function catmull(a,b,c,d,t) {
  return [0,1].map(i => 0.5*((2*b[i])+(-a[i]+c[i])*t+(2*a[i]-5*b[i]+4*c[i]-d[i])*t*t+(-a[i]+3*b[i]-3*c[i]+d[i])*t*t*t));
}
const routeTable = [];
let routeLength = 0;
for (let i=0;i<600;i++) {
  const q=(i/599)*(ROUTE.length-3), s=Math.min(ROUTE.length-4, Math.floor(q));
  const pos=catmull(ROUTE[s],ROUTE[s+1],ROUTE[s+2],ROUTE[s+3],q-s);
  if(i) routeLength+=Math.hypot(pos[0]-routeTable[i-1].x,pos[1]-routeTable[i-1].z);
  routeTable.push({x:pos[0],z:pos[1],s:routeLength});
}
function routeAt(distance) {
  distance=clamp(distance,0,routeLength);
  let low=0, high=routeTable.length-1;
  while(high-low>1) { const mid=(low+high)>>1; if(routeTable[mid].s<distance) low=mid;else high=mid; }
  const a=routeTable[low],b=routeTable[high],f=(distance-a.s)/(b.s-a.s||1);
  return {x:lerp(a.x,b.x,f),z:lerp(a.z,b.z,f),heading:Math.atan2(-(b.x-a.x),-(b.z-a.z))};
}
function travelBmw(t,p) {
  const c=p.collisionTime,v=p.bmwSpeed/3.6,fast=p.passSpeed/3.6;
  const d=Math.min(p.brakeLead,fast/p.brakeDecel),bt=c-d;
  const sections=[[0,c-5.2,v,v],[c-5.2,c-1.7,v,fast],[c-1.7,bt,fast,fast],[bt,c,fast,fast-p.brakeDecel*d,'linear']];
  let total=0;
  for(const [start,end,a,b,shape] of sections){
    if(t<=start||end<=start)continue;const len=end-start,u=clamp((t-start)/len,0,1);
    const integral=shape==='linear'?u*u/2:u**6-3*u**5+2.5*u**4;
    total+=len*(a*u+(b-a)*integral);
  }
  return total;
}
function zBmw(t,p,contactZ) {
  return contactZ+travelBmw(p.collisionTime,p)-travelBmw(t,p);
}
function laneX(z,p) {
  return roadCenterX(z)-p.laneWidth*smooth((p.laneOutStart-z)/(p.laneOutStart-p.laneOutEnd))
    +p.laneWidth*smooth((p.laneBackStart-z)/(p.laneBackStart-p.laneBackEnd));
}
function basePose(id,t,project) {
  const p=project.params,c=p.collisionTime;
  const bmw=project.vehicles.find(v=>v.id==='bmw'),corolla=project.vehicles.find(v=>v.id==='corolla');
  const contactZ=corolla.width/2+bmw.length/2;
  if(id==='stopped') return {x:roadCenterX(p.obstacleZ),z:p.obstacleZ,heading:0,brake:false,signal:'hazard'};
  if(id==='transit') {const z=zBmw(0,p,contactZ)-p.transitGap-t*p.transitSpeed/3.6;return {x:roadCenterX(z)-p.laneWidth,z,heading:0,brake:false,signal:'off'};}
  if(id==='bmw') {
    if(t>c) {
      const u=clamp((t-c)/2.3,0,1),s=1-(1-u)**3;
      return {x:0.32*s,z:contactZ-p.postBmwDistance*s,heading:-0.06*s,brake:true,signal:'off'};
    }
    const z=zBmw(t,p,contactZ),x=laneX(z,p),dx=laneX(z-0.1,p)-laneX(z+0.1,p);
    const signal=z<=p.laneOutStart+14 && z>p.laneOutEnd-4?'left':z<=p.laneBackStart+14 && z>p.laneBackEnd-4?'right':'off';
    return {x,z,heading:Math.atan2(-dx,0.2),brake:p.brakeLead>0&&t>=c-p.brakeLead,signal};
  }
  if(id==='corolla') {
    if(t>c) {
      const u=clamp((t-c)/p.slideDuration,0,1),f=1-(1-u)**3;
      const sign=project.objects.find(o=>o.id==='impact-sign');
      const angle=-Math.PI/2+radians(p.spinDegrees)*f;
      // The final side of the rectangle touches the editable sign position.
      const endAngle=-Math.PI/2+radians(p.spinDegrees),nx=Math.cos(endAngle),nz=-Math.sin(endAngle);
      const ex=sign.x-nx*(corolla.width/2+0.14),ez=sign.z-nz*(corolla.width/2+0.14);
      return {x:lerp(0.45,ex,f),z:lerp(0,ez,f),heading:angle,brake:true,signal:'off'};
    }
    // Cross the lane at the end of the approach, without waiting in the BMW lane.
    const remain=(c-t)*p.corollaSpeed/3.6,pose=routeAt(routeLength-remain);
    if(t>=c)Object.assign(pose,{x:.45,z:0,heading:-Math.PI/2});
    return {...pose,brake:false,signal:'off'};
  }
  throw new Error('Araç bulunamadı.');
}
export function editOffset(keys,t) {
  if(!keys?.length) return {x:0,z:0,heading:0};
  const sorted=[...keys].sort((a,b)=>a.t-b.t);
  const b=sorted.find(k=>k.t>=t)??sorted.at(-1),idx=sorted.indexOf(b),a=sorted[Math.max(0,idx-1)];
  const f=a===b?0:smooth((t-a.t)/(b.t-a.t));
  return {x:lerp(a.x,b.x,f),z:lerp(a.z,b.z,f),heading:lerp(a.heading,b.heading,f)};
}
export function poseAt(id,t,project,withEdits=true) {
  t=clamp(t,0,duration(project));
  const pose=basePose(id,t,project), offset=withEdits?editOffset(project.edits[id],t):{x:0,z:0,heading:0};
  const v=project.vehicles.find(v=>v.id===id);
  return {...pose,x:pose.x+offset.x,z:pose.z+offset.z,heading:pose.heading+offset.heading,
    signal:v.signalOverride && v.signalOverride!=='auto'?v.signalOverride:pose.signal};
}
export function speedAt(id,t,project) {
  const dt=0.001,c=project.params.collisionTime,a=Math.max(0,t-dt),b=Math.min(duration(project),t<=c?Math.min(c,t+dt):t+dt),pa=poseAt(id,a,project),pb=poseAt(id,b,project);
  return Math.hypot(pb.x-pa.x,pb.z-pa.z)/(b-a||1)*3.6;
}
export function addPoseKey(project,id,t,pose) {
  const base=poseAt(id,t,project,false);
  let keys=project.edits[id]??[{t:0,x:0,z:0,heading:0},{t:duration(project),x:0,z:0,heading:0}];
  keys=keys.filter(k=>Math.abs(k.t-t)>0.015);
  keys.push({t:Number(t.toFixed(3)),x:pose.x-base.x,z:pose.z-base.z,heading:pose.heading-base.heading});
  project.edits[id]=keys.sort((a,b)=>a.t-b.t);
}
export function rectangle(pose,vehicle) {
  const c=Math.cos(pose.heading),s=Math.sin(pose.heading);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>{
    x*=vehicle.width/2;z*=vehicle.length/2;
    return {x:pose.x+x*c+z*s,z:pose.z-x*s+z*c};
  });
}
// Separating axis theorem, with rectangles on the road plane.
export function separation(pa,va,pb,vb) {
  const a=rectangle(pa,va),b=rectangle(pb,vb);
  let gap=-Infinity;
  for(const polygon of [a,b]) for(let i=0;i<2;i++) {
    const u=polygon[i],v=polygon[i+1],len=Math.hypot(v.x-u.x,v.z-u.z);
    const nx=-(v.z-u.z)/len,nz=(v.x-u.x)/len;
    const av=a.map(p=>p.x*nx+p.z*nz),bv=b.map(p=>p.x*nx+p.z*nz);
    gap=Math.max(gap,Math.min(...av)-Math.max(...bv),Math.min(...bv)-Math.max(...av));
  }
  return gap;
}
const eventCache=new WeakMap();
export function events(project) {
  const p=project.params,c=p.collisionTime;
  const key=JSON.stringify(p),cached=eventCache.get(project);if(cached?.key===key)return cached.value;
  function timeAtZ(z){let lo=0,hi=c;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(poseAt('bmw',m,project,false).z>z)lo=m;else hi=m;}return (lo+hi)/2;}
  const value=[
    {t:0,label:'Yaklaşım'}, {t:timeAtZ(p.laneOutStart+14),label:'Sol sinyal'},
    {t:timeAtZ(p.laneOutStart),label:'Sola geçiş'},
    {t:timeAtZ(p.laneBackStart+14),label:'Sağ sinyal'},
    {t:timeAtZ(p.laneBackStart),label:'Sağa geçiş'},
    {t:timeAtZ(p.laneBackEnd),label:'Şeride dönüş'},
    {t:c,label:'İlk temas'}, {t:c+p.slideDuration,label:'Levha teması'},
  ].sort((a,b)=>a.t-b.t);
  eventCache.set(project,{key,value});return value;
}
export function explanationCues(project) {
  const p=project.params,c=p.collisionTime;
  const crossing=t=>{const v=project.vehicles.find(v=>v.id==='corolla');return Math.max(...rectangle(poseAt('corolla',t,project),v).map(q=>q.x))>=-p.laneWidth*1.5;};
  const passed=t=>{const a=poseAt('bmw',t,project),b=poseAt('transit',t,project);return a.z+project.vehicles[0].length/2<b.z-project.vehicles[2].length/2;};
  function first(fn){let lo=0,hi=c;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(fn(mid))hi=mid;else lo=mid;}return hi;}
  const timeline=events(project),right=timeline.find(e=>e.label==='Sağa geçiş').t+.28;
  const left=timeline.find(e=>e.label==='Sola geçiş').t,back=timeline.find(e=>e.label==='Şeride dönüş').t;
  return [
    {id:'headlights',t:Math.max(.2,left-1)+.065,title:'Duran araca selektör',text:'Önümdeki araç yolun ortasında durduğu için selektör atıyorum. Sol şeride geçince selektör atmıyorum.',photo:false},
    {id:'right-return',t:right,title:'Sağ sinyal ile şeride dönüş',text:'Duran aracı soldan geçtim. Sağ sinyal vererek kontrollü biçimde kendi şeridime döndüm ve biraz gaz vererek ilerledim.',photo:false},
    {id:'precaution-headlights',t:back+.265,title:'Şeridime döndükten sonra selektör',text:'Herhangi bir araç görmüyorum. Gece, ara sokakların olduğu ana yollarda alışkanlık olarak ne olur ne olmaz diye selektör atıyorum.',photo:false},
    {id:'corolla-entry',t:first(crossing),title:'Corolla’nın yola giriş yönü',text:'Bu geliş kolunda DUR levhası ve kırmızı flaşör var. Corolla soldan çıkarak karşıdaki yokuşa yöneliyor.',photo:true},
    {id:'pass-transit',t:first(passed),title:'Transit’in sağından geçiş',text:'Şeridime dönerken biraz hızlandım ve Transit’i sağından geçtim. Kaza anında Transit arkamdaydı.',photo:false},
    {id:'no-braking-time',t:c-.18,title:'İlk temas öncesi',text:'Corolla’yı önceden görmemiştim. Görüş alanıma girdiğinde gaza bastı. Fren yapacak vaktim olmadı.',photo:false},
  ].sort((a,b)=>a.t-b.t);
}
export function calculations(project) {
  const p=project.params,v=p.bmwSpeed/3.6;
  const bmw=project.vehicles.find(v=>v.id==='bmw'),co=project.vehicles.find(v=>v.id==='corolla');
  const gap=separation(poseAt('bmw',p.collisionTime,project),bmw,poseAt('corolla',p.collisionTime,project),co);
  const problems=[];
  if(p.laneOutStart<=p.laneOutEnd || p.laneBackStart<=p.laneBackEnd) problems.push('Şerit değişimi başlangıç Z değeri bitiş Z değerinden büyük olmalı.');
  if(Math.abs(gap)>0.08) problems.push(`Planlanan temas anında kutular ${Math.abs(gap).toFixed(2)} m ${gap>0?'ayrık':'iç içe'}. Konum anahtarlarını inceleyin.`);
  if(p.brakeDecel*p.brakeLead>v) problems.push('Seçilen fren süresi BMW’yi temastan önce durdurur.');
  if(poseAt('bmw',0,project).z<p.laneOutStart+10) problems.push('Yaklaşım kısa. Temas zamanını artırın veya şerit değişim konumunu değiştirin.');
  return {v,reactionDistance:v*p.reactionTime,brakingDistance:v*v/(2*p.brakeDecel),
    stoppingDistance:v*p.reactionTime+v*v/(2*p.brakeDecel),
    impactSpeed:Math.max(0,p.passSpeed/3.6-p.brakeDecel*p.brakeLead)*3.6,gap,problems};
}
export function validateProject(input) {
  if(!input || input.version!==VERSION) throw new Error('Desteklenmeyen proje sürümü.');
  const p=clone(input);
  // Older project files did not contain the added overtaking parameters.
  for(const key of ['passSpeed','transitGap'])if(p.params&&p.params[key]===undefined)p.params[key]=DEFAULT_PARAMS[key];
  for(const [key,,unit,min,max] of PARAMS) if(!Number.isFinite(p.params?.[key]) || p.params[key]<min || p.params[key]>max) throw new Error(`Geçersiz parametre: ${key} (${unit}).`);
  if(p.params.laneOutStart<=p.params.laneOutEnd || p.params.laneBackStart<=p.params.laneBackEnd) throw new Error('Şerit değişimi başlangıcı bitişinden büyük olmalı.');
  if(!Array.isArray(p.vehicles)||p.vehicles.length!==4) throw new Error('Proje dört aracı içermeli.');
  for(const expected of VEHICLES) {
    const v=p.vehicles.find(v=>v.id===expected.id);
    if(!v) throw new Error('Araç kaydı eksik.');
    for(const key of ['width','length','height']) if(!Number.isFinite(v[key])||v[key]<0.5||v[key]>12) throw new Error('Geçersiz araç ölçüsü.');
    if(typeof v.name!=='string'||v.name.length>180) throw new Error('Geçersiz araç adı.');
    if(!/^#[0-9a-f]{6}$/i.test(v.color)||!/^#[0-9a-f]{6}$/i.test(v.boxColor)) throw new Error('Geçersiz araç rengi.');
  }
  if(!Array.isArray(p.objects)||p.objects.length!==DEFAULT_OBJECTS.length) throw new Error('Sahne nesneleri eksik.');
  for(const expected of DEFAULT_OBJECTS) {
    const o=p.objects.find(o=>o.id===expected.id);
    if(!o || o.type!==expected.type || ![o.x,o.z,o.heading].every(n=>Number.isFinite(n)&&Math.abs(n)<2000)) throw new Error('Geçersiz sahne nesnesi.');
    if(o.type==='light'&&!['amber','red'].includes(o.mode)) throw new Error('Geçersiz flaşör rengi.');
  }
  if(!p.edits||typeof p.edits!=='object'||Array.isArray(p.edits)) throw new Error('Geçersiz konum anahtarları.');
  for(const [id,keys] of Object.entries(p.edits)) {
    if(!VEHICLES.some(v=>v.id===id)||!Array.isArray(keys)||keys.length>2000) throw new Error('Geçersiz araç anahtarı.');
    for(const k of keys) if(![k.t,k.x,k.z,k.heading].every(Number.isFinite)||k.t<0||k.t>60||Math.abs(k.x)>1000||Math.abs(k.z)>1000) throw new Error('Geçersiz konum anahtarı.');
  }
  if(!Array.isArray(p.annotations)||p.annotations.length>2000) throw new Error('Çizim sayısı geçersiz.');
  for(const a of p.annotations) {
    if(!['pen','arrow','rect','measure','note'].includes(a.type)||!Array.isArray(a.points)||a.points.length>10000||!a.points.length) throw new Error('Geçersiz çizim.');
    for(const point of a.points) if(!Array.isArray(point)||point.length!==2||!point.every(n=>Number.isFinite(n)&&Math.abs(n)<2000)) throw new Error('Geçersiz çizim noktası.');
    if(!/^#[0-9a-f]{6}$/i.test(a.color)||typeof a.text!=='string'||a.text.length>2000) throw new Error('Geçersiz çizim metni veya rengi.');
    if(![a.start,a.end].every(Number.isFinite)||a.end<a.start) throw new Error('Geçersiz çizim zamanı.');
  }
  if(typeof p.notes!=='string'||p.notes.length>50000) throw new Error('Proje notu geçersiz.');
  return p;
}
