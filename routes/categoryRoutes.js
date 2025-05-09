// server/routes/categoryRoutes.js
const express = require('express');
const { getCategories, getCategoryById, updateCategory, deleteCategory } = require('../controllers/categoryController');
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const { getProduct } = require('../controllers/productController');

// Lấy danh sách danh mục
router.get('/', getCategories);
router
     .route("/:_id")
     .get(getCategoryById)
     .put(protect, authorize("admin"), updateCategory)
     .delete(protect, authorize("admin"), deleteCategory);
module.exports = router;