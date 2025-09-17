import { Router } from 'express';
import { OrganizationsController } from './organizations.controller';
import { authenticateToken, requireAuth } from '../../shared/middleware/auth-middleware';

const router = Router();
const organizationsController = new OrganizationsController();

// Public endpoints
// Get all organizations (public endpoint)
router.get('/', organizationsController.getOrganizations.bind(organizationsController));

// Get organization statistics (public endpoint) - MUST come before /:id route
router.get('/statistics', organizationsController.getOrganizationStatistics.bind(organizationsController));

// Get doctors by organization (public endpoint)
router.get('/:organizationId/doctors', organizationsController.getDoctorsByOrganization.bind(organizationsController));

// Get organization by ID (public endpoint) - MUST come after specific routes
router.get('/:id', organizationsController.getOrganizationById.bind(organizationsController));

// Protected endpoints (require authentication)
// Create new organization
router.post('/', authenticateToken, requireAuth, organizationsController.createOrganization.bind(organizationsController));

// Update organization
router.put('/:id', authenticateToken, requireAuth, organizationsController.updateOrganization.bind(organizationsController));

// Delete organization
router.delete('/:id', authenticateToken, requireAuth, organizationsController.deleteOrganization.bind(organizationsController));

// Toggle organization status
router.patch('/:id/status', authenticateToken, requireAuth, organizationsController.toggleOrganizationStatus.bind(organizationsController));

export { router as organizationsRoutes };



