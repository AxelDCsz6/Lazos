"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuth = void 0;
const express_validator_1 = require("express-validator");
exports.validateAuth = [
    (0, express_validator_1.body)('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('El usuario debe tener entre 3 y 30 caracteres')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Solo letras, números y guión bajo'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres'),
    (req, res, next) => {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ message: errors.array()[0].msg });
            return;
        }
        next();
    },
];
