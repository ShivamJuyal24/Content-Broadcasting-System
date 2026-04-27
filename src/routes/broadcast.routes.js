const express = require('express');
const router = express.Router();
const { getLiveContent } = require('../controllers/broadcast.controller.js');

router.get('/live/:teacherId', getLiveContent);

module.exports = router;