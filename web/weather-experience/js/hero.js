// MDJB — Atmospheric Experience HERO (module). Astronomy comes from the SAME
// shared modules the backend Edge Function uses — no duplicated math.
import { moonPhase as moonPhaseAt } from './astro.js';
import { constellations, moonAltAz as moonAltAzRaw } from './celestial.js';

// PREVIEW = true shows the dev controls (weather/time/date/scene/live). In the
// real app set to false to hide them (users must not fake the weather).
const PREVIEW = false;   // app insertion: production behavior (no debug controls)

// Real date — day of week + day number + month (no year)
(function(){
  const DOW=['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
  const MON=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const n=new Date();
  document.getElementById('d-dow').textContent=DOW[n.getDay()];
  document.getElementById('d-num').textContent=n.getDate();
  document.getElementById('d-my').textContent=MON[n.getMonth()];
})();
// Floating Roman clock — build numerals + set hands to real time
(function(){
  const R=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  const dial=document.getElementById('clockdial'); const cx=125,cy=125,rad=104;
  for(let i=0;i<12;i++){
    const a=i*30*Math.PI/180;
    const s=document.createElement('span');
    s.className='num'+((i%3===0)?' q':'');
    s.textContent=R[i];
    s.style.left=(cx+rad*Math.sin(a))+'px';
    s.style.top=(cy-rad*Math.cos(a))+'px';
    dial.appendChild(s);
  }
  const hH=document.getElementById('handH'), hM=document.getElementById('handM');
  function tick(){ const t=new Date(), m=t.getMinutes(), h=t.getHours();
    hH.style.transform='rotate('+((h%12)*30+m*0.5)+'deg)';
    hM.style.transform='rotate('+(m*6)+'deg)'; }
  tick(); setInterval(tick,15000);
})();

const canvas = document.getElementById('gl');
// ===================== DEVICE TIERING =====================
// Weak/old machines (few cores, little RAM), reduced-motion users, and anything
// without WebGL must NEVER run the heavy raymarch shader — otherwise the site is
// too heavy to sit next to Serato on a modest laptop. Those devices get a
// lightweight time-based CSS sky gradient instead (installStaticSky, below):
// near-zero GPU. Capable machines get the full WebGL engine.
function isLowEndDevice(){
  try{
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return true;      // user asked for less motion → light path
    if((navigator.hardwareConcurrency||8) <= 4) return true;                    // ≤4 CPU cores → treat as weak
    if(navigator.deviceMemory && navigator.deviceMemory <= 4) return true;      // ≤4 GB RAM (Chromium exposes deviceMemory)
    return false;
  }catch(e){ return false; }
}
// no-op WebGL stub: lets the one-time setup code below run harmlessly on weak
// devices WITHOUT ever creating a real GPU context. Every property is a function
// returning 1 (truthy), so `gl.CONST` args and `gl.method()` calls are safe.
function noopGL(){ return new Proxy({}, { get:function(){ return function(){ return 1; }; } }); }
const lowEnd = isLowEndDevice();
let gl = null, capable = false;
if(!lowEnd){ try{ gl = canvas.getContext('webgl', {antialias:true, premultipliedAlpha:false}); capable = !!gl; }catch(e){ capable = false; } }
if(!capable){ gl = noopGL(); }   // weak/old/no-WebGL → stub; the real engine setup no-ops, static sky takes over at boot
let heroDegraded = !capable;     // true = clima en modo BAJA RESOLUCIÓN (cielo estático): equipo débil o contexto WebGL perdido
// GPU safety: if the driver resets the context (happens around GPU/WindowServer
// pressure), STOP drawing on the dead context instead of spamming errors. We
// preventDefault so the browser can restore it. CLAVE (regla del PO): caemos al
// cielo estático para que el clima NUNCA quede en blanco — justo cuando el DJ
// corre Serato y el GPU está bajo presión. El indicador pasa a "Baja resolución".
canvas.addEventListener('webglcontextlost', function(e){ e.preventDefault(); running=false; heroDegraded=true; installStaticSky(); if(typeof updateLiveUI==='function') updateLiveUI(); }, false);
canvas.addEventListener('webglcontextrestored', function(){ /* un contexto nuevo requeriría reinicio completo; mantenemos el cielo estático para no arriesgar quedar en blanco */ }, false);
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }';
const FRAG = [
'precision highp float;',
'uniform vec2 uRes; uniform float uTime; uniform float uSun; uniform float uAz;',
'uniform float uCloud; uniform float uStorm; uniform float uWind; uniform float uScene;',
'uniform float uRain; uniform float uSnow; uniform float uFog; uniform float uFlash;',
'uniform float uBolt; uniform float uBoltX; uniform float uBoltSeed;',
'uniform float uMetOn; uniform vec2 uMetHead; uniform vec2 uMetDir; uniform float uMetLen;',
'uniform float uMoonPhase;',
'uniform vec2 uOrion; uniform vec2 uDipper;',   // .x = visibility 0..1 (really up?), .y = screen Y from real altitude
'uniform vec3 uMoon;',                           // real moon: .xy = screen position (uv), .z = up-visibility 0..1
'float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}',
'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
' float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));',
' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
'float fbm(vec2 p){float s=0.0,a=0.55;for(int i=0;i<6;i++){s+=a*noise(p);p=p*2.02+vec2(1.7,9.2);a*=0.5;}return s;}',
'float hash21(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'float sdBox(vec3 p, vec3 b){vec3 d=abs(p)-b;return length(max(d,0.0))+min(max(d.x,max(d.y,d.z)),0.0);}',
'float mapCity(vec3 p){',
'  float sp=5.0; float d=1e9;',
'  for(int r=0;r<2;r++){',
'    float off=float(r)*2.5; float xi=floor((p.x+off+sp*0.5)/sp); float xr=p.x+off-(xi*sp);',
'    float zc=-64.0-float(r)*13.0; float cl=exp(-(p.x*p.x)/1600.0);',
'    float h=(5.0+hash21(vec2(xi,float(r)*7.0))*30.0)*(0.30+1.0*cl)+float(r)*4.0;',
'    d=min(d, sdBox(vec3(xr,p.y-h*0.5,p.z-zc), vec3(sp*0.33,h*0.5,3.2)));',
'  } return d;',
'}',
'vec3 calcN(vec3 p){vec2 e=vec2(0.02,0.0);return normalize(vec3(mapCity(p+e.xyy)-mapCity(p-e.xyy),mapCity(p+e.yxy)-mapCity(p-e.yxy),mapCity(p+e.yyx)-mapCity(p-e.yyx)));}',
'vec3 skyC(vec3 rd, vec3 sunDir, float dayf, float goldf, vec3 warmC){',
'  float up=clamp(rd.y*0.5+0.5,0.0,1.0);',
'  vec3 zen=mix(vec3(0.02,0.04,0.12),vec3(0.16,0.40,0.86),dayf);',
'  vec3 hz=mix(vec3(0.05,0.07,0.17),vec3(0.7,0.82,0.98),dayf); hz=mix(hz,warmC,goldf*0.9);',
'  vec3 c=mix(hz,zen,pow(up,0.7));',
'  c+=warmC*pow(clamp(1.0-abs(rd.y),0.0,1.0),5.0)*goldf*0.8;',
'  float sdd=max(dot(rd,sunDir),0.0);',
'  c+=warmC*pow(sdd,40.0)*(dayf*0.8+goldf*1.8);',
'  c+=mix(vec3(1.0,0.95,0.82),warmC*1.4,goldf)*pow(sdd,700.0)*2.2;',
'  return c;',
'}',
'vec3 winLights(vec3 p, vec3 n, float nightf){',
'  float g=smoothstep(0.30,0.72,nightf); if(g<0.01) return vec3(0.0);',                       // night only -> clean by day
'  float u=(abs(n.x)>abs(n.z)?p.z:p.x);',
'  vec2 cell=vec2(u,p.y)*1.3; vec2 gi=floor(cell); vec2 gf=fract(cell);',                      // small window grid
'  float sw=smoothstep(0.20,0.40,gf.x)*smoothstep(0.80,0.60,gf.x);',                           // soft-edged window (no hard alias)
'  float sh=smoothstep(0.20,0.40,gf.y)*smoothstep(0.80,0.60,gf.y);',
'  float on=smoothstep(0.50,0.72,hash21(gi));',                                                // which windows are lit
'  float tw=step(0.22,hash21(gi+floor(uTime*0.5)));',                                          // turn on/off over time',
'  float ch=hash21(gi*2.3);',
'  vec3 wc=ch<0.72?vec3(1.0,0.82,0.5):(ch<0.9?vec3(0.85,0.92,1.0):vec3(0.4,0.7,1.0));',        // warm / white / blue
'  return wc*sw*sh*on*tw*(1.0-abs(n.y))*g*1.15;',
'}',
'vec3 renderCity(vec2 uv, float asp, float dayf, float goldf, vec3 warmC, float nightf){',
'  vec3 ro=vec3(0.0,6.0,26.0); vec3 ta=vec3(0.0,15.0,-64.0);',
'  vec3 f=normalize(ta-ro); vec3 rgt=normalize(cross(f,vec3(0.0,1.0,0.0))); vec3 u=cross(rgt,f);',
'  vec2 pp=vec2((uv.x-0.5)*asp,(uv.y-0.5)); vec3 rd=normalize(f*1.5+rgt*pp.x+u*pp.y);',
'  vec3 sunDir=normalize(vec3(0.32, uSun*1.35+0.05, -1.0));',
'  vec3 col; float tW=(rd.y<-0.0001)?(-ro.y/rd.y):1e9;',
'  float t=0.0; float hit=0.0;',
'  for(int i=0;i<90;i++){ vec3 p=ro+rd*t; if(p.y<-0.5||t>tW||t>220.0) break; float d=mapCity(p); if(d<0.02){hit=1.0;break;} t+=d*0.9; }',
'  if(hit>0.5 && t<tW){',
'    vec3 p=ro+rd*t; vec3 n=calcN(p); float dif=clamp(dot(n,sunDir),0.0,1.0);',
'    vec3 base=mix(vec3(0.10,0.12,0.17),vec3(0.30,0.34,0.42),dayf);',
'    vec3 rf=reflect(rd,n); vec3 refC=skyC(rf,sunDir,dayf,goldf,warmC);',
'    float fres=pow(1.0-clamp(dot(-rd,n),0.0,1.0),3.0);',
'    col=base*(0.30+0.7*dif)+refC*(0.18+0.4*fres); col=mix(col,warmC,goldf*0.3*dif);',
'    col+=vec3(0.07,0.10,0.17)*nightf*0.8;',                                          // night ambient -> towers stay visible (not black)
'    float wfade=exp(-t*0.020);',
'    col+=winLights(p,n,nightf)*wfade*1.3;',
'    col+=vec3(1.0,0.72,0.38)*exp(-max(p.y,0.0)*0.5)*nightf*0.55*wfade;',             // brighter waterfront
'    float fog=1.0-exp(-t*0.010); col=mix(col, skyC(rd,sunDir,dayf,goldf,warmC), fog*0.7);',
'  } else if(tW<1e8){',
'    vec3 wp=ro+rd*tW;',
'    float wv=noise(vec2(wp.x*1.4+uTime*0.3, wp.z*0.7))-0.5;',           // slow swell tilts the reflection
'    vec3 rrd=normalize(vec3(rd.x, -rd.y+wv*0.22, rd.z));',              // wavy water -> reflection smears vertically
'    float t2=0.0; float hit2=0.0;',
'    for(int i=0;i<50;i++){ vec3 p=wp+rrd*t2; if(p.y>70.0||t2>220.0) break; float d=mapCity(p); if(d<0.04){hit2=1.0;break;} t2+=d*0.9; }',
'    vec3 refl;',
'    if(hit2>0.5){ vec3 p=wp+rrd*t2; vec3 n=calcN(p); float dif=clamp(dot(n,sunDir),0.0,1.0);',
'      refl=mix(vec3(0.08,0.10,0.14),vec3(0.26,0.30,0.38),dayf)*(0.3+0.7*dif)+winLights(p,n,nightf)*1.0',
'           +vec3(1.0,0.72,0.38)*exp(-max(p.y,0.0)*0.4)*nightf*0.4; }',
'    else { refl=skyC(rrd,sunDir,dayf,goldf,warmC); }',
'    float waveSh=noise(vec2(wp.x*7.0,wp.z*7.0-uTime*1.3))*0.5+0.5;',    // sea surface texture
'    vec3 base=mix(vec3(0.015,0.045,0.085), vec3(0.03,0.07,0.12), waveSh);',   // dark sea, textured -> reads as water
'    vec3 water=base + refl*0.16;',                                     // faint smeared reflection over the sea
'    float g=pow(max(dot(rrd,sunDir),0.0),90.0); water+=warmC*g*(dayf*0.2+goldf*0.4);',
'    col=water;',
'  } else { col=skyC(rd,sunDir,dayf,goldf,warmC); }',
'  return col;',
'}',
'float terrain(vec2 p){ float ridge=smoothstep(12.0,-85.0,p.y); float r=fbm(p*0.045); r=pow(clamp(r,0.0,1.0),1.15); float peaks=r*52.0+fbm(p*0.20)*9.0+fbm(p*0.9)*1.6; float base=2.5+fbm(p*0.35)*2.2; return mix(base,peaks,ridge); }',
'vec3 renderMountains(vec2 uv, float asp, float dayf, float goldf, vec3 warmC, float nightf){',
'  vec3 ro=vec3(0.0,10.0,45.0); vec3 ta=vec3(0.0,26.0,-55.0);',
'  vec3 f=normalize(ta-ro); vec3 rgt=normalize(cross(f,vec3(0.0,1.0,0.0))); vec3 u=cross(rgt,f);',
'  vec2 pp=vec2((uv.x-0.5)*asp,(uv.y-0.5)); vec3 rd=normalize(f*1.25+rgt*pp.x+u*pp.y);',
'  vec3 sunDir=normalize(vec3(0.55, max(uSun,0.06)*0.9+0.34, -0.55));',            // side-top light so slopes are lit
'  float t=1.0; float hit=0.0;',
'  for(int i=0;i<200;i++){ vec3 p=ro+rd*t; float d=p.y-terrain(p.xz); if(d<0.04*t+0.03){hit=1.0;break;} t+=max(d*0.4,0.35); if(t>430.0) break; }',
'  if(hit>0.5){',
'    vec3 p=ro+rd*t; vec2 e=vec2(0.5,0.0);',
'    vec3 n=normalize(vec3(terrain(p.xz-e.xy)-terrain(p.xz+e.xy), 2.0*e.x, terrain(p.xz-e.yx)-terrain(p.xz+e.yx)));',
'    float dif=clamp(dot(n,sunDir),0.0,1.0); float sky=clamp(n.y*0.5+0.5,0.0,1.0);',
'    float elev=p.y; float slope=1.0-clamp(n.y,0.0,1.0);',
'    float tex=noise(p.xz*2.2)*0.5+0.5; float tex2=noise(p.xz*0.7)*0.5+0.5;',
'    vec3 forest=mix(vec3(0.08,0.20,0.07), vec3(0.04,0.12,0.05), tex);',            // forest / trees
'    vec3 rock=mix(vec3(0.32,0.28,0.25), vec3(0.19,0.17,0.15), tex);',
'    vec3 snow=vec3(0.92,0.95,1.0);',
'    vec3 mat=mix(forest, rock, smoothstep(0.34,0.62,slope));',                     // steep -> rock
'    mat=mix(mat, rock, smoothstep(20.0,27.0,elev));',                              // above tree line
'    float snowM=smoothstep(30.0,40.0,elev)*(1.0-smoothstep(0.62,0.9,slope));',
'    mat=mix(mat, snow, snowM);',
'    vec3 col=mat*(0.34+0.92*dif) + mat*sky*0.16;',
'    col=mix(col, warmC, goldf*0.32*dif);',
'    float fog=1.0-exp(-t*0.0032); col=mix(col, skyC(rd,sunDir,dayf,goldf,warmC), fog*0.5);',
'    return col;',
'  } return skyC(rd,sunDir,dayf,goldf,warmC);',
'}',
'float rainMask(vec2 uv, float asp, float slant, out float bright){',                  // organic curtain: jittered drops, each unique, head + fading tail
'  float acc=0.0; bright=0.0;',
'  for(int i=0;i<4;i++){ float fi=float(i);',
'    float sc=64.0+fi*60.0;',                                                          // depth layers
'    vec2 p=vec2(uv.x*asp,uv.y); p.x+=uv.y*slant; p.x*=sc;',
'    float coln=floor(p.x);',
'    float s1=hash21(vec2(coln,fi*7.3));',
'    float jx=(hash21(vec2(coln,fi*3.1))-0.5)*0.8;',                                   // jitter streak x -> kills the grid banding
'    float xf=fract(p.x)-0.5-jx;',
'    float vspd=(0.7+0.9*s1)*(1.0+uWind*0.5);',                                        // per-column fall speed
'    float freqY=sc*0.10; float y=uv.y*freqY + uTime*(4.5+fi*1.2)*vspd;',              // + so drops FALL (down), tail trailing above the head
'    float row=floor(y); float yf=fract(y);',
'    float s2=hash21(vec2(coln,row+fi*50.0));',                                        // re-seed PER DROP -> every drop is different (some absent)
'    float on=step(0.38,s2);',
'    float w=0.05+0.045*s2;',                                                          // per-drop width
'    float xln=smoothstep(w,0.0,abs(xf));',                                            // soft thin streak
'    float head=smoothstep(0.0,0.06,yf)*(1.0-smoothstep(0.06,0.60,yf));',             // bright head + fading tail (motion blur), gap after
'    float streak=xln*head*on;',
'    float depth=1.0-fi*0.18;',                                                        // near drops stronger than far
'    acc+=streak*depth; bright+=streak*depth*(0.4+0.7*s2);',
'  } bright=clamp(bright,0.0,1.0); return clamp(acc,0.0,1.0);',
'}',
'float snowMask(vec2 uv, float asp){',                                                  // soft round flakes, slow fall, gentle sway (no streaks)
'  float acc=0.0;',
'  for(int i=0;i<4;i++){ float fi=float(i);',
'    float sc=24.0+fi*20.0;',                                                           // fewer, larger cells than rain
'    float drift=sin(uTime*0.5+fi*1.7)*0.06 + uWind*0.10*uv.y;',                        // lateral sway + wind lean
'    float fall=uTime*(0.30+fi*0.10);',                                                 // slow descent (per depth)
'    vec2 p=vec2(uv.x*asp + drift, uv.y + fall); p*=sc;',
'    vec2 cell=floor(p);',
'    float s=hash21(cell+fi*23.0); float on=step(0.62,s);',                             // sparse flakes
'    vec2 f=fract(p)-0.5;',
'    f.x+=(hash21(cell+7.0)-0.5)*0.5; f.y+=(hash21(cell+3.0)-0.5)*0.5;',               // jitter within cell -> no grid
'    float flake=smoothstep(0.16+0.06*s,0.0,length(f))*on;',                           // soft round dot
'    acc+=flake*(1.0-fi*0.16);',
'  } return clamp(acc,0.0,1.0);',
'}',
'vec3 starField(vec2 uv, float asp){',                                                 // realistic stars: jittered, power-law brightness, colour temperature, twinkle, diffraction spikes
'  vec3 acc=vec3(0.0);',
'  for(int i=0;i<3;i++){ float fi=float(i);',
'    float sc=72.0+fi*58.0;',                                                          // 3 density layers
'    vec2 g=vec2(uv.x*asp,uv.y)*sc; vec2 cell=floor(g); vec2 f=fract(g);',
'    float h=hash21(cell+vec2(fi*37.0,11.0));',
'    float present=step(0.5,h);',                                                       // ~half the cells hold a star
'    vec2 sp=vec2(hash21(cell+vec2(1.3,4.7)+fi), hash21(cell+vec2(7.1,2.3)+fi));',      // jittered position -> breaks the grid
'    float mag=hash21(cell+vec2(5.1,9.9)+fi); float bright=pow(mag,5.0);',             // power law: mostly faint, few brilliant
'    vec2 dd=f-sp; float d=length(dd);',
'    float pt=smoothstep(0.04+bright*0.10,0.0,d)*(0.30+bright);',                       // soft round point
'    float bloom=bright*bright*0.32*exp(-d*d*90.0);',                                    // brightest stars get a soft glowing halo -> life
'    float spk=pow(bright,3.0)*(smoothstep(0.45,0.0,abs(dd.x))*smoothstep(0.015,0.0,abs(dd.y))+smoothstep(0.45,0.0,abs(dd.y))*smoothstep(0.015,0.0,abs(dd.x)));',  // spikes on the brightest
'    float tw=0.66+0.34*sin(uTime*(1.1+mag*3.4)+h*45.0);',                              // per-star twinkle (a touch deeper)
'    vec3 tint=mix(vec3(0.72,0.82,1.0), vec3(1.0,0.85,0.70), hash21(cell+vec2(3.7,6.1)));',  // blue-white .. warm
'    acc+=tint*(pt+bloom+spk*0.6)*tw*present;',
'  } return acc;',
'}',
'float segDist(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h); }',
'float cStar(vec2 P, vec2 q, float sz){',                                               // a living star: sharp core + faint bloom + its own twinkle
'  float d=dot(P-q,P-q);',
'  float tw=0.88+0.12*sin(uTime*(0.7+fract(q.x*17.0)*0.9)+q.y*55.0);',                  // gentle individual shimmer (not a strobe)
'  return (exp(-d*sz) + 0.22*exp(-d*sz*0.12))*tw;',                                     // core + wide soft halo
'}',
'vec3 constellations(vec2 uv, float asp){',                                             // Orion + Big Dipper — placed by REAL altitude (uX.y), shown only when really up (uX.x)
'  vec2 P=vec2(uv.x*asp,uv.y); float k=0.0125;',
'  // ---- Orion ----',
'  vec3 scO=vec3(0.0); float linO=0.0; vec2 oc=vec2(0.185*asp,uOrion.y);',
'  vec2 bet=oc+vec2(-3.5,8.0)*k, bel=oc+vec2(4.0,8.5)*k;',                               // shoulders: Betelgeuse (red) / Bellatrix
'  vec2 b1=oc+vec2(-1.7,-0.5)*k, b2=oc+vec2(-0.2,0.1)*k, b3=oc+vec2(1.4,0.7)*k;',        // belt
'  vec2 sai=oc+vec2(-5.2,-8.2)*k, rig=oc+vec2(5.8,-8.8)*k;',                             // feet: Saiph / Rigel (blue)
'  linO+=smoothstep(0.0018,0.0,segDist(P,bet,b1))+smoothstep(0.0018,0.0,segDist(P,bel,b3));',
'  linO+=smoothstep(0.0018,0.0,segDist(P,b1,b2))+smoothstep(0.0018,0.0,segDist(P,b2,b3));',
'  linO+=smoothstep(0.0018,0.0,segDist(P,b1,sai))+smoothstep(0.0018,0.0,segDist(P,b3,rig));',
'  linO+=smoothstep(0.0018,0.0,segDist(P,sai,rig))+smoothstep(0.0018,0.0,segDist(P,bet,bel));',
'  scO+=vec3(1.0,0.66,0.48)*cStar(P,bet,9000.0)*1.4;',                                   // Betelgeuse
'  scO+=vec3(0.74,0.84,1.0)*cStar(P,rig,9000.0)*1.4;',                                   // Rigel
'  scO+=vec3(0.9,0.93,1.0)*(cStar(P,bel,11000.0)+cStar(P,b1,12500.0)+cStar(P,b2,12500.0)+cStar(P,b3,12500.0)+cStar(P,sai,11000.0));',
'  vec3 orion=scO + vec3(0.40,0.50,0.76)*clamp(linO,0.0,1.0)*0.10;',
'  // ---- Big Dipper ----',
'  vec3 scD=vec3(0.0); float linD=0.0; vec2 dc=vec2(0.76*asp,uDipper.y);',
'  vec2 du=dc+vec2(-12.5,2.6)*k, me=dc+vec2(-12.6,-2.8)*k, ph=dc+vec2(-7.4,-3.8)*k, mg=dc+vec2(-7.0,1.1)*k;',
'  vec2 al=dc+vec2(-1.6,2.1)*k, mz=dc+vec2(4.9,3.0)*k, ak=dc+vec2(11.6,2.5)*k;',
'  linD+=smoothstep(0.0018,0.0,segDist(P,du,me))+smoothstep(0.0018,0.0,segDist(P,me,ph));',
'  linD+=smoothstep(0.0018,0.0,segDist(P,ph,mg))+smoothstep(0.0018,0.0,segDist(P,mg,du));',
'  linD+=smoothstep(0.0018,0.0,segDist(P,mg,al))+smoothstep(0.0018,0.0,segDist(P,al,mz))+smoothstep(0.0018,0.0,segDist(P,mz,ak));',
'  scD+=vec3(0.9,0.93,1.0)*(cStar(P,du,11000.0)+cStar(P,me,11000.0)+cStar(P,ph,11000.0)+cStar(P,mg,11000.0)+cStar(P,al,11000.0)+cStar(P,mz,11000.0)+cStar(P,ak,11000.0));',
'  vec3 dipper=scD + vec3(0.40,0.50,0.76)*clamp(linD,0.0,1.0)*0.10;',
'  return orion*uOrion.x + dipper*uDipper.x;',                                          // each appears only when really above the horizon, at its real height
'}',
'void main(){',
' vec2 uv = gl_FragCoord.xy/uRes;',
' float asp = uRes.x/uRes.y;',
' float horizon = 0.34;',
' float sky = clamp((uv.y-horizon)/(1.0-horizon),0.0,1.0);',
' float day = smoothstep(-0.12,0.22,uSun);',
' float night = 1.0-day;',
' float low = 1.0-clamp(abs(uSun)/0.34,0.0,1.0);',
' float golden = clamp(low*step(-0.12,uSun)*(1.0-day*0.4),0.0,1.0);',
' float redness = clamp(1.0-abs(uSun)/0.13,0.0,1.0)*step(-0.14,uSun);',   // deep red near horizon
' vec2 sunP = vec2(uAz, horizon + uSun*0.92);',
' float sqz = 1.0 + redness*0.32;',
' vec2 dd = (uv-sunP)*vec2(asp, sqz);',
' float sd = length(dd);',
' vec3 warm = mix(vec3(1.0,0.55,0.26), vec3(0.95,0.22,0.12), redness*0.85);',
' float horizonProx = 1.0-clamp(abs(uSun)/0.40,0.0,1.0); float sceneF = smoothstep(0.05,0.5,horizonProx);',   // scenes reach FULL opacity while the sun is still high (|uSun|<0.20), so elements are solid BEFORE the sun descends to touch them; they fade out only after the sun has left them (|uSun|>0.20..0.38)
' vec3 zenD=vec3(0.16,0.40,0.86), horD=vec3(0.62,0.80,0.98);',
' vec3 zenN=vec3(0.02,0.04,0.12), horN=vec3(0.05,0.07,0.17);',
' vec3 zen=mix(zenN,zenD,day), hor=mix(horN,horD,day);',
' hor=mix(hor,warm,golden*0.9);',
' zen=mix(zen,vec3(0.26,0.20,0.42),golden*0.45);',   // purple zenith at sunset
' vec3 col = mix(hor,zen,pow(sky,0.62));',
' float cov = clamp(uCloud*(0.72+0.5*fbm(vec2(uTime*0.015,7.0))),0.0,1.0);',           // cloud coverage (also hides the sun when overcast)
' float sunVis = (1.0 - smoothstep(0.15,0.55,sceneF)*step(0.5,uScene)) * (1.0-cov*0.9);',  // in city/mountain scenes the sun belongs to the scene; heavy clouds also veil it
' float glow = exp(-sd*2.6)*1.0 + exp(-sd*7.5)*0.6;',
' vec3 sunCol = mix(vec3(1.0,0.95,0.85), warm, clamp(golden+redness,0.0,1.0));',
' vec3 glowCol = mix(vec3(1.0,0.98,0.92), mix(vec3(1.0,0.70,0.35), vec3(1.0,0.30,0.13), redness), clamp(golden+redness,0.0,1.0));',  // WHITE by day -> orange golden -> red at horizon
' col += glowCol*glow*(day*1.15+golden*1.3+redness*1.05)*sunVis;',                    // stronger daytime halo
' float discR = 0.072;',
' float disc = smoothstep(discR, discR-0.010, sd);',
' float limb = 1.0 - 0.18*smoothstep(0.0, discR, sd);',
' vec3 discCol = mix(vec3(1.0,0.99,0.95), vec3(1.0,0.88,0.52), clamp(golden*0.5+redness*0.9,0.0,1.0));',  // brilliant white by day, warm at sunset
' col += discCol*limb*disc*(1.0+day*2.0+golden*0.5+redness*0.5)*sunVis;',             // overexposed by day -> reads as a REAL bright sun
' col += vec3(1.0,0.98,0.9)*smoothstep(0.036,0.0,sd)*(0.55+day*0.9+golden*0.4+redness*0.35)*sunVis;',  // hot white core bloom
' if(uMoon.z>0.001){',                                                                  // REAL moon position (alt/az → uMoon.xy); shown whenever above the horizon, faint by day
'  vec2 md=(uv-uMoon.xy)*vec2(asp,1.0);',
'  float mdst=length(md); float R=0.06;',                                               // decoratively oversized (true moon ~0.5 deg)
'  vec2 mn=md/R; float rr=length(mn);',
'  float mdisc=1.0-smoothstep(0.985,1.02,rr);',
'  float z=sqrt(max(0.0,1.0-min(rr*rr,1.0)));',                                          // treat the disc as a sphere
'  vec3 nrm=vec3(mn.x,mn.y,z);',
'  float ph=uMoonPhase*6.28318;',                                                        // 0=new .. 0.5=full .. 1=new
'  vec3 Ld=normalize(vec3(sin(ph),0.16,-cos(ph)));',                                     // sunlight direction sets the phase
'  float lit=smoothstep(-0.04,0.30,dot(nrm,Ld));',                                       // soft terminator
'  float mar=fbm(mn*2.4+vec2(3.1,1.7));',                                                // maria / craters
'  vec3 msurf=mix(vec3(0.55,0.58,0.66),vec3(0.95,0.96,1.0),smoothstep(0.32,0.72,mar));',
'  vec3 moonCol=msurf*(0.03+lit*1.08) + vec3(0.09,0.12,0.20)*(1.0-lit);',               // lit face + faint earthshine on the dark side
'  float illum=1.0-abs(uMoonPhase-0.5)/0.5;',                                            // 0 = new .. 1 = full
'  float dayMoon=smoothstep(0.32,0.78,illum);',                                         // a thin/near-new moon is INVISIBLE by day (lost in the sky) — only fat phases show faintly
'  float moonVeil=(1.0-cov*0.92)*uMoon.z*mix(0.26*dayMoon,1.0,night);',                 // clouds veil it · up-visibility · daytime gated by phase
'  col=mix(col,moonCol,mdisc*moonVeil);',
'  col+=vec3(0.55,0.65,0.9)*exp(-mdst*4.6)*0.20*moonVeil*(0.3+0.7*smoothstep(0.05,0.5,uMoonPhase)*smoothstep(0.95,0.5,uMoonPhase));',  // halo mostly when bright
' }',
' vec3 stars = starField(uv,asp);',
' float mwAxis = (uv.y-(0.64+(uv.x-0.5)*0.26));',                                       // signed distance from the band centre
' float mwBand = exp(-pow(mwAxis/0.10,2.0));',                                          // broad glow envelope
' float mwCore = exp(-pow(mwAxis/0.035,2.0));',                                         // bright dense core
' float mwCloud = fbm(vec2(uv.x*asp*4.5+11.0, uv.y*4.5))*fbm(vec2(uv.x*asp*11.0, uv.y*11.0-3.0)+5.0);', // clumpy star clouds
' float mwDust = smoothstep(0.30,0.62,fbm(vec2(uv.x*asp*6.0-7.0, uv.y*3.0)));',         // dark dust rifts cutting through
' float mwI = mwBand*(0.28+1.1*mwCloud)*(0.35+0.65*mwDust) + mwCore*0.32*mwDust;',
' vec3 mw = mix(vec3(0.10,0.12,0.20), vec3(0.24,0.22,0.29), mwCore) * mwI * 0.62;',     // cool band, warmer denser core — kept subtle
' float starVis = night*(1.0-uCloud*0.78)*smoothstep(0.12,0.5,sky);',                  // night + clear sky + above horizon
' vec3 consts = constellations(uv,asp);',                                              // Orion + Big Dipper
' col += (stars + mw + consts) * starVis;',                                            // no grid grain -> no canvas look
' if(uMetOn>0.001){',                                                                   // SHOOTING STAR: bright head + tapering trail
'   vec2 P=vec2(uv.x*asp,uv.y); vec2 H=vec2(uMetHead.x*asp,uMetHead.y);',
'   vec2 md=normalize(vec2(uMetDir.x*asp,uMetDir.y)); vec2 rel=P-H;',
'   float along=dot(rel,-md); float perp=length(rel+md*along);',                       // decompose relative to travel direction
'   float trail=(1.0-clamp(along/uMetLen,0.0,1.0))*smoothstep(0.0055,0.0,perp)*step(0.0,along);',  // thin trail, brighter near the head
'   float head=exp(-dot(rel,rel)*2200.0);',                                             // bright leading point
'   col += vec3(0.86,0.91,1.0)*(trail*0.85+head)*uMetOn*starVis;',
' }',
// EVOLVING clouds: coverage + shape drift over time
' float wind = uTime*(0.005+uWind*uWind*0.11);',                                       // cloud drift: calm states stay gentle, strong wind makes the clouds race (quadratic)
' vec2 cuv = vec2(uv.x*asp, (uv.y-horizon)*1.4);',
' float c1 = fbm(cuv*3.0+vec2(wind, uTime*0.010));',
' float c2 = fbm(cuv*6.0+vec2(wind*1.7, 0.3-uTime*0.014));',
' float clouds = c1*0.65+c2*0.35;',
' float cmask = smoothstep(0.55-cov*0.5, 0.85-cov*0.35, clouds) * smoothstep(0.0,0.14,sky) * smoothstep(0.06,0.28,uCloud);',  // gate: clouds fully vanish toward Despejado (no phantom clouds on a clear night)
' float toSun = exp(-sd*2.0);',
' vec3 cloudLit = mix(vec3(0.55,0.58,0.66), vec3(1.0,0.99,0.96), day);',
' cloudLit = mix(cloudLit, warm, clamp(golden+redness*0.6,0.0,1.0)*0.8);',
' vec3 cloudDark = mix(vec3(0.12,0.13,0.18), vec3(0.45,0.47,0.55), day*0.6);',
' cloudDark = mix(cloudDark, vec3(0.10,0.11,0.16), uStorm*0.7);',
' vec3 cloudCol = mix(cloudDark, cloudLit, clamp(clouds*0.6+toSun*0.6,0.0,1.0));',
' col = mix(col, cloudCol, cmask*0.85);',
' col = mix(col, col*vec3(0.35,0.37,0.44), uStorm*cmask*0.6);',
// LOCATION SILHOUETTE (city / mountains) — soft fade in at sunrise/sunset
' float silFade = sceneF;',   // mountains fade in only near sunrise/sunset
' // location silhouettes replaced by 3D raymarched scenes (mixed below by sceneF)',
// OCEAN (sea scene, default) — sun sinks into the horizon with reflection
' if(uScene<1.5 && uv.y<horizon){',                            // water for sea (0) and Miami bay (1)
'   float depth=(horizon-uv.y)/horizon;',                      // 0 horizon .. 1 foreground
'   float persp=1.0/(depth*depth*7.0+0.14);',                  // waves grow toward the viewer
'   vec3 water=mix(hor*0.92, vec3(0.012,0.045,0.09), smoothstep(0.0,0.7,depth));',
'   float w1=noise(vec2(uv.x*asp*persp*3.0, depth*persp*2.0 - uTime*0.6));',
'   float w2=noise(vec2(uv.x*asp*persp*7.0+3.0, depth*persp*5.0 - uTime*1.1));',
'   float waves=w1*0.6+w2*0.4;',
'   water += (waves-0.5)*0.07*mix(0.35,1.0,depth);',           // crest/trough shading
'   float pathW=0.010+depth*0.085;',                        // narrow, calm corridor
'   float refX=abs(uv.x-sunP.x)*asp;',
'   float env=exp(-(refX*refX)/(pathW*pathW));',
'   float g1=noise(vec2(uv.x*asp*70.0, depth*16.0 - uTime*1.2));',
'   float glint=smoothstep(0.72,0.97,g1);',                 // soft, sparse glints
'   float coherent=env*exp(-depth*4.5);',                   // concentrated near the horizon
'   float broken=env*glint*exp(-depth*2.2)*0.5;',           // fades quickly toward the viewer
'   float refl=coherent*0.42+broken*0.45;',                 // subtle brightness
'   water += sunCol*refl*(day*0.55*low+golden*1.1+redness*0.85);',   // reflection column only near the horizon (low sun) — not when the sun is high overhead
'   water += warm*exp(-depth*11.0)*clamp(golden+redness,0.0,1.0)*0.55;',  // warm horizon afterglow
'   if(uScene>0.5){ float dc=clamp(1.0-day*1.05+0.15,0.0,1.0);',
'     float streak=noise(vec2(uv.x*asp*28.0, uTime*0.9+depth*18.0))*0.5+0.5;',
'     water += vec3(1.0,0.80,0.52)*exp(-depth*3.0)*dc*streak*0.22; }',       // Miami city lights on the bay
'   col=water;',
' }',
' float vig = smoothstep(1.25,0.35,length((uv-0.5)*vec2(asp,1.0)));',
' col *= mix(0.85,1.0,vig);',
' col = pow(col, vec3(0.92));',
' if(uScene>0.5 && uScene<1.5){ col = mix(col, renderCity(uv,asp,day,golden,warm,night), sceneF); }',   // Miami skyline fades in only at sunrise/sunset
' if(uScene>1.5){ col = mix(col, renderMountains(uv,asp,day,golden,warm,night), sceneF); }',           // mountains fade in only at sunrise/sunset
// ---- WEATHER OVERLAYS (on top of every scene) ----
' if(uScene>0.5){',                                                                    // clouds also cover the city/mountain sky (their own sky has none), proportional to how present the scene is -> no double-apply on the sea
'   col = mix(col, cloudCol, cmask*0.88*sceneF);',                                     // real drifting clouds over the scene sky (Nublado/Cubierto now show)
'   col = mix(col, col*vec3(0.34,0.36,0.43), uStorm*cmask*0.6*sceneF);',               // storm darkening on those clouds
' }',
' if(uFog>0.001){',                                                                    // FOG: soft veil, denser toward the ground
'   vec3 fogCol = mix(vec3(0.20,0.23,0.29), vec3(0.72,0.76,0.82), day);',
'   fogCol = mix(fogCol, warm, golden*0.3);',
'   float depthF = mix(0.55,1.0, 1.0-clamp((uv.y-horizon)/(1.0-horizon),0.0,1.0));',  // thicker low
'   col = mix(col, fogCol, clamp(uFog,0.0,1.0)*depthF);',
' }',
' if(uFlash>0.001){ col += vec3(0.52,0.58,0.74)*uFlash*(0.5+cov*0.6); }',              // LIGHTNING flash: bluish-white glow, brighter over clouds
' if(uBolt>0.001){',                                                                    // LIGHTNING BOLT: jagged glowing streak from cloud base to ground
'   float top=0.99; float endY=horizon-0.03; float span=top-endY;',
'   float tt=clamp((top-uv.y)/span,0.0,1.0);',                                          // 0 at cloud base .. 1 at ground
'   float z1=noise(vec2(uBoltSeed*7.0, uv.y*9.0))-0.5;',                                // low-freq wander
'   float z2=noise(vec2(uBoltSeed*23.0+4.0, uv.y*22.0))-0.5;',                          // high-freq jag
'   float wob=(z1*0.085+z2*0.032)*smoothstep(0.0,0.12,tt);',                           // starts tight at the cloud, jags more as it descends
'   float bxm=uBoltX+wob;',                                                             // main channel
'   float dbdir=(fract(uBoltSeed*0.137)>0.5)?1.0:-1.0;',
'   float branchOn=smoothstep(0.5,0.56,tt);',
'   float bxb=bxm+dbdir*(0.04+0.16*(tt-0.5))*branchOn;',                                // a fork below mid-height
'   float dm=(uv.x-bxm)*asp; float db=(uv.x-bxb)*asp;',
'   float coreM=smoothstep(0.006,0.0,abs(dm));',                                        // hot thin core
'   float glowM=exp(-abs(dm)*52.0)*0.5+exp(-abs(dm)*15.0)*0.22;',                       // halo
'   float coreB=smoothstep(0.004,0.0,abs(db))*branchOn*smoothstep(1.0,0.82,tt);',       // thinner fork, lower half only
'   float glowB=exp(-abs(db)*72.0)*0.28*branchOn;',
'   float taper=smoothstep(1.01,0.93,tt)*smoothstep(0.0,0.03,tt)*step(endY,uv.y);',     // fade at both ends, above ground
'   float streak=(coreM+glowM+coreB+glowB)*taper;',
'   col += vec3(0.84,0.89,1.0)*streak*uBolt*1.9;',
'   col += vec3(0.55,0.66,0.96)*(glowM+glowB)*taper*uBolt*0.5;',                        // atmospheric bloom around the bolt
' }',
' if(uRain>0.001){',                                                                   // RAIN: darken/desaturate + falling streaks
'   float lum=dot(col,vec3(0.299,0.587,0.114));',
'   col = mix(col, mix(vec3(lum), col, 0.72)*mix(1.0,0.78,day), uRain*0.5);',          // wet, muted look
'   float slant = -(0.10+uWind*0.55);',                                                // wind tilts the rain
'   float rb; float rm = rainMask(uv, asp, slant, rb);',
'   float near = mix(0.72,1.12, 1.0-uv.y);',                                           // heavier toward the viewer
'   col += vec3(0.68,0.74,0.84)*rb*uRain*0.30*near;',                                  // fine bright streaks (varied per drop)
'   col = mix(col, col*0.90, rm*uRain*0.36);',                                         // slight shadow behind streaks
' }',
' if(uSnow>0.001){',                                                                   // SNOW: cold desaturated veil + drifting white flakes
'   float lum=dot(col,vec3(0.299,0.587,0.114));',
'   col = mix(col, mix(vec3(lum), vec3(0.80,0.85,0.94), 0.5), uSnow*0.38);',           // cold, muted, faintly blue
'   col += vec3(0.90,0.94,1.0)*0.06*uSnow;',                                           // faint bright atmosphere
'   float near = mix(0.8,1.15, 1.0-uv.y);',                                            // denser toward the viewer
'   float sm = snowMask(uv, asp);',
'   col = mix(col, vec3(0.97,0.985,1.0), sm*uSnow*0.92*near);',                        // white flakes on top
' }',
' gl_FragColor = vec4(col,1.0);',
'}'].join('\n');
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(o));return o;}
const prog=gl.createProgram();
gl.attachShader(prog,sh(gl.VERTEX_SHADER,VERT));
gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAG));
gl.linkProgram(prog);gl.useProgram(prog);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const U=n=>gl.getUniformLocation(prog,n);
const uRes=U('uRes'),uTime=U('uTime'),uSun=U('uSun'),uAz=U('uAz'),uCloud=U('uCloud'),uStorm=U('uStorm'),uWind=U('uWind'),uScene=U('uScene');
const uRain=U('uRain'),uSnow=U('uSnow'),uFog=U('uFog'),uFlash=U('uFlash');
const uBolt=U('uBolt'),uBoltX=U('uBoltX'),uBoltSeed=U('uBoltSeed');
const uMetOn=U('uMetOn'),uMetHead=U('uMetHead'),uMetDir=U('uMetDir'),uMetLen=U('uMetLen');
const uMoonPhase=U('uMoonPhase');
const uOrion=U('uOrion'),uDipper=U('uDipper'),uMoon=U('uMoon');
// ---- shared astronomy: SAME modules the backend Edge Function uses (single source of truth) ----
const LOC = { lat:25.91, lon:-80.31 };   // Miami Lakes (LIVE mode swaps in real geoloc)
let moonPhase = moonPhaseAt(new Date());
let simDayOfYear = (function(){ const n=new Date(); return Math.floor((n-new Date(n.getFullYear(),0,0))/86400000); })();
const skyNow = (date) => { const c = constellations(date, LOC.lat, LOC.lon, -90); return { orionAlt:c.orion.altCentroid, dipperAlt:c.bigDipper.altCentroid }; };
const moonAltAz = (date) => moonAltAzRaw(date, LOC.lat, LOC.lon);
function resize(){
  const small=innerWidth<900;
  let dpr=Math.min(small?1.5:2, devicePixelRatio||1);
  const budget=small?1550000:2600000;                 // pixel budget: this shader is heavy (raymarch + effects)
  while(innerWidth*dpr*innerHeight*dpr>budget && dpr>0.7) dpr-=0.1;
  canvas.width=Math.round(innerWidth*dpr); canvas.height=Math.round(innerHeight*dpr);
  canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px';
  gl.viewport(0,0,canvas.width,canvas.height);
}
addEventListener('resize',resize);resize();
// Anidamiento seguro (staff.html → agenda-frame → staff-agenda.html → este iframe):
// el evento 'resize' de la ventana NO se dispara de forma fiable cuando el PADRE
// redimensiona/revela nuestro iframe, así que el canvas WebGL se queda a tamaño
// inicial (chico) aunque el DOM esté full-width. Un ResizeObserver sobre el
// documento capta el cambio real de caja; y un par de re-fits diferidos cubren
// el layout tardío del anidamiento extra.
if(typeof ResizeObserver!=='undefined'){ try{ new ResizeObserver(function(){ resize(); }).observe(document.documentElement); }catch(_e){} }
setTimeout(resize,120); setTimeout(resize,500); setTimeout(resize,1500);
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
let t0=performance.now(); let scene=0; let running=capable;   // weak/static devices: the render loop never starts
// ===================== M0 · THE SEAM =====================
// The engine + UI consume ONLY the AtmosphericState contract below.
// A PROVIDER produces it. mockProvider = fallback/dev. The real Edge
// Function provider (M3) returns the SAME shape -> swap one line.
// ---- source data (drivers 0..1 for the shader + real metrics) ----
const WEATHER={
  clear:   {label:'Despejado',          cloud:0.10, storm:0.0, wind:0.20, rain:0.0, snow:0.0, fog:0.0,  t:89, hum:46, wmph:8,  dir:'E',   vis:10, press:30.15, uv:9, uvl:'Extremo',  logi:'ok'},
  cloudy:  {label:'Mayormente nublado',  cloud:0.55, storm:0.0, wind:0.35, rain:0.0, snow:0.0, fog:0.0,  t:91, hum:65, wmph:11, dir:'ESE', vis:6,  press:30.08, uv:8, uvl:'Muy Alto', logi:'ok'},
  overcast:{label:'Cubierto',            cloud:0.95, storm:0.0, wind:0.40, rain:0.0, snow:0.0, fog:0.0,  t:84, hum:72, wmph:12, dir:'E',   vis:7,  press:29.98, uv:4, uvl:'Moderado', logi:'ok'},
  rain:    {label:'Lluvia',              cloud:0.90, storm:0.15,wind:0.45, rain:0.7, snow:0.0, fog:0.14, t:80, hum:85, wmph:14, dir:'SE',  vis:5,  press:29.85, uv:3, uvl:'Moderado', logi:'watch'},
  storm:   {label:'Tormenta eléctrica',  cloud:1.00, storm:0.9, wind:0.75, rain:1.0, snow:0.0, fog:0.18, t:74, hum:90, wmph:30, dir:'SSW', vis:1.5,press:29.60, uv:1, uvl:'Bajo',     logi:'alert'},
  snow:    {label:'Nieve',               cloud:0.92, storm:0.0, wind:0.30, rain:0.0, snow:0.85,fog:0.20, t:31, hum:80, wmph:9,  dir:'N',   vis:2,  press:30.10, uv:1, uvl:'Bajo',     logi:'watch'},
  fog:     {label:'Niebla',              cloud:0.35, storm:0.0, wind:0.10, rain:0.0, snow:0.0, fog:0.72, t:78, hum:95, wmph:4,  dir:'Var', vis:1,  press:30.05, uv:2, uvl:'Bajo',     logi:'watch'},
  wind:    {label:'Ventoso',             cloud:0.45, storm:0.0, wind:1.0,  rain:0.0, snow:0.0, fog:0.0,  t:85, hum:48, wmph:28, dir:'NE',  vis:9,  press:29.90, uv:7, uvl:'Alto',     logi:'watch'},
};
// ---- deterministic helpers (also live server-side later) ----
function diurnal(h,base,sw){ sw=sw||7; return Math.round(base+sw*Math.cos((h-15)*Math.PI/12)); }
function fmtHour(h){ h=((Math.round(h)%24)+24)%24; const ap=h<12?'am':'pm'; let x=h%12; if(x===0)x=12; return x+ap; }
function glyphFor(key,night){ if(key==='storm')return'⛈️'; if(key==='rain')return'🌧️'; if(key==='snow')return'🌨️'; if(key==='fog')return'🌫️'; if(key==='overcast')return'☁️'; if(key==='cloudy')return night?'☁️':'⛅'; if(key==='wind')return night?'🌬️':'🌤️'; return night?'🌙':'☀️'; }
// ---- PROVIDER: mock/fallback -> AtmosphericState ----
function mockProvider(input){
  const w=WEATHER[input.wxKey]||WEATHER.cloudy;
  const dayT=input.dayT, hour=(dayT*24)%24;
  const temp=diurnal(hour,w.t), hot=temp>=88;
  const feels=temp+(w.hum>60&&temp>82?Math.round((w.hum-55)*0.28+(temp-82)*0.6):(temp<60?-3:0));
  const hi=diurnal(15,w.t), lo=diurnal(5,w.t), sr=6.87, ss=20.03;
  const hourly=[]; for(let i=0;i<6;i++){ const h=hour+i*3, night=(h%24)<sr||(h%24)>ss; hourly.push({h:i===0?'Ahora':fmtHour(h), glyph:glyphFor(input.wxKey,night), t:diurnal(h,w.t)+'°'}); }
  return {
    location:{ name:'Miami Lakes, FL', short:'Miami Lakes', lat:25.91, lon:-80.31, tz:'America/New_York' },
    time:{ dayT, hour, sunElev:Math.sin((dayT-0.25)*6.2832), az:0.45+0.48*dayT, moonPhase, sunrise:'6:52 AM', sunset:'8:02 PM' },
    condition:{ key:input.wxKey, label:w.label, temp:temp+'°', feels:Math.round(feels)+'°', feelsHot:hot, hi:'Máx: '+hi+'°', lo:'Mín: '+lo+'°' },
    drivers:{ cloud:w.cloud, storm:w.storm, wind:w.wind, rain:w.rain, snow:w.snow, fog:w.fog },
    metrics:{ humidity:w.hum+'%', windMph:w.wmph+' mph', windDir:w.dir, vis:w.vis+' mi', pressure:w.press.toFixed(2)+' inHg', uv:String(w.uv), uvLabel:w.uvl, uvHot:w.uv>=6 },
    hourly:hourly,
    event:{ lead:'Día sin evento en agenda.', start:'Sin horario', end:'Sin horario', buffer:'—', loc:'Miami Lakes', sunset:'◔ 8:02 PM', logi:w.logi }
  };
}
let providerFn=mockProvider;   // <== SWAP POINT: real Edge Function provider plugs in here (M3), same shape
let wxKey='cloudy';
const cur={cloud:0.55, storm:0.0, wind:0.35, rain:0.0, snow:0.0, fog:0.0};   // live (eased) values
let flash=0.0, nextFlash=0.0;   // lightning glow
let bolt=0.0, boltX=0.5, boltSeed=0.0;   // visible bolt streak
// Time of day: dayFixed=-1 -> auto cycle; otherwise a paused phase (0=medianoche,0.25=amanecer,0.5=mediodía,0.75=atardecer)
let dayFixed=-1; let dispDay=0.72;   // dispDay eases toward the target for a smooth sun glide
// Shooting stars: occasional meteors at night
const met={on:false, hx:0, hy:0, vx:0, vy:0, life:0, dur:1.0};
let nextMet=5.0, lastT=0, metOn=0.0;
// ---- live state + UI binding (the contract drives both engine & DOM) ----
function currentInput(){ return { wxKey:wxKey, dayT:dispDay, coords:null }; }   // PREVIEW inputs; LIVE mode swaps in real coords/time
let state=providerFn(currentInput());
let hostEvent=null;   // real "today gig" injected by the host page (agenda leads) via postMessage
const $=function(id){return document.getElementById(id);};
function mrow(l,v,style){ return '<li><span class="l">'+l+'</span><span class="v" style="'+(style||'')+'">'+v+'</span></li>'; }
function renderUI(s){
  $('c-temp').textContent=s.condition.temp;
  $('c-cond').textContent=s.condition.label;
  $('c-hilo').innerHTML=s.condition.hi+'&nbsp;&nbsp;'+s.condition.lo;
  $('c-loc').textContent='📍 '+s.location.name;
  const m=s.metrics;
  $('metrics').innerHTML=
    mrow('HUMEDAD',m.humidity,'color:var(--cool)')+
    mrow('SENSACIÓN TÉRMICA',s.condition.feels,s.condition.feelsHot?'color:var(--hot)':'')+
    mrow('VIENTO',m.windMph+'<small>'+m.windDir+'</small>','')+
    mrow('VISIBILIDAD',m.vis,'')+
    mrow('PRESIÓN',m.pressure,'')+
    mrow('ÍNDICE UV',m.uv+'<small>'+m.uvLabel+'</small>',m.uvHot?'color:var(--hot)':'');
  // phone strip: the essentials for an outdoor gig (rail is hidden <900px)
  const chip=function(k,v,style){return '<div class="chip"><span class="k">'+k+'</span><span class="v" style="'+(style||'')+'">'+v+'</span></div>';};
  $('mstrip').innerHTML=
    chip('HUMEDAD',m.humidity,'color:var(--cool)')+
    chip('VIENTO',m.windMph+'<small>'+m.windDir+'</small>')+
    chip('UV',m.uv+'<small>'+m.uvLabel+'</small>',m.uvHot?'color:var(--hot)':'')+
    chip('SENSACIÓN',s.condition.feels,s.condition.feelsHot?'color:var(--hot)':'');
  $('hourly').innerHTML=s.hourly.map(function(h){return '<div><span class="h">'+h.h+'</span><span class="g">'+h.glyph+'</span><span class="t">'+h.t+'</span></div>';}).join('');
  $('ev-lead').textContent=s.event.lead;
  $('ev-start').textContent=s.event.start; $('ev-end').textContent=s.event.end; $('ev-buffer').textContent=s.event.buffer;
  $('ev-loc').textContent=s.event.loc; $('ev-sunset').textContent=s.event.sunset;
  if(hostEvent){                                         // concise real gig for TODAY (host page); atardecer stays weather-derived
    if(hostEvent.lead)   $('ev-lead').textContent=hostEvent.lead;
    if(hostEvent.start)  $('ev-start').textContent=hostEvent.start;
    if(hostEvent.end)    $('ev-end').textContent=hostEvent.end;
    if(hostEvent.buffer) $('ev-buffer').textContent=hostEvent.buffer;
    if(hostEvent.loc)    $('ev-loc').textContent=hostEvent.loc;
  }
}
function refreshState(){ state=providerFn(currentInput()); renderUI(state); }   // rebuild contract -> repaint UI (async-ready for real fetch)
refreshState();
// ===================== M2 · LIVE MODE (real data via Edge Function) =====================
// Set window.MDJB_ATMO_ENDPOINT to your Supabase function URL. Note: in a Claude
// artifact the CSP blocks external fetch, so LIVE falls back to mock there; it works
// once deployed in the real app. Fully verified against a local mirror endpoint.
const ATMO_ENDPOINT=(typeof window!=='undefined' && window.MDJB_ATMO_ENDPOINT) || '';
let liveMode=false, liveTimer=null, liveStatus='';
function getCoords(){                                   // browser geolocation → Miami fallback, 6s timeout
  const tz=-new Date().getTimezoneOffset()/60, fb={lat:25.91,lon:-80.31,tz};
  return new Promise(res=>{
    if(!navigator.geolocation) return res(fb);
    let done=false; const to=setTimeout(()=>{if(!done){done=true;res(fb);}},6000);
    navigator.geolocation.getCurrentPosition(
      p=>{ if(done)return; done=true; clearTimeout(to); res({lat:p.coords.latitude,lon:p.coords.longitude,tz}); },
      ()=>{ if(done)return; done=true; clearTimeout(to); res(fb); }, {timeout:6000,maximumAge:600000});
  });
}
// Validate that a response really is an AtmosphericState before the UI trusts it —
// a malformed/partial body must fall back to mock, never throw mid-render.
function isValidState(s){
  return !!(s && s.condition && typeof s.condition.temp==='string' && s.condition.label
    && s.time && typeof s.time.dayT==='number'
    && s.drivers && typeof s.drivers.cloud==='number'
    && s.metrics && s.location && Array.isArray(s.hourly) && s.hourly.length && s.sky);
}
async function fetchProvider(c){                        // calls the Edge Function, returns AtmosphericState
  const ep=(typeof window!=='undefined' && window.MDJB_ATMO_ENDPOINT) || ATMO_ENDPOINT;
  if(!ep) throw new Error('no endpoint configured');
  const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),8000);   // 8s cap — never hang on a slow/dead endpoint
  try{
    const r=await fetch(ep+'?lat='+c.lat.toFixed(4)+'&lon='+c.lon.toFixed(4)+'&tz='+c.tz,{cache:'no-store',signal:ctrl.signal});
    if(!r.ok) throw new Error('http '+r.status);
    const s=await r.json();                             // may throw on malformed JSON -> caught by refreshLive
    if(!isValidState(s)) throw new Error('malformed AtmosphericState');
    return s;
  } finally { clearTimeout(to); }
}
async function refreshLive(){
  const ep=(typeof window!=='undefined' && window.MDJB_ATMO_ENDPOINT) || ATMO_ENDPOINT;
  if(!ep){ liveStatus='fallback'; refreshState(); updateLiveUI(); return; }   // no endpoint (e.g. in the artifact) -> mock, skip the geolocation prompt
  liveStatus='connecting'; updateLiveUI();
  try{
    const s=await fetchProvider(await getCoords());
    state=s; renderUI(state);
    dayFixed=state.time.dayT;                           // sun/sky follow the real local time
    liveStatus='live';
  }catch(e){ liveStatus='fallback'; refreshState(); }   // graceful fallback to mock
  updateLiveUI();
}
function setLive(on){
  liveMode=on; if(liveTimer){clearInterval(liveTimer);liveTimer=null;}
  if(on){ refreshLive(); liveTimer=setInterval(refreshLive,600000); }   // poll every 10 min
  else { liveStatus=''; dayFixed=-1; refreshState(); updateLiveUI(); }
}
function dropLive(){ if(liveMode){ liveMode=false; if(liveTimer){clearInterval(liveTimer);liveTimer=null;} liveStatus=''; updateLiveUI(); } }
function updateLiveUI(){
  const b=document.getElementById('livebtn'); if(!b)return;
  var degraded = heroDegraded || !capable;   // visual en cielo estático = baja resolución (rendimiento)
  b.classList.toggle('on', liveMode && liveStatus!=='fallback' && !degraded);   // satélite conectado
  b.classList.toggle('warn', liveStatus==='fallback' && !degraded);             // offline
  b.classList.toggle('degraded', degraded);                                     // baja resolución
  b.textContent = degraded ? '▽ Baja resolución'
    : !liveMode ? '🛰️ En vivo'
    : liveStatus==='live' ? '🛰️ En vivo'
    : liveStatus==='fallback' ? '⚠ Sin conexión'
    : '🛰️ Conectando…';
  b.title = degraded ? 'Modo rendimiento (cielo estático) para no congelar la máquina — el clima nunca queda en blanco'
    : liveStatus==='fallback' ? 'Sin conexión al satélite de datos — usando datos locales'
    : liveMode ? 'Conectado al satélite de datos (en vivo)'
    : 'Toca para conectar al satélite de datos en vivo';
}
let lastHourBucket=-1;
const FPS_CAP=60, MIN_FRAME_MS=1000/FPS_CAP; let lastDrawWall=0;   // frame throttle: cap draws to ~60fps
function frame(now){
  if(!capable) return;                                            // static-sky devices never render the shader
  if(!reduce && running) requestAnimationFrame(frame);            // keep the loop alive at vsync…
  if(now-lastDrawWall < MIN_FRAME_MS) return;                     // …but skip GPU work above 60fps (ProMotion hits 120; this heavy shader gains nothing and doubles GPU load) — big relief, no visible change
  lastDrawWall=now;
  const t=(now-t0)/1000;
  const dt=Math.min(0.05, Math.max(0.0, t-lastT)); lastT=t;
  const dayTgt=(dayFixed>=0.0)?dayFixed:((t/1200)+0.72)%1.0;   // cycle (~20 min) or a chosen fixed phase
  let dd=dayTgt-dispDay; if(dd>0.5)dd-=1.0; else if(dd<-0.5)dd+=1.0;   // shortest path around the clock
  dispDay=(dispDay+dd*(reduce?1.0:0.05)+1.0)%1.0;
  const dayT=dispDay;
  const sunElev=Math.sin((dayT-0.25)*6.2832);
  const az=0.45+0.48*dayT;          // keep sun/moon in the right negative space
  const hb=Math.floor(dayT*24); if(hb!==lastHourBucket){ lastHourBucket=hb; refreshState(); }  // temp/forecast track the moving clock, from the provider
  const tgt=state.drivers;          // ease current -> the contract's drivers (~1.5s)
  const k=reduce?1.0:0.03;
  cur.cloud+=(tgt.cloud-cur.cloud)*k; cur.storm+=(tgt.storm-cur.storm)*k;
  cur.wind +=(tgt.wind -cur.wind )*k; cur.rain +=(tgt.rain -cur.rain )*k;
  cur.snow +=((tgt.snow||0)-cur.snow)*k;                                 // ||0: live states without snow ease to 0
  cur.fog  +=(tgt.fog  -cur.fog  )*k;
  // Lightning: only when a storm is actually present. A strike = a fast bolt streak + a lingering sky flash.
  if(!reduce && cur.storm>0.35){
    if(t>nextFlash){
      flash=1.0; nextFlash=t+1.4+Math.random()*4.8;
      if(Math.random()<0.75){ bolt=1.0; boltX=0.16+0.68*Math.random(); boltSeed=Math.random()*90.0+1.0; }  // most strikes show a bolt
    }
  }
  flash*=0.82; if(flash<0.01) flash=0.0;
  bolt*=0.55;  if(bolt<0.01)  bolt=0.0;   // the bolt itself is brief; the flash lingers
  // Shooting stars: spawn occasionally when it is dark and not too cloudy
  const nightAmt=Math.max(0.0, Math.min(1.0, (-0.12-sunElev)/0.30));   // 0 at dusk .. 1 deep night
  if(!reduce && !met.on && t>nextMet && nightAmt>0.35 && cur.cloud<0.6){
    met.on=true; met.life=0; met.dur=0.7+Math.random()*0.6;
    met.hx=0.12+Math.random()*0.72; met.hy=0.66+Math.random()*0.28;    // start in the upper sky
    const ang=(Math.random()<0.5?-1:1)*(0.35+Math.random()*0.6);       // horizontal spread
    const sp=1.0+Math.random()*0.5;                                     // uv/sec
    const L=Math.hypot(ang,-1.0); met.vx=sp*ang/L; met.vy=sp*(-1.0)/L;  // travel down-diagonal
  }
  if(met.on){
    met.hx+=met.vx*dt; met.hy+=met.vy*dt; met.life+=dt;
    const u=met.life/met.dur;
    metOn=Math.max(0.0, Math.min(1.0, u/0.12)) * (1.0-Math.max(0.0,(u-0.55)/0.45)) * nightAmt;  // fade in fast, fade out toward the end
    if(u>=1.0 || met.hy<0.28){ met.on=false; metOn=0.0; nextMet=t+6.0+Math.random()*9.0; }   // a bit less frequent (~6–15 s)
  } else { metOn*=0.6; if(metOn<0.01) metOn=0.0; }
  gl.uniform1f(uMetOn, metOn);
  gl.uniform2f(uMetHead, met.hx, met.hy);
  gl.uniform2f(uMetDir, met.vx, met.vy);
  gl.uniform1f(uMetLen, 0.16);
  // simulated date = chosen day-of-year (scrubber) at the previewed hour
  const simDate=new Date(new Date().getFullYear(),0,1); simDate.setDate(simDayOfYear);
  const hh=dayT*24; simDate.setHours(Math.floor(hh), Math.floor((hh%1)*60), 0, 0);
  moonPhase=moonPhaseAt(simDate);                    // phase follows the chosen date
  gl.uniform1f(uMoonPhase, moonPhase);
  // real seasonal sky: which constellations are up + their height
  const sky=skyNow(simDate);
  const oY=0.42+Math.max(0,Math.min(58,sky.orionAlt))/58*0.46, oV=Math.max(0,Math.min(1,(sky.orionAlt-3.0)/9.0));
  const dY=0.42+Math.max(0,Math.min(58,sky.dipperAlt))/58*0.46, dV=Math.max(0,Math.min(1,(sky.dipperAlt-3.0)/9.0));
  gl.uniform2f(uOrion, oV, oY);
  gl.uniform2f(uDipper, dV, dY);
  // real moon position: altitude -> screen Y, azimuth -> screen X (E left / W right), visible when above the horizon
  const mp=moonAltAz(simDate);
  const mV=Math.max(0,Math.min(1,(mp.alt+1.0)/4.0));
  const mX=0.5+Math.sin((mp.az-180)*Math.PI/180)*0.42;
  const mY=0.42+Math.max(0,Math.min(58,mp.alt))/58*0.46;
  gl.uniform3f(uMoon, mX, mY, mV);
  gl.uniform2f(uRes,canvas.width,canvas.height);
  gl.uniform1f(uTime,t);
  gl.uniform1f(uSun,sunElev);
  gl.uniform1f(uAz,az);
  gl.uniform1f(uCloud,cur.cloud);
  gl.uniform1f(uStorm,cur.storm);
  gl.uniform1f(uWind,cur.wind);
  gl.uniform1f(uRain,cur.rain);
  gl.uniform1f(uSnow,cur.snow);
  gl.uniform1f(uFog,cur.fog);
  gl.uniform1f(uFlash,flash*(0.55+cur.storm*0.5));
  gl.uniform1f(uBolt,bolt*cur.storm);
  gl.uniform1f(uBoltX,boltX);
  gl.uniform1f(uBoltSeed,boltSeed);
  gl.uniform1f(uScene, scene);       // 0 = sea (Miami bay), 1 = Miami downtown, 2 = mountains
  gl.drawArrays(gl.TRIANGLES,0,3);
}
// ---- Static sky (weak devices / no WebGL): a time-based CSS gradient painted on
// the canvas, retinted every few minutes to follow the real hour. Zero GPU loop.
function skyGradientCSS(date){
  const h = date.getHours() + date.getMinutes()/60;
  const K = [                                       // hour -> [topRGB, bottomRGB] sky anchors
    {h:0,  top:[6,13,26],    bot:[13,32,51]},        // deep night
    {h:6,  top:[26,35,72],   bot:[190,131,79]},      // dawn — indigo over warm horizon
    {h:9,  top:[30,95,168],  bot:[191,224,245]},     // morning blue
    {h:15, top:[33,110,190], bot:[200,232,250]},     // full day
    {h:19, top:[23,33,69],   bot:[224,102,63]},      // dusk — Miami orange
    {h:22, top:[8,16,30],    bot:[15,32,50]},         // dusk -> night
    {h:24, top:[6,13,26],    bot:[13,32,51]}
  ];
  let a=K[0], b=K[K.length-1];
  for(let i=0;i<K.length-1;i++){ if(h>=K[i].h && h<=K[i+1].h){ a=K[i]; b=K[i+1]; break; } }
  const f = (b.h===a.h) ? 0 : (h-a.h)/(b.h-a.h);     // interpolate between the two nearest anchors
  const mix = (x,y)=>Math.round(x+(y-x)*f);
  const rgb = (p,q)=>'rgb('+mix(p[0],q[0])+','+mix(p[1],q[1])+','+mix(p[2],q[2])+')';
  return 'linear-gradient(180deg, '+rgb(a.top,b.top)+' 0%, '+rgb(a.bot,b.bot)+' 100%)';
}
var _staticSky=false;
function installStaticSky(){
  if(_staticSky) return;                 // idempotente: no apilar intervalos si el contexto se pierde varias veces
  _staticSky=true;
  canvas.style.background = skyGradientCSS(new Date());
  setInterval(function(){ canvas.style.background = skyGradientCSS(new Date()); refreshState(); }, 300000);  // retint sky + refresh metrics every 5 min
}
if(capable) requestAnimationFrame(frame);   // capable machine → start the WebGL engine
else        installStaticSky();             // weak / old / reduced-motion / no-WebGL → static gradient sky
updateLiveUI();                             // estado inicial del indicador (En vivo / Baja resolución)
// Pause the render loop while the pane is hidden OR the window loses focus.
// document.hidden alone does NOT fire when our window is merely BEHIND another
// app — so a DJ working in Serato (our window behind theirs) would keep us
// burning GPU in the background. blur/focus closes that gap: when they leave for
// Serato we drop to zero GPU, and we resume the instant they click us back. On
// resume we re-anchor lastT so dt stays clamped (no giant catch-up frame).
function pauseLoop(){ running=false; }
function resumeLoop(){ if(capable && !running && !document.hidden){ resize(); running=true; lastT=(performance.now()-t0)/1000; requestAnimationFrame(frame); } }
document.addEventListener('visibilitychange', ()=>{ document.hidden ? pauseLoop() : resumeLoop(); });
addEventListener('blur',  pauseLoop);    // switched to Serato / another app → stop drawing
addEventListener('focus', resumeLoop);   // back on our window → resume
function tick(){ if(reduce) requestAnimationFrame(frame); }   // repaint once in reduced-motion
document.querySelectorAll('#scenes button').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('#scenes button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); scene=+b.dataset.s;   // switch location; time of day is controlled separately
    tick();
  });
});
const DAYPH={dawn:0.24, day:0.50, dusk:0.75, night:0.0};   // fixed phases
document.querySelectorAll('#timeofday button').forEach(function(b){
  b.addEventListener('click',function(){
    dropLive();
    document.querySelectorAll('#timeofday button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on');
    const w=b.dataset.t;
    if(w==='cycle'){ dayFixed=-1; }                         // resume the auto day/night cycle
    else { dayFixed=DAYPH[w]; }                              // jump to (and hold) a chosen phase
    tick();
  });
});
document.querySelectorAll('#weather button').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('#weather button').forEach(function(x){x.classList.remove('on')});
    dropLive(); b.classList.add('on'); wxKey=b.dataset.w; nextFlash=0.0; refreshState(); tick();
  });
});
document.getElementById('livebtn').addEventListener('click',function(){ setLive(!liveMode); });
// date scrubber — travel through the year; the sky (moon + constellations) follows the real date
(function(){
  const sl=document.getElementById('dslider'), lb=document.getElementById('dlbl');
  const MON=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const todayDOY=simDayOfYear; sl.value=simDayOfYear;
  function upd(){ dropLive(); simDayOfYear=+sl.value;
    const d=new Date(new Date().getFullYear(),0,1); d.setDate(simDayOfYear);
    lb.textContent = (simDayOfYear===todayDOY) ? 'HOY' : (d.getDate()+' '+MON[d.getMonth()]);
    refreshState(); tick();
  }
  sl.addEventListener('input',upd); upd();
})();
// production: hide the dev/preview controls (users must not fake weather/time/location)
if(!PREVIEW){ ['datectl','timeofday','weather','scenes'].forEach(function(id){ const e=document.getElementById(id); if(e) e.style.display='none'; }); }

// ── Real "today event" from the host page ──────────────────────────────────
// The HERO stays self-contained (no DB, no keys): the host — which already
// loaded the DJ's events — hands us just today's concise summary. We render it
// over EVENTO DE HOY. Weather/astronomy remain fully independent.
window.addEventListener('message', function(e){
  const d = e.data;
  if (d && d.type === 'mdjb:today-event') { hostEvent = d.event || null; renderUI(state); }
});
// tell the host we're ready so it can (re)send even if it loaded first
try { if (window.parent && window.parent !== window) window.parent.postMessage({ type:'mdjb:hero-ready' }, '*'); } catch(_e){}
