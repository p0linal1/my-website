import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { curlNoiseGLSL } from "../animations/curlNoise.js";

// Vanilla Three.js port of the React Three Fiber FBO component.
// Loads pioneer_dj_console.glb, samples 65536 surface points, simulates
// particle positions each frame via GPU (curl noise + mouse repulsion),
// then renders them as blue additive point sprites.
// Requires a local HTTP server (e.g. VS Code Live Server) to load the GLB.

const SIM_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SIM_FRAG = `
  ${curlNoiseGLSL}
  uniform sampler2D positions;
  uniform float     uTime;
  uniform float     uFrequency;
  uniform vec2      uMouse;
  varying vec2      vUv;
  void main() {
    float wiggleSpeed   = 0.1;
    float wiggleAmp     = 0.3;
    float mouseRadius   = 0.6;
    float mouseStrength = 0.6;
    float viewScale     = 4.0;

    vec3 pos       = texture2D(positions, vUv).rgb;
    vec3 noise     = curlNoise(pos * uFrequency + uTime * wiggleSpeed);
    vec3 targetPos = pos + noise * wiggleAmp;

    vec2 mouseWorld = uMouse * viewScale;
    vec3 mousePos   = vec3(-mouseWorld.x, mouseWorld.y, 0.0);
    float dist      = distance(targetPos.xy, mousePos.xy);
    vec3 finalPos   = targetPos;
    if (dist < mouseRadius) {
      vec3 dir    = normalize(targetPos - mousePos);
      float force = 1.0 - dist / mouseRadius;
      finalPos   += dir * force * mouseStrength;
    }
    gl_FragColor = vec4(finalPos, 1.0);
  }
`;

const RENDER_VERT = `
  uniform sampler2D uPositions;
  void main() {
    vec3 pos      = texture2D(uPositions, position.xy).xyz;
    vec4 mvPos    = modelMatrix * vec4(pos, 1.0);
    vec4 vPos     = viewMatrix * mvPos;
    gl_Position   = projectionMatrix * vPos;
    gl_PointSize  = 3.0;
    gl_PointSize *= step(1.0 - (1.0 / 64.0), position.x) + 0.5;
  }
`;

const RENDER_FRAG = `
  void main() {
    gl_FragColor = vec4(1.0, 0.42, 0.61, 1.0);
  }
`;

export function initDJBoard() {
  const container = document.getElementById("dj-board-container");
  if (!container) return;

  const FBO = 256;
  const N   = FBO * FBO; // 65 536 particles

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(-60, -25, 85);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Off-screen simulation scene
  const simScene  = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1 / Math.pow(2, 53), 1);

  // FBO render target — stores particle world positions this frame
  const fbo = new THREE.WebGLRenderTarget(FBO, FBO, {
    minFilter:     THREE.NearestFilter,
    magFilter:     THREE.NearestFilter,
    format:        THREE.RGBAFormat,
    stencilBuffer: false,
    type:          THREE.FloatType,
  });

  // Full-screen quad for simulation pass
  const simGeo = new THREE.BufferGeometry();
  simGeo.setAttribute("position", new THREE.BufferAttribute(
    new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,-1,0, 1,1,0, -1,1,0]), 3));
  simGeo.setAttribute("uv", new THREE.BufferAttribute(
    new Float32Array([0,1, 1,1, 1,0, 0,1, 1,0, 0,0]), 2));

  // Particle geometry: UV coords used as indices into FBO texture
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pPos[i * 3 + 0] = (i % FBO) / FBO;
    pPos[i * 3 + 1] = Math.floor(i / FBO) / FBO;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));

  // Runtime state — populated once GLB loads
  let simMat = null, renderMat = null, rotGrp = null;
  const djPtr = new THREE.Vector2(0, 0);

  new GLTFLoader().load(
    "./public/pioneer_dj_console.glb",
    (gltf) => {
      let mesh = null;
      gltf.scene.traverse((c) => { if (c.isMesh && !mesh) mesh = c; });
      if (!mesh) { console.warn("No mesh found in pioneer_dj_console.glb"); return; }

      // Sample N surface points → RGBA float DataTexture
      const data    = new Float32Array(N * 4);
      const sampler = new MeshSurfaceSampler(mesh).build();
      const tmp     = new THREE.Vector3();
      for (let i = 0; i < N; i++) {
        sampler.sample(tmp);
        data[i * 4]     = tmp.x;
        data[i * 4 + 1] = tmp.y;
        data[i * 4 + 2] = tmp.z;
        data[i * 4 + 3] = 1.0;
      }
      const posTex = new THREE.DataTexture(data, FBO, FBO, THREE.RGBAFormat, THREE.FloatType);
      posTex.needsUpdate = true;

      simMat = new THREE.ShaderMaterial({
        uniforms: {
          positions:  { value: posTex },
          uTime:      { value: 0 },
          uFrequency: { value: 0.01 },
          uMouse:     { value: new THREE.Vector2(0, 0) },
        },
        vertexShader:   SIM_VERT,
        fragmentShader: SIM_FRAG,
      });
      simScene.add(new THREE.Mesh(simGeo, simMat));

      renderMat = new THREE.ShaderMaterial({
        uniforms:       { uPositions: { value: null } },
        vertexShader:   RENDER_VERT,
        fragmentShader: RENDER_FRAG,
        blending:       THREE.AdditiveBlending,
        depthWrite:     false,
      });

      // RotatingScene equivalent: group responds to mouse pointer
      rotGrp = new THREE.Group();
      const pts = new THREE.Points(pGeo, renderMat);
      pts.rotation.set(Math.PI, Math.PI / 6, 0);
      rotGrp.add(pts);
      rotGrp.position.x = -65;
      scene.add(rotGrp);
    },
    undefined,
    (e) => console.warn("pioneer_dj_console.glb load failed:", e)
  );

  container.addEventListener("mousemove", (e) => {
    const r = container.getBoundingClientRect();
    djPtr.set(
       ((e.clientX - r.left) / r.width)  * 2 - 1,
      -((e.clientY - r.top)  / r.height) * 2 + 1
    );
  });

  window.addEventListener("resize", () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  (function animate() {
    requestAnimationFrame(animate);

    if (!simMat || !rotGrp) {
      renderer.render(scene, camera);
      return;
    }

    const t = performance.now() * 0.001;
    simMat.uniforms.uTime.value = t;
    simMat.uniforms.uMouse.value.lerp(djPtr, 0.1);

    renderer.setRenderTarget(fbo);
    renderer.clear();
    renderer.render(simScene, simCamera);
    renderer.setRenderTarget(null);

    renderMat.uniforms.uPositions.value = fbo.texture;

    rotGrp.rotation.x = THREE.MathUtils.lerp(rotGrp.rotation.x, -djPtr.y * 0.5, 0.05);
    rotGrp.rotation.y = THREE.MathUtils.lerp(rotGrp.rotation.y,  djPtr.x * 0.5, 0.05);

    renderer.render(scene, camera);
  })();
}
