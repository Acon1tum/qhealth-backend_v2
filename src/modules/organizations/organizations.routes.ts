import { Router } from 'express';
import { OrganizationsController } from './organizations.controller';

const router = Router();
const organizationsController = new OrganizationsController();

// Get all active organizations (public endpoint)
router.get('/', organizationsController.getOrganizations.bind(organizationsController));

// Get organization by ID (public endpoint)
router.get('/:id', organizationsController.getOrganizationById.bind(organizationsController));

// Get doctors by organization (public endpoint)
router.get('/:organizationId/doctors', organizationsController.getDoctorsByOrganization.bind(organizationsController));

export { router as organizationsRoutes };



