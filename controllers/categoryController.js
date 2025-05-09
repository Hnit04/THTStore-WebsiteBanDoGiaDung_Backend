// server/controllers/categoryController.js
const Category = require('../models/Category');

// Lấy danh sách danh mục
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories };