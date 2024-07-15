const express = require('express');
const { body } = require('express-validator');

const usersController = require('../controllers/users-controller');
const fileUpload = require('../middleware/file-upload');

const router = express.Router();

router.get('/', usersController.getAllUsers);
router.post(
  '/signup',
  fileUpload.single('image'),
  [
    body('name').notEmpty().isAlpha(),
    body('email').normalizeEmail().isEmail(),
    body('password').isLength({ min: 6 })
  ],
  usersController.signup
);
router.post('/login', usersController.login);

module.exports = router;
