import * as THREE from "three";

const {
  TAU,
  clamp,
  lerp,
  dist,
  angleDiff,
  circleIntersectsRect,
  normalizeWantedLevel,
  formatWantedStars,
  updateWantedState
} = window.GameLogic;

function createMaterial(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.08,
    ...extras
  });
}

function setMeshShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

class Map {
  constructor(game) {
    this.game = game;
    this.size = 3200;
    this.roadSpacing = 400;
    this.roadWidth = 124;
    this.sidewalkWidth = 28;
    this.laneOffset = 23;
    this.verticalRoads = [];
    this.horizontalRoads = [];
    this.buildings = [];
    this.trees = [];
    this.trafficLights = [];
    this.sidewalkPoints = [];
    this.intersections = [];
    this.minimapCanvas = document.createElement("canvas");
    this.minimapCanvas.width = 220;
    this.minimapCanvas.height = 220;
    this.minimapCtx = this.minimapCanvas.getContext("2d");
    this.lightBulbs = [];
    this.group = new THREE.Group();
    this.generate();
    this.buildScene();
    this.buildMinimap();
  }

  rand(a, b, c = 0) {
    const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
    return value - Math.floor(value);
  }

  generate() {
    for (let x = 400; x < this.size; x += this.roadSpacing) {
      this.verticalRoads.push(x);
    }
    for (let y = 400; y < this.size; y += this.roadSpacing) {
      this.horizontalRoads.push(y);
    }

    for (const x of this.verticalRoads) {
      for (const y of this.horizontalRoads) {
        this.intersections.push({ x, y });
      }
    }

    for (let xi = -1; xi < this.verticalRoads.length; xi++) {
      const leftRoadCenter = xi >= 0 ? this.verticalRoads[xi] : null;
      const rightRoadCenter = xi + 1 < this.verticalRoads.length ? this.verticalRoads[xi + 1] : null;
      const leftEdge = leftRoadCenter ? leftRoadCenter + this.roadWidth / 2 + this.sidewalkWidth : 60;
      const rightEdge = rightRoadCenter ? rightRoadCenter - this.roadWidth / 2 - this.sidewalkWidth : this.size - 60;

      for (let yi = -1; yi < this.horizontalRoads.length; yi++) {
        const topRoadCenter = yi >= 0 ? this.horizontalRoads[yi] : null;
        const bottomRoadCenter = yi + 1 < this.horizontalRoads.length ? this.horizontalRoads[yi + 1] : null;
        const topEdge = topRoadCenter ? topRoadCenter + this.roadWidth / 2 + this.sidewalkWidth : 60;
        const bottomEdge = bottomRoadCenter ? bottomRoadCenter - this.roadWidth / 2 - this.sidewalkWidth : this.size - 60;

        const blockW = rightEdge - leftEdge;
        const blockH = bottomEdge - topEdge;
        if (blockW < 140 || blockH < 140) continue;

        const cols = this.rand(xi + 5, yi + 9) > 0.45 ? 2 : 1;
        const rows = this.rand(xi + 11, yi + 3) > 0.55 ? 2 : 1;
        const gap = 20;

        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const lotX = leftEdge + cx * (blockW / cols);
            const lotY = topEdge + cy * (blockH / rows);
            const lotW = blockW / cols;
            const lotH = blockH / rows;
            const px = 16 + this.rand(xi + cx, yi + cy, 2) * 22;
            const py = 16 + this.rand(xi + cx, yi + cy, 3) * 22;
            const bw = Math.max(70, lotW - gap - px);
            const bh = Math.max(70, lotH - gap - py);

            this.buildings.push({
              x: lotX + px * 0.5,
              y: lotY + py * 0.5,
              w: bw,
              h: bh,
              tone: Math.floor(this.rand(xi + cx, yi + cy, 4) * 4),
              height3D: 36 + Math.floor(this.rand(xi + cx, yi + cy, 5) * 80)
            });
          }
        }
      }
    }

    for (const x of this.verticalRoads) {
      for (let y = 120; y <= this.size - 120; y += 160) {
        this.trees.push({ x: x - this.roadWidth / 2 - 18, y: y + 14, tilt: this.rand(x, y, 1) });
        this.trees.push({ x: x + this.roadWidth / 2 + 18, y: y - 12, tilt: this.rand(x, y, 2) });
        this.sidewalkPoints.push({ x: x - this.roadWidth / 2 - 12, y });
        this.sidewalkPoints.push({ x: x + this.roadWidth / 2 + 12, y: y + 28 });
      }
    }

    for (const y of this.horizontalRoads) {
      for (let x = 120; x <= this.size - 120; x += 160) {
        this.trees.push({ x: x + 22, y: y - this.roadWidth / 2 - 18, tilt: this.rand(x, y, 3) });
        this.trees.push({ x: x - 22, y: y + this.roadWidth / 2 + 18, tilt: this.rand(x, y, 4) });
        this.sidewalkPoints.push({ x, y: y - this.roadWidth / 2 - 12 });
        this.sidewalkPoints.push({ x: x + 28, y: y + this.roadWidth / 2 + 12 });
      }
    }

    for (const x of this.verticalRoads) {
      for (const y of this.horizontalRoads) {
        const o = this.roadWidth / 2 + 10;
        this.trafficLights.push({ x: x - o, y: y - o, dir: 0 });
        this.trafficLights.push({ x: x + o, y: y - o, dir: 1 });
        this.trafficLights.push({ x: x - o, y: y + o, dir: 2 });
        this.trafficLights.push({ x: x + o, y: y + o, dir: 3 });
      }
    }
  }

  buildScene() {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(this.size, this.size),
      createMaterial("#3e6d4e")
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    grass.position.set(this.size / 2, -0.5, this.size / 2);
    this.group.add(grass);

    const sidewalkMaterial = createMaterial("#d8cfbe");
    const roadMaterial = createMaterial("#4e555f");
    const lineMaterial = createMaterial("#f4e39c", { emissive: "#5b4e1a", emissiveIntensity: 0.15 });

    for (const x of this.verticalRoads) {
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(this.roadWidth + this.sidewalkWidth * 2, 2, this.size),
        sidewalkMaterial
      );
      sidewalk.position.set(x, 0.5, this.size / 2);
      sidewalk.receiveShadow = true;
      this.group.add(sidewalk);

      const road = new THREE.Mesh(
        new THREE.BoxGeometry(this.roadWidth, 1.5, this.size),
        roadMaterial
      );
      road.position.set(x, 0.7, this.size / 2);
      road.receiveShadow = true;
      this.group.add(road);

      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.2, this.size),
        lineMaterial
      );
      lane.position.set(x, 1.5, this.size / 2);
      this.group.add(lane);
    }

    for (const y of this.horizontalRoads) {
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(this.size, 2, this.roadWidth + this.sidewalkWidth * 2),
        sidewalkMaterial
      );
      sidewalk.position.set(this.size / 2, 0.52, y);
      sidewalk.receiveShadow = true;
      this.group.add(sidewalk);

      const road = new THREE.Mesh(
        new THREE.BoxGeometry(this.size, 1.5, this.roadWidth),
        roadMaterial
      );
      road.position.set(this.size / 2, 0.72, y);
      road.receiveShadow = true;
      this.group.add(road);

      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(this.size, 0.2, 4),
        lineMaterial
      );
      lane.position.set(this.size / 2, 1.5, y);
      this.group.add(lane);
    }

    const buildingPalettes = [
      ["#7f8898", "#a9b3c2"],
      ["#8b7a6f", "#b39e91"],
      ["#6e8596", "#9bb2c4"],
      ["#846e6a", "#b09189"]
    ];

    for (const building of this.buildings) {
      const [baseColor, roofColor] = buildingPalettes[building.tone];
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(building.w, building.height3D, building.h),
        createMaterial(baseColor)
      );
      body.position.set(
        building.x + building.w / 2,
        building.height3D / 2,
        building.y + building.h / 2
      );
      setMeshShadows(body);
      this.group.add(body);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(building.w * 0.78, 4, building.h * 0.78),
        createMaterial(roofColor)
      );
      roof.position.set(
        building.x + building.w / 2,
        building.height3D + 2,
        building.y + building.h / 2
      );
      setMeshShadows(roof);
      this.group.add(roof);
    }

    for (const tree of this.trees) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 3.2, 18, 8),
        createMaterial("#7a5435")
      );
      trunk.position.set(tree.x, 9, tree.y);
      trunk.rotation.z = (tree.tilt - 0.5) * 0.08;
      setMeshShadows(trunk);

      const crownMaterial = createMaterial("#2c7f53");
      const crownGroup = new THREE.Group();
      const crownOffsets = [
        [0, 20, 0, 11],
        [6, 18, 4, 9],
        [-6, 18, -4, 9],
        [5, 16, -5, 8],
        [-5, 16, 5, 8]
      ];

      for (const [ox, oy, oz, radius] of crownOffsets) {
        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 10, 10),
          crownMaterial
        );
        crown.position.set(tree.x + ox, oy, tree.y + oz);
        setMeshShadows(crown);
        crownGroup.add(crown);
      }

      this.group.add(trunk);
      this.group.add(crownGroup);
    }

    for (const light of this.trafficLights) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.8, 18, 6),
        createMaterial("#30333a")
      );
      pole.position.set(light.x, 9, light.y);
      pole.castShadow = true;
      this.group.add(pole);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(5, 8, 4),
        createMaterial("#1b2026")
      );
      housing.position.set(light.x, 17, light.y);
      setMeshShadows(housing);
      this.group.add(housing);

      const redBulb = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        createMaterial("#3d1717", { emissive: "#220000", emissiveIntensity: 0.2 })
      );
      redBulb.position.set(light.x, 19, light.y + 1);
      const greenBulb = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        createMaterial("#14311d", { emissive: "#001100", emissiveIntensity: 0.2 })
      );
      greenBulb.position.set(light.x, 15.2, light.y + 1);

      this.lightBulbs.push({ red: redBulb, green: greenBulb });
      this.group.add(redBulb);
      this.group.add(greenBulb);
    }

    this.game.scene.add(this.group);
  }

  updateEnvironment(time) {
    const lightPhase = Math.floor(time * 0.7) % 2;
    for (const bulb of this.lightBulbs) {
      if (lightPhase === 0) {
        bulb.red.material.emissive.set("#ff4d4d");
        bulb.red.material.emissiveIntensity = 1.8;
        bulb.green.material.emissive.set("#0a220f");
        bulb.green.material.emissiveIntensity = 0.18;
      } else {
        bulb.red.material.emissive.set("#220000");
        bulb.red.material.emissiveIntensity = 0.18;
        bulb.green.material.emissive.set("#43ff7c");
        bulb.green.material.emissiveIntensity = 1.4;
      }
    }
  }

  buildMinimap() {
    const ctx = this.minimapCtx;
    const s = this.minimapCanvas.width;
    ctx.fillStyle = "#224235";
    ctx.fillRect(0, 0, s, s);

    const scale = s / this.size;
    ctx.strokeStyle = "#dfd5c0";
    ctx.lineWidth = (this.roadWidth + this.sidewalkWidth * 2) * scale;
    ctx.lineCap = "square";

    for (const x of this.verticalRoads) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, s);
      ctx.stroke();
    }
    for (const y of this.horizontalRoads) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(s, y * scale);
      ctx.stroke();
    }

    ctx.strokeStyle = "#525761";
    ctx.lineWidth = this.roadWidth * scale;
    for (const x of this.verticalRoads) {
      ctx.beginPath();
      ctx.moveTo(x * scale, 0);
      ctx.lineTo(x * scale, s);
      ctx.stroke();
    }
    for (const y of this.horizontalRoads) {
      ctx.beginPath();
      ctx.moveTo(0, y * scale);
      ctx.lineTo(s, y * scale);
      ctx.stroke();
    }

    ctx.fillStyle = "#7f8794";
    for (const building of this.buildings) {
      ctx.fillRect(building.x * scale, building.y * scale, building.w * scale, building.h * scale);
    }
  }

  isOnRoad(x, y) {
    return this.verticalRoads.some((roadX) => Math.abs(x - roadX) <= this.roadWidth / 2) ||
      this.horizontalRoads.some((roadY) => Math.abs(y - roadY) <= this.roadWidth / 2);
  }

  collidesCircle(x, y, radius) {
    if (x - radius < 8 || y - radius < 8 || x + radius > this.size - 8 || y + radius > this.size - 8) {
      return true;
    }

    for (const building of this.buildings) {
      if (circleIntersectsRect(x, y, radius, building)) {
        return true;
      }
    }

    return false;
  }

  tryMoveCircle(entity, nextX, nextY) {
    let moved = false;
    if (!this.collidesCircle(nextX, entity.y, entity.radius)) {
      entity.x = nextX;
      moved = true;
    }
    if (!this.collidesCircle(entity.x, nextY, entity.radius)) {
      entity.y = nextY;
      moved = true;
    }
    return moved;
  }

  randomSidewalkPoint() {
    return this.sidewalkPoints[Math.floor(Math.random() * this.sidewalkPoints.length)];
  }

  nearestIntersection(x, y) {
    let best = this.intersections[0];
    let bestDist = Infinity;
    for (const node of this.intersections) {
      const d = dist(x, y, node.x, node.y);
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  randomTrafficRoute(startX, startY) {
    const start = this.nearestIntersection(startX, startY);
    const nodes = [{ x: start.x, y: start.y }];
    const steps = 6 + Math.floor(Math.random() * 6);
    let current = start;
    let lastDir = "";

    for (let i = 0; i < steps; i++) {
      const neighbors = [];
      const xIndex = this.verticalRoads.indexOf(current.x);
      const yIndex = this.horizontalRoads.indexOf(current.y);

      if (xIndex > 0) neighbors.push({ x: this.verticalRoads[xIndex - 1], y: current.y, dir: "W" });
      if (xIndex < this.verticalRoads.length - 1) neighbors.push({ x: this.verticalRoads[xIndex + 1], y: current.y, dir: "E" });
      if (yIndex > 0) neighbors.push({ x: current.x, y: this.horizontalRoads[yIndex - 1], dir: "N" });
      if (yIndex < this.horizontalRoads.length - 1) neighbors.push({ x: current.x, y: this.horizontalRoads[yIndex + 1], dir: "S" });

      const filtered = neighbors.filter((n) => !(lastDir === "N" && n.dir === "S") &&
        !(lastDir === "S" && n.dir === "N") &&
        !(lastDir === "E" && n.dir === "W") &&
        !(lastDir === "W" && n.dir === "E"));

      const options = filtered.length ? filtered : neighbors;
      const choice = options[Math.floor(Math.random() * options.length)];
      current = { x: choice.x, y: choice.y };
      lastDir = choice.dir;
      nodes.push(current);
    }

    return this.nodesToLaneRoute(nodes);
  }

  nodesToLaneRoute(nodes) {
    const points = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const dx = Math.sign(b.x - a.x);
      const dy = Math.sign(b.y - a.y);

      let startPoint;
      let endPoint;

      if (dx !== 0) {
        const laneY = a.y + (dx > 0 ? -this.laneOffset : this.laneOffset);
        startPoint = { x: a.x, y: laneY };
        endPoint = { x: b.x, y: laneY };
      } else {
        const laneX = a.x + (dy > 0 ? this.laneOffset : -this.laneOffset);
        startPoint = { x: laneX, y: a.y };
        endPoint = { x: laneX, y: b.y };
      }

      if (points.length === 0) {
        points.push(startPoint);
      }
      points.push(endPoint);

      if (i < nodes.length - 2) {
        const c = nodes[i + 2];
        const ndx = Math.sign(c.x - b.x);
        const ndy = Math.sign(c.y - b.y);
        if (ndx !== 0) {
          points.push({ x: b.x, y: b.y + (ndx > 0 ? -this.laneOffset : this.laneOffset) });
        } else {
          points.push({ x: b.x + (ndy > 0 ? this.laneOffset : -this.laneOffset), y: b.y });
        }
      }
    }
    return points;
  }

  spawnRoadPointNear(x, y, minDistance = 420, maxDistance = 700) {
    for (let i = 0; i < 50; i++) {
      const useVertical = Math.random() > 0.5;
      if (useVertical) {
        const roadX = this.verticalRoads[Math.floor(Math.random() * this.verticalRoads.length)];
        const offset = (Math.random() * 2 - 1) * maxDistance;
        const py = clamp(y + offset, 100, this.size - 100);
        const lane = Math.random() > 0.5 ? this.laneOffset : -this.laneOffset;
        const point = { x: roadX + lane, y: py };
        const d = dist(x, y, point.x, point.y);
        if (d >= minDistance && d <= maxDistance) return point;
      } else {
        const roadY = this.horizontalRoads[Math.floor(Math.random() * this.horizontalRoads.length)];
        const offset = (Math.random() * 2 - 1) * maxDistance;
        const px = clamp(x + offset, 100, this.size - 100);
        const lane = Math.random() > 0.5 ? this.laneOffset : -this.laneOffset;
        const point = { x: px, y: roadY + lane };
        const d = dist(x, y, point.x, point.y);
        if (d >= minDistance && d <= maxDistance) return point;
      }
    }
    return { x: x + minDistance, y };
  }
}

