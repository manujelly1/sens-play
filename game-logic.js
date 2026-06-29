(function (globalScope) {
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
    return clamp(current + delta, 0, maxWanted);
  }

  function formatWantedStars(wanted, maxWanted = 5) {
    const safeWanted = clamp(Math.round(wanted), 0, maxWanted);
    const visibleWanted = Math.max(1, safeWanted);
    return "★".repeat(visibleWanted) + "☆".repeat(maxWanted - visibleWanted);
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

  const api = {
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

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.GameLogic = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
