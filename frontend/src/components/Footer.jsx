import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container-fluid">
        <div className="row g-5">
          <div className="col-md-3 col-12">
            <div className="footer-main">
              <Link
                className="navbar-brand navbar-brand-custom"
                to="/home"
                style={{ color: "#fff" }}
              >
                Dress<span>App</span>
              </Link>

              <p>
                {t("footer.description", {
                  defaultValue:
                    "The next-generation autonomous wardrobe catalog system utilizing predictive AI algorithms for optimal styling and high-end carbon consciousness.",
                })}
              </p>

              <div className="d-flex">
                <a
                  href="https://instagram.com"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <i className="bi bi-instagram" />
                </a>

                <a
                  href="https://x.com"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                >
                  <i className="bi bi-twitter-x" />
                </a>

                <a
                  href="https://pinterest.com"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Pinterest"
                >
                  <i className="bi bi-pinterest" />
                </a>

                <a
                  href="https://linkedin.com"
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <i className="bi bi-linkedin" />
                </a>
              </div>
            </div>
          </div>

          <div className="col-md-2 col-6">
            <h5>{t("footer.company", { defaultValue: "Company" })}</h5>

            <ul>
              <li>
                <Link to="/about">
                  {t("footer.aboutUs", { defaultValue: "About Us" })}
                </Link>
              </li>

              <li>
                <Link to="/careers">
                  {t("footer.careers", { defaultValue: "Careers" })}
                </Link>
              </li>

              <li>
                <Link to="/sustainability">
                  {t("footer.sustainabilityReport", {
                    defaultValue: "Sustainability Report",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/press-kit">
                  {t("footer.pressKit", { defaultValue: "Press Kit" })}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-md-2 col-6">
            <h5>{t("footer.features", { defaultValue: "Features" })}</h5>

            <ul>
              <li>
                <Link to="/closet">
                  {t("footer.digitalCloset", {
                    defaultValue: "Digital Closet",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/stylist">
                  {t("footer.aiStylistChat", {
                    defaultValue: "AI Stylist Chat",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/trends">
                  {t("footer.trendScout", {
                    defaultValue: "Trend Scout",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/suitcase">
                  {t("footer.travelCapsule", {
                    defaultValue: "Travel Capsule",
                  })}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-md-2 col-6">
            <h5>
              {t("footer.marketplace", {
                defaultValue: "Marketplace",
              })}
            </h5>

            <ul>
              <li>
                <Link to="/market">
                  {t("footer.buySell", { defaultValue: "Buy & Sell" })}
                </Link>
              </li>

              <li>
                <Link to="/market">
                  {t("footer.directSwaps", {
                    defaultValue: "Direct Swaps",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/donations">
                  {t("footer.donationsTracker", {
                    defaultValue: "Donations Tracker",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/zero-waste">
                  {t("footer.zeroWastePolicy", {
                    defaultValue: "Zero Waste Policy",
                  })}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-md-3 col-6">
            <h5>{t("footer.support", { defaultValue: "Support" })}</h5>

            <ul>
              <li>
                <Link to="/help">
                  {t("footer.helpCenter", {
                    defaultValue: "Help Center",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/dpp-api">
                  {t("footer.dppApiSpecs", {
                    defaultValue: "DPP API Specs",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/privacy">
                  {t("footer.privacyPolicy", {
                    defaultValue: "Privacy Policy",
                  })}
                </Link>
              </li>

              <li>
                <Link to="/terms">
                  {t("footer.termsOfUse", {
                    defaultValue: "Terms of Use",
                  })}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>
            © {currentYear} DressApp Inc.{" "}
            {t("footer.rights", {
              defaultValue:
                "All rights reserved. Designed to luxurious ecological specifications.",
            })}
          </p>

          <div className="d-flex gap-3 mt-3 mt-md-0">
            <Link
              to="/privacy"
              className="text-white-50 text-decoration-none"
            >
              {t("footer.privacyPolicy", {
                defaultValue: "Privacy Policy",
              })}
            </Link>

            <span className="text-white-50">|</span>

            <Link
              to="/eu-transparency"
              className="text-white-50 text-decoration-none"
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