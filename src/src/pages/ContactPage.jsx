import { useState } from "react";

const initialFormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  reason: "general",
  message: "",
  agree: false,
};

export default function ContactPage() {
  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ loading: false, success: null, message: "" });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Please enter your name.";
    if (!form.email.trim()) {
      newErrors.email = "Please enter your email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!form.message.trim()) newErrors.message = "Please enter a message.";
    if (!form.agree) newErrors.agree = "You must agree to the privacy notice.";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: false, success: null, message: "" });

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setStatus({ loading: true, success: null, message: "" });

    try {
      const res = await fetch("/.netlify/functions/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Something went wrong sending your message.");
      }

      setStatus({
        loading: false,
        success: true,
        message: "Thank you, your message has been sent. We’ll get back to you shortly.",
      });
      setForm(initialFormState);
    } catch (err) {
      setStatus({
        loading: false,
        success: false,
        message: err.message || "There was an error sending your message.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero / Header */}
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-start gap-8">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-semibold mb-4">
              Contact Craighead Building Supplies
            </h1>
            <p className="text-slate-200 max-w-xl">
              Need a price, product advice, or trade account support? Get in touch with our team and
              we’ll respond as soon as possible.
            </p>
          </div>
          <div className="w-full md:w-auto">
            <div className="bg-slate-800 rounded-xl p-4 text-sm space-y-1">
              <p className="font-semibold">Head Office & Trade Counter</p>
              <p>Craighead Building Supplies Ltd.</p>
              <p>123 Example Industrial Estate</p>
              <p>Glasgow G00 0AA</p>
              <p className="mt-2">
                <span className="font-semibold">Tel:</span> 0141 000 0000
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                <a href="mailto:sales@craigheadbuildingsupplies.co.uk" className="underline">
                  sales@craigheadbuildingsupplies.co.uk
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-6xl mx-auto px-4 py-10 grid gap-10 lg:grid-cols-[2fr,1.5fr]">
        {/* Contact form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-2">Send us a message</h2>
          <p className="text-sm text-slate-600 mb-6">
            Fill in the form below and one of our team will get back to you. For urgent trade queries,
            please contact us by phone.
          </p>

          {status.message && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                status.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name & Email */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="name">
                  Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 ${
                    errors.name ? "border-rose-400" : "border-slate-300"
                  }`}
                  placeholder="Your full name"
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
                  Email *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 ${
                    errors.email ? "border-rose-400" : "border-slate-300"
                  }`}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* Phone & Reason */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="phone">
                  Phone (optional)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Contact number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="reason">
                  Enquiry type
                </label>
                <select
                  id="reason"
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="general">General enquiry</option>
                  <option value="pricing">Pricing / quote</option>
                  <option value="account">Trade account</option>
                  <option value="order">Existing order</option>
                  <option value="delivery">Delivery / collection</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="subject">
                Subject (optional)
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="What is your enquiry about?"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="message">
                Message *
              </label>
              <textarea
                id="message"
                name="message"
                rows="5"
                value={form.message}
                onChange={handleChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 ${
                  errors.message ? "border-rose-400" : "border-slate-300"
                }`}
                placeholder="Tell us what you need help with..."
              />
              {errors.message && <p className="text-xs text-rose-600 mt-1">{errors.message}</p>}
            </div>

            {/* Privacy / Consent */}
            <div className="flex items-start gap-2">
              <input
                id="agree"
                name="agree"
                type="checkbox"
                checked={form.agree}
                onChange={handleChange}
                className={`mt-1 h-4 w-4 rounded border ${
                  errors.agree ? "border-rose-400" : "border-slate-300"
                }`}
              />
              <label htmlFor="agree" className="text-xs text-slate-700">
                I agree that Craighead Building Supplies may store and process my details in line
                with the{" "}
                <a href="/privacy" className="underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>
            {errors.agree && <p className="text-xs text-rose-600">{errors.agree}</p>}

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={status.loading}
                className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {status.loading ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar: details & map */}
        <aside className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Visit or call us</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-medium">Craighead Building Supplies Ltd.</p>
              <p>123 Example Industrial Estate</p>
              <p>Glasgow G00 0AA</p>
              <p className="mt-2">
                <span className="font-semibold">Trade Counter:</span> Mon–Fri, 7:30am – 5:00pm
              </p>
              <p>
                <span className="font-semibold">Tel:</span> 0141 000 0000
              </p>
              <p>
                <span className="font-semibold">Email:</span>{" "}
                <a href="mailto:sales@craigheadbuildingsupplies.co.uk" className="underline">
                  sales@craigheadbuildingsupplies.co.uk
                </a>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">Find us</h3>
              <p className="text-xs text-slate-600">
                Use the map below to plan your visit to our trade counter.
              </p>
            </div>
            {/* Replace the src with your real Google Maps embed link */}
            <div className="h-64">
              <iframe
                title="Craighead Building Supplies location"
                src="https://www.google.com/maps/embed?pb="
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

