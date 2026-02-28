/* ============================================
   ANIMATIONS.JS - Framer Motion-Inspired
   Animation Engine with Spring Physics,
   Stagger, Magnetic, 3D Tilt, Cursor Gradient,
   Scroll-Linked Parallax, Morphing Numbers, etc.
   ============================================ */

(function () {
  "use strict";

  // ============ SPRING PHYSICS ENGINE ============
  class Spring {
    constructor(config = {}) {
      this.stiffness = config.stiffness || 100;
      this.damping = config.damping || 10;
      this.mass = config.mass || 1;
      this.velocity = 0;
      this.value = config.from || 0;
      this.target = config.to || 1;
      this.onUpdate = config.onUpdate || (() => {});
      this.onComplete = config.onComplete || (() => {});
      this._raf = null;
      this._settled = false;
    }

    start() {
      this._settled = false;
      const step = () => {
        const displacement = this.value - this.target;
        const springForce = -this.stiffness * displacement;
        const dampingForce = -this.damping * this.velocity;
        const acceleration = (springForce + dampingForce) / this.mass;
        this.velocity += acceleration * 0.016;
        this.value += this.velocity * 0.016;
        this.onUpdate(this.value);

        if (
          Math.abs(this.velocity) < 0.001 &&
          Math.abs(this.value - this.target) < 0.001
        ) {
          this.value = this.target;
          this.onUpdate(this.value);
          this.onComplete();
          this._settled = true;
          return;
        }
        this._raf = requestAnimationFrame(step);
      };
      this._raf = requestAnimationFrame(step);
      return this;
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
    }
  }

  // ============ SCROLL-LINKED REVEAL (Framer-style) ============
  function initScrollReveal() {
    const reveals = document.querySelectorAll(
      ".reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .reveal-blur",
    );
    if (!reveals.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Stagger delay based on data attribute or siblings
            const delay = entry.target.dataset.delay || 0;
            setTimeout(() => {
              entry.target.classList.add("visible");

              // Spring-animated entrance for cards with .spring-enter
              if (entry.target.classList.contains("spring-enter")) {
                springEnter(entry.target);
              }
            }, delay);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    reveals.forEach((el) => observer.observe(el));
  }

  function springEnter(el) {
    el.style.willChange = "transform, opacity";
    new Spring({
      stiffness: 120,
      damping: 14,
      mass: 1,
      from: 0,
      to: 1,
      onUpdate: (v) => {
        el.style.transform = `translateY(${(1 - v) * 30}px) scale(${0.92 + v * 0.08})`;
        el.style.opacity = v;
      },
      onComplete: () => {
        el.style.willChange = "";
        el.style.transform = "";
        el.style.opacity = "";
      },
    }).start();
  }

  // ============ STAGGER CHILDREN (auto-delay) ============
  function initStaggerReveal() {
    const containers = document.querySelectorAll(
      ".stagger-children, .stagger-grid",
    );
    containers.forEach((container) => {
      const children = container.querySelectorAll(
        ".reveal, .reveal-left, .reveal-right, .reveal-scale, .spring-enter, [class*='reveal']",
      );
      children.forEach((child, i) => {
        child.dataset.delay = i * 80;
      });
    });
  }

  // ============ COUNTER / NUMBER MORPHING ============
  function initCounters() {
    const counters = document.querySelectorAll("[data-target]");
    if (!counters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );

    counters.forEach((el) => observer.observe(el));
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const duration = 2000;
    const start = performance.now();
    const isDecimal = target % 1 !== 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = isDecimal ? target.toFixed(1) : target;
      }
    }
    requestAnimationFrame(update);
  }

  // ============ 3D TILT + SPOTLIGHT EFFECT ============
  function initTiltEffect() {
    const cards = document.querySelectorAll(".tilt-card, .glass-card");

    cards.forEach((card) => {
      // Create spotlight overlay
      const spotlight = document.createElement("div");
      spotlight.className = "card-spotlight";
      card.style.position = card.style.position || "relative";
      card.style.overflow = "hidden";
      card.appendChild(spotlight);

      let bounds;
      let rafId = null;

      card.addEventListener("mouseenter", () => {
        bounds = card.getBoundingClientRect();
        spotlight.style.opacity = "1";
      });

      card.addEventListener("mousemove", (e) => {
        if (!bounds) bounds = card.getBoundingClientRect();
        const x = e.clientX - bounds.left;
        const y = e.clientY - bounds.top;
        const centerX = bounds.width / 2;
        const centerY = bounds.height / 2;
        const rotateX = ((y - centerY) / centerY) * -4;
        const rotateY = ((x - centerX) / centerX) * 4;

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
          spotlight.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(255,255,255,0.06), transparent 40%)`;
        });
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        spotlight.style.opacity = "0";
        bounds = null;
      });
    });
  }

  // ============ MAGNETIC BUTTONS / ELEMENTS ============
  function initMagnetic() {
    const magnets = document.querySelectorAll(
      ".magnetic, .theme-toggle, .nav-logo",
    );

    magnets.forEach((el) => {
      let bounds;

      el.addEventListener("mouseenter", () => {
        bounds = el.getBoundingClientRect();
      });

      el.addEventListener("mousemove", (e) => {
        if (!bounds) return;
        const x = e.clientX - bounds.left - bounds.width / 2;
        const y = e.clientY - bounds.top - bounds.height / 2;
        const strength = el.dataset.magnetStrength || 0.35;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
        el.style.transition =
          "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
        setTimeout(() => {
          el.style.transition = "";
        }, 500);
      });
    });
  }

  // ============ PARALLAX MOUSE + SECTIONS ============
  function initParallax() {
    const bg = document.getElementById("animatedBg");

    document.addEventListener("mousemove", (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;

      if (bg) {
        const orbs = bg.querySelectorAll(".bg-orb");
        orbs.forEach((orb, i) => {
          const speed = (i + 1) * 8;
          orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
      }
    });

    // Scroll parallax for sections
    const parallaxEls = document.querySelectorAll("[data-parallax]");
    if (parallaxEls.length) {
      window.addEventListener(
        "scroll",
        () => {
          const scrollY = window.scrollY;
          parallaxEls.forEach((el) => {
            const speed = parseFloat(el.dataset.parallax) || 0.1;
            const rect = el.getBoundingClientRect();
            const offset =
              (rect.top + scrollY - window.innerHeight / 2) * speed;
            el.style.transform = `translateY(${-offset}px)`;
          });
        },
        { passive: true },
      );
    }
  }

  // ============ STARFIELD ============
  function initStarfield() {
    const starfield = document.getElementById("starfield");
    if (!starfield) return;
    starfield.innerHTML = "";

    const count = 80;
    for (let i = 0; i < count; i++) {
      const star = document.createElement("div");
      star.className = "star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.width = `${Math.random() * 2 + 1}px`;
      star.style.height = star.style.width;
      star.style.animationDelay = `${Math.random() * 3}s`;
      star.style.animationDuration = `${Math.random() * 3 + 2}s`;
      starfield.appendChild(star);
    }
  }

  // ============ FLOATING PARTICLES ============
  function initParticles() {
    const container = document.getElementById("particles");
    if (!container) return;

    function createParticle() {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${60 + Math.random() * 40}%`;
      particle.style.animationDuration = `${Math.random() * 4 + 5}s`;
      particle.style.animationDelay = `${Math.random() * 2}s`;
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 10000);
    }

    for (let i = 0; i < 15; i++) {
      setTimeout(() => createParticle(), i * 400);
    }
    setInterval(createParticle, 2000);
  }

  // ============ CURSOR GLOW ============
  function initCursorGlow() {
    const glow = document.getElementById("cursorGlow");
    if (!glow || "ontouchstart" in window) {
      if (glow) glow.style.display = "none";
      return;
    }

    let mouseX = 0,
      mouseY = 0,
      glowX = 0,
      glowY = 0;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function updateGlow() {
      glowX += (mouseX - glowX) * 0.12;
      glowY += (mouseY - glowY) * 0.12;
      glow.style.left = `${glowX}px`;
      glow.style.top = `${glowY}px`;
      requestAnimationFrame(updateGlow);
    }
    updateGlow();
  }

  // ============ SCROLL PROGRESS BAR ============
  function initScrollProgress() {
    const bar = document.getElementById("scrollProgress");
    if (!bar) return;

    window.addEventListener(
      "scroll",
      () => {
        const scrollTop = window.scrollY;
        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = `${(scrollTop / docHeight) * 100}%`;
      },
      { passive: true },
    );
  }

  // ============ NAVBAR SCROLL ============
  function initNavbarScroll() {
    const navbar = document.getElementById("navbar");
    if (!navbar) return;

    window.addEventListener(
      "scroll",
      () => {
        navbar.classList.toggle("scrolled", window.scrollY > 50);
      },
      { passive: true },
    );
  }

  // ============ BUTTON RIPPLE ============
  function initRippleEffect() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn, .theme-toggle");
      if (!btn) return;

      const ripple = document.createElement("span");
      ripple.className = "ripple";
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.style.position = btn.style.position || "relative";
      btn.style.overflow = "hidden";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  // ============ SMOOTH SCROLL VELOCITY (Lenis-like) ============
  function initSmoothScrollVelocity() {
    // Add scroll velocity class for CSS scroll-linked animations
    let lastScroll = 0;
    let ticking = false;

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            const velocity = Math.abs(window.scrollY - lastScroll);
            document.body.style.setProperty(
              "--scroll-velocity",
              Math.min(velocity / 10, 1),
            );
            lastScroll = window.scrollY;
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true },
    );
  }

  // ============ TEXT SPLIT + CHAR ANIMATION ============
  function initTextReveal() {
    const textEls = document.querySelectorAll(
      ".text-reveal, .text-gradient-reveal",
    );
    textEls.forEach((el) => {
      const text = el.textContent;
      el.textContent = "";
      el.setAttribute("aria-label", text);

      text.split("").forEach((char, i) => {
        const span = document.createElement("span");
        span.className = "char-reveal";
        span.textContent = char === " " ? "\u00A0" : char;
        span.style.animationDelay = `${i * 0.03}s`;
        el.appendChild(span);
      });

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              el.classList.add("text-animate");
              observer.unobserve(el);
            }
          });
        },
        { threshold: 0.3 },
      );
      observer.observe(el);
    });
  }

  // ============ HOVER CARD GLOW BORDER ============
  function initGlowBorder() {
    const cards = document.querySelectorAll(".hover-glow");

    cards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty("--glow-x", `${x}px`);
        card.style.setProperty("--glow-y", `${y}px`);
      });
    });
  }

  // ============ SECTION HEADER PARALLAX TITLES ============
  function initSectionParallax() {
    const headers = document.querySelectorAll(".section-title");
    if (!headers.length) return;

    window.addEventListener(
      "scroll",
      () => {
        headers.forEach((h) => {
          const rect = h.getBoundingClientRect();
          const viewH = window.innerHeight;
          if (rect.top < viewH && rect.bottom > 0) {
            const progress = (viewH - rect.top) / (viewH + rect.height);
            const x = (progress - 0.5) * -20;
            h.style.transform = `translateX(${x}px)`;
          }
        });
      },
      { passive: true },
    );
  }

  // ============ PAGE TRANSITION ============
  function initPageTransition() {
    const overlay = document.getElementById("pageTransition");
    if (!overlay) return;

    window.addEventListener("load", () => {
      setTimeout(() => overlay.classList.add("loaded"), 100);
    });

    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript") ||
        href.startsWith("mailto")
      )
        return;
      if (link.target === "_blank") return;

      link.addEventListener("click", (e) => {
        e.preventDefault();
        overlay.classList.remove("loaded");
        setTimeout(() => {
          window.location.href = href;
        }, 400);
      });
    });
  }

  // ============ SMOOTH ANCHOR SCROLL ============
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute("href"));
        if (target)
          target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ============ ANIMATED GRADIENT BORDER FOR CARDS ============
  function initAnimatedBorders() {
    const cards = document.querySelectorAll(
      ".today-card, .trend-card, .aqi-card, .precip-card",
    );
    cards.forEach((card) => {
      card.classList.add("animated-border");
    });
  }

  // ============ DOCK MAGNIFICATION ============
  function initDockNav() {
    const dock = document.querySelector(".dock-nav");
    if (!dock) return;

    const items = dock.querySelectorAll(".dock-item");
    if (!items.length) return;

    const BASE_SCALE = 1;
    const MAX_SCALE = 1.25;
    const NEIGHBOR_SCALE = 1.1;
    const RANGE = 120; // px radius of influence

    function resetItems() {
      items.forEach((item) => {
        item.style.transform = `scale(${BASE_SCALE})`;
      });
    }

    dock.addEventListener("mousemove", (e) => {
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.left + rect.width / 2;
        const dist = Math.abs(e.clientX - itemCenter);

        if (dist < RANGE) {
          const ratio = 1 - dist / RANGE;
          const scale =
            BASE_SCALE + (MAX_SCALE - BASE_SCALE) * Math.pow(ratio, 2);
          item.style.transform = `scale(${scale}) translateY(${ratio * 6}px)`;
        } else {
          item.style.transform = `scale(${BASE_SCALE})`;
        }
      });
    });

    dock.addEventListener("mouseleave", resetItems);
  }

  // ============ INITIALIZE ALL ============
  function init() {
    initStaggerReveal(); // Must run before scrollReveal
    initScrollReveal();
    initCounters();
    initTiltEffect();
    initMagnetic();
    initParallax();
    initStarfield();
    initParticles();
    initCursorGlow();
    initScrollProgress();
    initNavbarScroll();
    initRippleEffect();
    initTextReveal();
    initGlowBorder();
    initSectionParallax();
    initSmoothScrollVelocity();
    initPageTransition();
    initSmoothScroll();
    initAnimatedBorders();
    initDockNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SkyPulseAnimations = {
    initScrollReveal,
    initCounters,
    animateCounter,
    Spring,
  };
})();
