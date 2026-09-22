import { soundEngine } from '../audio/soundEngine.js';

/**
 * Ultra-High-Performance 3D Rigid Sphere & Concave Bowl Physics Engine
 * - Inward-converging spiral vortex: balls NEVER get stuck at the sides
 * - Perimeter air jets constantly deflect balls back into the center
 * - Center upward air fountain creates continuous chaotic tumbling in the middle
 * - Zero GC allocations, locked 60+ FPS
 */
export class PhysicsWorld {
  constructor() {
    this.balls = [];
    this.gravity = -20.0;

    // Chamber dimensions: kept compact so balls stay prominently in the middle
    this.bowlRadius = 2.45;       // Inner active swirl boundary
    this.bowlBottomY = -1.15;     // Lowest center point of dish
    this.bowlSlope = 0.095;       // Parabolic concave curve y = bottom + slope * r^2
    this.ceilingY = 3.2;          // Top ceiling limit

    this.restitution = 0.7;       // Bounciness
    this.friction = 0.985;        // Rolling damping

    this.isAgitating = false;
    this.turbulenceLevel = 0.0;
    this.scoopedBall = null;
    this.lastClackTime = 0;
  }

  addBall(id, initialPos, radius = 0.33) {
    const item = {
      id,
      radius,
      mass: 0.3,
      x: initialPos.x || 0,
      y: initialPos.y || (this.bowlBottomY + 0.35),
      z: initialPos.z || 0,
      vx: (Math.random() - 0.5) * 1.5,
      vy: Math.random() * 1.0,
      vz: (Math.random() - 0.5) * 1.5,
      rx: Math.random() * Math.PI * 2,
      ry: Math.random() * Math.PI * 2,
      rz: Math.random() * Math.PI * 2,
      avx: (Math.random() - 0.5) * 3,
      avy: (Math.random() - 0.5) * 3,
      avz: (Math.random() - 0.5) * 3,
      body: {
        position: { x: 0, y: 0, z: 0 },
        quaternion: { x: 0, y: 0, z: 0, w: 1 }
      }
    };

    item.body.position.x = item.x;
    item.body.position.y = item.y;
    item.body.position.z = item.z;

    this.balls.push(item);
    return item;
  }

  removeBall(id) {
    const idx = this.balls.findIndex(b => b.id === id);
    if (idx !== -1) {
      this.balls.splice(idx, 1);
    }
  }

  clearAllBalls() {
    this.balls = [];
    this.scoopedBall = null;
  }

  setAgitating(isAgitating, intensity = 1.0) {
    this.isAgitating = isAgitating;
    this.turbulenceLevel = intensity;
  }

  step(dt) {
    const clampedDt = Math.min(dt, 0.033);
    const subSteps = 2;
    const subDt = clampedDt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this.subStep(subDt);
    }