class Player {
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.speed = 200;
    this.vehicle = null;
    this.facing = 0;
    this.health = 100;
    this.money = 0;
    this.packageCarried = false;
    this.damageFlash = 0;
    this.mesh = this.createMesh();
    this.game.scene.add(this.mesh);
  }

  createMesh() {
    const group = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(16, 1.2, 10, 32),
      createMaterial("#8ed8ff", { emissive: "#45c4ff", emissiveIntensity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.8;
    group.add(ring);
    group.userData.ring = ring;

    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.8, 14, 8),
      createMaterial("#17324a")
    );
    legs.position.y = 10;
    legs.castShadow = true;
    group.add(legs);

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(11, 11, 8),
      createMaterial("#ffb347")
    );
    torso.position.y = 18;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 14, 14),
      createMaterial("#f4c89a")
    );
    head.position.y = 28;
    head.castShadow = true;
    group.add(head);
    group.userData.head = head;

    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(4, 10, 6),
      createMaterial("#ffe082", { emissive: "#7f6318", emissiveIntensity: 0.4 })
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(14, 10, 0);
    arrow.castShadow = true;
    group.add(arrow);

    group.position.set(this.x, 0, this.y);
    setMeshShadows(group);
    return group;
  }

  get focusX() {
    return this.vehicle ? this.vehicle.x : this.x;
  }

  get focusY() {
    return this.vehicle ? this.vehicle.y : this.y;
  }

  get currentSpeed() {
    return this.vehicle ? this.vehicle.speed : 0;
  }

  update(dt) {
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.vehicle) {
      this.x = this.vehicle.x;
      this.y = this.vehicle.y;
      this.syncVisual();
      return;
    }

    let moveX = 0;
    let moveY = 0;
    if (this.game.keyDown("KeyW") || this.game.keyDown("ArrowUp")) moveY -= 1;
    if (this.game.keyDown("KeyS") || this.game.keyDown("ArrowDown")) moveY += 1;
    if (this.game.keyDown("KeyA") || this.game.keyDown("ArrowLeft")) moveX -= 1;
    if (this.game.keyDown("KeyD") || this.game.keyDown("ArrowRight")) moveX += 1;

    const length = Math.hypot(moveX, moveY) || 1;
    moveX /= length;
    moveY /= length;

    if (moveX !== 0 || moveY !== 0) {
      this.facing = Math.atan2(moveY, moveX);
    }

    const nextX = this.x + moveX * this.speed * dt;
    const nextY = this.y + moveY * this.speed * dt;
    this.game.map.tryMoveCircle(this, nextX, nextY);
    this.syncVisual();
  }

  enterOrExitVehicle() {
    if (this.vehicle) {
      const car = this.vehicle;
      const exitOffsets = [
        { x: Math.cos(car.angle + Math.PI / 2) * 28, y: Math.sin(car.angle + Math.PI / 2) * 28 },
        { x: Math.cos(car.angle - Math.PI / 2) * 28, y: Math.sin(car.angle - Math.PI / 2) * 28 },
        { x: Math.cos(car.angle + Math.PI) * 30, y: Math.sin(car.angle + Math.PI) * 30 }
      ];

      for (const offset of exitOffsets) {
        const px = car.x + offset.x;
        const py = car.y + offset.y;
        if (!this.game.map.collidesCircle(px, py, this.radius)) {
          this.x = px;
          this.y = py;
          car.driver = null;
          this.vehicle = null;
          this.mesh.visible = true;
          this.game.toast("Exited vehicle.");
          this.syncVisual();
          return;
        }
      }
      this.game.toast("No room to exit here.");
      return;
    }

    let nearest = null;
    let nearestDist = 48;
    for (const car of this.game.vehicles) {
      if (car.driver || car.kind === "police") continue;
      const d = dist(this.x, this.y, car.x, car.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = car;
      }
    }

    if (nearest) {
      this.vehicle = nearest;
      nearest.driver = this;
      this.mesh.visible = false;
      this.game.toast("Vehicle entered.");
    } else {
      this.game.toast("Move closer to a car.");
    }
  }

  takeDamage(amount) {
    this.health = clamp(this.health - amount, 0, 100);
    this.damageFlash = 0.18;
    if (this.health <= 0) {
      this.game.respawnPlayer();
      return;
    }
    this.syncVisual();
  }

  syncVisual() {
    if (this.vehicle) return;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.y);
    this.mesh.rotation.y = -this.facing;

    const ring = this.mesh.userData.ring;
    const head = this.mesh.userData.head;
    const pulse = 1 + Math.sin(this.game.time * 4.5) * 0.08;
    ring.scale.setScalar(pulse);

    if (this.damageFlash > 0) {
      ring.material.color.set("#ff8b8b");
      ring.material.emissive.set("#ff4d4d");
      head.material.color.set("#ffe0e0");
    } else {
      ring.material.color.set("#8ed8ff");
      ring.material.emissive.set("#45c4ff");
      head.material.color.set("#f4c89a");
    }
  }
}

