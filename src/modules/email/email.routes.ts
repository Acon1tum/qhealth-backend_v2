import { Router } from 'express';
import { sendEmail } from './email.controller';

const router = Router();

// POST /api/email/send
router.post('/send', sendEmail);

export { router as emailRoutes }; 