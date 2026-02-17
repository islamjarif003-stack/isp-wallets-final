
import { Router } from 'express';
import { systemController } from './system.controller';

const router = Router();

router.get('/support-channels', systemController.getSupportChannels);

export const systemRoutes = router;
