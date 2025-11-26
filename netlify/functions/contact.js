import nodemailer from "nodemailer";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, message: "Method not allowed" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { name, email, phone, subject, reason, message } = body;

    if (!name || !email || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Name, email and message are required.",
        }),
      };
    }

    const mailSubject = subject?.trim()
      ? subject
      : `New ${reason || "general"} enquiry from ${name}`;

    const htmlBody = `
      <h2>New contact enquiry from Craighead website</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "-"}</p>
      <p><strong>Reason:</strong> ${reason || "general"}</p>
      <p><strong>Subject:</strong> ${mailSubject}</p>
      <p><strong>Message:</strong></p>
      <p>${(message || "").replace(/\n/g, "<br/>")}</p>
    `;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Craighead Website" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: process.env.CONTACT_RECEIVER_EMAIL,
      subject: mailSubject,
      html: htmlBody,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("Contact form error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Failed to send message. Please try again later.",
      }),
    };
  }
};
