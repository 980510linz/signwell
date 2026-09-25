/* SIGN WELL · Jelly Glass Ring Hero R9.2.1
   Real-time ray-traced glass torus. Vanilla WebGL, no dependencies, CSP-safe.

   - The ring is a signed-distance torus. Each pixel casts a camera ray; rays that
     reach the ring refract in, travel through the glass (with total internal
     reflection), refract out and may pass through the far side of the ring again.
   - SIGN WELL sits on a real 3D plane through the ring's centre, so the ring
     passes in front of, through and behind the letters as it turns.
   - Exact Fresnel, per-channel dispersion, thin-film sheen, a studio environment,
     jelly in-scatter and Beer-Lambert tint give the photographic glass look.
   - Background: pastel studio with drifting blue/pink glows, satin light folds (波光)
     that undulate across the floor, and silky caustic ribbons under the ring.
   - Jelly motion: travelling waves around the ring plus spring-damped squash and
     stretch, excited by the float bob, dragging and tapping.
   Mount API is unchanged: [data-liquid-hero] host containing a <canvas>. */
(() => {
  'use strict';

  const VERSION = 'R9.2.1-jelly-raytraced-glass-studio';
  const DEG = Math.PI / 180;

  /* ---- Look and motion settings ------------------------------------------ */
  const CFG = {
    fovY: 24 * DEG,
    camZ: 10.5,
    tube: 0.36,              // tube radius / ring radius
    wall: 1.0,               // glass wall thickness in ring radii (>= 2 x tube = solid ring)
    ringSize: 0.78,          // outer radius as a fraction of the half-height
    ringLift: 0.10,          // ring centre height, fraction of the half-height
    ior: 1.40,               // refraction (1 = none)
    iorFresnel: 1.5,         // reflection strength: real glass
    dispersion: 0.018,       // IOR spread between red and blue (scaled by ior - 1)
    spinRate: 0.24,          // rad/s, constant angular velocity
    spinAxis: [-0.014, 0.819, 0.574],   // tilted toward the camera: the ring tumbles, never lies flat or edge-on
    baseRoll: 36,            // deg, on-screen angle of the ring's long axis at t = 0
    baseTilt: -52,           // deg, tilt away from face-on at t = 0
    textZ: -0.22,            // text plane depth in ring radii (0 = through the centre)
    backZ: -2.6,             // backdrop depth in ring radii
    floatAmp: 0.020,         // float bob, in ring radii
    floatRate: 1.1,          // rad/s
    tiltRange: 0.16,         // rad, pointer parallax
    jelly: 1,                // jelly strength: 0 = rigid glass, 1 = default, 2 = very wobbly
    word: 'SIGN WELL',
    tracking: 0.035,         // em
    font: '-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue","Noto Sans TC","Noto Sans CJK TC","PingFang TC","Segoe UI",Arial,sans-serif',
  };

  const TIERS = {
    high: { stepsOut: 90, stepsIn: 40, maxEv: 14, aa: 5, glassDetail: 1, maxPixels: 3300000, dprCap: 2, fps: 60 },
    mid:  { stepsOut: 70, stepsIn: 32, maxEv: 12, aa: 4, glassDetail: 0, maxPixels: 1100000, dprCap: 2, fps: 60 },
    low:  { stepsOut: 56, stepsIn: 26, maxEv: 10, aa: 1, glassDetail: 0, maxPixels: 520000,  dprCap: 1.5, fps: 40 },
  };

  /* ---- Shaders ----------------------------------------------------------- */
  const VS1 = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';
  const VS2 = '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  const FS = `
uniform vec2 uRes;
uniform float uAspect;
uniform float uTanHalf;
uniform float uCamZ;
uniform vec3 uCenter;
uniform mat3 uInvM;
uniform mat3 uNrmM;
uniform float uBoundR;
uniform float uOff;
uniform float uS;
uniform float uTube;
uniform float uWall;
uniform vec4 uWaveR;
uniform vec4 uWaveZ;
uniform vec4 uWaveT;
uniform float uIor;
uniform float uDisp;
uniform sampler2D uTextSharp;
uniform sampler2D uTextSoft;
uniform vec4 uTextRect;
uniform float uTextZ;
uniform float uBackZ;
uniform float uTime;
uniform vec4 uRing;
uniform float uFilm;
uniform float uIorF;
uniform float uPix;

const float PI = 3.14159265;
const float EPS = 0.0006;
const vec3 ABSORB = vec3(0.060, 0.052, 0.014);
const float SCATTER = 0.014;
const vec3 SCATTER_COL = vec3(0.975, 0.955, 1.0);
const float INTERNAL = 0.22;
const float INNER_REFL = 0.40;
const float INNER_F = 0.22;
const vec3 EDGE_TINT = vec3(0.70, 0.73, 0.90);
const float EDGE_AMT = 0.55;
const float DISP_GAIN = 1.6;
const float IRI = 0.30;

/* Deformed torus in object space: ring radius 1, travelling jelly waves. */
float mapO(vec3 p){
  float rho = length(p.xy) + 1e-6;
  vec2 cs = p.xy / rho;
  float c2 = cs.x*cs.x - cs.y*cs.y;
  float s2 = 2.0*cs.x*cs.y;
  vec4 h = vec4(c2, s2, c2*cs.x - s2*cs.y, s2*cs.x + c2*cs.y);
  vec2 q = vec2(rho - 1.0 - dot(uWaveR, h), p.z - dot(uWaveZ, h));
  return length(q) - (uTube + dot(uWaveT, h));
}
/* Hollow glass: a shell of thickness uWall around the deformed torus. */
float shell(vec3 p){ return abs(mapO(p) + 0.5*uWall) - 0.5*uWall; }
vec3 nrmO(vec3 p){
  const float e = 0.0009;
  const vec2 k = vec2(1.0, -1.0);
  return k.xyy*shell(p + k.xyy*e) + k.yyx*shell(p + k.yyx*e) + k.yxy*shell(p + k.yxy*e) + k.xxx*shell(p + k.xxx*e);
}
vec3 nrmW(vec3 pw){ return normalize(uNrmM*nrmO(uInvM*(pw - uCenter))); }

float g2(vec2 p, vec2 c, vec2 r){ vec2 q = (p - c)/r; return exp(-dot(q, q)); }
float bandf(float d, float w){ float x = d/w; return exp(-x*x); }

const vec3 PINK = vec3(0.995, 0.845, 0.925);
const vec3 BLUE = vec3(0.815, 0.905, 1.000);

/* Rippling water light (波光): soft contour lines of a slowly evolving wave field. */
float ripple(vec2 q, float T){
  vec2 w = q + 0.50*vec2(sin(q.y*1.20 - T*0.40), cos(q.x*0.95 + T*0.46));
  float f = sin(w.x*1.60 + T*0.80) + sin(w.y*2.00 - T*0.62)
          + sin((w.x + w.y)*1.30 + T*0.55) + 0.8*sin((w.x - w.y)*1.05 - T*0.47);
  return pow(abs(cos(f*1.05)), 6.0);
}

/* 波光 over the floor: broad pastel satin folds that drift and undulate slowly,
   lavender-blue and pink in the troughs, soft white on the crests. */
vec3 satin(vec3 col, vec2 p, vec2 fp, float A, float T){
  float x = p.x - fp.x;
  float base = -0.10*x - 0.08*x*abs(x);
  float warp = 0.034*sin(p.x*2.1 - T*0.21) + 0.022*sin(p.x*3.7 + T*0.27 + 1.3) + 0.014*sin(p.x*6.3 - T*0.40 + 0.4);
  float yy = p.y - base + warp;
  float ph = yy*44.0 + 1.7*sin(yy*9.0 + p.x*1.3 - T*0.20) + 0.9*sin(p.x*4.4 - yy*14.0 + T*0.26) + T*0.55;
  float b = 0.5 + 0.5*sin(ph);
  float b2 = 0.5 + 0.5*sin(ph*0.53 + p.x*1.7 - T*0.18);
  float crest = pow(b, 7.0);
  float trough = (1.0 - b)*(1.0 - b);
  float m = smoothstep(0.02, -0.14, p.y)*smoothstep(-0.58, -0.36, p.y);
  m *= 0.55 + 0.45*sin(p.x*2.6 + b2*2.0 - T*0.12);
  float pinkness = clamp(smoothstep(0.05*A, 0.85*A, p.x) + 0.6*smoothstep(-0.55*A, -0.98*A, p.x) + (b2 - 0.5)*0.7, 0.0, 1.0);
  vec3 tint = mix(vec3(0.855, 0.885, 0.990), vec3(0.992, 0.860, 0.930), pinkness);
  col = mix(col, tint, 0.34*trough*m);
  col = mix(col, vec3(1.0), 0.70*crest*m);
  return col;
}

/* Pastel studio backdrop, in card space (y up), with moving blue-pink light. */
vec3 backdrop(vec2 uv, float detail){
  float A = 0.5*uAspect;
  vec2 p = vec2((uv.x - 0.5)*uAspect, uv.y - 0.5);
  float T = uTime;
  vec2 drift = 0.055*vec2(sin(T*0.13), cos(T*0.11));
  float breathe = 0.5 + 0.5*sin(T*0.21);
  vec3 col = vec3(0.960, 0.974, 0.992);
  col = mix(col, vec3(0.842, 0.916, 0.990), (0.82 + 0.12*breathe)*g2(p, vec2(-0.66*A, 0.36) + drift, vec2(0.48, 0.38)));
  col = mix(col, vec3(0.918, 0.892, 0.962), (0.86 - 0.12*breathe)*g2(p, vec2( 0.74*A, 0.40) - drift.yx, vec2(0.42, 0.30)));
  col = mix(col, vec3(0.985, 0.895, 0.942), (0.60 + 0.12*breathe)*g2(p, vec2( 1.04*A, -0.04) + drift.yx*0.6, vec2(0.24, 0.48)));
  col = mix(col, vec3(0.990, 0.912, 0.950), 0.62*g2(p, vec2( 0.86*A, -0.50), vec2(0.44, 0.22)));
  col = mix(col, vec3(0.988, 0.915, 0.948), 0.52*g2(p, vec2(-1.02*A, -0.16) - drift*0.6, vec2(0.20, 0.44)));
  vec2 rc = uRing.xy;
  float rr = uRing.z;
  vec2 fp = rc + vec2(-0.10*rr, -1.00*rr);
  float lift = uRing.w;
  float x = p.x - fp.x;
  /* the floor where the light lands: lavender-grey, a cool pool under the ring */
  float path = fp.y - 0.12*x - 0.15*x*abs(x);
  float floorM = bandf(p.y - path, 0.16)*smoothstep(1.05*A, 0.10*A, abs(x));
  col = mix(col, vec3(0.918, 0.924, 0.962), 0.55*floorM);
  col = mix(col, vec3(0.842, 0.915, 0.992), 0.60*lift*g2(p, fp + vec2(0.05*rr, -0.02), vec2(0.95*rr, 0.20*rr)));
  if (detail > 0.5) col = satin(col, p, fp, A, T);
  /* silky light: a fan of soft ribbons through the pool, rippling slowly while light
     slides along them; pink toward the left, blue under the ring */
  vec3 tintX = mix(PINK, BLUE, smoothstep(-0.55*A, 0.15*A, x));
  float lit = 0.0;
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float slope = -0.12 + 0.050*(fi - 2.5);
    float wave = (0.014 + 0.004*fi)*sin(x*(3.0 + 0.55*fi) - T*(0.30 + 0.05*fi) + fi*1.7);
    float yc = fp.y + 0.014*(fi - 2.5) + slope*x - 0.15*x*abs(x) + wave;
    float d = p.y - yc;
    float w = 0.012 + 0.007*fi;
    float flow = 0.5 + 0.5*sin(x*(4.5 + fi) - T*(0.65 + 0.12*fi) + fi*2.3);
    float reach = (0.62 + 0.28*sin(fi*2.1 + 0.4))*A;
    float k = smoothstep(reach, 0.02, abs(x))*(0.40 + 0.60*flow)*(1.0 - 0.07*fi);
    col = mix(col, tintX, 0.58*k*bandf(d, w*1.30));
    col = mix(col, vec3(1.0), 0.95*k*bandf(d, w*0.34));
    lit += bandf(d, w)*k;
  }
  col += vec3(0.070, 0.058, 0.080)*lift*g2(p, fp + vec2(-0.18*rr, 0.02*rr), vec2(0.36*rr, 0.06*rr));
  /* 波光: soft rippling light in the pool and along the ribbons */
  if (detail > 0.5){
    vec2 q = (p - fp)*vec2(11.0, 26.0);
    float m = clamp(lit*0.7 + 1.1*g2(p, fp, vec2(1.15*rr, 0.26*rr)), 0.0, 1.0)*lift;
    float r = ripple(q, T);
    col = mix(col, mix(vec3(1.0), tintX, 0.30), 0.60*m*r);
  }
  return col;
}

float rectLight(vec3 d, vec3 c, vec2 hs, float soft){
  float z = dot(d, c);
  if (z <= 0.0) return 0.0;
  vec3 u = normalize(cross(vec3(0.0, 1.0, 0.0), c));
  vec3 v = cross(c, u);
  vec2 q = abs(vec2(dot(d, u), dot(d, v))/z);
  vec2 e = 1.0 - smoothstep(hs - soft, hs + soft, q);
  return e.x*e.y;
}
/* Photo studio seen by reflections: dim lavender-grey surroundings, bright soft boxes. */
vec3 studio(vec3 d){
  vec3 col = mix(vec3(0.440, 0.470, 0.560), vec3(0.820, 0.840, 0.900), smoothstep(-0.30, 0.90, d.y));
  col = mix(col, vec3(0.420, 0.465, 0.570), smoothstep(-0.10, -0.75, d.y));
  col *= mix(vec3(1.0), vec3(0.88, 0.96, 1.08), 0.8*smoothstep(0.15, 0.95, -d.x));
  col *= mix(vec3(1.0), vec3(1.06, 0.94, 1.03), 0.7*smoothstep(0.15, 0.95, d.x));
  col += vec3(1.00, 0.99, 1.00)*8.0*rectLight(d, normalize(vec3( 0.55, 0.50, 0.67)), vec2(0.26, 0.15), 0.10);
  col += vec3(0.62, 0.60, 1.00)*1.3*rectLight(d, normalize(vec3( 0.55, 0.50, 0.67)), vec2(0.46, 0.32), 0.24);
  col += vec3(0.95, 0.98, 1.00)*5.0*rectLight(d, normalize(vec3(-0.86, 0.12, 0.50)), vec2(0.05, 0.70), 0.06);
  col += vec3(1.00, 0.97, 1.00)*4.0*rectLight(d, normalize(vec3( 0.02, 0.96, 0.28)), vec2(0.70, 0.06), 0.07);
  col += vec3(1.00, 0.95, 0.98)*2.0*rectLight(d, normalize(vec3( 0.20, -0.80, 0.56)), vec2(0.50, 0.07), 0.10);
  return col;
}
vec3 studioRefl(vec3 d){
  return studio(d) + vec3(0.30, 0.31, 0.36)*exp(-d.z*d.z*30.0)*smoothstep(-0.85, 0.2, d.y);
}

vec4 textAt(sampler2D s, vec3 p){
  vec2 t = (p.xy - uTextRect.xy)*uTextRect.zw + 0.5;
  if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return vec4(0.0);
  return TEXLOD(s, t);
}
vec2 toUV(vec3 q){
  float w = uCamZ - q.z;
  return vec2(q.x/(w*uTanHalf*uAspect), q.y/(w*uTanHalf))*0.5 + 0.5;
}
/* Pastel light tent around the set, seen only through the glass:
   lavender floor, bright ceiling, cool wall left, blush wall right. */
vec3 tent(vec3 d){
  vec3 col = mix(vec3(0.690, 0.680, 0.900), vec3(1.02, 1.02, 1.03), smoothstep(-0.55, 0.50, d.y));
  col = mix(col, vec3(0.70, 0.83, 1.00), 0.62*smoothstep(0.10, 0.85, -d.x));
  col = mix(col, vec3(1.00, 0.80, 0.90), 0.52*smoothstep(0.10, 0.85, d.x));
  col *= mix(vec3(1.0), vec3(0.70, 0.75, 0.88), smoothstep(0.45, 0.95, abs(d.x))*smoothstep(0.6, 0.0, d.y));
  col += vec3(0.18)*smoothstep(0.60, 0.95, d.y);
  return col;
}
/* What a ray sees once it leaves the glass: the backdrop behind, and the
   surrounding tent for rays the glass has bent well away from the view axis. */
vec3 behind(vec3 p, vec3 d){
  vec3 env = mix(studio(d), tent(d), smoothstep(0.35, -0.05, d.z));
  if (d.z > -0.02) return env;
  vec3 b = backdrop(toUV(p + d*((uBackZ - p.z)/d.z)), GLASS_DETAIL);
  float w = smoothstep(-0.02, -0.30, d.z)*(1.0 - 0.70*smoothstep(0.28, 0.75, length(d.xy)));
  return mix(env, b, w);
}
vec3 sceneAlong(vec3 p, vec3 d){
  vec3 b = behind(p, d);
  if (abs(d.z) > 1e-4){
    float t = (uTextZ - p.z)/d.z;
    if (t > 0.0){
      vec4 tx = textAt(uTextSoft, p + d*t);
      b = tx.rgb + (1.0 - tx.a)*b;
    }
  }
  return b;
}
vec3 reflEnv(vec3 p, vec3 d){
  float w = smoothstep(-0.25, 0.05, d.z);
  vec3 s = studioRefl(d);
  if (w > 0.999) return s;
  return mix(sceneAlong(p, d), s, w);
}

float fresnel(float cosi, float n1, float n2){
  float eta = n1/n2;
  float st2 = eta*eta*(1.0 - cosi*cosi);
  if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - st2);
  float rs = (n1*cosi - n2*ct)/(n1*cosi + n2*ct);
  float rp = (n1*ct - n2*cosi)/(n1*ct + n2*cosi);
  return 0.5*(rs*rs + rp*rp);
}
vec3 film(float cosi, float thick){
  float ct = sqrt(max(0.0, 1.0 - (1.0 - cosi*cosi)/1.8225));
  vec3 ph = 16.965*thick*ct/vec3(0.64, 0.54, 0.46);
  return 0.5 + 0.5*cos(ph);
}

