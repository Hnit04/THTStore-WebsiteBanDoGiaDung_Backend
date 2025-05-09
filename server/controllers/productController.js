const Product = require("../models/Product")

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    let query

    // Copy req.query
    const reqQuery = { ...req.query }

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"]

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param])

    // Create query string
    let queryStr = JSON.stringify(reqQuery)

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`)

    // Finding resource
    query = Product.find(JSON.parse(queryStr)).populate("category")

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ")
      query = query.select(fields)
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ")
      query = query.sort(sortBy)
    } else {
      query = query.sort("-createdAt")
    }

    // Pagination
    const page = Number.parseInt(req.query.page, 10) || 1
    const limit = Number.parseInt(req.query.limit, 10) || 10
    const startIndex = (page - 1) * limit
    const endIndex = page * limit
    const total = await Product.countDocuments()

    query = query.skip(startIndex).limit(limit)

    // Executing query
    const products = await query

    // Pagination result
    const pagination = {}

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      }
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      }
    }

    res.status(200).json({
      success: true,
      count: products.length,
      pagination,
      data: products,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("category")

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm",
      })
    }

    res.status(200).json({
      success: true,
      data: product,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Create new product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id

    const product = await Product.create(req.body)

    res.status(201).json({
      success: true,
      data: product,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm",
      })
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })

    res.status(200).json({
      success: true,
      data: product,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm",
      })
    }

    await product.remove()

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (err) {
    next(err)
  }
}
