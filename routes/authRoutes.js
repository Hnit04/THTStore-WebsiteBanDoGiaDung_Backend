const express = require("express")
const { register, login, getMe, logout, verifyEmail, forgotPassword, verifyResetCode, resetPassword } = require("../controllers/authController")

const router = express.Router()

const { protect } = require("../middleware/authMiddleware")

router.post("/register", register)
router.post("/login", login)
router.post("/verify-email", verifyEmail)
router.post("/forgot-password", forgotPassword)
router.post("/verify-reset-code", verifyResetCode)
router.post("/reset-password", resetPassword)
router.get("/me", protect, getMe)
router.post("/logout", protect, logout)

module.exports = router