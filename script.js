/* ==========================================================================
   IACS — shared behaviour
   Simulation Mode: all sensor values below are synthetic, generated with a
   bounded random walk so every page shows plausible, live-looking telemetry
   without any real hardware attached.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------- clock ---------------- */

  function tickClock() {
    const el = document.querySelector("[data-clock]");
    if (!el) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------------- simulated battery state ---------------- */

  const state = {
    voltage: 51.4,      // V
    current: 6.8,       // A
    temperature: 31.2,  // C
    soc: 62,            // %
    power: 349,         // W
    charging: false,
  };

  const limits = {
    voltageMax: 58.4,
    currentMax: 10,
    tempSafe: 45,
    socTarget: 90,
  };

  function walk(value, step, min, max) {
    const next = value + (Math.random() - 0.5) * step;
    return Math.min(max, Math.max(min, next));
  }

  function stepState() {
    if (state.charging) {
      state.current = walk(state.current, 0.3, 4.5, 7.2);
      state.voltage = walk(state.voltage, 0.15, 48, 55.5);
      state.soc = Math.min(limits.socTarget, state.soc + 0.03);
      state.temperature = walk(state.temperature, 0.2, 28, 38);
    } else {
      state.current = walk(state.current, 0.05, 0, 0.4);
      state.temperature = walk(state.temperature, 0.08, 24, 28);
    }
    state.power = state.voltage * state.current;
  }

  function fmt(n, d = 1) {
    return n.toFixed(d);
  }

  /* ---------------- bind readouts wherever they appear ---------------- */

  function paint() {
    setText("[data-live-voltage]", fmt(state.voltage, 1));
    setText("[data-live-current]", fmt(state.current, 1));
    setText("[data-live-temp]", fmt(state.temperature, 1));
    setText("[data-live-soc]", Math.round(state.soc));
    setText("[data-live-power]", Math.round(state.power));

    setBar("[data-bar-soc]", (state.soc / 100) * 100, state.soc > 95 ? "danger" : "");
    setBar("[data-bar-temp]", (state.temperature / limits.tempSafe) * 100,
      state.temperature > 40 ? "warn" : "");
    setBar("[data-bar-current]", (state.current / limits.currentMax) * 100,
      state.current > 8.5 ? "warn" : "");
  }

  function setText(sel, val) {
    document.querySelectorAll(sel).forEach((el) => (el.textContent = val));
  }

  function setBar(sel, pct, cls) {
    document.querySelectorAll(sel).forEach((el) => {
      el.style.width = `${Math.max(2, Math.min(100, pct))}%`;
      el.classList.remove("warn", "danger");
      if (cls) el.classList.add(cls);
    });
  }

  setInterval(() => {
    stepState();
    paint();
  }, 2000);
  paint();

  /* ---------------- charging control page ---------------- */

  const powerToggle = document.querySelector("[data-power-toggle]");
  const startBtn = document.querySelector("[data-start-charging]");
  const stopBtn = document.querySelector("[data-stop-charging]");
  const chargeStatePill = document.querySelector("[data-charge-state-pill]");
  const chargeStateText = document.querySelector("[data-charge-state-text]");
  const powerStatusDot = document.querySelector("[data-power-status-dot]");
  const powerStatusText = document.querySelector("[data-power-status-text]");
  const currentSlider = document.querySelector("[data-current-setpoint]");
  const currentSetpointVal = document.querySelector("[data-current-setpoint-value]");

  let masterOn = false;

  function refreshChargingUI() {
    if (powerToggle) {
      powerToggle.textContent = masterOn ? "POWER OFF" : "POWER ON";
      powerToggle.classList.toggle("btn-danger", masterOn);
      powerToggle.classList.toggle("btn-accent", !masterOn);
    }
    if (powerStatusDot) {
      powerStatusDot.style.background = masterOn ? "var(--accent)" : "var(--danger)";
      powerStatusDot.style.boxShadow = masterOn
        ? "0 0 0 4px var(--accent-dim)"
        : "0 0 0 4px var(--danger-dim)";
    }
    if (powerStatusText) {
      powerStatusText.textContent = masterOn ? "POWER ON" : "POWER OFF";
    }
    if (startBtn) startBtn.disabled = !masterOn || state.charging;
    if (stopBtn) stopBtn.disabled = !masterOn || !state.charging;

    if (chargeStatePill) {
      chargeStatePill.textContent = state.charging ? "CHARGING" : "IDLE";
      chargeStatePill.classList.toggle("pill-on", state.charging);
      chargeStatePill.classList.toggle("pill-idle", !state.charging);
    }
    if (chargeStateText) {
      chargeStateText.textContent = state.charging
        ? "Delivering current to the battery under adaptive control."
        : "No energy is currently being delivered.";
    }
  }

  if (powerToggle) {
    powerToggle.addEventListener("click", () => {
      masterOn = !masterOn;
      if (!masterOn) state.charging = false;
      refreshChargingUI();
    });
  }
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (!masterOn) return;
      state.charging = true;
      refreshChargingUI();
    });
  }
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      state.charging = false;
      refreshChargingUI();
    });
  }
  if (currentSlider) {
    currentSlider.addEventListener("input", (e) => {
      if (currentSetpointVal) currentSetpointVal.textContent = fmt(Number(e.target.value), 1);
    });
  }
  refreshChargingUI();

  /* ---------------- energy flow page ---------------- */

  const flowButtons = document.querySelectorAll("[data-flow-mode]");
  const flowPath = document.querySelector("[data-flow-path]");
  const flowValue = document.querySelector("[data-flow-value]");
  const flowHeadings = document.querySelectorAll("[data-flow-heading]");
  const flowDesc = document.querySelector("[data-flow-desc]");

  function setFlowMode(mode) {
    flowButtons.forEach((b) => b.classList.toggle("active", b.dataset.flowMode === mode));
    if (flowPath) flowPath.classList.toggle("reverse", mode === "v2g");
    flowHeadings.forEach((el) => {
      el.textContent = mode === "g2v" ? "Grid → Vehicle" : "Vehicle → Grid";
    });
    if (flowDesc) {
      flowDesc.innerHTML =
        mode === "g2v"
          ? "Energy is flowing from the grid into the vehicle battery.<br>IACS is controlling the direction and rate of power transfer."
          : "Energy is flowing from the vehicle battery back to the grid.<br>IACS is controlling the direction and rate of power transfer.";
    }
  }

  flowButtons.forEach((btn) => {
    btn.addEventListener("click", () => setFlowMode(btn.dataset.flowMode));
  });

  setInterval(() => {
    if (flowValue) flowValue.textContent = Math.round(state.power || 300);
  }, 2000);

  /* ---------------- system page: simulation mode switch ---------------- */

  const simSwitch = document.querySelector("[data-sim-switch]");
  if (simSwitch) {
    simSwitch.addEventListener("change", () => {
      const label = document.querySelector("[data-sim-switch-label]");
      if (label) label.textContent = simSwitch.checked ? "Simulation Mode" : "Live Hardware Mode";
    });
  }

  /* ---------------- analytics: power history chart ---------------- */

  const canvas = document.querySelector("[data-power-chart]");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const points = [];
    const maxPoints = 40;

    function seed() {
      let v = 260;
      for (let i = 0; i < maxPoints; i++) {
        v = Math.max(120, Math.min(420, v + (Math.random() - 0.5) * 40));
        points.push(v);
      }
    }
    seed();

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      draw();
    }

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const max = Math.max(...points) * 1.1;
      const min = 0;
      const stepX = w / (maxPoints - 1);

      // grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1 * devicePixelRatio;
      for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // area
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(47,217,163,0.28)");
      grad.addColorStop(1, "rgba(47,217,163,0)");

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = i * stepX;
        const y = h - ((p - min) / (max - min)) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // line
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = i * stepX;
        const y = h - ((p - min) / (max - min)) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#2fd9a3";
      ctx.lineWidth = 2.2 * devicePixelRatio;
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    window.addEventListener("resize", resize);
    resize();

    setInterval(() => {
      points.shift();
      const last = points[points.length - 1];
      points.push(Math.max(120, Math.min(420, last + (Math.random() - 0.5) * 40)));
      draw();
    }, 1500);
  }
})();
