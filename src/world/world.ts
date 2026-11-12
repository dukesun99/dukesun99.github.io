import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Water } from 'three/examples/jsm/objects/Water.js';

/* ------------------------------------------------------------------ terrain maths (CPU) */

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const fbm = (x: number, y: number, oct: number) => {
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return s;
};
const ridged = (x: number, y: number, oct: number) => {
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise(x, y) * 2 - 1);
    s += a * n * n;
    x = x * 2.13 + 13.7;
    y = y * 2.13 + 3.1;
    a *= 0.5;
  }
  return s;
};

export const LAKE = { x: 60, z: -640, r: 235 };

/** Ground height of the valley world at (x, z). The valley runs along z; the lake lies at its far end. */
export function heightAt(x: number, z: number) {
  const mx = 46 * Math.sin(z * 0.0052) + 20 * Math.sin(z * 0.013 + 1.7);
  const d = Math.abs(x - mx);
  const walls = sm(26, 430, d);
  // warp the coordinates so ridgelines wander instead of following the noise grid
  const wx = x + 70 * (fbm(x * 0.0021 + 11, z * 0.0021, 3) - 0.5);
  const wz = z + 70 * (fbm(x * 0.0021, z * 0.0021 + 23, 3) - 0.5);
  const r = ridged(wx * 0.0038 + 3.1, wz * 0.0038 + 7.7, 6);
  const crag = ridged(wx * 0.021 + 1.3, wz * 0.021 + 5.1, 4);
  let h =
    5 +
    walls * (46 + 310 * r * r * (0.45 + 0.55 * walls)) +
    16 * fbm(x * 0.016, z * 0.016, 4) * sm(10, 120, d) +
    walls * walls * r * crag * 28;
  const ld = Math.hypot((x - LAKE.x) / 1.25, z - LAKE.z);
  h = -10 + (h + 10) * sm(LAKE.r * 0.82, LAKE.r * 1.4, ld);
  return h;
}

/* ------------------------------------------------------------------ light through the day */

type Key = {
  el: number; // sun elevation, degrees
  az: number; // sun azimuth, degrees from -z toward +x
  zen: number[];
  mid: number[];
  hor: number[];
  light: number[]; // colour of the key light (sun, or moon after dark)
  amb: number[];
  fog: number[];
  stars: number;
  water: number[];
  text: number[]; // colour of headings standing in the world
};
// 0 sunrise above the clouds · 1 dusk in the valley · 2 night · 3 blue hour on the lake · 4 sunrise again
const KEYS: Key[] = [
  { el: 5, az: 9, zen: [0.018, 0.04, 0.17], mid: [0.27, 0.12, 0.31], hor: [1.25, 0.58, 0.24], light: [1.5, 0.8, 0.45], amb: [0.2, 0.16, 0.3], fog: [0.5, 0.27, 0.3], stars: 0, water: [0.05, 0.05, 0.12], text: [1.9, 1.6, 1.3] },
  { el: 4, az: -24, zen: [0.014, 0.022, 0.1], mid: [0.24, 0.085, 0.25], hor: [1.25, 0.46, 0.15], light: [1.6, 0.66, 0.32], amb: [0.2, 0.15, 0.32], fog: [0.6, 0.29, 0.32], stars: 0.12, water: [0.04, 0.03, 0.09], text: [1.6, 1.2, 0.95] },
  { el: -30, az: -60, zen: [0.002, 0.004, 0.012], mid: [0.006, 0.016, 0.04], hor: [0.02, 0.05, 0.09], light: [0.17, 0.23, 0.4], amb: [0.035, 0.05, 0.1], fog: [0.012, 0.026, 0.052], stars: 1, water: [0.004, 0.012, 0.03], text: [0.9, 1.0, 1.3] },
  { el: -7, az: -8, zen: [0.006, 0.012, 0.045], mid: [0.035, 0.03, 0.1], hor: [0.16, 0.1, 0.2], light: [0.1, 0.13, 0.24], amb: [0.05, 0.06, 0.13], fog: [0.045, 0.05, 0.11], stars: 0.6, water: [0.008, 0.016, 0.045], text: [0.95, 1.0, 1.3] },
  { el: 3.6, az: 24, zen: [0.022, 0.05, 0.19], mid: [0.3, 0.12, 0.3], hor: [1.2, 0.5, 0.17], light: [1.7, 0.88, 0.5], amb: [0.28, 0.2, 0.36], fog: [0.72, 0.37, 0.3], stars: 0, water: [0.05, 0.04, 0.1], text: [1.7, 1.35, 1.05] },
];
const MOON = new THREE.Vector3(0.45, 0.5, -0.62).normalize();
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/* ------------------------------------------------------------------ shader pieces */