let vehicleId = 1;

class Vehicle {
  constructor(game, x, y, options = {}) {
    this.game = game;
    this.id = vehicleId++;
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.w = options.w || 34;
    this.h = options.h || 18;
    this.angle = options.angle || 0;
    this.vx = 0;
    this.vy = 0;
    this.color = options.color || "#d95d5d";
    this.roofColor = options.roofColor || "#e9edf2";
    this.kind = options.kind || "civilian";
    this.ai = options.ai || "parked";
    this.driver = null;
    this.route = [];
    this.routeIndex = 0;
    this.maxSpeed = options.maxSpeed || 160;
    this.accel = options.accel || 220;
    this.turnRate = options.turnRate || 2.3;
    this.hitCooldown = 0;
    this.stuckTimer = 0;
    this.mesh = this.createMesh();
    this.game.scene.add(this.mesh);
  }

  createMesh() {
    const group = new THREE.Group();

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(this.w + 10, this.h + 10),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.18 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.4;
    group.add(shadow);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(this.w, 8, this.h),
      createMaterial(this.color)
    );
    body.position.y = 6;
    body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(this.w * 0.52, 6, this.h * 0.72),
      createMaterial(this.roofColor)
    );
    roof.position.y = 11;
    roof.castShadow = true;
    group.add(roof);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(this.w * 0.42, 3, this.h * 0.54),
      createMaterial("#10151a", { metalness: 0.2 })
    );
    windshield.position.y = 12;
    group.add(windshield);

    const wheelMaterial = createMaterial("#13171b");
    const wheelOffsets = [
      [-this.w * 0.28, 3, -this.h * 0.56],
      [-this.w * 0.28, 3, this.h * 0.56],
      [this.w * 0.28, 3, -this.h * 0.56],
      [this.w * 0.28, 3, this.h * 0.56]
    ];
    for (const [ox, oy, oz] of wheelOffsets) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, 2.5, 10),
        wheelMaterial
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(ox, oy, oz);
      wheel.castShadow = true;
      group.add(wheel);
    }

    const headlightMaterial = createMaterial("#f0f2f4", { emissive: "#f7f3d0", emissiveIntensity: 0.25 });
    const taillightMaterial = createMaterial("#ff7f6a", { emissive: "#661919", emissiveIntensity: 0.2 });
    const frontOffsets = [[-this.w * 0.43, 5.8, -this.h * 0.32], [-this.w * 0.43, 5.8, this.h * 0.32]];
    const rearOffsets = [[this.w * 0.43, 5.8, -this.h * 0.32], [this.w * 0.43, 5.8, this.h * 0.32]];

    for (const [ox, oy, oz] of frontOffsets) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 2.6), headlightMaterial);
      light.position.set(ox, oy, oz);
      group.add(light);
    }
    for (const [ox, oy, oz] of rearOffsets) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 2.6), taillightMaterial);
      light.position.set(ox, oy, oz);
      group.add(light);
    }

    if (this.kind === "police") {
      const left = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.2, 3),
        createMaterial("#4cb7ff", { emissive: "#103654", emissiveIntensity: 0.5 })
      );
      const right = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.2, 3),
        createMaterial("#ff5b5b", { emissive: "#541010", emissiveIntensity: 0.5 })
      );
      left.position.set(-2.4, 15.5, 0);
      right.position.set(2.4, 15.5, 0);
      group.add(left);
      group.add(right);
      group.userData.sirenLeft = left;
      group.userData.sirenRight = right;
    }

    setMeshShadows(group);
    return group;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get forwardSpeed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }

  update(dt) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    if (this.driver) {
      this.updatePlayerDrive(dt);
    } else if (this.ai === "traffic") {
      this.updateTrafficAI(dt);
    } else {
      this.vx *= Math.max(0, 1 - dt * 3.5);
      this.vy *= Math.max(0, 1 - dt * 3.5);
    }

    const oldX = this.x;
    const oldY = this.y;
    const moved = this.game.map.tryMoveCircle(this, this.x + this.vx * dt, this.y + this.vy * dt);

    if (!moved) {
      const impact = this.speed;
      this.x = oldX;
      this.y = oldY;
      this.vx *= -0.2;
      this.vy *= -0.2;
      if (this.driver && impact > 120) {
        this.game.player.takeDamage((impact - 120) * 0.04);
      }

      if (this.ai !== "parked") {
        this.route = [];
      }
    }

    if (!this.driver && this.ai === "traffic") {
      if (this.speed < 10) {
        this.stuckTimer += dt;
      } else {
        this.stuckTimer = 0;
      }
      if (this.stuckTimer > 2.5) {
        this.route = [];
        this.stuckTimer = 0;
      }
    }

    this.syncVisual();
  }

  updatePlayerDrive(dt) {
    const gas = (this.game.keyDown("KeyW") || this.game.keyDown("ArrowUp")) ? 1 : 0;
    const brake = (this.game.keyDown("KeyS") || this.game.keyDown("ArrowDown")) ? 1 : 0;
    const left = (this.game.keyDown("KeyA") || this.game.keyDown("ArrowLeft")) ? 1 : 0;
    const right = (this.game.keyDown("KeyD") || this.game.keyDown("ArrowRight")) ? 1 : 0;
    const steer = right - left;
    const forward = this.forwardSpeed;

    let thrust = 0;
    if (gas) {
      thrust = forward < this.maxSpeed ? this.accel : 0;
    }
    if (brake) {
      thrust = forward > 20 ? -this.accel * 1.9 : -this.accel * 0.75;
    }

    this.vx += Math.cos(this.angle) * thrust * dt;
    this.vy += Math.sin(this.angle) * thrust * dt;

    if (Math.abs(forward) > 4) {
      this.angle += steer * this.turnRate * dt * clamp(Math.abs(forward) / 90, 0.45, 1.6) * Math.sign(forward);
    }

    const speed = this.speed;
    const desiredVx = Math.cos(this.angle) * speed;
    const desiredVy = Math.sin(this.angle) * speed;
    const traction = steer !== 0 ? 0.055 : 0.085;
    this.vx = lerp(this.vx, desiredVx, traction);
    this.vy = lerp(this.vy, desiredVy, traction);

    const drag = gas ? 0.5 : 1.6;
    this.vx *= Math.max(0, 1 - drag * dt);
    this.vy *= Math.max(0, 1 - drag * dt);

    const capped = clamp(this.speed, 0, this.maxSpeed * 1.08);
    if (this.speed > 0.01) {
      const scale = capped / this.speed;
      this.vx *= scale;
      this.vy *= scale;
    }
  }

  updateTrafficAI(dt) {
    if (!this.route.length || this.routeIndex >= this.route.length) {
      this.route = this.game.map.randomTrafficRoute(this.x, this.y);
      this.routeIndex = 0;
    }

    const target = this.route[this.routeIndex];
    const d = dist(this.x, this.y, target.x, target.y);
    if (d < 22) {
      this.routeIndex++;
      return;
    }

    const desiredAngle = Math.atan2(target.y - this.y, target.x - this.x);
    const turn = clamp(angleDiff(desiredAngle, this.angle), -1, 1);
    this.angle += turn * this.turnRate * 0.65 * dt * clamp(this.speed / 70, 0.45, 1.1);

    const desiredSpeed = 82;
    const accel = this.forwardSpeed < desiredSpeed ? this.accel * 0.65 : -this.accel * 0.7;
    this.vx += Math.cos(this.angle) * accel * dt;
    this.vy += Math.sin(this.angle) * accel * dt;

    const desiredVx = Math.cos(this.angle) * this.speed;
    const desiredVy = Math.sin(this.angle) * this.speed;
    this.vx = lerp(this.vx, desiredVx, 0.12);
    this.vy = lerp(this.vy, desiredVy, 0.12);
    this.vx *= Math.max(0, 1 - dt * 0.75);
    this.vy *= Math.max(0, 1 - dt * 0.75);
  }

  syncVisual() {
    this.mesh.position.set(this.x, 0, this.y);
    this.mesh.rotation.y = -this.angle;

    const bodyLift = 4.5 + clamp(this.speed / 90, 0, 1) * 0.6;
    this.mesh.children[1].position.y = 6 + Math.sin(this.game.time * 10 + this.id) * 0.08 + bodyLift * 0.02;

    if (this.kind === "police") {
      const flash = Math.floor(this.game.time * 8) % 2;
      const left = this.mesh.userData.sirenLeft;
      const right = this.mesh.userData.sirenRight;
      if (left && right) {
        left.material.emissiveIntensity = flash ? 1.8 : 0.35;
        right.material.emissiveIntensity = flash ? 0.35 : 1.8;
      }
    }
  }

  destroy() {
    this.game.scene.remove(this.mesh);
  }
}

