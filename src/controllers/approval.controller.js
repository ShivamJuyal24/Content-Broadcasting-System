const db = require('../models/db.js');
const { getOrCreateSlot, addToSchedule } = require('../services/scheduling.service');

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

// GET all content — with optional filters + pagination
const getAllContent = async (req, res) => {
  try {
    const { status, teacher, subject, page = 1, limit = 10 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }
    if (subject) {
      values.push(subject.toLowerCase());
      conditions.push(`c.subject = $${values.length}`);
    }
    if (teacher) {
      values.push(`%${teacher}%`);
      conditions.push(`u.name ILIKE $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count for pagination meta
    const countResult = await db.query(
      `SELECT COUNT(*) FROM content c JOIN users u ON c.uploaded_by = u.id ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Paginated query
    values.push(parseInt(limit));
    values.push(offset);
    const result = await db.query(
      `SELECT c.*, u.name as teacher_name
       FROM content c
       JOIN users u ON c.uploaded_by = u.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    res.json({
      content: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const approveContent = async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body;

  try {
    const check = await db.query('SELECT * FROM content WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'Content not found' });
    }
    if (check.rows[0].status !== 'pending') {
      return res.status(400).json({ message: `Content is already ${check.rows[0].status}` });
    }

    const content = check.rows[0];

    const result = await db.query(
      `UPDATE content 
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, id]
    );

    const slot = await getOrCreateSlot(content.subject, content.uploaded_by);
    await addToSchedule(content.id, slot.id, duration || 5);

    res.json({ message: 'Content approved and scheduled', content: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

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