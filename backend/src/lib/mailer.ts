import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? "smtp.gmail.com",
  port:   parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPaymentReminderEmail(opts: {
  to: string;
  clientName: string;
  pressName: string;
  invoiceNumber: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  dueDate?: string;
}): Promise<void> {
  const fmt = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const subject = `Payment Reminder — Invoice #${opts.invoiceNumber} from ${opts.pressName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:10px;">
      <h2 style="color:#7c3aed;margin:0 0 8px">Payment Reminder</h2>
      <p style="color:#374151;margin:0 0 20px">Dear <strong>${opts.clientName}</strong>,</p>
      <p style="color:#374151">This is a friendly reminder that you have an outstanding balance with <strong>${opts.pressName}</strong>.</p>
      <div style="background:#fff;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #e5e7eb;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Invoice #</td><td style="padding:6px 0;font-weight:600;font-size:14px;">#${opts.invoiceNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Total Amount</td><td style="padding:6px 0;font-size:14px;">${fmt(opts.total)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Amount Paid</td><td style="padding:6px 0;color:#2b8a3e;font-size:14px;">${fmt(opts.amountPaid)}</td></tr>
          <tr style="border-top:2px solid #e5e7eb;"><td style="padding:10px 0 0;font-weight:700;font-size:15px;">Balance Due</td><td style="padding:10px 0 0;font-weight:700;font-size:15px;color:#c92a2a;">${fmt(opts.balanceDue)}</td></tr>
          ${opts.dueDate ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Due Date</td><td style="padding:6px 0;font-size:14px;">${opts.dueDate}</td></tr>` : ""}
        </table>
      </div>
      <p style="color:#374151;font-size:14px;">Please arrange payment at the earliest convenience. If you have already made the payment, please ignore this reminder.</p>
      <p style="color:#374151;font-size:14px;margin-top:20px;">Thank you for your business!</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">${opts.pressName}</p>
    </div>
  `;
  await transporter.sendMail({
    from: `"${opts.pressName}" <${process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  });
}
