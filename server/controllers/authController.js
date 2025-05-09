const User = require("../models/User")

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
    })

    sendTokenResponse(user, 201, res)
  } catch (err) {
    next(err)
  }
}

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập email và mật khẩu",
      })
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password")

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Thông tin đăng nhập không hợp lệ",
      })
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Thông tin đăng nhập không hợp lệ",
      })
    }

    sendTokenResponse(user, 200, res)
  } catch (err) {
    next(err)
  }
}

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    res.status(200).json({
      success: true,
      data: user,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Log user out / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  // Sửa cách thiết lập cookie khi đăng xuất
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000), // 10 giây
    httpOnly: true,
  })

  res.status(200).json({
    success: true,
    data: {},
  })
}

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken()

  const options = {
    // Sửa cách thiết lập thời gian hết hạn
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
    httpOnly: true,
  }

  if (process.env.NODE_ENV === "production") {
    options.secure = true
  }

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    })
}
