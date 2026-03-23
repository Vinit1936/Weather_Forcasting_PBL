const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const pool = require('../config/db');

const registerValidators = [
	body('full_name').trim().notEmpty().withMessage('Full name is required'),
	body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
	body('password')
		.isLength({ min: 8 })
		.withMessage('Password must be at least 8 characters long'),
];

const loginValidators = [
	body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
	body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileValidators = [
	body('full_name').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
	body('profile_pic').optional().isString().withMessage('Profile picture must be a string URL'),
];

async function runValidators(req, validators) {
	await Promise.all(validators.map((validator) => validator.run(req)));
	return validationResult(req);
}

function signToken(user) {
	return jwt.sign(
		{ user_id: user.user_id, email: user.email },
		process.env.JWT_SECRET,
		{ expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
	);
}

async function register(req, res, next) {
	try {
		const errors = await runValidators(req, registerValidators);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				data: { errors: errors.array() },
			});
		}

		const { full_name, email, password } = req.body;

		const [existingUsers] = await pool.execute(
			'SELECT user_id FROM users WHERE email = ? LIMIT 1',
			[email]
		);

		if (existingUsers.length > 0) {
			return res.status(409).json({
				success: false,
				message: 'Email is already registered',
				data: null,
			});
		}

		const passwordHash = await bcrypt.hash(password, 12);

		const [result] = await pool.execute(
			'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
			[full_name, email, passwordHash]
		);

		const [rows] = await pool.execute(
			`SELECT user_id, full_name, email, profile_pic, created_at, updated_at
			 FROM users WHERE user_id = ? LIMIT 1`,
			[result.insertId]
		);

		const user = rows[0];
		const token = signToken(user);

		return res.status(201).json({
			success: true,
			message: 'Registration successful',
			data: { token, user },
		});
	} catch (error) {
		return next(error);
	}
}

async function login(req, res, next) {
	try {
		const errors = await runValidators(req, loginValidators);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				data: { errors: errors.array() },
			});
		}

		const { email, password } = req.body;

		const [rows] = await pool.execute(
			`SELECT user_id, full_name, email, password_hash, profile_pic, created_at, updated_at
			 FROM users WHERE email = ? LIMIT 1`,
			[email]
		);

		if (rows.length === 0) {
			return res.status(401).json({
				success: false,
				message: 'Invalid email or password',
				data: null,
			});
		}

		const userRecord = rows[0];
		const isMatch = await bcrypt.compare(password, userRecord.password_hash);

		if (!isMatch) {
			return res.status(401).json({
				success: false,
				message: 'Invalid email or password',
				data: null,
			});
		}

		const user = {
			user_id: userRecord.user_id,
			full_name: userRecord.full_name,
			email: userRecord.email,
			profile_pic: userRecord.profile_pic,
			created_at: userRecord.created_at,
			updated_at: userRecord.updated_at,
		};
		const token = signToken(user);

		return res.status(200).json({
			success: true,
			message: 'Login successful',
			data: { token, user },
		});
	} catch (error) {
		return next(error);
	}
}

async function getProfile(req, res, next) {
	try {
		const [rows] = await pool.execute(
			`SELECT user_id, full_name, email, profile_pic, created_at, updated_at
			 FROM users WHERE user_id = ? LIMIT 1`,
			[req.user.user_id]
		);

		if (rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
				data: null,
			});
		}

		return res.status(200).json({
			success: true,
			message: 'Profile fetched successfully',
			data: { user: rows[0] },
		});
	} catch (error) {
		return next(error);
	}
}

async function updateProfile(req, res, next) {
	try {
		const errors = await runValidators(req, updateProfileValidators);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
				data: { errors: errors.array() },
			});
		}

		const { full_name, profile_pic } = req.body;
		const updates = [];
		const values = [];

		if (full_name !== undefined) {
			updates.push('full_name = ?');
			values.push(full_name);
		}

		if (profile_pic !== undefined) {
			updates.push('profile_pic = ?');
			values.push(profile_pic);
		}

		if (updates.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'No fields provided for update',
				data: null,
			});
		}

		values.push(req.user.user_id);

		await pool.execute(
			`UPDATE users
			 SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ?`,
			values
		);

		const [rows] = await pool.execute(
			`SELECT user_id, full_name, email, profile_pic, created_at, updated_at
			 FROM users WHERE user_id = ? LIMIT 1`,
			[req.user.user_id]
		);

		if (rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
				data: null,
			});
		}

		return res.status(200).json({
			success: true,
			message: 'Profile updated successfully',
			data: { user: rows[0] },
		});
	} catch (error) {
		return next(error);
	}
}

module.exports = {
	register,
	login,
	getProfile,
	updateProfile,
};
