import * as THREE from 'three';

/**
 * Manages 3D Lottery Balls with Authentic Matte Lottery Decals
 * Team names/labels (e.g. A1, A2, B1, B2) are printed prominently inside the lottery rings.
 */
export class BallManager {
  constructor(scene, physicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.ballRadius = 0.33;
    this.ballMeshes = new Map(); // id -> { mesh, bodyEntry, data }
    this.textureCache = new Map();

    // Lightweight sphere geometry (optimized segment count for silky smooth 60+ FPS)
    this.geometry = new THREE.SphereGeometry(this.ballRadius, 20, 16);
  }

  // Create authentic lottery ball texture with team name (e.g. A1, A2, B1) printed inside
  createLotteryBallTexture(name, palette) {
    const cleanName = String(name).trim().toUpperCase();
    const cacheKey = `${cleanName}_${palette.ring}`;
    if (this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // 1. Base sphere color: authentic lottery ball matte white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 256);

    // 2. Draw circular lottery stamp on 4 quadrants (visible from every tumbling angle)
    const drawLotteryStamp = (cx, cy) => {
      // Outer colored lottery ring
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fillStyle = palette.fill || '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = palette.ring;
      ctx.stroke();

      // Inner thin accent ring
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = palette.ring;
      ctx.stroke();

      // Team name/code (e.g. A1, A2, B1, B2) centered inside the ring
      ctx.fillStyle = palette.text || '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (cleanName.length <= 2) {
        ctx.font = '900 42px "Orbitron", "Inter", sans-serif';
        ctx.fillText(cleanName, cx, cy - 2);
        // Orientation underline bar
        ctx.fillStyle = palette.ring;
        ctx.fillRect(cx - 16, cy + 22, 32, 4);
      } else if (cleanName.length <= 4) {
        ctx.font = '900 32px "Orbitron", "Inter", sans-serif';
        ctx.fillText(cleanName, cx, cy - 2);
        ctx.fillStyle = palette.ring;
        ctx.fillRect(cx - 18, cy + 20, 36, 3.5);
      } else {
        ctx.font = 'bold 22px "Inter", sans-serif';
        const displayShort = cleanName.length > 7 ? cleanName.substring(0, 6) + '…' : cleanName;
        ctx.fillText(displayShort, cx, cy);
      }
    };

    // 4 opposing quadrants around the sphere equator
    drawLotteryStamp(64, 128);
    drawLotteryStamp(192, 128);
    drawLotteryStamp(320, 128);
    drawLotteryStamp(448, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  // Add single team ball dynamically (drops from top of chamber into the bowl)
  spawnBall(teamData, dropFromTop = true) {
    if (this.ballMeshes.has(teamData.id)) return;

    const texture = this.createLotteryBallTexture(teamData.name, teamData.palette);

    // Authentic lottery ball material: matte plastic, no billiard resin gloss
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.58,   // Matte / satin finish
      metalness: 0.0
    });

    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    // Drop position: if added live, drops from overhead (y = 2.4)
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.8;
    const initialPos = {
      x: Math.cos(theta) * r,
      y: dropFromTop ? 2.4 : -0.7 + Math.random() * 0.3,
      z: Math.sin(theta) * r
    };

    mesh.position.set(initialPos.x, initialPos.y, initialPos.z);
    this.scene.add(mesh);

    // Physics body
    const bodyEntry = this.physicsWorld.addBall(teamData.id, initialPos, this.ballRadius);
    if (dropFromTop) {
      bodyEntry.vy = -2.0;
    }

    this.ballMeshes.set(teamData.id, {
      mesh,
      bodyEntry,
      data: teamData
    });
  }

  removeBall(id) {
    const entry = this.ballMeshes.get(id);
    if (entry) {
      this.scene.remove(entry.mesh);
      this.physicsWorld.removeBall(id);
      this.ballMeshes.delete(id);
    }
  }

  removeAll() {
    for (const [id, entry] of this.ballMeshes.entries()) {
      this.scene.remove(entry.mesh);
    }
    this.ballMeshes.clear();
    this.physicsWorld.clearAllBalls();
  }

  // Update Three.js meshes from physics (zero allocations)
  update() {
    this.ballMeshes.forEach(entry => {
      const { mesh, bodyEntry } = entry;
      mesh.position.set(bodyEntry.x, bodyEntry.y, bodyEntry.z);
      mesh.rotation.x = bodyEntry.rx;
      mesh.rotation.y = bodyEntry.ry;
      mesh.rotation.z = bodyEntry.rz;
    });
  }

  getBall(id) {
    return this.ballMeshes.get(id);
  }
}
