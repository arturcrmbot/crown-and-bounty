'use strict';
const T=16,VW=20,VH=15,W=56,H=40;
const $=id=>document.getElementById(id);
window.onerror=(m,s,l)=>{const e=$('status');e.textContent='ERROR: '+m+' ('+(s||'').split('/').pop()+':'+l+')';e.style.color='#ff7070'};

function hash(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function vnoise(x,y,sc,s){const fx=x/sc,fy=y/sc,xi=Math.floor(fx),yi=Math.floor(fy),u=fx-xi,v=fy-yi,a=hash(xi,yi,s),b=hash(xi+1,yi,s),c=hash(xi,yi+1,s),d=hash(xi+1,yi+1,s),su=u*u*(3-2*u),sv=v*v*(3-2*v);return a+(b-a)*su+(c-a)*sv+(a-b-c+d)*su*sv}

const ter=new Array(W*H).fill('G');
const at=(x,y)=>(x<0||y<0||x>=W||y>=H)?'M':ter[y*W+x];
const set=(x,y,v)=>{if(x>=0&&y>=0&&x<W&&y<H)ter[y*W+x]=v};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const m=vnoise(x,y,6,1)*.7+vnoise(x,y,2.5,2)*.3,f=vnoise(x,y,5,3)*.7+vnoise(x,y,2,4)*.3;
  if(x<1||y<1||x>=W-1||y>=H-1||m>.67)set(x,y,'M');else if(f>.58)set(x,y,'F');
}
const riverX=y=>Math.round(30+4*Math.sin(y/5)+2*Math.sin(y/2.3));
for(let y=0;y<H;y++){const cx=riverX(y);set(cx,y,'W');set(cx+1,y,'W')}
for(let y=25;y<38;y++)for(let x=39;x<54;x++)if(Math.hypot((x-46)/1.4,y-31)<3.2+vnoise(x,y,2,7)*1.5)set(x,y,'W');
const ROAD=[[7,30],[7,33],[19,33],[19,26],[38,26],[38,15],[46,15],[46,13]];
for(let i=0;i<ROAD.length-1;i++){let[x,y]=ROAD[i];const[x2,y2]=ROAD[i+1];for(;;){set(x,y,at(x,y)==='W'||at(x,y)==='B'?'B':'R');if(x===x2&&y===y2)break;x+=Math.sign(x2-x);y+=Math.sign(y2-y)}}

const OBJ=[
  {k:'castle',x:7,y:29,w:3,h:3,own:0,name:"The King's Castle"},
  {k:'castle',x:46,y:12,w:3,h:3,own:1,name:'Castle Grimsby'},
  {k:'mill',x:12,y:31,w:1,h:2,name:'Windmill'},
  {k:'hut',x:15,y:31,name:"Archers' Cottage"},
  {k:'sign',x:20,y:32,name:'Signpost'},
  {k:'chest',x:10,y:35,name:'Treasure chest'},
  {k:'chest',x:22,y:23,name:'Treasure chest'},
  {k:'chest',x:35,y:21,name:'Treasure chest'},
  {k:'gold',x:16,y:35,name:'Pile of gold'},
  {k:'gold',x:41,y:21,name:'Pile of gold'},
  {k:'wolves',x:23,y:26,name:'A pack of wolves (about 20)'},
  {k:'goblins',x:38,y:19,name:'Zounds! Goblins (about 35)'},
];
const foot=o=>{const w=o.w||1,h=o.h||1,x0=o.x-((w-1)>>1),r=[];for(let y=o.y-h+1;y<=o.y;y++)for(let x=x0;x<x0+w;x++)r.push([x,y]);return r};
for(const o of OBJ)for(const[x,y]of foot(o))for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const X=x+dx,Y=y+dy,t=at(X,Y);if((t==='M'||t==='F')&&X>0&&Y>0&&X<W-1&&Y<H-1)set(X,Y,'G')}
const BLK=new Uint8Array(W*H),COV=new Array(W*H).fill(null);
for(const o of OBJ)for(const[x,y]of foot(o)){COV[y*W+x]=o;if(x!==o.x||y!==o.y)BLK[y*W+x]=1}
const isGate=(x,y)=>OBJ.some(o=>o.k==='castle'&&o.x===x&&o.y===y);

