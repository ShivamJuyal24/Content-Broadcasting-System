const { getActiveContent } = require('../services/scheduling.service.js');

const getLiveContent = async (req, res) => {
  const { teacherId } = req.params;
  const { subject } = req.query;

  // Validate UUID format before hitting DB
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(teacherId)) {
    return res.json({ message: 'No content available' });
  }

  try {
    const active = await getActiveContent(teacherId, subject || null);

    if (!active || active.length === 0) {
      return res.json({ message: 'No content available' });
    }
    // Clean up the response to only include necessary fields
    const cleaned = active.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      subject: c.subject,
      file_url: c.file_url,
      file_type: c.file_type,
      duration: c.duration,
      rotation_order: c.rotation_order,
      start_time: c.start_time,
      end_time: c.end_time
    }));

    res.json({ active_content: cleaned });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getLiveContent };