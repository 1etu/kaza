import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import mapData from './map-data.json';
import { poseAt, groundHeight, blink, highBeamAt, duration, roadCenterX } from './simulation.js';

const materials = new Map();
function material(color, roughness=0.85) {
  const key=`${color}:${roughness}`;
  if(!materials.has(key)) materials.set(key,new T.MeshStandardMaterial({color,roughness}));
  return materials.get(key);
}
const cube = new T.BoxGeometry(1,1,1);
function box(parent,x,y,z,w,h,d,color,rotation=0) {
  const mesh=new T.Mesh(cube,typeof color==='object'?color:material(color));
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=rotation;
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,x,y,z,r,h,color,segments=10) {
  const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),material(color));
  mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function makeTexture(text,{fg='#fff',bg='#343637',w=1024,h=256,size=90,border=false}={}) {
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);}
  if(border){ctx.strokeStyle=fg;ctx.lineWidth=9;ctx.strokeRect(8,8,w-16,h-16);}
  ctx.fillStyle=fg;ctx.font=`600 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
  text.split('\n').forEach((line,i,arr)=>ctx.fillText(line,w/2,h/2+(i-(arr.length-1)/2)*size*1.15,w-30));
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function panel(parent,text,x,y,z,w,h,opts={}) {
  const tex=makeTexture(text,opts),m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,transparent:!opts.bg,depthWrite:!!opts.bg});
  const mesh=new T.Mesh(new T.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function label(parent,text,x,y,z,color='#17242c',scale=5) {
  const tex=makeTexture(text,{fg:color,bg:'#fffffff0',w:768,h:128,size:48,border:true});
  const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:false,transparent:true}));
  sprite.position.set(x,y,z);sprite.scale.set(scale,scale/6,1);sprite.renderOrder=20;parent.add(sprite);return sprite;
}
function line(parent,points,color,y=0.09) {
  const geo=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(p[0],(p[2]??groundHeight(p[0],p[1]))+y,p[1])));
  const l=new T.Line(geo,new T.LineBasicMaterial({color,depthTest:true}));parent.add(l);return l;
}
function polygon(parent,points,color,y=0.14,depth=0) {
  const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1])));
  const geo=depth?new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}):new T.ShapeGeometry(shape);
  geo.rotateX(-Math.PI/2);
  const mesh=new T.Mesh(geo,material(color));mesh.position.y=y;mesh.receiveShadow=true;mesh.castShadow=depth>0;parent.add(mesh);return mesh;
}
function ribbon(parent,points,width,color,y=0.02) {
  const verts=[],indices=[];
  for(let i=0;i<points.length;i++) {
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],p=points[i];
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
    for(const side of [-1,1]) {
      const x=p[0]-dz/len*width/2*side,z=p[1]+dx/len*width/2*side;
      verts.push(x,groundHeight(x,z)+y,z);
    }
    if(i<points.length-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mat=material(color);mat.side=T.DoubleSide;
  const mesh=new T.Mesh(geo,mat);mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function roadText(parent,text,x,z,w,heading=0) {
  const p=panel(parent,text,x,groundHeight(x,z)+0.065,z,w,w/7,{fg:'#dfdfd4',bg:null,size:70});
  p.rotation.set(-Math.PI/2,0,heading);return p;
}
function mergeStatic(group) {
  const batches=new Map();group.updateMatrixWorld(true);
  group.traverse(o=>{if(o.isMesh && !Array.isArray(o.material) && !o.material.map){
    if(!batches.has(o.material))batches.set(o.material,[]);
    batches.get(o.material).push(o);
  }});
  for(const [mat,meshes] of batches) {
    if(meshes.length<3)continue;
    const geometries=meshes.map(m=>{const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();for(const attr of Object.keys(geo.attributes))if(!['position','normal'].includes(attr))geo.deleteAttribute(attr);return geo.applyMatrix4(m.matrixWorld);});
    const geo=mergeGeometries(geometries,false);
    geometries.forEach(g=>g.dispose());
    if(!geo)continue;
    meshes.forEach(m=>m.removeFromParent());
    const merged=new T.Mesh(geo,mat);merged.receiveShadow=true;merged.castShadow=meshes.some(m=>m.castShadow);group.add(merged);
  }
}
function tree(parent,x,z,height=7,seed=1) {
  cylinder(parent,x,height*.28,z,.15,height*.56,'#675442');
  for(let i=0;i<3;i++){
    const mesh=new T.Mesh(new T.IcosahedronGeometry(height*.28,1),material(i===1?'#526b40':'#66794e'));
    mesh.position.set(x+Math.sin(seed+i*2)*.8,height*.6+i*.65,z+Math.cos(seed+i)*.7);mesh.scale.y=1.25;mesh.castShadow=true;parent.add(mesh);
  }
}
function palm(parent,x,z,height=7) {
  cylinder(parent,x,height*.43,z,.34,height*.86,'#6e5c3d',12);
  for(let i=0;i<14;i++){
    const a=i*Math.PI*2/14;
    const spine=new T.CatmullRomCurve3([new T.Vector3(x,height*.83,z),new T.Vector3(x+Math.cos(a)*1.4,height+.4,z+Math.sin(a)*1.4),new T.Vector3(x+Math.cos(a)*3.5,height*.70,z+Math.sin(a)*3.5)]);
    const leaf=new T.Mesh(new T.TubeGeometry(spine,10,.19,5,false),material(i%2?'#425c35':'#556e3e'));leaf.castShadow=true;parent.add(leaf);
  }
}
function hedge(parent,points) {
  ribbon(parent,points,.52,'#bfbda7',.95);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],distance=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(distance/.8);
    const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    box(parent,(a[0]+b[0])/2,.48,(a[1]+b[1])/2,distance,.95,.46,'#bfbda7',angle);
    for(let j=0;j<=steps;j++){
      const t=j/steps,x=a[0]+(b[0]-a[0])*t-.6,z=a[1]+(b[1]-a[1])*t;
      const bush=new T.Mesh(new T.IcosahedronGeometry(.82,1),material(j%3===0?'#4a5233':'#374b32'));
      bush.position.set(x,1.39+(j%3)*.035,z);bush.scale.set(1,.69,1.02);bush.castShadow=true;parent.add(bush);
    }
  }
}
function streetlight(parent,x,z) {
  cylinder(parent,x,4.5,z,0.085,9,'#888d89');
  box(parent,x+1,9,z,2.2,.1,.1,'#929a96');box(parent,x+2,8.96,z,.72,.13,.35,new T.MeshStandardMaterial({color:'#fff4ce',emissive:'#ffe2a2',emissiveIntensity:3}));
}
function makeBuildings(parent) {
  const colors=['#c3b6a1','#cda18b','#d6c4ae','#bdb6a5','#d2aa92'];
  for(const f of mapData.features.filter(f=>f.tags.building)) {
    let points=f.points.slice(0,-1);if(points.length<3)continue;
    const cx=points.reduce((s,p)=>s+p[0],0)/points.length,cz=points.reduce((s,p)=>s+p[1],0)/points.length;
    if(Math.abs(cx)>135||cz>285||cz<-115)continue;
    const isDogtas=f.id==='881543609',isMall=points.some(p=>p[0]<-45)&&points.length>12;
    const hash=Number(f.id)%5,floors=isMall?3:isDogtas?6:5+hash%3,h=floors*2.8+3.8;
    if(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))<4)continue;
    const g=new T.Group();parent.add(g);
    polygon(g,points,isDogtas?'#ce9980':isMall?'#cacac3':colors[hash],0.2,h);
    polygon(g,points,'#96928a',h+.23,.25);
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(len<3)continue;
      const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      const n=Math.max(1,Math.floor(len/3.2));
      for(let j=0;j<n;j++) {
        const t=(j+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        box(g,x,1.7,z,len/n-.26,2.8,.1,'#557076',angle);
        for(let floor=0;floor<floors;floor++) {
          const y=5.1+floor*2.8;
          box(g,x,y,z,1.75,1.85,.12,'#e6e2d7',angle);
          box(g,x,y,z,1.46,1.57,.15,'#6e858a',angle);
          box(g,x,y,z,.07,1.6,.17,'#cfcfc7',angle);
        }
      }
      box(g,(a[0]+b[0])/2,3.4,(a[1]+b[1])/2,len,.3,.2,'#e4ddd0',angle);
      if(isDogtas) {
        box(g,(a[0]+b[0])/2,4.1,(a[1]+b[1])/2,len,2.25,.24,'#51443e',angle);
        const sign=panel(g,'DOĞTAŞ exclusive',(a[0]+b[0])/2,4.2,(a[1]+b[1])/2,Math.min(12,len-.6),1.5,{bg:'#51443e',fg:'#eee9df',size:90});
        sign.rotation.y=angle;sign.translateZ(.16);
      }
    }
  }
  // Nautilus facade, at the west of the approach, follows the supplied panorama.
  box(parent,-66,7,143,32,14,140,'#d7d7cf');
  box(parent,-49.8,5.5,143,.25,3.2,128,'#6d96aa');
  for(let z=90;z<208;z+=8)box(parent,-49.6,5.5,z,.3,3.3,.2,'#eeeeea');
  const mall=panel(parent,'TEPE NAUTILUS',-49.55,10,154,21,3,{fg:'#2a5990',bg:'#d7d7cf'});mall.rotation.y=Math.PI/2;
  // The shop signs are observed in the two reference photographs.
  const ar=panel(parent,'AR LASTİK',34,3,-8.4,6.2,1.15,{fg:'#285443',bg:'#ece8dc'});ar.rotation.y=-.39;
  const oto=panel(parent,'OTO ÇALIŞKAN',21,3,-28,8.2,1,{fg:'#fff',bg:'#32689a'});oto.rotation.y=-1.57;
}
function buildWorld(p) {
  const root=new T.Group(),environment=new T.Group(),buildings=new T.Group(),roads=new T.Group();
  root.add(environment,roads,buildings);
  box(environment,0,-.35,70,520,.5,540,'#b8b5a6');
  const relevant=mapData.features.filter(f=>f.tags.highway && f.tags.highway!=='footway' && f.tags.highway!=='steps' && !f.tags.service);
  const widthFor=f=>f.id==='227892263'?p.laneWidth*3:f.tags.highway==='primary'?9:f.tags.highway==='primary_link'?6.4:6.7;
  for(const f of relevant) ribbon(roads,f.points,widthFor(f)+4.6,'#c8c4b6',.015);
  for(const f of relevant) ribbon(roads,f.points,widthFor(f),'#777b78',.038);
  // Islands separate the two branches at both sides of the crossing.
  polygon(roads,[[5.6,-4],[15.2,-3.5],[12.5,-8.3],[6.1,-22.5],[5.1,-17]],'#d5d0bf',.05,.18);
  polygon(roads,[[-5.3,-9.1],[-10.8,-16.8],[-8,-17.6],[-3.4,-21]],'#cfccbd',.05,.18);
  polygon(environment,[[-8,3],[-9,41],[-17,54],[-40,52],[-61,18],[-42,-13],[-20,-10]],'#7d8c64',.05,.34);
  // Wall and hedge follow the curve seen from the BMW approach in Street View.
  hedge(environment,[[-14.7,-6.5],[-11.4,-3.7],[-8.4,1.6],[-7.8,6],[-8.1,14],[-8.7,28],[-9,41],[-17,54],[-40,52]]);
  palm(environment,-12.3,7.5,6.3);
  tree(environment,-13.8,14,10.5,15);tree(environment,-12.5,26,11.6,8);
  tree(environment,-15.3,1.5,10.3,6);
  for(const [i,x,z,h] of [[1,-18,9,12],[2,-20,25,10],[3,-31,33,9],[4,-47,20,8],[5,-13,46,8],[6,14,-30,7],[7,32,-5,6],[8,41,-4,7]])tree(environment,x,z,h,i);
  for(let z=28;z<270;z+=32){streetlight(environment,-7,z);streetlight(environment,8,z+9);}
  for(let z=16;z<280;z+=7.5) {
    for(const offset of [-p.laneWidth/2,p.laneWidth/2])box(roads,roadCenterX(z)+offset,.065,z,.10,.018,3.2,'#d6d6cb');
  }
  for(const offset of [-p.laneWidth*1.5+.16,p.laneWidth*1.5-.16])ribbon(roads,Array.from({length:88},(_,i)=>{const z=16+i*3;return [roadCenterX(z)+offset,z];}),.1,'#d6d6cb',.065);
  for(let z=22;z<260;z+=3.5){box(roads,roadCenterX(z)-p.laneWidth*1.5-.12,.18,z,.22,.24,3.45,(Math.floor(z/3.5)%3===0)?'#b5a261':'#b9b7aa');box(roads,roadCenterX(z)+p.laneWidth*1.5+.12,.18,z,.22,.24,3.45,'#b9b7aa');}
  for(let x=22;x<110;x+=4){cylinder(roads,x,groundHeight(x,-3.65)+.18,-3.65,.25,.36,'#a59b6e');cylinder(roads,x,groundHeight(x,3.65)+.18,3.65,.25,.36,'#a59b6e');}
  for(let x=-4.6;x<5;x+=1)box(roads,x,.07,16,.48,.02,2.25,'#dcdace');
  const stopline=box(roads,-11.2,.07,-6.8,6.3,.02,.35,'#e1dfd3',-.82);
  stopline.userData.reference='Fotoğraftan yaklaşık dur çizgisi';
  roadText(roads,'FATİH SOKAK',0,166,8.2);
  roadText(roads,'ÇEVREYOLU ↑',0,47,8.1);
  roadText(roads,'ONUR SOKAK',3,-44,7.5);
  roadText(roads,'MEYDAN CD. / GELİŞ KOLU',-38,-25,15,-1.1);
  roadText(roads,'UMUT SOKAK · YOKUŞ',44,0,16,-Math.PI/2);
  for(const z of [36,82,186]) for(const x of [-p.laneWidth,0,p.laneWidth]) {
    box(roads,x,.07,z,.15,.02,2.6,'#e0ded2');
    polygon(roads,[[x-.55,z-.65],[x,z-1.8],[x+.55,z-.65]],'#e0ded2',.071);
  }
  makeBuildings(buildings);mergeStatic(environment);mergeStatic(buildings);mergeStatic(roads);
  roads.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return {root,buildings};
}
function lamp(parent,x,y,z,color,w=.22,h=.16) {
  const mat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0,roughness:.3,toneMapped:false});
  return box(parent,x,y,z,w,h,.045,mat);
}
function makeCar(v) {
  const group=new T.Group(),body=new T.Group(),cabin=new T.Group();group.add(body,cabin);
  const w=v.width,l=v.length,h=v.height,isVan=v.kind==='van',isBmw=v.kind==='bmw';
  const paint=new T.MeshStandardMaterial({color:v.color,roughness:.3,metalness:.32});
  box(body,0,.58,0,w,.61,l-.12,paint);
  box(body,0,.77,-l*.33,w*.97,.29,l*.27,paint);
  box(body,0,.75,l*.34,w*.97,.25,l*.24,paint);
  box(body,0,.39,-l/2,w*.93,.19,.13,'#232729');box(body,0,.39,l/2,w*.93,.19,.13,'#303337');
  if(isVan) {
    box(cabin,0,(h+.8)/2,.35,w*.94,h-.8,l*.68,paint);
    box(cabin,0,1.3,-l*.30,w*.94,1.13,l*.28,paint);
    box(cabin,0,1.48,-l*.449,w*.86,.7,.045,'#526b75');
    box(cabin,0,h-.25,l*.405,w*.75,.4,.04,'#425862');
    for(const x of [-w/2-.008,w/2+.008])box(cabin,x,1.4,-l*.29,.04,.67,.9,'#476674');
  } else {
    box(cabin,0,1.02,.02,w*.86,.48,l*.53,'#4c626a');
    box(cabin,0,h-.12,.10,w*.80,.18,l*.4,paint);
    const wind=box(cabin,0,1.08,-l*.257,w*.81,.49,.05,'#6b858d');wind.rotation.x=-.34;
    const rear=box(cabin,0,1.08,l*.278,w*.80,.43,.05,'#617883');rear.rotation.x=.34;
    for(const x of [-w*.441,w*.441]){
      box(cabin,x,1.08,.15,.035,.55,.075,paint);
      box(cabin,x,.89,-.50,.055,.075,.65,paint);
      box(cabin,x,.89,.66,.055,.075,.63,paint);
      box(body,x*1.17,.95,-.73,.23,.12,.24,paint);
      for(const z of [-.4,.72])box(body,x*1.13,.77,z,.035,.04,.20,'#c4c7c6');
    }
    if(v.id==='corolla')for(const x of [-.4,.4]){
      box(cabin,x,.89,-.23,.40,.50,.37,'#4b4742');
      const head=new T.Mesh(new T.SphereGeometry(.11,10,8),material('#b39b85'));head.position.set(x,1.15,-.33);cabin.add(head);
    }
  }
  if(isBmw)for(const x of [-.20,.20])box(body,x,.61,-l/2-.03,.30,.27,.04,'#101215');
  else box(body,0,.57,-l/2-.03,w*.50,.17,.04,'#2c3134');
  const wheels=[];
  for(const x of [-w/2,w/2])for(const z of [-l*.31,l*.31]){
    const wheel=new T.Group();wheel.position.set(x,.33,z);group.add(wheel);wheels.push(wheel);
    const tire=new T.Mesh(new T.CylinderGeometry(.32,.32,.19,18),material('#25282a'));tire.rotation.z=Math.PI/2;wheel.add(tire);
    const rim=new T.Mesh(new T.CylinderGeometry(.22,.22,.201,10),material('#a0a7aa',.35));rim.rotation.z=Math.PI/2;wheel.add(rim);
  }
  const lamps={left:[],right:[],brake:[],head:[]},beams=[];
  for(const side of [-1,1]) {
    const signalSide=side<0?'left':'right';
    lamps[signalSide].push(lamp(body,side*w*.45,.70,-l/2-.045,'#ffa800',.13,.14));
    lamps[signalSide].push(lamp(body,side*w*.46,.71,l/2+.04,'#ffa800',.13,.15));
    const repeater=lamp(body,side*w*.57,.95,-.72,'#ffa800',.11,.05);repeater.rotation.y=Math.PI/2;lamps[signalSide].push(repeater);
    lamps.head.push(lamp(body,side*w*.32,.70,-l/2-.05,'#fff7d9',.36,.14));
    lamps.brake.push(lamp(body,side*w*.30,.72,l/2+.04,'#e82319',.36,.15));
  }
  if(['bmw','corolla'].includes(v.id))for(const side of [-1,1]){
    const beam=new T.SpotLight('#e6edff',210,90,.34,.7,1.5);
    beam.position.set(side*w*.32,.72,-l/2-.11);
    const target=new T.Object3D();target.position.set(side*1.4,-.15,-38);group.add(target);beam.target=target;group.add(beam);beams.push(beam);
  }
  lamps.brake.push(lamp(body,0,.99,l*.33,'#e82319',.38,.045));
  const plateText=isBmw?'34 UA 4014':v.kind==='corolla'?'COROLLA':v.kind==='van'?'TRANSIT':'DURAN';
  panel(body,plateText,0,.44,-l/2-.09,.62,.15,{fg:'#151b21',bg:'#e6e8e1',size:75}).rotation.y=Math.PI;
  panel(body,plateText,0,.47,l/2+.09,.64,.15,{fg:'#151b21',bg:'#e6e8e1',size:75});
  const frame=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(w+.22,h+.18,l+.22)),new T.LineBasicMaterial({color:v.boxColor,depthTest:false,transparent:true,opacity:.8}));
  frame.position.y=h/2+.1;frame.renderOrder=5;group.add(frame);
  const groundFrame=line(group,[[-w/2-.2,-l/2-.2],[w/2+.2,-l/2-.2],[w/2+.2,l/2+.2],[-w/2-.2,l/2+.2],[-w/2-.2,-l/2-.2]],v.boxColor,.08);
  const tag=label(group,v.short,0,h+.7,0,v.boxColor,4.8);
  const pick=new T.Mesh(new T.BoxGeometry(w,h,l),new T.MeshBasicMaterial({visible:false}));pick.position.y=h/2;pick.userData.id=v.id;group.add(pick);
  return {group,body,cabin,lamps,beams,wheels,frame,groundFrame,tag,pick};
}
function makeObject(o) {
  const group=new T.Group(),lamps=[];
  if(o.type==='light') {
    cylinder(group,0,1.9,0,.073,3.8,'#919991');box(group,0,3.55,0,.51,1.45,.32,'#e0dfcd');box(group,0,3.55,.17,.43,1.35,.07,'#202525');
    for(let i=0;i<3;i++){
      const color=['#ff3030','#ffbc1c','#25d57a'][i],mat=new T.MeshStandardMaterial({color:'#242c26',emissive:color,emissiveIntensity:0,toneMapped:false});
      const lens=new T.Mesh(new T.CircleGeometry(.165,24),mat);lens.position.set(0,3.99-i*.43,.215);group.add(lens);lamps.push(lens);
      box(group,0,4.19-i*.43,.27,.37,.035,.22,'#272c29');
    }
    const hood=box(group,0,4.24,.15,.56,.055,.53,'#2c302c');hood.castShadow=true;
    if(o.id==='fatih-light-right'){
      cylinder(group,0,3.45,0,.10,6.9,'#929a93');
      box(group,-3.3,6.9,0,6.6,.10,.10,'#929a93');
      box(group,-6.0,6.22,0,.52,1.48,.32,'#222726');
      for(let i=0;i<3;i++){
        const color=['#ff3030','#ffbc1c','#25d57a'][i],mat=new T.MeshStandardMaterial({color:'#242c26',emissive:color,emissiveIntensity:0,toneMapped:false});
        const lens=new T.Mesh(new T.CircleGeometry(.17,24),mat);lens.position.set(-6,6.66-i*.43,.18);group.add(lens);lamps.push(lens);
      }
      panel(group,'Fatih Sokak',-1.5,6.65,.07,1.5,.38,{fg:'#fff',bg:'#8e3837'});
    }
  } else if(o.type==='stop') {
    cylinder(group,0,1.52,0,.05,3.04,'#999d95');
    const outer=new T.Mesh(new T.CircleGeometry(.49,8),new T.MeshStandardMaterial({color:'#f4efde',side:T.DoubleSide}));outer.rotation.z=Math.PI/8;outer.position.set(0,2.92,0);group.add(outer);
    const inner=new T.Mesh(new T.CircleGeometry(.441,8),new T.MeshBasicMaterial({color:'#bb3932',side:T.DoubleSide}));inner.rotation.z=Math.PI/8;inner.position.set(0,2.92,.007);group.add(inner);
    panel(group,'DUR',0,2.92,.015,.73,.4,{fg:'#fff',bg:null,size:120});
    const turn=panel(group,'↱',0,1.95,.01,.72,.72,{fg:'#b43831',bg:'#efeddf',border:true,size:170});
    turn.userData.note='Fotoğraftaki dönüş yasağı için temsili levha';
  } else if(o.type==='direction') {
    cylinder(group,0,2.7,0,.06,5.4,'#939a92');
    panel(group,'← Acıbadem',0,5.2,.03,2.25,.55,{fg:'#29372d',bg:'#e7e7d9',border:true});
    panel(group,'Çevreyolu',0,4.67,.03,2.25,.5,{fg:'#fff',bg:'#235694',border:true});
    panel(group,'← Avrasya Tüneli',0,4.10,.03,2.25,.55,{fg:'#fff',bg:'#3b8864',border:true});
  } else if(o.type==='chevron') {
    cylinder(group,0,.95,0,.055,1.9,'#8d968e');
    panel(group,'⌃\n⌃',0,1.42,.02,.76,1.3,{fg:'#e4d331',bg:'#242b26',size:115,w:256,h:512});
  } else if(o.type==='cabinet') {
    box(group,0,.70,0,1.02,1.4,.56,'#b5b9a9');panel(group,'ELEKTRİK',0,.82,.29,.75,.20,{fg:'#6e786c',bg:null,size:80});
  }
  group.traverse(obj=>{if(obj.isMesh)obj.userData.id=o.id;});
  return {group,lamps};
}
function disposeGroup(group) {
  group.traverse(o=>{
    if(o.geometry && o.geometry!==cube)o.geometry.dispose();
    if(o.material && ![...materials.values()].includes(o.material)) {o.material.map?.dispose();o.material.dispose();}
  });group.removeFromParent();
}

export class SceneView {
  constructor(container,project) {
    this.container=container;this.project=project;this.time=0;this.mode='driver';this.follow=true;
    this.scene=new T.Scene();this.scene.background=new T.Color('#080e1a');this.scene.fog=new T.Fog('#080e1a',140,380);
    this.renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.domElement.setAttribute('aria-label','3D kavşak sahnesi');this.renderer.domElement.tabIndex=0;container.append(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight('#6a85ab','#37342f',.72));
    const sun=new T.DirectionalLight('#afc9ec',.60);sun.position.set(-65,115,70);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-145,right:145,top:165,bottom:-165,near:1,far:400});sun.shadow.normalBias=.07;sun.shadow.bias=-.0003;sun.target.position.set(0,0,70);this.scene.add(sun,sun.target);
    for(const [x,z] of [[-5,5],[7,-17],[-5,40],[7,70],[-5,105],[7,142],[-5,178],[7,216]]){
      const light=new T.PointLight('#ffdf9d',35,32,1.5);light.position.set(x,8,z);this.scene.add(light);
    }
    this.bird=new T.OrthographicCamera(-50,50,50,-50,.1,700);this.bird.up.set(0,0,-1);
    this.perspective=new T.PerspectiveCamera(62,1,.08,700);this.camera=this.bird;
    this.controls=new OrbitControls(this.bird,this.renderer.domElement);this.controls.enableRotate=false;this.controls.enableDamping=false;this.controls.minZoom=.25;this.controls.maxZoom=8;
    this.controls.target.set(0,0,120);this.bird.position.set(0,180,120);
    this.controls.addEventListener('start',()=>{this.follow=false;this.onManualCamera?.();});
    this.world=buildWorld(project.params);this.scene.add(this.world.root);
    this.actors=new Map();this.props=new Map();this.annotations=new T.Group();this.scene.add(this.annotations);
    this.paths=new T.Group();this.scene.add(this.paths);this.raycaster=new T.Raycaster();this.ndc=new T.Vector2();
    this.contactMarker=new T.Mesh(new T.RingGeometry(.25,.36,48),new T.MeshBasicMaterial({color:'#ca3c27',side:T.DoubleSide}));this.contactMarker.rotation.x=-Math.PI/2;this.contactMarker.position.set(0,.11,.9);this.scene.add(this.contactMarker);
    this.syncProject(project,true);this.resize();this.setMode('driver');
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  }
  resize() {
    const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;
    this.renderer.setSize(w,h);const aspect=w/h,extent=49;
    this.bird.left=-extent*aspect;this.bird.right=extent*aspect;this.bird.top=extent;this.bird.bottom=-extent;this.bird.updateProjectionMatrix();
    this.perspective.aspect=aspect;this.perspective.updateProjectionMatrix();
  }
  syncProject(project,initial=false) {
    const oldWidth=this.project.params.laneWidth;this.project=project;
    if(!initial && oldWidth!==project.params.laneWidth){disposeGroup(this.world.root);this.world=buildWorld(project.params);this.scene.add(this.world.root);}
    for(const actor of this.actors.values())disposeGroup(actor.group);this.actors.clear();
    for(const v of project.vehicles){const actor=makeCar(v);this.scene.add(actor.group);this.actors.set(v.id,actor);}
    for(const prop of this.props.values())disposeGroup(prop.group);this.props.clear();
    for(const o of project.objects){const prop=makeObject(o);this.scene.add(prop.group);this.props.set(o.id,prop);}
    this.rebuildAnnotations();this.rebuildPaths();
  }
  rebuildPaths() {
    disposeGroup(this.paths);this.paths=new T.Group();this.scene.add(this.paths);
    for(const id of ['bmw','corolla','transit']) {
      const points=[];for(let t=0;t<=duration(this.project);t+=.09){const p=poseAt(id,t,this.project);points.push([p.x,p.z]);}
      line(this.paths,points,this.project.vehicles.find(v=>v.id===id).boxColor,.095);
    }
  }
  setMode(mode) {
    this.mode=mode;this.controls.dispose();
    this.camera=mode==='bird'?this.bird:this.perspective;
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=false;
    this.controls.minDistance=7;this.controls.maxDistance=320;this.controls.minZoom=.25;this.controls.maxZoom=8;
    this.controls.enableRotate=mode==='orbit';this.controls.enabled=mode!=='driver';
    this.controls.maxPolarAngle=Math.PI/2-.02;
    this.controls.addEventListener('start',()=>{this.follow=false;this.onManualCamera?.();});
    const p=poseAt('bmw',this.time,this.project);
    if(mode==='bird'){this.bird.zoom=1;this.bird.position.set(p.x,180,p.z-22);this.controls.target.set(p.x,0,p.z-22);}
    if(mode==='orbit'){this.perspective.position.set(p.x-27,40,p.z+28);this.controls.target.set(p.x,0,p.z-16);}
    this.follow=true;this.controls.update();
  }
  overview() {
    this.setMode('bird');this.follow=false;this.bird.zoom=.41;this.bird.updateProjectionMatrix();
    this.bird.position.set(0,220,90);this.controls.target.set(0,0,90);this.controls.update();
  }
  focus(id) {
    const p=this.project.vehicles.some(v=>v.id===id)?poseAt(id,this.time,this.project):this.project.objects.find(o=>o.id===id);
    if(!p)return;this.follow=false;
    if(this.mode==='driver')this.setMode('bird');this.follow=false;
    if(this.mode==='bird'){this.bird.position.set(p.x,180,p.z);this.bird.zoom=1.5;this.bird.updateProjectionMatrix();}
    else this.perspective.position.set(p.x+22,23,p.z+25);
    this.controls.target.set(p.x,0,p.z);this.controls.update();
  }
  rebuildAnnotations(preview=null) {
    disposeGroup(this.annotations);this.annotations=new T.Group();this.scene.add(this.annotations);
    const list=preview?[...this.project.annotations,preview]:this.project.annotations;
    for(const a of list) {
      const g=new T.Group();g.userData.annotation=a;this.annotations.add(g);const pts=a.points;if(!pts.length)continue;
      if(a.type==='note')label(g,a.text,pts[0][0],1.8,pts[0][1],a.color,Math.max(4,a.text.length*.15));
      else if(a.type==='rect' && pts.length>1) {
        const s=pts[0],e=pts.at(-1);line(g,[s,[e[0],s[1]],e,[s[0],e[1]],s],a.color,.22);
      } else {
        line(g,pts,a.color,.22);
        if(a.type==='arrow'&&pts.length>1) {
          const s=pts[0],e=pts.at(-1),angle=Math.atan2(e[1]-s[1],e[0]-s[0]),len=Math.min(2,Math.hypot(e[0]-s[0],e[1]-s[1])*.3);
          line(g,[[e[0]-Math.cos(angle-.48)*len,e[1]-Math.sin(angle-.48)*len],e,[e[0]-Math.cos(angle+.48)*len,e[1]-Math.sin(angle+.48)*len]],a.color,.22);
        }
        if(a.type==='measure'&&pts.length>1) {
          const s=pts[0],e=pts.at(-1),d=Math.hypot(e[0]-s[0],e[1]-s[1]);
          label(g,`${d.toFixed(2)} m · model`,(s[0]+e[0])/2,.9,(s[1]+e[1])/2,a.color,4.8);
        }
      }
    }
  }
  pick(clientX,clientY) {
    this.setRay(clientX,clientY);
    const targets=[...this.actors.values()].map(a=>a.pick).concat([...this.props.values()].map(p=>p.group));
    const hits=this.raycaster.intersectObjects(targets,true);
    return hits.find(h=>h.object.userData.id)?.object.userData.id??null;
  }
  setRay(x,y) {
    const r=this.renderer.domElement.getBoundingClientRect();this.ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.ndc,this.camera);
  }
  groundPoint(x,y) {
    this.setRay(x,y);const point=new T.Vector3();
    if(!this.raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.05),point))return null;
    if(Math.abs(point.x)>1000||Math.abs(point.z)>1000)return null;
    // Refine the projection against the modeled uphill surface.
    for(let i=0;i<3;i++)this.raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-groundHeight(point.x,point.z)-.05),point);
    return [point.x,point.z];
  }
  render(t,selected,settings={}) {
    this.time=t;const project=this.project,p=project.params;
    for(const v of project.vehicles) {
      const a=this.actors.get(v.id),pose=poseAt(v.id,t,project);a.group.position.set(pose.x,groundHeight(pose.x,pose.z),pose.z);a.group.rotation.y=pose.heading;
      a.frame.visible=!!settings.boxes;a.groundFrame.visible=!!settings.boxes;a.tag.visible=!!settings.labels&&this.mode!=='driver';
      a.frame.material.depthTest=this.mode==='driver';
      a.tag.material.sizeAttenuation=this.mode!=='driver';
      a.tag.scale.set(this.mode==='driver'?.17:7,this.mode==='driver'?.028:7/6,1);
      a.frame.material.color.set(v.id===selected?'#ffe400':v.boxColor);a.frame.material.opacity=v.id===selected?1:.65;
      a.cabin.visible=!(this.mode==='driver'&&v.id==='bmw');
      const flash=blink(t,p.indicatorPeriod);
      for(const side of ['left','right'])for(const l of a.lamps[side]){
        const on=flash&&(pose.signal===side||pose.signal==='hazard');l.material.emissiveIntensity=on?4:0;l.material.color.set(on?'#ffae00':'#724d13');
      }
      for(const l of a.lamps.brake)l.material.emissiveIntensity=pose.brake?3:.15;
      const high=v.id==='bmw'&&highBeamAt(t,project);
      for(const l of a.lamps.head)l.material.emissiveIntensity=high?7:2;
      for(const beam of a.beams){beam.intensity=high?1000:210;beam.angle=high?.22:.34;}
      const wheelSpin=-pose.z/.32;for(const wheel of a.wheels)wheel.rotation.x=wheelSpin;
      if(this.mode==='driver'&&v.id==='bmw'){a.tag.visible=false;a.frame.visible=false;a.groundFrame.visible=false;}
    }
    for(const o of project.objects) {
      const a=this.props.get(o.id);a.group.position.set(o.x,groundHeight(o.x,o.z),o.z);a.group.rotation.y=o.heading;
      if(o.type==='light')a.lamps.forEach((lens,i)=>{
        const index=i%3,on=blink(t,p.flashPeriod)&&(o.mode==='red'?index===0:index===1);
        lens.material.emissiveIntensity=on?3:0;lens.material.color.set(on?(index===0?'#ff3830':'#ffd32c'):'#202925');
      });
    }
    this.annotations.children.forEach(g=>{const a=g.userData.annotation;g.visible=t>=a.start&&t<=a.end;});
    this.paths.visible=!!settings.paths;this.world.buildings.visible=settings.buildings!==false;
    this.contactMarker.visible=t>=p.collisionTime&&t<p.collisionTime+1.2;
    const pose=poseAt('bmw',t,project);
    if(this.mode==='driver') {
      const cos=Math.cos(pose.heading),sin=Math.sin(pose.heading),x=pose.x-.37*cos-.15*sin,z=pose.z+.37*sin-.15*cos;
      this.perspective.position.set(x,1.22+groundHeight(x,z),z);
      this.perspective.lookAt(x-sin*60,1.1,z-cos*60);
    } else if(this.follow) {
      const target=new T.Vector3(pose.x,0,pose.z-22);
      const delta=target.clone().sub(this.controls.target);this.camera.position.add(delta);this.controls.target.copy(target);
    }
    if(this.mode!=='driver')this.controls.update();this.renderer.render(this.scene,this.camera);
  }
  projectToScreen(x,z,y=0) {
    const point=new T.Vector3(x,y,z).project(this.camera),r=this.renderer.domElement.getBoundingClientRect();return {x:(point.x+1)*r.width/2+r.left,y:(1-point.y)*r.height/2+r.top};
  }
}
