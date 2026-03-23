(function () {
  "use strict";

  const cfg = window.SkyPulseConfig;
  const API_BASE =
    (cfg && cfg.API && cfg.API.travel) || "http://localhost:5000/api/travel";

  const state = {
    trips: [],
    selectedTripId: null,
    selectedTrip: null,
    details: null,
    alerts: [],
  };

  const dom = {
    appContent: document.getElementById("appContent"),
    authGuard: document.getElementById("authGuard"),
    mobileMenu: document.getElementById("mobileMenu"),
    hamburger: document.getElementById("hamburger"),
    refreshAllBtn: document.getElementById("refreshAllBtn"),
    runAlertsBtn: document.getElementById("runAlertsBtn"),
    tripCount: document.getElementById("tripCount"),
    tripList: document.getElementById("tripList"),
    createTripForm: document.getElementById("createTripForm"),
    tripName: document.getElementById("tripName"),
    tripDescription: document.getElementById("tripDescription"),
    tripStartDate: document.getElementById("tripStartDate"),
    tripEndDate: document.getElementById("tripEndDate"),
    tripMeta: document.getElementById("tripMeta"),
    selectedTripStatus: document.getElementById("selectedTripStatus"),
    tripActions: document.getElementById("tripActions"),
    tripStatusSelect: document.getElementById("tripStatusSelect"),
    updateTripStatusBtn: document.getElementById("updateTripStatusBtn"),
    deleteTripBtn: document.getElementById("deleteTripBtn"),
    destinationCount: document.getElementById("destinationCount"),
    addDestinationForm: document.getElementById("addDestinationForm"),
    destinationCity: document.getElementById("destinationCity"),
    destinationCountryCode: document.getElementById("destinationCountryCode"),
    autoFillLocationBtn: document.getElementById("autoFillLocationBtn"),
    autoFillLocationHint: document.getElementById("autoFillLocationHint"),
    destinationLat: document.getElementById("destinationLat"),
    destinationLon: document.getElementById("destinationLon"),
    destinationArrival: document.getElementById("destinationArrival"),
    destinationDeparture: document.getElementById("destinationDeparture"),
    destinationNotes: document.getElementById("destinationNotes"),
    destinationList: document.getElementById("destinationList"),
    addPackingForm: document.getElementById("addPackingForm"),
    packingItemName: document.getElementById("packingItemName"),
    packingCategory: document.getElementById("packingCategory"),
    suggestPackingBtn: document.getElementById("suggestPackingBtn"),
    packingList: document.getElementById("packingList"),
    alertsList: document.getElementById("alertsList"),
    alertCount: document.getElementById("alertCount"),
    toastRack: document.getElementById("toastRack"),
    totalDestinationsStat: document.getElementById("totalDestinationsStat"),
    packingProgressStat: document.getElementById("packingProgressStat"),
    unreadAlertsStat: document.getElementById("unreadAlertsStat"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setAuthState(isAuthed) {
    if (!dom.authGuard || !dom.appContent) return;
    dom.authGuard.classList.toggle("hidden", isAuthed);
    dom.appContent.classList.toggle("hidden", !isAuthed);
  }

  function handleAuthExpired(message) {
    if (cfg && typeof cfg.clearToken === "function") {
      cfg.clearToken();
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("sp_token");
    }
    localStorage.removeItem("sp_user");
    setAuthState(false);
    showToast(message || "Session expired. Please login again.", "err");
  }

  function getToken() {
    if (cfg && typeof cfg.getToken === "function") return cfg.getToken();
    return (
      localStorage.getItem("token") || localStorage.getItem("sp_token") || ""
    );
  }

  function showToast(message, type) {
    if (!dom.toastRack) return;
    const el = document.createElement("div");
    el.className = `toast ${type === "err" ? "err" : "ok"}`;
    el.textContent = message;
    dom.toastRack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 200);
    }, 2400);
  }

  async function api(path, options) {
    const method = (options && options.method) || "GET";
    const hasBody = Boolean(options && options.body);
    const headers = {
      ...(cfg && typeof cfg.authHeaders === "function"
        ? cfg.authHeaders()
        : {}),
      ...((options && options.headers) || {}),
    };

    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response
      .json()
      .catch(() => ({ success: false, message: "Invalid response" }));

    if (response.status === 401 || response.status === 403) {
      handleAuthExpired(payload.message || "Authorization failed");
      throw new Error(payload.message || "Authorization failed");
    }

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Request failed");
    }
    return payload;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr));
    const d = isDateOnly ? new Date(`${dateStr}T00:00:00`) : new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function updateFormLockState() {
    const hasTrip = Boolean(state.selectedTripId);
    if (dom.addDestinationForm)
      dom.addDestinationForm.classList.toggle("disabled-form", !hasTrip);
    if (dom.addPackingForm)
      dom.addPackingForm.classList.toggle("disabled-form", !hasTrip);
    if (dom.tripActions) dom.tripActions.classList.toggle("hidden", !hasTrip);
  }

  function updateSummaryStats() {
    const destinations = (state.details && state.details.destinations) || [];
    const packingItems = (state.details && state.details.packing_items) || [];
    const packed = packingItems.filter((item) =>
      Boolean(item.is_packed),
    ).length;
    const progress = packingItems.length
      ? Math.round((packed / packingItems.length) * 100)
      : 0;

    if (dom.totalDestinationsStat)
      dom.totalDestinationsStat.textContent = String(destinations.length);
    if (dom.packingProgressStat)
      dom.packingProgressStat.textContent = `${progress}%`;
    if (dom.unreadAlertsStat)
      dom.unreadAlertsStat.textContent = String(state.alerts.length);
  }

  function setAutoFillHint(message, isError) {
    if (!dom.autoFillLocationHint) return;
    dom.autoFillLocationHint.textContent = message;
    dom.autoFillLocationHint.style.color = isError
      ? "#ef4444"
      : "var(--text-secondary)";
  }

  async function fetchCityGeo(cityName) {
    const query = (cityName || "").trim();
    if (!query) return null;

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to resolve city location right now");
    }

    const payload = await response.json().catch(() => ({}));
    const result =
      payload && Array.isArray(payload.results) && payload.results.length
        ? payload.results[0]
        : null;

    if (!result) return null;

    return {
      city: result.name || query,
      countryCode: (result.country_code || "").toUpperCase(),
      lat: result.latitude,
      lon: result.longitude,
    };
  }

  async function autoFillDestinationFields(showToastOnSuccess) {
    if (
      !dom.destinationCity ||
      !dom.destinationCountryCode ||
      !dom.destinationLat ||
      !dom.destinationLon
    ) {
      return false;
    }

    const city = dom.destinationCity.value.trim();
    if (!city) {
      setAutoFillHint(
        "Enter a city first to auto fill location details.",
        true,
      );
      return false;
    }

    if (dom.autoFillLocationBtn) {
      dom.autoFillLocationBtn.disabled = true;
      dom.autoFillLocationBtn.textContent = "Finding...";
    }

    try {
      const geo = await fetchCityGeo(city);
      if (!geo) {
        setAutoFillHint(
          "No location found. Try a more specific city name.",
          true,
        );
        return false;
      }

      dom.destinationCountryCode.value =
        geo.countryCode || dom.destinationCountryCode.value;
      dom.destinationLat.value = Number(geo.lat).toFixed(5);
      dom.destinationLon.value = Number(geo.lon).toFixed(5);
      setAutoFillHint(
        "Location details auto-filled. You can still edit manually.",
        false,
      );

      if (showToastOnSuccess) {
        showToast("Location auto-filled", "ok");
      }
      return true;
    } catch (error) {
      setAutoFillHint(error.message || "Could not auto fill location", true);
      if (showToastOnSuccess) {
        showToast(error.message || "Could not auto fill location", "err");
      }
      return false;
    } finally {
      if (dom.autoFillLocationBtn) {
        dom.autoFillLocationBtn.disabled = false;
        dom.autoFillLocationBtn.textContent = "Auto Fill Location";
      }
    }
  }

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

  function renderTrips() {
    if (!dom.tripList || !dom.tripCount) return;

    dom.tripList.innerHTML = "";
    dom.tripCount.textContent = String(state.trips.length);

    if (!state.trips.length) {
      dom.tripList.innerHTML =
        '<div class="meta-text">No trips yet. Create your first one.</div>';
      return;
    }

    state.trips.forEach((trip) => {
      const item = document.createElement("article");
      item.className = `trip-item${trip.trip_id === state.selectedTripId ? " active" : ""}`;
      item.innerHTML = `
        <div class="trip-item-head">
          <div class="trip-name">${escapeHtml(trip.trip_name)}</div>
          <span class="travel-badge">${escapeHtml(trip.status)}</span>
        </div>
        <div class="trip-sub">${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}</div>
        <div class="trip-sub">${trip.destination_count || 0} destination(s)</div>
        <div class="trip-actions">
          <button class="action-btn" data-action="open" data-id="${trip.trip_id}">Open</button>
          <button class="action-btn danger" data-action="delete" data-id="${trip.trip_id}">Delete</button>
        </div>
      `;
      dom.tripList.appendChild(item);
    });
  }

  function renderTripMeta() {
    if (!dom.tripMeta || !dom.selectedTripStatus || !dom.tripStatusSelect)
      return;
    const trip = state.selectedTrip;
    if (!trip) {
      dom.tripMeta.className = "trip-meta empty";
      dom.tripMeta.textContent =
        "Select a trip from the left to manage destinations and packing.";
      dom.selectedTripStatus.textContent = "No trip selected";
      return;
    }

    dom.tripMeta.className = "trip-meta";
    dom.tripMeta.innerHTML = `
      <div><strong>${escapeHtml(trip.trip_name)}</strong></div>
      <div class="meta-text">${escapeHtml(trip.description || "No description")}</div>
      <div class="meta-text">${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}</div>
    `;
    dom.selectedTripStatus.textContent = trip.status;
    dom.tripStatusSelect.value = trip.status;
  }

  function renderDestinations() {
    if (!dom.destinationList || !dom.destinationCount) return;

    const list = (state.details && state.details.destinations) || [];
    dom.destinationCount.textContent = String(list.length);
    dom.destinationList.innerHTML = "";

    if (!state.selectedTripId) {
      dom.destinationList.innerHTML =
        '<div class="meta-text">Select a trip to view destinations.</div>';
      return;
    }

    if (!list.length) {
      dom.destinationList.innerHTML =
        '<div class="meta-text">No destinations added yet.</div>';
      return;
    }

    list
      .slice()
      .sort((a, b) => Number(a.stop_order || 0) - Number(b.stop_order || 0))
      .forEach((d) => {
        const latestSnapshot =
          Array.isArray(d.weather_snapshots) && d.weather_snapshots.length
            ? d.weather_snapshots[0]
            : null;

        const el = document.createElement("article");
        el.className = "destination-item";
        el.innerHTML = `
          <div class="destination-top">
            <div>
              <div class="destination-city">${escapeHtml(d.city_name)}${d.country_code ? `, ${escapeHtml(d.country_code)}` : ""}</div>
              <div class="destination-sub">Stop ${d.stop_order || "-"} • ${formatDate(d.arrival_date)} - ${formatDate(d.departure_date)}</div>
            </div>
            <button class="action-btn danger" data-action="delete-destination" data-id="${d.destination_id}">Delete</button>
          </div>
          <div class="destination-sub">Lat ${Number(d.latitude).toFixed(3)}, Lon ${Number(d.longitude).toFixed(3)}</div>
          ${latestSnapshot ? `<div class="destination-sub">Weather: ${escapeHtml(latestSnapshot.condition_text || "-")} • ${Math.round(latestSnapshot.temp_min || 0)}° to ${Math.round(latestSnapshot.temp_max || 0)}°</div>` : '<div class="destination-sub">No weather snapshot yet</div>'}
        `;
        dom.destinationList.appendChild(el);
      });
  }

  function renderPacking() {
    if (!dom.packingList) return;

    const list = (state.details && state.details.packing_items) || [];
    dom.packingList.innerHTML = "";

    if (!state.selectedTripId) {
      dom.packingList.innerHTML =
        '<div class="meta-text">Select a trip to manage packing.</div>';
      return;
    }

    if (!list.length) {
      dom.packingList.innerHTML =
        '<div class="meta-text">No packing items yet.</div>';
      return;
    }

    list.forEach((item) => {
      const el = document.createElement("article");
      el.className = `packing-item${item.is_packed ? " done" : ""}`;
      el.innerHTML = `
        <div class="packing-top">
          <div>
            <div class="packing-name">${escapeHtml(item.item_name)}</div>
            <div class="meta-text">${escapeHtml(item.category)}${item.weather_suggested ? " • weather suggested" : ""}</div>
          </div>
          <div class="packing-actions">
            <button class="action-btn" data-action="toggle-packing" data-id="${item.item_id}">${item.is_packed ? "Unpack" : "Pack"}</button>
            <button class="action-btn danger" data-action="delete-packing" data-id="${item.item_id}">Delete</button>
          </div>
        </div>
      `;
      dom.packingList.appendChild(el);
    });
  }

  function renderAlerts() {
    if (!dom.alertsList || !dom.alertCount) return;

    dom.alertsList.innerHTML = "";
    dom.alertCount.textContent = String(state.alerts.length);

    if (!state.alerts.length) {
      dom.alertsList.innerHTML =
        '<div class="meta-text">No unread alerts.</div>';
      return;
    }

    state.alerts.forEach((alert) => {
      const el = document.createElement("article");
      el.className = `alert-item severity-${alert.severity}`;
      el.innerHTML = `
        <div class="alert-top">
          <strong>${escapeHtml((alert.alert_type || "alert").replace("_", " "))}</strong>
          <span class="travel-badge">${escapeHtml(alert.severity)}</span>
        </div>
        <div class="alert-msg">${escapeHtml(alert.alert_message || "")}</div>
        <div class="trip-actions">
          <button class="action-btn" data-action="mark-alert" data-id="${alert.alert_id}">Mark read</button>
        </div>
      `;
      dom.alertsList.appendChild(el);
    });

    updateSummaryStats();
  }

  async function loadTrips() {
    const payload = await api("/trips");
    state.trips = payload.data.trips || [];

    if (
      state.selectedTripId &&
      !state.trips.find((t) => t.trip_id === state.selectedTripId)
    ) {
      state.selectedTripId = null;
      state.selectedTrip = null;
      state.details = null;
    }

    if (!state.selectedTripId && state.trips.length) {
      state.selectedTripId = state.trips[0].trip_id;
    }

    renderTrips();
  }

  async function loadTripDetails(tripId) {
    if (!tripId) {
      state.selectedTrip = null;
      state.details = null;
      renderTripMeta();
      renderDestinations();
      renderPacking();
      updateFormLockState();
      updateSummaryStats();
      return;
    }

    const payload = await api(`/trips/${tripId}`);
    state.details = payload.data;
    state.selectedTrip = payload.data.trip || null;

    renderTripMeta();
    renderDestinations();
    renderPacking();
    updateFormLockState();
    updateSummaryStats();
  }

  async function loadAlerts() {
    const payload = await api("/alerts");
    state.alerts = payload.data.alerts || [];
    renderAlerts();
    updateSummaryStats();
  }

  async function refreshAll() {
    await loadTrips();
    await loadTripDetails(state.selectedTripId);
    await loadAlerts();
  }

  function initNav() {
    if (dom.hamburger && dom.mobileMenu) {
      dom.hamburger.addEventListener("click", function () {
        dom.mobileMenu.classList.toggle("active");
        dom.hamburger.classList.toggle("active");
      });

      dom.mobileMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", function () {
          dom.mobileMenu.classList.remove("active");
          dom.hamburger.classList.remove("active");
        });
      });
    }

    const token = getToken();
    if (!token) return;

    document.querySelectorAll('a[href="login.html"]').forEach((link) => {
      link.textContent = "Logout";
      link.href = "#";
      link.addEventListener("click", function (event) {
        event.preventDefault();
        if (cfg && typeof cfg.clearToken === "function") cfg.clearToken();
        localStorage.removeItem("sp_user");
        window.location.href = "login.html";
      });
    });
  }

  function bindEvents() {
    if (
      !dom.refreshAllBtn ||
      !dom.runAlertsBtn ||
      !dom.createTripForm ||
      !dom.tripList ||
      !dom.updateTripStatusBtn ||
      !dom.deleteTripBtn ||
      !dom.addDestinationForm ||
      !dom.destinationList ||
      !dom.addPackingForm ||
      !dom.suggestPackingBtn ||
      !dom.packingList ||
      !dom.alertsList ||
      !dom.destinationCity ||
      !dom.destinationLat ||
      !dom.destinationLon
    ) {
      return;
    }

    if (dom.autoFillLocationBtn) {
      dom.autoFillLocationBtn.addEventListener("click", async function () {
        await autoFillDestinationFields(true);
      });
    }

    dom.destinationCity.addEventListener("blur", async function () {
      const latEmpty = !String(dom.destinationLat.value || "").trim();
      const lonEmpty = !String(dom.destinationLon.value || "").trim();
      if (latEmpty || lonEmpty) {
        await autoFillDestinationFields(false);
      }
    });

    dom.refreshAllBtn.addEventListener("click", async function () {
      try {
        await refreshAll();
        showToast("Travel data refreshed", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.runAlertsBtn.addEventListener("click", async function () {
      try {
        const payload = await api("/alerts/check", { method: "POST" });
        await loadAlerts();
        showToast(payload.message || "Alert check complete", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.createTripForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      try {
        const payload = await api("/trips", {
          method: "POST",
          body: {
            trip_name: dom.tripName.value,
            description: dom.tripDescription.value,
            start_date: dom.tripStartDate.value,
            end_date: dom.tripEndDate.value,
          },
        });

        dom.createTripForm.reset();
        state.selectedTripId = payload.data.trip.trip_id;
        await refreshAll();
        showToast("Trip created", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.tripList.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const action = target.getAttribute("data-action");
      const id = Number.parseInt(target.getAttribute("data-id") || "", 10);
      if (Number.isNaN(id)) return;

      try {
        if (action === "open") {
          state.selectedTripId = id;
          renderTrips();
          await loadTripDetails(id);
          return;
        }

        if (action === "delete") {
          await api(`/trips/${id}`, { method: "DELETE" });
          if (state.selectedTripId === id) {
            state.selectedTripId = null;
          }
          await refreshAll();
          showToast("Trip deleted", "ok");
        }
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.updateTripStatusBtn.addEventListener("click", async function () {
      if (!state.selectedTripId) return;
      try {
        await api(`/trips/${state.selectedTripId}`, {
          method: "PUT",
          body: { status: dom.tripStatusSelect.value },
        });
        await refreshAll();
        showToast("Trip status updated", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.deleteTripBtn.addEventListener("click", async function () {
      if (!state.selectedTripId) return;
      try {
        await api(`/trips/${state.selectedTripId}`, { method: "DELETE" });
        state.selectedTripId = null;
        await refreshAll();
        showToast("Trip deleted", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.addDestinationForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.selectedTripId) return;

      const latMissing = !String(dom.destinationLat.value || "").trim();
      const lonMissing = !String(dom.destinationLon.value || "").trim();
      if (latMissing || lonMissing) {
        await autoFillDestinationFields(false);
      }

      if (
        !String(dom.destinationLat.value || "").trim() ||
        !String(dom.destinationLon.value || "").trim()
      ) {
        setAutoFillHint(
          "Latitude and longitude are required. Use Auto Fill Location or enter manually.",
          true,
        );
        showToast("Please complete destination location details", "err");
        return;
      }

      try {
        await api(`/trips/${state.selectedTripId}/destinations`, {
          method: "POST",
          body: {
            city_name: dom.destinationCity.value,
            country_code: dom.destinationCountryCode.value,
            lat: dom.destinationLat.value,
            lon: dom.destinationLon.value,
            arrival_date: dom.destinationArrival.value || null,
            departure_date: dom.destinationDeparture.value || null,
            notes: dom.destinationNotes.value,
          },
        });

        dom.addDestinationForm.reset();
        setAutoFillHint(
          "Use city name to fill country code, latitude, and longitude.",
          false,
        );
        await loadTripDetails(state.selectedTripId);
        await loadTrips();
        showToast("Destination added", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.destinationList.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.getAttribute("data-action") !== "delete-destination") return;

      const id = Number.parseInt(target.getAttribute("data-id") || "", 10);
      if (Number.isNaN(id) || !state.selectedTripId) return;

      try {
        await api(`/destinations/${id}`, { method: "DELETE" });
        await loadTripDetails(state.selectedTripId);
        await loadTrips();
        showToast("Destination removed", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.addPackingForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.selectedTripId) return;

      try {
        await api(`/trips/${state.selectedTripId}/packing`, {
          method: "POST",
          body: {
            item_name: dom.packingItemName.value,
            category: dom.packingCategory.value,
          },
        });

        dom.addPackingForm.reset();
        await loadTripDetails(state.selectedTripId);
        showToast("Packing item added", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.suggestPackingBtn.addEventListener("click", async function () {
      if (!state.selectedTripId) return;

      try {
        const payload = await api(
          `/trips/${state.selectedTripId}/packing/suggest`,
          { method: "POST" },
        );
        await loadTripDetails(state.selectedTripId);
        const inserted = payload.data.inserted_items
          ? payload.data.inserted_items.length
          : 0;
        showToast(`Suggestions generated (${inserted} added)`, "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.packingList.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-action");
      const id = Number.parseInt(target.getAttribute("data-id") || "", 10);
      if (Number.isNaN(id) || !state.selectedTripId) return;

      try {
        if (action === "toggle-packing") {
          await api(`/packing/${id}/toggle`, { method: "PUT" });
          await loadTripDetails(state.selectedTripId);
          return;
        }

        if (action === "delete-packing") {
          await api(`/packing/${id}`, { method: "DELETE" });
          await loadTripDetails(state.selectedTripId);
          showToast("Packing item removed", "ok");
        }
      } catch (error) {
        showToast(error.message, "err");
      }
    });

    dom.alertsList.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.getAttribute("data-action") !== "mark-alert") return;
      const id = Number.parseInt(target.getAttribute("data-id") || "", 10);
      if (Number.isNaN(id)) return;

      try {
        await api(`/alerts/${id}/read`, { method: "PUT" });
        await loadAlerts();
        showToast("Alert marked as read", "ok");
      } catch (error) {
        showToast(error.message, "err");
      }
    });
  }

  async function init() {
    initTimeBackground();
    initNav();

    const token = getToken();
    const isAuthed = Boolean(token && token.trim());
    setAuthState(isAuthed);

    if (!isAuthed) return;

    updateFormLockState();
    bindEvents();

    try {
      await refreshAll();
    } catch (error) {
      showToast(error.message || "Failed to load travel data", "err");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