function mk(rows,pal){const c=document.createElement('canvas');c.width=rows[0].length;c.height=rows.length;const g=c.getContext('2d');rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(pal[ch]){g.fillStyle=pal[ch];g.fillRect(x,y,1,1)}}));return c}
function flipc(c){const f=document.createElement('canvas');f.width=c.width;f.height=c.height;const g=f.getContext('2d');g.translate(c.width,0);g.scale(-1,1);g.drawImage(c,0,0);return f}
const SP={
  hero:mk(["...p..r.........","...pbrss........","...pbBsss.......","...pb.sks.......","...p..sss...oo..","...p.bbBbb.owwo.","...p.bbbbbowwwwo","...p.sbbbsowwowo","..oooooooooowwoo",".owwwwwwwwwwwo..",".owgwwwwwwwwgo..","..owgggwwwgggo..","..ow.o...ow.o...","..ow.o...ow.o...","..oh.oh..oh.oh.."],
    {o:'#1a1410',w:'#f2eee2',g:'#b8b0a0',b:'#2a50c0',B:'#6a96f0',s:'#c8ccd8',k:'#f0c090',r:'#d82020',h:'#3a3028',p:'#6a4a2a'}),
  chest:mk([".ooooooooo.","oWWyWWWyWWo","owwywwwywwo","oYYYYkYYYYo","owwywwwywwo","owwywwwywwo","oYYYYYYYYYo",".ooooooooo."],
    {o:'#1e120a',w:'#8a5426',W:'#b07236',y:'#f0c848',Y:'#a07818',k:'#2a1a0a'}),
  gold:mk(["....oo....","...oyYo...","..oyyYyo..",".oydyyYdo.","oyydyyydyo","oooooooooo"],{o:'#5a4008',d:'#b08818',y:'#e8c030',Y:'#fff0a0'}),
  wolf:mk([".o.o.........","oggo.........","oegggoooooo.o",".oggggggggggo","..ogglllgggo.","..odo...odo..","..odo...odo..","..oo....oo..."],
    {o:'#201818',g:'#8c8c94',l:'#c4c4cc',d:'#5a5a62',e:'#ff4040'}),
  gob:mk(["..ooo.p",".oGGGop","oGeGeGp",".oGGGop",".occcoG","oGcccop",".occco.",".oG.Go.",".oo.oo."],
    {o:'#10200a',G:'#5aa040',e:'#ffe040',c:'#8a4a2a',p:'#d0d0d0'}),
  oak:mk(["...oooo...",".oo4433oo.","o44333322o","o43333222o","o33332222o",".o332222o.","..oo22oo..","....tt....","....tt...."],
    {o:'#153d12','2':'#2c6e22','3':'#4a9a34','4':'#6cbc46',t:'#4a2e14'}),
  pine:mk(["...o...","..o3o..",".o332o.","..o3o..",".o332o.","o33322o",".o332o.","o33222o","o32222o",".ooooo.","...t...","...t..."],
    {o:'#123612','2':'#23602a','3':'#2f7a36',t:'#4a2e14'}),
  baron:mk(["....oooooooo....","...ohhhhhhhho...","...ohhhhhhhho...","..oHHHHHHHHHHo..","..okkkkkkkkkko..",".okkwekkkkMwMko.",".okkkkknnkkMMko.",".okkkkknnkkkkko.",".okKmmmmmmmmKko.",".okmm.kkkk.mmko.","..okkkkkkkkkko..","..oKkkkkkkkkKo..","...oKKkkkkKKo...","..occcccccccco..",".oCCccccccccCCo.",".occcccccccccco."],
    {o:'#1a1008',k:'#e8b088',K:'#c08060',h:'#6a1a1a',H:'#e8c040',m:'#3a2a1a',w:'#ffffff',e:'#101010',M:'#e8c040',c:'#402060',C:'#6a3a9a',n:'#d86a5a'}),
};
SP.heroL=flipc(SP.hero);

