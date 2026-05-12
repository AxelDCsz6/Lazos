"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const validate_1 = require("../middleware/validate");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', validate_1.validateAuth, authController_1.register);
// POST /api/auth/login
router.post('/login', validate_1.validateAuth, authController_1.login);
// POST /api/auth/refresh
router.post('/refresh', authController_1.refresh);
// PUT /api/auth/fcm-token
router.put('/fcm-token', auth_1.authMiddleware, authController_1.updateFcmToken);
exports.default = router;