    const len = this.balls.length;
    for (let i = 0; i < len; i++) {
      const b = this.balls[i];
      b.body.position.x = b.x;
      b.body.position.y = b.y;
      b.body.position.z = b.z;

      const c1 = Math.cos(b.rx * 0.5);
      const c2 = Math.cos(b.ry * 0.5);
      const c3 = Math.cos(b.rz * 0.5);
      const s1 = Math.sin(b.rx * 0.5);
      const s2 = Math.sin(b.ry * 0.5);
      const s3 = Math.sin(b.rz * 0.5);

      b.body.quaternion.w = c1 * c2 * c3 - s1 * s2 * s3;
      b.body.quaternion.x = s1 * c2 * c3 + c1 * s2 * s3;
      b.body.quaternion.y = c1 * s2 * c3 - s1 * c2 * s3;
      b.body.quaternion.z = c1 * c2 * s3 + s1 * s2 * c3;
    }
  }

  subStep(dt) {
    const numBalls = this.balls.length;
    const agitating = this.isAgitating || this.turbulenceLevel > 0.02;
    const turbScale = this.turbulenceLevel;
    const timeNow = performance.now() * 0.001;

    // 1. Integration & Forces
    for (let i = 0; i < numBalls; i++) {
      const b = this.balls[i];
      if (this.scoopedBall && this.scoopedBall.id === b.id) continue;

      // Gravity pulling downward
      b.vy += this.gravity * dt;

      // Distance from center
      const r = Math.sqrt(b.x * b.x + b.z * b.z) + 0.0001;
      const nx = b.x / r;
      const nz = b.z / r;

      if (agitating) {
        // INWARD SPIRALING VORTEX:
        // Combines tangential spin with a persistent inward radial pull
        const swirlSpeed = 10.5 * turbScale;
        // Tangential: (-nz, 0, nx)
        // Inward: (-nx, 0, -nz)
        const spiralX = (-nz * 0.72 - nx * 0.55) * swirlSpeed;
        const spiralZ = (nx * 0.72 - nz * 0.55) * swirlSpeed;

        b.vx += (spiralX - b.vx) * 4.2 * dt;
        b.vz += (spiralZ - b.vz) * 4.2 * dt;

        // Upward fountain lift at center (strongest when r < 1.4)
        const centerFactor = Math.max(0, 1.0 - (r / 1.8));
        const blowerLift = (32.0 + Math.sin(timeNow * 4 + i) * 6.0) * centerFactor * turbScale;
        b.vy += blowerLift * dt;

        // STRONG INWARD AIR JET:
        // As balls move away from center (r > 1.2), inward pressure blows them back to the middle!
        if (r > 1.1) {
          const pushInward = Math.min(36.0, Math.pow((r - 1.1) / 1.1, 1.5) * 32.0) * turbScale;
          b.vx -= nx * pushInward * dt;
          b.vz -= nz * pushInward * dt;
        }

        // Chaotic air flutter
        b.vx += (Math.sin(timeNow * 10 + i * 2) * 2.5) * turbScale * dt;
        b.vy += (Math.cos(timeNow * 8 + i * 3) * 3.5) * turbScale * dt;
        b.vz += (Math.cos(timeNow * 10 + i * 5) * 2.5) * turbScale * dt;
      } else {
        // Idle state: slope pulls balls into a tight center cluster
        b.vx += -nx * 2.5 * dt;
        b.vz += -nz * 2.5 * dt;
      }

      // Air resistance
      b.vx *= Math.pow(this.friction, dt * 60);
      b.vy *= Math.pow(0.992, dt * 60);
      b.vz *= Math.pow(this.friction, dt * 60);

      // Integrate position
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;

      // Integrate rotation
      b.rx += b.avx * dt;
      b.ry += b.avy * dt;
      b.rz += b.avz * dt;

      // Parabolic concave dish floor collision: y = bottom + slope * r^2
      const floorY = this.bowlBottomY + (this.bowlSlope * r * r) + b.radius;
      if (b.y < floorY) {
        b.y = floorY;

        const slopeX = -2 * this.bowlSlope * b.x;
        const slopeZ = -2 * this.bowlSlope * b.z;
        const nLen = Math.sqrt(slopeX * slopeX + 1.0 + slopeZ * slopeZ);
        const normX = slopeX / nLen;
        const normY = 1.0 / nLen;
        const normZ = slopeZ / nLen;

        const vDotN = b.vx * normX + b.vy * normY + b.vz * normZ;
        if (vDotN < 0) {
          b.vx -= (1 + this.restitution) * vDotN * normX;
          b.vy -= (1 + this.restitution) * vDotN * normY;
          b.vz -= (1 + this.restitution) * vDotN * normZ;

          if (Math.abs(vDotN) > 1.8 && (timeNow - this.lastClackTime > 0.03)) {
            soundEngine.playBallClack(Math.abs(vDotN));
            this.lastClackTime = timeNow;
          }

          b.avx += (b.vz * 2.0 - b.avx) * 0.1;
          b.avz += (-b.vx * 2.0 - b.avz) * 0.1;
        }
      }

      // Outer Perimeter Wall: Eject balls firmly back INWARD so they never stick!
      const maxR = this.bowlRadius - b.radius;
      if (r > maxR) {
        b.x = nx * maxR;
        b.z = nz * maxR;

        // Push velocity directly inward towards origin (0, 0)
        const vDotRad = b.vx * nx + b.vz * nz;
        if (vDotRad > 0) {
          // Reflect + give a strong inward launch velocity (+3.5 m/s inward)
          b.vx = -nx * (Math.abs(vDotRad) * 0.85 + 3.5);
          b.vz = -nz * (Math.abs(vDotRad) * 0.85 + 3.5);

          if (timeNow - this.lastClackTime > 0.03) {
            soundEngine.playBallClack(Math.abs(vDotRad) + 2.0);
            this.lastClackTime = timeNow;
          }
        }
      }

      // Ceiling boundary
      if (b.y > this.ceilingY - b.radius) {
        b.y = this.ceilingY - b.radius;
        if (b.vy > 0) b.vy *= -0.5;
      }
    }

    // 2. Ball-to-Ball Elastic Collisions
    for (let i = 0; i < numBalls; i++) {
      const b1 = this.balls[i];
      if (this.scoopedBall && this.scoopedBall.id === b1.id) continue;

      for (let j = i + 1; j < numBalls; j++) {
        const b2 = this.balls[j];
        if (this.scoopedBall && this.scoopedBall.id === b2.id) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dz = b2.z - b1.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const minDist = b1.radius + b2.radius;

        if (distSq < minDist * minDist && distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;

          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          const sep = overlap * 0.5;
          b1.x -= nx * sep;
          b1.y -= ny * sep;
          b1.z -= nz * sep;
          b2.x += nx * sep;
          b2.y += ny * sep;
          b2.z += nz * sep;

          const dvx = b2.vx - b1.vx;
          const dvy = b2.vy - b1.vy;
          const dvz = b2.vz - b1.vz;
          const vRelNormal = dvx * nx + dvy * ny + dvz * nz;

          if (vRelNormal < 0) {
            const impulse = -(1 + this.restitution) * vRelNormal * 0.5;
            b1.vx -= nx * impulse;
            b1.vy -= ny * impulse;
            b1.vz -= nz * impulse;
            b2.vx += nx * impulse;
            b2.vy += ny * impulse;
            b2.vz += nz * impulse;

            const hitMagnitude = Math.abs(vRelNormal);
            if (hitMagnitude > 1.5 && (timeNow - this.lastClackTime > 0.025)) {
              soundEngine.playBallClack(hitMagnitude);
              this.lastClackTime = timeNow;
            }
          }
        }
      }
    }
  }
}
