/* ============================================
   MAIN.JS - Core Application Logic
   Weather search, forecast data generation,
   temperature chart, mobile menu, and more
   ============================================ */

(function () {
  "use strict";

  // ---------- Mock Weather Data ----------
  const mockCities = {
    "new york": {
      temp: 24,
      condition: "Partly Cloudy",
      icon: "partly-cloudy",
      humidity: 65,
      wind: 12,
      uv: 6,
      visibility: 10,
    },
    london: {
      temp: 16,
      condition: "Overcast",
      icon: "cloudy",
      humidity: 78,
      wind: 18,
      uv: 3,
      visibility: 8,
    },
    tokyo: {
      temp: 28,
      condition: "Sunny",
      icon: "sunny",
      humidity: 55,
      wind: 8,
      uv: 8,
      visibility: 15,
    },
    paris: {
      temp: 20,
      condition: "Light Rain",
      icon: "rainy",
      humidity: 82,
      wind: 14,
      uv: 2,
      visibility: 6,
    },
    sydney: {
      temp: 32,
      condition: "Clear Sky",
      icon: "sunny",
      humidity: 40,
      wind: 10,
      uv: 9,
      visibility: 20,
    },
    mumbai: {
      temp: 35,
      condition: "Humid & Hazy",
      icon: "cloudy",
      humidity: 85,
      wind: 6,
      uv: 7,
      visibility: 5,
    },
    dubai: {
      temp: 38,
      condition: "Hot & Sunny",
      icon: "sunny",
      humidity: 30,
      wind: 15,
      uv: 10,
      visibility: 18,
    },
    moscow: {
      temp: -5,
      condition: "Snowy",
      icon: "snowy",
      humidity: 90,
      wind: 20,
      uv: 1,
      visibility: 3,
    },
    toronto: {
      temp: 12,
      condition: "Windy",
      icon: "partly-cloudy",
      humidity: 60,
      wind: 25,
      uv: 4,
      visibility: 12,
    },
    berlin: {
      temp: 18,
      condition: "Partly Cloudy",
      icon: "partly-cloudy",
      humidity: 68,
      wind: 16,
      uv: 5,
      visibility: 10,
    },
    default: {
      temp: 22,
      condition: "Clear",
      icon: "sunny",
      humidity: 58,
      wind: 10,
      uv: 5,
      visibility: 12,
    },
  };

  const weatherIcons = {
    sunny: "☀️",
    "partly-cloudy": "⛅",
    cloudy: "☁️",
    rainy: "🌧️",
    snowy: "❄️",
    stormy: "⛈️",
  };

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ---------- Mobile Menu ----------
  function initMobileMenu() {
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobileMenu");

    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      mobileMenu.classList.toggle("active");
      document.body.style.overflow = mobileMenu.classList.contains("active")
        ? "hidden"
        : "";
    });

    // Close on link click
    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("active");
        mobileMenu.classList.remove("active");
        document.body.style.overflow = "";
      });
    });
  }

  // ---------- Search Functionality (Home Page) ----------
  function initSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (!searchInput || !searchBtn) return;

    function performSearch() {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) return;

      const data = mockCities[query] || {
        ...mockCities["default"],
        temp: 15 + Math.floor(Math.random() * 20),
      };

      // Update city name in location badge
      const cityName = query.charAt(0).toUpperCase() + query.slice(1);
      const forecastCity = document.getElementById("forecastCity");
      if (forecastCity) forecastCity.textContent = cityName;

      // Update today-card details
      const conditionEl = document.getElementById("weatherCondition");
      if (conditionEl) conditionEl.textContent = data.condition;

      const windEl = document.getElementById("windSpeed");
      if (windEl) windEl.textContent = `${data.wind} km/h`;

      const humidityEl = document.getElementById("humidity");
      if (humidityEl) humidityEl.textContent = `${data.humidity}%`;

      const uvEl = document.getElementById("uvIndex");
      if (uvEl) uvEl.textContent = `${data.uv} High`;

      const visEl = document.getElementById("visibility");
      if (visEl) visEl.textContent = `${data.visibility} km`;

      // Animate temperature counter in today card
      const tempEl = document.querySelector(".today-temp .temp-value");
      if (tempEl) {
        tempEl.dataset.target = data.temp;
        animateTemp(tempEl, data.temp);
      }

      // Flash the today card
      const todayCard = document.querySelector(".today-card");
      if (todayCard) {
        todayCard.style.transition = "box-shadow 0.3s ease";
        todayCard.style.boxShadow = "0 0 30px var(--accent-primary)";
        setTimeout(() => {
          todayCard.style.boxShadow = "";
        }, 800);
      }
    }

    searchBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }

  // Temperature counter animation
  function animateTemp(el, target) {
    const duration = 1500;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  // ---------- Forecast Page: Generate Hourly Data ----------
  function initHourlyForecast() {
    const hourlyScroll = document.getElementById("hourlyScroll");
    if (!hourlyScroll) return;

    // Remove skeleton cards
    const skeletons = hourlyScroll.querySelectorAll(".skeleton-card");

    // Simulate loading
    setTimeout(() => {
      skeletons.forEach((s) => s.remove());

      const now = new Date();
      const hours = [];

      for (let i = 0; i < 24; i++) {
        const h = new Date(now);
        h.setHours(now.getHours() + i);
        const hour = h.getHours();
        const isDay = hour >= 6 && hour < 20;
        const temp = isDay
          ? 18 + Math.floor(Math.random() * 10)
          : 12 + Math.floor(Math.random() * 6);

        const conditions = isDay
          ? ["☀️", "⛅", "🌤️", "☀️", "⛅"]
          : ["🌙", "☁️", "🌙", "🌙", "☁️"];

        hours.push({
          time: hour === now.getHours() ? "Now" : `${hour}:00`,
          icon: conditions[Math.floor(Math.random() * conditions.length)],
          temp: temp,
          wind: Math.floor(Math.random() * 20 + 5),
          isNow: hour === now.getHours(),
        });
      }

      hours.forEach((h, index) => {
        const card = document.createElement("div");
        card.className = `glass-card hourly-card scroll-snap-item${h.isNow ? " active" : ""}`;
        card.style.animation = `slide-in-right 0.4s ${index * 0.05}s var(--ease-out) both`;
        card.innerHTML = `
          <div class="hourly-time">${h.time}</div>
          <div class="hourly-icon">${h.icon}</div>
          <div class="hourly-temp">${h.temp}°</div>
          <div class="hourly-wind">${h.wind} km/h</div>
        `;
        hourlyScroll.appendChild(card);
      });
    }, 1000);
  }

  // ---------- Forecast Page: 5-Day Forecast ----------
  function initFiveDayForecast() {
    const grid = document.getElementById("forecastGrid");
    if (!grid) return;

    const conditions = [
      { icon: "⛅", name: "Partly Cloudy", high: 24, low: 16 },
      { icon: "☀️", name: "Sunny", high: 28, low: 18 },
      { icon: "🌧️", name: "Light Rain", high: 20, low: 14 },
      { icon: "⛅", name: "Partly Cloudy", high: 22, low: 15 },
      { icon: "☀️", name: "Clear Skies", high: 26, low: 17 },
    ];

    const now = new Date();

    conditions.forEach((c, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() + i + 1);

      const card = document.createElement("div");
      card.className = "glass-card forecast-day-card reveal hover-glow";
      card.innerHTML = `
        <div class="forecast-day">${i === 0 ? "Tomorrow" : shortDays[date.getDay()]}</div>
        <div class="forecast-day-date">${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        <div class="forecast-day-icon">${c.icon}</div>
        <div class="forecast-day-temp">${c.high}°</div>
        <div class="forecast-day-low">${c.low}° Low</div>
        <div class="forecast-day-condition">${c.name}</div>
        <div class="forecast-day-bar"></div>
      `;
      grid.appendChild(card);
    });

    // Re-init scroll reveal for new elements
    if (window.SkyPulseAnimations) {
      setTimeout(() => window.SkyPulseAnimations.initScrollReveal(), 100);
    }
  }

  // ---------- Temperature Chart (Canvas) ----------
  function initTempChart() {
    const canvas = document.getElementById("tempChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    // Resize canvas for DPR
    function resizeCanvas() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 300 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = "300px";
      ctx.scale(dpr, dpr);
      drawChart();
    }

    const hourlyTemps = [];
    for (let i = 0; i < 24; i++) {
      const isDay = i >= 6 && i < 20;
      hourlyTemps.push(
        isDay
          ? 16 + Math.sin(((i - 6) / 14) * Math.PI) * 10
          : 12 + Math.random() * 4,
      );
    }

    let animationProgress = 0;

    function drawChart() {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const padding = { top: 30, right: 30, bottom: 40, left: 40 };
      const chartW = width - padding.left - padding.right;
      const chartH = height - padding.top - padding.bottom;

      ctx.clearRect(0, 0, width, height);

      const minTemp = Math.floor(Math.min(...hourlyTemps) - 2);
      const maxTemp = Math.ceil(Math.max(...hourlyTemps) + 2);
      const tempRange = maxTemp - minTemp;

      // Get theme colors
      const style = getComputedStyle(document.documentElement);
      const textColor =
        style.getPropertyValue("--text-tertiary").trim() || "#718096";
      const accentColor =
        style.getPropertyValue("--accent-primary").trim() || "#3b82f6";
      const gridColor =
        style.getPropertyValue("--glass-border").trim() ||
        "rgba(255,255,255,0.1)";

      // Draw grid lines
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);

      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Temperature labels
        const temp = maxTemp - (tempRange / 4) * i;
        ctx.fillStyle = textColor;
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${Math.round(temp)}°`, padding.left - 8, y + 4);
      }

      ctx.setLineDash([]);

      // Hour labels
      ctx.fillStyle = textColor;
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "center";

      for (let i = 0; i < 24; i += 3) {
        const x = padding.left + (chartW / 23) * i;
        ctx.fillText(`${i}:00`, x, height - 10);
      }

      // Calculate points
      const points = hourlyTemps.map((temp, i) => ({
        x: padding.left + (chartW / 23) * i,
        y: padding.top + chartH - ((temp - minTemp) / tempRange) * chartH,
      }));

      // Animated drawing length
      const drawCount = Math.floor(points.length * animationProgress);

      if (drawCount < 2) return;

      // Draw gradient fill
      const gradient = ctx.createLinearGradient(
        0,
        padding.top,
        0,
        height - padding.bottom,
      );
      gradient.addColorStop(0, `${accentColor}25`);
      gradient.addColorStop(1, `${accentColor}02`);

      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding.bottom);

      // Smooth curve using bezier
      for (let i = 0; i < drawCount; i++) {
        if (i === 0) {
          ctx.lineTo(points[0].x, points[0].y);
        } else {
          const prev = points[i - 1];
          const curr = points[i];
          const cpx = (prev.x + curr.x) / 2;
          ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
        }
      }

      ctx.lineTo(points[drawCount - 1].x, height - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < drawCount; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
      }

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();

      // Draw dots
      for (let i = 0; i < drawCount; i++) {
        const p = points[i];

        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = accentColor;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
        }
      }
    }

    // Animate chart drawing
    function animateChart() {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              let start = null;
              const duration = 1500;

              function step(timestamp) {
                if (!start) start = timestamp;
                const elapsed = timestamp - start;
                animationProgress = Math.min(elapsed / duration, 1);
                drawChart();

                if (animationProgress < 1) {
                  requestAnimationFrame(step);
                }
              }

              requestAnimationFrame(step);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.3 },
      );

      observer.observe(canvas);
    }

    resizeCanvas();
    animateChart();

    // Redraw on resize
    window.addEventListener("resize", () => {
      resizeCanvas();
    });

    // Redraw when theme changes (to update colors)
    const themeObserver = new MutationObserver(() => {
      setTimeout(drawChart, 100);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  // ---------- Time-based Background ----------
  function initTimeBackground() {
    const root = document.documentElement;

    function setTimePeriod() {
      const hour = new Date().getHours();
      let period;
      if (hour >= 6 && hour < 12) period = "morning";
      else if (hour >= 12 && hour < 17) period = "afternoon";
      else if (hour >= 17 && hour < 20) period = "evening";
      else period = "night";

      root.setAttribute("data-time", period);
    }

    setTimePeriod();
    // Re-check every 5 minutes in case time period shifts while page is open
    setInterval(setTimePeriod, 5 * 60 * 1000);
  }

  // ---------- Greeting + Live Clock ----------
  function initGreeting() {
    const greetingEl = document.getElementById("greetingText");
    const clockEl = document.getElementById("liveClock");
    if (!greetingEl || !clockEl) return;

    function update() {
      const now = new Date();
      const hour = now.getHours();
      let greeting = "Good Evening";
      if (hour >= 5 && hour < 12) greeting = "Good Morning";
      else if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
      else if (hour >= 17 && hour < 21) greeting = "Good Evening";
      else greeting = "Good Night";

      greetingEl.textContent = greeting;
      clockEl.textContent = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    update();
    setInterval(update, 30000); // Update every 30 seconds
  }

  // ---------- Sun Arc (Day Progress) ----------
  function initSunArc() {
    const arcPath = document.getElementById("sunArcProgress");
    const sunDot = document.getElementById("sunArcDot");
    const sunDotInner = document.getElementById("sunArcDotInner");
    const sunText = document.getElementById("sunArcText");
    if (!arcPath || !sunDot) return;

    const sunriseHour = 6 + 42 / 60; // 6:42 AM
    const sunsetHour = 17 + 48 / 60; // 5:48 PM
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const dayLength = sunsetHour - sunriseHour;

    let progress = 0;
    if (currentHour >= sunriseHour && currentHour <= sunsetHour) {
      progress = (currentHour - sunriseHour) / dayLength;
    } else if (currentHour > sunsetHour) {
      progress = 1;
    }
    progress = Math.max(0, Math.min(1, progress));

    // Calculate arc position
    const totalArcLength = 320;
    const targetOffset = totalArcLength * (1 - progress);

    // Position sun dot along the arc
    // Arc: M 10 100 A 100 95 0 0 1 210 100 (semicircle from left to right)
    const angle = Math.PI * (1 - progress); // π to 0
    const cx = 110 - 100 * Math.cos(angle);
    const cy = 100 - 95 * Math.sin(angle);

    // Animate after intersection
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            arcPath.style.strokeDashoffset = targetOffset;
            sunDot.setAttribute("cx", cx);
            sunDot.setAttribute("cy", cy);
            if (sunDotInner) {
              sunDotInner.setAttribute("cx", cx);
              sunDotInner.setAttribute("cy", cy);
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(arcPath);

    // Update text
    if (sunText) {
      if (currentHour < sunriseHour) {
        const minutesUntilSunrise = Math.round(
          (sunriseHour - currentHour) * 60,
        );
        const h = Math.floor(minutesUntilSunrise / 60);
        const m = minutesUntilSunrise % 60;
        sunText.textContent = `Sunrise in ${h}h ${m}m`;
      } else if (currentHour > sunsetHour) {
        sunText.textContent = "Sun has set for today";
      } else {
        const minutesLeft = Math.round((sunsetHour - currentHour) * 60);
        const h = Math.floor(minutesLeft / 60);
        const m = minutesLeft % 60;
        sunText.textContent = `Sun is up \u2014 ${h}h ${m}m of daylight left`;
      }
    }
  }

  // ---------- Detail Bar Animations ----------
  function initDetailBars() {
    const bars = document.querySelectorAll(".detail-bar-fill");
    if (!bars.length) return;

    bars.forEach((bar) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              bar.classList.add("animated");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 },
      );
      observer.observe(bar);
    });
  }

  // ---------- Sparkline Charts (Trends) ----------
  function initSparklines() {
    const configs = [
      {
        id: "humiditySparkline",
        data: generateTrendData(24, 45, 82, true),
        color: "#3b82f6",
      },
      {
        id: "windSparkline",
        data: generateTrendData(24, 5, 25, false),
        color: "#22c55e",
      },
      {
        id: "pressureSparkline",
        data: generateTrendData(24, 1008, 1020, true),
        color: "#a855f7",
      },
      {
        id: "uvSparkline",
        data: generateTrendData(24, 0, 9, false),
        color: "#f59e0b",
      },
    ];

    configs.forEach((cfg) => {
      const canvas = document.getElementById(cfg.id);
      if (!canvas) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              drawSparkline(canvas, cfg.data, cfg.color);
              observer.unobserve(canvas);
            }
          });
        },
        { threshold: 0.3 },
      );
      observer.observe(canvas);
    });
  }

  function generateTrendData(count, min, max, smooth) {
    const data = [];
    let prev = min + (max - min) * 0.5;
    for (let i = 0; i < count; i++) {
      if (smooth) {
        prev += (Math.random() - 0.48) * (max - min) * 0.15;
        prev = Math.max(min, Math.min(max, prev));
        data.push(prev);
      } else {
        const isDay = i >= 6 && i < 20;
        const base = isDay
          ? min + (max - min) * (0.4 + Math.sin(((i - 6) / 14) * Math.PI) * 0.5)
          : min + (max - min) * 0.2;
        data.push(base + (Math.random() - 0.5) * (max - min) * 0.15);
      }
    }
    return data;
  }

  function drawSparkline(canvas, data, color) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 60 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "60px";
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 60;
    const pad = 4;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    let progress = 0;
    const duration = 1000;
    const start = performance.now();

    function draw(now) {
      const elapsed = now - start;
      progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const drawCount = Math.max(2, Math.floor(data.length * eased));

      ctx.clearRect(0, 0, w, h);

      const points = data.slice(0, drawCount).map((v, i) => ({
        x: pad + (i / (data.length - 1)) * (w - pad * 2),
        y: pad + (1 - (v - min) / range) * (h - pad * 2),
      }));

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, color + "30");
      grad.addColorStop(1, color + "05");

      ctx.beginPath();
      ctx.moveTo(points[0].x, h);
      points.forEach((p, i) => {
        if (i === 0) {
          ctx.lineTo(p.x, p.y);
        } else {
          const prev = points[i - 1];
          const cpx = (prev.x + p.x) / 2;
          ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
        }
      });
      ctx.lineTo(points[points.length - 1].x, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          const prev = points[i - 1];
          const cpx = (prev.x + p.x) / 2;
          ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
        }
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();

      // End dot
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (progress < 1) requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
  }

  // ---------- Precipitation Timeline ----------
  function initPrecipitation() {
    const timeline = document.getElementById("precipTimeline");
    if (!timeline) return;

    const hours = [];
    for (let i = 0; i < 24; i++) {
      const isAfternoon = i >= 12 && i < 18;
      const chance = isAfternoon
        ? 20 + Math.random() * 60
        : 5 + Math.random() * 20;
      hours.push({
        hour: i,
        chance: Math.round(chance),
      });
    }

    hours.forEach((h) => {
      const wrap = document.createElement("div");
      wrap.className = "precip-bar-wrap";

      const bar = document.createElement("div");
      bar.className = "precip-bar";
      bar.style.height = "0%";
      bar.style.opacity = 0.4 + (h.chance / 100) * 0.6;

      const label = document.createElement("span");
      label.className = "precip-bar-label";
      label.textContent = h.hour % 4 === 0 ? `${h.hour}h` : "";

      wrap.appendChild(bar);
      wrap.appendChild(label);
      timeline.appendChild(wrap);

      // Animate on intersect
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setTimeout(() => {
                bar.style.height = h.chance + "%";
              }, h.hour * 30);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.3 },
      );
      observer.observe(wrap);
    });
  }

  // ---------- AQI Gauge Animation ----------
  function initAQIGauge() {
    const arc = document.getElementById("aqiArc");
    if (!arc) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // AQI of 52 out of 300 scale → percentage
            const aqiValue = 52;
            const percentage = aqiValue / 300;
            const totalLength = 251;
            const targetOffset = totalLength * (1 - percentage);
            arc.style.strokeDashoffset = targetOffset;
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(arc);
  }

  // ---------- Initialize Everything ----------
  function init() {
    initMobileMenu();
    initSearch();
    initGreeting();
    initSunArc();
    initDetailBars();
    initHourlyForecast();
    initFiveDayForecast();
    initTempChart();
    initTimeBackground();
    initSparklines();
    initPrecipitation();
    initAQIGauge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
