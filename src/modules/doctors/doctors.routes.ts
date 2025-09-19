import { Router } from 'express';
import { DoctorsController } from './doctors.controller';
import { authenticateToken, requireAuth, requireAdmin } from '../../shared/middleware/auth-middleware';

const router = Router();
const controller = new DoctorsController();

// Public list and read endpoints (listing doctors doesn't expose sensitive data)
router.get('/', controller.listDoctors.bind(controller));
router.get('/:id', controller.getDoctorById.bind(controller));

// Protected write endpoints - only admins can create, update, delete doctors
router.post('/', authenticateToken, requireAdmin, controller.createDoctor.bind(controller));
router.put('/:id', authenticateToken, requireAdmin, controller.updateDoctor.bind(controller));
router.delete('/:id', authenticateToken, requireAdmin, controller.deleteDoctor.bind(controller));

export { router as doctorsRoutes };


