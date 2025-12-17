// src/App.jsx
import React, { useCallback, useState } from "react";

import ProductCatalogue from "./components/ProductCatalogue.jsx";
import SpecialistServices from "./components/SpecialistServices.jsx";
import ContactPage from "./pages/ContactPage.jsx";

import { EnquiryPanel } from "./components/EnquiryPanel.jsx";
import MissionStatement from "./components/MissionStatement.jsx";
import PaslodeHighlight from "./components/PaslodeHighlight.jsx";
import TradeCounterPanel from "./components/TradeCounterPanel.jsx";
import { EnquiryProvider } from "./context/EnquiryContext.jsx";

/**
 * Stage 5.1 — Standardise on slugs end-to-end
 * These MUST match Supabase public.categories.slug exactly.
 */
const CORE_CATEGORY_SLUGS = {
  fixings: "fixings",
  sealantsAdhesives: "sealants-adhesives",
  powerTools: "power-tools",
  fireRated: "fire-rated",
};

export default function App() {
  // Stage 5.1: we now pass SLUGS (not names) into ProductCatalogue
  const [presetCategorySlug, setPresetCategorySlug] = useState("");

  const handleCoreRangeClick = useCallback((categorySlug) => {
    // Persist (useful for refresh) – the ProductCatalogue also consumes this
    try {
      localStorage.setItem("cb_category_name", categorySlug);
    } catch {
      // ignore storage errors (private browsing etc.)
    }

    setPresetCategorySlug(categorySlug);

    // Smooth scroll to catalogue section
    const el = document.getElementById("catalogue");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ProductCatalogue calls this after it has applied the preset
  const handlePresetConsumed = useCallback(() => {
    setPresetCategorySlug("");
  }, []);

  return (
    <EnquiryProvider>
      <div className="cb-page cb-page--dark">
        {/* HEADER */}
        <header className="cb-header">
          <div className="cb-header__inner">
            <a className="cb-header__logo" href="#top">
              CRAIGHEAD
            </a>

            <nav className="cb-header__nav">
              <a href="#catalogue">PRODUCTS</a>
              <a href="#specialist-services">SERVICES</a>
              <a href="#about">ABOUT</a>
            </nav>

            <div className="cb-header__search">
              <input
                type="search"
                placeholder="Search catalogue..."
                aria-label="Search"
                disabled
              />
              <button aria-label="Search" disabled>
                🔎
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section id="top" className="cb-hero">
            <div className="cb-hero__content">
              <h1>BUILDING SUPPLIES</h1>
              <p>FIXINGS · SEALANTS · ADHESIVES · POWER TOOLS · FIRE RATED</p>

              <div className="cb-hero__actions">
                <a href="#catalogue" className="cb-btn cb-btn--primary">
                  BROWSE CATALOGUE
                </a>
                <a
                  href="#specialist-services"
                  className="cb-btn cb-btn--secondary"
                >
                  SPECIALIST SERVICES
                </a>
              </div>
            </div>
            <div className="cb-hero__image" />
          </section>

          {/* MISSION STATEMENT */}
          <MissionStatement />

          {/* CORE PRODUCT RANGES (STATIC GRID) */}
          <section id="products" className="cb-section">
            <div className="cb-section__inner">
              <h2 className="cb-mission__title">CORE PRODUCT RANGES</h2>
              <p className="cb-mission__text">
                Fully structured catalogue including fixings, sealants, power
                tools, Paslode, drill bits, abrasives, PPE, ironmongery and fire
                rated products — ready to drive real trade enquiries.
              </p>

              <div className="cb-category-grid">
                <button
                  type="button"
                  className="cb-category-card"
                  onClick={() => handleCoreRangeClick(CORE_CATEGORY_SLUGS.fixings)}
                >
                  <div className="cb-category-card__icon">🧱</div>
                  <div className="cb-category-card__label">Fixings</div>
                </button>

                <button
                  type="button"
                  className="cb-category-card"
                  onClick={() =>
                    handleCoreRangeClick(CORE_CATEGORY_SLUGS.sealantsAdhesives)
                  }
                >
                  <div className="cb-category-card__icon">🧴</div>
                  <div className="cb-category-card__label">
                    Sealants &amp; Adhesives
                  </div>
                </button>

                <button
                  type="button"
                  className="cb-category-card"
                  onClick={() =>
                    handleCoreRangeClick(CORE_CATEGORY_SLUGS.powerTools)
                  }
                >
                  <div className="cb-category-card__icon">⚡</div>
                  <div className="cb-category-card__label">Power Tools</div>
                </button>

                <button
                  type="button"
                  className="cb-category-card"
                  onClick={() =>
                    handleCoreRangeClick(CORE_CATEGORY_SLUGS.fireRated)
                  }
                >
                  <div className="cb-category-card__icon">🔥</div>
                  <div className="cb-category-card__label">
                    Fire Rated Products
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* DYNAMIC PRODUCT CATALOGUE (SUPABASE) */}
          <section id="catalogue" className="cb-section">
            <ProductCatalogue
              // Stage 5.1: keep prop name as-is for compatibility,
              // but it now carries a SLUG value end-to-end.
              presetCategoryName={presetCategorySlug}
              onPresetConsumed={handlePresetConsumed}
            />
          </section>

          {/* DYNAMIC SPECIALIST SERVICES (SUPABASE) */}
          <section id="specialist-services" className="cb-section">
            <SpecialistServices />
          </section>

          {/* PASLODE SERVICES HIGHLIGHT */}
          <section id="services" className="cb-section cb-section--paslode">
            <PaslodeHighlight />
          </section>

          {/* ABOUT / TRADE COUNTER PANEL */}
          <section id="about" className="cb-section cb-section--mission">
            <div className="cb-section__inner cb-mission">
              <h2 className="cb-mission__title">ABOUT CRAIGHEAD</h2>
              <p className="cb-mission__text">
                Craighead Building Supplies specialise in fixings, sealants,
                adhesives and fire-rated products, backed by a fully categorised
                online catalogue and dedicated Paslode repair &amp; training
                centre.
              </p>
            </div>
          </section>

          <TradeCounterPanel />

          {/* FOOTER */}
          <footer className="cb-footer">
            <div className="cb-footer__inner">
              © {new Date().getFullYear()} Craighead Building Supplies Ltd. All
              rights reserved.
            </div>
          </footer>

          {/* CONTACT PANEL (BOTTOM OF PAGE) */}
          <ContactPage />
        </main>

        {/* ENQUIRY SIDE PANEL */}
        <EnquiryPanel />
      </div>
    </EnquiryProvider>
  );
}
