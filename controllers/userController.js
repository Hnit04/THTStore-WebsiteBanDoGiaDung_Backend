const User = require("../models/User")
const bcrypt = require("bcrypt")

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    res.status(200).json({
      success: true,
      data: user,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
  try {
    const { fullName, phone, address, city, district, ward } = req.body

    // Tìm và cập nhật thông tin người dùng
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        fullName,
        phone,
        address,
        city,
        district,
        ward,
      },
      { new: true, runValidators: true },
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    res.status(200).json({
      success: true,
      data: user,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Kiểm tra xem đã cung cấp đủ thông tin chưa
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới",
      })
    }

    // Lấy thông tin người dùng kèm mật khẩu
    const user = await User.findById(req.user.id).select("+password")

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.matchPassword(currentPassword)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Mật khẩu hiện tại không đúng",
      })
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    })
  } catch (err) {
    next(err)
  }
}
