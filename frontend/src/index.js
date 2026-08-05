import React from "react";
import ReactDOM from "react-dom/client";
import { toast } from "sonner";
import "@/index.css";
import "@/lib/i18n";
import App from "@/App";

toast.success = () => {};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && "PushManager" in window) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
  });
}
// ===========================surbhi-custom-javascript=====================================

// --- WOW.js Scroll Reveal Animations (top-to-bottom & bottom-to-top) ---
if (typeof WOW !== "undefined") {
  new WOW({
    boxClass: "wow",
    offset: 60,
    mobile: true,
    live: true,
  }).init();
}

// --- Swiper: Marketplace Slider ---
if (typeof Swiper !== "undefined" && document.querySelector(".market-swiper")) {
  new Swiper(".market-swiper", {
    slidesPerView: 1.15,
    spaceBetween: 15,
    loop: true,
    speed: 800,
    autoplay: {
      delay: 1000,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    navigation: {
      nextEl: ".market-swiper-next",
      prevEl: ".market-swiper-prev",
    },
    breakpoints: {
      576: { slidesPerView: 2, spaceBetween: 15 },
      992: { slidesPerView: 3, spaceBetween: 15 },
      1200: { slidesPerView: 4, spaceBetween: 15 },
    },
  });
}

// --- Sticky Navbar Color Transition on Scroll ---
window.addEventListener("scroll", function () {
  const navbar = document.querySelector(".navbar-premium");
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// --- Interactive Closet Filtering logic ---
function filterCloset(category, buttonElement) {
  // Remove active class from all sidebar buttons
  const buttons = document.querySelectorAll(".closet-sidebar-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  // Add active class to clicked button
  buttonElement.classList.add("active");

  // Hide/Show wardrobe items based on dataset-category
  const items = document.querySelectorAll(".closet-item");
  items.forEach((item) => {
    const itemCategory = item.getAttribute("data-category");
    if (category === "all" || itemCategory === category) {
      item.style.display = "block";
      // Trigger simple CSS animation
      item.style.opacity = "0";
      setTimeout(() => {
        item.style.opacity = "1";
        item.style.transition = "opacity 0.4s ease";
      }, 50);
    } else {
      item.style.display = "none";
    }
  });
}

// --- Hero Fashion Editorial Slider ---
const heroSlides = document.querySelectorAll(".hero-slide");
const heroSliderDots = document.querySelectorAll(".hero-slider-dots button");
let heroSlideIndex = 0;

function showHeroSlide(index) {
  if (!heroSlides.length) return;

  heroSlideIndex = (index + heroSlides.length) % heroSlides.length;
  heroSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === heroSlideIndex);
  });
  heroSliderDots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === heroSlideIndex);
  });
}

heroSliderDots.forEach((dot, index) => {
  dot.addEventListener("click", () => showHeroSlide(index));
});

if (heroSlides.length > 1) {
  setInterval(() => {
    showHeroSlide(heroSlideIndex + 1);
  }, 4200);
}
