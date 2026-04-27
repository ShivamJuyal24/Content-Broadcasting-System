const db = require('../models/db.js');

const uploadContent = async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ message: 'File is required (jpg, png, gif only)' });
  }

  const { title, subject, description, start_time, end_time } = req.body;

  if (!title || !subject) {
    return res.status(400).json({ message: 'Title and subject are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO content 
        (title, description, subject, file_url, file_type, file_size, uploaded_by, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [
        title,
        description || null,
        subject,
        req.file.path.replace(/\\/g, '/'),        
        req.file.mimetype,
        req.file.size,
        req.user.id,          
        start_time || null,
        end_time || null
      ]
    );

    res.status(201).json({
      message: 'Content uploaded successfully',
      content: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getMyContent = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM content WHERE uploaded_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ content: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { uploadContent, getMyContent };