bool marchOut(vec3 pos, vec3 dir, out float tW, out float mR, out float mT){
  tW = 0.0;
  mR = 1e3;
  mT = 0.0;
  vec3 oc = pos - uCenter;
  float b = dot(oc, dir);
  float h = b*b - dot(oc, oc) + uBoundR*uBoundR;
  if (h <= 0.0) return false;
  h = sqrt(h);
  float t1 = -b + h;
  if (t1 <= 0.0) return false;
  float t0 = max(-b - h, 0.0);
  vec3 ro = uInvM*oc;
  vec3 rd = uInvM*dir;
  float k = length(rd);
  rd /= k;
  float t = t0*k;
  float tEnd = t1*k;
  float dPrev = 1e3;
  float tPrev = t;
  for (int i = 0; i < STEPS_OUT; i++){
    float d = shell(ro + rd*t);
    if (d < EPS){ tW = t/k; return true; }
    if (d > dPrev && dPrev/tPrev < mR){ mR = dPrev/tPrev; mT = tPrev/k; }
    dPrev = d;
    tPrev = t;
    t += max(d*0.9, 0.0008 + 0.0015*t);
    if (t > tEnd) return false;
  }
  return false;
}
float marchIn(vec3 pos, vec3 dir){
  vec3 ro = uInvM*(pos - uCenter);
  vec3 rd = uInvM*dir;
  float k = length(rd);
  rd /= k;
  float t = 0.0;
  float tPrev = 0.0;
  for (int i = 0; i < STEPS_IN; i++){
    float d = -shell(ro + rd*t);
    if (d < EPS) break;
    tPrev = t;
    t += max(d*0.95, 0.003 + 0.018*t);
  }
  for (int j = 0; j < 5; j++){
    float tm = 0.5*(tPrev + t);
    if (-shell(ro + rd*tm) < EPS) t = tm; else tPrev = tm;
  }
  return t/k;
}

vec3 traceGlass(vec3 ro, vec3 rd, vec4 txt0, vec3 direct, out float edge){
  edge = 0.0;
  vec3 acc = vec3(0.0);
  vec3 thr = vec3(1.0);
  vec3 pos = ro;
  vec3 dir = rd;
  vec3 dR = rd;
  vec3 dB = rd;
  bool inside = false;
  bool disp = false;
  bool first = true;
  bool outer = true;
  bool outerEdge = true;
  float tir = 0.0;
  for (int ev = 0; ev < MAX_EV; ev++){
    if (!inside){
      float tHit, mR, mT;
      bool camRay = first;
      bool hit = marchOut(pos, dir, tHit, mR, mT);
      if (camRay && mR < 1.6*uPix) edge = 1.0;
      if (!hit){
        if (first) return direct;
        if (disp) acc += thr*vec3(sceneAlong(pos, dR).r, sceneAlong(pos, dir).g, sceneAlong(pos, dB).b);
        else acc += thr*sceneAlong(pos, dir);
        return acc;
      }
      if (abs(dir.z) > 1e-4){
        float tP = (uTextZ - pos.z)/dir.z;
        if (tP > 0.0 && tP < tHit){
          vec4 tx = first ? txt0 : textAt(uTextSoft, pos + dir*tP);
          acc += thr*tx.rgb;
          thr *= 1.0 - tx.a;
        }
      }
      first = false;
      vec3 p = pos + dir*tHit;
      vec3 n = nrmW(p);
      float cosi = clamp(-dot(dir, n), 0.0, 1.0);
      if (camRay && cosi < 0.32) edge = 1.0;
      vec3 po = uInvM*(p - uCenter);
      float F = fresnel(cosi, 1.0, uIorF)*(mapO(po) < -0.5*uWall ? INNER_F : 1.0);
      float th = 0.325 + 0.030*sin(2.7*po.x - 1.9*po.y + uFilm) + 0.018*sin(4.1*po.z + 1.3*po.x - 0.7*uFilm);
      vec3 tint = mix(vec3(1.0), film(cosi, th)*1.6 + 0.2, IRI);
      vec3 rdir = reflect(dir, n);
      vec3 rcol = outer ? reflEnv(p, rdir) : INNER_REFL*sceneAlong(p, rdir);
      acc += thr*F*tint*rcol;
      outer = false;
      thr *= 1.0 - F;
      if (outerEdge) thr *= mix(vec3(1.0), EDGE_TINT, EDGE_AMT*pow(1.0 - cosi, 2.2));
      outerEdge = false;
      dir = refract(dir, n, 1.0/uIor);
      pos = p - n*uOff;
      inside = true;
      disp = false;
    } else {
      float tOut = marchIn(pos, dir);
      if (abs(dir.z) > 1e-4){
        float tP = (uTextZ - pos.z)/dir.z;
        if (tP > 0.0 && tP < tOut){
          vec4 tx = textAt(uTextSoft, pos + dir*tP);
          acc += thr*exp(-ABSORB*tP/uS)*tx.rgb;
          thr *= 1.0 - tx.a;
        }
      }
      float ext = exp(-SCATTER*tOut/uS);
      acc += thr*(1.0 - ext)*SCATTER_COL;
      thr *= ext*exp(-ABSORB*tOut/uS);
      vec3 p = pos + dir*tOut;
      vec3 n = nrmW(p);
      vec3 t = refract(dir, -n, uIor);
      if (dot(t, t) < 0.5){
        tir += 1.0;
        if (tir > 2.5) return acc + thr*mix(tent(reflect(dir, -n)), SCATTER_COL, 0.35);
        dir = reflect(dir, -n);
        pos = p - n*uOff;
        continue;
      }
      float cosi = clamp(dot(dir, n), 0.0, 1.0);
      float F = fresnel(cosi, uIor, 1.0)*(mapO(uInvM*(p - uCenter)) < -0.5*uWall ? INNER_F : 1.0);
      acc += thr*F*INTERNAL*sceneAlong(p, reflect(dir, -n));
      thr *= 1.0 - F;
      vec3 tR = refract(dir, -n, uIor - uDisp);
      vec3 tB = refract(dir, -n, uIor + uDisp);
      dR = dot(tR, tR) > 0.5 ? normalize(t + (tR - t)*DISP_GAIN) : t;
      dB = dot(tB, tB) > 0.5 ? normalize(t + (tB - t)*DISP_GAIN) : t;
      disp = true;
      dir = t;
      pos = p + n*uOff;
      inside = false;
    }
    if (max(thr.r, max(thr.g, thr.b)) < 0.01) return acc;
  }
  return acc + thr*sceneAlong(pos, dir);
}