class Police extends Vehicle {
  constructor(game, x, y) {
    super(game, x, y, {
      kind: "police",
      ai: "police",
      color: "#10151d",
      roofColor: "#d7dee6",
      maxSpeed: 185,
      accel: 260,
      turnRate: 2.5
    });
    this.sirenTime = Math.random() * 10;
  }

  update(dt) {
    this.sirenTime += dt * 9;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    const targetX = this.game.player.vehicle ? this.game.player.vehicle.x + this.game.player.vehicle.vx * 0.35 : this.game.player.x;
    const targetY = this.game.player.vehicle ? this.game.player.vehicle.y + this.game.player.vehicle.vy * 0.35 : this.game.player.y;

    const roadTarget = this.game.map.isOnRoad(targetX, targetY)
      ? { x: targetX, y: targetY }
      : this.game.map.nearestIntersection(targetX, targetY);

    const desiredAngle = Math.atan2(roadTarget.y - this.y, roadTarget.x - this.x);
    const turn = clamp(angleDiff(desiredAngle, this.angle), -1.1, 1.1);
    this.angle += turn * this.turnRate * dt * clamp(this.speed / 80, 0.45, 1.35);

    const desiredSpeed = this.game.wanted > 2 ? 145 : 128;
    const accel = this.forwardSpeed < desiredSpeed ? this.accel : -this.accel * 0.65;
    this.vx += Math.cos(this.angle) * accel * dt;
    this.vy += Math.sin(this.angle) * accel * dt;

    const desiredVx = Math.cos(this.angle) * this.speed;
    const desiredVy = Math.sin(this.angle) * this.speed;
    this.vx = lerp(this.vx, desiredVx, 0.1);
    this.vy = lerp(this.vy, desiredVy, 0.1);
    this.vx *= Math.max(0, 1 - dt * 0.6);
    this.vy *= Math.max(0, 1 - dt * 0.6);

    const oldX = this.x;
    const oldY = this.y;
    const moved = this.game.map.tryMoveCircle(this, this.x + this.vx * dt, this.y + this.vy * dt);
    if (!moved) {
      this.x = oldX;
      this.y = oldY;
      this.vx *= -0.15;
      this.vy *= -0.15;
      if (dist(this.x, this.y, targetX, targetY) > 500) {
        const respawn = this.game.map.spawnRoadPointNear(targetX, targetY, 320, 520);
        this.x = respawn.x;
        this.y = respawn.y;
      }
    }

    this.syncVisual();
  }
}

