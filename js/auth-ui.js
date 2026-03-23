(function () {
  "use strict";

  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const authMessage = document.getElementById("authMessage");

  if (!loginTab || !registerTab || !loginForm || !registerForm || !authMessage) {
    return;
  }

  const API_BASE =
    (window.SkyPulseConfig && window.SkyPulseConfig.API && window.SkyPulseConfig.API.auth) ||
    "http://localhost:5000/api/auth";

  function setMessage(text, type) {
    authMessage.textContent = text || "";
    authMessage.classList.remove("success", "error");

    if (type) {
      authMessage.classList.add(type);
    }
  }

  function setTab(mode) {
    const isLogin = mode === "login";

    loginTab.classList.toggle("active", isLogin);
    registerTab.classList.toggle("active", !isLogin);
    loginTab.setAttribute("aria-selected", String(isLogin));
    registerTab.setAttribute("aria-selected", String(!isLogin));

    loginForm.style.display = isLogin ? "grid" : "none";
    registerForm.style.display = isLogin ? "none" : "grid";
    setMessage("");
  }

  async function parseResponse(response) {
    const data = await response.json().catch(function () {
      return { success: false, message: "Unexpected response" };
    });

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  function persistAuth(data) {
    if (!data || !data.token || !data.user) {
      return;
    }

    if (window.SkyPulseConfig && typeof window.SkyPulseConfig.setToken === "function") {
      window.SkyPulseConfig.setToken(data.token);
    } else {
      localStorage.setItem("token", data.token);
      localStorage.setItem("sp_token", data.token);
    }
    localStorage.setItem("sp_user", JSON.stringify(data.user));
  }

  loginTab.addEventListener("click", function () {
    setTab("login");
  });

  registerTab.addEventListener("click", function () {
    setTab("register");
  });

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      setMessage("Email and password are required.", "error");
      return;
    }

    setMessage("Signing you in...");

    try {
      const response = await fetch(API_BASE + "/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email, password: password }),
      });

      const payload = await parseResponse(response);
      persistAuth(payload.data);
      setMessage("Login successful. Redirecting to home...", "success");

      setTimeout(function () {
        window.location.href = "index.html";
      }, 900);
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const fullName = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    if (!fullName || !email || !password) {
      setMessage("Full name, email, and password are required.", "error");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long.", "error");
      return;
    }

    setMessage("Creating your account...");

    try {
      const response = await fetch(API_BASE + "/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          password: password,
        }),
      });

      const payload = await parseResponse(response);
      persistAuth(payload.data);
      setMessage("Account created successfully. Redirecting to home...", "success");

      setTimeout(function () {
        window.location.href = "index.html";
      }, 900);
    } catch (error) {
      setMessage(error.message, "error");
    }
  });

  setTab("login");
})();
