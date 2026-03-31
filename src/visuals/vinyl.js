const VINYL_SIZE = 160;
const VINYL_INSTANCES = new Map();

/** Initializes a spinning 3D vinyl scene within a container element. */
export function initVinyl(containerEl, albumArtUrl) {
  if (!containerEl) {
    return;
  }

  if (typeof THREE === "undefined") {
    console.warn("Nowify: Three.js not loaded — vinyl mode disabled");
    return;
  }

  destroyVinyl(containerEl);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 2.2;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(VINYL_SIZE, VINYL_SIZE);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  const directional = new THREE.DirectionalLight(0xffffff, 1.2);
  directional.position.set(2, 2, 2);
  scene.add(directional);
  scene.add(new THREE.AmbientLight(0x404040, 0.6));

  const discMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.8,
    roughness: 0.3,
  });
  const discGeometry = new THREE.CylinderGeometry(1, 1, 0.06, 64);
  const discMesh = new THREE.Mesh(discGeometry, discMaterial);
  scene.add(discMesh);

  let topMaterial;
  if (albumArtUrl) {
    const texture = new THREE.TextureLoader().load(albumArtUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    topMaterial = new THREE.MeshBasicMaterial({ map: texture });
  } else {
    topMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
  }

  const topCap = new THREE.Mesh(new THREE.CircleGeometry(0.72, 64), topMaterial);
  topCap.rotation.x = -Math.PI / 2;
  topCap.position.y = 0.031;
  scene.add(topCap);

  const centerHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  centerHole.rotation.x = -Math.PI / 2;
  centerHole.position.y = 0.032;
  scene.add(centerHole);

  const grooves = [];
  [0.75, 0.82, 0.88, 0.93].forEach((radius) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.006, radius, 96),
      new THREE.MeshBasicMaterial({
        color: 0x1a1a1a,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.031;
    grooves.push(ring);
    scene.add(ring);
  });

  containerEl.textContent = "";
  containerEl.appendChild(renderer.domElement);

  const instance = {
    scene,
    camera,
    renderer,
    discMesh,
    topCap,
    centerHole,
    grooves,
    isPlaying: true,
    frameId: null,
  };

  const animate = () => {
    if (!VINYL_INSTANCES.has(containerEl)) {
      return;
    }
    if (instance.isPlaying) {
      instance.discMesh.rotation.y += 0.008;
      instance.topCap.rotation.z += 0.008;
      instance.centerHole.rotation.z += 0.008;
      instance.grooves.forEach((ring) => {
        ring.rotation.z += 0.008;
      });
    }
    renderer.render(scene, camera);
    instance.frameId = window.requestAnimationFrame(animate);
  };

  VINYL_INSTANCES.set(containerEl, instance);
  animate();
}

/** Updates the album art texture for an existing vinyl instance. */
export function updateVinylArt(containerEl, albumArtUrl) {
  if (!containerEl) {
    return;
  }

  if (typeof THREE === "undefined") {
    console.warn("Nowify: Three.js not loaded — vinyl mode disabled");
    return;
  }

  const instance = VINYL_INSTANCES.get(containerEl);
  if (!instance) {
    console.warn("Nowify: No vinyl instance found for container");
    return;
  }

  const oldMaterial = instance.topCap.material;
  let nextMaterial;

  if (albumArtUrl) {
    const texture = new THREE.TextureLoader().load(albumArtUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    nextMaterial = new THREE.MeshBasicMaterial({ map: texture });
  } else {
    nextMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
  }

  instance.topCap.material = nextMaterial;
  if (oldMaterial?.map) {
    oldMaterial.map.dispose();
  }
  oldMaterial?.dispose();
}

/** Destroys a vinyl instance and frees all associated resources. */
export function destroyVinyl(containerEl) {
  if (!containerEl) {
    return;
  }

  const instance = VINYL_INSTANCES.get(containerEl);
  if (!instance) {
    return;
  }

  if (instance.frameId) {
    window.cancelAnimationFrame(instance.frameId);
  }

  instance.discMesh.geometry.dispose();
  instance.discMesh.material.dispose();

  instance.topCap.geometry.dispose();
  if (instance.topCap.material?.map) {
    instance.topCap.material.map.dispose();
  }
  instance.topCap.material.dispose();

  instance.centerHole.geometry.dispose();
  instance.centerHole.material.dispose();

  instance.grooves.forEach((ring) => {
    ring.geometry.dispose();
    ring.material.dispose();
  });

  instance.renderer.dispose();
  if (instance.renderer.domElement.parentNode === containerEl) {
    containerEl.removeChild(instance.renderer.domElement);
  }

  VINYL_INSTANCES.delete(containerEl);
}

/** Toggles spinning animation state for a vinyl instance. */
export function setVinylPlaying(containerEl, isPlaying) {
  if (!containerEl) {
    return;
  }

  const instance = VINYL_INSTANCES.get(containerEl);
  if (!instance) {
    return;
  }

  instance.isPlaying = Boolean(isPlaying);
}
