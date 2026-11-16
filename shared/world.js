'use strict';
// ===== NÚCLEO DEL BOSQUE: terreno, colisiones, misión de 29 papeles, movimiento, IA del monstruo (sin gráficos) =====
const WR=66,PR=.35,CELL=8,ACC=11,DEC=16,NPAPERS=29;
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(20261115),rr=(a,b)=>a+R()*(b-a),hyp=Math.hypot,clampN=(v,a,b)=>Math.max(a,Math.min(b,v));
const sm=(a,b,x)=>{const t=clampN((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function H(x,z){const r=hyp(x,z);let h=1.7*Math.sin(x*.06+1)*Math.cos(z*.05)+.9*Math.sin(x*.13+z*.09)+.45*Math.sin(x*.27-z*.21);h*=sm(2,16,r)*.85+.15;return h+Math.max(0,r-54)*.14}
const PATHS=[[[-62,12],[-35,6],[-10,-4],[12,3],[38,-8],[62,-2]],[[2,-62],[8,-38],[-2,-14],[0,0],[14,26],[8,48],[-6,62]]],CLEAR=[[0,0,10],[-35,-32,9],[38,34,9],[32,-38,8],[-40,38,8]],HID=[[-52,-8],[50,12],[-14,52]];
function dseg(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clampN(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return hyp(x-a[0]-dx*t,z-a[1]-dz*t)}
function dpath(x,z){let m=1e9;for(const p of PATHS)for(let i=1;i<p.length;i++)m=Math.min(m,dseg(x,z,p[i-1],p[i]));return m}
const circles=[],grid=new Map(),trees=[],rocks=[],logs=[],bushes=[],grass=[],thick=[],PAPERS=[];
const free=(x,z,r)=>{for(const c of circles)if(hyp(x-c.x,z-c.z)<c.r+r)return false;return true};
const addC=(x,z,r,k)=>{const c={x,z,r,k};circles.push(c);return c};
// matorrales densos alrededor de las zonas ocultas (con una entrada)
for(const h of HID){const gap=R()*6.283;for(let i=0;i<16;i++){const a=i/16*6.283;if(Math.abs(Math.atan2(Math.sin(a-gap),Math.cos(a-gap)))<.38)continue;const x=h[0]+Math.cos(a)*6,z=h[1]+Math.sin(a)*6;addC(x,z,.9,'thicket');thick.push({x,z,s:rr(1,1.3)})}}
for(let t=0;t<30&&rocks.length<26;t++){const r=rr(.8,1.8),a=R()*6.283,d=Math.sqrt(R())*(WR-8),x=Math.cos(a)*d,z=Math.sin(a)*d;if(dpath(x,z)<r+2.4||CLEAR[0]&&hyp(x,z)<12||HID.some(h=>hyp(x-h[0],z-h[1])<8)||!free(x,z,r+.6))continue;addC(x,z,r,'rock');rocks.push({x,z,r,rot:R()*6})}
for(let t=0;t<200&&logs.length<14;t++){const L=rr(3,4.5),a=R()*6.283,d=Math.sqrt(R())*(WR-10),x=Math.cos(a)*d,z=Math.sin(a)*d,ang=R()*3.14;if(dpath(x,z)<3.2||hyp(x,z)<11||HID.some(h=>hyp(x-h[0],z-h[1])<8))continue;const pts=[];for(let s=-L/2+.4;s<=L/2-.3;s+=.9)pts.push([x+Math.cos(ang)*s,z+Math.sin(ang)*s]);if(!pts.every(p=>free(p[0],p[1],.4+.6)))continue;pts.forEach(p=>addC(p[0],p[1],.4,'log'));logs.push({x,z,L,ang})}
for(let t=0;t<30000&&trees.length<330;t++){const a=R()*6.283,d=Math.sqrt(R())*(WR-6),x=Math.cos(a)*d,z=Math.sin(a)*d;if(dpath(x,z)<2.6||CLEAR.some(c=>hyp(x-c[0],z-c[1])<c[2]+1)||HID.some(h=>hyp(x-h[0],z-h[1])<7))continue;const s=rr(.8,1.7),r=.28*s+.12;if(!free(x,z,r+.9))continue;addC(x,z,r,'tree');trees.push({x,z,s,r,t:R()<.7?0:1,rot:R()*6.28})}
for(let t=0;t<2000&&trees.filter(q=>hyp(q.x,q.z)>WR-3).length<110;t++){const a=R()*6.283,d=WR-2+rr(-1.5,2.5),x=Math.cos(a)*d,z=Math.sin(a)*d,s=rr(1.1,1.8),r=.28*s+.12;if(!free(x,z,r+.35))continue;addC(x,z,r,'tree');trees.push({x,z,s,r,t:R()<.6?0:1,rot:R()*6.28})}
for(let t=0;t<2000&&bushes.length<170;t++){const a=R()*6.283,d=Math.sqrt(R())*(WR-4),x=Math.cos(a)*d,z=Math.sin(a)*d;if(dpath(x,z)<1.6)continue;bushes.push({x,z,s:rr(.7,1.4)})}
for(let t=0;t<900;t++){const a=R()*6.283,d=Math.sqrt(R())*(WR-2),x=Math.cos(a)*d,z=Math.sin(a)*d;if(dpath(x,z)<1.4)continue;grass.push({x,z,s:rr(.6,1.3)})}
for(const c of circles){const i0=Math.floor((c.x-c.r)/CELL),i1=Math.floor((c.x+c.r)/CELL),j0=Math.floor((c.z-c.r)/CELL),j1=Math.floor((c.z+c.r)/CELL);for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=i+','+j;(grid.get(k)||grid.set(k,[]).get(k)).push(c)}}
function near(x,z){const i=Math.floor(x/CELL),j=Math.floor(z/CELL),o=[];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const g=grid.get((i+a)+','+(j+b));if(g)for(const c of g)if(!o.includes(c))o.push(c)}return o}
function resolve(x,z,r){for(let k=0;k<4;k++){for(const c of near(x,z)){const dx=x-c.x,dz=z-c.z,d=hyp(dx,dz),m=c.r+r;if(d<m){const e=d>1e-6?1/d:0;x=c.x+(d>1e-6?dx*e:1)*m;z=c.z+(d>1e-6?dz*e:0)*m}}const d=hyp(x,z);if(d>WR-r){x*=(WR-r)/d;z*=(WR-r)/d}}return{x,z}}
const freeM=(x,z,r)=>near(x,z).every(c=>hyp(x-c.x,z-c.z)>=c.r+r);
function los(ax,az,bx,bz){const d=hyp(bx-ax,bz-az),n=Math.ceil(d/1.2);for(let i=1;i<n;i++){const t=i/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;for(const c of near(x,z))if(c.k!=='thicket'&&hyp(x-c.x,z-c.z)<c.r)return false}return true}
// ---- 29 papeles exactos ----
function placeP(cx,cz,sp,minD=5){for(let t=0;t<400;t++){const a=R()*6.283,d=Math.sqrt(R())*sp,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(hyp(x,z)>WR-6||!free(x,z,.7)||PAPERS.some(p=>hyp(p.x-x,p.z-z)<minD))continue;PAPERS.push({id:PAPERS.length,x,z,y:H(x,z)+.03,rot:R()*6.28,found:false});return true}return false}
for(let i=1;i<CLEAR.length;i++){placeP(CLEAR[i][0],CLEAR[i][1],CLEAR[i][2]-2,3);placeP(CLEAR[i][0],CLEAR[i][1],CLEAR[i][2]-2,3)}
for(const h of HID){placeP(h[0],h[1],3.5,2);placeP(h[0],h[1],3.5,2)}
for(const p of PATHS)for(const f of[.18,.5,.82]){const L=[];let tot=0;for(let i=1;i<p.length;i++){const l=hyp(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);L.push(l);tot+=l}let d=tot*f,i=0;while(d>L[i])d-=L[i++];const a=p[i],b=p[i+1]||p[i],t=d/L[i];placeP(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,2.2,3)}
for(let t=0;t<4000&&PAPERS.length<NPAPERS;t++){const a=R()*6.283,d=Math.sqrt(R())*(WR-10);placeP(Math.cos(a)*d,Math.sin(a)*d,.01,9)}
// ---- movimiento suave y alternancia de correr ----
const mkPlayer=()=>({x:0,z:6,y:H(0,6),vx:0,vz:0,yaw:Math.PI,run:false,flash:false,captured:false,found:0});
function toggleRun(p,repeat){if(!repeat)p.run=!p.run}
function movePlayer(p,inp,dt){if(p.captured){p.vx=p.vz=0;return}let ix=inp.ix,iy=inp.iy;const l=hyp(ix,iy);if(l>1){ix/=l;iy/=l}const sp=(p.sp||(p.run?5:2.4))*(iy<0?.7:1),fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw),rx=Math.cos(p.yaw),rz=-Math.sin(p.yaw),tx=(fx*iy+rx*ix)*sp,tz=(fz*iy+rz*ix)*sp,dvx=tx-p.vx,dvz=tz-p.vz,dl=hyp(dvx,dvz),ac=(l>.05?ACC:DEC)*dt;
 if(dl<=ac){p.vx=tx;p.vz=tz}else{p.vx+=dvx/dl*ac;p.vz+=dvz/dl*ac}
 let r=resolve(p.x+p.vx*dt,p.z+p.vz*dt,PR);if(!freeM(r.x,r.z,PR-.01))r={x:p.x,z:p.z};const d=hyp(r.x-p.x,r.z-p.z);if(d>1e-6&&(H(r.x,r.z)-H(p.x,p.z))/d>1.1){p.vx=p.vz=0}else{if(dt>0){p.vx=(r.x-p.x)/dt;p.vz=(r.z-p.z)/dt}p.x=r.x;p.z=r.z}p.y=H(p.x,p.z)}
function pickPaper(p){let b=null,bd=2.2;for(const q of PAPERS){if(q.found)continue;const d=hyp(q.x-p.x,q.z-p.z),fx=-Math.sin(p.yaw),fz=-Math.cos(p.yaw);if(d<bd&&(d<1.1||((q.x-p.x)*fx+(q.z-p.z)*fz)/d>.35)){bd=d;b=q}}return b}
function collect(q){if(!q||q.found)return false;q.found=true;return true}
const found=()=>PAPERS.filter(q=>q.found).length;
// ---- IA del monstruo: gone → appear → stalk → search → chase → capture ----
const M={x:0,z:0,y:0,rot:0,st:'gone',t:0,cool:50,app:0,tx:0,tz:0,aware:0,lookT:0,lost:0,chaseT:0,capT:0,stuck:0,esc:0,last:[0,0],mv:0};
function steer(m,tx,tz,sp,dt){const a0=Math.atan2(tx-m.x,tz-m.z);let best=a0;if(m.esc>0){m.esc-=dt;best=a0+m.escA}else for(const o of[0,.45,-.45,.9,-.9,1.4,-1.4,2,-2]){const a=a0+o;if(freeM(m.x+Math.sin(a)*1.4,m.z+Math.cos(a)*1.4,.6)){best=a;break}}
 let da=best-m.rot;da=Math.atan2(Math.sin(da),Math.cos(da));m.rot+=da*Math.min(1,dt*8);const ox=m.x,oz=m.z,r=resolve(m.x+Math.sin(m.rot)*sp*dt,m.z+Math.cos(m.rot)*sp*dt,.55);m.x=r.x;m.z=r.z;m.y=H(m.x,m.z);m.mv=hyp(m.x-ox,m.z-oz)/Math.max(dt,1e-6);
 if(sp>0&&m.mv<sp*.25){m.stuck+=dt;if(m.stuck>1.2){m.stuck=0;m.esc=1.2;m.escA=(Math.random()<.5?-1:1)*rr(1.2,2.4)}}else m.stuck=0}
const facing=(p,x,z,deg)=>{const dx=x-p.x,dz=z-p.z,d=hyp(dx,dz)||1;return(dx*-Math.sin(p.yaw)+dz*-Math.cos(p.yaw))/d>Math.cos(deg*Math.PI/180)};
function beginAppear(p,ev){for(let t=0;t<30;t++){const a=Math.random()*6.283,d=22+Math.random()*12,x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d;if(hyp(x,z)<WR-4&&freeM(x,z,.8)){M.x=x;M.z=z;M.y=H(x,z);M.st='appear';M.t=5+Math.random()*4;M.lookT=0;M.aware=0;M.app++;ev('appear');return}}M.cool=3}
function beginStalk(p,ev){for(let t=0;t<30;t++){const a=Math.random()*6.283,d=26+Math.random()*8,x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d;if(hyp(x,z)<WR-4&&freeM(x,z,.8)){M.x=x;M.z=z;M.y=H(x,z);M.st='stalk';M.t=45+Math.random()*30;M.lookT=0;M.aware=0;ev('appear');return}}M.cool=3}
function vanish(ev,cool){M.st='gone';M.cool=cool;M.lookT=0;M.aware=0;ev('vanish')}
function startChase(ev,p){M.st='chase';M.chaseT=0;M.lost=0;M.aware=0;if(p)M.last=[p.x,p.z];ev('chase')}
function mNoise(x,z,r,ev){if((M.st==='stalk'||M.st==='appear'||M.st==='search'||(M.st==='gone'&&M.cool<18))&&hyp(M.x-x,M.z-z)<r+(M.st==='gone'?18:0)){if(M.st==='gone'){beginStalk({x,z},ev);}M.st='search';M.tx=x;M.tz=z;M.t=0;ev('search')}}
function mUpdate(dt,p,cx){const ev=cx.ev||(()=>{}),dx=p.x-M.x,dz=p.z-M.z,d=hyp(dx,dz),see=()=>los(M.x,M.z,p.x,p.z),
 sensed=()=>{if(p.captured)return false;if(d<7)return true;if(!see())return false;return(p.run&&d<22)||(p.flash&&d<24)||d<12},sc=Math.min(.5,cx.papers*.02);M.mv=0;
 switch(M.st){
 case'gone':M.cool-=dt;if(M.cool<=0&&cx.time>45&&!p.captured){if((cx.papers>=4||M.app>=2)&&Math.random()<.45)beginStalk(p,ev);else beginAppear(p,ev)}break;
 case'appear':M.rot=Math.atan2(dx,dz);M.t-=dt;M.lookT=facing(p,M.x,M.z,22)&&d<48&&see()?M.lookT+dt:Math.max(0,M.lookT-dt*.5);if(d<11)startChase(ev,p);else if(M.lookT>2.4||M.t<=0)vanish(ev,(28+Math.random()*32)/(1+cx.papers*.03));break;
 case'stalk':M.t-=dt;if(d>15)steer(M,p.x,p.z,1.9,dt);else M.rot=Math.atan2(dx,dz);M.lookT=facing(p,M.x,M.z,20)&&d<30&&see()?M.lookT+dt:Math.max(0,M.lookT-dt*.5);
  if(sensed())M.aware+=dt;else M.aware=Math.max(0,M.aware-dt*.5);if(M.aware>1.2)startChase(ev,p);else if(M.lookT>1.8||M.t<=0)vanish(ev,25+Math.random()*25);break;
 case'search':{const td=hyp(M.tx-M.x,M.tz-M.z);if(td>2&&M.t<=0)steer(M,M.tx,M.tz,2.6,dt);else{M.t+=td>2?0:dt;if(M.t<=0)M.t=.01;if(M.t>4)vanish(ev,18+Math.random()*20)}if(sensed())M.aware+=dt;else M.aware=Math.max(0,M.aware-dt*.5);if(M.aware>1)startChase(ev,p);break}
 case'chase':{M.chaseT+=dt;const s=sensed();if(s){M.lost=0;M.last=[p.x,p.z]}else M.lost+=dt;steer(M,s?p.x:M.last[0],s?p.z:M.last[1],4.2+sc,dt);
  if(d<1.15&&!p.captured){M.st='capture';M.capT=0;p.captured=true;ev('capture')}else if(M.lost>7){M.st='search';M.tx=M.last[0];M.tz=M.last[1];M.t=0;ev('search')}else if(M.chaseT>60&&d>25)vanish(ev,30);break}
 case'capture':M.capT+=dt;M.rot=Math.atan2(dx,dz);if(M.capT>=4.6){p.captured=false;ev('captureEnd');vanish(ev,75)}break}}
const snapshot=()=>({f:PAPERS.filter(q=>q.found).map(q=>q.id),m:{x:+M.x.toFixed(2),z:+M.z.toFixed(2),r:+M.rot.toFixed(2),s:M.st}});
function applySnapshot(s){PAPERS.forEach(q=>q.found=s.f.includes(q.id));Object.assign(M,{x:s.m.x,z:s.m.z,rot:s.m.r,st:s.m.s})}
if(typeof module!=='undefined')module.exports={WR,PR,H,PAPERS,circles,trees,rocks,logs,near,resolve,freeM,los,mkPlayer,toggleRun,movePlayer,pickPaper,collect,found,M,mUpdate,mNoise,snapshot,applySnapshot,beginAppear,startChase,dpath,CLEAR,HID,PATHS,ACC,DEC,NPAPERS};
