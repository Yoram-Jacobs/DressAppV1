import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-white">
      <div className="w-full px-[40px] pt-[80px] pb-[20px]">
        {/* Footer Main */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand / Description */}
          <div className="lg:col-span-3">
            <div className="flex flex-col">
              <Link
                to="/home"
                className="inline-block w-fit text-2xl font-extrabold tracking-tight text-white no-underline transition-opacity duration-200 hover:opacity-80"
              >
                Dress<span className="text-primary-brand ms-2">App</span>
              </Link>

              <p className="mt-5 max-w-sm text-sm leading-7 text-white/60">
                {t("footer.description", {
                  defaultValue:
                    "The next-generation autonomous wardrobe catalog system utilizing predictive AI algorithms for optimal styling and high-end carbon consciousness.",
                })}
              </p>

              {/* Social Links */}
              <div className="mt-6 flex items-center gap-3">
                <a
                  href="https://instagram.com"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 no-underline  transition-smooth hover:-translate-y-[3px] hover:bg-primary-brand"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <i className="bi bi-instagram text-base" />
                </a>

                <a
                  href="https://x.com"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 no-underline transition-smooth hover:-translate-y-[3px] hover:bg-primary-brand"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                >
                  <i className="bi bi-twitter-x text-base" />
                </a>

                <a
                  href="https://pinterest.com"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 no-underline transition-smooth hover:-translate-y-[3px] hover:bg-primary-brand"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Pinterest"
                >
                  <i className="bi bi-pinterest text-base" />
                </a>

                <a
                  href="https://linkedin.com"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 no-underline transition-smooth hover:-translate-y-[3px] hover:bg-primary-brand"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <i className="bi bi-linkedin text-base" />
                </a>
              </div>
            </div>
          </div>

          {/* Company */}
          <div className="lg:col-span-2">
            <h5 className="mb-5 text-sm text-white">
              {t("footer.company", {
                defaultValue: "Company",
              })}
            </h5>

            <ul className="m-0 list-none space-y-3 p-0">
              <li>
                <Link
                  to="/about"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.aboutUs", {
                    defaultValue: "About Us",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/careers"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.careers", {
                    defaultValue: "Careers",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/sustainability"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.sustainabilityReport", {
                    defaultValue: "Sustainability Report",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/press-kit"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.pressKit", {
                    defaultValue: "Press Kit",
                  })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div className="lg:col-span-2">
            <h5 className="mb-5 text-sm text-white">
              {t("footer.features", {
                defaultValue: "Features",
              })}
            </h5>

            <ul className="m-0 list-none space-y-3 p-0">
              <li>
                <Link
                  to="/closet"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.digitalCloset", {
                    defaultValue: "Digital Closet",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/stylist"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.aiStylistChat", {
                    defaultValue: "AI Stylist Chat",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/trends"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.trendScout", {
                    defaultValue: "Trend Scout",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/suitcase"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.travelCapsule", {
                    defaultValue: "Travel Capsule",
                  })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Marketplace */}
          <div className="lg:col-span-2">
            <h5 className="mb-5 text-sm text-white">
              {t("footer.marketplace", {
                defaultValue: "Marketplace",
              })}
            </h5>

            <ul className="m-0 list-none space-y-3 p-0">
              <li>
                <Link
                  to="/market"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.buySell", {
                    defaultValue: "Buy & Sell",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/market"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.directSwaps", {
                    defaultValue: "Direct Swaps",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/donations"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.donationsTracker", {
                    defaultValue: "Donations Tracker",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/zero-waste"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.zeroWastePolicy", {
                    defaultValue: "Zero Waste Policy",
                  })}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="lg:col-span-3">
            <h5 className="mb-5 text-sm text-white">
              {t("footer.support", {
                defaultValue: "Support",
              })}
            </h5>

            <ul className="m-0 list-none space-y-3 p-0">
              <li>
                <Link
                  to="/help"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.helpCenter", {
                    defaultValue: "Help Center",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/dpp-api"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.dppApiSpecs", {
                    defaultValue: "DPP API Specs",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.privacyPolicy", {
                    defaultValue: "Privacy Policy",
                  })}
                </Link>
              </li>

              <li>
                <Link
                  to="/terms"
                  className="text-sm text-white/60 no-underline transition-smooth duration-200 hover:text-white"
                >
                  {t("footer.termsOfUse", {
                    defaultValue: "Terms of Use",
                  })}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-[80px] flex flex-col gap-4 border-t border-white/10 pt-[20px] md:flex-row md:items-center md:justify-between">
          <p className="m-0 text-xs leading-6 text-white/50">
            © {currentYear} DressApp Inc.{" "}
            {t("footer.rights", {
              defaultValue:
                "All rights reserved. Designed to luxurious ecological specifications.",
            })}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/privacy"
              className="text-xs text-white/50 no-underline transition-smooth duration-200 hover:text-white"
            >
              {t("footer.privacyPolicy", {
                defaultValue: "Privacy Policy",
              })}
            </Link>

            <span className="text-xs text-white/30">|</span>

            <Link
              to="/eu-transparency"
              className="text-xs text-white/50 no-underline transition-smooth duration-200 hover:text-white"
            >
              {t("footer.euTransparency", {
                defaultValue: "EU Transparency Compliance",
              })}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};