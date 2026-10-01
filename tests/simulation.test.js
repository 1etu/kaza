import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,clone,poseAt,speedAt,separation,rectangle,blink,highBeamAt,calculations,addPoseKey,events,explanationCues,duration} from '../src/simulation.js';
import {Presentation} from '../src/presentation.js';

test('Default scene has no overlap before the specified first contact',()=>{
  const p=createProject(),a=p.vehicles[0];
  for(let t=0;t<p.params.collisionTime;t+=.025)for(const id of ['corolla','transit','stopped']){
    const b=p.vehicles.find(v=>v.id===id);
    assert.ok(separation(poseAt(a.id,t,p),a,poseAt(id,t,p),b)>-1e-6,`${id} overlaps at ${t}`);
  }
  assert.ok(Math.abs(calculations(p).gap)<1e-9);
});
test('Corolla enters late without waiting; its right side is the contact surface',()=>{
  const p=createProject(),c=p.params.collisionTime;
  assert.ok(speedAt('corolla',c-.35,p)>20);
  assert.ok(speedAt('corolla',c-.05,p)>20);
  const car=poseAt('corolla',c,p),bmw=poseAt('bmw',c,p);
  assert.equal(car.heading,-Math.PI/2);
  assert.ok(Math.abs(bmw.z-p.vehicles[0].length/2-(car.z+p.vehicles[1].width/2))<1e-9);
  assert.ok(Math.abs(speedAt('bmw',c,p)-calculations(p).impactSpeed)<.05);
});
test('The BMW lane is still clear at the main-road traffic lights',()=>{
  const p=createProject();let low=0,high=p.params.collisionTime;
  const z=p.objects.find(o=>o.id==='fatih-light-right').z;
  for(let i=0;i<40;i++){const mid=(low+high)/2;if(poseAt('bmw',mid,p).z>z)low=mid;else high=mid;}
  const rightEdge=Math.max(...rectangle(poseAt('corolla',high,p),p.vehicles[1]).map(point=>point.x));
  assert.ok(rightEdge < -p.vehicles[0].width/2);
});
test('Headlights flash at the obstruction, stop in the left lane, and resume after return',()=>{
  const p=createProject(),timeline=events(p),left=timeline.find(e=>e.label==='Sola geçiş').t,back=timeline.find(e=>e.label==='Şeride dönüş').t;
  assert.ok(highBeamAt(left-.95,p));
  for(let t=left;t<back;t+=.02)assert.equal(highBeamAt(t,p),false);
  assert.ok(highBeamAt(back+.265,p));
});
test('BMW never brakes before impact and accelerates only gently',()=>{
  const p=createProject();let previous=speedAt('bmw',0,p);
  for(let t=0;t<p.params.collisionTime;t+=.02){
    const s=speedAt('bmw',t,p);assert.equal(poseAt('bmw',t,p).brake,false);assert.ok(s>=59.9&&s<=65.2);assert.ok(Math.abs(s-previous)<.15);previous=s;
  }
  assert.ok(poseAt('transit',p.params.collisionTime,p).z>poseAt('bmw',p.params.collisionTime,p).z+6);
});
test('Headlight pulses and explanatory pauses remain independent of playback rate',()=>{
  const p=createProject(),cues=explanationCues(p);assert.ok(highBeamAt(cues[0].t,p));
  const director=new Presentation();let time=cues[0].t-.1;time=director.advance(time,.1,2,cues,true);
  assert.equal(time,cues[0].t);assert.equal(director.hold.id,cues[0].id);
  for(let i=0;i<19;i++){time=director.advance(time,.1,2,cues,true);assert.equal(time,cues[0].t);}
  director.advance(time,.11,2,cues,true);assert.equal(director.hold,null);
  assert.ok(director.advance(time,.1,2,cues,true)>time);
  director.reset(0,cues);assert.equal(director.seen.size,0);
});
test('Rewind has exactly the same positions and flashing state',()=>{
  const p=createProject(),samples=[0,3.5,7,12.9,13.2,14.5,18];
  const states=samples.map(t=>p.vehicles.map(v=>[poseAt(v.id,t,p),blink(t,p.params.indicatorPeriod)]));
  samples.toReversed().forEach((t,i)=>assert.deepEqual(p.vehicles.map(v=>[poseAt(v.id,t,p),blink(t,p.params.indicatorPeriod)]),states[states.length-1-i]));
});
test('The BMW indicates before each lane change; stopped car has hazards',()=>{
  const p=createProject(),e=events(p);
  assert.equal(poseAt('bmw',e.find(e=>e.label==='Sol sinyal').t+.01,p).signal,'left');
  assert.equal(poseAt('bmw',e.find(e=>e.label==='Sağ sinyal').t+.01,p).signal,'right');
  assert.equal(poseAt('stopped',5,p).signal,'hazard');
  assert.equal(poseAt('bmw',11,p).signal,'off');
  assert.ok(p.objects.filter(o=>o.id.startsWith('meydan-light')).every(o=>o.mode==='red'));
});
test('Formulas use meters, seconds and km/h conversion',()=>{
  const p=createProject(),c=calculations(p);assert.ok(Math.abs(c.v-60/3.6)<1e-12);
  assert.ok(Math.abs(c.stoppingDistance-(60/3.6+(60/3.6)**2/12))<1e-10);
});
test('Edits interpolate and survive project file round trip',()=>{
  const p=createProject(),base=poseAt('bmw',7,p);addPoseKey(p,'bmw',7,{...base,x:base.x+2,z:base.z+3});
  assert.ok(Math.abs(poseAt('bmw',7,p).x-base.x-2)<1e-8);
  const q=validateProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(q,p);
  assert.deepEqual(poseAt('bmw',7,q),poseAt('bmw',7,p));
  assert.equal(poseAt('bmw',0,q).x,poseAt('bmw',0,createProject()).x);
});
test('Validation rejects broken ranges, missing actors and invalid drawing coordinates',()=>{
  const p=createProject();let q=clone(p);q.params.bmwSpeed=NaN;assert.throws(()=>validateProject(q));
  q=clone(p);q.vehicles=[];assert.throws(()=>validateProject(q));
  q=clone(p);q.params.laneBackStart=30;q.params.laneBackEnd=60;assert.throws(()=>validateProject(q));
  q=clone(p);q.annotations=[{type:'pen',points:[[Infinity,0]],color:'#000000',text:'',start:0,end:1}];assert.throws(()=>validateProject(q));
});
test('Cars remain finite at every time, including the final resting position',()=>{
  const p=createProject();for(let t=0;t<=duration(p);t+=.02)for(const v of p.vehicles){const s=poseAt(v.id,t,p);assert.ok([s.x,s.z,s.heading,speedAt(v.id,t,p)].every(Number.isFinite));}
  assert.equal(speedAt('bmw',18,p),0);assert.equal(speedAt('corolla',18,p),0);
});
