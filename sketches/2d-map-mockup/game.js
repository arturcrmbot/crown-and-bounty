'use strict';
const cv=$('map'),ctx=cv.getContext('2d');cv.width=VW*T;cv.height=VH*T;ctx.imageSmoothingEnabled=false;
const say=t=>{$('status').textContent=t};
const MAXMP=16,COST={R:1,B:1,G:1.5,F:2.5},WAGE={Peasants:1,Militia:3,Archers:5};
const S={day:1,gold:1500,lead:120,mp:MAXMP,hx:7,hy:30,fx:7,fy:30,face:1,path:null,goal:null,moving:false,t:0,prev:null,mill:0,army:[['Peasants',40],['Militia',15]]};
const week=()=>Math.ceil(S.day/7);
const EXP=new Uint8Array(W*H);
function reveal(cx,cy,r){for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(x>=0&&y>=0&&x<W&&y<H&&(x-cx)**2+(y-cy)**2<=r*r+1)EXP[y*W+x]=1}
reveal(9,31,8);reveal(7,27,5);
const objAt=(x,y)=>OBJ.find(o=>!o.gone&&o.x===x&&o.y===y);
const pass=(x,y)=>{const t=at(x,y);return t!=='W'&&t!=='M'&&!BLK[y*W+x]&&EXP[y*W+x]===1};
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function findPath(sx,sy,gx,gy){
  if(!pass(gx,gy))return null;
  const N=W*H,dist=new Float32Array(N).fill(1e9),prev=new Int32Array(N).fill(-1),done=new Uint8Array(N),s=sy*W+sx,g=gy*W+gx,open=[s];dist[s]=0;
  while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(dist[open[i]]<dist[open[bi]])bi=i;
    const cur=open[bi];open[bi]=open[open.length-1];open.pop();if(done[cur])continue;done[cur]=1;if(cur===g)break;
    const cx=cur%W,cy=(cur/W)|0;
    for(const[dx,dy]of DIRS){const nx=cx+dx,ny=cy+dy;if(!pass(nx,ny))continue;const ni=ny*W+nx;if(done[ni])continue;
      if(ni!==g&&objAt(nx,ny))continue;if(dx&&dy&&(!pass(cx+dx,cy)||!pass(cx,cy+dy)))continue;
      const nd=dist[cur]+COST[at(nx,ny)]*(dx&&dy?1.41:1);if(nd<dist[ni]){dist[ni]=nd;prev[ni]=cur;open.push(ni)}}}
  if(g===s||prev[g]<0)return null;
  const path=[];for(let c=g;c!==s;c=prev[c])path.unshift({x:c%W,y:(c/W)|0,sc:dist[c]-dist[prev[c]]});
  return path;
}