class NPC {
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.speed = 38 + Math.random() * 18;
    this.target = this.game.map.randomSidewalkPoint();
    this.waitTimer = Math.random() * 2;
    this.facing = 0;
    this.knockedTimer = 0;
    this.hitCooldown = 0;
    this.mesh = this.createMesh();
    this.game.scene.add(this.mesh);
  }

  createMesh() {
    const group = new THREE.Group();

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10),
      new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.14 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.4;
    group.add(shadow);

    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.2, 12, 8),
      createMaterial("#26303a")
    );
    legs.position.y = 8;
    group.add(legs);

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(9, 12, 7),
      createMaterial("#5a87c5")
    );
    torso.position.y = 16;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(5, 12, 12),
      createMaterial("#e6b88c")
    );
    head.position.y = 25;
    group.add(head);

    setMeshShadows(group);
    return group;
  }

  update(dt) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (this.knockedTimer > 0) {
      this.knockedTimer -= dt;
      this.syncVisual();
      return;
    }

    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      this.syncVisual();
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distanceLeft = Math.hypot(dx, dy);

    if (distanceLeft < 8) {
      this.target = this.game.map.randomSidewalkPoint();
      this.waitTimer = 0.5 + Math.random() * 2.2;
      this.syncVisual();
      return;
    }

    this.facing = Math.atan2(dy, dx);
    const vx = (dx / distanceLeft) * this.speed * dt;
    const vy = (dy / distanceLeft) * this.speed * dt;
    this.game.map.tryMoveCircle(this, this.x + vx, this.y + vy);
    this.syncVisual();
  }

  knockDown() {
    this.knockedTimer = 3.2;
    this.hitCooldown = 1.2;
    this.syncVisual();
  }

  syncVisual() {
    this.mesh.position.set(this.x, 0, this.y);
    if (this.knockedTimer > 0) {
      this.mesh.rotation.y = -this.facing;
      this.mesh.rotation.z = Math.PI / 2;
      this.mesh.position.y = 1.2;
    } else {
      this.mesh.rotation.y = -this.facing;
      this.mesh.rotation.z = 0;
      this.mesh.position.y = 0;
    }
  }

  destroy() {
    this.game.scene.remove(this.mesh);
  }
}

