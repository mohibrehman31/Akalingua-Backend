import { Router } from 'express';
const router = Router();
router.get('/test', (req, res) => res.json({ module: 'admin' }));
export default router;
