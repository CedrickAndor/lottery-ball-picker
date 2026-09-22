import * as THREE from 'three';

/**
 * Three.js 3D Lottery Ball Machine
 * Replicates the reference machine:
 * - Parabolic concave bowl chamber with glossy reflective dark floor
 * - Glowing circular neon LED ring matching the reference photo
 * - Chrome gantry frame and hemispherical wire basket scoop
 * - Top-mounted 7-segment digital display unit
 * - Highly optimized WebGL renderer (zero lag, 60+ FPS)
 */
export class LotteryMachine {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Ideal camera angle looking into the center dish and wire basket
    this.cameraPos = new THREE.Vector3(0, 3.8, 7.2);
    this.cameraLookAt = new THREE.Vector3(0, -0.2, 0);

    // Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080e);

    this.camera = new THREE.PerspectiveCamera(44, this.width / this.height, 0.1, 80);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    // Locked to 1.0 pixel ratio for guaranteed smooth 60+ FPS across all screens
    this.renderer.setPixelRatio(1.0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Machine sub-components
    this.basketGroup = new THREE.Group();
    this.ledDisplayMesh = null;
    this.ledCanvas = null;
    this.ledCtx = null;
    this.ledTexture = null;
    this.neonRingLight = null;
    this.neonRingMesh = null;

    // Animation state
    this.basketRestY = 1.35;
    this.basketCurrentY = 1.35;
    this.isScooping = false;

    this.themeColors = {
      'theme-cyan': { hex: 0x00f0ff, css: '#00f0ff' },
      'theme-gold': { hex: 0xffd700, css: '#ffd700' },
      'theme-emerald': { hex: 0x10b981, css: '#10b981' },
      'theme-ruby': { hex: 0xf43f5e, css: '#f43f5e' },
      'theme-purple': { hex: 0xa855f7, css: '#a855f7' }
    };
    this.currentTheme = 'theme-cyan';

    this.buildLighting();
    this.buildConcaveChamber();
    this.buildWireBasketAndGantry();
    this.buildOverheadLEDUnit();
    this.bindResize();
  }

  buildLighting() {
    // 1. Ambient soft stage light
    const ambientLight = new THREE.AmbientLight(0x28324a, 1.8);
    this.scene.add(ambientLight);

    // 2. Main top overhead spotlight focusing directly on the basket & bowl
    const spotLight = new THREE.DirectionalLight(0xffffff, 2.8);
    spotLight.position.set(0, 8.0, 3.0);
    this.scene.add(spotLight);

    // 3. Side rim lights for specular highlights on chrome
    const rimLightLeft = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLightLeft.position.set(-6, 4, -2);
    this.scene.add(rimLightLeft);

    const rimLightRight = new THREE.DirectionalLight(0xa855f7, 1.0);
    rimLightRight.position.set(6, 4, -2);
    this.scene.add(rimLightRight);

    // 4. Glowing bottom LED ring light (upward glow inside chamber)
    this.neonRingLight = new THREE.PointLight(0x00f0ff, 3.5, 8.0);
    this.neonRingLight.position.set(0, -0.2, 0);
    this.scene.add(this.neonRingLight);
  }

  buildConcaveChamber() {
    const bowlRadius = 3.3;

    // 1. Parabolic concave dish geometry using LatheGeometry (matches physics slope)
    const points = [];
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const r = (i / segments) * bowlRadius;
      // y = bottom + slope * r^2
      const y = -1.15 + (0.075 * r * r);
      points.push(new THREE.Vector2(r, y));
    }
    // Outer base
    points.push(new THREE.Vector2(bowlRadius + 0.15, -0.3));
    points.push(new THREE.Vector2(bowlRadius + 0.15, -1.35));
    points.push(new THREE.Vector2(0, -1.35));

    const dishGeo = new THREE.LatheGeometry(points, 36);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x080b12,
      roughness: 0.15,
      metalness: 0.75
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    this.scene.add(dishMesh);

