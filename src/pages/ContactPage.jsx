import React from "react";

export default function ContactPage() {
  return (
    <section id="contact" className="cb-section cb-section--contact">
      <div className="cb-section__inner cb-contact">

        {/* Title */}
        <h2 className="cb-contact__title">Get In Touch</h2>

        {/* Contact Info */}
        <div className="cb-contact__details">
          <h3 className="cb-contact__subtitle">Craighead Building Supplies Ltd</h3>

          <p className="cb-contact__text">
            6 Clydesmill Grove<br />
            Glasgow<br />
            G32 8NL
          </p>

          <p className="cb-contact__text">
            <strong>Telephone:</strong>{" "}
            <a href="tel:01416410077">0141 641 0077</a>
          </p>

          <p className="cb-contact__text">
            <strong>Email:</strong>{" "}
            <a href="mailto:sales@craighead-supply.co.uk">
              sales@craighead-supply.co.uk
            </a>
          </p>
        </div>

        {/* Contact Form */}
        <form className="cb-contact__form">
          <div className="cb-form__group">
            <label>Name</label>
            <input type="text" placeholder="Your name" required />
          </div>

          <div className="cb-form__group">
            <label>Email</label>
            <input type="email" placeholder="Your email" required />
          </div>

          <div className="cb-form__group">
            <label>Message</label>
            <textarea placeholder="Your message..." rows="5" required></textarea>
          </div>

          <button
            type="submit"
            className="cb-btn cb-btn--primary"
          >
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}