const NOISE = /* glsl */ `
float h21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 h33(vec3 p3){ p3=fract(p3*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm2(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
`;
const FOG = /* glsl */ `
uniform vec3 uCam; uniform vec3 uFogCol; uniform float uFogDen; uniform float uMist;
vec3 applyFog(vec3 col, vec3 wp){
  float d=length(wp-uCam);
  float f=1.-exp(-d*d*uFogDen*uFogDen);
  float m=exp(-max(wp.y,0.)*.03)*(1.-exp(-d*.005))*uMist;
  return mix(col,uFogCol,clamp(f+m,0.,1.));
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZen,uMid,uHor,uSunDir,uSunCol,uMoonDir,uFogCol; uniform float uStars,uTime,uSunUp,uVeil;
${NOISE}
void main(){
  vec3 rd=normalize(vDir);
  float h=max(rd.y,0.);
  vec3 col=mix(uHor,uMid,smoothstep(0.,.2,h));
  col=mix(col,uZen,smoothstep(.1,.62,h));
  float s=max(dot(rd,uSunDir),0.);
  col+=uSunCol*(pow(s,8.)*.1+pow(s,70.)*.32+pow(s,900.)*1.6)*uSunUp;
  col+=uSunCol*smoothstep(.99982,.99992,s)*60.*uSunUp;
  // moon
  float m=max(dot(rd,uMoonDir),0.);
  col+=vec3(.8,.88,1.)*(smoothstep(.99975,.99985,m)*1.6+pow(m,600.)*.07)*uStars;
  // stars and the band of the galaxy
  if(uStars>0.01 && rd.y>-.05){
    vec3 bn=normalize(vec3(.55,.35,.76));
    float bc=dot(rd,bn);
    float mw=exp(-bc*bc*18.);
    vec2 sp=vec2(atan(rd.x,rd.z)*3.,rd.y*5.);
    float cl=fbm2(sp*1.6+7.);
    float dust=smoothstep(.4,.75,fbm2(sp*2.7+3.));
    vec3 st=mix(vec3(.25,.33,.62),vec3(.75,.6,.5),cl)*mw*(.25+cl)*(1.-dust*.75)*.2;
    for(int k=0;k<2;k++){
      float sc=k==0?130.:260.;
      vec3 p=rd*sc, id=floor(p), f=fract(p)-.5;
      vec3 r=h33(id+float(k)*31.7);
      float d=length(f-(r-.5)*.6);
      float on=smoothstep(.86-.2*mw,1.,r.y);
      float tw=.8+.2*sin(uTime*(1.+r.x*3.)+r.z*40.);
      st+=mix(vec3(.75,.85,1.),vec3(1.,.88,.7),r.x)*on*(.4+4.*pow(r.z,6.))*tw*smoothstep(.1,0.,d);
    }
    col+=st*uStars*smoothstep(-.02,.2,rd.y);
  }
  // high cirrus
  if(rd.y>0.){
    vec2 cp=rd.xz/(rd.y+.14);
    float ci=fbm2(cp*vec2(.5,1.6)+vec2(uTime*.003,3.));
    float cb=smoothstep(.5,.8,ci)*smoothstep(.0,.14,rd.y)*smoothstep(.75,.2,rd.y);
    col=mix(col,mix(uHor,uMid,.5)*(.6+.6*pow(s,3.)),cb*.45*(1.-uStars*.7));
  }
  // inside the cloud deck the sky is only a glow where the sun is
  col=mix(col,uFogCol+uSunCol*pow(s,5.)*.6*uSunUp,uVeil);
  gl_FragColor=vec4(col,1.);
}`;

