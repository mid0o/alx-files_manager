import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = express.Router();

// General status and stats (Task 2)
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// User endpoints (Tasks 3, 4, 11)
router.post('/users', UsersController.postNew);
router.get('/users/me', UsersController.getMe);

// Auth endpoints (Task 4)
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);

// File endpoints (Tasks 5, 6, 7, 8, 9)
router.post('/files', FilesController.postUpload);
router.get('/files/:id', FilesController.getShow);
router.get('/files', FilesController.getIndex);
router.put('/files/:id/publish', FilesController.putPublish);
router.put('/files/:id/unpublish', FilesController.putUnpublish);
router.get('/files/:id/data', FilesController.getFile);

export default router;
