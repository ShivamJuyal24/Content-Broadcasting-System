const db = require('../models/db.js');

// Step 1: Find or create a slot for this subject+teacher
const getOrCreateSlot = async (subject, teacherId) => {
  // Check if slot already exists
  const existing = await db.query(
    'SELECT * FROM content_slots WHERE subject = $1 AND teacher_id = $2',
    [subject, teacherId]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  // Create new slot if doesn't exist
  const created = await db.query(
    'INSERT INTO content_slots (subject, teacher_id) VALUES ($1, $2) RETURNING *',
    [subject, teacherId]
  );

  return created.rows[0];
};

// Step 2: Add content to schedule with next rotation order
const addToSchedule = async (contentId, slotId, duration = 5) => {
  // Find the highest rotation_order in this slot so far
  const orderResult = await db.query(
    'SELECT COALESCE(MAX(rotation_order), 0) as max_order FROM content_schedule WHERE slot_id = $1',
    [slotId]
  );

  const nextOrder = orderResult.rows[0].max_order + 1;

  const result = await db.query(
    `INSERT INTO content_schedule (content_id, slot_id, rotation_order, duration)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [contentId, slotId, nextOrder, duration]
  );

  return result.rows[0];
};

// Step 3: The core rotation math — finds active content right now
const getActiveContent = async (teacherId, subject = null) => {
  const now = new Date();

  // Build query — filter by subject if provided
  let query = `
    SELECT 
      c.*,
      cs.duration,
      cs.rotation_order,
      cs.slot_id
    FROM content c
    JOIN content_schedule cs ON c.id = cs.content_id
    JOIN content_slots sl ON cs.slot_id = sl.id
    WHERE sl.teacher_id = $1
      AND c.status = 'approved'
      AND c.start_time IS NOT NULL
      AND c.end_time IS NOT NULL
      AND c.start_time <= $2
      AND c.end_time >= $2
  `;

  const params = [teacherId, now];

  if (subject) {
    query += ` AND c.subject = $3`;
    params.push(subject);
  }

  query += ` ORDER BY sl.id, cs.rotation_order ASC`;

  const result = await db.query(query, params);
  const allActive = result.rows;

  if (allActive.length === 0) return null;

  // Group content by slot (each subject has its own slot)
  const slots = {};
  allActive.forEach(row => {
    if (!slots[row.slot_id]) slots[row.slot_id] = [];
    slots[row.slot_id].push(row);
  });

  // For each slot, find which content is active right now
  const activePerSlot = [];

  Object.values(slots).forEach(contents => {
    // Total cycle duration in milliseconds
    const totalCycleMs = contents.reduce((sum, c) => sum + c.duration * 60 * 1000, 0);

    // Use the earliest start_time in this slot as cycle anchor
    const anchor = new Date(Math.min(...contents.map(c => new Date(c.start_time))));

    // How many ms into the current cycle are we?
    const elapsed = (now - anchor) % totalCycleMs;

    // Walk through contents in rotation order to find active one
    let cursor = 0;
    for (const content of contents) {
      const contentDurationMs = content.duration * 60 * 1000;
      if (elapsed >= cursor && elapsed < cursor + contentDurationMs) {
        activePerSlot.push(content);
        break;
      }
      cursor += contentDurationMs;
    }
  });

  return activePerSlot.length > 0 ? activePerSlot : null;
};

module.exports = { getOrCreateSlot, addToSchedule, getActiveContent };