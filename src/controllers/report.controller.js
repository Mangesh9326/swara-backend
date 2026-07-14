const { query } = require("../config/db");
const nodemailer = require("nodemailer");
const fs = require("fs");

module.exports.submitReport = async (req, res) => {
  try {
    const { userId, userName, issueType, title, description } = req.body;
    const files = req.files || [];

    // 1. Prepare file info for database storage
    const fileRecords = files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      mimetype: file.mimetype
    }));

    // 2. Insert Report into PostgreSQL
    const dbQuery = `
      INSERT INTO reports (user_id, user_name, issue_type, title, description, file_paths)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const { rows } = await query(dbQuery, [
      userId || null, 
      userName, 
      issueType, 
      title, 
      description, 
      JSON.stringify(fileRecords)
    ]);

    // 3. Setup Email Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // 4. Attach uploaded files to the email
    const attachments = files.map(file => ({
      filename: file.originalname,
      path: file.path
    }));

    // 5. Send the Email to the Developer
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.DEVELOPER_EMAIL || 'your.developer.email@example.com', 
      subject: `🚨 System ${issueType} Report: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 8px;">
          <h2 style="color: #1e293b;">New Issue Reported</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Reported By:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${userName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Issue Type:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px;">${issueType}</span></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Title:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${title}</td></tr>
          </table>
          <h3 style="color: #334155; margin-bottom: 10px;">Description:</h3>
          <div style="background: white; padding: 15px; border: 1px solid #cbd5e1; border-radius: 6px; white-space: pre-wrap;">${description}</div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Database Record ID: ${rows[0].id}</p>
        </div>
      `,
      attachments: attachments
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Report submitted and sent successfully' });
  } catch (error) {
    console.error('Report submission error:', error);
    res.status(500).json({ error: 'Failed to process report' });
  }
};