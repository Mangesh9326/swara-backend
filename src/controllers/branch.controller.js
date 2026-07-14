const db = require('../config/db');

exports.getBranches = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, is_active FROM branches ORDER BY name ASC');
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name is required' });

    const { rows } = await db.query(
      'INSERT INTO branches (name) VALUES ($1) RETURNING id, name, is_active',
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Branch already exists' });
    res.status(500).json({ error: 'Failed to create branch' });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const { rows } = await db.query(
      'UPDATE branches SET name = $1 WHERE id = $2 RETURNING id, name, is_active',
      [name, id]
    );
    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update branch' });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM branches WHERE id = $1', [id]);
    res.status(200).json({ message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete branch. It may be in use.' });
  }
};