import ContactPage from "./components/ContactPage.jsx";
import React from "react";
import EnquiryPanel from "./components/EnquiryPanel.jsx";
import MissionStatement from "./components/MissionStatement.jsx";
import PaslodeHighlight from "./components/PaslodeHighlight.jsx";
import TradeCounterPanel from "./components/TradeCounterPanel.jsx";

export default function App() {
  return (
    <EnquiryProvider>
      <div className="cb-page cb-page--dark">
        <header className="cb-header">
          <div className="cb-header__logo">CRAIGHEAD</div>
          <nav className="cb-header__nav">
            <a href="#products">PRODUCTS</a>
            <a href="#services">SERVICES</a>
            <a href="#about">ABOUT</a>
          </nav>
          <div className="cb-header__search">
            <input type="search" placeholder="Search catalogue..." />
            <button aria-label="Search">🔍</button>
          </div>
        </header>
         
        <main>
          <section className="cb-hero">
            <div className="cb-hero__content">
              <h1>BUILDING SUPPLIES</h1>
              <p>FIXINGS · SEALANTS · ADHESIVES · POWER TOOLS · FIRE RATED</p>
              <div className="cb-hero__actions">
                <a href="#products" className="cb-btn cb-btn--primary">BROWSE CATALOGUE</a>
                <a href="#services" className="cb-btn cb-btn--secondary">SPECIALIST SERVICES</a>
              </div>
            </div>
            <div className="cb-hero__image"></div>
          </section>
        

          <MissionStatement />

          <section id="products" className="cb-section">
            <div className="cb-section__inner">
              <h2 className="cb-mission__title">CORE PRODUCT RANGES</h2>
              <p className="cb-mission__text">
                Fully structured catalogue including fixings, sealants, power tools,
                Paslode, drill bits, abrasives, PPE, fire-rated products and core
                ironmongery – ready to drive real trade enquiries.
              </p>
              <div className="cb-category-grid">
                <div className="cb-category-card">
                  <div className="cb-category-card__icon">🔩</div>
                  <div className="cb-category-card__label">Fixings</div>
                </div>
                <div className="cb-category-card">
                  <div className="cb-category-card__icon">🧴</div>
                  <div className="cb-category-card__label">Sealants & Adhesives</div>
                </div>
                <div className="cb-category-card">
                  <div className="cb-category-card__icon">🔧</div>
                  <div className="cb-category-card__label">Power Tools</div>
                </div>
                <div className="cb-category-card">
                  <div className="cb-category-card__icon">🧯</div>
                  <div className="cb-category-card__label">Fire Rated Products</div>
                </div>
              </div>
            </div>
          </section>

          <section id="services">
            <PaslodeHighlight />
          </section>

          <section id="about" className="cb-section cb-section--mission">
            <div className="cb-section__inner cb-mission">
              <h2 className="cb-mission__title">ABOUT CRAIGHEAD</h2>
              <p className="cb-mission__text">
                Craighead Building Supplies specialise in fixings, sealants,
                adhesives and fire-rated products, backed by a fully categorised
                online catalogue and dedicated Paslode repair & training centre.
              </p>
            </div>
          </section>
        </main>

        <footer className="cb-footer">
          <div className="cb-footer__inner">
            © {new Date().getFullYear()} Craighead Building Supplies Ltd. All rights reserved.
          </div>
        </footer>

        <ContactPage />
      </div>
    </EnquiryProvider>
  );
}
