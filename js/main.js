/* ============================================
   MAIN.JS - Core Application Logic
   Weather search, forecast data generation,
   temperature chart, mobile menu, and more
   ============================================ */

(function () {
  "use strict";

  const API_BASE =
    (window.SkyPulseConfig && window.SkyPulseConfig.API && window.SkyPulseConfig.API.weather) ||
    "http://localhost:5000/api/weather";
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let latestForecastData = null;
  let redrawTempChart = null;

  function toNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parseApiTimeToHours(value, fallbackHours) {
    if (!value || typeof value !== "string") return fallbackHours;
    const parts = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!parts) return fallbackHours;

    let hours = Number.parseInt(parts[1], 10);
    const minutes = Number.parseInt(parts[2], 10);
    const meridiem = parts[3].toUpperCase();
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallbackHours;

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours + minutes / 60;
  }

  function formatHourLabel(hour) {
    const normalized = ((hour % 24) + 24) % 24;
    const suffix = normalized >= 12 ? "PM" : "AM";
    const hour12 = normalized % 12 || 12;
    return `${hour12} ${suffix}`;
  }

  function average(values, fallback = 0) {
    if (!values.length) return fallback;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }

  function updateText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = value;
  }

  function formatTrendBadge(delta, unit = "") {
    if (Math.abs(delta) < 0.3) {
      return { text: "Stable", className: "trend-badge trend-badge-stable" };
    }
    if (delta > 0) {
      return {
        text: `↑ Rising${unit ? ` ${unit}` : ""}`,
        className: "trend-badge trend-badge-up",
      };
    }
    return {
      text: `↓ Falling${unit ? ` ${unit}` : ""}`,
      className: "trend-badge trend-badge-down",
    };
  }

  // ---------- Auth-Aware Nav ----------
  function initAuthNavVisibility() {
    const token =
      (window.SkyPulseConfig && typeof window.SkyPulseConfig.getToken === "function"
        ? window.SkyPulseConfig.getToken()
        : localStorage.getItem("token") || localStorage.getItem("sp_token")) || "";
    const isLoggedIn = Boolean(token && token.trim());
    if (!isLoggedIn) return;

    document
      .querySelectorAll('a[href="login.html"], a[href$="/login.html"]')
      .forEach((link) => {
        link.textContent = "Logout";
        link.setAttribute("href", "#");
        link.classList.remove("active");
        link.style.color = "#ef4444";
        link.style.fontWeight = "700";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          if (window.SkyPulseConfig && typeof window.SkyPulseConfig.clearToken === "function") {
            window.SkyPulseConfig.clearToken();
          } else {
            localStorage.removeItem("token");
            localStorage.removeItem("sp_token");
          }
          localStorage.removeItem("sp_user");
          window.location.href = "login.html";
        });
      });
  }

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

  function setCityLabel(city, country) {
    const forecastCity = document.getElementById("forecastCity");
    if (!forecastCity) return;

    forecastCity.textContent = country ? `${city}, ${country}` : city;
  }

  function setMainWeatherValues(data) {
    if (!data) return;

    setCityLabel(data.city, data.country);

    const tempEl = document.querySelector(".today-temp .temp-value");
    if (tempEl && Number.isFinite(data.temp_c)) {
      tempEl.dataset.target = data.temp_c;
      animateTemp(tempEl, Math.round(data.temp_c));
    }

    const conditionElById = document.getElementById("weatherCondition");
    const conditionElByClass = document.querySelector(".today-condition");
    const conditionText = data.condition?.text || "--";
    if (conditionElById) conditionElById.textContent = conditionText;
    if (conditionElByClass) conditionElByClass.textContent = conditionText;

    const feelsEl = document.querySelector(".today-feels");
    if (feelsEl && Number.isFinite(data.feels_like_c)) {
      feelsEl.textContent = `Feels like ${Math.round(data.feels_like_c)}°C`;
    }

    const windById = document.getElementById("windSpeed");
    const humidityById = document.getElementById("humidity");
    const uvById = document.getElementById("uvIndex");
    const visibilityById = document.getElementById("visibility");
    if (windById) windById.textContent = `${Math.round(data.wind_kph || 0)} km/h`;
    if (humidityById) humidityById.textContent = `${Math.round(data.humidity || 0)}%`;
    if (uvById) uvById.textContent = `${data.uv_index ?? 0} ${data.uv_index >= 6 ? "High" : "Moderate"}`;
    if (visibilityById) visibilityById.textContent = `${Math.round(data.visibility_km || 0)} km`;

    const detailValues = document.querySelectorAll(".today-detail .detail-value");
    if (detailValues.length >= 6) {
      detailValues[0].textContent = `${Math.round(data.wind_kph || 0)} km/h`;
      detailValues[1].textContent = `${Math.round(data.humidity || 0)}%`;
      detailValues[2].textContent = `${data.uv_index ?? 0} ${data.uv_index >= 6 ? "High" : "Moderate"}`;
      detailValues[5].textContent = `${Math.round(data.visibility_km || 0)} km`;
    }

    const today = data.forecast && data.forecast.length ? data.forecast[0] : null;
    const sunriseValue = today?.sunrise || "6:42 AM";
    const sunsetValue = today?.sunset || "5:48 PM";
    updateText("sunriseValue", sunriseValue);
    updateText("sunsetValue", sunsetValue);
  }

  function updateSunArcFromData(forecastData) {
    const arcPath = document.getElementById("sunArcProgress");
    const sunDot = document.getElementById("sunArcDot");
    const sunDotInner = document.getElementById("sunArcDotInner");
    const sunText = document.getElementById("sunArcText");
    if (!arcPath || !sunDot) return;

    const today = forecastData?.forecast?.length ? forecastData.forecast[0] : null;
    const sunriseText = today?.sunrise || "6:42 AM";
    const sunsetText = today?.sunset || "5:48 PM";

    updateText("sunriseLabel", sunriseText.replace(" AM", "").replace(" PM", ""));
    updateText("sunsetLabel", sunsetText.replace(" AM", "").replace(" PM", ""));

    const sunriseHour = parseApiTimeToHours(sunriseText, 6 + 42 / 60);
    const sunsetHour = parseApiTimeToHours(sunsetText, 17 + 48 / 60);
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const dayLength = Math.max(1, sunsetHour - sunriseHour);

    let progress = 0;
    if (currentHour >= sunriseHour && currentHour <= sunsetHour) {
      progress = (currentHour - sunriseHour) / dayLength;
    } else if (currentHour > sunsetHour) {
      progress = 1;
    }
    progress = clamp(progress, 0, 1);

    const totalArcLength = 320;
    const targetOffset = totalArcLength * (1 - progress);
    const angle = Math.PI * (1 - progress);
    const cx = 110 - 100 * Math.cos(angle);
    const cy = 100 - 95 * Math.sin(angle);

    arcPath.style.strokeDashoffset = targetOffset;
    sunDot.setAttribute("cx", cx);
    sunDot.setAttribute("cy", cy);
    if (sunDotInner) {
      sunDotInner.setAttribute("cx", cx);
      sunDotInner.setAttribute("cy", cy);
    }

    if (sunText) {
      if (currentHour < sunriseHour) {
        const minutesUntilSunrise = Math.round((sunriseHour - currentHour) * 60);
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

  function renderHourlyForecast(forecastData) {
    const hourlyScroll = document.getElementById("hourlyScroll");
    if (!hourlyScroll || !forecastData?.forecast?.length) return;

    hourlyScroll.innerHTML = "";
    const firstDay = forecastData.forecast[0];
    const now = new Date();
    const currentHour = now.getHours();

    firstDay.hourly.slice(0, 24).forEach((hour, index) => {
      const hourDate = new Date(hour.time.replace(" ", "T"));
      const hourValue = hourDate.getHours();
      const isNow = index === currentHour;
      const icon = hour.condition?.icon
        ? `<img src="https:${hour.condition.icon}" alt="${hour.condition.text || "Weather"}" style="width:34px;height:34px;"/>`
        : "☁️";

      const card = document.createElement("div");
      card.className = `glass-card hourly-card scroll-snap-item${isNow ? " active" : ""}`;
      card.innerHTML = `
        <div class="hourly-time">${isNow ? "Now" : `${hourValue}:00`}</div>
        <div class="hourly-icon">${icon}</div>
        <div class="hourly-temp">${Math.round(hour.temp_c)}°</div>
        <div class="hourly-wind">${Math.round(hour.wind_kph || 0)} km/h</div>
      `;
      hourlyScroll.appendChild(card);
    });
  }

  function renderDailyForecast(forecastData) {
    const grid = document.getElementById("forecastGrid");
    if (!grid || !forecastData?.forecast?.length) return;

    grid.innerHTML = "";
    forecastData.forecast.slice(0, 5).forEach((day, index) => {
      const date = new Date(day.date + "T00:00:00");
      const icon = day.condition?.icon
        ? `<img src="https:${day.condition.icon}" alt="${day.condition.text || "Weather"}" style="width:44px;height:44px;"/>`
        : "☁️";

      const card = document.createElement("div");
      card.className = "glass-card forecast-day-card hover-glow visible";
      card.innerHTML = `
        <div class="forecast-day">${index === 0 ? "Today" : shortDays[date.getDay()]}</div>
        <div class="forecast-day-date">${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        <div class="forecast-day-icon">${icon}</div>
        <div class="forecast-day-temp">${Math.round(day.max_c)}°</div>
        <div class="forecast-day-low">${Math.round(day.min_c)}° Low</div>
        <div class="forecast-day-condition">${day.condition?.text || "--"}</div>
        <div class="forecast-day-bar"></div>
      `;
      grid.appendChild(card);
    });
  }

  function handleWeatherResponse(payload) {
    if (!payload || !payload.success || !payload.data) {
      throw new Error(payload?.message || "Failed to load weather data");
    }

    latestForecastData = payload.data;
    setMainWeatherValues(payload.data);
    updateSunArcFromData(payload.data);
    renderHourlyForecast(payload.data);
    renderDailyForecast(payload.data);
    renderRealtimeTrends(payload.data);
    renderPrecipitation(payload.data);
    renderAQIGauge(payload.data);
    if (typeof redrawTempChart === "function") redrawTempChart();
  }

  function renderFallbackForecast() {
    const grid = document.getElementById("forecastGrid");
    if (!grid) return;

    const fallbackDays = [
      { day: "Today", date: "--", max: 32, min: 24, condition: "Partly Cloudy", icon: "⛅" },
      { day: "Mon", date: "--", max: 33, min: 24, condition: "Sunny", icon: "☀️" },
      { day: "Tue", date: "--", max: 31, min: 23, condition: "Cloudy", icon: "☁️" },
      { day: "Wed", date: "--", max: 30, min: 23, condition: "Light Rain", icon: "🌦️" },
      { day: "Thu", date: "--", max: 32, min: 24, condition: "Sunny", icon: "☀️" },
    ];

    grid.innerHTML = "";
    fallbackDays.forEach((day) => {
      const card = document.createElement("div");
      card.className = "glass-card forecast-day-card hover-glow visible";
      card.innerHTML = `
        <div class="forecast-day">${day.day}</div>
        <div class="forecast-day-date">${day.date}</div>
        <div class="forecast-day-icon">${day.icon}</div>
        <div class="forecast-day-temp">${day.max}°</div>
        <div class="forecast-day-low">${day.min}° Low</div>
        <div class="forecast-day-condition">${day.condition}</div>
        <div class="forecast-day-bar"></div>
      `;
      grid.appendChild(card);
    });
  }

  async function fetchForecastByCity(city, days = 7) {
    const response = await fetch(
      `${API_BASE}/forecast?city=${encodeURIComponent(city)}&days=${encodeURIComponent(days)}`
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to fetch weather");
    }
    return payload;
  }

  async function fetchForecastByCoords(lat, lon, days = 7) {
    const response = await fetch(
      `${API_BASE}/forecast/coords?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&days=${encodeURIComponent(days)}`
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to fetch location weather");
    }
    return payload;
  }

  async function loadDefaultWeather() {
    try {
      const payload = await fetchForecastByCity("Mumbai", 7);
      handleWeatherResponse(payload);
    } catch (error) {
      console.error("Default weather load failed:", error.message);
      setCityLabel("Pune", "IN");
      renderFallbackForecast();
    }
  }

  async function loadWeatherFromGeolocation() {
    if (!("geolocation" in navigator)) {
      await loadDefaultWeather();
      return;
    }

    try {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const payload = await fetchForecastByCoords(
        coords.coords.latitude,
        coords.coords.longitude,
        7
      );
      handleWeatherResponse(payload);
    } catch (error) {
      console.warn("Geolocation weather load failed, falling back to default:", error.message);
      await loadDefaultWeather();
    }
  }

  // ---------- Search Functionality (Home Page) ----------
  function initSearch() {
    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (!searchInput || !searchBtn) return;

    async function performSearch() {
      const query = searchInput.value.trim();
      if (!query) return;

      try {
        const payload = await fetchForecastByCity(query, 7);
        handleWeatherResponse(payload);

        const todayCard = document.querySelector(".today-card");
        if (todayCard) {
          todayCard.style.transition = "box-shadow 0.3s ease";
          todayCard.style.boxShadow = "0 0 30px var(--accent-primary)";
          setTimeout(() => {
            todayCard.style.boxShadow = "";
          }, 800);
        }
      } catch (error) {
        console.error("City weather search failed:", error.message);
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

  function initLiveWeather() {
    const hasWeatherUI = Boolean(document.getElementById("forecastCity"));
    if (!hasWeatherUI) return;

    renderFallbackForecast();
    loadWeatherFromGeolocation();
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

    function getChartTemps() {
      const liveTemps = latestForecastData?.forecast?.[0]?.hourly
        ?.map((hour) => hour?.temp_c)
        .filter((temp) => Number.isFinite(temp));
      if (liveTemps && liveTemps.length >= 8) {
        return liveTemps.slice(0, 24);
      }

      const fallbackTemps = [];
      for (let i = 0; i < 24; i++) {
        const isDay = i >= 6 && i < 20;
        fallbackTemps.push(
          isDay
            ? 16 + Math.sin(((i - 6) / 14) * Math.PI) * 10
            : 12 + Math.random() * 4,
        );
      }
      return fallbackTemps;
    }

    let animationProgress = 0;

    function drawChart() {
      const hourlyTemps = getChartTemps();
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
    redrawTempChart = () => {
      animationProgress = 1;
      drawChart();
    };

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
    updateSunArcFromData(latestForecastData);
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

  function updateTrendRange(cardIndex, lowText, avgText, highText) {
    const card = document.querySelectorAll(".trend-card")[cardIndex];
    if (!card) return;
    const spans = card.querySelectorAll(".trend-range span");
    if (spans.length < 3) return;
    spans[0].textContent = lowText;
    spans[1].textContent = avgText;
    spans[2].textContent = highText;
  }

  function renderRealtimeTrends(weatherData) {
    const hourly = weatherData?.forecast?.[0]?.hourly || [];

    const humiditySeries = hourly
      .map((hour) => toNumber(hour?.humidity, NaN))
      .filter((value) => Number.isFinite(value));
    const windSeries = hourly
      .map((hour) => toNumber(hour?.wind_kph, NaN))
      .filter((value) => Number.isFinite(value));
    const pressureSeries = hourly
      .map((hour) => toNumber(hour?.pressure_mb, NaN))
      .filter((value) => Number.isFinite(value));
    const uvSeries = hourly
      .map((hour) => toNumber(hour?.uv_index, NaN))
      .filter((value) => Number.isFinite(value));

    const humidityValues = humiditySeries.length ? humiditySeries : generateTrendData(24, 45, 82, true);
    const windValues = windSeries.length ? windSeries : generateTrendData(24, 5, 25, false);
    const pressureValues = pressureSeries.length ? pressureSeries : generateTrendData(24, 1008, 1020, true);
    const uvValues = uvSeries.length ? uvSeries : generateTrendData(24, 0, 9, false);

    const humidityNow = Math.round(toNumber(weatherData?.humidity, humidityValues[0]));
    const windNow = Math.round(toNumber(weatherData?.wind_kph, windValues[0]));
    const pressureNow = Math.round(toNumber(weatherData?.pressure_mb, pressureValues[0]));
    const uvNowRaw = toNumber(weatherData?.uv_index, uvValues[0]);
    const uvNow = Math.round(uvNowRaw);

    updateText("trendHumidity", `${humidityNow}%`);
    updateText("trendWind", `${windNow} km/h`);
    updateText("trendPressure", `${pressureNow} hPa`);
    updateText("trendUV", `${uvNow} ${uvNow >= 6 ? "High" : uvNow >= 3 ? "Moderate" : "Low"}`);

    const humidityBadge = formatTrendBadge(humidityValues[humidityValues.length - 1] - humidityValues[0]);
    const windBadge = formatTrendBadge(windValues[windValues.length - 1] - windValues[0]);
    const pressureBadge = formatTrendBadge(pressureValues[pressureValues.length - 1] - pressureValues[0]);
    const uvBadge = formatTrendBadge(uvValues[uvValues.length - 1] - uvValues[0]);

    const badgeMap = [
      ["trendHumidityBadge", humidityBadge],
      ["trendWindBadge", windBadge],
      ["trendPressureBadge", pressureBadge],
      ["trendUVBadge", uvBadge],
    ];

    badgeMap.forEach(([id, value]) => {
      const badge = document.getElementById(id);
      if (!badge) return;
      badge.textContent = value.text;
      badge.className = value.className;
    });

    updateTrendRange(
      0,
      `Low: ${Math.round(Math.min(...humidityValues))}%`,
      `Avg: ${Math.round(average(humidityValues))}%`,
      `High: ${Math.round(Math.max(...humidityValues))}%`,
    );
    updateTrendRange(
      1,
      `Low: ${Math.round(Math.min(...windValues))} km/h`,
      `Avg: ${Math.round(average(windValues))} km/h`,
      `High: ${Math.round(Math.max(...windValues))} km/h`,
    );
    updateTrendRange(
      2,
      `Low: ${Math.round(Math.min(...pressureValues))} hPa`,
      `Avg: ${Math.round(average(pressureValues))} hPa`,
      `High: ${Math.round(Math.max(...pressureValues))} hPa`,
    );
    updateTrendRange(
      3,
      `Low: ${Math.round(Math.min(...uvValues))}`,
      `Avg: ${Math.round(average(uvValues))}`,
      `High: ${Math.round(Math.max(...uvValues))}`,
    );

    drawSparkline(document.getElementById("humiditySparkline"), humidityValues, "#3b82f6");
    drawSparkline(document.getElementById("windSparkline"), windValues, "#22c55e");
    drawSparkline(document.getElementById("pressureSparkline"), pressureValues, "#a855f7");
    drawSparkline(document.getElementById("uvSparkline"), uvValues, "#f59e0b");
  }

  // ---------- Sparkline Charts (Trends) ----------
  function initSparklines() {
    renderRealtimeTrends(latestForecastData);
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
    if (!canvas || !Array.isArray(data) || data.length < 2) return;
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

  function renderPrecipitation(weatherData) {
    const timeline = document.getElementById("precipTimeline");
    if (!timeline) return;

    const hourlyLive = weatherData?.forecast?.[0]?.hourly || [];
    const hours = hourlyLive.length
      ? hourlyLive.slice(0, 24).map((hour, index) => ({
          hour: index,
          chance: Math.round(toNumber(hour?.chance_of_rain, 0)),
          precip: toNumber(hour?.precip_mm, 0),
        }))
      : Array.from({ length: 24 }, (_, i) => {
          const isAfternoon = i >= 12 && i < 18;
          const chance = isAfternoon ? 20 + Math.random() * 60 : 5 + Math.random() * 20;
          return { hour: i, chance: Math.round(chance), precip: 0 };
        });

    timeline.innerHTML = "";

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

    const chanceNow = Math.round(average(hours.map((h) => h.chance), 30));
    const precipTotal = weatherData?.forecast?.[0]?.total_precip_mm;
    const precipAmount = Number.isFinite(precipTotal)
      ? precipTotal
      : hours.reduce((acc, hour) => acc + toNumber(hour.precip, 0), 0);
    const peak = hours.reduce((best, hour) => (hour.chance > best.chance ? hour : best), hours[0]);

    updateText("precipChance", `${chanceNow}%`);
    updateText("precipAmount", `${precipAmount.toFixed(1)} mm`);
    updateText("precipPeak", formatHourLabel(peak.hour));
  }

  function normalizeAqiValue(aqi) {
    if (!Number.isFinite(aqi)) return null;
    const mapping = {
      1: 25,
      2: 50,
      3: 100,
      4: 150,
      5: 200,
      6: 300,
    };
    return mapping[Math.round(aqi)] || null;
  }

  function computeAqiFromBreakpoints(concentration, breakpoints) {
    if (!Number.isFinite(concentration)) return null;

    const range = breakpoints.find(
      (bp) => concentration >= bp.cLow && concentration <= bp.cHigh,
    );
    if (!range) return null;

    const ratio = (concentration - range.cLow) / (range.cHigh - range.cLow || 1);
    return range.iLow + ratio * (range.iHigh - range.iLow);
  }

  function estimateUsAqiFromPollutants(air) {
    const pm25 = Number(air?.pm2_5);
    const pm10 = Number(air?.pm10);

    const pm25Aqi = computeAqiFromBreakpoints(pm25, [
      { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
      { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
      { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
      { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
      { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
      { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
    ]);

    const pm10Aqi = computeAqiFromBreakpoints(pm10, [
      { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
      { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
      { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
      { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
      { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
      { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
    ]);

    const candidates = [pm25Aqi, pm10Aqi].filter((value) => Number.isFinite(value));
    if (!candidates.length) return null;
    return Math.max(...candidates);
  }

  function getAqiFromAirQuality(air) {
    const rawUsAqi = air?.us_aqi;
    if (typeof rawUsAqi === "number" && Number.isFinite(rawUsAqi)) {
      return clamp(rawUsAqi, 0, 500);
    }
    if (typeof rawUsAqi === "string" && rawUsAqi.trim() !== "") {
      const parsedUsAqi = Number(rawUsAqi);
      if (Number.isFinite(parsedUsAqi)) {
        return clamp(parsedUsAqi, 0, 500);
      }
    }

    const rawEpaIndex = air?.us_epa_index;
    let normalizedEpaIndex = null;
    if (typeof rawEpaIndex === "number" && Number.isFinite(rawEpaIndex)) {
      normalizedEpaIndex = rawEpaIndex;
    } else if (typeof rawEpaIndex === "string" && rawEpaIndex.trim() !== "") {
      const parsedEpaIndex = Number(rawEpaIndex);
      if (Number.isFinite(parsedEpaIndex)) {
        normalizedEpaIndex = parsedEpaIndex;
      }
    }

    const mapped = normalizeAqiValue(normalizedEpaIndex);
    if (Number.isFinite(mapped)) {
      const estimated = estimateUsAqiFromPollutants(air);
      if (Number.isFinite(estimated)) {
        return clamp(estimated, 0, 500);
      }
      return clamp(mapped, 0, 500);
    }

    const estimated = estimateUsAqiFromPollutants(air);
    if (Number.isFinite(estimated)) {
      return clamp(estimated, 0, 500);
    }

    return 52;
  }

  function categorizeAqi(value) {
    if (!Number.isFinite(value)) return "Moderate";
    if (value <= 50) return "Good";
    if (value <= 100) return "Moderate";
    if (value <= 150) return "Unhealthy for Sensitive";
    if (value <= 200) return "Unhealthy";
    if (value <= 300) return "Very Unhealthy";
    return "Hazardous";
  }

  // ---------- AQI Gauge Animation ----------
  function renderAQIGauge(weatherData) {
    const arc = document.getElementById("aqiArc");
    if (!arc) return;

    const air = weatherData?.air_quality || {};
    const aqiValue = getAqiFromAirQuality(air);
    const percentage = clamp(aqiValue / 300, 0, 1);
    const totalLength = 251;
    const targetOffset = totalLength * (1 - percentage);

    arc.style.strokeDashoffset = targetOffset;
    updateText("aqiValueText", `${Math.round(aqiValue)}`);
    updateText("aqiLabelText", categorizeAqi(aqiValue));

    updateText("pollutantPm25", `${Math.round(toNumber(air.pm2_5, 15))} µg/m³`);
    updateText("pollutantPm10", `${Math.round(toNumber(air.pm10, 28))} µg/m³`);
    updateText("pollutantO3", `${Math.round(toNumber(air.o3, 42))} µg/m³`);
    updateText("pollutantNo2", `${Math.round(toNumber(air.no2, 18))} µg/m³`);
  }

  function initPrecipitation() {
    renderPrecipitation(latestForecastData);
  }

  function initAQIGauge() {
    renderAQIGauge(latestForecastData);
  }

  // ---------- Initialize Everything ----------
  function init() {
    initAuthNavVisibility();
    initMobileMenu();
    initSearch();
    initLiveWeather();
    initGreeting();
    initSunArc();
    initDetailBars();
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
// ✅ Make function GLOBAL so button can access it
window.saveTrip = async function () {

    console.log("✅ SaveTrip clicked");

    const city = document.getElementById("tripCity").value;
    const travelDate = document.getElementById("tripDate").value; // dummy date

    if (!city) {
        alert("Please enter a city");
        return;
    }
    if (!travelDate) {
    alert("Please select a date");
    return;
}

    try {
        console.log("⏳ Fetching weather...");

        const apiKey = "9137515afb21070e09b1b39496b30cf5";

        const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`;

        const res = await fetch(url);
        console.log("Response status:", res.status);

        const data = await res.json();
        console.log("Weather Data:", data);

        if (!data.list || data.list.length === 0) {
            alert("No data received");
            return;
        }

        const forecast = data.list[0];
        const temp = forecast.main.temp;

        let advice = "Good time to travel ✅";

        if (forecast.weather[0].main.includes("Rain")) {
            advice = "Not recommended ❌ (Rain expected)";
        } else if (temp > 35) {
            advice = "Too hot 🔥";
        }

        // Show advice
        const adviceEl = document.getElementById("travelAdvice");
        if (adviceEl) {
            adviceEl.innerText = advice;
        }

        console.log("Sending to backend...");

        // Send to backend
        await fetch("http://localhost:3000/save-trip", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: 1,
                city: city,
                date: travelDate
            })
        });

        alert("Trip Saved! ✅");

    } catch (err) {
        console.error("❌ Error:", err);
        alert("Error fetching weather");
    }
};