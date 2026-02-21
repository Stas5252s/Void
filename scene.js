/**
 * scene.js — VOID
 *
 * 8 acts, ~250vh each. One global scroll value (0→1) drives everything.
 * All geometry/shading lives in GLSL. Acts lazy-compile on approach.
 *
 * Act 0  Genesis   — 3000 particles orbit then converge to Fibonacci sphere
 * Act 1  Expansion — Icosahedron faces explode with per-face axis rotation
 * Act 2  Pulse     — 3-layer simplex noise blob + animated colour ripples
 * Act 3  Fracture  — Octahedron spins apart face-by-face, gold wire fades
 * Act 4  Warp      — Gravitational grid sinks, CSS chroma aberration blooms
 * Act 5  Collapse  — 2500 plasma particles spiral into black hole
 * Act 6  Rebirth   — TorusKnot grows with easeOutBack + neon pulse stripes
 * Act 7  Infinite  — 28-ring tunnel, camera dives into the vanishing point
 */

const Scene3D = (() => {
  /* ── Setup ─────────────────────────────────────────────────────── */
  const cv = document.getElementById("c");
  const W = () => window.innerWidth,
    H = () => window.innerHeight;

  const R = new THREE.WebGLRenderer({
    canvas: cv,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  R.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  R.setSize(W(), H());
  R.setClearColor(0x060606, 1);
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.01, 500);
  camera.position.set(0, 0, 7);

  /* ── Lights ────────────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0x0a0a0a, 1));
  const SUN = new THREE.DirectionalLight(0xfff3e0, 4.5);
  SUN.position.set(4, 7, 5);
  scene.add(SUN);
  const RIM = new THREE.DirectionalLight(0x2244cc, 2.2);
  RIM.position.set(-5, -2, -4);
  scene.add(RIM);
  const GLD = new THREE.DirectionalLight(0xc9a55a, 1.2);
  GLD.position.set(1, -5, 2);
  scene.add(GLD);

  /* ── Shared GLSL ───────────────────────────────────────────────── */
  const SNOISE = /* glsl */ `
    vec3 _289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec4 _289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 _perm(vec4 x){return _289(((x*34.)+1.)*x);}
    float snoise(vec3 v){
      const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy)),x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz),l=1.-g;
      vec3 i1=min(g.xyz,l.zxy),i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx,x2=x0-i2+C.yyy,x3=x0-D.yyy;
      i=_289(i);
      vec4 p=_perm(_perm(_perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      vec3 ns=vec3(1./7.)*(vec4(.2,.5,.8,1.+1./3.)).wyz-(vec4(.2,.5,.8,1.+1./3.)).xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z),x_=floor(j*ns.z),y_=floor(j-7.*x_);
      vec4 x=x_*ns.x+ns.yyyy,y=y_*ns.x+ns.yyyy,h=1.-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy),b1=vec4(x.zw,y.zw),s0=floor(b0)*2.+1.,s1=floor(b1)*2.+1.,sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy,a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x),p1=vec3(a0.zw,h.y),p2=vec3(a1.xy,h.z),p3=vec3(a1.zw,h.w);
      vec4 nm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  const EASE = /* glsl */ `
    float eOE(float x){return x>=1.?1.:1.-pow(2.,-10.*x);}
    float eIE(float x){return x==0.?0.:pow(2.,10.*x-10.);}
    float eOB(float x){float c1=1.70158,c3=c1+1.;return 1.+c3*pow(x-1.,3.)+c1*pow(x-1.,2.);}
    float eIO(float t){return t<.5?4.*t*t*t:1.-pow(-2.*t+2.,3.)/2.;}`;

  /* ── Helpers ───────────────────────────────────────────────────── */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const N_ACTS = 8;
  // progress 0→1 within act i
  const aRange = (g, i) => {
    const w = 1 / N_ACTS;
    return clamp((g - i * w) / w, 0, 1);
  };
  // smooth presence 0→1 centered on act i, cross-fades with neighbours
  const aOp = (g, i) => {
    const w = 1 / N_ACTS,
      c = (i + 0.5) * w;
    return clamp(1 - Math.abs(g - c) / (w * 1.15), 0, 1);
  };

  /* ── Lazy act system ───────────────────────────────────────────── */
  const ACTS = [];
  const reg = (fn) => ACTS.push({ fn, mesh: null, ex: null, ok: false });
  const ensure = (i) => {
    if (i < 0 || i >= ACTS.length || ACTS[i].ok) return;
    ACTS[i].ok = true;
    const r = ACTS[i].fn();
    ACTS[i].mesh = r.m;
    ACTS[i].ex = r.x || null;
    // Force GPU shader compilation now (invisible render)
    if (r.m) {
      r.m.visible = true;
      R.compile(scene, camera);
      r.m.visible = false;
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     ACT 0 — GENESIS
     3000 particles start as a random cloud, converge to a Fibonacci
     sphere. Each particle has a staggered delay so they arrive in
     a slow wave. Once assembled, the sphere gently rotates and the
     surface shimmers with noise.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const N = 3000,
      geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3),
      seed = new Float32Array(N * 3),
      idx = new Float32Array(N);
    const PHI = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2,
        r = Math.sqrt(Math.max(0, 1 - y * y)),
        th = PHI * i;
      seed[i * 3] = (Math.random() - 0.5) * 20;
      seed[i * 3 + 1] = (Math.random() - 0.5) * 20;
      seed[i * 3 + 2] = (Math.random() - 0.5) * 20;
      pos[i * 3] = Math.cos(th) * r * 1.65;
      pos[i * 3 + 1] = y * 1.65;
      pos[i * 3 + 2] = Math.sin(th) * r * 1.65;
      idx[i] = i / N;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    geo.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { u_t: { value: 0 }, u_time: { value: 0 }, u_op: { value: 0 } },
      vertexShader: `${SNOISE}${EASE}
        attribute vec3 aSeed; attribute float aIdx;
        uniform float u_t, u_time;
        varying float vB, vA;
        void main(){
          float delay=aIdx*.45, lt=clamp((u_t-delay)/(1.-delay*.5),0.,1.), t=eOE(lt);
          // Particles also spiral inward (helical path)
          float spin=mix(aIdx*8.,0.,t);
          vec3 src=aSeed;
          src=vec3(src.x*cos(spin)-src.z*sin(spin), src.y, src.x*sin(spin)+src.z*cos(spin));
          vec3 p=mix(src, position, t);
          // Assembled surface shimmer
          p+=snoise(p*2.2+u_time*.35)*mix(.18,.015,t);
          vB=t; vA=aIdx;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
          gl_PointSize=mix(3.,1.3,t)*(550./max(length((modelViewMatrix*vec4(p,1.)).xyz),.1));
        }`,
      fragmentShader: `uniform float u_op; varying float vB, vA;
        void main(){
          float d=length(gl_PointCoord-.5); if(d>.5)discard;
          // Colour shifts from gold→warm white as they settle
          vec3 col=mix(vec3(.95,.72,.3), vec3(.93,.90,.84), vB);
          float a=(1.-smoothstep(.3,.5,d))*u_op;
          gl_FragColor=vec4(col, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const m = new THREE.Points(geo, mat);
    m.name = "genesis";
    m.visible = false;
    scene.add(m);
    return { m, x: { mat } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 1 — EXPANSION
     Each triangle of an icosahedron flies outward along its own
     random direction, rotating around its face normal as it goes.
     The departure is staggered by face index — outer faces leave
     first, creating a slow bloom.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const src = new THREE.IcosahedronGeometry(1.65, 2).toNonIndexed();
    const n = src.attributes.position.count,
      pos = src.attributes.position.array;
    const fc = new Float32Array(n * 3),
      dir = new Float32Array(n * 3),
      fi = new Float32Array(n);

    for (let f = 0; f < n / 3; f++) {
      const i = f * 3;
      const cx = (pos[i * 3] + pos[i * 3 + 3] + pos[i * 3 + 6]) / 3;
      const cy = (pos[i * 3 + 1] + pos[i * 3 + 4] + pos[i * 3 + 7]) / 3;
      const cz = (pos[i * 3 + 2] + pos[i * 3 + 5] + pos[i * 3 + 8]) / 3;
      const l = Math.hypot(cx, cy, cz) || 1;
      const rx = (Math.random() - 0.5) * 0.55,
        ry = (Math.random() - 0.5) * 0.55,
        rz = (Math.random() - 0.5) * 0.55;
      for (let v = 0; v < 3; v++) {
        const vi = i + v;
        fc[vi * 3] = cx;
        fc[vi * 3 + 1] = cy;
        fc[vi * 3 + 2] = cz;
        dir[vi * 3] = cx / l + rx;
        dir[vi * 3 + 1] = cy / l + ry;
        dir[vi * 3 + 2] = cz / l + rz;
        fi[vi] = f / (n / 3 - 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", src.attributes.position);
    geo.setAttribute("normal", src.attributes.normal);
    geo.setAttribute("aFc", new THREE.BufferAttribute(fc, 3));
    geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    geo.setAttribute("aFi", new THREE.BufferAttribute(fi, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_explode: { value: 0 },
        u_op: { value: 0 },
        u_time: { value: 0 },
      },
      vertexShader: `${EASE}
        attribute vec3 aFc,aDir; attribute float aFi;
        uniform float u_explode, u_time;
        varying vec3 vN; varying float vE;
        void main(){
          float lt=clamp((u_explode-aFi*.3)/(1.-aFi*.25),0.,1.), t=eIE(lt); vE=t;
          vec3 ax=normalize(aDir), loc=position-aFc;
          // Rodrigues rotation around face's outward axis
          float ang=t*3.14159*(1.3+aFi*.8), s=sin(ang), c=cos(ang);
          vec3 rot=loc*c+cross(ax,loc)*s+ax*dot(ax,loc)*(1.-c);
          // Slight tumble on secondary axis for chaos
          float ang2=t*2.8*(1.-aFi*.4); float s2=sin(ang2), c2=cos(ang2);
          rot=vec3(rot.x*c2-rot.y*s2, rot.x*s2+rot.y*c2, rot.z);
          vec3 p=aFc+rot+aDir*t*5.5;
          vN=normalMatrix*normal;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform float u_op; varying vec3 vN; varying float vE;
        void main(){
          vec3 L=normalize(vec3(4.,7.,5.)), N=normalize(vN);
          float d=max(dot(N,L),0.);
          // Gold rim glow at the moment of departure
          float rim=pow(1.-d,3.)*vE*1.4;
          vec3 col=mix(vec3(.06),vec3(.91,.88,.80),d);
          col+=rim*vec3(.85,.62,.18);
          gl_FragColor=vec4(col, u_op*(1.-vE*.4));
        }`,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.name = "expansion";
    m.visible = false;
    scene.add(m);
    return { m, x: { mat } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 2 — PULSE
     A sphere displaced by 3 stacked simplex layers at different
     frequencies. The scroll position controls the breath amplitude.
     Colour ripples pulse outward from the equator over time.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_scroll: { value: 0 },
        u_op: { value: 0 },
      },
      vertexShader: `${SNOISE}
        uniform float u_time, u_scroll;
        varying vec3 vP; varying float vN;
        void main(){
          float n1=snoise(position*1.05+u_time*.28)*.34;
          float n2=snoise(position*2.6-u_time*.19)*.11;
          float n3=snoise(position*5.8+u_time*.52)*.04;
          float n=n1+n2+n3; vN=n;
          float breath=sin(u_scroll*6.2832)*0.14 + cos(u_scroll*3.1416)*0.06;
          vec3 p=normal*(1.52+n+breath); vP=p;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform float u_time, u_op;
        varying vec3 vP; varying float vN;
        void main(){
          vec3 N=normalize(vP), L=normalize(vec3(4.,7.,5.));
          float d=max(dot(N,L),0.), rim=pow(1.-d,4.)*.8;
          // Radial colour wave + secondary cross wave
          float w1=sin(length(vP.xz)*3.5-u_time*1.3)*.5+.5;
          float w2=sin(vP.y*4.+u_time*.9)*.5+.5;
          vec3 cA=vec3(.93,.89,.81), cB=vec3(.15,.38,.78), cC=vec3(.78,.52,.18);
          vec3 col=mix(cA,cB,w1*.6); col=mix(col,cC,vN*2.2+w2*.15);
          col=mix(col*.05, col, d) + rim*vec3(.82,.66,.28);
          gl_FragColor=vec4(col, u_op);
        }`,
      transparent: true,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.52, 96, 96), mat);
    m.name = "pulse";
    m.visible = false;
    scene.add(m);
    return { m, x: { mat } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 3 — FRACTURE
     Octahedron fragments scatter with spin, gold wireframe fades
     as chaos grows.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const src = new THREE.OctahedronGeometry(1.65, 2).toNonIndexed();
    const n = src.attributes.position.count,
      pos = src.attributes.position.array;
    const fc = new Float32Array(n * 3),
      ch = new Float32Array(n * 3),
      fi = new Float32Array(n);
    for (let f = 0; f < n / 3; f++) {
      const i = f * 3;
      const cx = (pos[i * 3] + pos[i * 3 + 3] + pos[i * 3 + 6]) / 3;
      const cy = (pos[i * 3 + 1] + pos[i * 3 + 4] + pos[i * 3 + 7]) / 3;
      const cz = (pos[i * 3 + 2] + pos[i * 3 + 5] + pos[i * 3 + 8]) / 3;
      const d = Math.random() * 3.5 + 1;
      for (let v = 0; v < 3; v++) {
        fc[(i + v) * 3] = cx;
        fc[(i + v) * 3 + 1] = cy;
        fc[(i + v) * 3 + 2] = cz;
        ch[(i + v) * 3] = (Math.random() - 0.5) * d;
        ch[(i + v) * 3 + 1] =
          (Math.random() - 0.5) * d + (Math.random() - 0.5) * 2;
        ch[(i + v) * 3 + 2] = (Math.random() - 0.5) * d;
        fi[i + v] = f / (n / 3 - 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", src.attributes.position);
    geo.setAttribute("aFc", new THREE.BufferAttribute(fc, 3));
    geo.setAttribute("aCh", new THREE.BufferAttribute(ch, 3));
    geo.setAttribute("aFi", new THREE.BufferAttribute(fi, 1));

    // Gold wireframe — same geometry but EdgesGeometry
    const wGeo = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.65, 2));
    const wMat = new THREE.LineBasicMaterial({
      color: 0xc9a55a,
      transparent: true,
      opacity: 0,
    });
    const wire = new THREE.LineSegments(wGeo, wMat);
    wire.name = "frac-wire";
    scene.add(wire);

    const mat = new THREE.ShaderMaterial({
      uniforms: { u_t: { value: 0 }, u_op: { value: 0 }, u_time: { value: 0 } },
      vertexShader: `${EASE}
        attribute vec3 aFc,aCh; attribute float aFi;
        uniform float u_t, u_time;
        varying float vT, vFi;
        void main(){
          float lt=clamp((u_t-aFi*.38)/(1.-aFi*.3),0.,1.), t=eIE(lt); vT=t; vFi=aFi;
          vec3 loc=position-aFc;
          // Spin around random axis per face
          float sp=t*6.2832*(1.2+aFi*.6), cs=cos(sp), ss=sin(sp);
          loc=vec3(loc.x*cs-loc.y*ss, loc.x*ss+loc.y*cs, loc.z);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(aFc+loc+aCh*t, 1.);
        }`,
      fragmentShader: `uniform float u_op; varying float vT, vFi;
        void main(){
          vec3 col=mix(vec3(.90,.86,.80), mix(vec3(.78,.58,.20), vec3(.9,.2,.05), vFi), vT);
          gl_FragColor=vec4(col, u_op*(1.-vT*.65));
        }`,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.name = "fracture";
    m.visible = false;
    scene.add(m);
    return { m, x: { mat, wire, wMat } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 4 — WARP
     An 80×80 plane grid deformed by a gravitational well + two
     noise layers. CSS filter adds chromatic aberration on the main
     canvas (cheap, GPU-side). A glowing blue core orb sits at the
     well centre.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_scroll: { value: 0 },
        u_op: { value: 0 },
      },
      vertexShader: `${SNOISE}
        uniform float u_time, u_scroll;
        varying float vH; varying vec2 vUv;
        void main(){
          vUv=uv; vec3 p=position;
          float r=length(p.xy);
          float well=exp(-r*r*.16)*u_scroll*2.2;
          float n1=snoise(vec3(p.xy*.55, u_time*.22))*.42;
          float n2=snoise(vec3(p.xy*1.9, u_time*.48))*.13;
          p.z=(n1+n2-well)*1.25; vH=p.z;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform float u_op, u_time;
        varying float vH; varying vec2 vUv;
        void main(){
          vec2 gv=fract(vUv*20.)-.5;
          float line=smoothstep(.045,.0, min(abs(gv.x),abs(gv.y)));
          // Depth-based colour: shallow=dim, deep=electric blue
          float depth=vH*.5+.5;
          vec3 lo=vec3(.04,.03,.12), hi=vec3(.20,.62,.98);
          vec3 col=mix(lo,hi,depth);
          col=mix(vec3(.015),col,line*1.3);
          // Subtle gold cross-hatch at intersections
          float cross=smoothstep(.12,.0,length(gv));
          col=mix(col, vec3(.78,.58,.20)*depth, cross*.4);
          gl_FragColor=vec4(col, u_op*(line*.92+.04));
        }`,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9, 80, 80), mat);
    m.rotation.x = -Math.PI * 0.36;
    m.name = "warp";
    m.visible = false;
    scene.add(m);

    // Blue core orb with point light feel
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x3377ff,
        transparent: true,
        opacity: 0,
      })
    );
    core.name = "warp-core";
    scene.add(core);
    return { m, x: { mat, core } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 5 — COLLAPSE
     2500 plasma particles spiral inward (shrinking radius + growing
     angle per frame). Color encodes heat: blue→orange→white.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const N = 2500,
      geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3),
      seed = new Float32Array(N * 3),
      idx = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 1.4 + Math.random() * 0.9;
      const th = (i / N) * Math.PI * 22,
        ph = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(ph) * Math.cos(th),
        y = r * Math.sin(ph) * Math.sin(th),
        z = r * Math.cos(ph);
      pos[i * 3] = seed[i * 3] = x;
      pos[i * 3 + 1] = seed[i * 3 + 1] = y;
      pos[i * 3 + 2] = seed[i * 3 + 2] = z;
      idx[i] = i / N;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    geo.setAttribute("aIdx", new THREE.BufferAttribute(idx, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { u_t: { value: 0 }, u_time: { value: 0 }, u_op: { value: 0 } },
      vertexShader: `${EASE}
        attribute vec3 aSeed; attribute float aIdx;
        uniform float u_t, u_time;
        varying float vHeat, vDist;
        void main(){
          float lt=clamp((u_t-aIdx*.22)/(1.-aIdx*.18),0.,1.), t=eIE(lt);
          float r=length(aSeed.xy), nr=r*(1.-t*.988);
          float spin=12.*t+aIdx*3.5+u_time*.4*(1.-t);
          float a=atan(aSeed.y,aSeed.x)+spin;
          vec3 p=vec3(cos(a)*nr, sin(a)*nr, aSeed.z*(1.-t)*.9);
          vHeat=1.-clamp(nr/.35,0.,1.); vDist=nr;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
          gl_PointSize=mix(2.2,4.5,1.-t)*(380./max(length((modelViewMatrix*vec4(p,1.)).xyz),.1));
        }`,
      fragmentShader: `uniform float u_op; varying float vHeat, vDist;
        void main(){
          float d=length(gl_PointCoord-.5); if(d>.5)discard;
          // Blue → orange → white heat gradient
          vec3 cold=vec3(.12,.22,.85), hot=vec3(1.,.32,.06), white=vec3(1.,.92,.62);
          vec3 col=mix(cold,hot,vHeat); col=mix(col,white,vHeat*vHeat);
          float a=(1.-smoothstep(.3,.5,d))*u_op;
          gl_FragColor=vec4(col,a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const m = new THREE.Points(geo, mat);
    m.name = "collapse";
    m.visible = false;
    scene.add(m);
    return { m, x: { mat } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 6 — REBIRTH
     TorusKnot grows from nothing with easeOutBack overshoot.
     Two animated sine stripes pulse neon green/magenta along the
     surface. Displaced by low-freq noise so it breathes.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_grow: { value: 0 },
        u_op: { value: 0 },
      },
      vertexShader: `${SNOISE}${EASE}
        uniform float u_time, u_grow;
        varying vec3 vP; varying vec3 vN;
        void main(){
          float n=snoise(position*1.45+u_time*.22)*.075;
          vec3 p=(position+normal*n)*eOB(clamp(u_grow*1.35,0.,1.));
          vP=p; vN=normalMatrix*normalize(normal+vec3(n));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform float u_time, u_op;
        varying vec3 vP; varying vec3 vN;
        void main(){
          vec3 L=normalize(vec3(4.,7.,5.)), N=normalize(vN);
          float d=max(dot(N,L),0.), rim=pow(1.-d,5.)*1.8;
          // Neon stripes
          float s1=sin(vP.y*6.+vP.x*3.2+u_time*1.9)*.5+.5;
          float s2=cos(vP.z*5.2-vP.y*2.+u_time*1.4)*.5+.5;
          float s3=sin(length(vP.xz)*4.+u_time*2.2)*.5+.5;
          vec3 nGrn=vec3(.08,.95,.58), nMag=vec3(.95,.12,.82), base=vec3(.90,.86,.80);
          vec3 col=mix(base, nGrn, s1*.55);
          col=mix(col, nMag, s2*s3*.45);
          col=mix(col*.04, col, d) + rim*(nMag*.7+nGrn*.3);
          gl_FragColor=vec4(col, u_op);
        }`,
      transparent: true,
    });
    const m = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.1, 0.3, 180, 18, 2, 3),
      mat
    );
    m.name = "rebirth";
    m.visible = false;
    scene.add(m);
    return { m, x: { mat } };
  });

  /* ═══════════════════════════════════════════════════════════════
     ACT 7 — INFINITE
     28 concentric rings forming a tunnel. Each ring has its own
     shader with a pulsing colour wave. As scroll increases the
     group z-position advances — camera feels like it's rushing
     through the tunnel toward a white singularity.
  ═══════════════════════════════════════════════════════════════ */
  reg(() => {
    const group = new THREE.Group(),
      NR = 28,
      mats = [];
    for (let i = 0; i < NR; i++) {
      const t = i / NR,
        r = lerp(0.03, 3.0, t);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_t: { value: t },
          u_op: { value: 0 },
          u_scroll: { value: 0 },
        },
        vertexShader: `${SNOISE}
          uniform float u_time, u_t, u_scroll;
          varying float vT;
          void main(){
            // Rings wobble more near the entrance, less at vanishing pt
            float w=snoise(position*3.+u_time*(1.+u_t*2.))*(1.-u_t)*.05;
            vec3 p=position+normal*w; vT=u_t;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
          }`,
        fragmentShader: `uniform float u_op, u_time, u_t;
          varying float vT;
          void main(){
            // Depth colour: dark indigo far → electric teal near → white at origin
            float pulse=sin(u_time*2.8-vT*14.)*.5+.5;
            float pulse2=cos(u_time*1.6+vT*8.)*.5+.5;
            vec3 far=vec3(.04,.05,.16), mid=vec3(.10,.65,.92), near=vec3(1.,.95,.78);
            vec3 col=mix(far, mid, 1.-vT);
            col=mix(col, near, pow(1.-vT,4.));
            col=mix(col, col*1.6, pulse*(1.-vT)*.7);
            col+=pulse2*(1.-vT)*.5*vec3(.2,.8,.6);
            gl_FragColor=vec4(col, u_op*(1.-vT*.2));
          }`,
        transparent: true,
      });
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.007 + r * 0.003, 4, 72),
        mat
      );
      mesh.position.z = lerp(5, -10, t);
      group.add(mesh);
      mats.push(mat);
    }
    group.name = "infinite";
    group.visible = false;
    scene.add(group);
    return { m: group, x: { mats } };
  });

  /* ── CSS Chromatic Aberration (for warp act) ───────────────────── */
  function chroma(v) {
    if (v < 0.01) {
      cv.style.filter = "none";
      return;
    }
    const px = Math.round(v * 5);
    cv.style.filter = `drop-shadow(${px}px 0 0 rgba(255,0,80,.3)) drop-shadow(${-px}px 0 0 rgba(0,120,255,.3))`;
  }

  /* ── Cinematic camera path per act ────────────────────────────── */
  const CAM = [
    { x: 0, y: 0, z: 7, lx: 0, ly: 0, lz: 0 }, // 0 Genesis
    { x: 1.5, y: 0.5, z: 6, lx: 0.2, ly: 0.1, lz: 0 }, // 1 Expansion
    { x: -1.1, y: 0.3, z: 6, lx: -0.1, ly: 0.05, lz: 0 }, // 2 Pulse
    { x: 0.9, y: -0.4, z: 5.5, lx: 0.1, ly: -0.05, lz: 0 }, // 3 Fracture
    { x: 0, y: 2, z: 4.5, lx: 0, ly: 0.5, lz: -1 }, // 4 Warp (top-down)
    { x: 0, y: 0, z: 5.5, lx: 0, ly: 0, lz: 0 }, // 5 Collapse
    { x: -1.2, y: 0.5, z: 6, lx: -0.1, ly: 0.05, lz: 0 }, // 6 Rebirth
    { x: 0, y: 0, z: 1.5, lx: 0, ly: 0, lz: -8 }, // 7 Infinite (inside)
  ];

  // Object X offsets (alternate left/right to give text room)
  const SIDE = [1.5, -1.5, -1.5, 1.4, 0, 1.3, -1.3, 0];

  /* ── State ─────────────────────────────────────────────────────── */
  let time = 0,
    sm = 0,
    raw = 0,
    hiInit = -1;
  let camX = 0,
    camY = 0,
    camZ = 7,
    lkX = 0,
    lkY = 0,
    lkZ = 0;
  let mX = 0,
    mY = 0,
    smX = 0,
    smY = 0;
  const eio = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

  document.addEventListener(
    "mousemove",
    (e) => {
      mX = (e.clientX / W() - 0.5) * 2;
      mY = (e.clientY / H() - 0.5) * -2;
    },
    { passive: true }
  );

  /* ── Render loop ───────────────────────────────────────────────── */
  function frame() {
    requestAnimationFrame(frame);
    time += 0.0075;
    sm += (raw - sm) * 0.04; // ultra-smooth global
    smX += (mX - smX) * 0.042;
    smY += (mY - smY) * 0.042;

    const g = sm;

    // Lazy init: current act + 2 ahead
    const cur = Math.min(Math.floor(g * N_ACTS), 7);
    for (let k = 0; k <= 2; k++) {
      const ai = cur + k;
      if (ai < N_ACTS && ai > hiInit) {
        ensure(ai);
        hiInit = ai;
      }
    }

    // Camera: lerp between adjacent waypoints
    const af = g * 7,
      ai = Math.min(Math.floor(af), 6),
      at = af - ai;
    const A = CAM[ai],
      B = CAM[ai + 1] || CAM[7];
    const st = eio(at);
    camX = lerp(camX, lerp(A.x, B.x, st), 0.04);
    camY = lerp(camY, lerp(A.y, B.y, st), 0.04);
    camZ = lerp(camZ, lerp(A.z, B.z, st), 0.04);
    lkX = lerp(lkX, lerp(A.lx, B.lx, st), 0.04);
    lkY = lerp(lkY, lerp(A.ly, B.ly, st), 0.04);
    lkZ = lerp(lkZ, lerp(A.lz, B.lz, st), 0.04);
    camera.position.set(camX + smX * 0.32, camY + smY * 0.2, camZ);
    camera.lookAt(lkX + smX * 0.08, lkY + smY * 0.08, lkZ);

    let warpOn = false;

    ACTS.forEach((act, i) => {
      if (!act.ok || !act.mesh) return;
      const op = aOp(g, i),
        ar = aRange(g, i),
        vis = op > 0.01;
      act.mesh.visible = vis;
      if (!vis) {
        if (i === 4) chroma(0);
        return;
      }

      // Smooth X drift to assigned side
      act.mesh.position.x = lerp(act.mesh.position.x, SIDE[i], 0.05);

      const { ex: x } = act;

      switch (i) {
        case 0: // Genesis
          act.mesh.rotation.y = time * 0.14;
          act.mesh.rotation.x = Math.sin(time * 0.32) * 0.05;
          x.mat.uniforms.u_t.value = ar;
          x.mat.uniforms.u_time.value = time;
          x.mat.uniforms.u_op.value = op;
          break;

        case 1: // Expansion
          act.mesh.rotation.y = time * 0.18 + ar * 2.2;
          act.mesh.rotation.x = ar * 0.55;
          act.mesh.rotation.z = Math.sin(time * 0.2) * 0.06;
          x.mat.uniforms.u_explode.value = ar;
          x.mat.uniforms.u_op.value = op;
          x.mat.uniforms.u_time.value = time;
          break;

        case 2: // Pulse
          act.mesh.rotation.y = time * 0.16;
          act.mesh.rotation.x = Math.sin(time * 0.38) * 0.11;
          x.mat.uniforms.u_time.value = time;
          x.mat.uniforms.u_scroll.value = ar;
          x.mat.uniforms.u_op.value = op;
          break;

        case 3: {
          // Fracture
          act.mesh.rotation.y = time * 0.22;
          act.mesh.rotation.z = time * 0.07;
          x.mat.uniforms.u_t.value = ar;
          x.mat.uniforms.u_op.value = op;
          x.mat.uniforms.u_time.value = time;
          // Wire follows same transform
          x.wire.visible = vis;
          x.wire.rotation.copy(act.mesh.rotation);
          x.wire.position.copy(act.mesh.position);
          x.wMat.opacity = op * (1 - ar * 0.85) * 0.55;
          break;
        }

        case 4: {
          // Warp + chroma
          warpOn = true;
          act.mesh.rotation.z = time * 0.045;
          x.mat.uniforms.u_time.value = time;
          x.mat.uniforms.u_scroll.value = ar;
          x.mat.uniforms.u_op.value = op;
          // Core orb pulses
          x.core.visible = vis;
          x.core.position.set(act.mesh.position.x, 0, 0);
          x.core.material.opacity = op * ar * 0.95;
          x.core.scale.setScalar(0.3 + Math.sin(time * 2.8) * ar * 0.18);
          chroma(op * ar * 0.9);
          break;
        }

        case 5: // Collapse
          act.mesh.rotation.z = time * 0.28;
          act.mesh.rotation.y = time * 0.06;
          x.mat.uniforms.u_t.value = ar;
          x.mat.uniforms.u_time.value = time;
          x.mat.uniforms.u_op.value = op;
          break;

        case 6: // Rebirth
          act.mesh.rotation.y = time * 0.28;
          act.mesh.rotation.x = time * 0.11;
          x.mat.uniforms.u_time.value = time;
          x.mat.uniforms.u_grow.value = ar;
          x.mat.uniforms.u_op.value = op;
          break;

        case 7: // Infinite tunnel
          // Rush forward: tunnel advances toward camera
          act.mesh.position.z = ar * 7;
          act.mesh.rotation.z = time * 0.09;
          x.mats.forEach((m) => {
            m.uniforms.u_time.value = time;
            m.uniforms.u_op.value = op;
            m.uniforms.u_scroll.value = ar;
          });
          break;
      }
    });

    if (!warpOn) chroma(0);
    R.render(scene, camera);
  }

  // Warm first 2 acts immediately, then signal loader
  setTimeout(() => {
    ensure(0);
    ensure(1);
    hiInit = 1;
    window.LOADER_READY && window.LOADER_READY();
  }, 600);

  frame();

  window.addEventListener("resize", () => {
    R.setSize(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  });

  return {
    update(g) {
      raw = g;
    },
  };
})();
