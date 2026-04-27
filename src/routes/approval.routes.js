const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { getPendingContent, getAllContent, approveContent, rejectContent } = require('../controllers/approval.controller');

// All routes here are principal only
router.get('/pending', authenticate, authorize('principal'), getPendingContent);
router.get('/all', authenticate, authorize('principal'), getAllContent);
router.post('/:id/approve', authenticate, authorize('principal'), approveContent);
router.post('/:id/reject', authenticate, authorize('principal'), rejectContent);

module.exports = router;