const db = require('../config/db');

// GET: Fetch all active services
exports.getServices = async (req, res) => {
  try {
    const query = 'SELECT id, name, base_fee, is_active FROM services WHERE is_active = true ORDER BY name ASC';
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
};

// POST: Add a new service
exports.createService = async (req, res) => {
  const { name, base_fee } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Service name is required' });
  }

  try {
    const query = `
      INSERT INTO services (name, base_fee, is_active) 
      VALUES ($1, $2, true) 
      RETURNING *;
    `;
    // If base_fee is missing from the request, default it to 0
    const fee = parseFloat(base_fee) || 0;
    
    const { rows } = await db.query(query, [name, fee]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
};

// DELETE: Remove a service
exports.deleteService = async (req, res) => {
  const { id } = req.params;

  try {
    // Note: If this service is already linked to applications, a hard DELETE might fail due to foreign keys.
    // In that case, you can do a soft delete: UPDATE services SET is_active = false WHERE id = $1
    const query = 'DELETE FROM services WHERE id = $1 RETURNING *';
    const { rows } = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service. It may be linked to existing applications.' });
  }
};