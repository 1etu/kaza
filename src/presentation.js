// Pause lengths use wall time, independent of the chosen playback rate.
export class Presentation {
  constructor(){this.hold=null;this.seen=new Set();}
  reset(time,cues){this.hold=null;this.seen=new Set(cues.filter(c=>c.t<time-.001).map(c=>c.id));}
  cancel(){this.hold=null;}
  advance(time,dt,rate,cues,enabled=true){
    if(this.hold){
      this.hold.remaining-=dt;
      if(this.hold.remaining<=0)this.hold=null;
      return time;
    }
    const next=time+dt*rate;
    if(enabled&&rate>0){
      const cue=cues.find(c=>!this.seen.has(c.id)&&c.t>=time-.001&&c.t<=next);
      if(cue){this.seen.add(cue.id);this.hold={...cue,remaining:2};return cue.t;}
    }
    if(rate<0)for(const cue of cues)if(cue.t>next)this.seen.delete(cue.id);
    return next;
  }
}

export class VideoExport {
  constructor(onFinish){this.active=false;this.onFinish=onFinish;this.parts=[];}
  start(){
    if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('Bu tarayıcı video kaydını desteklemiyor. Chrome veya Edge ile açın.');
    this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;this.ctx=this.canvas.getContext('2d');
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
    if(!mime)throw new Error('WebM video kaydı bu tarayıcıda desteklenmiyor.');
    this.stream=this.canvas.captureStream(30);this.parts=[];
    this.recorder=new MediaRecorder(this.stream,{mimeType:mime,videoBitsPerSecond:8500000});
    this.recorder.ondataavailable=e=>{if(e.data.size)this.parts.push(e.data);};
    this.recorder.onstop=()=>{const blob=new Blob(this.parts,{type:'video/webm'});this.stream.getTracks().forEach(t=>t.stop());this.active=false;this.onFinish(blob);};
    this.recorder.start(1000);this.active=true;this.started=performance.now();
  }
  stop(){if(this.recorder?.state==='recording')this.recorder.stop();}
  draw(source,hold,photo,headlight,time){
    if(!this.active)return;const c=this.ctx,w=1920,h=1080;
    c.fillStyle='#080e1a';c.fillRect(0,0,w,h);
    const scale=Math.min(w/source.width,h/source.height),sw=source.width*scale,sh=source.height*scale;
    c.drawImage(source,(w-sw)/2,(h-sh)/2,sw,sh);
    c.font='22px Arial';c.fillStyle='#dbe2ee';c.fillText(`t = ${time.toFixed(2)} s`,24,h-24);
    c.font='16px Arial';c.fillStyle='#abb2c0';c.fillText('Harita: © OpenStreetMap contributors',w-335,h-22);
    if(headlight){c.fillStyle='#75b7ff';c.font='bold 25px Arial';c.fillText('SELEKTÖR',w/2-65,h-40);}
    if(!hold)return;
    const x=310,width=1300,top=hold.photo?370:775,height=hold.photo?640:205;
    c.fillStyle='#f5f5ef';c.fillRect(x,top,width,height);
    c.fillStyle='#1b1e23';c.font='bold 32px Arial';c.fillText(hold.title,x+28,top+46);
    c.font='27px Arial';let line='',y=top+91;
    for(const word of hold.text.split(' ')){const next=line+word+' ';if(c.measureText(next).width>width-56){c.fillText(line,x+28,y);y+=36;line=word+' ';}else line=next;}c.fillText(line,x+28,y);
    if(hold.photo&&photo.complete){
      const py=top+190;c.drawImage(photo,x+30,py,655,455);c.drawImage(photo,740,180,135,160,x+724,py+70,260,308);
      c.fillStyle=Math.floor(performance.now()/500)%2?'#472626':'#fa2922';c.beginPath();c.arc(x+752,py+24,15,0,Math.PI*2);c.fill();
      c.fillStyle='#b1211b';c.font='bold 25px Arial';c.fillText('KIRMIZI FLAŞÖR + DUR',x+780,py+33);
      c.fillStyle='#333';c.font='20px Arial';c.fillText('Orijinal fotoğraf • olay anının kaydı değildir.',x+724,py+417,530);
    }
  }
}
