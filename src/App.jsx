// src/App.jsx
import ProductCatalogue from "./components/ProductCatalogue.jsx";
import SpecialistServices from "./components/SpecialistServices.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import React from "react";
import EnquiryPanel from "./components/EnquiryPanel.jsx";
import MissionStatement from "./components/MissionStatement.jsx";
import PaslodeHighlight from "./components/PaslodeHighlight.jsx";
import TradeCounterPanel from "./components/TradeCounterPanel.jsx";
import { EnquiryProvider } from "./context/EnquiryContext.jsx";

export default function App() {
  return (
    <EnquiryProvider>
      <div className="cb-page cb-page--dark">
        <header className="cb-header">
          <div className="cb_header_logo">CRAIGHEAD</div>
          <nav className="cb-header_nav">
            <a href="#products">PRODUCTS</a>
            <a href="#services">SERVICES</a>
            <a href="#about">ABOUT</a>
          </nav>
          <div className="cb-header_search">
            <input
              type="search"
              placeholder="Search catalogue..."
              aria-label="Search"
            />
            <button aria-label="Search">🔍</button>
          </div>
        </header>

        <main>
          {/* HERO */}
          <section className="cb-hero">
            <div className="cb-hero_content">
              <h1>BUILDING SUPPLIES</h1>
              <p>FIXINGS · SEALANTS · ADHESIVES · POWER TOOLS · FIRE RATED</p>
              <div className="cb-hero_actions">
                <a
                  href="#catalogue"
                  className="cb-btn cb-btn--primary"
                >
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
            <div className="cb-hero_image" />
          </section>

          {/* MISSION STATEMENT */}
          <MissionStatement />

          {/* CORE PRODUCT RANGES (STATIC CARDS) */}
          <section id="products" className="cb-section">
            <div className="cb-section_inner">
              <h2 className="cb-mission_title">CORE PRODUCT RANGES</h2>
              <p className="cb-mission_text">
                Fully structured catalogue including fixings, sealants, power
                tools, Paslode, drill bits, abrasives, PPE, ironmongery and fire
                rated products – ready to drive real trade enquiries.
              </p>

              <div className="cb-category-grid">
                <div className="cb-category-card">
                  <div className="cb-category-card_icon">🔩</div>
                  <div className="cb-category-card_label">Fixings</div>
                </div>

                <div className="cb-category-card">
                  <div className="cb-category-card_icon">🧴</div>
                  <div className="cb-category-card_label">
                    Sealants &amp; Adhesives
                  </div>
                </div>

                <div className="cb-category-card">
                  <div className="cb-category-card_icon">⚡</div>
                  <div className="cb-category-card_label">Power Tools</div>
                </div>

                <div className="cb-category-card">
                  <div className="cb-category-card_icon">🔥</div>
                  <div className="cb-category-card_label">
                    Fire Rated Products
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 🔹 DYNAMIC PRODUCT CATALOGUE (SUPABASE) */}
          <section id="catalogue" className="cb-section">
            <ProductCatalogue />
          </section>

          {/* 🔹 DYNAMIC SPECIALIST SERVICES (SUPABASE) */}
          <section id="specialist-services" className="cb-section">
            <SpecialistServices />
          </section>

          {/* PASLODE SERVICES HIGHLIGHT */}
          <section id="services" className="cb-section cb-section--paslode">
            <PaslodeHighlight />
          </section>

          {/* ABOUT / TRADE COUNTER PANEL */}
          <section id="about" className="cb-section cb-section--mission">
            <div className="cb-section_inner cb-mission">
              <h2 className="cb-mission_title">ABOUT CRAIGHEAD</h2>
              <p className="cb-mission_text">
                Craighead Building Supplies specialise in fixings, sealants,
                adhesives and fire-rated products, backed by a fully categorised
                online catalogue and dedicated Paslode repair &amp; training
                centre.
              </p>
            </div>
          </section>

          {/* TRADE COUNTER INFO */}
          <TradeCounterPanel />
        </main>

        {/* FOOTER */}
        <footer className="cb-footer">
          <div className="cb-footer_inner">
            © {new Date().getFullYear()} Craighead Building Supplies Ltd. All
            rights reserved.
          </div>
        </footer>

        {/* CONTACT PANEL (BOTTOM OF PAGE) */}
        <ContactPage />

        {/* ENQUIRY SIDE PANEL / CONTEXT-DRIVEN */}
        <EnquiryPanel />
      </div>
    </EnquiryProvider>
  );
}

