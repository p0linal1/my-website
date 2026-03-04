import * as THREE from "three";
import { flowerNoiseGLSL } from "../animations/flowerNoise.js";

export function initFlower() {
  const container = document.getElementById("flower-container");
  if (!container) return;

  const isMobile = window.innerWidth < 640;
  const DPR = Math.min(window.devicePixelRatio, 2);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = isMobile ? 5.0 : 4.5;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Generate petal-distributed particle positions.
  // 5 petals, each an elongated ellipse radiating from center.
  // Inner 18% of radius is empty so hero text isn't obscured.
  const COUNT    = isMobile ? 8000 : 14000;
  const N_PETALS = 5;
  const RADIUS   = isMobile ? 1.3 : 1.6;

  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const petalIdx   = Math.floor(Math.random() * N_PETALS);
    const petalAngle = (petalIdx / N_PETALS) * Math.PI * 2;

    // t ∈ [0.18, 1.0]: position along petal (0 = center hole, 1 = tip)
    const t = 0.18 + Math.pow(Math.random(), 0.55) * 0.82;

    // Half-width: zero at base and tip, max at midpoint
    const halfWidth = RADIUS * 0.22 * Math.sin(Math.PI * t);
    const w         = halfWidth * (Math.random() * 2 - 1);
    const r         = RADIUS * t;

    // Slight Z depth for 3D feel
    const z = 0.3 * Math.sin(Math.PI * t) * (Math.random() * 2 - 1);

    // Rotate local coords into world space by petal angle
    pos[i * 3]     = r * Math.cos(petalAngle) - w * Math.sin(petalAngle);
    pos[i * 3 + 1] = r * Math.sin(petalAngle) + w * Math.cos(petalAngle);
    pos[i * 3 + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDPR:  { value: DPR },
    },
    vertexShader: `
      ${flowerNoiseGLSL}
      uniform float uTime;
      uniform float uDPR;
      void main() {
        float nx = snoise(position * 1.1 + vec3(uTime * 0.08, 0., 0.));
        float ny = snoise(position * 1.1 + vec3(0., uTime * 0.10, 0.));
        float nz = snoise(position * 1.1 + vec3(0., 0., uTime * 0.07));
        vec3 displaced = position + vec3(nx, ny, nz) * 0.10;

        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        gl_Position = projectionMatrix * mvPos;

        float t = length(position.xy) / ${RADIUS.toFixed(2)};
        gl_PointSize = (2.8 + 1.2 * (1.0 - t)) * uDPR;
      }
    `,
    fragmentShader: `
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv) * 2.0;
        if (d > 1.0) discard;
        float alpha = (1.0 - d) * 0.42;
        vec3 col = mix(vec3(1.0, 0.96, 0.98), vec3(1.0, 0.42, 0.61), d * 0.85);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    blending:    THREE.AdditiveBlending,
    transparent: true,
    depthTest:   false,
  });

  const points = new THREE.Points(geo, mat);
  const group  = new THREE.Group();
  group.add(points);
  scene.add(group);

  let mX = 0, mY = 0;
  window.addEventListener("mousemove", (e) => {
    mX =  (e.clientX / window.innerWidth)  * 2 - 1;
    mY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener("resize", () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  (function animate() {
    requestAnimationFrame(animate);
    const t = performance.now() * 0.001;
    group.rotation.x += ( mY * 0.35 - group.rotation.x) * 0.025;
    group.rotation.y += (-mX * 0.35 - group.rotation.y) * 0.025;
    group.rotation.y += 0.0006;
    mat.uniforms.uTime.value = t;
    renderer.render(scene, camera);
  })();
}
