const Category = require('../models/Category');

// Lấy danh sách tất cả danh mục
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// Lấy danh mục theo ID
const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params._id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Danh mục không tồn tại', status: 404 });
    }
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

// Tạo mới danh mục
const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body; // Giả sử dữ liệu gửi lên có field 'name'
    if (!name) {
      return res.status(400).json({ success: false, error: 'Tên danh mục là bắt buộc', status: 400 });
    }

    const newCategory = new Category({ name });
    const savedCategory = await newCategory.save();
    res.status(201).json({ success: true, data: savedCategory });
  } catch (error) {
    next(error);
  }
};

// Cập nhật danh mục
const updateCategory = async (req, res, next) => {
  try {
    const { name } = req.body; // Giả sử chỉ cập nhật tên
    if (!name) {
      return res.status(400).json({ success: false, error: 'Tên danh mục là bắt buộc', status: 400 });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true, runValidators: true } // Trả về tài liệu đã cập nhật và chạy validator
    );
    if (!category) {
      return res.status(404).json({ success: false, error: 'Danh mục không tồn tại', status: 404 });
    }
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

// Xóa danh mục
const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Danh mục không tồn tại', status: 404 });
    }
    res.json({ success: true, message: 'Danh mục đã được xóa' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};