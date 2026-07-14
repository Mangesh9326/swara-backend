const db = require("../config/db");
const { createNotification } = require("./notification.controller");
const socketManager = require("../utils/socket");

// GET: Fetch records with Search & Pagination (Infinite Scroll)
exports.getApplications = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // The ILIKE operator allows searching "2806" to match "SE2806"
    const query = `
      SELECT a.*, s.name as service_name, ws.name as status_name, u.first_name as assignee_name
      FROM applications a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN workflow_statuses ws ON a.current_status_id = ws.id
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE a.deleted_at IS NULL 
      AND (
        a.sir_no ILIKE $1 OR 
        a.applicant_name ILIKE $1 OR 
        a.contact_no ILIKE $1
      )
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM applications 
      WHERE deleted_at IS NULL AND (sir_no ILIKE $1 OR applicant_name ILIKE $1 OR contact_no ILIKE $1)
    `;

    const searchParam = `%${search}%`;

    const [data, countResult] = await Promise.all([
      db.query(query, [searchParam, limit, offset]),
      db.query(countQuery, [searchParam]),
    ]);

    // Fetch ALL payment info for these records, including suppliers and desks
    const appIds = data.rows.map((row) => row.id);
    let payments = [];
    if (appIds.length > 0) {
      const paymentQuery = `
        SELECT 
          application_id, 
          total_amount as service_charges, 
          payment_type, 
          payment_status, 
          (total_amount - paid_amount) as balance_amount,
          supplier_1_name, supplier_1_amt, 
          supplier_2_name, supplier_2_amt,
          desk_1_name, desk_1_amt, 
          desk_2_name, desk_2_amt, 
          desk_3_name, desk_3_amt
        FROM payments 
        WHERE application_id = ANY($1)
      `;
      const paymentResult = await db.query(paymentQuery, [appIds]);
      payments = paymentResult.rows;
    }

    // Merge payment data into application data
    const finalData = data.rows.map((app) => {
      const payment = payments.find((p) => p.application_id === app.id) || {};
      return { ...app, ...payment };
    });

    res.status(200).json({
      data: finalData,
      total: parseInt(countResult.rows[0].count),
      hasMore: offset + finalData.length < parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
};

// POST: Create Application with Auto-Generated SIR NO
exports.createApplication = async (req, res) => {
  try {
    const data = req.body;

    // Safely capture the string status from frontend
    const newStatus = data.current_status || data.status || "File Received";

    await db.query("BEGIN"); // Start transaction

    // Insert Application
    const insertQuery = `
      INSERT INTO applications (
        sir_no, applicant_name, contact_no, aadhar_no, pan_no, dob, address, ward_name, branch,
        receiver_desk, operator_name, service_id, service_type, date_received, target_date, 
        current_status_id, current_status, file_remark, application_id_portal, user_id_portal, online_application_date, 
        follow_day, reminder_status, created_by
      ) VALUES (
        'SE' || nextval('sir_no_seq'), $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23
      ) RETURNING id, sir_no
    `;

    const { rows } = await db.query(insertQuery, [
      data.applicant_name,
      data.contact_no,
      data.aadhar_no,
      data.pan_card,
      data.dob || null,
      data.address,
      data.ward_name,
      data.branch || "Parel",
      data.receiver_desk,
      data.operator_name,
      data.service_id || null,
      data.service_type,
      data.date_received || null,
      data.target_date || null,
      data.status_id || null,
      newStatus, // $16
      data.file_remark,
      data.application_id_portal,
      data.user_id_portal,
      data.online_application_date || null,
      data.follow_day || null,
      data.reminder_status,
      req.user?.id || null, // $23
    ]);

    const appId = rows[0].id;
    const sirNo = rows[0].sir_no;

    // Create the first entry in Audit History
    await db.query(
      `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, remarks) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        appId,
        "New Form Created",
        newStatus,
        req.user?.id || null,
        data.file_remark || "Application initialized",
      ],
    );

    // Insert Payment Record (Now includes desk names)
    const serviceCharges = parseFloat(data.service_charges) || 0;
    const balanceAmount = parseFloat(data.balance_amount) || 0;
    const paidAmount = serviceCharges - balanceAmount;

    await db.query(
      `
      INSERT INTO payments (
        application_id, total_amount, paid_amount, payment_type, payment_status,
        supplier_1_name, supplier_1_amt, supplier_2_name, supplier_2_amt,
        desk_1_name, desk_1_amt, desk_2_name, desk_2_amt, desk_3_name, desk_3_amt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `,
      [
        appId,
        serviceCharges,
        paidAmount,
        data.payment_type,
        data.payment_status || "UNPAID",
        data.supplier_1_name || null,
        parseFloat(data.supplier_1_amt) || 0,
        data.supplier_2_name || null,
        parseFloat(data.supplier_2_amt) || 0,
        data.desk_1_name || null,
        parseFloat(data.desk_1_amt) || 0,
        data.desk_2_name || null,
        parseFloat(data.desk_2_amt) || 0,
        data.desk_3_name || null,
        parseFloat(data.desk_3_amt) || 0,
      ],
    );

    await db.query("COMMIT"); // Commit transaction

    // ── NEW: NOTIFICATION LOGIC FOR CREATION ──
    try {
      // Find out who is responsible for the initial status (e.g., "File Received")
      const assignedUsers = await db.query(
        `SELECT user_id FROM status_assignments WHERE status_name = $1`,
        [newStatus],
      );

      const remarkText = data.file_remark ? ` Remark: ${data.file_remark}` : "";
      const notificationMessage = `New application registered.${remarkText}`;

      for (const row of assignedUsers.rows) {
        //if (row.user_id !== req.user?.id) {
        await createNotification(
          row.user_id,
          `New Task: ${sirNo}`,
          notificationMessage,
          "success",
        );
        //}
      }
    } catch (notifErr) {
      console.error("Notification failed, but app was created:", notifErr);
    }

    res.status(201).json({
      message: "Application created successfully",
      sir_no: sirNo,
    });
  } catch (error) {
    await db.query("ROLLBACK"); // Rollback if error occurs
    console.error("Error creating application:", error);
    res.status(500).json({ error: "Failed to create application" });
  }
};

// PUT: Update Application
exports.updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

      console.log("=== INCOMING DATA ===");
  console.log("FRONTEND SENT STATUS:", data.current_status || data.status);

    await db.query("BEGIN");

    const oldApp = await db.query(
      "SELECT current_status FROM applications WHERE id = $1",
      [id],
    );
    const oldStatus = oldApp.rows[0]?.current_status || "File Received";

    const newStatus = data.current_status || data.status || oldStatus;

    const updateQuery = `
        UPDATE applications SET
          applicant_name = $1, contact_no = $2, aadhar_no = $3, pan_no = $4, dob = $5, address = $6, ward_name = $7, branch = $8,
          receiver_desk = $9, operator_name = $10, service_id = $11, service_type = $12, date_received = $13, target_date = $14, 
          current_status_id = $15, current_status = $16, file_remark = $17, application_id_portal = $18, user_id_portal = $19, online_application_date = $20, 
          follow_day = $21, reminder_status = $22, updated_at = CURRENT_TIMESTAMP
        WHERE id = $23 RETURNING id
      `;

    await db.query(updateQuery, [
      data.applicant_name,
      data.contact_no,
      data.aadhar_no,
      data.pan_card,
      data.dob || null,
      data.address,
      data.ward_name,
      data.branch || "Parel",
      data.receiver_desk,
      data.operator_name,
      data.service_id || null,
      data.service_type,
      data.date_received || null,
      data.target_date || null,
      data.status_id || null,
      newStatus, // $16
      data.file_remark,
      data.application_id_portal,
      data.user_id_portal,
      data.online_application_date || null,
      data.follow_day || null,
      data.reminder_status,
      id, // $23
    ]);

    // Update Payment Record
    const serviceCharges = parseFloat(data.service_charges) || 0;
    const balanceAmount = parseFloat(data.balance_amount) || 0;
    const paidAmount = serviceCharges - balanceAmount;

    await db.query(
      `
        UPDATE payments SET
          total_amount = $1, paid_amount = $2, payment_type = $3, payment_status = $4,
          supplier_1_name = $5, supplier_1_amt = $6, supplier_2_name = $7, supplier_2_amt = $8,
          desk_1_name = $9, desk_1_amt = $10, desk_2_name = $11, desk_2_amt = $12, 
          desk_3_name = $13, desk_3_amt = $14, updated_at = CURRENT_TIMESTAMP
        WHERE application_id = $15
      `,
      [
        serviceCharges,
        paidAmount,
        data.payment_type,
        data.payment_status || "UNPAID",
        data.supplier_1_name || null,
        parseFloat(data.supplier_1_amt) || 0,
        data.supplier_2_name || null,
        parseFloat(data.supplier_2_amt) || 0,
        data.desk_1_name || null,
        parseFloat(data.desk_1_amt) || 0,
        data.desk_2_name || null,
        parseFloat(data.desk_2_amt) || 0,
        data.desk_3_name || null,
        parseFloat(data.desk_3_amt) || 0,
        id,
      ],
    );

    // ── NOTIFICATION & HISTORY LOGIC ──
    if (oldStatus !== newStatus) {
      // 1. Log History
      await db.query(
        `INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, remarks) 
         VALUES ($1, $2, $3, $4, $5)`,
        [id, oldStatus, newStatus, req.user?.id || null, data.file_remark],
      );

      console.log(
        `=== PROCESSING NOTIFICATIONS: ${oldStatus} -> ${newStatus} ===`,
      );

      // 2. Get SIR No & Assigned Users
      const appDetails = await db.query(
        "SELECT sir_no FROM applications WHERE id = $1",
        [id],
      );
      const sirNo = appDetails.rows[0]?.sir_no || "File";

      const assignedUsers = await db.query(
        `SELECT user_id FROM status_assignments WHERE status_name = $1`,
        [newStatus],
      );

      const remarkText = data.file_remark ? ` Remark: ${data.file_remark}` : "";
      const notificationMessage = `Application moved to ${newStatus}.${remarkText}`;

      // 3. Loop and Notify
      for (const row of assignedUsers.rows) {
        // Uncomment the if-statement below in production so users don't notify themselves.
        // Keep it commented out while testing so you can see your own notifications!
        // if (row.user_id !== req.user?.id) {

        // Direct DB Insert (Safe inside the transaction)
        const { rows: savedNotif } = await db.query(
          `INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [row.user_id, `New Task: ${sirNo}`, notificationMessage, "info"],
        );

        console.log(`✅ Saved DB Notification for User: ${row.user_id}`);

        // Fire Socket (Wrapped in its own try/catch so it doesn't break the DB transaction if socketManager is missing)
        try {
          if (typeof socketManager !== "undefined") {
            const userSocketId = socketManager.getUserSocket(row.user_id);
            if (userSocketId) {
              socketManager
                .getIO()
                .to(userSocketId)
                .emit("new_notification", savedNotif[0]);
              console.log(`🚀 Socket event sent to ${userSocketId}`);
            } else {
              console.log(`💤 User ${row.user_id} is currently offline.`);
            }
          } else {
            console.warn(
              "⚠️ socketManager is not defined at the top of this file.",
            );
          }
        } catch (socketErr) {
          console.error("⚠️ Socket Emission Failed:", socketErr);
        }

        // }
      }
    } else {
      console.log(
        `⚠️ SKIPPED NOTIFICATIONS: Status did not change. Old: ${oldStatus}, New: ${newStatus}`,
      );
    }

    // If everything succeeds, commit!
    await db.query("COMMIT");
    res.status(200).json({ message: "Application updated successfully" });
  } catch (error) {
    // If anything fails (like a bad SQL query or missing import), erase everything and abort
    await db.query("ROLLBACK");
    console.error(
      "❌ Error updating application (TRANSACTION ROLLED BACK):",
      error,
    );
    res.status(500).json({ error: "Failed to update application" });
  }
};