vec3 shoulder(vec3 c){
  vec3 x = max(c - 0.96, 0.0);
  return min(c, 0.96) + 0.04*(1.0 - exp(-x/0.04));
}

void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec2 ndc = uv*2.0 - 1.0;
  vec3 ro = vec3(0.0, 0.0, uCamZ);
  vec3 rd = normalize(vec3(ndc.x*uTanHalf*uAspect, ndc.y*uTanHalf, -1.0));

  float tp0 = (uTextZ - uCamZ)/rd.z;
  vec2 tuv = ((ro + rd*tp0).xy - uTextRect.xy)*uTextRect.zw + 0.5;
  vec4 txt0 = TEX(uTextSharp, tuv);
  txt0 *= step(0.0, tuv.x)*step(tuv.x, 1.0)*step(0.0, tuv.y)*step(tuv.y, 1.0);
  vec3 direct = txt0.rgb + (1.0 - txt0.a)*backdrop(uv, 1.0);

  vec3 col = direct;
  vec3 oc = ro - uCenter;
  float b = dot(oc, rd);
  if (b*b - dot(oc, oc) + uBoundR*uBoundR > 0.0){
    /* Adaptive anti-aliasing: silhouette pixels trace 3 extra jittered rays. */
    vec3 sum = vec3(0.0);
    float cnt = 0.0;
    for (int k = 0; k < AA_SAMPLES; k++){
      vec2 o = k == 0 ? vec2(0.0) : (k == 1 ? vec2(0.33, 0.17) : (k == 2 ? vec2(-0.17, 0.33) : vec2(-0.33, -0.17)));
      o = k == 4 ? vec2(0.17, -0.33) : o;
      vec2 ndk = ((gl_FragCoord.xy + o)/uRes)*2.0 - 1.0;
      vec3 rdk = normalize(vec3(ndk.x*uTanHalf*uAspect, ndk.y*uTanHalf, -1.0));
      float edge;
      sum += traceGlass(ro, rdk, txt0, direct, edge);
      cnt += 1.0;
      if (edge < 0.5) break;
    }
    col = sum/cnt;
  }

  col = shoulder(col);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)))*43758.5453) - 0.5)/255.0;
  FRAGCOLOR = vec4(col, 1.0);
}`;

  /* ---- Small matrix helpers (column-major mat3) --------------------------- */
  const M3 = {
    mul(a, b) {
      const o = new Float32Array(9);
      for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
      return o;
    },
    transpose(m) { return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]); },
    axis(x, y, z, ang) {
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
      return new Float32Array([
        t * x * x + c, t * x * y + s * z, t * x * z - s * y,
        t * x * y - s * z, t * y * y + c, t * y * z + s * x,
        t * x * z + s * y, t * y * z - s * x, t * z * z + c,
      ]);
    },
    inverse(m) {
      const [a, b, c, d, e, f, g, h, i] = m;
      const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
      const det = a * A + b * B + c * C || 1e-9;
      return new Float32Array([
        A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
        B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
        C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
      ]);
    },
    scale(m, s) { return m.map(v => v * s); },
    apply(m, v) { return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; },
  };

  /* ---- SIGN WELL lettering (canvas -> texture) ---------------------------- */
  function layoutWord(x, fs) {
    x.font = `700 ${fs}px ${CFG.font}`;
    const chars = [...CFG.word];
    const widths = chars.map(ch => x.measureText(ch).width);
    const track = fs * CFG.tracking;
    const total = widths.reduce((s, w) => s + w, 0) + track * (chars.length - 1);
    return { chars, widths, track, total };
  }
  function drawWordPath(x, L, left, base, dy, mode) {
    let px = left;
    for (let i = 0; i < L.chars.length; i++) {
      if (mode === 'fill') x.fillText(L.chars[i], px, base + dy);
      else x.strokeText(L.chars[i], px, base + dy);
      px += L.widths[i] + L.track;
    }
  }
  /* Satin-metal letters: slate top fading to pale silver, crisp bevelled rim. */
  function paintWord(c) {
    const x = c.getContext('2d');
    const W = c.width, H = c.height;
    x.clearRect(0, 0, W, H);
    const fs = 100 * (W * 0.9) / layoutWord(x, 100).total;
    const L = layoutWord(x, fs);
    const m = x.measureText('SIGNWEL');
    const cap = m.actualBoundingBoxAscent || fs * 0.72;
    const base = H * 0.5 + cap * 0.5;
    const top = base - cap;
    const left = (W - L.total) / 2;
    x.textBaseline = 'alphabetic';
    x.lineJoin = 'round';

    const g = x.createLinearGradient(0, top, 0, base);
    g.addColorStop(0.00, '#6e7f98');
    g.addColorStop(0.08, '#8190a8');
    g.addColorStop(0.50, '#a5b0c1');
    g.addColorStop(1.00, '#d8dae3');
    x.fillStyle = g;
    drawWordPath(x, L, left, base, 0, 'fill');

    const hz = x.createLinearGradient(left, 0, left + L.total, 0);
    hz.addColorStop(0, 'rgba(206,224,244,.20)');
    hz.addColorStop(0.5, 'rgba(255,255,255,0)');
    hz.addColorStop(1, 'rgba(226,214,240,.18)');
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = hz;
    x.fillRect(0, 0, W, H);
    x.lineWidth = Math.max(1, fs * 0.016);
    x.strokeStyle = 'rgba(62,80,104,.22)';
    drawWordPath(x, L, left, base, -fs * 0.006, 'stroke');
    x.lineWidth = Math.max(1, fs * 0.012);
    x.strokeStyle = 'rgba(255,255,255,.32)';
    drawWordPath(x, L, left, base, fs * 0.010, 'stroke');
    x.globalCompositeOperation = 'source-over';
    return { cap, fs, total: L.total };
  }

  /* ---- GL helpers --------------------------------------------------------- */
  /* Starts compiling; with KHR_parallel_shader_compile this never blocks the page. */
  function startProgram(gl, vsSrc, fsSrc) {
    const v = gl.createShader(gl.VERTEX_SHADER), f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(v, vsSrc); gl.compileShader(v);
    gl.shaderSource(f, fsSrc); gl.compileShader(f);
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    return { p, v, f };
  }
  function programDone(gl, ext, job) { return !ext || gl.getProgramParameter(job.p, ext.COMPLETION_STATUS_KHR); }
  function finishProgram(gl, job) {
    const ok = gl.getProgramParameter(job.p, gl.LINK_STATUS);
    if (!ok) {
      console.warn('SIGN WELL hero shader:', gl.getShaderInfoLog(job.f) || gl.getProgramInfoLog(job.p));
      gl.deleteProgram(job.p);
    }
    gl.deleteShader(job.v); gl.deleteShader(job.f);
    return ok ? job.p : null;
  }
  function shaderSources(gl, tier) {
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const defs = `#define STEPS_OUT ${tier.stepsOut}\n#define STEPS_IN ${tier.stepsIn}\n#define MAX_EV ${tier.maxEv}\n#define AA_SAMPLES ${tier.aa}\n#define GLASS_DETAIL ${tier.glassDetail ? '1.0' : '0.0'}\n`;
    if (isGL2) {
      return { vs: VS2, fs: `#version 300 es\nprecision highp float;\n${defs}#define TEX(s, uv) texture(s, uv)\n#define TEXLOD(s, uv) textureLod(s, uv, 0.0)\nout vec4 swFragColor;\n#define FRAGCOLOR swFragColor\n${FS}` };
    }
    const lod = gl.getExtension('EXT_shader_texture_lod')
      ? '#extension GL_EXT_shader_texture_lod : enable\n#define TEXLOD(s, uv) texture2DLodEXT(s, uv, 0.0)\n'
      : '#define TEXLOD(s, uv) texture2D(s, uv)\n';
    return { vs: VS1, fs: `${lod}precision highp float;\n${defs}#define TEX(s, uv) texture2D(s, uv)\n#define FRAGCOLOR gl_FragColor\n${FS}` };
  }
  function uploadCanvas(gl, tex, canvas, mips) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  }

  /* ---- Scene layout ------------------------------------------------------- */
  function computeLayout(aspect) {
    const tanHalf = Math.tan(CFG.fovY / 2);
    const H0 = CFG.camZ * tanHalf, W0 = H0 * aspect;
    const outer = Math.min(CFG.ringSize * H0, (aspect < 1.05 ? 0.66 : 0.92) * W0);
    const s = outer / (1 + CFG.tube);
    const wordW = Math.min(1.62 * W0, 2.80 * H0, 1.76 * W0);
    const portrait = aspect < 1;
    return {
      tanHalf, H0, W0, s, wordW,
      ringX: portrait ? 0 : 0.03 * W0,
      ringY: (portrait ? 0.02 : CFG.ringLift) * H0,
      wordY: 0.02 * H0,
    };
  }

  /* ---- 2D fallback (no WebGL) --------------------------------------------- */
  function drawStaticFallback(canvas) {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, r.width), h = Math.max(2, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const x = canvas.getContext('2d');
    if (!x) return;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = x.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#eef5fc'); bg.addColorStop(0.45, '#f7f9fd'); bg.addColorStop(1, '#fbf3f8');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    const glow = (cx, cy, rad, col) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    glow(w * 0.17, h * 0.15, h * 0.55, 'rgba(203,228,251,.75)');
    glow(w * 0.86, h * 0.12, h * 0.50, 'rgba(232,224,246,.70)');
    const word = document.createElement('canvas');
    word.width = 2048; word.height = 512;
    paintWord(word);
    const ww = Math.min(w * 0.77, h * 1.55), wh = ww / 4;
    const cx = w * 0.5, cy = h * 0.49;
    const rx = Math.min(w * 0.23, h * 0.40), ry = rx * 0.56, band = rx * 0.34;
    const ring = (front) => {
      x.save();
      x.beginPath();
      if (front) x.rect(0, cy - h * 0.02, w, h); else x.rect(0, 0, w, cy - h * 0.02);
      x.clip();
      x.translate(cx + w * 0.02, cy - h * 0.04); x.rotate(-38 * DEG);
      const g = x.createConicGradient ? x.createConicGradient(-0.7, 0, 0) : x.createLinearGradient(-rx, -ry, rx, ry);
      [[0, 'rgba(255,255,255,.88)'], [0.12, 'rgba(206,220,250,.58)'], [0.30, 'rgba(232,226,252,.46)'], [0.46, 'rgba(255,255,255,.82)'],
       [0.62, 'rgba(196,212,246,.52)'], [0.80, 'rgba(250,234,246,.58)'], [1, 'rgba(255,255,255,.88)']].forEach(([o, c]) => g.addColorStop(o, c));
      x.save();
      if (!front) { x.shadowColor = 'rgba(96,118,170,.20)'; x.shadowBlur = 34; x.shadowOffsetY = 18; }
      x.lineWidth = band; x.strokeStyle = g;
      x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); x.stroke();
      x.restore();
      x.lineWidth = band * 0.42; x.strokeStyle = 'rgba(150,166,210,.16)';
      x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 1.6; x.strokeStyle = 'rgba(255,255,255,.95)';
      x.beginPath(); x.ellipse(0, 0, rx + band * 0.5, ry + band * 0.5, 0, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.ellipse(0, 0, Math.max(1, rx - band * 0.5), Math.max(1, ry - band * 0.5), 0, 0, Math.PI * 2); x.stroke();
      x.lineCap = 'round'; x.lineWidth = band * 0.16; x.strokeStyle = 'rgba(255,255,255,.92)';
      x.beginPath(); x.ellipse(0, 0, rx + band * 0.2, ry + band * 0.2, 0, -2.35, -1.25); x.stroke();
      x.lineWidth = band * 0.08; x.strokeStyle = 'rgba(255,255,255,.8)';
      x.beginPath(); x.ellipse(0, 0, rx - band * 0.22, ry - band * 0.22, 0, 0.55, 1.45); x.stroke();
      x.restore();
    };
    ring(false);
    x.drawImage(word, cx - ww / 2, cy - wh / 2 + h * 0.03, ww, wh);
    ring(true);
  }

  /* ---- Mount -------------------------------------------------------------- */
  const instances = new Set();
  function mount(host) {
    if (!host || host.dataset.liquidReady === '1') return;
    if (window.SignWellHeroConfig && typeof window.SignWellHeroConfig === 'object') Object.assign(CFG, window.SignWellHeroConfig);
    host.dataset.liquidReady = '1';
    host.dataset.liquidVersion = 'R9.2';
    let canvas = host.querySelector('canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); host.prepend(canvas); }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = !matchMedia('(pointer:fine)').matches;
    const isMobile = matchMedia('(max-width:760px)').matches || coarse;
    const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.connection && navigator.connection.saveData);
    let tierName = host.dataset.liquidTier || (lowPower ? 'low' : (isMobile ? 'mid' : 'high'));
    let tier = TIERS[tierName] || TIERS.high;
    const frozen = host.dataset.liquidTime != null ? parseFloat(host.dataset.liquidTime) : null;
    canvas.style.touchAction = isMobile ? 'pan-y' : 'none';

    let dead = false;
    const fallback = () => {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      const c2 = document.createElement('canvas');
      c2.setAttribute('aria-hidden', 'true');
      canvas.replaceWith(c2);
      host.classList.add('is-static', 'is-ready');
      drawStaticFallback(c2);
    };
    let raf = 0;
    const glOpts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: frozen != null, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl2', glOpts) || canvas.getContext('webgl', glOpts);
    if (!gl) { fallback(); return; }
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!hp || hp.precision < 16) { fallback(); return; }

    /* GL resources */
    let prog = null, U = {}, texSharp = null, texSoft = null, buf = null, texW = 0, shown = false;
    const wordSharp = document.createElement('canvas');
    const wordSoft = document.createElement('canvas');
    function buildWordTextures(neededPx) {
      const want = neededPx > 1700 ? 4096 : 2048;
      if (want === texW) return;
      texW = want;
      wordSharp.width = texW; wordSharp.height = texW / 4;
      paintWord(wordSharp);
      wordSoft.width = 1024; wordSoft.height = 256;
      const sx = wordSoft.getContext('2d');
      sx.clearRect(0, 0, 1024, 256);
      sx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in sx) sx.imageSmoothingQuality = 'high';
      if ('filter' in sx) sx.filter = 'blur(2px)';
      sx.drawImage(wordSharp, 0, 0, 1024, 256);
      if ('filter' in sx) sx.filter = 'none';
      uploadCanvas(gl, texSharp, wordSharp, true);
      uploadCanvas(gl, texSoft, wordSoft, false);
    }
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    let job = null;
    function initGL() {
      if (prog) { gl.deleteProgram(prog); prog = null; }
      const src = shaderSources(gl, tier);
      job = startProgram(gl, src.vs, src.fs);
      prog = null;
      buf = buf || gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      texSharp = texSharp || gl.createTexture();
      texSoft = texSoft || gl.createTexture();
      texW = 0;
      return true;
    }
    /* Returns true once the program is linked and ready (never blocks with the parallel-compile extension). */
    function programReady() {
      if (prog) return true;
      if (!job || !programDone(gl, parallel, job)) return false;
      prog = finishProgram(gl, job);
      job = null;
      if (!prog) { failed = true; return false; }
      const names = ['uRes', 'uAspect', 'uTanHalf', 'uCamZ', 'uCenter', 'uInvM', 'uNrmM', 'uBoundR', 'uOff', 'uS', 'uTube', 'uWall', 'uWaveR', 'uWaveZ', 'uWaveT', 'uIor', 'uDisp', 'uTextSharp', 'uTextSoft', 'uTextRect', 'uTextZ', 'uBackZ', 'uTime', 'uRing', 'uFilm', 'uIorF', 'uPix'];
      U = {};
      names.forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      return true;
    }
    let failed = false;
    initGL();

    /* Size and adaptive resolution */
    let vw = 0, vh = 0, quality = 0.85, L = computeLayout(1.7), cssW = 0, cssH = 0;
    function resize() {
      if (!cssW) { const b = canvas.getBoundingClientRect(); cssW = b.width; cssH = b.height; }
      const r = { width: cssW, height: cssH };
      if (r.width < 2 || r.height < 2) return false;
      let dpr = Math.min(window.devicePixelRatio || 1, tier.dprCap) * quality;
      const raw = r.width * r.height * dpr * dpr;
      if (raw > tier.maxPixels) dpr *= Math.sqrt(tier.maxPixels / raw);
      const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (w !== vw || h !== vh) {
        vw = w; vh = h; canvas.width = w; canvas.height = h;
        L = computeLayout(w / h);
        buildWordTextures(w * (L.wordW / (2 * L.W0)) / 0.9);
      }
      return true;
    }

    /* Motion state */
    const st = {
      t: 0, spin: 0,
      yaw: 0, pitch: 0, yawV: 0, pitchV: 0,
      tiltX: 0, tiltY: 0, tgtX: 0, tgtY: 0,
      a: 0, av: 0, c: 0, cv: 0, b: 0, bv: 0,   // squash / stretch strain (springs)
      sad: 0, sadV: 0, sadAng: 0,             // saddle "boing" mode
      drag: false, lx: 0, ly: 0, lt: 0,
    };
    const W_STRAIN = 2 * Math.PI * 1.55, Z_STRAIN = 0.16;
    const W_SAD = 2 * Math.PI * 2.1, Z_SAD = 0.10;

    function stepPhysics(dt) {
      // Soft landing: each time the float bob bottoms out the jelly squishes and wobbles.
      const TAU = Math.PI * 2, land = 1.5 * Math.PI;
      const ph0 = (st.t * CFG.floatRate) % TAU, ph1 = ((st.t + dt) * CFG.floatRate) % TAU;
      if (ph0 < land && ph1 >= land) { st.bv -= 0.24 * CFG.jelly; st.sadAng = st.t * 1.7; st.sadV += 0.20 * CFG.jelly; }
      st.t += dt;
      st.spin += CFG.spinRate * dt;               // constant angular velocity
      if (!st.drag) {
        st.yaw += st.yawV * dt; st.pitch += st.pitchV * dt;
        const f = Math.exp(-2.6 * dt);
        st.yawV *= f; st.pitchV *= f;
        st.pitch *= Math.exp(-0.8 * dt);           // drift back to the hero pose
      }
      st.pitch = Math.max(-0.7, Math.min(0.7, st.pitch));
      const kt = 1 - Math.exp(-4 * dt);
      st.tiltX += (st.tgtX - st.tiltX) * kt; st.tiltY += (st.tgtY - st.tiltY) * kt;
      // Float bob drives the vertical jelly strain through its acceleration.
      const bobAcc = -CFG.floatAmp * CFG.floatRate * CFG.floatRate * Math.sin(st.t * CFG.floatRate);
      const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n;
      for (let i = 0; i < n; i++) {
        st.av += (-W_STRAIN * W_STRAIN * st.a - 2 * Z_STRAIN * W_STRAIN * st.av) * h; st.a += st.av * h;
        st.cv += (-W_STRAIN * W_STRAIN * st.c - 2 * Z_STRAIN * W_STRAIN * st.cv) * h; st.c += st.cv * h;
        const breath = (0.55 * Math.sin(st.t * 2.1) + 0.35 * Math.sin(st.t * 0.83 + 1.1)) * CFG.jelly;
        st.bv += (-W_STRAIN * W_STRAIN * st.b - 2 * Z_STRAIN * W_STRAIN * st.bv - bobAcc * 9 + breath) * h; st.b += st.bv * h;
        st.av += 0.30 * CFG.jelly * Math.sin(st.t * 1.37 + 0.6) * h;
        st.sadV += (-W_SAD * W_SAD * st.sad - 2 * Z_SAD * W_SAD * st.sadV) * h; st.sad += st.sadV * h;
      }
      const lim = 0.12;
      st.a = Math.max(-lim, Math.min(lim, st.a)); st.c = Math.max(-lim, Math.min(lim, st.c)); st.b = Math.max(-lim, Math.min(lim, st.b));
      st.sad = Math.max(-0.09, Math.min(0.09, st.sad));
    }
    /* Drag stretches the jelly along the drag direction (traceless strain), then it wobbles back. */
    function kick(vx, vy, amount) {
      const sp = Math.hypot(vx, vy);
      if (sp < 1e-4) return;
      const ux = vx / sp, uy = vy / sp, k = Math.min(amount, 0.12) * CFG.jelly;
      st.av += k * (ux * ux - uy * uy) * 0.5;
      st.cv += k * ux * uy;
    }
    function boing(power) {
      power *= CFG.jelly;
      st.sadAng = Math.random() * Math.PI;
      st.sadV += power;
      st.bv -= power * 0.8;
    }

    function render() {
      const aspect = vw / vh;
      const s = L.s;
      const bob = Math.sin(st.t * CFG.floatRate) * CFG.floatAmp * s;
      const center = [L.ringX, L.ringY + bob, 0];
      // Orientation: pointer parallax * drag * constant spin * hero pose.
      const baseRot = M3.mul(M3.axis(0, 0, 1, CFG.baseRoll * DEG), M3.axis(1, 0, 0, CFG.baseTilt * DEG));
      let R = M3.mul(M3.axis(CFG.spinAxis[0], CFG.spinAxis[1], CFG.spinAxis[2], st.spin), baseRot);
      R = M3.mul(M3.axis(0, 1, 0, st.yaw + st.tiltX), R);
      R = M3.mul(M3.axis(1, 0, 0, st.pitch - st.tiltY), R);
      // World-space squash & stretch (symmetric, volume-preserving to first order).
      const a = st.a, c = st.c, b = st.b;
      const S = new Float32Array([1 + a - b * 0.5, c, 0, c, 1 - a + b, 0, 0, 0, 1 - b * 0.5]);
      const Si = M3.inverse(S);
      const invM = M3.scale(M3.mul(M3.transpose(R), Si), 1 / s);
      const nrmM = M3.mul(Si, R);
      const strain = Math.max(Math.abs(a), Math.abs(c), Math.abs(b));
      const t = st.t;
      const J = CFG.jelly;
      const wav = (amp, ang) => [amp * J * Math.cos(ang), amp * J * Math.sin(ang)];
      const sad = [st.sad * Math.cos(st.sadAng), st.sad * Math.sin(st.sadAng)];
      const wR = [...wav(0.010, 0.42 * t), ...wav(0.005, -0.61 * t + 1.3)];
      const wZ2 = wav(0.015, 0.55 * t + 0.4);
      const wZ = [wZ2[0] + sad[0], wZ2[1] + sad[1], ...wav(0.005, -0.47 * t + 2.2)];
      const wT = [...wav(0.006, -0.36 * t + 0.8), ...wav(0.013, 0.78 * t)];
      const bound = s * (1 + 0.05 + CFG.tube + 0.05 + Math.abs(st.sad)) * (1 + strain * 1.6) + 0.02 * s;

      // Ring position in backdrop card space for the caustic pool.
      const toCard = (p) => { const w = CFG.camZ - p[2]; return [p[0] / (w * L.tanHalf) * 0.5, p[1] / (w * L.tanHalf) * 0.5]; };
      const back = CFG.backZ * s;
      const rc = toCard([center[0], center[1], back]);
      const rr = ((1 + CFG.tube) * s) / ((CFG.camZ - back) * L.tanHalf) * 0.5;
      const lift = 1 - Math.sin(st.t * CFG.floatRate) * 0.25;

      const rectW = L.wordW / 0.9, rectH = rectW / 4;

      gl.viewport(0, 0, vw, vh);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texSharp); gl.uniform1i(U.uTextSharp, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texSoft); gl.uniform1i(U.uTextSoft, 1);
      gl.uniform2f(U.uRes, vw, vh);
      gl.uniform1f(U.uAspect, aspect);
      gl.uniform1f(U.uTanHalf, L.tanHalf);
      gl.uniform1f(U.uCamZ, CFG.camZ);
      gl.uniform3f(U.uCenter, center[0], center[1], center[2]);
      gl.uniformMatrix3fv(U.uInvM, false, invM);
      gl.uniformMatrix3fv(U.uNrmM, false, nrmM);
      gl.uniform1f(U.uBoundR, bound);
      gl.uniform1f(U.uOff, 0.0025 * s);
      gl.uniform1f(U.uS, s);
      gl.uniform1f(U.uTube, CFG.tube);
      gl.uniform1f(U.uWall, CFG.wall);
      gl.uniform4f(U.uWaveR, wR[0], wR[1], wR[2], wR[3]);
      gl.uniform4f(U.uWaveZ, wZ[0], wZ[1], wZ[2], wZ[3]);
      gl.uniform4f(U.uWaveT, wT[0], wT[1], wT[2], wT[3]);
      gl.uniform1f(U.uIor, CFG.ior);
      gl.uniform1f(U.uDisp, CFG.dispersion * (CFG.ior - 1) / 0.5);
      gl.uniform4f(U.uTextRect, 0, L.wordY, 1 / rectW, 1 / rectH);
      gl.uniform1f(U.uTextZ, CFG.textZ * s);
      gl.uniform1f(U.uBackZ, back);
      gl.uniform1f(U.uTime, st.t);
      gl.uniform4f(U.uRing, rc[0] * aspect, rc[1], rr, lift);
      gl.uniform1f(U.uFilm, st.t * 0.35);
      gl.uniform1f(U.uIorF, CFG.iorFresnel);
      gl.uniform1f(U.uPix, 2 * L.tanHalf / vh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* Loop, visibility and adaptive quality */
    let visible = true, prev = 0, lastDraw = 0, acc = 0, frames = 0, calm = 0;
    const minInterval = 1000 / tier.fps - 2;
    function adapt(dtMs) {
      acc += dtMs; frames++;
      if (acc < 1000) return;
      const avg = acc / frames; acc = 0; frames = 0;
      const target = 1000 / tier.fps;
      if (avg > target * 1.3 && quality > 0.5) { quality = Math.max(0.5, quality * 0.85); calm = 0; resize(); }
      else if (avg > target * 1.5 && tierName !== 'low') {
        // Still too slow at half resolution: drop to a cheaper shader tier.
        tierName = tierName === 'high' ? 'mid' : 'low'; tier = TIERS[tierName];
        initGL();
        quality = 0.75; vw = vh = 0;
      }
      else if (avg < target * 1.08) { if (++calm >= 3 && quality < 1) { quality = Math.min(1, quality * 1.08); calm = 0; resize(); } }
      else calm = 0;
    }
    const reveal = () => { if (!shown) { shown = true; host.classList.add('is-ready'); } };
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!programReady()) { if (failed) fallback(); return; }
      if (!visible || document.hidden) { prev = 0; return; }
      if (lastDraw && now - lastDraw < minInterval) return;
      const dtMs = prev ? now - prev : 16.7;
      prev = now; lastDraw = now;
      if (!resize()) return;
      stepPhysics(Math.min(dtMs / 1000, 0.05));
      render();
      reveal();
      adapt(dtMs);
    }
    /* Deterministic still: replay the physics from 0 to t (used for reduced motion and tests). */
    function renderStill(t) {
      if (dead) return;
      if (!programReady()) { if (failed) fallback(); else raf = requestAnimationFrame(() => renderStill(t)); return; }
      if (!resize()) return;
      Object.assign(st, { t: 0, spin: 0, yaw: 0, pitch: 0, yawV: 0, pitchV: 0, a: 0, av: 0, c: 0, cv: 0, b: 0, bv: 0, sad: 0, sadV: 0 });
      const h = 1 / 120;
      for (let k = 0; k < Math.round(t / h); k++) stepPhysics(h);
      render();
      reveal();
    }

    const ro = new ResizeObserver(es => {
      const cr = es[0] && es[0].contentRect;
      if (cr) { cssW = cr.width; cssH = cr.height; }
      if (reduced || frozen != null) renderStill(frozen || 0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(es => { visible = es[0] ? es[0].isIntersecting : true; }, { rootMargin: '120px' });
    io.observe(host);

    /* Pointer: hover parallax, drag to spin (desktop), tap to jiggle */
    const onDrag = e => {
      if (st.drag) {
        const now = performance.now(), dtp = Math.max(8, now - st.lt) / 1000;
        const dx = e.clientX - st.lx, dy = e.clientY - st.ly;
        st.yaw += dx * 0.0062; st.pitch += dy * 0.0042;
        st.yawV = dx * 0.0062 / dtp; st.pitchV = dy * 0.0042 / dtp;
        kick(dx / dtp, -dy / dtp, Math.hypot(dx, dy) / dtp * 0.00006);
        st.lx = e.clientX; st.ly = e.clientY; st.lt = now;
      }
    };
    const clamp1 = v => Math.max(-1, Math.min(1, v));
    const onHover = e => {
      if (st.drag || e.pointerType !== 'mouse') return;
      const r = host.getBoundingClientRect();
      st.tgtX = clamp1(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1) * CFG.tiltRange;
      st.tgtY = clamp1(-((e.clientY - r.top) / Math.max(1, r.height)) * 2 + 1) * CFG.tiltRange * 0.8;
    };
    const onDown = e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      boing(isMobile ? 0.70 : 0.60);
      if (isMobile || e.pointerType !== 'mouse') return;   // touch keeps page scrolling
      st.drag = true; st.lx = e.clientX; st.ly = e.clientY; st.lt = performance.now();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const onUp = () => { if (st.drag) { st.drag = false; } };
    const onLeave = () => { if (!st.drag) { st.tgtX = 0; st.tgtY = 0; } };
    canvas.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onHover, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointermove', onDrag, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    /* Context loss */
    const onLost = e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; };
    const onRestored = () => { buf = texSharp = texSoft = null; initGL(); vw = vh = 0; start(); };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    function start() {
      if (reduced || frozen != null) { host.classList.add('is-still'); renderStill(frozen || 0); return; }
      raf = requestAnimationFrame(frame);
    }
    start();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { texW = 0; vw = vh = 0; if (reduced || frozen != null) renderStill(frozen || 0); });

    const inst = { host, relayout() { texW = 0; vw = vh = 0; if (reduced || frozen != null) renderStill(frozen || 0); }, boing: () => boing(isMobile ? 0.70 : 0.60), destroy() { try { host._swLiquidDestroy?.(); } catch (_) {} } };
    instances.add(inst);
    host._swLiquidDebug = { st, get quality() { return quality; }, get size() { return [vw, vh]; }, get tier() { return tierName; }, render: renderStill };
    host._swLiquidDestroy = () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      canvas.removeEventListener('pointerdown', onDown); host.removeEventListener('pointermove', onHover); host.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointermove', onDrag); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      instances.delete(inst);
      delete host.dataset.liquidReady;
    };
  }

  function cleanupDisconnected() { instances.forEach(i => { if (i.host && !i.host.isConnected) i.destroy?.(); }); }
  function mountAll() { cleanupDisconnected(); document.querySelectorAll('[data-liquid-hero]').forEach(mount); }
  document.addEventListener('signwell:render', mountAll);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll, { once: true }); else mountAll();
  /* Live tuning: SignWellLiquidHero.config({ spinRate: 0.18, jelly: 1.4 }) applies immediately. */
  function config(partial) {
    cleanupDisconnected();
    if (partial && typeof partial === 'object') Object.assign(CFG, partial);
    instances.forEach(i => i.relayout());
    return Object.assign({}, CFG);
  }
  window.SignWellLiquidHero = { mount: mountAll, config, jiggle: () => instances.forEach(i => i.boing()), version: VERSION };
})();
