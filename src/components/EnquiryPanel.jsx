
import React, { useState } from "react";
import { useEnquiry } from "../context/EnquiryContext.jsx";

export function EnquiryPanel() {
  const { items, open, setOpen, updateQty, removeItem, clear } = useEnquiry();
  const [customer, setCustomer] = useState({ name: "", company: "", email: "", phone: "" });
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!items.length) return;
    setSending(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          message,
          items: items.map(i => ({
            product_id: i.product.id,
            variant_id: i.variant.id,
            quantity: i.quantity
          }))
        })
      });
      if (res.ok) {
        clear();
        setSent(true);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <aside className={`cb-enquiry ${open ? "cb-enquiry--open" : ""}`}>
      <header className="cb-enquiry__header">
        <h2>Trade Enquiry</h2>
        <button type="button" className="cb-enquiry__close" onClick={() => setOpen(false)}>×</button>
      </header>
      <div className="cb-enquiry__body">
        {!items.length && !sent && <p className="cb-enquiry__empty">Your enquiry list is empty.</p>}
        {items.length > 0 && (
          <ul className="cb-enquiry__items">
            {items.map((item, index) => (
              <li key={index}>
                <div className="cb-enquiry__item-title">{item.product.name}</div>
                <div className="cb-enquiry__item-meta">
                  {item.variant.variant_name || item.variant.name}
                </div>
                <div className="cb-enquiry__item-controls">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateQty(index, Number(e.target.value || 1))}
                  />
                  <button type="button" onClick={() => removeItem(index)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {sent && <div className="cb-enquiry__success">Thank you – your enquiry has been sent.</div>}
        {items.length > 0 && !sent && (
          <form className="cb-enquiry__form" onSubmit={handleSubmit}>
            <h3>Your Details</h3>
            <input
              type="text"
              required
              placeholder="Name *"
              value={customer.name}
              onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Company"
              value={customer.company}
              onChange={e => setCustomer(c => ({ ...c, company: e.target.value }))}
            />
            <input
              type="email"
              required
              placeholder="Email *"
              value={customer.email}
              onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={customer.phone}
              onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
            />
            <textarea
              placeholder="Additional information"
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <button
              type="submit"
              className="cb-btn cb-btn--primary cb-enquiry__submit"
              disabled={sending}
            >
              {sending ? "Sending…" : "SEND ENQUIRY"}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
