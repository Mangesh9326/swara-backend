const { query } = require("../config/db");
const resend = require("../services/email.service");
const fs = require("fs");

module.exports.submitReport = async (req, res) => {
  try {
    const { userId, userName, issueType, title, description } = req.body;
    const files = req.files || [];

    // Store uploaded file info in database
    const fileRecords = files.map((file) => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
    }));

    // Save report in PostgreSQL
    const dbQuery = `
      INSERT INTO reports
      (user_id, user_name, issue_type, title, description, file_paths)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
    `;

    const { rows } = await query(dbQuery, [
      userId || null,
      userName,
      issueType,
      title,
      description,
      JSON.stringify(fileRecords),
    ]);

    // Prepare attachments for Resend
    const attachments = files.map((file) => ({
      filename: file.originalname,
      content: fs.readFileSync(file.path),
    }));

    // Send email
    const { data, error } = await resend.emails.send({
      from: "Swara Portal <onboarding@resend.dev>",
      to: process.env.DEVELOPER_EMAIL,
      subject: `🚨 System ${issueType} Report: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>New Issue Reported</h2>

          <p><strong>Reported By:</strong> ${userName}</p>
          <p><strong>Issue Type:</strong> ${issueType}</p>
          <p><strong>Title:</strong> ${title}</p>

          <hr>

          <h3>Description</h3>

          <pre>${description}</pre>

          <hr>

          <p>Report ID: ${rows[0].id}</p>
        </div>
      `,
      attachments,
    });

    if (error) {
      console.error("Resend Error:", error);
    } else {
      console.log("Email sent:", data);
    }

    // Delete temporary uploaded files
    files.forEach((file) => {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error("File delete error:", err);
      }
    });

    return res.status(200).json({
      message: "Report submitted successfully",
    });

  } catch (error) {
    console.error("Report submission error:", error);

    return res.status(500).json({
      error: "Failed to process report",
    });
  }
};