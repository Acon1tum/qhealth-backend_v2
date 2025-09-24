"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorsRoutes = void 0;
const express_1 = require("express");
const doctors_controller_1 = require("./doctors.controller");
const auth_middleware_1 = require("../../shared/middleware/auth-middleware");
const router = (0, express_1.Router)();
exports.doctorsRoutes = router;
const controller = new doctors_controller_1.DoctorsController();
// Public list and read endpoints (listing doctors doesn't expose sensitive data)
router.get('/', controller.listDoctors.bind(controller));
router.get('/:id', controller.getDoctorById.bind(controller));
// Protected write endpoints - only admins can create, update, delete doctors
router.post('/', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdmin, controller.createDoctor.bind(controller));
router.put('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdmin, controller.updateDoctor.bind(controller));
router.delete('/:id', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdmin, controller.deleteDoctor.bind(controller));