const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const P=(...a)=>a.map(hex);
const PG=P('#2b6420','#3a8429','#4c9e33','#69b844'),PF=P('#24561c','#2f6a22','#3c7e2a','#4f9434'),PD=P('#6a4624','#845a30','#a07544','#bd955e'),
  PW=P('#173a80','#2350a2','#3468c0','#5a8ede'),PK=P('#4e4030','#65543c','#7e6a4c','#998462'),PWD=P('#4e3218','#74492a','#946238'),
  PFL=P('#f6e46a','#fbfbf0','#e87aa0'),SAND=hex('#cdb27a'),FOAM=hex('#e6f2ff');
const q4=v=>v<.34?0:v<.5?1:v<.68?2:3;
const wet=t=>t==='W'||t==='B';
function pix(wx,wy){
  const tx=wx>>4,ty=wy>>4,lx=wx&15,ly=wy&15,t=at(tx,ty),n=hash(wx,wy,5),v=vnoise(wx,wy,5,9)*.72+n*.28;
  if(wet(t)){
    if(t==='B'&&ly>=2&&ly<=13)return(ly===2||ly===13||lx%4===0)?PWD[0]:PWD[1+(((lx>>2)+tx)&1)];
    const d=Math.min(wet(at(tx-1,ty))?99:lx,wet(at(tx+1,ty))?99:15-lx,wet(at(tx,ty-1))?99:ly,wet(at(tx,ty+1))?99:15-ly)+(n-.5)*1.6;
    if(d<1.1)return SAND;if(d<2.3)return FOAM;
    return PW[q4((.5+.5*Math.sin(wx*.35+wy*.9+v*5))*.6+v*.4)];
  }
  if(t==='R'){const rd=(x,y)=>{const u=at(x,y);return u==='R'||u==='B'||isGate(x,y)};
    const d=Math.min(rd(tx-1,ty)?99:lx,rd(tx+1,ty)?99:15-lx,rd(tx,ty-1)?99:ly,rd(tx,ty+1)?99:15-ly);
    return d+(n-.5)*3<3?PG[q4(v)]:PD[q4(v)]}
  if(t==='M')return PK[q4(v)];
  if(t==='F')return PF[q4(v)];
  const fl=hash(wx,wy,77);if(fl>.994)return PFL[(fl*1e4|0)%3];
  return PG[q4(v)];
}
function mountain(c,cx,by,w,h,seed){
  for(let r=0;r<h;r++){const hw=Math.round((r+1)*w/2/h),y=by-h+r;
    for(let x=-hw;x<=hw;x++){const n=hash(cx+x,y,seed);let col;
      if(x===-hw||x===hw)col='#2e2620';
      else if(r<h*.3+(n-.5)*2)col=x<1?'#f4f4ee':'#c4c8d2';
      else col=x<(n-.5)*2?(n>.75?'#b4a892':'#978a74'):(n>.75?'#72665a':'#5a4f42');
      c.fillStyle=col;c.fillRect(cx+x,y,1,1)}}
}
const terr=document.createElement('canvas');terr.width=W*T;terr.height=H*T;
{
  const tc=terr.getContext('2d'),img=tc.createImageData(W*T,H*T),d=img.data;
  for(let wy=0;wy<H*T;wy++)for(let wx=0;wx<W*T;wx++){const c=pix(wx,wy),i=(wy*W*T+wx)*4;d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255}
  tc.putImageData(img,0,0);
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=at(tx,ty),X=tx*T,Y=ty*T;
    if(t==='F')for(const[ox,oy,s]of[[1,-3,21],[8,0,22],[3,4,23]]){const h=hash(tx,ty,s);tc.drawImage(h>.45?SP.oak:SP.pine,X+ox+(h*3|0),Y+oy+((h*7|0)%3))}
    if(t==='M'){const h=hash(tx,ty,61);mountain(tc,X+8+((h*5|0)-2),Y+16,18+(h*6|0),16+(hash(tx,ty,62)*9|0),tx*7+ty)}
  }
}
const dith=document.createElement('canvas');dith.width=dith.height=T;
{const g=dith.getContext('2d');g.fillStyle='#000';for(let y=0;y<T;y++)for(let x=0;x<T;x++)if((x+y)%2===0)g.fillRect(x,y,1,1)}