const TERRAIN_FRAG = /* glsl */ `
precision highp float;
varying vec3 vW; varying vec3 vN; varying float vAo;
uniform vec3 uLightDir,uLightCol,uAmb;
${NOISE}
${FOG}
float rid(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ float n=1.-abs(n2(p)*2.-1.); s+=a*n*n; p=p*2.13+vec2(13.7,3.1); a*=.5; } return s; }
void main(){
  vec3 n=normalize(vN);
  vec3 v=normalize(vW-uCam);
  float dist=length(vW-uCam);
  float lod=smoothstep(1100.,90.,dist);
  // fine relief the mesh cannot carry: creases in the rock, read from the same ridged noise
  vec2 p=vW.xz*.034; float e=.07;
  float d0=rid(p);
  vec2 g=vec2(rid(p+vec2(e,0.))-d0, rid(p+vec2(0.,e))-d0)/e;
  float steep=smoothstep(.1,.5,1.-n.y);
  vec3 nd=normalize(n-vec3(g.x,0.,g.y)*.11*lod*(.3+.7*steep));
  float slope=1.-nd.y;
  float nz=fbm2(vW.xz*.05);

  vec3 forest=vec3(.026,.052,.044), meadow=vec3(.085,.105,.058);
  float strata=.5+.5*sin(vW.y*.42+nz*5.+d0*3.);
  vec3 rock=mix(vec3(.15,.125,.155),vec3(.27,.225,.225),strata*.6+d0*.4);
  float line=smoothstep(95.,135.,vW.y+nz*30.);
  vec3 alb=mix(mix(meadow,forest,smoothstep(.3,.7,nz)),rock,clamp(smoothstep(.2,.5,slope)+line,0.,1.));
  // snow settles on what is high and not too steep, and thins along the creases
  float sn=smoothstep(160.,212.,vW.y+nz*45.+d0*28.)*smoothstep(.74,.36,slope+(d0-.5)*.3);
  alb=mix(alb,vec3(.93,.93,.985),sn);
  alb=mix(alb,vec3(.11,.1,.09),smoothstep(2.5,.2,vW.y));

  float ndl=max(dot(nd,uLightDir),0.);
  float occ=mix(.5,1.,vAo);
  vec3 col=alb*(uLightCol*ndl*1.55*occ+uAmb*(.38+.36*nd.y)*vAo);
  col+=sn*uAmb*.3*(1.-ndl)*vAo;                       // cold light in snow shadow
  col+=uLightCol*alb*pow(1.-max(dot(nd,-v),0.),3.)*max(dot(v,uLightDir),0.)*.5; // lit edge against the sun
  gl_FragColor=vec4(applyFog(col,vW),1.);
}`;

const CLOUD_COMMON = /* glsl */ `
uniform float uTime;
${NOISE}
float cloudH(vec2 p){ return smoothstep(.2,.86,fbm2(p*.0052+vec2(uTime*.003,uTime*.006))/.9375); }
`;

/* ------------------------------------------------------------------ the world */

