// ===== JUEGO: gráficos, monstruo, sonido, entrada e interfaz (usa el núcleo de arriba) =====
// Comprobación de WebGL: si el navegador/dispositivo no lo soporta, se muestra un mensaje claro en vez de una pantalla en blanco.
(function(){try{const c=document.createElement('canvas');if(c.getContext('webgl')||c.getContext('experimental-webgl'))return}catch(e){return}const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;z-index:99;background:#050607;color:#d8d4c4;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:Georgia,serif';d.textContent='Tu navegador o dispositivo no soporta WebGL, necesario para el juego. Prueba con Chrome o Edge actualizados y activa la aceleración por hardware.';document.body.appendChild(d)})();
const $=id=>document.getElementById(id),rand=(a,b)=>a+Math.random()*(b-a);
const QL={alta:{pr:2,sh:true,rain:900,grass:true,lod:90},media:{pr:1.5,sh:true,rain:600,grass:true,lod:75},baja:{pr:1,sh:false,rain:300,grass:false,lod:60}};
function autoQ(){try{const m=navigator.deviceMemory||4,c=navigator.hardwareConcurrency||4,t=matchMedia('(pointer:coarse)').matches;if(t&&(m<=3||c<=4))return 'baja';if(t||m<=4||c<=4)return 'media';return 'alta'}catch(e){return 'media'}}
let cfg={q:autoQ(),vol:.8,nick:'',ch:0};try{Object.assign(cfg,JSON.parse(localStorage.getItem('lus4')||'{}'))}catch(e){}
const saveCfg=()=>{try{localStorage.setItem('lus4',JSON.stringify(cfg))}catch(e){}};
addEventListener('error',e=>console.error('[LUS]',e.message));
const touch=matchMedia('(pointer:coarse)').matches;if(touch)document.body.classList.add('touch');
// ---------- Render, luces y niebla ----------
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});$('game').appendChild(renderer.domElement);
renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene(),FOGC=new THREE.Color(0x070b11),FOGL=new THREE.Color(0x2a3548);scene.background=FOGC.clone();scene.fog=new THREE.FogExp2(0x070b11,.034);
const cam=new THREE.PerspectiveCamera(75,1,.05,110);cam.rotation.order='YXZ';scene.add(cam);
const hemi=new THREE.HemisphereLight(0x4a5f88,0x10140e,.32);scene.add(hemi);const moon=new THREE.DirectionalLight(0x6f86b8,.28);moon.position.set(-30,50,20);scene.add(moon);
const flash=new THREE.SpotLight(0xffd49a,3.2,30,.42,.7,1.2);flash.shadow.mapSize.set(512,512);flash.shadow.camera.near=.3;flash.shadow.camera.far=26;scene.add(flash,flash.target);
let chunks=[],rainPts,rainPos;
function applyQ(){const q=QL[cfg.q];renderer.setPixelRatio(Math.min(devicePixelRatio,q.pr));renderer.shadowMap.enabled=q.sh;flash.castShadow=q.sh;resize();document.querySelectorAll('.qbtn').forEach(b=>b.textContent='GRÁFICOS: '+cfg.q.toUpperCase());if(rainPts){rainPts.geometry.setDrawRange(0,q.rain)}chunks.forEach(c=>c.hi.forEach(m=>m.castShadow=q.sh));scene.traverse(o=>{if(o.material&&!Array.isArray(o.material))o.material.needsUpdate=true})}
function resize(){renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}addEventListener('resize',resize);
document.querySelectorAll('.qbtn').forEach(b=>b.onclick=()=>{const k=Object.keys(QL);cfg.q=k[(k.indexOf(cfg.q)+1)%3];saveCfg();applyQ()});
$('fsb').onclick=toggleFull;$('vol').value=cfg.vol*100;$('vol').oninput=()=>{cfg.vol=$('vol').value/100;saveCfg();if(master)master.gain.value=cfg.vol};
// ---------- Texturas ----------
function ctex(w,h,draw,rx=1,ry=1){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;return t}
const groundT=ctex(128,128,(g,w)=>{g.fillStyle='#8a8a8a';g.fillRect(0,0,w,w);for(let i=0;i<1400;i++){const v=90+Math.random()*110;g.fillStyle=`rgba(${v},${v},${v},.5)`;g.fillRect(Math.random()*w,Math.random()*w,1+Math.random()*3,1+Math.random()*2)}},38,38);
const skinT=ctex(128,128,(g,w)=>{g.fillStyle='#cfc4ae';g.fillRect(0,0,w,w);for(let i=0;i<260;i++){g.fillStyle=`rgba(${60+Math.random()*60},${40+Math.random()*30},${30},${Math.random()*.25})`;g.beginPath();g.arc(Math.random()*w,Math.random()*w,2+Math.random()*9,0,7);g.fill()}g.strokeStyle='rgba(90,40,50,.35)';for(let i=0;i<24;i++){g.beginPath();let x=Math.random()*w,y=Math.random()*w;g.moveTo(x,y);for(let k=0;k<5;k++){x+=rand(-14,14);y+=rand(-14,14);g.lineTo(x,y)}g.stroke()}});
const paperT=ctex(128,160,(g,w,h)=>{g.clearRect(0,0,w,h);const pts=[];const n=26;for(let i=0;i<n;i++){const a=i/n*6.283,rx=w*.46,ry=h*.47,j=1-(Math.random()<.35?Math.random()*.1:0);pts.push([w/2+Math.cos(a)*rx*Math.min(1,1.12)*j*1.08,h/2+Math.sin(a)*ry*j*1.08])}
 g.beginPath();pts.forEach((p,i)=>{const x=Math.max(2,Math.min(w-2,p[0])),y=Math.max(2,Math.min(h-2,p[1]));i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.fillStyle='#cdb784';g.fill();g.save();g.clip();
 for(let i=0;i<60;i++){g.fillStyle=`rgba(${110+Math.random()*40},${80+Math.random()*30},40,${Math.random()*.25})`;g.beginPath();g.arc(Math.random()*w,Math.random()*h,3+Math.random()*10,0,7);g.fill()}
 g.fillStyle='rgba(40,30,20,.65)';for(let i=0;i<9;i++)g.fillRect(14,20+i*13,30+Math.random()*(w-60),2);
 const gr=g.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.62);gr.addColorStop(0,'rgba(20,10,0,0)');gr.addColorStop(.6,'rgba(40,18,4,.55)');gr.addColorStop(1,'rgba(8,4,0,.95)');g.fillStyle=gr;g.fillRect(0,0,w,h);g.restore()});
const glowT=ctex(64,64,(g,w)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,170,70,.9)');r.addColorStop(1,'rgba(255,120,30,0)');g.fillStyle=r;g.fillRect(0,0,w,w)});
// ---------- Geometrías fusionadas (para instancias) ----------
const TU={value:0};
function sway(m,amp){m.onBeforeCompile=s=>{s.uniforms.uT=TU;s.vertexShader='uniform float uT;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
float ph=instanceMatrix[3].x*.35+instanceMatrix[3].z*.27;
#else
float ph=0.;
#endif
float w=max(position.y,0.)*${amp};transformed.x+=sin(uT*1.3+ph)*w*.05+sin(uT*.7+ph*1.7)*w*.03;transformed.z+=cos(uT*1.1+ph)*w*.04;`)}}
const T4=(x,y,z,sx=1,sy=1,sz=1,rx=0,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,0,rz)),new THREE.Vector3(sx,sy,sz));
function merge(parts){const P=[],N=[],C=[];for(const p of parts){const g=p.g.index?p.g.toNonIndexed():p.g.clone();g.applyMatrix4(p.m);const pa=g.attributes.position.array,na=g.attributes.normal.array,c=new THREE.Color(p.c);for(let i=0;i<pa.length;i++){P.push(pa[i]);N.push(na[i])}for(let i=0;i<pa.length/3;i++){const j=.9+Math.random()*.2;C.push(c.r*j,c.g*j,c.b*j)}}
 const o=new THREE.BufferGeometry();o.setAttribute('position',new THREE.Float32BufferAttribute(P,3));o.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));o.setAttribute('color',new THREE.Float32BufferAttribute(C,3));return o}
const Cy=(a,b,h,s=6)=>new THREE.CylinderGeometry(a,b,h,s),Co=(r,h,s=7)=>new THREE.ConeGeometry(r,h,s);
const G={pine:merge([{g:Cy(.12,.22,2.4),c:0x3a2a1c,m:T4(0,1.2,0)},{g:Co(1.5,2.2),c:0x1a3a26,m:T4(0,3,0)},{g:Co(1.15,2),c:0x1d4a2b,m:T4(0,4.2,0)},{g:Co(.8,1.8),c:0x1a3a26,m:T4(0,5.3,0)}]),
 pineL:merge([{g:Cy(.12,.22,2.4,4),c:0x3a2a1c,m:T4(0,1.2,0)},{g:Co(1.4,4.6,5),c:0x1a3a26,m:T4(0,3.9,0)}]),
 dead:merge([{g:Cy(.08,.22,4,5),c:0x4d4640,m:T4(0,2,0)},...[0,1,2,3,4].map(i=>({g:Cy(.02,.06,1.3,4),c:0x4d4640,m:T4(Math.cos(i*1.3)*.3,2.2+i*.4,Math.sin(i*1.3)*.3,1,1,1,Math.sin(i*1.3)*.9,-Math.cos(i*1.3)*.9)}))]),
 deadL:merge([{g:Cy(.08,.22,4,4),c:0x4d4640,m:T4(0,2,0)}]),
 bush:merge([{g:new THREE.IcosahedronGeometry(.8,1),c:0x1f3a22,m:T4(0,.45,0,1,.7,1)},{g:new THREE.IcosahedronGeometry(.5,0),c:0x264a2a,m:T4(.5,.35,.2)}]),
 rock:(()=>{const g=new THREE.DodecahedronGeometry(1,0),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)*(.85+Math.random()*.3),p.getY(i)*(.6+Math.random()*.25),p.getZ(i)*(.85+Math.random()*.3));g.computeVertexNormals();return merge([{g,c:0x55585c,m:T4(0,.3,0)}])})(),
 grass:merge([0,1,2].map(i=>({g:Co(.1,.7,4),c:0x2a4a2a,m:T4(Math.cos(i*2.1)*.12,.3,Math.sin(i*2.1)*.12,1,1,1,Math.sin(i*2.1)*.25,Math.cos(i*2.1)*.25)})))};
const mTree=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),mBush=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),mRock=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95}),mGrass=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});sway(mTree,.6);sway(mBush,.35);sway(mGrass,1.6);
// ---------- Terreno ----------
{const g=new THREE.PlaneGeometry(2*WR+20,2*WR+20,100,100);g.rotateX(-Math.PI/2);const p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,H(x,z));const dp=dpath(x,z);let cl=0;for(const k of CLEAR)cl=Math.max(cl,1-Math.min(1,Math.max(0,hyp(x-k[0],z-k[1])-k[2]+2)/4));const n=.85+.3*Math.abs(Math.sin(x*.9)*Math.cos(z*.7));c.setRGB(.13,.2,.1);c.lerp(new THREE.Color(.2,.24,.12),cl*.7);c.lerp(new THREE.Color(.26,.19,.12),1-Math.min(1,Math.max(0,(dp-1.5)/1.4)));col[i*3]=c.r*n;col[i*3+1]=c.g*n;col[i*3+2]=c.b*n}
 g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:groundT}));m.receiveShadow=true;scene.add(m)}
// ---------- Bosque en chunks instanciados (culling manual + LOD) ----------
const CHK=40,NC=4,ORG=-80;
function inst(geo,mat,list,sh){if(!list.length)return null;const m=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((a,i)=>m.setMatrixAt(i,a));m.instanceMatrix.needsUpdate=true;m.frustumCulled=false;m.castShadow=sh||false;scene.add(m);m.visible=false;return m}
{const B={};const add=(k,i,j,mx)=>{((B[i+','+j]||(B[i+','+j]={}))[k]||(B[i+','+j][k]=[])).push(mx)};const ci=v=>Math.floor((v-ORG)/CHK);const E=new THREE.Euler();
 for(const t of trees){const s=t.s;add(t.t?'dead':'pine',ci(t.x),ci(t.z),T4(t.x,H(t.x,t.z)-.15,t.z,s,s,s).multiply(new THREE.Matrix4().makeRotationY(t.rot)))}
 for(const b of bushes)add('bush',ci(b.x),ci(b.z),T4(b.x,H(b.x,b.z)-.05,b.z,b.s,b.s,b.s));for(const b of thick)add('bush',ci(b.x),ci(b.z),T4(b.x,H(b.x,b.z)-.05,b.z,b.s*1.35,b.s*1.5,b.s*1.35));
 for(const r of rocks)add('rock',ci(r.x),ci(r.z),T4(r.x,H(r.x,r.z),r.z,r.r,r.r,r.r).multiply(new THREE.Matrix4().makeRotationY(r.rot)));for(const g of grass)add('grass',ci(g.x),ci(g.z),T4(g.x,H(g.x,g.z),g.z,g.s,g.s,g.s));
 for(let i=0;i<NC;i++)for(let j=0;j<NC;j++){const d=B[i+','+j]||{},c={box:new THREE.Box3(new THREE.Vector3(ORG+i*CHK,-3,ORG+j*CHK),new THREE.Vector3(ORG+(i+1)*CHK,16,ORG+(j+1)*CHK)),hi:[],lo:[],one:[],grass:[]};
  const ph=inst(G.pine,mTree,d.pine||[],true),pl=inst(G.pineL,mTree,d.pine||[]),dh=inst(G.dead,mTree,d.dead||[],true),dl=inst(G.deadL,mTree,d.dead||[]);[ph,dh].forEach(m=>m&&c.hi.push(m));[pl,dl].forEach(m=>m&&c.lo.push(m));
  [inst(G.bush,mBush,d.bush||[]),inst(G.rock,mRock,d.rock||[])].forEach(m=>m&&c.one.push(m));const gm=inst(G.grass,mGrass,d.grass||[]);if(gm)c.grass.push(gm);chunks.push(c)}}
for(const L of logs){const h1=H(L.x-Math.cos(L.ang)*L.L/2,L.z-Math.sin(L.ang)*L.L/2),h2=H(L.x+Math.cos(L.ang)*L.L/2,L.z+Math.sin(L.ang)*L.L/2),v=new THREE.Vector3(Math.cos(L.ang),(h2-h1)/L.L,Math.sin(L.ang)).normalize(),m=new THREE.Mesh(Cy(.34,.4,L.L,8),new THREE.MeshStandardMaterial({color:0x3a2e22,roughness:1}));m.position.set(L.x,(h1+h2)/2+.3,L.z);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v);m.castShadow=m.receiveShadow=true;scene.add(m)}
const frustum=new THREE.Frustum(),pvm=new THREE.Matrix4();
function cullChunks(){cam.updateMatrixWorld();pvm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);frustum.setFromProjectionMatrix(pvm);const q=QL[cfg.q];for(const c of chunks){const vis=frustum.intersectsBox(c.box),d=c.box.distanceToPoint(cam.position);const hi=vis&&d<q.lod*.55,lo=vis&&d>=q.lod*.55&&d<q.lod+20;c.hi.forEach(m=>m.visible=hi);c.lo.forEach(m=>m.visible=lo);c.one.forEach(m=>m.visible=vis&&d<q.lod);c.grass.forEach(m=>m.visible=q.grass&&vis&&d<40)}}
// ---------- Papeles ----------
const pm=new THREE.MeshStandardMaterial({map:paperT,transparent:true,alphaTest:.35,side:THREE.DoubleSide,emissive:0x552a08,emissiveMap:paperT,emissiveIntensity:.55,roughness:1});
for(const q of PAPERS){const m=new THREE.Mesh(new THREE.PlaneGeometry(.3,.38),pm);m.rotation.order='YXZ';m.rotation.set(-Math.PI/2+rand(-.12,.12),q.rot,0);m.position.set(q.x,q.y+.04,q.z);scene.add(m);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.35,fog:true}));s.scale.set(1,1,1);s.position.set(q.x,q.y+.25,q.z);scene.add(s);q.m=m;q.s=s}
// ---------- Lluvia ----------
{const g=new THREE.BufferGeometry();rainPos=new Float32Array(900*3);for(let i=0;i<900;i++){rainPos[i*3]=rand(-14,14);rainPos[i*3+1]=rand(0,16);rainPos[i*3+2]=rand(-14,14)}g.setAttribute('position',new THREE.BufferAttribute(rainPos,3));rainPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xa9b9d2,size:.06,transparent:true,opacity:.55,fog:false,depthWrite:false}));rainPts.frustumCulled=false;scene.add(rainPts)}
// ---------- Monstruo ----------
const MO=(()=>{const g=new THREE.Group(),sk=new THREE.MeshStandardMaterial({color:0xb9ad97,roughness:.92,map:skinT,emissive:0x1a140c}),dk=new THREE.MeshStandardMaterial({color:0x030101,roughness:1}),gum=new THREE.MeshStandardMaterial({color:0x4a0e0e,roughness:.6}),cl=new THREE.MeshStandardMaterial({color:0x35291d,roughness:1}),wh=new THREE.MeshStandardMaterial({color:0xe8e0c8,roughness:.4});
 const ob=(geo,m,x,y,z,par,sc)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);if(sc)o.scale.set(sc[0],sc[1],sc[2]);par.add(o);return o},gp=(x,y,z,par)=>{const o=new THREE.Group();o.position.set(x,y,z);par.add(o);return o};
 const body=gp(0,1.05,0,g),torso=gp(0,0,0,body);ob(Cy(.27,.21,.85,8),sk,0,.42,0,torso,[1,1,.68]);ob(new THREE.SphereGeometry(.18,10,8),sk,-.34,.78,0,torso,[1,.9,.9]);ob(new THREE.SphereGeometry(.17,10,8),sk,.34,.7,0,torso,[1,.9,.9]);ob(new THREE.SphereGeometry(.24,8,6),sk,.06,.72,-.14,torso,[1,.8,.8]);
 ob(new THREE.BoxGeometry(.5,.55,.3),cl,0,-.12,0,body);ob(new THREE.BoxGeometry(.5,.4,.28),sk,0,.05,0,body,[.95,.5,1]);
 const neck=gp(0,.88,.04,torso);ob(Cy(.06,.08,.3,6),sk,0,.15,0,neck);const head=gp(0,.28,.04,neck);ob(new THREE.SphereGeometry(.17,12,10),sk,0,.3,0,head,[1,2.3,1.05]);
 const mouth=ob(new THREE.SphereGeometry(.12,10,8),dk,0,.1,.14,head,[.55,1.9,.5]);ob(new THREE.SphereGeometry(.07,8,6),gum,0,.05,.12,head,[.5,1.6,.4]);
 for(let i=0;i<7;i++){ob(new THREE.BoxGeometry(.012,.026,.012),wh,-.065,.3-i*.045,.17,head);ob(new THREE.BoxGeometry(.012,.026,.012),wh,.065,.3-i*.045,.17,head)}
 const e1=ob(new THREE.SphereGeometry(.05,8,6),wh,.11,.5,.12,head),e2=ob(new THREE.SphereGeometry(.022,8,6),wh,-.08,.42,.15,head);ob(new THREE.SphereGeometry(.02,6,6),dk,.115,.5,.165,head);ob(new THREE.BoxGeometry(.16,.03,.04),sk,.07,.56,.14,head);
 const arm=(x,sg)=>{const s=gp(x,.74,0,torso),u=ob(Cy(.07,.05,.62,6),sk,0,-.31,0,s),el=gp(0,-.62,0,s);ob(Cy(.05,.04,.68,6),sk,0,-.34,0,el);ob(new THREE.SphereGeometry(.05,8,6),sk,0,-.7,0,el,[1,1.8,.7]);for(let i=-1;i<=1;i++)ob(Cy(.01,.008,.2,4),sk,i*.025,-.84,0,el);return{s,el}};
 const aL=arm(-.36),aR=arm(.36);
 const leg=x=>{const h=gp(x,0,0,body);ob(Cy(.11,.075,.58,6),sk,0,-.3,0,h);const k=gp(0,-.6,0,h);ob(Cy(.075,.05,.55,6),sk,0,-.28,0,k);ob(new THREE.BoxGeometry(.1,.07,.3),sk,0,-.6,.08,k);return{h,k}};
 const lL=leg(-.14),lR=leg(.14);g.visible=false;scene.add(g);return{g,body,torso,neck,head,mouth,aL,aR,lL,lR,e1,ph:0,mo:1,tw:0,fl:0}})();
let anT=0;
function animMonster(dt){const m=MO,st=M.st,sp=M.mv,ch=st==='chase',cp=st==='capture';m.ph+=sp*dt*(ch?1.5:1.7);anT+=dt;const s=Math.sin(m.ph),c=Math.cos(m.ph),tw=Math.sin(anT*7)*Math.sin(anT*3.1)*.04;
 const lean=cp?-.1:ch?.55:sp>.1?.18:.08,arms=cp?-2.2:ch?-1.0+s*.35:-.15+s*.25;
 m.body.rotation.x+=(lean-m.body.rotation.x)*Math.min(1,dt*6);m.body.rotation.z=.12+(ch?s*.06:tw);m.torso.rotation.z=-.1+(cp?tw*5:0);m.body.position.y=1.05-(ch?.1:0)+Math.abs(c)*(sp>.1?.04:0);
 m.lL.h.rotation.x=s*(ch?.9:.6);m.lR.h.rotation.x=-s*(ch?.9:.6)*.85;m.lL.k.rotation.x=Math.max(0,-c)*.9;m.lR.k.rotation.x=Math.max(0,c)*.7;
 m.aL.s.rotation.x+=(arms-m.aL.s.rotation.x)*Math.min(1,dt*8);m.aR.s.rotation.x+=(arms*.9+(cp?0:.1)-m.aR.s.rotation.x)*Math.min(1,dt*8);m.aL.s.rotation.z=.12+(cp?-.2:0);m.aR.s.rotation.z=-.12;m.aL.el.rotation.x=-.25+(ch?-.5:0);m.aR.el.rotation.x=-.3;
 m.tw-=dt;if(m.tw<=0){m.tw=rand(.5,2.5);m.fl=rand(-.45,.45)}m.neck.rotation.z+=(m.fl+(cp?tw*8:0)-m.neck.rotation.z)*Math.min(1,dt*5);m.neck.rotation.x+=((cp?-.8:ch?.5:.2)-m.neck.rotation.x)*Math.min(1,dt*6);
 const mt=cp?2.2+Math.sin(anT*25)*.2:ch?1.5:1;m.mo+=(mt-m.mo)*Math.min(1,dt*10);m.mouth.scale.set(.55*(.8+.2*m.mo),1.9*m.mo,.5)}
// ---------- Audio (procedural y espacial) ----------
let AC,master,bus,rev,nbuf,windG,breathG,breathP,chaseG,musT=2,whT=rand(10,20),owlT=rand(25,50),chT=.5,thT=rand(14,26),brT=0;
function loopNoise(t,fr,g){const s=AC.createBufferSource();s.buffer=nbuf;s.loop=true;const f=AC.createBiquadFilter();f.type=t;f.frequency.value=fr;const gn=AC.createGain();gn.gain.value=g;s.connect(f);f.connect(gn);gn.connect(master);s.start();return{g:gn,f}}
function initAudio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=cfg.vol;const cp=AC.createDynamicsCompressor();master.connect(cp);cp.connect(AC.destination);
 const n=AC.sampleRate*2;nbuf=AC.createBuffer(1,n,AC.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
 const len=AC.sampleRate*3,ir=AC.createBuffer(2,len,AC.sampleRate);for(let c=0;c<2;c++){const x=ir.getChannelData(c);for(let i=0;i<len;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4)}
 const cv=AC.createConvolver();cv.buffer=ir;rev=AC.createGain();rev.gain.value=.9;rev.connect(cv);const rg=AC.createGain();rg.gain.value=.5;cv.connect(rg);rg.connect(master);bus=AC.createGain();bus.gain.value=.9;bus.connect(master);bus.connect(rev);
 [[41.2,'sine',.2],[61.7,'sine',.1],[82.4,'sawtooth',.04]].forEach(a=>{const o=AC.createOscillator();o.type=a[1];o.frequency.value=a[0];const g=AC.createGain();g.gain.value=a[2];const lp=AC.createBiquadFilter();lp.frequency.value=220;const l=AC.createOscillator();l.frequency.value=.04;const lg=AC.createGain();lg.gain.value=90;l.connect(lg);lg.connect(lp.frequency);l.start();o.connect(lp);lp.connect(g);g.connect(bus);o.start()});
 windG=loopNoise('lowpass',420,.16).g;loopNoise('highpass',2800,.06);loopNoise('bandpass',1500,.025);
 breathG=AC.createGain();breathG.gain.value=0;const bs=AC.createBufferSource();bs.buffer=nbuf;bs.loop=true;const bf=AC.createBiquadFilter();bf.type='bandpass';bf.frequency.value=620;bf.Q.value=1.2;breathP=AC.createPanner();breathP.panningModel='HRTF';breathP.refDistance=2;bs.connect(bf);bf.connect(breathG);breathG.connect(breathP);breathP.connect(master);breathP.connect(rev);bs.start();
 chaseG=AC.createGain();chaseG.gain.value=0;chaseG.connect(bus);[[55,'square'],[58.3,'square'],[932,'sawtooth'],[987.8,'sawtooth']].forEach((a,i)=>{const o=AC.createOscillator();o.type=a[1];o.frequency.value=a[0];const lp=AC.createBiquadFilter();lp.frequency.value=i<2?160:2200;const g=AC.createGain();g.gain.value=i<2?.5:.12;const l=AC.createOscillator();l.frequency.value=i<2?2.3:6;const lg=AC.createGain();lg.gain.value=i<2?.4:9;l.connect(lg);lg.connect(i<2?g.gain:o.frequency);l.start();o.connect(lp);lp.connect(g);g.connect(chaseG);o.start()});
 setInterval(audioTick,250)}catch(e){console.error('[LUS] audio',e);AC=null}}
function setPos(p,x,y,z){if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z}else p.setPosition(x,y,z)}
function out(n,pos){if(pos){const p=AC.createPanner();p.panningModel='HRTF';p.refDistance=2;p.rolloffFactor=1.3;setPos(p,pos.x,pos.y,pos.z);n.connect(p);p.connect(master);p.connect(rev)}else{n.connect(master);n.connect(rev)}}
function burst(dur,type,fr,g,pos,q=1){if(!AC)return;const s=AC.createBufferSource();s.buffer=nbuf;const f=AC.createBiquadFilter();f.type=type;f.frequency.value=fr;f.Q.value=q;const gn=AC.createGain(),t=AC.currentTime;gn.gain.setValueAtTime(g,t);gn.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(gn);out(gn,pos);s.start(t,Math.random(),dur)}
function tone(f1,f2,dur,type,g,pos,dl=0){if(!AC)return;const o=AC.createOscillator(),gn=AC.createGain(),t=AC.currentTime+dl;o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur);gn.gain.setValueAtTime(g,t);gn.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(gn);out(gn,pos);o.start(t);o.stop(t+dur)}
const V3=(x,y,z)=>({x,y,z}),mpos=()=>V3(M.x,H(M.x,M.z)+1.5,M.z),around=(r0,r1)=>{const a=rand(0,6.283),r=rand(r0,r1);return V3(P.x+Math.cos(a)*r,1.3,P.z+Math.sin(a)*r)};
const stepS=run=>burst(rand(.1,.18),'bandpass',rand(800,1500),run?.32:.18,null,.8),crack=p=>{burst(.05,'highpass',rand(1800,3200),.4,p);tone(rand(300,600),120,.09,'square',.06,p)},thunder=()=>burst(3.6,'lowpass',160,.9);
function whisperS(p){if(!AC)return;const s=AC.createBufferSource();s.buffer=nbuf;const f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=7;const t=AC.currentTime,d=rand(1.6,3);f.frequency.setValueAtTime(rand(1400,2200),t);f.frequency.linearRampToValueAtTime(rand(2000,3200),t+d);const g=AC.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.3,t+.4);g.gain.linearRampToValueAtTime(.1,t+d*.6);g.gain.linearRampToValueAtTime(0,t+d);const l=AC.createOscillator();l.frequency.value=rand(5,9);const lg=AC.createGain();lg.gain.value=.12;l.connect(lg);lg.connect(g.gain);l.start(t);l.stop(t+d);s.connect(f);f.connect(g);out(g,p);s.start(t,Math.random(),d)}
function scream(){if(!AC)return;const t=AC.currentTime;[[640,1900],[950,2700],[420,1250]].forEach((a,i)=>{const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(a[0],t);o.frequency.linearRampToValueAtTime(a[1],t+.6);o.frequency.linearRampToValueAtTime(a[1]*.6,t+2.4);const v=AC.createOscillator();v.frequency.value=7+i;const vg=AC.createGain();vg.gain.value=45;v.connect(vg);vg.connect(o.frequency);v.start(t);v.stop(t+2.5);f.type='bandpass';f.frequency.value=1700;f.Q.value=.7;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.3,t+.05);g.gain.linearRampToValueAtTime(.22,t+1.2);g.gain.linearRampToValueAtTime(0,t+2.5);o.connect(f);f.connect(g);out(g,null);o.start(t);o.stop(t+2.6)});burst(2,'highpass',1800,.35,null);tone(110,28,1.6,'sine',.9)}
function stinger(pos,k=1){tone(60,26,2,'sine',.7*k,pos);tone(1100,200,1.1,'sawtooth',.05*k,pos);burst(1.2,'lowpass',300,.5*k,pos)}
const evs={appear:()=>{stinger(mpos(),.7);whisperS(mpos())},vanish:()=>burst(.9,'bandpass',900,.2,mpos()),chase:()=>{tone(180,90,1.1,'sawtooth',.2,mpos());burst(.8,'bandpass',500,.4,mpos());sub('¡Te ha visto! ¡CORRE!',3)},search:()=>crack(mpos()),capture:()=>{scream();capFx=1},captureEnd:()=>{P.x=0;P.z=6;P.vx=P.vz=0;capFx=0;yaw=Math.PI;pitch=0;sub('Despiertas en el campamento… algo te observa.',6)}};
const evf=n=>evs[n]&&evs[n]();
function audioTick(){if(!AC||AC.state!=='running')return;const play=state==='play'||state==='pause';if(!(play||state==='menu'))return;const dt=.25;
 musT-=dt;if(musT<=0){musT=rand(9,16);const f=[110,130.8,146.8,98][Math.floor(Math.random()*4)];[f,f*1.5,f*1.19].forEach(x=>{const o=AC.createOscillator(),g=AC.createGain(),lp=AC.createBiquadFilter(),t=AC.currentTime;o.type='sawtooth';o.frequency.value=x;o.detune.value=rand(-9,9);lp.frequency.value=600;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.04,t+4);g.gain.linearRampToValueAtTime(0,t+12);o.connect(lp);lp.connect(g);g.connect(bus);o.start(t);o.stop(t+12.5)})}
 chT-=dt;if(chT<=0){chT=rand(.3,1.2);const p=around(6,22),f=rand(4200,4700);for(let i=0;i<Math.floor(rand(2,5));i++)tone(f,f*1.02,.03,'sine',.012,p,i*.07)}
 if(state!=='play')return;
 whT-=dt;if(whT<=0){whT=rand(14,38)*(M.st==='gone'?1:.6);whisperS(around(5,16))}owlT-=dt;if(owlT<=0){owlT=rand(30,70);const p=around(25,45);tone(420,340,.5,'sine',.1,p);tone(420,330,.6,'sine',.1,p,.8)}
 thT-=dt;if(thT<=0){thT=rand(14,34);lightning()}if(Math.random()<.04)crack(around(8,25));windG.gain.value=.12+.1*Math.abs(Math.sin(AC.currentTime*.35))}
function lightning(){flashT=rand(.25,.5);setTimeout(thunder,rand(300,2200))}
function listen(){const l=AC.listener,p=cam.position,f=cam.getWorldDirection(new THREE.Vector3());if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0}else{l.setPosition(p.x,p.y,p.z);l.setOrientation(f.x,f.y,f.z,0,1,0)}}
// ---------- Entrada y estado ----------
let state='menu',yaw=Math.PI,pitch=0,locked=false,wasLocked=false,runBtn=false,flashOn=true,phase=0,lastStep=0,subT=0,flashT=0,gT=0,camY=1.65,capFx=0,time=0,stepD=0;
const P=mkPlayer(),K={};
const sub=(t,s=5)=>{$('sub').textContent=t;subT=s},hudRun=()=>$('run').textContent=P.run?'CORRIENDO':'CAMINANDO',counter=()=>$('cnt').textContent=`PAPELES ENCONTRADOS: ${found()}/${NPAPERS}`;
function pause(on){if(state!=='play'&&state!=='pause')return;state=on?'pause':'play';$('pause').hidden=!on;if(!on&&!touch)renderer.domElement.requestPointerLock()}
function interact(){if(state!=='play'||P.captured)return;if(MP.on)return mpInteract();const q=pickPaper(P);if(!q)return;if(collect(q)){q.m.visible=false;q.s.visible=false;counter();burst(.25,'highpass',3500,.25);tone(520,780,.3,'sine',.08);mNoise(P.x,P.z,16,evf);const n=found();sub(n<NPAPERS?`Papel recogido (${n}/${NPAPERS}). El borde aún humea…`:'Tienes los 29 papeles.',4);if(n===NPAPERS)complete()}}
function complete(){state='end';$('done').hidden=false;document.exitPointerLock&&document.exitPointerLock()}
addEventListener('keydown',e=>{K[e.code]=true;if(state!=='play')return;if(e.code==='ShiftLeft'||e.code==='ShiftRight'){toggleRun(P,e.repeat);hudRun()}if(e.code==='KeyE')interact();if(e.code==='KeyF'&&!e.repeat&&!mpMonster()){flashOn=!flashOn;burst(.05,'highpass',2000,.2)}if(e.code==='KeyT'&&!e.repeat&&MP.on)mpTransform();});
addEventListener('keyup',e=>K[e.code]=false);
addEventListener('mousemove',e=>{if(state==='play'&&!P.captured&&(locked||e.buttons&1)){yaw-=e.movementX*.0022;pitch=Math.max(-1.3,Math.min(1.3,pitch-e.movementY*.0022))}});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;if(locked)wasLocked=true;else if(wasLocked&&state==='play')pause(true)});
renderer.domElement.addEventListener('click',()=>{if(state==='play'&&!touch&&!locked)try{renderer.domElement.requestPointerLock()}catch(e){}});
const joy={id:null,x:0,y:0,ox:0,oy:0},lk={id:null,x:0,y:0};
const bind=(id,fn)=>{const b=$(id);b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn(true)},{passive:false});b.addEventListener('touchend',e=>{e.stopPropagation();fn(false)})};
bind('bE',d=>d&&interact());bind('bF',d=>{if(d&&state==='play'&&!mpMonster())flashOn=!flashOn});bind('bR',d=>{if(d&&state==='play'){toggleRun(P,false);hudRun()}});bind('bP',d=>d&&pause(true));
addEventListener('touchstart',e=>{if(state!=='play')return;for(const t of e.changedTouches){if(t.clientX<innerWidth*.4&&joy.id===null){joy.id=t.identifier;joy.ox=t.clientX;joy.oy=t.clientY}else if(lk.id===null){lk.id=t.identifier;lk.x=t.clientX;lk.y=t.clientY}}},{passive:false});
addEventListener('touchmove',e=>{if(state!=='play')return;e.preventDefault();for(const t of e.changedTouches){if(t.identifier===joy.id){joy.x=Math.max(-1,Math.min(1,(t.clientX-joy.ox)/50));joy.y=Math.max(-1,Math.min(1,(t.clientY-joy.oy)/50))}else if(t.identifier===lk.id&&!P.captured){yaw-=(t.clientX-lk.x)*.006;pitch=Math.max(-1.3,Math.min(1.3,pitch-(t.clientY-lk.y)*.006));lk.x=t.clientX;lk.y=t.clientY}}},{passive:false});
addEventListener('touchend',e=>{for(const t of e.changedTouches){if(t.identifier===joy.id){joy.id=null;joy.x=joy.y=0}if(t.identifier===lk.id)lk.id=null}});
$('go').onclick=()=>{goFull();initAudio();state='play';['menu','cfg'].forEach(i=>$(i).hidden=true);$('hud').hidden=false;counter();hudRun();sub('Encuentra los 29 papeles quemados antes de que algo te encuentre a ti.',7);if(!touch)renderer.domElement.requestPointerLock()};
document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>$('msg').textContent=b.dataset.m);
$('ocfg').onclick=()=>{$('menu').hidden=true;$('cfg').hidden=false;$('bcfg').onclick=()=>{$('cfg').hidden=true;$('menu').hidden=false}};
$('pcfg').onclick=()=>{$('pause').hidden=true;$('cfg').hidden=false;$('bcfg').onclick=()=>{$('cfg').hidden=true;$('pause').hidden=false}};
$('resume').onclick=()=>pause(false);$('quit').onclick=()=>mpQuit();$('again').onclick=()=>location.reload();
document.addEventListener('pointerdown',()=>initAudio(),{once:true});
// ---------- Bucle ----------
const clock=new THREE.Clock(),tmpV=new THREE.Vector3();
function lightFx(dt){if(flashT>0){flashT-=dt;const on=Math.random()<.6;hemi.intensity=on?2.4:.35;moon.intensity=on?3:.28;scene.fog.color.copy(on?FOGL:FOGC);scene.background.copy(on?FOGL:FOGC)}else{hemi.intensity=hemiBase;moon.intensity=.28;scene.fog.color.copy(FOGC);scene.background.copy(FOGC)}}
function update(dt){time+=dt;TU.value=time;P.yaw=yaw;P.flash=flashOn;
 const inp=state==='pause'?{ix:0,iy:0}:{ix:((K.KeyD?1:0)-(K.KeyA?1:0))+joy.x,iy:((K.KeyW?1:0)-(K.KeyS?1:0))-joy.y};movePlayer(P,inp,dt);
 const spd=Math.hypot(P.vx,P.vz);stepD+=spd*dt;const stride=P.run?2.1:1.4;if(stepD>stride){stepD=0;stepS(P.run);if(Math.random()<.2)burst(.2,'highpass',2600,.06);!MP.on&&mNoise(P.x,P.z,P.run?20:5,evf)}
 if(MP.on)mpFrame(dt);else mUpdate(dt,P,{papers:found(),time,ev:evf});
 // cámara (suavizada en altura; secuencia de captura)
 camY+=((P.y+(MP.on&&MP.role==='monster'&&MP.phase==='hunt'?2.1:1.65))-camY)*Math.min(1,dt*14);let bob=spd>.3?Math.sin(time*(P.run?11:7.5))*(P.run?.035:.02):0;
 if(P.captured){const dx=M.x-P.x,dz=M.z-P.z,ty=Math.atan2(-dx,-dz);let da=ty-yaw;da=Math.atan2(Math.sin(da),Math.cos(da));yaw+=da*Math.min(1,dt*9);pitch+=((.42+Math.min(M.capT,1)*.2)-pitch)*Math.min(1,dt*5);const sh=(M.capT>.2?.05+Math.sin(M.capT*40)*.04:0);bob+=Math.sin(M.capT*55)*sh;cam.fov=75-Math.min(M.capT,1.2)*22;cam.updateProjectionMatrix();
  const f=M.capT<.25?1:M.capT>3.6?Math.min(1,(M.capT-3.6)):0;$('cap').style.opacity=(M.capT<4?(Math.sin(M.capT*18)>.3?.45:.1):1)*(M.capT>3.6?0:1)+f*.01;$('blk').style.opacity=M.capT>3.6?Math.min(1,(M.capT-3.6)*1.2):0;$('capt').style.opacity=M.capT>3.8?1:0}
 else{if(cam.fov!==75){cam.fov=75;cam.updateProjectionMatrix()}$('cap').style.opacity=0;$('capt').style.opacity=0;const b=+$('blk').style.opacity||0;$('blk').style.opacity=Math.max(0,b-dt*.8)}
 cam.position.set(P.x,camY+bob,P.z);cam.rotation.set(pitch,yaw,spd>.3?Math.sin(time*(P.run?11:7.5)*.5)*.006:0);
 const dr=cam.getWorldDirection(tmpV);flash.position.set(P.x+Math.cos(yaw)*.25,camY-.15,P.z-Math.sin(yaw)*.25);flash.target.position.copy(flash.position).add(dr.multiplyScalar(12));flash.intensity=flashOn&&!P.captured||P.captured&&Math.sin(M.capT*30)>.4?(flashOn?3.2:0):0;
 // monstruo
 const mv=MO;if(M.st==='gone'){mv.g.visible=false}else{const d=Math.hypot(M.x-P.x,M.z-P.z);mv.g.visible=d<80&&!(M.st==='appear'&&M.t>4.7&&Math.random()<.4);mv.g.position.set(M.x,H(M.x,M.z),M.z);mv.g.rotation.y=M.rot;animMonster(dt)}
 if(AC){const d=Math.hypot(M.x-P.x,M.z-P.z),on=M.st!=='gone';const br=on?Math.max(0,1-d/30)*(M.st==='chase'?.7:.4)*(.55+.45*Math.sin(time*(M.st==='chase'?9:2.4))):0;breathG.gain.value+=(br-breathG.gain.value)*.2;if(on)setPos(breathP,M.x,2.3,M.z);chaseG.gain.value+=((M.st==='chase'||M.st==='capture'?.13:0)-chaseG.gain.value)*Math.min(1,dt*2);
  if(on&&M.mv>.5){brT-=dt;if(brT<=0){brT=M.st==='chase'?.28:.6;burst(.12,'bandpass',rand(700,1300),.3,mpos(),.8);if(Math.random()<.12)crack(mpos())}}listen()}
 lightFx(dt);cullChunks();
 // lluvia
 const rp=rainPts.geometry.attributes.position,rq=QL[cfg.q].rain;for(let i=0;i<rq;i++){let y=rp.getY(i)-dt*20;if(y<0)y+=16;rp.setY(i,y)}rp.needsUpdate=true;rainPts.position.set(cam.position.x,cam.position.y-3,cam.position.z);
 // papeles: señal discreta
 gT+=dt;for(const q of PAPERS)if(!q.found){const d=Math.hypot(q.x-P.x,q.z-P.z);q.s.visible=d<38;if(q.s.visible)q.s.material.opacity=.22+.2*Math.sin(gT*2+q.id)}
 const n=pickPaper(P);$('prompt').textContent=MP.on&&MP.role==='monster'?(MP.phase==='hunt'?(touch?'':'[E] ')+'Embestida':''):n&&!P.captured&&!MP.out?(touch?'':'[E] ')+'Recoger papel':'';
 if(subT>0&&(subT-=dt)<=0)$('sub').textContent=''}
let fpsA=0,fpsN=0,fpsB=0;
function goFull(){try{const d=document.documentElement;if(touch&&d&&d.requestFullscreen&&!document.fullscreenElement)d.requestFullscreen({navigationUI:'hide'}).then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}).catch(()=>{})}catch(e){}}
function toggleFull(){try{const d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else if(d.requestFullscreen)d.requestFullscreen()}catch(e){}}
function frame(){requestAnimationFrame(frame);const raw=clock.getDelta(),dt=Math.min(raw,.05);
 if(state==='play'&&raw>0){fpsA+=raw;fpsN++;if(fpsA>4){const f=fpsN/fpsA;fpsA=fpsN=0;if(f<26&&cfg.q!=='baja'){if(++fpsB>=2){fpsB=0;cfg.q=cfg.q==='alta'?'media':'baja';saveCfg();applyQ();sub('Rendimiento bajo: gráficos reducidos a '+cfg.q.toUpperCase()+'.',4)}}else fpsB=0}}
 if(state==='play'||(state==='pause'&&MP.on))update(dt);else if(state==='menu'||state==='wait'||state==='end'||state==='pause'){TU.value+=dt;if(state==='menu'||state==='wait'){cam.position.set(0,2.2,16);cam.rotation.set(-.05,Math.sin(TU.value*.1)*.15,0);lightFx(dt);flash.intensity=0;if(Math.random()<.002)flashT=.3}cullChunks()}
 renderer.render(scene,cam)}
