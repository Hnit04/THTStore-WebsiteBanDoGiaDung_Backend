const Product = require("../models/Product");

// @desc    Get all products with filter + pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    // Lọc theo category_id
    if (req.query.category) {
      filter.category_id = req.query.category;
    }

    // Tìm kiếm theo tên
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: "i" };
    }

    // Lọc theo giá
    if (req.query["price[gte]"]) {
      filter.price = { ...filter.price, $gte: Number(req.query["price[gte]"]) };
    }
    if (req.query["price[lte]"]) {
      filter.price = { ...filter.price, $lte: Number(req.query["price[lte]"]) };
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).skip(skip).limit(limit);

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Lỗi getProducts:", error);
    res.status(500).json({ success: false, error: "Lỗi server khi lấy sản phẩm" });
  }
};

// @desc    Get single product
// @route   GET /api/products/:_id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params._id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm",
      });
    }
    console.log("Product found:", product._id);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res, next) => {
  try {
    req.body.user = req.user._id;
    const product = await Product.create(req.body);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update product
// @route   PUT /api/products/:_id
// @access  Private
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params._id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm",
      });
    }
    product = await Product.findByIdAndUpdate(req.params._id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:_id
// @access  Private
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params._id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm",
      });
    }
    await product.deleteOne();
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};