export type PhotoSpec = { src: string; x: number; y: number; z: number; w: number; h: number };

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.3, 12000);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private final: ShaderPass;
  private shared = {
    uCam: { value: new THREE.Vector3() },
    uFogCol: { value: new THREE.Color() },
    uFogDen: { value: 0.0011 },
    uMist: { value: 1 },
    uLightDir: { value: new THREE.Vector3(0, 1, 0) },
    uLightCol: { value: new THREE.Color() },
    uAmb: { value: new THREE.Color() },
    uTime: { value: 0 },
  };
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private clouds: { group: THREE.Group; mat: THREE.ShaderMaterial };
  private motes: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private water: Water;
  private flies: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private titles = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private shades = new Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>();
  private photos: THREE.Mesh[] = [];
  private orbs = new THREE.Group();
  private scale: number;
  baseFov = 50;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.scale = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setClearColor(0x05060d);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0011);

    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.7, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.final = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uDim: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float uTime; uniform float uDim; varying vec2 vUv;
        float h21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
        void main(){
          vec3 c=texture2D(tDiffuse,vUv).rgb;
          float v=vUv.x*vUv.y*(1.-vUv.x)*(1.-vUv.y);
          c*=mix(.55,1.,pow(clamp(16.*v,0.,1.),.4));
          c*=1.-uDim*.28;
          c+=(h21(gl_FragCoord.xy+fract(uTime)*91.7)-.5)*(2.4/255.);
          gl_FragColor=vec4(c,1.);
        }`,
    });
    this.composer.addPass(this.final);

    this.sky = this.buildSky();
    this.buildTerrain();
    this.buildTrees();
    this.clouds = this.buildClouds();
    this.water = this.buildWater();
    this.flies = this.buildFireflies();
    this.motes = this.buildMotes();
    this.scene.add(this.orbs);
  }

  /* ---------- construction ---------- */

  private buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZen: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uHor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() },
        uSunCol: { value: new THREE.Color() },
        uMoonDir: { value: MOON },
        uStars: { value: 0 },
        uSunUp: { value: 1 },
        uVeil: { value: 0 },
        uFogCol: this.shared.uFogCol,
        uTime: this.shared.uTime,
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: SKY_FRAG,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  private buildTerrain() {
    const NX = 380;
    const NZ = 540;
    const geo = new THREE.PlaneGeometry(1800, 2600, NX, NZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -250);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    // how enclosed each point is by the ground around it: gullies and valley floors sit in shade
    const ao = new Float32Array(pos.count);
    const at = (ix: number, iz: number) => pos.getY(Math.min(NZ, Math.max(0, iz)) * (NX + 1) + Math.min(NX, Math.max(0, ix)));
    for (let iz = 0; iz <= NZ; iz++) {
      for (let ix = 0; ix <= NX; ix++) {
        const h = at(ix, iz);
        let occ = 0;
        for (const r of [2, 5]) {
          const around = (at(ix + r, iz) + at(ix - r, iz) + at(ix, iz + r) + at(ix, iz - r) + at(ix + r, iz + r) + at(ix - r, iz - r) + at(ix + r, iz - r) + at(ix - r, iz + r)) / 8;
          occ += Math.max(0, around - h) / (r * 4.8);
        }
        ao[iz * (NX + 1) + ix] = Math.max(0.22, 1 - occ * 0.9);
      }
    }
    geo.setAttribute('ao', new THREE.BufferAttribute(ao, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shared,
      vertexShader: 'attribute float ao; varying vec3 vW; varying vec3 vN; varying float vAo; void main(){ vW=position; vN=normal; vAo=ao; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: TERRAIN_FRAG,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  private buildTrees() {
    const cone = new THREE.ConeGeometry(1, 2.6, 6, 1, true);
    cone.translate(0, 1.9, 0);
    const N = 9000;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shared,
      vertexShader: /* glsl */ `
        varying vec3 vW; varying float vY; varying vec3 vN;
        void main(){
          vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);
          vW=w.xyz; vY=position.y; vN=normalize(mat3(instanceMatrix)*normal);
          gl_Position=projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vW; varying float vY; varying vec3 vN;
        uniform vec3 uLightDir,uLightCol,uAmb;
        ${FOG}
        void main(){
          vec3 alb=mix(vec3(.012,.03,.028),vec3(.05,.1,.07),smoothstep(.6,3.,vY));
          float ndl=max(dot(normalize(vN),uLightDir)*.6+.4,0.);
          vec3 col=alb*(uLightCol*ndl*1.3+uAmb*.6);
          gl_FragColor=vec4(applyFog(col,vW),1.);
        }`,
    });
    const mesh = new THREE.InstancedMesh(cone, mat, N);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let n = 0;
    let seed = 1;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let tries = 0; n < N && tries < N * 12; tries++) {
      const x = (rnd() - 0.5) * 1100;
      const z = 620 - rnd() * 1500;
      const h = heightAt(x, z);
      if (h < 3.2 || h > 125) continue;
      const slope = Math.hypot(heightAt(x + 2, z) - h, heightAt(x, z + 2) - h) / 2;
      if (slope > 0.75) continue;
      if (fbm(x * 0.012 + 40, z * 0.012, 3) < 0.4 + rnd() * 0.25) continue;
      const k = 1.4 + rnd() * 2.4;
      p.set(x, h - 0.3, z);
      s.set(k * 0.85, k * (0.9 + rnd() * 0.6), k * 0.85);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rnd() * 6.28);
      mesh.setMatrixAt(n++, m.compose(p, q, s));
    }
    mesh.count = n;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private buildClouds() {
    // A slab of cloud, ray-marched per pixel. Two big sheets (its ceiling and its floor) act as the
    // surfaces the march starts from: the ceiling when looking down on it, both when flying through it.
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { ...this.shared, uCloud: { value: 1 }, uInside: { value: 0 }, uBelow: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vW;
        uniform vec3 uLightDir,uLightCol,uAmb; uniform float uCloud,uInside,uBelow;
        ${CLOUD_COMMON}
        ${FOG}
        const float Y0=150., TH=30.;
        float dens(vec3 p, float base){
          float top=Y0+base*TH;
          float er=n2(p.xz*.045+vec2(p.y*.06,uTime*.02))*.6+n2(p.xz*.12-vec2(p.y*.09))*.4;
          float d=(top-p.y)/7.-er*1.7+.3;
          return clamp(d,0.,1.)*smoothstep(Y0-3.,Y0+3.,p.y);
        }
        void main(){
          vec3 ro=uCam, rd=normalize(vW-uCam);
          if(abs(rd.y)<1e-4) discard;
          float tA=(Y0+TH+4.-ro.y)/rd.y, tB=(Y0-2.-ro.y)/rd.y;
          float t0=max(min(tA,tB),0.), t1=min(max(tA,tB),t0+3400.);
          if(t1<=t0) discard;
          float t=t0+h21(gl_FragCoord.xy+fract(uTime)*31.)*3.;
          float T=1.; vec3 acc=vec3(0.);
          vec2 L=normalize(uLightDir.xz+1e-4);
          float sun=pow(max(dot(rd,uLightDir),0.),6.);
          for(int i=0;i<42;i++){
            vec3 p=ro+rd*t;
            float base=cloudH(p.xz);
            float d=dens(p,base);
            float st=2.5+(t-t0)*.035+t*.011;
            if(d>.005){
              float top=Y0+base*TH;
              float hgt=clamp((p.y-Y0)/TH,0.,1.);
              float deep=exp(-max(top-p.y,0.)*.085);
              float lit=clamp(.5+(base-cloudH(p.xz+L*16.))*5.,0.,1.);
              vec3 c=mix(uAmb*.16,uAmb*.85,hgt*hgt)+uLightCol*deep*(.2+.8*lit)*.6+uLightCol*sun*deep*.45;
              c=applyFog(c,p);
              float a=1.-exp(-d*st*.085);
              acc+=T*a*c; T*=1.-a;
              if(T<.03) break;
            } else {
              float gap=p.y-(Y0+base*TH+4.);
              if(rd.y<0. && gap>0.) st=max(st,gap/(-rd.y)*.6);
            }
            t+=min(st,170.);
            if(t>t1) break;
          }
          float a=1.-T;
          vec3 c=mix(acc/max(a,1e-3),uFogCol+uLightCol*pow(max(dot(rd,uLightDir),0.),5.)*.6,uInside*.94);
          // seen from underneath, the far deck thins into the haze instead of ending in a line
          a*=mix(1.,smoothstep(.03,.4,abs(rd.y)),uBelow);
          gl_FragColor=vec4(c, a*uCloud);
        }`,
    });
    const geo = new THREE.PlaneGeometry(16000, 16000);
    geo.rotateX(-Math.PI / 2);
    const group = new THREE.Group();
    [184, 148].forEach((y) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.frustumCulled = false;
      m.renderOrder = 2;
      group.add(m);
    });
    this.scene.add(group);
    return { group, mat };
  }

  /** Dust in the air around the camera: something near to move past. */
  private buildMotes() {
    const N = 700;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = Math.random() * 90;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...this.shared, uOn: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform vec3 uCam; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p=position+vec3(uTime*.5,sin(uTime*.2+position.x)*.6,uTime*.2);
          p=mod(p-uCam+45.,90.)-45.+uCam;
          vec4 mv=viewMatrix*vec4(p,1.);
          vA=smoothstep(45.,25.,-mv.z)*smoothstep(1.,5.,-mv.z);
          gl_PointSize=uPx*(14.+10.*fract(position.y*7.3))/max(-mv.z,1.);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying float vA; uniform float uOn; uniform vec3 uLightCol,uAmb;
        void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4((uLightCol*.5+uAmb)*smoothstep(.5,0.,d)*vA*uOn*.55,1.); }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }

  private buildWater() {
    // A tiling normal map made from noise, so no image has to be downloaded.
    const N = 256;
    const data = new Uint8Array(N * N * 4);
    const wrap = (x: number, y: number) => {
      const u = x / N;
      const v = y / N;
      const f = (a: number, b: number) => fbm(a * 6, b * 6, 4);
      return (
        f(u, v) * (1 - u) * (1 - v) + f(u - 1, v) * u * (1 - v) + f(u, v - 1) * (1 - u) * v + f(u - 1, v - 1) * u * v
      );
    };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (wrap(x + 1, y) - wrap(x - 1, y)) * 10;
        const dy = (wrap(x, y + 1) - wrap(x, y - 1)) * 10;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * N + x) * 4;
        data[i] = (-dx / l) * 127 + 128;
        data[i + 1] = (-dy / l) * 127 + 128;
        data[i + 2] = (1 / l) * 127 + 128;
        data[i + 3] = 255;
      }
    }
    const normals = new THREE.DataTexture(data, N, N);
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    normals.magFilter = THREE.LinearFilter;
    normals.minFilter = THREE.LinearMipmapLinearFilter;
    normals.generateMipmaps = true;
    normals.needsUpdate = true;
    const water = new Water(new THREE.PlaneGeometry(1500, 1500), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x0a1020,
      distortionScale: 1.6,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(LAKE.x, 0, LAKE.z);
    (water.material as THREE.ShaderMaterial).uniforms.size.value = 0.55;
    this.scene.add(water);
    return water;
  }

  private buildFireflies() {
    const N = 420;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 240;
      const z = 180 - Math.random() * 560;
      pos.set([x, heightAt(x, z) + 1.5 + Math.random() * 14, z], i * 3);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.shared.uTime, uOn: { value: 0 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p=position+vec3(sin(uTime*.4+seed*40.),sin(uTime*.3+seed*17.)*.8,cos(uTime*.35+seed*29.))*1.6;
          vec4 mv=modelViewMatrix*vec4(p,1.);
          vA=smoothstep(.15,.9,sin(uTime*(.6+seed)+seed*60.)*.5+.5)*smoothstep(260.,60.,-mv.z);
          gl_PointSize=uPx*(60.+50.*seed)/max(-mv.z,1.);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying float vA; uniform float uOn;
        void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(1.6,1.9,.7)*smoothstep(.5,0.,d)*vA*uOn,1.); }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }

  /* ---------- things the journey places ---------- */

  /** A heading that stands in the world as light. `base` is where its baseline meets the ground or water. */
  setTitle(id: string, text: string, italic: boolean, base: THREE.Vector3, height: number, faceFrom: THREE.Vector3, maxDist: number) {
    let mesh = this.titles.get(id);
    if (!mesh) {
      const px = 220;
      const font = `${italic ? 'italic ' : ''}300 ${px}px "Newsreader Variable", Georgia, serif`;
      const cvs = document.createElement('canvas');
      let ctx = cvs.getContext('2d')!;
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width + px * 0.3);
      cvs.width = w;
      cvs.height = Math.ceil(px * 1.36);
      ctx = cvs.getContext('2d')!;
      ctx.font = font;
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, px * 0.15, px * 1.0);
      const tex = new THREE.CanvasTexture(cvs);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const geo = new THREE.PlaneGeometry(w / px, 1.36);
      geo.translate(0, 0.68 - 0.36, 0); // origin on the baseline
      mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }));
      mesh.renderOrder = 3;
      this.titles.set(id, mesh);
      this.scene.add(mesh);
    }
    mesh.userData.maxDist = maxDist;
    mesh.position.copy(base);
    mesh.scale.setScalar(height);
    mesh.lookAt(faceFrom.x, base.y, faceFrom.z);
  }

  /** A soft patch of shadow in the air behind a block of text. */
  setShade(id: string, center: THREE.Vector3, quat: THREE.Quaternion, w: number, h: number, opacity: number) {
    let mesh = this.shades.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uO: { value: 0 }, uAspect: { value: 1 }, uTime: this.shared.uTime },
          vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
          fragmentShader: /* glsl */ `
            precision highp float; varying vec2 vUv; uniform float uO,uAspect,uTime;
            ${NOISE}
            void main(){
              vec2 p=(vUv-.5)*2.;
              float n=fbm2(vUv*vec2(3.*uAspect,3.)+uTime*.03);
              vec2 q=abs(p);
              float e=.5+.3*n;
              float a=smoothstep(1.,1.-e/max(uAspect,1.),q.x)*smoothstep(1.,1.-e*min(uAspect,1.)*1.,q.y);
              gl_FragColor=vec4(vec3(.012,.012,.03),a*uO);
            }`,
        }),
      );
      mesh.renderOrder = 4;
      this.shades.set(id, mesh);
      this.scene.add(mesh);
    }
    mesh.position.copy(center);
    mesh.quaternion.copy(quat);
    mesh.translateZ(-0.6);
    mesh.scale.set(w, h, 1);
    mesh.material.uniforms.uAspect.value = w / h;
    mesh.userData.base = opacity;
  }
  fadeShade(id: string, k: number) {
    const m = this.shades.get(id);
    if (m) {
      m.material.uniforms.uO.value = (m.userData.base as number) * k;
      m.visible = k > 0.01;
    }
  }

  setPhotos(list: PhotoSpec[]) {
    const loader = new THREE.TextureLoader();
    list.forEach((p, i) => {
      let mesh = this.photos[i];
      if (!mesh) {
        const tex = loader.load(p.src);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: true, transparent: true }));
        const mat = new THREE.MeshBasicMaterial({ color: 0xcfc6b8, fog: true, transparent: true });
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        frame.position.z = -0.02;
        frame.name = 'frame';
        mesh.add(frame);
        this.photos[i] = mesh;
        this.scene.add(mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.set(p.w, p.h, 1);
      const frame = mesh.getObjectByName('frame')!;
      frame.scale.set(1 + 0.14 / p.w, 1 + 0.14 / p.h, 1);
    });
  }

  /** Small lights along the flight through the valley: the dots of the timeline. */
  setOrbs(points: THREE.Vector3[]) {
    this.orbs.clear();
    const geo = new THREE.SphereGeometry(0.11, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.2, 1.6), fog: false });
    points.forEach((p) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(p);
      this.orbs.add(m);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.35 }),
    );
    this.orbs.add(line);
  }

  /* ---------- per frame ---------- */

  /** Called when frames run long: render fewer pixels. Returns false once it cannot go lower. */
  downscale() {
    if (this.scale <= 0.62) return false;
    this.scale = Math.max(0.6, this.scale * 0.8);
    return true;
  }

  resize(w: number, h: number) {
    const k = Math.min(this.scale, Math.sqrt(2.4e6 / Math.max(1, w * h)));
    this.renderer.setPixelRatio(k);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(k);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // keep the horizontal field of view generous on tall phones
    this.baseFov = this.camera.fov = w / h < 0.8 ? 62 : 50;
    this.camera.updateProjectionMatrix();
    this.flies.material.uniforms.uPx.value = (h * k) / 900;
    this.motes.material.uniforms.uPx.value = (h * k) / 900;
  }

  render(tod: number, time: number, dim: number) {
    const i = Math.min(KEYS.length - 2, Math.floor(tod));
    const t = Math.min(1, Math.max(0, tod - i));
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const el = ((a.el + (b.el - a.el) * t) * Math.PI) / 180;
    const az = ((a.az + (b.az - a.az) * t) * Math.PI) / 180;
    const sun = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const sunUp = sm(-0.1, 0.02, el);
    const light = sun.clone().lerp(MOON, 1 - sm(-0.12, -0.02, el)).normalize();
    if (light.y < 0.06) light.setY(0.06).normalize();
    const cam = this.camera.position;
    const S = this.shared;

    // passing through the cloud deck: the air thickens to white, then clears below
    const inCloud = sm(138, 152, cam.y) * sm(188, 174, cam.y);
    const fog = lerp3(a.fog, b.fog, t);
    const mist = lerp3(fog, lerp3(a.light, b.light, t), 0.25);
    S.uFogCol.value.setRGB(...(lerp3(fog, mist, inCloud) as [number, number, number]));
    S.uFogDen.value = 0.0011 * (1 - 0.6 * sm(150, 230, cam.y)) + inCloud * 0.014;
    S.uMist.value = 1 - sm(60, 160, cam.y);
    S.uCam.value.copy(cam);
    S.uLightDir.value.copy(light);
    S.uLightCol.value.setRGB(...(lerp3(a.light, b.light, t) as [number, number, number]));
    S.uAmb.value.setRGB(...(lerp3(a.amb, b.amb, t) as [number, number, number]));
    S.uTime.value = time;
    const sf = this.scene.fog as THREE.FogExp2;
    sf.color.copy(S.uFogCol.value);
    sf.density = S.uFogDen.value;

    const su = this.sky.material.uniforms;
    su.uZen.value.setRGB(...(lerp3(a.zen, b.zen, t) as [number, number, number]));
    su.uMid.value.setRGB(...(lerp3(a.mid, b.mid, t) as [number, number, number]));
    su.uHor.value.setRGB(...(lerp3(a.hor, b.hor, t) as [number, number, number]));
    su.uSunDir.value.copy(sun);
    su.uSunCol.value.setRGB(...(lerp3(a.light, b.light, t) as [number, number, number]));
    su.uSunUp.value = sunUp;
    su.uVeil.value = inCloud * 0.94;
    su.uStars.value = a.stars + (b.stars - a.stars) * t;
    this.sky.position.copy(cam);

    this.clouds.mat.uniforms.uCloud.value = sm(114, 144, cam.y);
    this.clouds.mat.uniforms.uInside.value = inCloud;
    this.clouds.mat.uniforms.uBelow.value = 1 - sm(146, 176, cam.y);
    this.clouds.group.position.set(cam.x, 0, cam.z);
    this.clouds.group.children[0].visible = cam.y > 148; // ceiling
    this.clouds.group.children[1].visible = cam.y > 114 && cam.y < 184; // floor
    this.motes.material.uniforms.uOn.value = 1 - sm(120, 150, cam.y);

    this.water.visible = cam.y < 112;
    const wu = (this.water.material as THREE.ShaderMaterial).uniforms;
    wu.time.value = time * 0.35;
    wu.sunDirection.value.copy(light);
    wu.sunColor.value.copy(S.uLightCol.value).multiplyScalar(0.9);
    wu.waterColor.value.setRGB(...(lerp3(a.water, b.water, t) as [number, number, number]));

    this.flies.material.uniforms.uOn.value = sm(0.3, 0.9, su.uStars.value);
    const tc = lerp3(a.text, b.text, t) as [number, number, number];
    this.titles.forEach((m) => {
      m.material.color.setRGB(...tc);
      const md = m.userData.maxDist as number;
      m.material.opacity = sm(md, md * 0.7, m.position.distanceTo(cam));
      m.visible = m.material.opacity > 0.01;
    });
    for (const ph of this.photos) {
      const o = sm(95, 55, ph.position.distanceTo(cam));
      ph.visible = o > 0.01;
      (ph.material as THREE.MeshBasicMaterial).opacity = o;
      ((ph.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = o;
    }
    this.final.uniforms.uTime.value = time;
    this.final.uniforms.uDim.value = dim;
    this.composer.render();
  }

  dispose() {
    this.renderer.dispose();
  }
}
