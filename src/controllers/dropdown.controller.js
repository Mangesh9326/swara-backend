// Use your central database connection file! 
// (Adjust the path if your db.js is located somewhere else)
const db = require('../config/db'); 

// Fetch all active dropdowns
exports.getDropdowns = async (req, res) => {
  try {
    // 1. Get standard dropdowns
    const { rows: dropRows } = await db.query('SELECT id, category, label, value FROM dropdown_options WHERE is_active = true');
    
    // 2. Get your REAL services with UUIDs and base_fee
    const { rows: serviceRows } = await db.query('SELECT id, name, base_fee FROM services WHERE is_active = true');

    // Group standard dropdowns
    const grouped = dropRows.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {});

    // Overwrite the 'services' array with your actual database services!
    grouped.services = serviceRows; 

    res.status(200).json(grouped);
  } catch (error) {
    console.error('🔥 Error fetching dropdowns:', error); 
    res.status(500).json({ error: 'Failed to fetch dropdowns' });
  }
};

// Create or Update Dropdown Options (Admin Only)
exports.saveDropdownOption = async (req, res) => {
  try {
    const { category, label, value } = req.body;
    const { rows } = await db.query(
      'INSERT INTO dropdown_options (category, label, value) VALUES ($1, $2, $3) RETURNING *',
      [category, label, value || label]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('🔥 Error saving dropdown:', error);
    res.status(500).json({ error: 'Failed to save option' });
  }
};

// Delete Dropdown Option (Admin Only)
exports.deleteDropdownOption = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM dropdown_options WHERE id = $1', [id]);
    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    console.error('🔥 Error deleting dropdown:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
};