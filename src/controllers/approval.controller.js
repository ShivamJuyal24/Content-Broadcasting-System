const db = require('../models/db.js');
const { getOrCreateSlot, addToSchedule } = require('../services/scheduling.service');
// GET all pending content — principal only
const getPendingContent = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.name as teacher_name, u.email as teacher_email
       FROM content c
       JOIN users u ON c.uploaded_by = u.id
       WHERE c.status = 'pending'
       ORDER BY c.created_at DESC`
    );
    res.json({ content: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET all content (any status) — principal overview
const getAllContent = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.name as teacher_name
       FROM content c
       JOIN users u ON c.uploaded_by = u.id
       ORDER BY c.created_at DESC`
    );
    res.json({ content: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST approve content
const approveContent = async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body; // optional, defaults to 5 mins

  try {
    const check = await db.query('SELECT * FROM content WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (check.rows[0].status !== 'pending') {
      return res.status(400).json({ message: `Content is already ${check.rows[0].status}` });
    }

    const content = check.rows[0];

    // 1. Update status to approved
    const result = await db.query(
      `UPDATE content 
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, id]
    );

    // 2. Find or create slot for this subject+teacher
    const slot = await getOrCreateSlot(content.subject, content.uploaded_by);

    // 3. Add to schedule with rotation order
    await addToSchedule(content.id, slot.id, duration || 5);

    res.json({ message: 'Content approved and scheduled', content: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// POST reject content
const rejectContent = async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  if (!rejection_reason || rejection_reason.trim() === '') {
    return res.status(400).json({ message: 'Rejection reason is required' });
  }

  try {
    const check = await db.query('SELECT * FROM content WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (check.rows[0].status !== 'pending') {
      return res.status(400).json({ message: `Content is already ${check.rows[0].status}` });
    }

    const result = await db.query(
      `UPDATE content 
       SET status = 'rejected', rejection_reason = $1
       WHERE id = $2
       RETURNING *`,
      [rejection_reason, id]
    );

    res.json({ message: 'Content rejected', content: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getPendingContent, getAllContent, approveContent, rejectContent };