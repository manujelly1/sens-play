    const TAU = Math.PI * 2;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function dist(ax, ay, bx, by) {
      return Math.hypot(ax - bx, ay - by);
    }

    function angleDiff(a, b) {
      let diff = (a - b + Math.PI) % TAU - Math.PI;
      if (diff < -Math.PI) diff += TAU;
      return diff;
    }

    function expandRect(rect, amount) {
      return {
        x: rect.x - amount,
        y: rect.y - amount,
        w: rect.w + amount * 2,
        h: rect.h + amount * 2
      };
    }

    function circleIntersectsRect(x, y, r, rect) {
      const cx = clamp(x, rect.x, rect.x + rect.w);
      const cy = clamp(y, rect.y, rect.y + rect.h);
      return dist(x, y, cx, cy) < r;
    }

    function normalizeWantedLevel(current, delta, maxWanted = 5) {
      return clamp(current + delta, 0, maxWanted - 1);
    }

    function formatWantedStars(wanted, maxWanted = 5) {
      const safeWanted = clamp(Math.round(wanted), 0, maxWanted);
      return "★".repeat(safeWanted) + "☆".repeat(maxWanted - safeWanted);
    }

    function updateWantedState(wanted, evadeTimer, nearestPoliceDistance, dt, decayDistance = 380, decaySeconds = 10) {
      if (wanted <= 0) {
        return {
          wanted: 0,
          evadeTimer: 0,
          cooledDown: false
        };
      }

      if (nearestPoliceDistance > decayDistance) {
        const nextTimer = evadeTimer + dt;
        if (nextTimer > decaySeconds) {
          return {
            wanted: Math.max(0, wanted - 1),
            evadeTimer: 0,
            cooledDown: true
          };
        }

        return {
          wanted,
          evadeTimer: nextTimer,
          cooledDown: false
        };
      }

      return {
        wanted,
        evadeTimer: 0,
        cooledDown: false
      };
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
        this.minimapCanvas.width = 180;
        this.minimapCanvas.height = 180;
        this.generate();
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
                  tone: Math.floor(this.rand(xi + cx, yi + cy, 4) * 4)
                });
              }
            }
          }
        }

        for (const x of this.verticalRoads) {
          for (let y = 120; y <= this.size - 120; y += 160) {
            this.trees.push({ x: x - this.roadWidth / 2 - 18, y: y + 14 });
            this.trees.push({ x: x + this.roadWidth / 2 + 18, y: y - 12 });
            this.sidewalkPoints.push({ x: x - this.roadWidth / 2 - 12, y });
            this.sidewalkPoints.push({ x: x + this.roadWidth / 2 + 12, y: y + 28 });
          }
        }

        for (const y of this.horizontalRoads) {
          for (let x = 120; x <= this.size - 120; x += 160) {
            this.trees.push({ x: x + 22, y: y - this.roadWidth / 2 - 18 });
            this.trees.push({ x: x - 22, y: y + this.roadWidth / 2 + 18 });
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

      buildMinimap() {
        const ctx = this.minimapCanvas.getContext("2d");
        const s = this.minimapCanvas.width;
        ctx.fillStyle = "#224235";
        ctx.fillRect(0, 0, s, s);

        const scale = s / this.size;
        ctx.strokeStyle = "#e0d6c2";
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

      draw(ctx, camera) {
        ctx.fillStyle = "#3f6c4e";
        ctx.fillRect(0, 0, this.size, this.size);

        ctx.fillStyle = "#d7cfbf";
        for (const x of this.verticalRoads) {
          ctx.fillRect(x - this.roadWidth / 2 - this.sidewalkWidth, 0, this.roadWidth + this.sidewalkWidth * 2, this.size);
        }
        for (const y of this.horizontalRoads) {
          ctx.fillRect(0, y - this.roadWidth / 2 - this.sidewalkWidth, this.size, this.roadWidth + this.sidewalkWidth * 2);
        }

        ctx.fillStyle = "#4e535b";
        for (const x of this.verticalRoads) {
          ctx.fillRect(x - this.roadWidth / 2, 0, this.roadWidth, this.size);
        }
        for (const y of this.horizontalRoads) {
          ctx.fillRect(0, y - this.roadWidth / 2, this.size, this.roadWidth);
        }

        ctx.strokeStyle = "#f4e39c";
        ctx.lineWidth = 4;
        ctx.setLineDash([18, 14]);
        for (const x of this.verticalRoads) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.size);
          ctx.stroke();
        }
        for (const y of this.horizontalRoads) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.size, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        for (const building of this.buildings) {
          if (!this.game.rectInView(building.x, building.y, building.w, building.h, 80)) continue;
          const palettes = [
            ["#717989", "#8f97a4"],
            ["#7a6e65", "#96887d"],
            ["#697d8a", "#84a0b3"],
            ["#73605c", "#9b8278"]
          ];
          const [dark, light] = palettes[building.tone];
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(building.x + 9, building.y + 11, building.w, building.h);
          ctx.fillStyle = dark;
          ctx.fillRect(building.x, building.y, building.w, building.h);
          ctx.fillStyle = light;
          ctx.fillRect(building.x + 8, building.y + 8, building.w - 16, building.h - 16);

          ctx.fillStyle = "rgba(255, 243, 190, 0.22)";
          const cols = Math.max(2, Math.floor(building.w / 28));
          const rows = Math.max(2, Math.floor(building.h / 28));
          for (let ix = 0; ix < cols; ix++) {
            for (let iy = 0; iy < rows; iy++) {
              const wx = building.x + 14 + ix * ((building.w - 28) / cols);
              const wy = building.y + 14 + iy * ((building.h - 28) / rows);
              ctx.fillRect(wx, wy, 8, 10);
            }
          }
        }

        for (const tree of this.trees) {
          if (!this.game.rectInView(tree.x - 18, tree.y - 18, 36, 36, 50)) continue;
          ctx.fillStyle = "#7f5937";
          ctx.fillRect(tree.x - 3, tree.y + 4, 6, 16);
          ctx.fillStyle = "#2b7a4f";
          for (let i = 0; i < 6; i++) {
            const angle = i * (TAU / 6);
            ctx.beginPath();
            ctx.arc(tree.x + Math.cos(angle) * 7, tree.y + Math.sin(angle) * 7, 8, 0, TAU);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(tree.x, tree.y, 8, 0, TAU);
          ctx.fill();
        }

        const lightPhase = Math.floor(this.game.time * 0.7) % 2;
        for (const light of this.trafficLights) {
          if (!this.game.rectInView(light.x - 6, light.y - 6, 12, 24, 30)) continue;
          ctx.fillStyle = "#2d2f36";
          ctx.fillRect(light.x - 2, light.y - 2, 4, 18);
          ctx.fillStyle = lightPhase === 0 ? "#ff595e" : "#46e07d";
          ctx.beginPath();
          ctx.arc(light.x, light.y, 3.2, 0, TAU);
          ctx.fill();
          ctx.fillStyle = lightPhase === 0 ? "#e8b949" : "#ff595e";
          ctx.beginPath();
          ctx.arc(light.x, light.y + 8, 3.2, 0, TAU);
          ctx.fill();
        }
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
              this.game.toast("Exited vehicle.");
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
        }
      }

      draw(ctx) {
        if (this.vehicle) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.facing);

        ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
        ctx.beginPath();
        ctx.ellipse(0, 11, 11, 7, 0, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = this.damageFlash > 0 ? "rgba(255, 107, 107, 0.95)" : "rgba(142, 216, 255, 0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 2, 15, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = this.damageFlash > 0 ? "rgba(255, 107, 107, 0.16)" : "rgba(142, 216, 255, 0.12)";
        ctx.beginPath();
        ctx.arc(0, 2, 18, 0, TAU);
        ctx.fill();

        ctx.fillStyle = this.damageFlash > 0 ? "#ffe0e0" : "#f4c89a";
        ctx.beginPath();
        ctx.arc(0, -8, 6.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#172028";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = this.damageFlash > 0 ? "#ff6b6b" : "#17324a";
        ctx.fillRect(-8, -2, 16, 19);
        ctx.strokeStyle = "#dff6ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(-8, -2, 16, 19);

        ctx.fillStyle = "#ffb347";
        ctx.fillRect(-5.5, 1.5, 11, 10);

        ctx.fillStyle = "#ffe082";
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(21, -4);
        ctx.lineTo(21, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#172028";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
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
        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;
        const moved = this.game.map.tryMoveCircle(this, nextX, nextY);

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

      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(-this.w / 2 + 2, -this.h / 2 + 8, this.w, this.h);

        ctx.fillStyle = this.color;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);

        ctx.fillStyle = this.roofColor;
        ctx.fillRect(-this.w * 0.18, -this.h * 0.36, this.w * 0.36, this.h * 0.72);

        ctx.fillStyle = "#10151a";
        ctx.fillRect(-this.w * 0.16, -this.h * 0.24, this.w * 0.32, this.h * 0.48);

        ctx.fillStyle = "#eff3f6";
        ctx.fillRect(-this.w / 2 + 2, -this.h / 2 + 2, 6, 3);
        ctx.fillRect(-this.w / 2 + 2, this.h / 2 - 5, 6, 3);

        ctx.fillStyle = "#ff8e72";
        ctx.fillRect(this.w / 2 - 8, -this.h / 2 + 2, 6, 3);
        ctx.fillRect(this.w / 2 - 8, this.h / 2 - 5, 6, 3);

        ctx.restore();
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

        const directRoadTarget = this.game.map.isOnRoad(targetX, targetY)
          ? { x: targetX, y: targetY }
          : this.game.map.nearestIntersection(targetX, targetY);

        const desiredAngle = Math.atan2(directRoadTarget.y - this.y, directRoadTarget.x - this.x);
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
      }

      draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        const flash = Math.floor(this.sirenTime) % 2;
        ctx.fillStyle = flash ? "#4cb7ff" : "#ff5b5b";
        ctx.fillRect(-6, -3, 6, 4);
        ctx.fillStyle = flash ? "#ff5b5b" : "#4cb7ff";
        ctx.fillRect(0, -3, 6, 4);
        ctx.restore();
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
      }

      update(dt) {
        this.hitCooldown = Math.max(0, this.hitCooldown - dt);
        if (this.knockedTimer > 0) {
          this.knockedTimer -= dt;
          return;
        }

        if (this.waitTimer > 0) {
          this.waitTimer -= dt;
          return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distanceLeft = Math.hypot(dx, dy);

        if (distanceLeft < 8) {
          this.target = this.game.map.randomSidewalkPoint();
          this.waitTimer = 0.5 + Math.random() * 2.2;
          return;
        }

        this.facing = Math.atan2(dy, dx);
        const vx = (dx / distanceLeft) * this.speed * dt;
        const vy = (dy / distanceLeft) * this.speed * dt;
        this.game.map.tryMoveCircle(this, this.x + vx, this.y + vy);
      }

      knockDown() {
        this.knockedTimer = 3.2;
        this.hitCooldown = 1.2;
      }

      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.facing);

        if (this.knockedTimer > 0) {
          ctx.fillStyle = "#7a4f43";
          ctx.fillRect(-11, -5, 22, 10);
          ctx.fillStyle = "#e9bd92";
          ctx.beginPath();
          ctx.arc(11, 0, 5, 0, TAU);
          ctx.fill();
          ctx.restore();
          return;
        }

        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(0, 9, 9, 5, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = "#e6b88c";
        ctx.beginPath();
        ctx.arc(0, -7, 5.5, 0, TAU);
        ctx.fill();

        ctx.fillStyle = "#5a87c5";
        ctx.fillRect(-5, -2, 10, 16);
        ctx.fillStyle = "#26303a";
        ctx.fillRect(-6, 10, 4, 10);
        ctx.fillRect(2, 10, 4, 10);
        ctx.restore();
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
        this.newMission();
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
      }

      update(dt) {
        if (this.cooldown > 0) {
          this.cooldown -= dt;
          if (this.cooldown <= 0) this.newMission();
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

      draw(ctx, time) {
        if (this.cooldown > 0) return;

        if (this.state === "pickup") {
          const pulse = 1 + Math.sin(time * 4) * 0.12;
          ctx.save();
          ctx.translate(this.packagePos.x, this.packagePos.y);
          ctx.strokeStyle = "#ffb347";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, 18 * pulse, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = "#9b6530";
          ctx.fillRect(-10, -10, 20, 20);
          ctx.fillStyle = "#dca66e";
          ctx.fillRect(-8, -8, 16, 16);
          ctx.restore();
        }

        if (this.state === "deliver") {
          const pulse = 1 + Math.sin(time * 4) * 0.15;
          ctx.save();
          ctx.translate(this.destinationPos.x, this.destinationPos.y);
          ctx.strokeStyle = "#69d2a2";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 0, 26 * pulse, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = "rgba(105, 210, 162, 0.26)";
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    class Game {
      constructor() {
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        this.keys = new Set();
        this.time = 0;
        this.camera = { x: 600, y: 600 };
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

        this.spawnWorld();
        this.mission = new Mission(this);

        this.lastTime = performance.now();
        this.bindEvents();
        this.resize();
        requestAnimationFrame(this.loop.bind(this));
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
        this.canvas.width = window.innerWidth * devicePixelRatio;
        this.canvas.height = window.innerHeight * devicePixelRatio;
        this.canvas.style.width = window.innerWidth + "px";
        this.canvas.style.height = window.innerHeight + "px";
        this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
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
          this.vehicles.push(car);
        }

        for (let i = 0; i < 28; i++) {
          const point = this.map.randomSidewalkPoint();
          this.npcs.push(new NPC(this, point.x, point.y));
        }
      }

      loop(now) {
        const dt = Math.min(0.033, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.time += dt;
        this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
      }

      update(dt) {
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
        this.camera.x = lerp(this.camera.x, this.player.focusX, 4.5 * dt);
        this.camera.y = lerp(this.camera.y, this.player.focusY, 4.5 * dt);
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
          this.police.push(officer);
        }

        if (this.police.length > requiredPolice) {
          this.police.length = requiredPolice;
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
        this.wanted = 0;
        this.police = [];
        this.toast("You woke up at a safe corner of the city.");
        this.mission.newMission();
      }

      rectInView(x, y, w, h, margin = 0) {
        const left = this.camera.x - window.innerWidth / 2 - margin;
        const top = this.camera.y - window.innerHeight / 2 - margin;
        const right = this.camera.x + window.innerWidth / 2 + margin;
        const bottom = this.camera.y + window.innerHeight / 2 + margin;
        return !(x + w < left || y + h < top || x > right || y > bottom);
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

      draw() {
        const ctx = this.ctx;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        ctx.clearRect(0, 0, viewW, viewH);
        ctx.save();
        ctx.translate(viewW / 2 - this.camera.x, viewH / 2 - this.camera.y);

        this.map.draw(ctx, this.camera);
        this.mission.draw(ctx, this.time);

        for (const npc of this.npcs) {
          if (this.rectInView(npc.x - 20, npc.y - 20, 40, 40, 40)) {
            npc.draw(ctx);
          }
        }
        for (const car of this.vehicles) {
          if (this.rectInView(car.x - 30, car.y - 30, 60, 60, 40)) {
            car.draw(ctx);
          }
        }
        for (const officer of this.police) {
          if (this.rectInView(officer.x - 30, officer.y - 30, 60, 60, 50)) {
            officer.draw(ctx);
          }
        }
        this.player.draw(ctx);

        ctx.restore();
        this.drawMinimap(ctx, viewW, viewH);
        this.drawWorldHints(ctx, viewW, viewH);
      }

      drawWorldHints(ctx, viewW, viewH) {
        if (!this.player.vehicle) {
          let nearest = null;
          let bestDist = 46;
          for (const car of this.vehicles) {
            if (car.driver || car.kind === "police") continue;
            const d = dist(this.player.x, this.player.y, car.x, car.y);
            if (d < bestDist) {
              bestDist = d;
              nearest = car;
            }
          }
          if (nearest) {
            const sx = nearest.x - this.camera.x + viewW / 2;
            const sy = nearest.y - this.camera.y + viewH / 2 - 34;
            ctx.fillStyle = "rgba(10,14,18,0.82)";
            ctx.strokeStyle = "rgba(255,179,71,0.3)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(sx - 44, sy - 14, 88, 28, 10);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#f6f3eb";
            ctx.font = "12px Trebuchet MS";
            ctx.textAlign = "center";
            ctx.fillText("Press E to enter", sx, sy + 4);
          }
        }
      }

      drawMinimap(ctx, viewW, viewH) {
        const size = 180;
        const x = viewW - size - 18;
        const y = 18;
        const scale = size / this.map.size;

        ctx.save();
        ctx.fillStyle = "rgba(10,14,18,0.78)";
        ctx.strokeStyle = "rgba(255,210,120,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - 8, y - 8, size + 16, size + 16, 18);
        ctx.fill();
        ctx.stroke();

        ctx.drawImage(this.map.minimapCanvas, x, y, size, size);

        if (this.mission.cooldown <= 0) {
          const missionPoint = this.mission.state === "pickup" ? this.mission.packagePos : this.mission.destinationPos;
          ctx.fillStyle = this.mission.state === "pickup" ? "#ffb347" : "#69d2a2";
          ctx.beginPath();
          ctx.arc(x + missionPoint.x * scale, y + missionPoint.y * scale, 4, 0, TAU);
          ctx.fill();
        }

        for (const officer of this.police) {
          ctx.fillStyle = "#ff5b5b";
          ctx.beginPath();
          ctx.arc(x + officer.x * scale, y + officer.y * scale, 2.7, 0, TAU);
          ctx.fill();
        }

        ctx.fillStyle = "#8ed8ff";
        ctx.beginPath();
        ctx.arc(x + this.player.focusX * scale, y + this.player.focusY * scale, 4.5, 0, TAU);
        ctx.fill();

        const camW = window.innerWidth * scale;
        const camH = window.innerHeight * scale;
        const camX = x + (this.camera.x - window.innerWidth / 2) * scale;
        const camY = y + (this.camera.y - window.innerHeight / 2) * scale;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.strokeRect(camX, camY, camW, camH);
        ctx.restore();
      }
    }

    if (typeof window !== "undefined") {
      new Game();
    }

    if (typeof module !== "undefined" && module.exports) {
      module.exports = {
        TAU,
        clamp,
        lerp,
        dist,
        angleDiff,
        expandRect,
        circleIntersectsRect,
        normalizeWantedLevel,
        formatWantedStars,
        updateWantedState
      };
    }
