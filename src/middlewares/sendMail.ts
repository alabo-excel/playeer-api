import nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  // Configure transporter (use environment variables for sensitive info)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // Compose 'from' with display name if provided
  const fromName = "Playeer Support";
  const fromEmail = process.env.SMTP_USER;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  await transporter.sendMail(mailOptions);
}



