/* ============================================
   VALIDATION.JS - Form Validation with
   Animations, Shake Effects & Success State
   ============================================ */

(function () {
  "use strict";

  const form = document.getElementById("contactForm");
  const successMessage = document.getElementById("successMessage");
  const resetBtn = document.getElementById("resetFormBtn");

  if (!form) return;

  // ---------- Validation Rules ----------
  const rules = {
    firstName: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s'-]+$/,
      messages: {
        required: "First name is required",
        minLength: "Must be at least 2 characters",
        maxLength: "Must be 50 characters or less",
        pattern: "Only letters, spaces, hyphens and apostrophes",
      },
    },
    lastName: {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s'-]+$/,
      messages: {
        required: "Last name is required",
        minLength: "Must be at least 2 characters",
        maxLength: "Must be 50 characters or less",
        pattern: "Only letters, spaces, hyphens and apostrophes",
      },
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      messages: {
        required: "Email address is required",
        pattern: "Please enter a valid email address",
      },
    },
    subject: {
      required: true,
      messages: {
        required: "Please select a subject",
      },
    },
    message: {
      required: true,
      minLength: 10,
      maxLength: 1000,
      messages: {
        required: "Message is required",
        minLength: "Must be at least 10 characters",
        maxLength: "Must be 1000 characters or less",
      },
    },
  };

  // ---------- Validate Single Field ----------
  function validateField(name, value) {
    const rule = rules[name];
    if (!rule) return "";

    const trimmed = value.trim();

    if (rule.required && !trimmed) {
      return rule.messages.required;
    }
    if (rule.minLength && trimmed.length < rule.minLength) {
      return rule.messages.minLength;
    }
    if (rule.maxLength && trimmed.length > rule.maxLength) {
      return rule.messages.maxLength;
    }
    if (rule.pattern && trimmed && !rule.pattern.test(trimmed)) {
      return rule.messages.pattern;
    }

    return "";
  }

  // ---------- Show Error ----------
  function showError(name, message) {
    const input = form.querySelector(`[name="${name}"]`);
    const errorEl = document.getElementById(`${name}Error`);

    if (errorEl) {
      errorEl.textContent = message;
    }

    if (input) {
      input.classList.remove("input-success");
      input.classList.add("input-error");

      // Shake animation
      const wrapper = input.closest(".input-wrapper");
      if (wrapper) {
        wrapper.classList.add("shake");
        setTimeout(() => wrapper.classList.remove("shake"), 500);
      }
    }
  }

  // ---------- Show Success ----------
  function showSuccess(name) {
    const input = form.querySelector(`[name="${name}"]`);
    const errorEl = document.getElementById(`${name}Error`);

    if (errorEl) {
      errorEl.textContent = "";
    }

    if (input) {
      input.classList.remove("input-error");
      input.classList.add("input-success");
    }
  }

  // ---------- Clear Field State ----------
  function clearFieldState(name) {
    const input = form.querySelector(`[name="${name}"]`);
    const errorEl = document.getElementById(`${name}Error`);

    if (errorEl) errorEl.textContent = "";
    if (input) {
      input.classList.remove("input-error", "input-success");
    }
  }

  // ---------- Real-time Validation (on blur) ----------
  const inputs = form.querySelectorAll(".form-input");
  inputs.forEach((input) => {
    // Validate on blur
    input.addEventListener("blur", () => {
      const name = input.name;
      const value = input.value;
      const error = validateField(name, value);

      if (error) {
        showError(name, error);
      } else if (value.trim()) {
        showSuccess(name);
      } else {
        clearFieldState(name);
      }
    });

    // Clear error on focus
    input.addEventListener("focus", () => {
      const name = input.name;
      const errorEl = document.getElementById(`${name}Error`);
      if (errorEl) errorEl.textContent = "";
    });

    // Live validation on input (after first blur)
    input.addEventListener("input", () => {
      const name = input.name;
      if (input.classList.contains("input-error")) {
        const error = validateField(name, input.value);
        if (!error) {
          showSuccess(name);
        }
      }
    });
  });

  // ---------- Form Submit ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    let isValid = true;
    const formData = {};

    // Validate all fields
    Object.keys(rules).forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) return;

      const value = input.value;
      formData[name] = value;
      const error = validateField(name, value);

      if (error) {
        showError(name, error);
        isValid = false;
      } else {
        showSuccess(name);
      }
    });

    if (!isValid) {
      // Focus first error field
      const firstError = form.querySelector(".input-error");
      if (firstError) {
        firstError.focus();
      }
      return;
    }

    // Simulate submission
    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoader = submitBtn.querySelector(".btn-loader");
    const btnArrow = submitBtn.querySelector(".btn-arrow");

    // Show loading state
    btnText.textContent = "Sending...";
    btnLoader.style.display = "inline-flex";
    btnArrow.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";

    // Simulate network delay
    setTimeout(() => {
      // Hide form, show success
      form.style.display = "none";
      successMessage.style.display = "block";

      // Log form data (mock)
      console.log("Form submitted:", formData);
    }, 1500);
  });

  // ---------- Reset Form ----------
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      successMessage.style.display = "none";
      form.style.display = "block";

      // Reset button state
      const submitBtn = document.getElementById("submitBtn");
      const btnText = submitBtn.querySelector(".btn-text");
      const btnLoader = submitBtn.querySelector(".btn-loader");
      const btnArrow = submitBtn.querySelector(".btn-arrow");

      btnText.textContent = "Send Message";
      btnLoader.style.display = "none";
      btnArrow.style.display = "inline";
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";

      // Clear all field states
      Object.keys(rules).forEach((name) => clearFieldState(name));
    });
  }

  // ---------- FAQ Accordion (Contact page) ----------
  const faqQuestions = document.querySelectorAll(".faq-question");
  faqQuestions.forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const answer = btn.nextElementSibling;

      // Close all
      faqQuestions.forEach((q) => {
        q.setAttribute("aria-expanded", "false");
        q.nextElementSibling.classList.remove("open");
      });

      // Open clicked (if was closed)
      if (!expanded) {
        btn.setAttribute("aria-expanded", "true");
        answer.classList.add("open");
      }
    });
  });
})();
