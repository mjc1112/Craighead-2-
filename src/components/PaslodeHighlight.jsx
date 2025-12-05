import React from "react";

function PaslodeHighlight() {
  return (
    <section className="cb-section cb-section--paslode">
      <div className="cb-section__inner">
        <div className="cb-pasloade-main">
          <div className="cb-pasloade-main__image">
            <img src="/images/pasloade/pasloade-nailer-studio.png" alt="Paslode nail gun" />
          </div>
          <div className="cb-pasloade-main__content">
            <span className="cb-pill cb-pill--paslode">PASLODE SERVICE & TRAINING</span>
            <h2>Official Paslode Repair & Training Centre</h2>
            <p>
              Craighead is an authorised Paslode service partner, offering
              certified repairs, servicing and training using genuine Paslode
              parts and procedures.
            </p>
            <a href="/services/pasloade" className="cb-btn cb-btn--paslode-primary">
              VIEW PASLODE SERVICES
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PaslodeHighlight;

