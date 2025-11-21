
import React from "react";

export function PaslodeHighlight() {
  return (
    <section className="cb-section cb-section--paslode">
      <div className="cb-section__inner">
        <div className="cb-paslode-main">
          <div className="cb-paslode-main__image">
            <img src="/images/paslode/paslode-nailer-studio.png" alt="Paslode nail gun" />
          </div>
          <div className="cb-paslode-main__content">
            <span className="cb-pill cb-pill--paslode">PASLODE SERVICE & TRAINING</span>
            <h2>Official Paslode Repair & Training Centre</h2>
            <p>
              Craighead is an authorised Paslode service partner, offering
              certified repairs, servicing and training using genuine Paslode
              parts and procedures.
            </p>
            <a href="/services/paslode" className="cb-btn cb-btn--paslode-primary">
              VIEW PASLODE SERVICES
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
