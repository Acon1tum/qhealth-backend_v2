import { Router } from 'express';
import { DoctorsController } from './doctors.controller';
import { authenticateToken, requireAuth } from '../../shared/middleware/auth-middleware';

const router = Router();
const controller = new DoctorsController();

// Public list and read endpoints (listing doctors doesn't expose sensitive data)
router.get('/', controller.listDoctors.bind(controller));
router.get('/:id', controller.getDoctorById.bind(controller));

// Protected write endpoints
router.post('/', authenticateToken, requireAuth, controller.createDoctor.bind(controller));
router.put('/:id', authenticateToken, requireAuth, controller.updateDoctor.bind(controller));
router.delete('/:id', authenticateToken, requireAuth, controller.deleteDoctor.bind(controller));

export { router as doctorsRoutes };