function R(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function line(x0,y0,x1,y1,c){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;ctx.fillStyle=c;for(;;){ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}
let time=0;
const shadow=(sx,sy)=>R(sx+2,sy-3,12,2,'rgba(0,0,0,.3)');
function glint(x,y,ph){const k=(time*.8+ph)%2.5;if(k<.3){const a=k<.15?1:2;R(x,y-a,1,a*2+1,'#fff');R(x-a,y,a*2+1,1,'#fff')}}
function tower(x,b,w,h,st,rf,ph,own){
  R(x,b-h,w,h,st[1]);R(x,b-h,2,h,st[2]);R(x+w-2,b-h,2,h,st[0]);for(let y=b-h+5;y<b;y+=5)R(x+2,y,w-4,1,st[0]);
  const cx=x+(w>>1);R(cx-1,b-h+6,2,4,'#140e08');
  for(let r=0;r<w;r++){const hw=1+Math.round(r*(w+2)/2/w);R(cx-hw,b-h-w+r,hw,1,rf[1]);R(cx,b-h-w+r,hw,1,rf[0])}
  const top=b-h-w,fc=own?['#d02a2a','#ff7060']:['#2f5fe0','#90b8ff'];R(cx,top-7,1,8,'#3a2a1a');
  for(let i=0;i<6;i++){const yo=Math.round(Math.sin(time*6+i*.9+ph));R(cx+1+i,top-7+yo,1,4,fc[0]);R(cx+1+i,top-7+yo,1,1,fc[1])}
}
function castle(sx,sy,own){
  const st=own?['#454140','#6a6663','#8a8680']:['#66665e','#9a9a8e','#c2c2b4'],rf=own?['#6a1010','#b83030']:['#1a3a8a','#3a6ad8'],L=sx-16,B=sy;
  tower(L+16,B-8,16,44,st,rf,0,own);
  R(L+1,B-26,46,26,st[1]);let k=0;for(let y=B-26;y<B;y+=4,k++){R(L+1,y,46,1,st[0]);for(let x=L+1+(k%2?3:0);x<L+47;x+=6)R(x,y+1,1,3,st[0])}
  R(L+1,B-27,46,1,st[2]);for(let x=L+1;x<L+47;x+=4)R(x,B-30,2,3,st[1]);
  tower(L-1,B,13,38,st,rf,1.3,own);tower(L+36,B,13,38,st,rf,2.1,own);
  R(sx+3,B-13,10,13,'#1a120a');R(sx+4,B-14,8,1,'#1a120a');for(let i=0;i<4;i++)R(sx+4+i*2,B-13,1,13,'#6a5a44');R(sx+3,B-9,10,1,'#6a5a44');
}
function mill(sx,sy){
  const cx=sx+8,top=sy-26;shadow(sx,sy);
  for(let r=0;r<22;r++){const hw=4+Math.round(r*2/22);R(cx-hw,top+4+r,hw*2,1,r%5===0?'#c8b890':'#e6dcc0');R(cx+hw-2,top+4+r,2,1,'#b8a880')}
  for(let r=0;r<6;r++)R(cx-1-r,top-2+r,(r+1)*2,1,r<2?'#8a5030':'#6a3a20');
  R(cx-2,sy-8,4,6,'#4a2a14');R(cx-1,top+10,2,3,'#2a1a0a');
  const a=time*1.3,hx=cx,hy=top+3;
  for(let i=0;i<4;i++){const an=a+i*Math.PI/2,dx=Math.cos(an),dy=Math.sin(an);
    for(let t=2;t<=15;t++){const X=hx+dx*t,Y=hy+dy*t;if(t>4)for(let s=1;s<=3;s++)R(Math.round(X-dy*s),Math.round(Y+dx*s),1,1,(t+s)%4?'#efe6d0':'#b8a888');R(Math.round(X),Math.round(Y),1,1,'#4a2e16')}}
  R(hx-1,hy-1,3,3,'#3a2210');
}
function hut(sx,sy){
  const L=sx+1,B=sy-1,tim='#4a3018';shadow(sx,sy+1);
  R(L+1,B-8,13,8,'#dccaa0');R(L+1,B-8,13,1,tim);R(L+1,B-1,13,1,tim);R(L+1,B-8,1,8,tim);R(L+13,B-8,1,8,tim);R(L+7,B-8,1,8,tim);
  R(L+3,B-6,3,6,'#4a2a12');R(L+9,B-6,3,3,'#2a1a0a');
  for(let r=0;r<7;r++)R(L+6-r,B-15+r,(r+1)*2+1,1,r%2?'#c89a40':'#a87a28');
  line(L+15,B-13,L+15,B-1,'#6a4a2a');line(L+13,B-12,L+16,B-8,'#e8d8b0');
}
function sign(sx,sy){R(sx+7,sy-13,2,12,'#5a3a1c');R(sx+2,sy-15,11,5,'#a87a44');R(sx+2,sy-15,11,1,'#d0a060');R(sx+2,sy-11,11,1,'#5a3a1c');R(sx+13,sy-14,1,3,'#a87a44');R(sx+14,sy-13,1,1,'#a87a44');R(sx+4,sy-13,7,1,'#4a2a10')}
function drawObj(o,sx,sy){
  const b=ph=>Math.sin(time*3+ph)>.5?1:0;
  switch(o.k){
    case'castle':castle(sx,sy,o.own);break;
    case'mill':mill(sx,sy);break;
    case'hut':hut(sx,sy);break;
    case'sign':sign(sx,sy);break;
    case'chest':shadow(sx,sy);ctx.drawImage(SP.chest,sx+2,sy-11);glint(sx+11,sy-10,o.x*.37);break;
    case'gold':shadow(sx,sy);ctx.drawImage(SP.gold,sx+3,sy-8);glint(sx+8,sy-8,o.y*.53);break;
    case'wolves':shadow(sx,sy);ctx.drawImage(SP.wolf,sx+4,sy-13+b(1));ctx.drawImage(SP.wolf,sx,sy-9-b(2));break;
    case'goblins':shadow(sx,sy);for(const[ox,oy,p]of[[5,-13,0],[0,-10,1.7],[9,-9,3.1]])ctx.drawImage(SP.gob,sx+ox,sy+oy-b(p));break;
  }
}
function drawHero(sx,sy){shadow(sx,sy);const b=S.moving&&Math.sin(time*25)>0?1:0;ctx.drawImage(S.face<0?SP.heroL:SP.hero,sx,sy-16-b)}

let camX=0,camY=0,hov=null;
function updCam(snap){const tx=Math.max(0,Math.min(W*T-VW*T,S.fx*T+8-VW*T/2)),ty=Math.max(0,Math.min(H*T-VH*T,S.fy*T+8-VH*T/2));if(snap){camX=tx;camY=ty}else{camX+=(tx-camX)*.12;camY+=(ty-camY)*.12}}
function render(){
  const cx=Math.round(camX),cy=Math.round(camY),x0=Math.floor(cx/T),y0=Math.floor(cy/T);
  ctx.drawImage(terr,cx,cy,VW*T,VH*T,0,0,VW*T,VH*T);
  for(let ty=y0;ty<=y0+VH;ty++)for(let tx=x0;tx<=x0+VW;tx++){if(at(tx,ty)!=='W')continue;
    for(let k=0;k<2;k++)if(Math.sin(time*2.2+hash(tx,ty,31+k)*6.283)>.8)R(tx*T+2+(hash(tx,ty,41+k)*10|0)-cx,ty*T+3+(hash(tx,ty,51+k)*10|0)-cy,3,1,'#bfe0ff')}
  if(S.path){let acc=0;S.path.forEach((p,i)=>{acc+=p.sc;const c=acc<=S.mp+1e-6?'#4cff4c':'#ff5040',x=p.x*T-cx,y=p.y*T-cy;
    if(i===S.path.length-1){line(x+4,y+5,x+11,y+12,'#000');line(x+4,y+12,x+11,y+5,'#000');line(x+4,y+4,x+11,y+11,c);line(x+4,y+11,x+11,y+4,c)}
    else{R(x+6,y+7,4,4,'#000');R(x+6,y+6,3,3,c)}})}
  const list=[];
  for(const o of OBJ)if(!o.gone&&o.x>=x0-3&&o.x<=x0+VW+3&&o.y>=y0-1&&o.y<=y0+VH+4)list.push([o.y,()=>drawObj(o,o.x*T-cx,o.y*T+T-cy)]);
  list.push([S.fy+.01,()=>drawHero(Math.round(S.fx*T)-cx,Math.round(S.fy*T)+T-cy)]);
  list.sort((a,b)=>a[0]-b[0]).forEach(e=>e[1]());
  for(let ty=y0;ty<=y0+VH;ty++)for(let tx=x0;tx<=x0+VW;tx++){const px=tx*T-cx,py=ty*T-cy;
    if(tx<0||ty<0||tx>=W||ty>=H||!EXP[ty*W+tx]){R(px,py,T,T,'#000');continue}
    let edge=false;for(let dy=-1;dy<=1&&!edge;dy++)for(let dx=-1;dx<=1;dx++){const nx=tx+dx,ny=ty+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H&&!EXP[ny*W+nx]){edge=true;break}}
    if(edge)ctx.drawImage(dith,px,py)}
  if(hov&&!dlgOpen()&&EXP[hov[1]*W+hov[0]]){const px=hov[0]*T-cx,py=hov[1]*T-cy,c='#ffe680';
    R(px,py,4,1,c);R(px,py,1,4,c);R(px+12,py,4,1,c);R(px+15,py,1,4,c);R(px,py+15,4,1,c);R(px,py+12,1,4,c);R(px+12,py+15,4,1,c);R(px+15,py+12,1,4,c)}
}

function update(dt){
  if(S.moving){const n=S.path[0];
    if(S.t===0){if(n.sc>S.mp+1e-6){S.moving=false;say('Your horse is spent. End the day to rest.')}else if(n.x!==S.hx)S.face=n.x>S.hx?1:-1}
    if(S.moving){S.t+=dt*7;
      if(S.t>=1){S.t=0;S.mp-=n.sc;S.prev=[S.hx,S.hy];S.hx=n.x;S.hy=n.y;S.path.shift();reveal(S.hx,S.hy,6);
        if(!S.path.length){S.moving=false;S.path=null;S.goal=null;const o=objAt(S.hx,S.hy);if(o)visit(o)}ui()}}}
  const m=S.moving&&S.path&&S.path.length?S.path[0]:null;
  S.fx=m?S.hx+(m.x-S.hx)*S.t:S.hx;S.fy=m?S.hy+(m.y-S.hy)*S.t:S.hy;
}

const dlgOpen=()=>$('dlg').classList.contains('on');
function dlg(title,html,choices){$('dt').textContent=title;$('dp').innerHTML=html;const dc=$('dc');dc.innerHTML='';
  for(const[l,f]of choices){const b=document.createElement('button');b.textContent=l;b.onclick=()=>{$('dlg').classList.remove('on');if(f)f();ui()};dc.appendChild(b)}
  $('dlg').classList.add('on')}
const later=(t,h)=>dlg(t,h,[['Onwards',null]]);
const addTroop=(n,c)=>{const a=S.army.find(r=>r[0]===n);if(a)a[1]+=c;else S.army.push([n,c]);S.army=S.army.filter(r=>r[1]>0)};
const back=()=>{if(S.prev){S.hx=S.prev[0];S.hy=S.prev[1]}};
function visit(o){
  const k=o.k;
  if(k==='chest'){const g=800+Math.floor(hash(o.x,o.y,3)*6)*100;
    dlg('A treasure chest',`You pry the lid off. Inside: <b>${g} gold</b>.<br>Keep it, or hand it out to the villagers so they sing your praises across the province?`,
      [[`Keep ${g} gold`,()=>{S.gold+=g;o.gone=1}],[`Hand it out (+${g/20} leadership)`,()=>{S.lead+=g/20;o.gone=1}]])}
  else if(k==='gold'){const g=300+Math.floor(hash(o.x,o.y,4)*4)*50;S.gold+=g;o.gone=1;later('Gold!',`Someone left in a hurry. You pocket <b>${g} gold</b>.`)}
  else if(k==='wolves')dlg('Zounds! Wolves!','About <b>20 wolves</b> are sitting on the road like they own it. Your peasants are holding their pitchforks the wrong way round.',
      [['Charge!',()=>{o.gone=1;addTroop('Peasants',-7);S.gold+=300;later('Victory!','The pack scatters into the woods. You lost <b>7 Peasants</b> and found <b>300 gold</b> the wolves were, somehow, guarding.')}],['Back away',back]]);
  else if(k==='goblins')dlg('Zounds! Goblins!','Some <b>35 goblins</b> have built a toll booth across the road. The toll is "everything".',
      [['Pay in steel',()=>{o.gone=1;addTroop('Militia',-5);S.gold+=500;later('Victory!',"The toll booth is firewood now. You lost <b>5 Militia</b> and recovered <b>500 gold</b> of other people's tolls.")}],['Back away',back]]);
  else if(k==='hut'){const c=480;dlg("Archers' Cottage",o.done?'"All out of archers, officer. Come back next week."':`"We shoot straight and we charge by the arrow," says the foreman. <b>12 Archers</b> will join you for <b>${c} gold</b>.`,
      o.done?[['Next week, then',null]]:[[`Recruit (${c} gold)`,()=>{if(S.gold>=c){S.gold-=c;addTroop('Archers',12);o.done=1}else later("Archers' Cottage",'"That\'s not enough gold, officer."')}],['Not today',null]])}
  else if(k==='mill'){if(S.mill===week())later('Windmill','The miller shakes his head. "Next week, officer. Flour doesn\'t grind itself."');
    else{S.mill=week();S.gold+=250;later('Windmill','The miller leans out of the window. "Flour for the King\'s men!" He also slips you <b>250 gold</b>. You don\'t ask.')}}
  else if(k==='sign')later('A signpost','EAST: The Old Bridge.<br>NORTH-EAST: Baron Grimsby, who owes the Crown three years of taxes and one goose.');
  else if(k==='castle'&&!o.own)later("The King's Castle",'The steward looks your army up and down. "His Majesty expects results, officer, not sightseeing."');
  else if(k==='castle')dlg('Castle Grimsby','The Baron shouts from the battlements: "I have the goose AND the walls! Come back with a bigger army!"<br><i>(Sieges come in a later mockup.)</i>',[["We'll be back",back]]);
}

function ui(){$('day').textContent=S.day;$('gold').textContent=S.gold.toLocaleString();$('lead').textContent=S.lead;
  $('mpbar').style.width=Math.max(0,S.mp/MAXMP*100)+'%';$('army').innerHTML=S.army.map(([n,c])=>`<li><span>${n}</span><b>${c}</b></li>`).join('')}
const mini=$('mini'),mc=mini.getContext('2d');mini.width=W*2;mini.height=H*2;
const MC={G:'#3a8429',F:'#205a1a',M:'#7a6a50',W:'#2350a2',R:'#a07544',B:'#8a5a2a'};
function drawMini(){mc.fillStyle='#000';mc.fillRect(0,0,mini.width,mini.height);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(EXP[y*W+x]){mc.fillStyle=MC[at(x,y)];mc.fillRect(x*2,y*2,2,2)}
  for(const o of OBJ)if(!o.gone&&EXP[o.y*W+o.x]){mc.fillStyle=o.k==='castle'?(o.own?'#e03030':'#3a6af0'):(o.k==='wolves'||o.k==='goblins')?'#ff8040':'#ffe060';mc.fillRect(o.x*2-1,o.y*2-1,3,3)}
  mc.fillStyle='#fff';mc.fillRect(S.hx*2-1,S.hy*2-1,3,3);mc.strokeStyle='#ffe680';mc.strokeRect(Math.round(camX/8)+.5,Math.round(camY/8)+.5,VW*2-1,VH*2-1)}
$('portrait').getContext('2d').drawImage(SP.baron,0,0);

const TN={G:'Grassland',F:'Forest',M:'Mountains',W:'Water',R:'Road',B:'The Old Bridge'};
function tileAt(e){const r=cv.getBoundingClientRect();return[Math.floor(((e.clientX-r.left)*cv.width/r.width+Math.round(camX))/T),Math.floor(((e.clientY-r.top)*cv.height/r.height+Math.round(camY))/T)]}
function describe(x,y){if(x<0||y<0||x>=W||y>=H)return'';if(!EXP[y*W+x])return'Uncharted lands';const c=COV[y*W+x];if(c&&!c.gone)return c.name;
  if(x===S.hx&&y===S.hy)return'Sir Aldric, Officer of the Crown';return TN[at(x,y)]}
cv.addEventListener('mousemove',e=>{hov=tileAt(e);if(!dlgOpen())say(describe(hov[0],hov[1]))});
cv.addEventListener('mouseleave',()=>{hov=null});
cv.addEventListener('click',e=>{startMusic();if(dlgOpen()||S.moving)return;let[x,y]=tileAt(e);if(x<0||y<0||x>=W||y>=H)return;
  const c=COV[y*W+x];if(c&&!c.gone){x=c.x;y=c.y}
  if(!EXP[y*W+x]){say('You cannot see what lies there.');return}
  if(S.goal&&S.goal[0]===x&&S.goal[1]===y){S.moving=true;S.t=0;return}
  if(x===S.hx&&y===S.hy){const o=objAt(x,y);if(o)visit(o);return}
  const p=findPath(S.hx,S.hy,x,y);S.path=p;S.goal=p?[x,y]:null;
  if(!p)say('No way through.');else say(p.reduce((s,q)=>s+q.sc,0)<=S.mp?'Click again to ride there.':'Too far for today. Red marks are for tomorrow.')});
$('endday').onclick=()=>{if(S.moving||dlgOpen())return;S.day++;S.mp=MAXMP;
  if(S.day%7===1){const pay=1000,wage=S.army.reduce((s,[n,c])=>s+c*(WAGE[n]||1),0);S.gold+=pay-wage;OBJ.forEach(o=>{if(o.k==='hut')o.done=0});
    later(`Week ${week()} begins`,`A royal courier brings your commission: <b>${pay} gold</b>.<br>Your troops take <b>${wage} gold</b> in wages. The cottage has fresh archers.`)}
  else say(`Day ${S.day}. Your horse is rested.`);ui()};

let AC=null,master=null,musicOn=false,touched=false,loopT=null;
const NF=m=>440*Math.pow(2,(m-69)/12);
const MEL=[[74,2],[69,1],[65,1],[67,1],[69,1],[72,2],[69,1],[67,3],[65,1],[67,1],[69,1],[74,2],[72,1],[69,1],[67,1],[64,1],[62,3]],BAS=[50,50,53,48,50,53,48,50];
function note(t,f,d,type,vol){const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(master);o.start(t);o.stop(t+d+.05)}
function schedule(t0){const b=.3;let t=t0;for(const[m,n]of MEL){note(t,NF(m),n*b*.95,'square',.04);t+=n*b}
  BAS.forEach((r,i)=>{const tb=t0+i*3*b;note(tb,NF(r),b*.9,'triangle',.16);note(tb+b,NF(r+19),b*.5,'triangle',.05);note(tb+2*b,NF(r+19),b*.5,'triangle',.05)});
  loopT=setTimeout(()=>{if(musicOn)schedule(t0+24*b)},(t0+24*b-AC.currentTime-.4)*1000)}
function setMusic(on){touched=true;musicOn=on;$('music').innerHTML=on?'&#9834; On':'&#9834; Off';clearTimeout(loopT);
  if(on){AC=AC||new(window.AudioContext||window.webkitAudioContext)();AC.resume();master=AC.createGain();const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;master.connect(lp);lp.connect(AC.destination);schedule(AC.currentTime+.1)}
  else if(master){master.disconnect();master=null}}
function startMusic(){if(!touched)setMusic(true)}
$('music').onclick=()=>setMusic(!musicOn);

function fit(){const f=$('frame'),s=Math.max(.25,Math.min((f.clientWidth-6)/cv.width,(f.clientHeight-6)/cv.height));cv.style.width=Math.floor(cv.width*s)+'px';cv.style.height=Math.floor(cv.height*s)+'px'}
new ResizeObserver(fit).observe($('frame'));fit();
let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;time+=dt;update(dt);updCam(false);render();requestAnimationFrame(frame)}
updCam(true);ui();drawMini();setInterval(drawMini,250);requestAnimationFrame(frame);
dlg('By Order of the King','Sir Aldric, Officer of the Crown: bring <b>Baron Grimsby</b> to justice before His Majesty runs out of patience. You have <b>100 days</b>.',[['For the Crown!',startMusic]]);
