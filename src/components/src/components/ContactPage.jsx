// src/components/ContactPage.jsx
import React from "react";

function ContactPage() {
  return (
    <section id="contact" className="cb-contact">
      <div className="cb-contact__inner">
        {/* Left column – details */}
        <div className="cb-contact__details">
          <h2 className="cb-contact__title">Contact Us</h2>
          <p className="cb-contact__intro">
            Get in touch with Craighead Building Supplies for trade enquiries,
            specialist services and Paslode repair bookings.
          </p>

          <div className="cb-contact__block">
            <h3>Address</h3>
            <p>
              Craighead Building Supplies Ltd<br />
              <span>Address line 1</span><br />
              <span>Address line 2</span><br />
              <span>Postcode</span>
            </p>
          </div>

          <div className="cb-contact__block">
            <h3>Contact</h3>
            <p>
              <strong>Telephone:</strong> <a href="tel:00000000000">00000 000000</a><br />
              <strong>Email:</strong>{" "}
              <a href="mailto:info@craighead-supply.co.uk">
                info@craighead-supply.co.uk
              </a>
            </p>
          </div>

          <div className="cb-contact__block">
            <h3>Opening Hours</h3>
            <p>
              Monday – Friday: 8:00am – 5:00pm<br />
              Saturday: 8:00am – 12:00pm<br />
              Sunday: Closed
            </p>
          </div>

          <div className="cb-contact__block cb-contact__block--highlight">
            <h3>Paslode Repair & Training Centre</h3>
            <p>
              To book Paslode repairs or arrange certified training, please
              include your tool model and a brief description in your enquiry.
            </p>
          </div>
        </div>

        {/* Right column – enquiry form */}
        <div className="cb-contact__form">
          <h3>Send us an enquiry</h3>
          <form
            className="cb-contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              alert("Thank you – this is a demo form only at the moment.");
            }}
          >
            <div className="cb-contact-form__row">
              <label>
                Name
                <input type="text" name="name" required />
              </label>
            </div>

            <div className="cb-contact-form__row cb-contact-form__row--two">
              <label>
                Email
                <input type="email" name="email" required />
              </label>
              <label>
                Phone
                <input type="tel" name="phone" />
              </label>
            </div>

            <div className="cb-contact-form__row">
              <label>
                Enquiry type
                <select name="type" defaultValue="general">
                  <option value="general">General trade enquiry</option>
                  <option value="catalogue">Catalogue / product query</option>
                  <option value="paslode">Paslode repair / training</option>
                  <option value="fire-rated">Fire-rated products</option>
                  <option value="account">Trade account enquiry</option>
                </select>
              </label>
            </div>

            <div className="cb-contact-form__row">
              <label>
                Message
                <textarea
                  name="message"
                  rows="5"
                  placeholder="Tell us what you need and we’ll get back to you."
                  required
                />
              </label>
            </div>

            <button type="submit" className="cb-btn cb-btn--primary">
              Send message
            </button>

            <p className="cb-contact-form__note">
              By submitting this form you agree to be contacted by Craighead
              Building Supplies regarding your enquiry.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

export default ContactPage;
