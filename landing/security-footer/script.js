const banner = document.getElementById("cookie-banner");
const cookieTriggers = Array.from(document.querySelectorAll("[data-cookie-modal]"));
const choiceButtons = banner ? Array.from(banner.querySelectorAll("[data-choice]")) : [];
const consentKey = "plantelligence-cookie-consent";

const normalizeChoice = (value) => {
  if (value === "accepted") {
    return "all";
  }
  return value;
};

let consentChoice = normalizeChoice(window.localStorage.getItem(consentKey));

if (consentChoice === "all" || consentChoice === "essential") {
  window.localStorage.setItem(consentKey, consentChoice);
} else {
  consentChoice = null;
}

const applyChoiceStyling = () => {
  choiceButtons.forEach((button) => {
    const isActive = button.dataset.choice === consentChoice;
    button.setAttribute("aria-pressed", String(isActive));
    button.classList.toggle("is-active", isActive);
  });
};

const showBanner = () => {
  if (!banner) return;
  banner.classList.add("is-visible");
  banner.setAttribute("aria-hidden", "false");
  applyChoiceStyling();
};

const hideBanner = () => {
  if (!banner) return;
  banner.classList.remove("is-visible");
  banner.setAttribute("aria-hidden", "true");
};

cookieTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    showBanner();
  });
});

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const choice = button.dataset.choice;
    if (!choice) return;
    window.localStorage.setItem(consentKey, choice);
    consentChoice = choice;
    applyChoiceStyling();
    hideBanner();
  });
});

if (!consentChoice) {
  window.setTimeout(() => {
    if (banner) {
      showBanner();
    }
  }, 1500);
}

applyChoiceStyling();

const smoothLinks = document.querySelectorAll('a[href^="#"][href!="#"]');

smoothLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetSelector = link.getAttribute("href");
    const target = document.querySelector(targetSelector);

    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});