class Mission {
  constructor(game) {
    this.game = game;
    this.packagePos = null;
    this.destinationPos = null;
    this.reward = 150;
    this.state = "pickup";
    this.cooldown = 0;
    this.packageMesh = this.createPackageMesh();
    this.destinationMesh = this.createDestinationMesh();
    this.game.scene.add(this.packageMesh);
    this.game.scene.add(this.destinationMesh);
    this.newMission();
  }

  createPackageMesh() {
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(16, 16, 16),
      createMaterial("#c68548", { emissive: "#6d3e10", emissiveIntensity: 0.4 })
    );
    box.position.y = 10;
    group.add(box);
    setMeshShadows(group);
    return group;
  }

  createDestinationMesh() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(22, 2.4, 10, 40),
      createMaterial("#69d2a2", { emissive: "#236848", emissiveIntensity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 3;
    group.add(ring);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 10, 10, 12),
      createMaterial("#69d2a2", { emissive: "#184d36", emissiveIntensity: 0.25 })
    );
    pillar.position.y = 5;
    group.add(pillar);
    setMeshShadows(group);
    return group;
  }

  newMission() {
    this.packagePos = this.game.map.randomSidewalkPoint();
    do {
      this.destinationPos = this.game.map.randomSidewalkPoint();
    } while (dist(this.packagePos.x, this.packagePos.y, this.destinationPos.x, this.destinationPos.y) < 850);
    this.reward = 120 + Math.floor(Math.random() * 130);
    this.state = "pickup";
    this.cooldown = 0;
    this.game.player.packageCarried = false;
    this.syncVisual();
  }

  update(dt) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.newMission();
      this.syncVisual();
      return;
    }

    const targetX = this.game.player.focusX;
    const targetY = this.game.player.focusY;

    if (this.state === "pickup" && dist(targetX, targetY, this.packagePos.x, this.packagePos.y) < 34) {
      this.state = "deliver";
      this.game.player.packageCarried = true;
      this.game.toast("Package secured. Deliver it to the green marker.");
    }

    if (this.state === "deliver" && dist(targetX, targetY, this.destinationPos.x, this.destinationPos.y) < 42) {
      this.game.player.money += this.reward;
      this.game.player.packageCarried = false;
      this.state = "complete";
      this.cooldown = 3;
      this.game.toast("Delivery complete. +" + this.reward + " cash.");
    }

    this.syncVisual();
  }

  syncVisual() {
    const pulse = 1 + Math.sin(this.game.time * 4) * 0.12;

    this.packageMesh.visible = this.cooldown <= 0 && this.state === "pickup";
    this.packageMesh.position.set(this.packagePos.x, 0, this.packagePos.y);
    this.packageMesh.rotation.y = this.game.time * 1.2;
    this.packageMesh.children[0].scale.setScalar(pulse);

    this.destinationMesh.visible = this.cooldown <= 0 && this.state === "deliver";
    this.destinationMesh.position.set(this.destinationPos.x, 0, this.destinationPos.y);
    this.destinationMesh.children[0].scale.setScalar(1 + Math.sin(this.game.time * 5) * 0.08);
  }

  getHudText() {
    if (this.cooldown > 0) {
      return "Job finished. A new package is lining up.";
    }
    if (this.state === "pickup") {
      return "Pick up the package marked in orange.";
    }
    if (this.state === "deliver") {
      return "Deliver the package to the green drop point.";
    }
    return "Cruise the city and wait for the next pickup.";
  }

  getHudSub() {
    if (this.state === "deliver") {
      return "Reward: $" + this.reward;
    }
    if (this.state === "pickup") {
      return "Get close to collect it automatically.";
    }
    return "Police pressure drops if they lose sight of you.";
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.minimap = document.getElementById("minimap");
    this.minimapCtx = this.minimap.getContext("2d");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#8bb7d8");
    this.scene.fog = new THREE.Fog("#8bb7d8", 900, 4300);

    this.camera = new THREE.PerspectiveCamera(58, 1, 1, 7000);
    this.lookTarget = new THREE.Vector3(600, 0, 600);
    this.projectVector = new THREE.Vector3();
    this.keys = new Set();
    this.time = 0;
    this.cameraFocus = { x: 600, y: 600 };
    this.wanted = 0;
    this.evadeTimer = 0;
    this.toastTimer = 0;

    this.moneyEl = document.getElementById("money");
    this.wantedEl = document.getElementById("wanted");
    this.speedEl = document.getElementById("speed");
    this.healthEl = document.getElementById("healthValue");
    this.healthFillEl = document.getElementById("healthFill");
    this.missionTextEl = document.getElementById("missionText");
    this.missionSubEl = document.getElementById("missionSub");
    this.toastEl = document.getElementById("toast");

    this.map = new Map(this);
    this.player = new Player(this, 300, 280);
    this.vehicles = [];
    this.npcs = [];
    this.police = [];

    this.addLights();
    this.spawnWorld();
    this.mission = new Mission(this);

    this.lastTime = performance.now();
    this.bindEvents();
    this.resize();
    this.loop(this.lastTime);
  }

  addLights() {
    const hemi = new THREE.HemisphereLight("#d9f4ff", "#3b664f", 1.4);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#fff5d6", 1.45);
    sun.position.set(420, 520, 280);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 1800;
    this.scene.add(sun);

    const fill = new THREE.PointLight("#ffd6a5", 0.35, 1600);
    fill.position.set(900, 180, 900);
    this.scene.add(fill);
  }

  bindEvents() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "KeyE" && !event.repeat) {
        this.player.enterOrExitVehicle();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });
  }

  keyDown(code) {
    return this.keys.has(code);
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  spawnWorld() {
    this.vehicles.push(new Vehicle(this, 348, 392, {
      color: "#f08a4b",
      roofColor: "#f6f0e1",
      angle: 0,
      ai: "parked",
      maxSpeed: 175,
      accel: 240,
      turnRate: 2.7
    }));

    const carColors = [
      ["#c85c5c", "#f2efe6"],
      ["#5f9ea0", "#dce9ec"],
      ["#d9a441", "#f7e6be"],
      ["#7d76d1", "#ebe8ff"],
      ["#6fba6d", "#edf8ec"]
    ];

    for (let i = 0; i < 20; i++) {
      const point = this.map.spawnRoadPointNear(
        1200 + Math.cos(i) * 300,
        1200 + Math.sin(i * 2) * 300,
        0,
        1400
      );
      const colors = carColors[i % carColors.length];
      const roadAligned = this.map.verticalRoads.some((x) => Math.abs(point.x - x) < 40);
      const car = new Vehicle(this, point.x, point.y, {
        color: colors[0],
        roofColor: colors[1],
        angle: roadAligned ? (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() > 0.5 ? 0 : Math.PI),
        ai: "traffic",
        maxSpeed: 130 + Math.random() * 22,
        accel: 180 + Math.random() * 40,
        turnRate: 2 + Math.random() * 0.4
      });
      car.route = this.map.randomTrafficRoute(car.x, car.y);
      car.syncVisual();
      this.vehicles.push(car);
    }

    for (let i = 0; i < 28; i++) {
      const point = this.map.randomSidewalkPoint();
      const npc = new NPC(this, point.x, point.y);
      npc.syncVisual();
      this.npcs.push(npc);
    }
  }

  loop(now) {
    const dt = Math.min(0.033, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += dt;
    this.update(dt);
    this.render();
    requestAnimationFrame((nextNow) => this.loop(nextNow));
  }

  update(dt) {
    this.map.updateEnvironment(this.time);
    this.player.update(dt);

    for (const vehicle of this.vehicles) {
      vehicle.update(dt);
    }
    for (const officer of this.police) {
      officer.update(dt);
    }
    for (const npc of this.npcs) {
      npc.update(dt);
    }

    this.handleCollisions(dt);
    this.updateWanted(dt);
    this.mission.update(dt);
    this.updateCamera(dt);
    this.updateHud();
    this.updateToast(dt);
  }

  updateToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastEl.classList.remove("show");
      }
    }
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    this.toastTimer = 2.6;
  }

  updateCamera(dt) {
    this.cameraFocus.x = lerp(this.cameraFocus.x, this.player.focusX, 4.5 * dt);
    this.cameraFocus.y = lerp(this.cameraFocus.y, this.player.focusY, 4.5 * dt);

    let desiredX;
    let desiredY;
    let desiredZ;
    let lookX;
    let lookY;
    let lookZ;

    if (this.player.vehicle) {
      const forwardX = Math.cos(this.player.vehicle.angle);
      const forwardY = Math.sin(this.player.vehicle.angle);
      const speedLift = clamp(this.player.vehicle.speed / 2.4, 0, 70);
      desiredX = this.cameraFocus.x - forwardX * 180;
      desiredY = 150 + speedLift;
      desiredZ = this.cameraFocus.y - forwardY * 180;
      lookX = this.cameraFocus.x + forwardX * 58;
      lookY = 18;
      lookZ = this.cameraFocus.y + forwardY * 58;
    } else {
      desiredX = this.cameraFocus.x - 190;
      desiredY = 245;
      desiredZ = this.cameraFocus.y + 210;
      lookX = this.cameraFocus.x;
      lookY = 10;
      lookZ = this.cameraFocus.y;
    }

    this.camera.position.x = lerp(this.camera.position.x, desiredX, 3.2 * dt);
    this.camera.position.y = lerp(this.camera.position.y, desiredY, 3.2 * dt);
    this.camera.position.z = lerp(this.camera.position.z, desiredZ, 3.2 * dt);

    this.lookTarget.x = lerp(this.lookTarget.x, lookX, 4.5 * dt);
    this.lookTarget.y = lerp(this.lookTarget.y, lookY, 4.5 * dt);
    this.lookTarget.z = lerp(this.lookTarget.z, lookZ, 4.5 * dt);
    this.camera.lookAt(this.lookTarget);
  }

  addWanted(amount) {
    const previous = this.wanted;
    this.wanted = normalizeWantedLevel(this.wanted, amount);
    this.evadeTimer = 0;
    if (this.wanted > previous) {
      this.toast("Wanted level increased.");
    }
  }

  updateWanted(dt) {
    const activeX = this.player.focusX;
    const activeY = this.player.focusY;
    const requiredPolice = this.wanted;

    while (this.police.length < requiredPolice) {
      const point = this.map.spawnRoadPointNear(activeX, activeY);
      const officer = new Police(this, point.x, point.y);
      officer.angle = Math.atan2(activeY - point.y, activeX - point.x);
      officer.syncVisual();
      this.police.push(officer);
    }

    while (this.police.length > requiredPolice) {
      const removed = this.police.pop();
      removed.destroy();
    }

    if (this.wanted <= 0) {
      this.evadeTimer = 0;
      return;
    }

    let nearest = Infinity;
    for (const officer of this.police) {
      nearest = Math.min(nearest, dist(activeX, activeY, officer.x, officer.y));
    }

    const wantedState = updateWantedState(this.wanted, this.evadeTimer, nearest, dt);
    this.wanted = wantedState.wanted;
    this.evadeTimer = wantedState.evadeTimer;

    if (wantedState.cooledDown) {
      this.toast(this.wanted > 0 ? "Police pressure is dropping." : "You lost the heat.");
    }
  }

  handleCollisions(dt) {
    const playerVehicle = this.player.vehicle;

    if (!playerVehicle) {
      for (const car of [...this.vehicles, ...this.police]) {
        const d = dist(this.player.x, this.player.y, car.x, car.y);
        if (d < this.player.radius + car.radius - 2 && car.speed > 40) {
          this.player.takeDamage(22 * dt * clamp(car.speed / 70, 0.8, 2));
        }
      }
    }

    for (const npc of this.npcs) {
      if (npc.knockedTimer > 0) continue;

      if (playerVehicle) {
        const d = dist(playerVehicle.x, playerVehicle.y, npc.x, npc.y);
        if (d < playerVehicle.radius + npc.radius + 2 && playerVehicle.speed > 35 && npc.hitCooldown <= 0) {
          npc.knockDown();
          playerVehicle.hitCooldown = 0.5;
          this.player.takeDamage(1.5);
          this.addWanted(1);
        }
      } else {
        const d = dist(this.player.x, this.player.y, npc.x, npc.y);
        if (d < this.player.radius + npc.radius) {
          const push = 20 * dt;
          npc.x += Math.cos(this.player.facing) * push;
          npc.y += Math.sin(this.player.facing) * push;
          npc.syncVisual();
        }
      }
    }

    if (playerVehicle) {
      for (const car of this.vehicles) {
        if (car === playerVehicle) continue;
        const d = dist(playerVehicle.x, playerVehicle.y, car.x, car.y);
        if (d < playerVehicle.radius + car.radius + 2 && playerVehicle.speed > 40 &&
          playerVehicle.hitCooldown <= 0 && car.hitCooldown <= 0) {
          playerVehicle.hitCooldown = 0.9;
          car.hitCooldown = 1.1;
          this.addWanted(1);
          this.player.takeDamage(5);

          const dx = car.x - playerVehicle.x;
          const dy = car.y - playerVehicle.y;
          const pushAngle = Math.atan2(dy, dx);
          car.vx += Math.cos(pushAngle) * 90;
          car.vy += Math.sin(pushAngle) * 90;
          playerVehicle.vx -= Math.cos(pushAngle) * 45;
          playerVehicle.vy -= Math.sin(pushAngle) * 45;
        }
      }
    }

    for (const officer of this.police) {
      const targetX = playerVehicle ? playerVehicle.x : this.player.x;
      const targetY = playerVehicle ? playerVehicle.y : this.player.y;
      const targetRadius = playerVehicle ? playerVehicle.radius : this.player.radius;
      const d = dist(targetX, targetY, officer.x, officer.y);
      if (d < targetRadius + officer.radius + 4) {
        this.player.takeDamage((playerVehicle ? 10 : 18) * dt * 4.5);
        this.evadeTimer = 0;
      }
    }
  }

  respawnPlayer() {
    if (this.player.vehicle) {
      this.player.vehicle.driver = null;
      this.player.vehicle.vx *= 0.25;
      this.player.vehicle.vy *= 0.25;
    }
    this.player.health = 100;
    this.player.vehicle = null;
    this.player.x = 300;
    this.player.y = 280;
    this.player.packageCarried = false;
    this.player.mesh.visible = true;
    this.player.syncVisual();
    this.wanted = 0;
    this.clearPolice();
    this.toast("You woke up at a safe corner of the city.");
    this.mission.newMission();
  }

  clearPolice() {
    for (const officer of this.police) {
      officer.destroy();
    }
    this.police = [];
  }

  updateHud() {
    this.moneyEl.textContent = "$" + this.player.money;
    this.wantedEl.textContent = formatWantedStars(this.wanted);
    this.speedEl.textContent = Math.round(this.player.currentSpeed * 0.95) + " km/h";
    this.healthEl.textContent = Math.round(this.player.health) + " / 100";
    this.healthFillEl.style.width = this.player.health + "%";
    this.missionTextEl.textContent = this.mission.getHudText();
    this.missionSubEl.textContent = this.mission.getHudSub();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.minimapCtx;
    const s = this.minimap.width;
    ctx.clearRect(0, 0, s, s);
    ctx.drawImage(this.map.minimapCanvas, 0, 0, s, s);
    const scale = s / this.map.size;

    if (this.mission.cooldown <= 0) {
      const missionPoint = this.mission.state === "pickup" ? this.mission.packagePos : this.mission.destinationPos;
      ctx.fillStyle = this.mission.state === "pickup" ? "#ffb347" : "#69d2a2";
      ctx.beginPath();
      ctx.arc(missionPoint.x * scale, missionPoint.y * scale, 4, 0, TAU);
      ctx.fill();
    }

    for (const officer of this.police) {
      ctx.fillStyle = "#ff5b5b";
      ctx.beginPath();
      ctx.arc(officer.x * scale, officer.y * scale, 3, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = "#8ed8ff";
    ctx.beginPath();
    ctx.arc(this.player.focusX * scale, this.player.focusY * scale, 4.5, 0, TAU);
    ctx.fill();
  }
}

new Game();
