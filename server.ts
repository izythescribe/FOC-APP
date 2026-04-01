import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Send Message (Testimonies / Anonymous)
  app.post("/api/send-message", async (req, res) => {
    try {
      const { type, content, userName } = req.body;
      
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;
      
      if (!user || !pass) {
        console.warn("Gmail credentials not configured. Message saved to database only.");
        return res.status(200).json({ success: true, warning: "Email not sent (credentials missing)" });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });

      const mailOptions = {
        from: user,
        to: 'israelogbemudia190@gmail.com',
        subject: `F.O.C. Portal: New ${type === 'testimony' ? 'Testimony' : 'Anonymous Message'}`,
        text: `You have received a new ${type}:\n\nFrom: ${userName || 'Anonymous'}\n\nMessage:\n${content}`
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Send Monthly Reports (Admin Only)
  app.post("/api/send-monthly-reports", async (req, res) => {
    try {
      const { reports } = req.body; // Array of { email, name, points, streak, awards }
      
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;
      
      if (!user || !pass) {
        return res.status(500).json({ error: "Gmail credentials not configured in AI Studio Secrets." });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });

      let sentCount = 0;
      let adminSummary = "Monthly Growth Awards Summary:\n\n";

      for (const report of reports) {
        if (!report.email) continue;

        adminSummary += `- ${report.name} (${report.email}): ${report.points} pts, ${report.streak} day streak. Awards: ${report.awards.join(', ') || 'None'}\n`;

        const mailOptions = {
          from: user,
          to: report.email,
          subject: `F.O.C. Portal: Your Monthly Growth Report`,
          text: `Hello ${report.name},\n\nHere is your growth report for this month:\n\nTotal Points: ${report.points}\nConsistency Streak: ${report.streak} days\nAwards Earned: ${report.awards.join(', ') || 'None'}\n\nKeep growing in grace!\n\n- F.O.C. Accountability & Growth Portal`
        };

        try {
          await transporter.sendMail(mailOptions);
          sentCount++;
        } catch (err) {
          console.error(`Failed to send email to ${report.email}`, err);
        }
      }

      // Send summary to Admin
      const adminMailOptions = {
        from: user,
        to: 'israelogbemudia190@gmail.com',
        subject: `F.O.C. Portal: Monthly Awards Summary`,
        text: `You have successfully sent ${sentCount} monthly reports.\n\n${adminSummary}`
      };
      await transporter.sendMail(adminMailOptions);

      res.json({ success: true, sentCount });
    } catch (error) {
      console.error("Error sending monthly reports:", error);
      res.status(500).json({ error: "Failed to send monthly reports" });
    }
  });

  // Request Booking Notification
  app.post("/api/request-booking", async (req, res) => {
    try {
      const { name, email, date, time, userPhone } = req.body;
      
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;
      
      if (!user || !pass) {
        return res.status(200).json({ success: true, warning: "Email not sent (credentials missing)" });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });

      const mailOptions = {
        from: user,
        to: 'israelogbemudia190@gmail.com',
        subject: `F.O.C. Portal: New 1-on-1 Session Request`,
        text: `You have a new 1-on-1 session request!\n\nName: ${name}\nEmail: ${email || 'N/A'}\nWhatsApp: ${userPhone || 'N/A'}\nDate: ${date}\nTime: ${time}\n\nPlease log in to the portal to approve this booking.`
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending booking request email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Approve Booking & Schedule Reminders
  app.post("/api/approve-booking", async (req, res) => {
    try {
      const { email, name, date, time, userPhone } = req.body;
      
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;

      if (!user || !pass) {
        console.warn("Gmail credentials not configured. Reminders will not be sent.");
        return res.status(200).json({ success: true, warning: "Email not sent (credentials missing)" });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });

      // 1. Send Immediate Approval Email to User
      if (email) {
        await transporter.sendMail({
          from: user,
          to: email,
          subject: `F.O.C. Portal: 1-on-1 Session Approved!`,
          text: `Hello ${name},\n\nYour 1-on-1 session has been approved for ${date} at ${time}.\n\nPlease be on time. We will send you reminders 24 hours and 1 hour before the session.\n\n- F.O.C. Accountability & Growth Portal`
        });
      }

      // 2. Schedule Reminders
      const bookingDateTime = new Date(`${date}T${time}:00`);
      const now = new Date();
      const timeUntilBooking = bookingDateTime.getTime() - now.getTime();
      const timeUntil24h = timeUntilBooking - (24 * 60 * 60 * 1000);
      const timeUntil1h = timeUntilBooking - (60 * 60 * 1000);

      const sendReminders = async (timeLeftLabel: string) => {
        // Email to User
        if (email) {
          try {
            await transporter.sendMail({
              from: user,
              to: email,
              subject: `Reminder: F.O.C. 1-on-1 Session in ${timeLeftLabel}`,
              text: `Hello ${name},\n\nThis is a reminder for your 1-on-1 session scheduled in ${timeLeftLabel} (${date} at ${time}).\n\n- F.O.C. Portal`
            });
          } catch (e) { console.error('Email reminder failed', e); }
        }

        // Email to Admin
        try {
          await transporter.sendMail({
            from: user,
            to: 'israelogbemudia190@gmail.com',
            subject: `Admin Reminder: Session with ${name} in ${timeLeftLabel}`,
            text: `Reminder: You have a 1-on-1 session with ${name} in ${timeLeftLabel} (${date} at ${time}).\nUser Phone: ${userPhone}`
          });
        } catch (e) { console.error('Admin email reminder failed', e); }
      };

      // Max timeout is ~24.8 days (2147483647 ms)
      const MAX_TIMEOUT = 2147483647;

      if (timeUntil24h > 0 && timeUntil24h <= MAX_TIMEOUT) {
        setTimeout(() => sendReminders('24 hours'), timeUntil24h);
      }
      if (timeUntil1h > 0 && timeUntil1h <= MAX_TIMEOUT) {
        setTimeout(() => sendReminders('1 hour'), timeUntil1h);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error approving booking:", error);
      res.status(500).json({ error: "Failed to approve booking" });
    }
  });

  // Send Message (Testimony or Anonymous)
  app.post("/api/send-message", async (req, res) => {
    try {
      const { type, content, userName } = req.body;
      
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;
      
      if (!user || !pass) {
        return res.status(200).json({ success: true, warning: "Email not sent (credentials missing)" });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });

      const subject = type === 'anonymous' 
        ? `F.O.C. Portal: New Anonymous Q&A Message` 
        : `F.O.C. Portal: New Testimony from ${userName}`;

      const textBody = type === 'anonymous'
        ? `You have received a new anonymous message from the portal:\n\n"${content}"\n\n---\nSent via F.O.C. Portal`
        : `You have received a new testimony from ${userName}:\n\n"${content}"\n\n---\nSent via F.O.C. Portal`;

      const mailOptions = {
        from: user,
        to: 'israelogbemudia190@gmail.com',
        subject,
        text: textBody
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
