import { Router } from 'express';
import * as imagesController from './images.controller';

export const imagesRouter = Router();

// Public on purpose: an <img> tag cannot send a Bearer token. Image ids are random UUIDs that cannot be guessed.
imagesRouter.get('/:id', imagesController.getImage);
