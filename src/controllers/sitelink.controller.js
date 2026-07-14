const db = require('../config/db');

// GET: Fetch all active site links
exports.getSiteLinks = async (req, res) => {
  try {
    const query = `
      SELECT id, service_name, url, created_at, updated_at 
      FROM site_links 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching site links:', error);
    res.status(500).json({ error: 'Failed to fetch site links' });
  }
};

// POST: Create a new site link (Admin Only)
exports.createSiteLink = async (req, res) => {
  try {
    const { service_name, url } = req.body;

    if (!service_name || !url) {
      return res.status(400).json({ error: 'Service name and URL are required' });
    }

    const insertQuery = `
      INSERT INTO site_links (service_name, url, created_by)
      VALUES ($1, $2, $3) RETURNING id, service_name, url
    `;
    const { rows } = await db.query(insertQuery, [service_name, url, req.user.id]);

    // Log Activity
    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'Added Site Link', 'SiteLinks', rows[0].id, req.ip]
    );

    res.status(201).json({ message: 'Site link added successfully', link: rows[0] });
  } catch (error) {
    console.error('Error creating site link:', error);
    res.status(500).json({ error: 'Failed to add site link' });
  }
};

// PUT: Update a site link (Admin Only)
exports.updateSiteLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, url } = req.body;

    const updateQuery = `
      UPDATE site_links 
      SET service_name = $1, url = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND deleted_at IS NULL 
      RETURNING id
    `;
    const { rows } = await db.query(updateQuery, [service_name, url, id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Site link not found or deleted' });
    }

    // Log Activity
    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'Updated Site Link', 'SiteLinks', id, req.ip]
    );

    res.status(200).json({ message: 'Site link updated successfully' });
  } catch (error) {
    console.error('Error updating site link:', error);
    res.status(500).json({ error: 'Failed to update site link' });
  }
};

// DELETE: Soft delete a site link (Admin Only)
exports.deleteSiteLink = async (req, res) => {
  try {
    const { id } = req.params;

    const deleteQuery = `
      UPDATE site_links 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING id
    `;
    const { rows } = await db.query(deleteQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Site link not found' });
    }

    // Log Activity
    await db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'Deleted Site Link', 'SiteLinks', id, req.ip]
    );

    res.status(200).json({ message: 'Site link deleted successfully' });
  } catch (error) {
    console.error('Error deleting site link:', error);
    res.status(500).json({ error: 'Failed to delete site link' });
  }
};