// server/routes/categoryRoutes.js
const express = require('express');
const { getCategories } = require('../controllers/categoryController');

const router = express.Router();

// Lấy danh sách danh mục
router.get('/', getCategories);

module.exports = router;