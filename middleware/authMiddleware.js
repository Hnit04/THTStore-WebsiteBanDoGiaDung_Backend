const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    // Set token from cookie
    token = req.cookies.token;
  }

  // Log để debug
  if (!token) {
    console.log("No token provided", {
      method: req.method,
      url: req.url,
      headers: req.headers,
    });
    return res.status(401).json({
      success: false,
      error: "Không có quyền truy cập vào tài nguyên này",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      console.log("User not found for token", { token });
      return res.status(401).json({
        success: false,
        error: "Không có quyền truy cập vào tài nguyên này",
      });
    }

    next();
  } catch (err) {
    console.log("Token verification failed", {
      error: err.message,
      token,
    });
    return res.status(401).json({
      success: false,
      error: "Không có quyền truy cập vào tài nguyên này",
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log("Role not authorized", {
        userRole: req.user.role,
        requiredRoles: roles,
      });
      return res.status(403).json({
        success: false,
        error: `Vai trò ${req.user.role} không có quyền truy cập vào tài nguyên này`,
      });
    }
    next();
  };
};