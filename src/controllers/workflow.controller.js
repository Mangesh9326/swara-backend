const db = require('../config/db');
const socketManager = require('../utils/socket');

// --- ADMIN: Manage Status Assignments ---

exports.getAssignments = async (req, res) => {
  try {
    const query = `
      SELECT sa.id, sa.status_name, sa.user_id, u.first_name, u.last_name, u.email 
      FROM status_assignments sa
      JOIN users u ON sa.user_id = u.id
      ORDER BY sa.status_name ASC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.assignStatus = async (req, res) => {
  const { status_name, user_ids } = req.body; 
  
  // DEFENSIVE FIX 1: Safely grab the Admin's ID regardless of how your auth middleware formats it
  const admin_id = (req.user && req.user.id) ? req.user.id : req.userId;

  try {
    // DEFENSIVE FIX 2: Ensure the data is formatted correctly before touching the database
    if (!status_name) {
      return res.status(400).json({ error: 'Status name is required.' });
    }
    if (!Array.isArray(user_ids)) {
      return res.status(400).json({ error: 'user_ids must be an array.' });
    }

    await db.query('BEGIN');
    
    // Clear old assignments for this specific status
    await db.query('DELETE FROM status_assignments WHERE status_name = $1', [status_name]);

    // Insert the new ones
    for (const uid of user_ids) {
      await db.query(
        'INSERT INTO status_assignments (status_name, user_id, assigned_by) VALUES ($1, $2, $3)',
        [status_name, uid, admin_id]
      );
    }
    
    await db.query('COMMIT');
    res.json({ message: 'Assignments updated successfully' });
    
  } catch (err) {
    await db.query('ROLLBACK');
    
    // DEFENSIVE FIX 3: This will print the exact reason to your backend Node.js terminal
    console.error('🔥 POST /assignments ERROR:', err); 
    
    res.status(500).json({ error: err.message });
  }
};
// --- OPERATOR: Pending Work Queue ---

exports.getPendingWork = async (req, res) => {
  const user_id = req.user.id;
  
  try {
    // FIX: Added LEFT JOIN for payments to grab payment_status and calculate balance_amount
    const query = `
      SELECT 
        a.*, 
        s.name as service_name,
        p.payment_type, 
        p.payment_status, 
        p.total_amount as service_charges,
        (p.total_amount - p.paid_amount) as balance_amount
      FROM applications a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN payments p ON a.id = p.application_id
      JOIN status_assignments sa ON a.current_status = sa.status_name
      WHERE sa.user_id = $1
      ORDER BY a.target_date ASC
    `;
    
    const { rows } = await db.query(query, [user_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// --- CORE: Update Status & Log History ---

exports.updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { new_status, remarks } = req.body;
  const user_id = req.user.id;

  try {
    await db.query('BEGIN');

    const appRes = await db.query('SELECT current_status FROM applications WHERE id = $1', [id]);
    const old_status = appRes.rows[0]?.current_status || 'Unknown';

    // ALWAYS update the file_remark on the main application table
    if (old_status !== new_status) {
      await db.query(
        'UPDATE applications SET current_status = $1, file_remark = $2, updated_at = NOW() WHERE id = $3', 
        [new_status, remarks, id]
      );

      await db.query(
        'INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, remarks) VALUES ($1, $2, $3, $4, $5)',
        [id, old_status, new_status, user_id, remarks]
      );

      // ── NEW: NOTIFICATION LOGIC FOR WORKFLOW SIDEBAR ──
      console.log(`=== SIDEBAR NOTIFICATIONS: ${old_status} -> ${new_status} ===`);

      // 1. Get SIR No for the notification title
      const detailsRes = await db.query("SELECT sir_no FROM applications WHERE id = $1", [id]);
      const sirNo = detailsRes.rows[0]?.sir_no || 'File';
      
      // 2. Find who is assigned to this new status
      const assignedUsers = await db.query(
        `SELECT user_id FROM status_assignments WHERE status_name = $1`,
        [new_status]
      );

      const remarkText = remarks ? ` Remark: ${remarks}` : '';
      const notificationMessage = `Application moved to ${new_status}.${remarkText}`;

      // 3. Loop and Notify
      for (const row of assignedUsers.rows) {
        
        // Uncomment the line below in production to stop self-notifications
        // if (row.user_id !== req.user?.id) { 
        
        // Direct DB Insert (Safe inside the transaction)
        const { rows: savedNotif } = await db.query(
          `INSERT INTO notifications (user_id, title, message, type) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [row.user_id, `New Task: ${sirNo}`, notificationMessage, "info"]
        );
        
        // Fire Socket safely
        try {
          if (typeof socketManager !== 'undefined') {
            const userSocketId = socketManager.getUserSocket(row.user_id);
            if (userSocketId) {
              socketManager.getIO().to(userSocketId).emit('new_notification', savedNotif[0]);
            }
          }
        } catch (socketErr) {
          console.error("⚠️ Socket Emission Failed:", socketErr);
        }

        // } // End of if-statement
      }

    } else if (remarks) {
      // Just updating the remark
      await db.query('UPDATE applications SET file_remark = $1, updated_at = NOW() WHERE id = $2', [remarks, id]);
      
      await db.query(
        'INSERT INTO application_status_history (application_id, old_status, new_status, changed_by, remarks) VALUES ($1, $2, $3, $4, $5)',
        [id, old_status, old_status, user_id, remarks]
      );
    }

    await db.query('COMMIT');
    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error("❌ Error in workflow update:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.getApplicationHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT h.*, u.first_name, u.last_name 
      FROM application_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.application_id = $1
      ORDER BY h.created_at DESC
    `;
    const { rows } = await db.query(query, [id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWorkflowStatuses = async (req, res) => {
  try {
    // Assuming the integer column is named 'step' or 'sequence'
    // Adjust the column name 'step' to match your actual database schema
    const query = `SELECT id, name FROM workflow_statuses ORDER BY sequence_order ASC`;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET: Admin Monitor Data (Audit Logs + User Metrics)
exports.getMonitorData = async (req, res) => {
  try {
    const { range = 'today' } = req.query;

    let dateFilter = "ash.created_at >= CURRENT_DATE"; 
    if (range === 'yesterday') {
      dateFilter = "ash.created_at >= CURRENT_DATE - INTERVAL '1 day' AND ash.created_at < CURRENT_DATE";
    } else if (range === 'week') {
      dateFilter = "ash.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    }

    const activityQuery = `
      SELECT 
        ash.id, 
        ash.changed_by as user_id, 
        COALESCE(u.first_name || ' ' || u.last_name, 'System') as user,
        'Changed status to ' || ash.new_status as action,
        a.sir_no as target,
        TO_CHAR(ash.created_at, 'HH12:MI AM') as time,
        ash.created_at,
        CASE 
          WHEN ash.new_status ILIKE '%Approved%' OR ash.new_status ILIKE '%Closed%' THEN 'success'
          WHEN ash.new_status ILIKE '%Rejected%' OR ash.new_status ILIKE '%Cancelled%' THEN 'danger'
          WHEN ash.new_status ILIKE '%Hold%' OR ash.new_status ILIKE '%Query%' THEN 'warning'
          ELSE 'info'
        END as type
      FROM application_status_history ash
      LEFT JOIN users u ON ash.changed_by = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN applications a ON ash.application_id = a.id
      WHERE ${dateFilter} 
      AND (r.name = 'Operator' OR r.name = 'Agent 2')
      ORDER BY ash.created_at DESC
      LIMIT 150
    `;
    const { rows: activities } = await db.query(activityQuery);

    const userQuery = `
      SELECT 
        u.id, 
        u.first_name || ' ' || u.last_name as name, 
        u.email, 
        r.name as role,
        'Online' as status,
        'Active recently' as "lastActive",
        (SELECT COUNT(*) FROM applications a JOIN status_assignments sa ON a.current_status = sa.status_name WHERE sa.user_id = u.id AND a.deleted_at IS NULL) as pending_count,
        (SELECT COUNT(*) FROM applications a JOIN status_assignments sa ON a.current_status = sa.status_name WHERE sa.user_id = u.id AND a.deleted_at IS NULL AND a.target_date < CURRENT_DATE) as overdue_count,
        (SELECT COUNT(*) FROM application_status_history h WHERE h.changed_by = u.id AND h.new_status IN ('Closed', 'Approved')) as completed_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.deleted_at IS NULL
      ORDER BY r.name ASC, u.first_name ASC
    `;
    const { rows: rawUsers } = await db.query(userQuery);

    const users = rawUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status, 
      lastActive: u.lastActive,
      stats: {
        pending: parseInt(u.pending_count) || 0,
        completed: parseInt(u.completed_count) || 0,
        overdue: parseInt(u.overdue_count) || 0
      }
    }));

    res.json({ activities, users });
  } catch (error) {
    console.error('Monitor Data Error:', error);
    res.status(500).json({ error: 'Failed to fetch monitor data' });
  }
};