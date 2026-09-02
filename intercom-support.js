(() => {
  "use strict";

  const APP_ID = "v8fbftfu";
  const API_BASE = "https://api-iam.intercom.io";
  const CONSENT_COOKIE = "introd.analytics-consent";
  const CONSENT_EVENT = "introd:analytics-consent-changed";
  const CONSENT_SYNC_KEY = "introd.analytics-consent-sync";
  const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
  const INTERCOM_SCRIPT_ID = "introd-intercom-loader";
  const INTERCOM_SCRIPT_URL = `https://widget.intercom.io/widget/${APP_ID}`;
  const ROOT_ID = "introd-support-controls";
  const SETTINGS_HASH = "#introd-cookie-settings";
  const INTERCOM_SETTINGS = Object.freeze({
    api_base: API_BASE,
    app_id: APP_ID,
    hide_default_launcher: true,
  });

  let loaderRequested = false;
  let loaderReady = false;
  let intercomBooted = false;
  let pendingOpen = false;
  let openChatAfterConsent = false;
  let previousConsent;
  let previousPath = window.location.pathname;
  let controls;
  let dialogInvoker;

  function privacySignalActive() {
    const doNotTrack = window.navigator.doNotTrack;
    return (
      window.navigator.globalPrivacyControl === true ||
      doNotTrack === "1" ||
      doNotTrack === "yes"
    );
  }

  function readStoredConsent() {
    const prefix = `${CONSENT_COOKIE}=`;
    const value = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);

    return value === "granted" || value === "denied" ? value : null;
  }

  function effectiveConsent() {
    return privacySignalActive() ? "denied" : readStoredConsent();
  }

  function sharedCookieAttributes() {
    const isIntrodDomain =
      window.location.hostname === "getintrod.ai" ||
      window.location.hostname.endsWith(".getintrod.ai");
    const domain = isIntrodDomain ? "; Domain=.getintrod.ai" : "";
    const secure = window.location.protocol === "https:" ? "; Secure" : "";

    return `; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${domain}${secure}`;
  }

  function notifyConsentChange(consent) {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { consent } }));
    try {
      window.localStorage.setItem(CONSENT_SYNC_KEY, consent);
      window.localStorage.removeItem(CONSENT_SYNC_KEY);
    } catch {
      // The shared first-party cookie and same-tab event remain authoritative.
    }
  }

  function writeConsent(consent) {
    document.cookie = `${CONSENT_COOKIE}=${consent}${sharedCookieAttributes()}`;
    try {
      window.localStorage.removeItem("introd.cookie-consent");
    } catch {
      // The shared first-party cookie remains authoritative.
    }
    notifyConsentChange(privacySignalActive() ? "denied" : consent);
    synchronizeConsent();
  }

  function clearIntercomCookies() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const isIntrodDomain =
      window.location.hostname === "getintrod.ai" ||
      window.location.hostname.endsWith(".getintrod.ai");
    const cookieNames = document.cookie
      .split(";")
      .map((part) => part.trim().split("=", 1)[0])
      .filter((name) => name.startsWith("intercom-"));

    for (const name of cookieNames) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
      if (isIntrodDomain) {
        document.cookie = `${name}=; Path=/; Domain=.getintrod.ai; Max-Age=0; SameSite=Lax${secure}`;
      }
    }
  }

  function callIntercom(command, payload) {
    if (typeof window.Intercom !== "function") return false;
    try {
      if (payload === undefined) window.Intercom(command);
      else window.Intercom(command, payload);
      return true;
    } catch {
      return false;
    }
  }

  function renderState() {
    if (!controls) return;

    const consent = effectiveConsent();
    const privacySignal = privacySignalActive();
    const enabled = consent === "granted";
    controls.allowButton.disabled = privacySignal;
    controls.allowButton.setAttribute("aria-disabled", String(privacySignal));
    controls.essentialButton.disabled = consent === "denied" && !intercomBooted;

    if (privacySignal) {
      controls.message.textContent =
        "Your browser's Global Privacy Control or Do Not Track signal is active, so optional support-chat cookies remain disabled.";
    } else if (enabled) {
      controls.message.textContent =
        "Support chat is enabled. You can switch back to essential cookies at any time.";
    } else {
      controls.message.textContent =
        "With your permission, Introd uses optional cookies to measure traffic and make support chat available. You can ask for a person at any time.";
    }

    controls.supportButton.textContent = enabled && loaderRequested && !loaderReady
      ? "Loading support…"
      : "Support";
    controls.supportButton.setAttribute(
      "aria-label",
      enabled ? "Open Introd support chat" : "View Introd support options",
    );
    controls.status.textContent = enabled && loaderReady
      ? "Support chat is ready."
      : "Email support is always available.";
  }

  function bootIntercom() {
    if (effectiveConsent() !== "granted" || !loaderReady) return;

    if (!intercomBooted) {
      intercomBooted = callIntercom("boot", INTERCOM_SETTINGS);
    }
    renderState();

    if (intercomBooted && pendingOpen) {
      pendingOpen = false;
      callIntercom("show");
    }
  }

  function loadIntercom() {
    if (effectiveConsent() !== "granted") return;
    if (loaderReady) {
      bootIntercom();
      return;
    }
    if (loaderRequested) return;

    loaderRequested = true;
    const script = document.createElement("script");
    script.id = INTERCOM_SCRIPT_ID;
    script.async = true;
    script.src = INTERCOM_SCRIPT_URL;
    script.referrerPolicy = "strict-origin-when-cross-origin";
    script.addEventListener("load", () => {
      loaderReady = true;
      bootIntercom();
    });
    script.addEventListener("error", () => {
      loaderRequested = false;
      loaderReady = false;
      script.remove();
      renderState();
      if (controls) {
        controls.status.textContent =
          "Support chat could not load. Email help@getintrod.ai instead.";
      }
    });
    document.head.append(script);
    renderState();
  }

  function shutdownIntercom() {
    pendingOpen = false;
    if (intercomBooted) {
      callIntercom("hide");
      callIntercom("shutdown");
    }
    intercomBooted = false;
    clearIntercomCookies();
    renderState();
  }

  function synchronizeConsent() {
    const consent = effectiveConsent();
    if (consent === previousConsent) {
      renderState();
      return;
    }

    previousConsent = consent;
    if (consent === "granted") loadIntercom();
    else shutdownIntercom();
    renderState();
  }

  function synchronizeRoute() {
    const currentPath = window.location.pathname;
    if (currentPath === previousPath) return;
    previousPath = currentPath;
    if (intercomBooted) callIntercom("update");
  }

  function openPreferences({ chatAfterConsent = false } = {}) {
    if (!controls) return;
    openChatAfterConsent = chatAfterConsent;
    dialogInvoker = document.activeElement;
    renderState();
    if (!controls.dialog.open) {
      if (typeof controls.dialog.showModal === "function") controls.dialog.showModal();
      else controls.dialog.setAttribute("open", "");
    }
    controls.dialogTitle.focus();
  }

  function closePreferences() {
    if (!controls) return;
    openChatAfterConsent = false;
    if (typeof controls.dialog.close === "function") controls.dialog.close();
    else controls.dialog.removeAttribute("open");
    if (dialogInvoker instanceof HTMLElement) dialogInvoker.focus();
    dialogInvoker = undefined;
  }

  function openSupport() {
    if (effectiveConsent() !== "granted") {
      openPreferences({ chatAfterConsent: true });
      return;
    }

    pendingOpen = true;
    loadIntercom();
    bootIntercom();
  }

  function buildControls() {
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;

    const supportButton = document.createElement("button");
    supportButton.type = "button";
    supportButton.className = "introd-support-button";
    supportButton.addEventListener("click", openSupport);

    const settingsButton = document.createElement("button");
    settingsButton.type = "button";
    settingsButton.className = "introd-cookie-settings-button";
    settingsButton.textContent = "Cookie settings";
    settingsButton.addEventListener("click", () => openPreferences());

    const status = document.createElement("p");
    status.className = "introd-support-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const dialog = document.createElement("dialog");
    dialog.className = "introd-support-dialog";
    dialog.setAttribute("aria-labelledby", "introd-support-dialog-title");
    dialog.setAttribute("aria-describedby", "introd-support-dialog-description");

    const dialogTitle = document.createElement("h2");
    dialogTitle.id = "introd-support-dialog-title";
    dialogTitle.tabIndex = -1;
    dialogTitle.textContent = "Support and cookie settings";

    const message = document.createElement("p");
    message.id = "introd-support-dialog-description";

    const safety = document.createElement("p");
    safety.className = "introd-support-safety";
    safety.textContent =
      "Do not share passwords, authentication codes, payment details, access tokens, or private contact, calendar, relationship, or message content.";

    const emailLink = document.createElement("a");
    emailLink.className = "introd-support-email";
    emailLink.href = "mailto:help@getintrod.ai";
    emailLink.textContent = "Email help@getintrod.ai";

    const policyLink = document.createElement("a");
    policyLink.className = "introd-support-policy";
    policyLink.href = "https://getintrod.ai/legal/cookies";
    policyLink.textContent = "Cookie Policy";

    const actions = document.createElement("div");
    actions.className = "introd-support-actions";

    const essentialButton = document.createElement("button");
    essentialButton.type = "button";
    essentialButton.className = "introd-support-secondary";
    essentialButton.textContent = "Use essential only";
    essentialButton.addEventListener("click", () => {
      writeConsent("denied");
      closePreferences();
    });

    const allowButton = document.createElement("button");
    allowButton.type = "button";
    allowButton.className = "introd-support-primary";
    allowButton.textContent = "Allow optional cookies";
    allowButton.addEventListener("click", () => {
      const shouldOpen = openChatAfterConsent;
      writeConsent("granted");
      closePreferences();
      if (shouldOpen && !privacySignalActive()) openSupport();
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "introd-support-close";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", closePreferences);

    actions.append(essentialButton, allowButton, closeButton);
    dialog.append(dialogTitle, message, safety, emailLink, policyLink, actions);
    root.append(supportButton, settingsButton, status, dialog);
    document.body.append(root);

    controls = {
      root,
      supportButton,
      settingsButton,
      status,
      dialog,
      dialogTitle,
      message,
      essentialButton,
      allowButton,
    };

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closePreferences();
    });
    renderState();
  }

  function handleCookieSettingsLink(event) {
    const link = event.target.closest?.(`a[href="${SETTINGS_HASH}"]`);
    if (!link) return;
    event.preventDefault();
    openPreferences();
  }

  function initialize() {
    buildControls();
    document.addEventListener("click", handleCookieSettingsLink);
    window.addEventListener(CONSENT_EVENT, synchronizeConsent);
    window.addEventListener("storage", (event) => {
      if (event.key === CONSENT_SYNC_KEY) synchronizeConsent();
    });
    window.addEventListener("popstate", synchronizeRoute);
    new MutationObserver(synchronizeRoute).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.setInterval(synchronizeConsent, 1500);
    synchronizeConsent();

    if (window.location.hash === SETTINGS_HASH) openPreferences();
  }

  window.IntrodSupport = Object.freeze({
    open: openSupport,
    openCookieSettings: () => openPreferences(),
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
