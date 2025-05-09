const User = require("../models/User")
const sendEmail = require("../utils/sendEmail")
const crypto = require("crypto")

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email đã được sử dụng",
      })
    }

    // Tạo mã xác nhận
    const verificationCode = crypto.randomBytes(3).toString("hex").toUpperCase()
    const verificationCodeExpiry = Date.now() + 10 * 60 * 1000 // 10 phút

    console.log(`[Register] Generated verification code for ${email}: ${verificationCode}`);
    console.log(`[Register] Code expiry: ${new Date(verificationCodeExpiry)}`);

    // Tạo user
    const user = await User.create({
      fullName,
      email,
      password,
      verificationCode,
      verificationCodeExpiry,
    })

    // Gửi email xác thua
    const message = `Mã xác nhận của bạn là: ${verificationCode}\nMã này sẽ hết hạn sau 10 phút.`
    await sendEmail({
      email: user.email,
      subject: "Xác nhận Email - THT Store",
      message,
    })

    res.status(201).json({
      success: true,
      data: { id: user._id, email: user.email },
      message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.",
    })
  } catch (err) {
    console.error("[Register] Error:", err);
    next(err)
  }
}

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, verificationCode } = req.body

    console.log(`[VerifyEmail] Received request for ${email} with code: ${verificationCode}`);

    const user = await User.findOne({ email })

    if (!user) {
      console.log(`[VerifyEmail] User not found for email: ${email}`);
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    console.log(`[VerifyEmail] Stored code: ${user.verificationCode}, Expiry: ${new Date(user.verificationCodeExpiry)}`);

    if (user.isEmailVerified) {
      console.log(`[VerifyEmail] Email already verified for ${email}`);
      return res.status(400).json({
        success: false,
        error: "Email đã được xác nhận",
      })
    }

    if (
        user.verificationCode !== verificationCode ||
        user.verificationCodeExpiry < Date.now()
    ) {
      console.log(`[VerifyEmail] Code mismatch or expired for ${email}. Received: ${verificationCode}, Expected: ${user.verificationCode}, Expiry: ${user.verificationCodeExpiry < Date.now() ? 'Expired' : 'Valid'}`);
      return res.status(400).json({
        success: false,
        error: "Mã xác nhận không hợp lệ hoặc đã hết hạn",
      })
    }

    user.isEmailVerified = true
    user.verificationCode = undefined
    user.verificationCodeExpiry = undefined
    await user.save()

    console.log(`[VerifyEmail] Email verified successfully for ${email}`);

    res.status(200).json({
      success: true,
      message: "Email đã được xác nhận thành công",
    })
  } catch (err) {
    console.error("[VerifyEmail] Error:", err);
    next(err)
  }
}

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body

    console.log(`[ForgotPassword] Received request for ${email}`);

    const user = await User.findOne({ email })

    if (!user) {
      console.log(`[ForgotPassword] User not found for email: ${email}`);
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    // Tạo mã đặt lại mật khẩu
    const resetCode = crypto.randomBytes(3).toString("hex").toUpperCase()
    const resetCodeExpiry = Date.now() + 10 * 60 * 1000 // 10 phút

    console.log(`[ForgotPassword] Generated reset code for ${email}: ${resetCode}`);
    console.log(`[ForgotPassword] Code expiry: ${new Date(resetCodeExpiry)}`);

    user.resetPasswordCode = resetCode
    user.resetPasswordExpiry = resetCodeExpiry
    await user.save()

    // Gửi email với mã đặt lại
    const message = `Mã đặt lại mật khẩu của bạn là: ${resetCode}\nMã này sẽ hết hạn sau 10 phút.`
    await sendEmail({
      email: user.email,
      subject: "Đặt lại mật khẩu - THT Store",
      message,
    })

    res.status(200).json({
      success: true,
      message: "Mã đặt lại mật khẩu đã được gửi đến email của bạn",
    })
  } catch (err) {
    console.error("[ForgotPassword] Error:", err);
    next(err)
  }
}

// @desc    Verify reset code
// @route   POST /api/auth/verify-reset-code
// @access  Public
exports.verifyResetCode = async (req, res, next) => {
  try {
    const { email, resetCode } = req.body

    console.log(`[VerifyResetCode] Received request for ${email} with code: ${resetCode}`);

    const user = await User.findOne({ email })

    if (!user) {
      console.log(`[VerifyResetCode] User not found for email: ${email}`);
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    console.log(`[VerifyResetCode] Stored code: ${user.resetPasswordCode}, Expiry: ${new Date(user.resetPasswordExpiry)}`);

    if (
        user.resetPasswordCode !== resetCode ||
        user.resetPasswordExpiry < Date.now()
    ) {
      console.log(`[VerifyResetCode] Code mismatch or expired for ${email}. Received: ${resetCode}, Expected: ${user.resetPasswordCode}, Expiry: ${user.resetPasswordExpiry < Date.now() ? 'Expired' : 'Valid'}`);
      return res.status(400).json({
        success: false,
        error: "Mã đặt lại không hợp lệ hoặc đã hết hạn",
      })
    }

    res.status(200).json({
      success: true,
      message: "Mã đặt lại hợp lệ",
    })
  } catch (err) {
    console.error("[VerifyResetCode] Error:", err);
    next(err)
  }
}

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, resetCode, newPassword } = req.body

    console.log(`[ResetPassword] Received request for ${email}`);

    const user = await User.findOne({ email })

    if (!user) {
      console.log(`[ResetPassword] User not found for email: ${email}`);
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    console.log(`[ResetPassword] Stored code: ${user.resetPasswordCode}, Expiry: ${new Date(user.resetPasswordExpiry)}`);

    if (
        user.resetPasswordCode !== resetCode ||
        user.resetPasswordExpiry < Date.now()
    ) {
      console.log(`[ResetPassword] Code mismatch or expired for ${email}. Received: ${resetCode}, Expected: ${user.resetPasswordCode}, Expiry: ${user.resetPasswordExpiry < Date.now() ? 'Expired' : 'Valid'}`);
      return res.status(400).json({
        success: false,
        error: "Mã đặt lại không hợp lệ hoặc đã hết hạn",
      })
    }

    user.password = newPassword
    user.resetPasswordCode = undefined
    user.resetPasswordExpiry = undefined
    await user.save()

    console.log(`[ResetPassword] Password reset successful for ${email}`);

    res.status(200).json({
      success: true,
      message: "Đặt lại mật khẩu thành công",
    })
  } catch (err) {
    console.error("[ResetPassword] Error:", err);
    next(err)
  }
}

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập email và mật khẩu",
      })
    }

    const user = await User.findOne({ email }).select("+password")

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Thông tin đăng nhập không hợp lệ",
      })
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        error: "Vui lòng xác nhận email trước khi đăng nhập",
      })
    }

    const isMatch = await user.matchPassword(password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Thông tin đăng nhập không hợp lệ",
      })
    }

    const token = user.getSignedJwtToken()

    const options = {
      expires: new Date(Date.now() + Number(process.env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000),
      httpOnly: true,
    }

    if (process.env.NODE_ENV === "production") {
      options.secure = true
    }

    res.status(200).cookie("token", token, options).json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)

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
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  })

  res.status(200).json({
    success: true,
    data: {},
  })
}