const pool = require('../config/db');
const {
	fetchCurrentWeather,
	fetchForecast,
	fetchWeatherByCoords,
} = require('../utils/weatherHelper');

function getDaysValue(rawDays) {
	if (rawDays === undefined) {
		return 7;
	}

	const parsed = Number.parseInt(rawDays, 10);
	if (Number.isNaN(parsed) || parsed < 1 || parsed > 14) {
		const error = new Error('Days must be an integer between 1 and 14');
		error.statusCode = 400;
		throw error;
	}

	return parsed;
}

async function getCurrentWeather(req, res, next) {
	try {
		const { city } = req.query;

		if (!city) {
			return res.status(400).json({
				success: false,
				message: 'City query parameter is required',
				data: null,
			});
		}

		const weather = await fetchCurrentWeather(city);

		return res.status(200).json({
			success: true,
			message: 'Current weather fetched successfully',
			data: weather,
		});
	} catch (error) {
		return next(error);
	}
}

async function getForecast(req, res, next) {
	try {
		const { city } = req.query;
		const days = getDaysValue(req.query.days);

		if (!city) {
			return res.status(400).json({
				success: false,
				message: 'City query parameter is required',
				data: null,
			});
		}

		const forecast = await fetchForecast(city, days);

		return res.status(200).json({
			success: true,
			message: 'Forecast fetched successfully',
			data: forecast,
		});
	} catch (error) {
		return next(error);
	}
}

async function getCurrentWeatherByCoords(req, res, next) {
	try {
		const { lat, lon } = req.query;

		if (lat === undefined || lon === undefined) {
			return res.status(400).json({
				success: false,
				message: 'lat and lon query parameters are required',
				data: null,
			});
		}

		const weather = await fetchWeatherByCoords(lat, lon, 1);
		const currentOnly = {
			...weather,
			forecast: [],
		};

		return res.status(200).json({
			success: true,
			message: 'Current weather fetched successfully',
			data: currentOnly,
		});
	} catch (error) {
		return next(error);
	}
}

async function getForecastByCoords(req, res, next) {
	try {
		const { lat, lon } = req.query;
		const days = getDaysValue(req.query.days);

		if (lat === undefined || lon === undefined) {
			return res.status(400).json({
				success: false,
				message: 'lat and lon query parameters are required',
				data: null,
			});
		}

		const forecast = await fetchWeatherByCoords(lat, lon, days);

		return res.status(200).json({
			success: true,
			message: 'Forecast fetched successfully',
			data: forecast,
		});
	} catch (error) {
		return next(error);
	}
}

async function saveLocation(req, res, next) {
	try {
		const { city_name, country_code, latitude, longitude, is_default } = req.body;

		if (!city_name || !String(city_name).trim()) {
			return res.status(400).json({
				success: false,
				message: 'city_name is required',
				data: null,
			});
		}

		const latitudeValue = latitude !== undefined ? Number.parseFloat(latitude) : null;
		const longitudeValue = longitude !== undefined ? Number.parseFloat(longitude) : null;

		if ((latitude !== undefined && Number.isNaN(latitudeValue)) ||
				(longitude !== undefined && Number.isNaN(longitudeValue))) {
			return res.status(400).json({
				success: false,
				message: 'latitude and longitude must be valid numbers',
				data: null,
			});
		}

		const isDefaultValue = Boolean(is_default);

		if (isDefaultValue) {
			await pool.execute('UPDATE saved_locations SET is_default = FALSE WHERE user_id = ?', [
				req.user.user_id,
			]);
		}

		const [result] = await pool.execute(
			`INSERT INTO saved_locations
			 (user_id, city_name, country_code, latitude, longitude, is_default)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				req.user.user_id,
				String(city_name).trim(),
				country_code || null,
				latitudeValue,
				longitudeValue,
				isDefaultValue,
			]
		);

		const [rows] = await pool.execute(
			`SELECT location_id, user_id, city_name, country_code, latitude, longitude, is_default, created_at
			 FROM saved_locations WHERE location_id = ? AND user_id = ? LIMIT 1`,
			[result.insertId, req.user.user_id]
		);

		return res.status(201).json({
			success: true,
			message: 'Location saved successfully',
			data: { location: rows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function getSavedLocations(req, res, next) {
	try {
		const [rows] = await pool.execute(
			`SELECT location_id, user_id, city_name, country_code, latitude, longitude, is_default, created_at
			 FROM saved_locations
			 WHERE user_id = ?
			 ORDER BY is_default DESC, created_at DESC`,
			[req.user.user_id]
		);

		return res.status(200).json({
			success: true,
			message: 'Saved locations fetched successfully',
			data: { locations: rows },
		});
	} catch (error) {
		return next(error);
	}
}

async function deleteLocation(req, res, next) {
	try {
		const locationId = Number.parseInt(req.params.id, 10);

		if (Number.isNaN(locationId)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid location id',
				data: null,
			});
		}

		const [result] = await pool.execute(
			'DELETE FROM saved_locations WHERE location_id = ? AND user_id = ?',
			[locationId, req.user.user_id]
		);

		if (result.affectedRows === 0) {
			return res.status(404).json({
				success: false,
				message: 'Location not found',
				data: null,
			});
		}

		return res.status(200).json({
			success: true,
			message: 'Location deleted successfully',
			data: null,
		});
	} catch (error) {
		return next(error);
	}
}

async function getWeatherForSavedLocations(req, res, next) {
	try {
		const [locations] = await pool.execute(
			`SELECT location_id, user_id, city_name, country_code, latitude, longitude, is_default, created_at
			 FROM saved_locations
			 WHERE user_id = ?
			 ORDER BY is_default DESC, created_at DESC`,
			[req.user.user_id]
		);

		const weatherResults = await Promise.all(
			locations.map(async (location) => {
				let currentWeather;

				if (location.latitude !== null && location.longitude !== null) {
					const weatherByCoords = await fetchWeatherByCoords(location.latitude, location.longitude, 1);
					currentWeather = {
						...weatherByCoords,
						forecast: [],
					};
				} else {
					currentWeather = await fetchCurrentWeather(location.city_name);
				}

				return {
					location,
					current_weather: currentWeather,
				};
			})
		);

		return res.status(200).json({
			success: true,
			message: 'Weather for saved locations fetched successfully',
			data: { locations: weatherResults },
		});
	} catch (error) {
		return next(error);
	}
}

module.exports = {
	getCurrentWeather,
	getForecast,
	getCurrentWeatherByCoords,
	getForecastByCoords,
	saveLocation,
	getSavedLocations,
	deleteLocation,
	getWeatherForSavedLocations,
};
