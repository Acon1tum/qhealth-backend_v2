"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailRoutes = void 0;
const express_1 = require("express");
const email_controller_1 = require("./email.controller");
const router = (0, express_1.Router)();
exports.emailRoutes = router;
// POST /api/email/send
router.post('/send', email_controller_1.sendEmail);