    // 2. Glowing circular LED Halo Ring along the bowl's upper edge
    const ringY = -1.15 + (0.075 * bowlRadius * bowlRadius) + 0.05;
    const ringGeo = new THREE.TorusGeometry(bowlRadius * 0.94, 0.07, 12, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95
    });
    this.neonRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.neonRingMesh.rotation.x = Math.PI / 2;
    this.neonRingMesh.position.y = ringY;
    this.scene.add(this.neonRingMesh);

    // Outer dark metallic bevel ring
    const outerBevelGeo = new THREE.TorusGeometry(bowlRadius + 0.16, 0.14, 12, 48);
    const outerBevelMat = new THREE.MeshStandardMaterial({
      color: 0x181e2b,
      metalness: 0.9,
      roughness: 0.25
    });
    const outerBevel = new THREE.Mesh(outerBevelGeo, outerBevelMat);
    outerBevel.rotation.x = Math.PI / 2;
    outerBevel.position.y = ringY;
    this.scene.add(outerBevel);

    // 3. Lightweight transparent glass cylinder enclosure (ZERO multi-pass lag!)
    const glassGeo = new THREE.CylinderGeometry(bowlRadius, bowlRadius, 3.4, 36, 1, true);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.12,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.y = 1.4;
    this.scene.add(glassMesh);

    // Top metal chrome rim
    const topRimGeo = new THREE.TorusGeometry(bowlRadius, 0.08, 12, 48);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.12
    });
    const topRim = new THREE.Mesh(topRimGeo, chromeMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 3.1;
    this.scene.add(topRim);
  }

  buildWireBasketAndGantry() {
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.95,
      roughness: 0.12
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      metalness: 0.85,
      roughness: 0.3
    });

    // 1. Horizontal Chrome Suspension Gantry Ring (matches photo)
    const gantryRingGeo = new THREE.TorusGeometry(2.3, 0.08, 12, 36);
    const gantryRing = new THREE.Mesh(gantryRingGeo, chromeMat);
    gantryRing.rotation.x = Math.PI / 2;
    gantryRing.position.y = 1.8;
    this.scene.add(gantryRing);

    // Side support arms / pivots
    const pivotGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16);
    const leftPivot = new THREE.Mesh(pivotGeo, darkMetalMat);
    leftPivot.rotation.z = Math.PI / 2;
    leftPivot.position.set(-2.3, 1.8, 0);
    this.scene.add(leftPivot);

    const rightPivot = new THREE.Mesh(pivotGeo, darkMetalMat);
    rightPivot.rotation.z = Math.PI / 2;
    rightPivot.position.set(2.3, 1.8, 0);
    this.scene.add(rightPivot);

    // Crossbar
    const barGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.6, 12);
    const barMesh = new THREE.Mesh(barGeo, chromeMat);
    barMesh.rotation.z = Math.PI / 2;
    barMesh.position.y = 1.8;
    this.scene.add(barMesh);

    // 2. Movable Wire Basket Group (hemispherical wire cage)
    const basketRadius = 1.05;
    const ribCount = 16;

    // Horizontal wire hoops
    for (let r = 1; r <= 3; r++) {
      const ringRadius = (r / 3.2) * basketRadius;
      const wireRingGeo = new THREE.TorusGeometry(ringRadius, 0.018, 8, 24);
      const wireRing = new THREE.Mesh(wireRingGeo, chromeMat);
      wireRing.rotation.x = Math.PI / 2;
      wireRing.position.y = -0.32 + (r * 0.12);
      this.basketGroup.add(wireRing);
    }

    // Top rim of basket
    const basketTopRimGeo = new THREE.TorusGeometry(basketRadius, 0.03, 10, 32);
    const basketTopRim = new THREE.Mesh(basketTopRimGeo, chromeMat);
    basketTopRim.rotation.x = Math.PI / 2;
    basketTopRim.position.y = 0.12;
    this.basketGroup.add(basketTopRim);

    // Vertical curved wire ribs
    for (let i = 0; i < ribCount; i++) {
      const phi = (i / ribCount) * Math.PI * 2;
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, -0.38, 0),
        new THREE.Vector3(Math.cos(phi) * (basketRadius * 0.45), -0.32, Math.sin(phi) * (basketRadius * 0.45)),
        new THREE.Vector3(Math.cos(phi) * (basketRadius * 0.95), -0.05, Math.sin(phi) * (basketRadius * 0.95)),
        new THREE.Vector3(Math.cos(phi) * basketRadius, 0.12, Math.sin(phi) * basketRadius)
      );

      const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.015, 6, false);
      const ribMesh = new THREE.Mesh(tubeGeo, chromeMat);
      this.basketGroup.add(ribMesh);
    }

    // Central scoop bottom hub
    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12);
    const hubMesh = new THREE.Mesh(hubGeo, chromeMat);
    hubMesh.position.y = -0.38;
    this.basketGroup.add(hubMesh);

    // Initial basket position
    this.basketGroup.position.set(0, this.basketRestY, 0);
    this.scene.add(this.basketGroup);
  }

  buildOverheadLEDUnit() {
    const boxWidth = 1.35;
    const boxHeight = 0.85;
    const boxDepth = 0.45;

    const boxGeo = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x141822,
      metalness: 0.7,
      roughness: 0.35
    });

    const housingMesh = new THREE.Mesh(boxGeo, boxMat);
    housingMesh.position.set(0, 2.45, 0);
    this.scene.add(housingMesh);

    // Bezel frame
    const bezelGeo = new THREE.BoxGeometry(boxWidth * 0.88, boxHeight * 0.75, 0.06);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c12,
      metalness: 0.9,
      roughness: 0.2
    });
    const bezel = new THREE.Mesh(bezelGeo, bezelMat);
    bezel.position.set(0, 2.45, boxDepth * 0.5 + 0.02);
    this.scene.add(bezel);

    // 7-segment Canvas texture
    this.ledCanvas = document.createElement('canvas');
    this.ledCanvas.width = 256;
    this.ledCanvas.height = 128;
    this.ledCtx = this.ledCanvas.getContext('2d');

    this.ledTexture = new THREE.CanvasTexture(this.ledCanvas);
    this.ledTexture.minFilter = THREE.LinearFilter;

    const screenGeo = new THREE.PlaneGeometry(boxWidth * 0.78, boxHeight * 0.6);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.ledTexture,
      transparent: true
    });

    this.ledDisplayMesh = new THREE.Mesh(screenGeo, screenMat);
    this.ledDisplayMesh.position.set(0, 2.45, boxDepth * 0.5 + 0.05);
    this.scene.add(this.ledDisplayMesh);

    this.updateLEDDisplay('--');
  }

  updateLEDDisplay(text) {
    if (!this.ledCtx) return;
    const ctx = this.ledCtx;
    const w = this.ledCanvas.width;
    const h = this.ledCanvas.height;

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, w, h);

    // Digital segment grid lines
    ctx.strokeStyle = '#0e1420';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Glowing numerals
    ctx.fillStyle = this.themeColors[this.currentTheme]?.css || '#00f0ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.font = 'bold 70px "Orbitron", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), w / 2, h / 2 + 4);

    this.ledTexture.needsUpdate = true;
  }

  setTheme(themeName) {
    if (!this.themeColors[themeName]) return;
    this.currentTheme = themeName;
    const colorObj = this.themeColors[themeName];

    if (this.neonRingLight) this.neonRingLight.color.setHex(colorObj.hex);
    if (this.neonRingMesh) this.neonRingMesh.material.color.setHex(colorObj.hex);
    this.updateLEDDisplay('--');
  }

  // Kinematic wire basket dip & scoop animation
  triggerScoopAnimation(onPeakLower, onComplete) {
    this.isScooping = true;
    const startTime = performance.now();
    const duration = 2200; // ms
    let lowerTriggered = false;

    // Dips down to center dish: -0.65 (where balls cluster in the middle)
    const dipTargetY = -0.65;

    const animateScoop = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 0.35) {
        const t = progress / 0.35;
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        this.basketCurrentY = THREE.MathUtils.lerp(this.basketRestY, dipTargetY, ease);
      } else if (progress < 0.45) {
        this.basketCurrentY = dipTargetY;
        if (!lowerTriggered) {
          lowerTriggered = true;
          if (onPeakLower) onPeakLower();
        }
      } else {
        const t = (progress - 0.45) / 0.55;
        const ease = t * (2 - t);
        this.basketCurrentY = THREE.MathUtils.lerp(dipTargetY, this.basketRestY, ease);
      }

      this.basketGroup.position.y = this.basketCurrentY;

      if (progress < 1) {
        requestAnimationFrame(animateScoop);
      } else {
        this.isScooping = false;
        this.basketGroup.position.y = this.basketRestY;
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(animateScoop);
  }

  bindResize() {
    window.addEventListener('resize', () => {
      this.width = this.container.clientWidth;
      this.height = this.container.clientHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    });
  }

  update(dt) {
    // Subtle breathing pulse on neon ring
    if (this.neonRingLight) {
      const pulse = Math.sin(Date.now() * 0.003) * 0.25;
      this.neonRingLight.intensity = 3.2 + pulse;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
