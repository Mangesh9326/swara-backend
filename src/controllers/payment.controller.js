const db = require('../config/db');

exports.getPayments = async (req, res) => {
  try {
    const { range = 'today', date } = req.query;

    let dateFilter = '';
    const queryParams = [];

    // Dynamically build the SQL Date Filter
    if (range === 'today') {
      dateFilter = 'p.created_at >= CURRENT_DATE';
    } else if (range === 'yesterday') {
      dateFilter = "p.created_at >= CURRENT_DATE - INTERVAL '1 day' AND p.created_at < CURRENT_DATE";
    } else if (range === 'week') {
      dateFilter = "p.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (range === 'month') {
      dateFilter = "p.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (range === 'custom' && date) {
      dateFilter = 'DATE(p.created_at) = $1';
      queryParams.push(date);
    } else {
      // 'all' time - no date filter needed
      dateFilter = '1=1'; 
    }

    const query = `
      SELECT 
        p.id, 
        p.total_amount, 
        p.paid_amount, 
        p.payment_type, 
        p.payment_status, 
        p.created_at as date,
        a.sir_no, 
        a.applicant_name
      FROM payments p
      JOIN applications a ON p.application_id = a.id
      WHERE a.deleted_at IS NULL AND ${dateFilter}
      ORDER BY p.created_at DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch financial records' });
  }
};