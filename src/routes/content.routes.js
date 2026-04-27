const express = require('express');
const router = express.Router();
const upload = require('../utils/storage');
const { authenticate, authorize } = require('../middlewares/auth.middleware.js');
const { uploadContent, getMyContent } = require('../controllers/content.controller.js');

// Only teachers can upload
router.post('/upload', authenticate, authorize('teacher'), upload.single('file'), uploadContent);

// Teacher views their own uploads
router.get('/my', authenticate, authorize('teacher'), getMyContent);

module.exports = router;