import { Router } from 'express';
import { LabRequestsController } from './lab-requests.controller';
import { authenticateToken } from '../../shared/middleware/auth-middleware';

const router = Router();
const labRequestsController = new LabRequestsController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/lab-requests - Get all lab requests with optional filtering
router.get('/', (req, res) => {
  labRequestsController.getLabRequests(req, res);
});

// GET /api/lab-requests/:id - Get lab request by ID
router.get('/:id', (req, res) => {
  labRequestsController.getLabRequestById(req, res);
});

// POST /api/lab-requests - Create new lab request
router.post('/', (req, res) => {
  labRequestsController.createLabRequest(req, res);
});

// PUT /api/lab-requests/:id - Update lab request
router.put('/:id', (req, res) => {
  labRequestsController.updateLabRequest(req, res);
});

// PATCH /api/lab-requests/:id/status - Update lab request status
router.patch('/:id/status', (req, res) => {
  labRequestsController.updateLabRequestStatus(req, res);
});

// DELETE /api/lab-requests/:id - Delete lab request
router.delete('/:id', (req, res) => {
  labRequestsController.deleteLabRequest(req, res);
});

// GET /api/lab-requests/patient/:patientId - Get lab requests for specific patient
router.get('/patient/:patientId', (req, res) => {
  labRequestsController.getPatientLabRequests(req, res);
});

// GET /api/lab-requests/doctor/:doctorId - Get lab requests for specific doctor
router.get('/doctor/:doctorId', (req, res) => {
  labRequestsController.getDoctorLabRequests(req, res);
});

// GET /api/lab-requests/:id/export/pdf - Export lab request as PDF
router.get('/:id/export/pdf', (req, res) => {
  labRequestsController.exportLabRequestAsPDF(req, res);
});

export default router;
