/* ============================================
   THEME.JS - Dramatic Theme Transition
   Multi-ring circle takeover with particle
   burst, flash, and ripple effects
   ============================================ */

(function () {
  "use strict";

  const THEME_KEY = "skypulse-theme";
  const html = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const overlay = document.getElementById("themeOverlay");
  let transitioning = false;

  function ensureTransitionElements() {
    if (!overlay) return null;

    let ttCircle = document.getElementById("ttCircle");
    if (!ttCircle) {
      ttCircle = document.createElement("div");
      ttCircle.id = "ttCircle";
      ttCircle.className = "tt-circle";
      overlay.appendChild(ttCircle);
    }

    let ttFlash = document.getElementById("ttFlash");
    if (!ttFlash) {
      ttFlash = document.createElement("div");
      ttFlash.id = "ttFlash";
      ttFlash.className = "tt-flash";
      overlay.appendChild(ttFlash);
    }

    const requiredRingClasses = ["tt-ring-1", "tt-ring-2", "tt-ring-3"];
    requiredRingClasses.forEach((ringClass) => {
      if (!overlay.querySelector(`.${ringClass}`)) {
        const ring = document.createElement("div");
        ring.className = `tt-ring ${ringClass}`;
        overlay.appendChild(ring);
      }
    });

    return {
      ttCircle,
      ttFlash,
      rings: overlay.querySelectorAll(".tt-ring"),
    };
  }

  // ---------- Initialize Theme ----------
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme, false);
  }

  // ---------- Apply Theme ----------
  function applyTheme(theme, animate = true) {
    if (animate && !transitioning) {
      animateThemeTransition(theme);
    } else if (!animate) {
      html.setAttribute("data-theme", theme);
      updateToggleIcons(theme);
    }
    localStorage.setItem(THEME_KEY, theme);
  }

  // ---------- Toggle ----------
  function toggleTheme() {
    if (transitioning) return;
    const current = html.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next, true);
  }

  // ---------- THE BIG ANIMATED TRANSITION ----------
  function animateThemeTransition(theme) {
    if (!themeToggle || !overlay) {
      html.setAttribute("data-theme", theme);
      updateToggleIcons(theme);
      transitioning = false;
      return;
    }

    const transitionEls = ensureTransitionElements();
    if (!transitionEls) {
      html.setAttribute("data-theme", theme);
      updateToggleIcons(theme);
      transitioning = false;
      return;
    }

    const { ttCircle, rings } = transitionEls;
    transitioning = true;

    const isDark = theme === "dark";
    const circleColor = isDark ? "#000000" : "#ffffff";
    const ringColor = isDark
      ? "rgba(63, 63, 70, 0.4)"
      : "rgba(228, 228, 231, 0.5)";

    // Get origin from toggle button
    const rect = themeToggle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Max radius to cover whole screen
    const maxR = Math.ceil(
      Math.sqrt(
        Math.max(cx, window.innerWidth - cx) ** 2 +
          Math.max(cy, window.innerHeight - cy) ** 2,
      ),
    );

    // Activate overlay
    overlay.classList.add("tt-active");

    // -- Toggle icon spin --
    themeToggle.style.transition =
      "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)";
    themeToggle.style.transform = "rotate(360deg) scale(1.2)";

    // -- Position rings at click origin --
    rings.forEach((ring) => {
      ring.style.left = cx + "px";
      ring.style.top = cy + "px";
      ring.style.borderColor = ringColor;
    });

    // -- Set circle style --
    ttCircle.style.background = circleColor;
    ttCircle.style.left = cx + "px";
    ttCircle.style.top = cy + "px";

    // Phase 1: Expanding rings burst outward (0ms)
    requestAnimationFrame(() => {
      rings.forEach((ring, i) => {
        ring.classList.add("tt-ring-expand");
        ring.style.animationDelay = `${i * 40}ms`;
      });

      // Phase 2: Circle grows to cover screen (50ms)
      setTimeout(() => {
        ttCircle.classList.add("tt-circle-expand");
        ttCircle.style.setProperty("--max-r", maxR + "px");
      }, 50);

      // Phase 3: Switch theme (250ms)
      setTimeout(() => {
        html.setAttribute("data-theme", theme);
        updateToggleIcons(theme);
      }, 250);

      // Phase 4: Cleanup (700ms)
      setTimeout(() => {
        overlay.classList.remove("tt-active");
        ttCircle.classList.remove("tt-circle-expand");
        rings.forEach((ring) => {
          ring.classList.remove("tt-ring-expand");
          ring.style.animationDelay = "";
        });
        themeToggle.style.transition =
          "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)";
        themeToggle.style.transform = "";
        transitioning = false;
      }, 700);
    });
  }

  // ---------- Update Toggle Icons ----------
  function updateToggleIcons(theme) {
    if (!themeToggle) return;

    const sunIcon = themeToggle.querySelector(".sun-icon");
    const moonIcon = themeToggle.querySelector(".moon-icon");

    if (!sunIcon || !moonIcon) return;

    if (theme === "dark") {
      sunIcon.style.opacity = "0";
      sunIcon.style.transform = "rotate(360deg) scale(0)";
      moonIcon.style.opacity = "1";
      moonIcon.style.transform = "rotate(0deg) scale(1)";
    } else {
      sunIcon.style.opacity = "1";
      sunIcon.style.transform = "rotate(0deg) scale(1)";
      moonIcon.style.opacity = "0";
      moonIcon.style.transform = "rotate(-360deg) scale(0)";
    }
  }

  // ---------- Events ----------
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? "dark" : "light", true);
      }
    });

  // ---------- Initialize ----------
  initTheme();

  window.SkyPulseTheme = { toggle: toggleTheme, apply: applyTheme };
})();
