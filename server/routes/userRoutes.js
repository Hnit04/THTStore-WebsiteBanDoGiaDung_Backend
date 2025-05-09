const express = require("express")
const { getUserProfile, updateUserProfile, changePassword } = require("../controllers/userController")

const router = express.Router()

const { protect } = require("../middleware/authMiddleware")

router.get("/profile", protect, getUserProfile)
router.put("/profile", protect, updateUserProfile)
router.put("/change-password", protect, changePassword)

module.exports = router
