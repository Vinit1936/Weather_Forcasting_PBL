const pool = require('../config/db');
const { fetchWeatherByCoords } = require('../utils/weatherHelper');

const ALLOWED_TRIP_STATUS = new Set(['planned', 'ongoing', 'completed', 'cancelled']);
const ALLOWED_PACKING_CATEGORIES = new Set([
	'clothing',
	'documents',
	'electronics',
	'toiletries',
	'medicine',
	'other',
]);

function createError(message, statusCode = 400) {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
}

function parseDate(value, fieldName) {
	if (!value) {
		throw createError(`${fieldName} is required`, 400);
	}

	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) {
		throw createError(`${fieldName} must be a valid date`, 400);
	}

	return date;
}

function parseOptionalDate(value, fieldName) {
	if (value === undefined || value === null || value === '') {
		return null;
	}

	return parseDate(value, fieldName);
}

function formatDate(date) {
	return date.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start, end) {
	const diffMs = end.getTime() - start.getTime();
	return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

async function getTripOrThrow(tripId, userId) {
	const [rows] = await pool.execute(
		`SELECT trip_id, user_id, trip_name, description, start_date, end_date, status, created_at
		 FROM trips WHERE trip_id = ? AND user_id = ? LIMIT 1`,
		[tripId, userId]
	);

	if (!rows.length) {
		throw createError('Trip not found', 404);
	}

	return rows[0];
}

function buildSnapshotStats(weatherData) {
	const forecastDays = weatherData?.forecast || [];
	if (!forecastDays.length) {
		return {
			tempMin: null,
			tempMax: null,
			conditionText: weatherData?.condition?.text || null,
			conditionIcon: weatherData?.condition?.icon || null,
			humidity: weatherData?.humidity || null,
			windSpeed: weatherData?.wind_kph || null,
			precipitationMm: null,
		};
	}

	const minTemps = forecastDays.map((day) => day.min_c).filter((n) => n !== null && n !== undefined);
	const maxTemps = forecastDays.map((day) => day.max_c).filter((n) => n !== null && n !== undefined);
	const allHours = forecastDays.flatMap((day) => day.hourly || []);
	const humidities = allHours.map((h) => h.humidity).filter((n) => n !== null && n !== undefined);
	const winds = allHours.map((h) => h.wind_kph).filter((n) => n !== null && n !== undefined);
	const precipitations = allHours
		.map((h) => h.precip_mm)
		.filter((n) => n !== null && n !== undefined);

	const firstCondition = forecastDays[0]?.condition;

	return {
		tempMin: minTemps.length ? Math.min(...minTemps) : null,
		tempMax: maxTemps.length ? Math.max(...maxTemps) : null,
		conditionText: firstCondition?.text || weatherData?.condition?.text || null,
		conditionIcon: firstCondition?.icon || weatherData?.condition?.icon || null,
		humidity: humidities.length
			? Math.round(humidities.reduce((sum, n) => sum + n, 0) / humidities.length)
			: null,
		windSpeed: winds.length ? Math.max(...winds) : null,
		precipitationMm: precipitations.length ? Math.max(...precipitations) : null,
	};
}

async function upsertDestinationSnapshot(destinationId, weatherData) {
	const stats = buildSnapshotStats(weatherData);

	await pool.execute('DELETE FROM weather_snapshots WHERE destination_id = ?', [destinationId]);

	await pool.execute(
		`INSERT INTO weather_snapshots
		 (destination_id, temp_min, temp_max, condition_text, condition_icon, humidity, wind_speed, precipitation_mm, forecast_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			destinationId,
			stats.tempMin,
			stats.tempMax,
			stats.conditionText,
			stats.conditionIcon,
			stats.humidity,
			stats.windSpeed,
			stats.precipitationMm,
			JSON.stringify(weatherData),
		]
	);
}

async function createTrip(req, res, next) {
	try {
		const { trip_name, description, start_date, end_date } = req.body;

		if (!trip_name || !String(trip_name).trim()) {
			throw createError('trip_name is required', 400);
		}

		const startDate = parseDate(start_date, 'start_date');
		const endDate = parseDate(end_date, 'end_date');
		if (endDate <= startDate) {
			throw createError('end_date must be after start_date', 400);
		}

		const [result] = await pool.execute(
			`INSERT INTO trips (user_id, trip_name, description, start_date, end_date)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				req.user.user_id,
				String(trip_name).trim(),
				description || null,
				formatDate(startDate),
				formatDate(endDate),
			]
		);

		const [rows] = await pool.execute(
			`SELECT trip_id, user_id, trip_name, description, start_date, end_date, status, created_at
			 FROM trips WHERE trip_id = ? LIMIT 1`,
			[result.insertId]
		);

		return res.status(201).json({
			success: true,
			message: 'Trip created successfully',
			data: { trip: rows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function getUserTrips(req, res, next) {
	try {
		const { status } = req.query;

		if (status && !ALLOWED_TRIP_STATUS.has(status)) {
			throw createError('Invalid status filter', 400);
		}

		const params = [req.user.user_id];
		let statusClause = '';
		if (status) {
			statusClause = 'AND t.status = ?';
			params.push(status);
		}

		const [rows] = await pool.execute(
			`SELECT
				 t.trip_id,
				 t.user_id,
				 t.trip_name,
				 t.description,
				 t.start_date,
				 t.end_date,
				 t.status,
				 t.created_at,
				 COUNT(td.destination_id) AS destination_count
			 FROM trips t
			 LEFT JOIN trip_destinations td ON td.trip_id = t.trip_id
			 WHERE t.user_id = ? ${statusClause}
			 GROUP BY t.trip_id
			 ORDER BY t.start_date ASC`,
			params
		);

		return res.status(200).json({
			success: true,
			message: 'Trips fetched successfully',
			data: { trips: rows },
		});
	} catch (error) {
		return next(error);
	}
}

async function getTripById(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Invalid trip id', 400);
		}

		const trip = await getTripOrThrow(tripId, req.user.user_id);

		const [destinations] = await pool.execute(
			`SELECT destination_id, trip_id, city_name, country_code, latitude, longitude,
							arrival_date, departure_date, stop_order, notes
			 FROM trip_destinations
			 WHERE trip_id = ?
			 ORDER BY stop_order ASC, destination_id ASC`,
			[tripId]
		);

		const [snapshots] = await pool.execute(
			`SELECT ws.snapshot_id, ws.destination_id, ws.fetched_at, ws.temp_min, ws.temp_max,
							ws.condition_text, ws.condition_icon, ws.humidity, ws.wind_speed, ws.precipitation_mm,
							ws.forecast_json
			 FROM weather_snapshots ws
			 INNER JOIN trip_destinations td ON td.destination_id = ws.destination_id
			 WHERE td.trip_id = ?
			 ORDER BY ws.fetched_at DESC`,
			[tripId]
		);

		const snapshotsByDestination = snapshots.reduce((acc, snapshot) => {
			if (!acc[snapshot.destination_id]) {
				acc[snapshot.destination_id] = [];
			}
			acc[snapshot.destination_id].push({
				...snapshot,
				forecast_json: (() => {
					try {
						return JSON.parse(snapshot.forecast_json);
					} catch (_err) {
						return snapshot.forecast_json;
					}
				})(),
			});
			return acc;
		}, {});

		const destinationsWithSnapshots = destinations.map((destination) => ({
			...destination,
			weather_snapshots: snapshotsByDestination[destination.destination_id] || [],
		}));

		const [packingItems] = await pool.execute(
			`SELECT item_id, trip_id, item_name, category, is_packed, weather_suggested
			 FROM packing_items
			 WHERE trip_id = ?
			 ORDER BY item_id DESC`,
			[tripId]
		);

		return res.status(200).json({
			success: true,
			message: 'Trip fetched successfully',
			data: {
				trip,
				destinations: destinationsWithSnapshots,
				packing_items: packingItems,
			},
		});
	} catch (error) {
		return next(error);
	}
}

async function updateTrip(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Invalid trip id', 400);
		}

		const currentTrip = await getTripOrThrow(tripId, req.user.user_id);
		const { trip_name, description, start_date, end_date, status } = req.body;

		const nextStartDate = start_date ? parseDate(start_date, 'start_date') : new Date(currentTrip.start_date);
		const nextEndDate = end_date ? parseDate(end_date, 'end_date') : new Date(currentTrip.end_date);

		if (nextEndDate <= nextStartDate) {
			throw createError('end_date must be after start_date', 400);
		}

		if (status !== undefined && !ALLOWED_TRIP_STATUS.has(status)) {
			throw createError('Invalid trip status', 400);
		}

		await pool.execute(
			`UPDATE trips
			 SET trip_name = ?,
					 description = ?,
					 start_date = ?,
					 end_date = ?,
					 status = ?
			 WHERE trip_id = ? AND user_id = ?`,
			[
				trip_name !== undefined ? String(trip_name).trim() : currentTrip.trip_name,
				description !== undefined ? description : currentTrip.description,
				formatDate(nextStartDate),
				formatDate(nextEndDate),
				status !== undefined ? status : currentTrip.status,
				tripId,
				req.user.user_id,
			]
		);

		const [rows] = await pool.execute(
			`SELECT trip_id, user_id, trip_name, description, start_date, end_date, status, created_at
			 FROM trips WHERE trip_id = ? AND user_id = ? LIMIT 1`,
			[tripId, req.user.user_id]
		);

		return res.status(200).json({
			success: true,
			message: 'Trip updated successfully',
			data: { trip: rows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function deleteTrip(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Invalid trip id', 400);
		}

		const [result] = await pool.execute(
			'DELETE FROM trips WHERE trip_id = ? AND user_id = ?',
			[tripId, req.user.user_id]
		);

		if (result.affectedRows === 0) {
			throw createError('Trip not found', 404);
		}

		return res.status(200).json({
			success: true,
			message: 'Trip deleted successfully',
			data: null,
		});
	} catch (error) {
		return next(error);
	}
}

async function addDestination(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id || req.body.trip_id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Valid trip_id is required', 400);
		}

		const {
			city_name,
			country_code,
			lat,
			lon,
			arrival_date,
			departure_date,
			stop_order,
			notes,
		} = req.body;

		if (!city_name || !String(city_name).trim()) {
			throw createError('city_name is required', 400);
		}

		const latitude = Number.parseFloat(lat);
		const longitude = Number.parseFloat(lon);
		if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
			throw createError('Valid lat and lon are required', 400);
		}

		const trip = await getTripOrThrow(tripId, req.user.user_id);

		const tripStart = new Date(trip.start_date);
		const tripEnd = new Date(trip.end_date);
		const arrivalDate = parseOptionalDate(arrival_date, 'arrival_date') || tripStart;
		const departureDate = parseOptionalDate(departure_date, 'departure_date') || tripEnd;

		if (departureDate < arrivalDate) {
			throw createError('departure_date must be on or after arrival_date', 400);
		}

		if (arrivalDate < tripStart || departureDate > tripEnd) {
			throw createError('Destination dates must be within trip start/end range', 400);
		}

		let finalStopOrder = Number.parseInt(stop_order, 10);
		if (Number.isNaN(finalStopOrder) || finalStopOrder < 1) {
			const [orderRows] = await pool.execute(
				'SELECT COALESCE(MAX(stop_order), 0) AS max_stop_order FROM trip_destinations WHERE trip_id = ?',
				[tripId]
			);
			finalStopOrder = Number(orderRows[0].max_stop_order) + 1;
		}

		const [result] = await pool.execute(
			`INSERT INTO trip_destinations
			 (trip_id, city_name, country_code, latitude, longitude, arrival_date, departure_date, stop_order, notes)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				tripId,
				String(city_name).trim(),
				country_code || null,
				latitude,
				longitude,
				formatDate(arrivalDate),
				formatDate(departureDate),
				finalStopOrder,
				notes || null,
			]
		);

		const dayCount = Math.min(14, Math.max(1, daysBetweenInclusive(arrivalDate, departureDate)));
		const weatherData = await fetchWeatherByCoords(latitude, longitude, dayCount);
		await upsertDestinationSnapshot(result.insertId, weatherData);

		const [destinationRows] = await pool.execute(
			`SELECT destination_id, trip_id, city_name, country_code, latitude, longitude,
							arrival_date, departure_date, stop_order, notes
			 FROM trip_destinations
			 WHERE destination_id = ? LIMIT 1`,
			[result.insertId]
		);

		return res.status(201).json({
			success: true,
			message: 'Destination added successfully',
			data: { destination: destinationRows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function updateDestination(req, res, next) {
	try {
		const destinationId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(destinationId)) {
			throw createError('Invalid destination id', 400);
		}

		const [rows] = await pool.execute(
			`SELECT td.destination_id, td.trip_id, td.city_name, td.country_code, td.latitude, td.longitude,
							td.arrival_date, td.departure_date, td.stop_order, td.notes,
							t.user_id, t.start_date AS trip_start_date, t.end_date AS trip_end_date
			 FROM trip_destinations td
			 INNER JOIN trips t ON t.trip_id = td.trip_id
			 WHERE td.destination_id = ? AND t.user_id = ?
			 LIMIT 1`,
			[destinationId, req.user.user_id]
		);

		if (!rows.length) {
			throw createError('Destination not found', 404);
		}

		const current = rows[0];
		const {
			city_name,
			country_code,
			lat,
			lon,
			arrival_date,
			departure_date,
			stop_order,
			notes,
		} = req.body;

		const latitude = lat !== undefined ? Number.parseFloat(lat) : Number(current.latitude);
		const longitude = lon !== undefined ? Number.parseFloat(lon) : Number(current.longitude);

		if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
			throw createError('Valid lat and lon are required', 400);
		}

		const tripStart = new Date(current.trip_start_date);
		const tripEnd = new Date(current.trip_end_date);
		const nextArrival = arrival_date
			? parseDate(arrival_date, 'arrival_date')
			: new Date(current.arrival_date || current.trip_start_date);
		const nextDeparture = departure_date
			? parseDate(departure_date, 'departure_date')
			: new Date(current.departure_date || current.trip_end_date);

		if (nextDeparture < nextArrival) {
			throw createError('departure_date must be on or after arrival_date', 400);
		}

		if (nextArrival < tripStart || nextDeparture > tripEnd) {
			throw createError('Destination dates must be within trip start/end range', 400);
		}

		const parsedStopOrder = stop_order !== undefined ? Number.parseInt(stop_order, 10) : current.stop_order;
		if (Number.isNaN(parsedStopOrder) || parsedStopOrder < 1) {
			throw createError('stop_order must be a positive integer', 400);
		}

		await pool.execute(
			`UPDATE trip_destinations
			 SET city_name = ?,
					 country_code = ?,
					 latitude = ?,
					 longitude = ?,
					 arrival_date = ?,
					 departure_date = ?,
					 stop_order = ?,
					 notes = ?
			 WHERE destination_id = ?`,
			[
				city_name !== undefined ? String(city_name).trim() : current.city_name,
				country_code !== undefined ? country_code : current.country_code,
				latitude,
				longitude,
				formatDate(nextArrival),
				formatDate(nextDeparture),
				parsedStopOrder,
				notes !== undefined ? notes : current.notes,
				destinationId,
			]
		);

		const dayCount = Math.min(14, Math.max(1, daysBetweenInclusive(nextArrival, nextDeparture)));
		const weatherData = await fetchWeatherByCoords(latitude, longitude, dayCount);
		await upsertDestinationSnapshot(destinationId, weatherData);

		const [updatedRows] = await pool.execute(
			`SELECT destination_id, trip_id, city_name, country_code, latitude, longitude,
							arrival_date, departure_date, stop_order, notes
			 FROM trip_destinations WHERE destination_id = ? LIMIT 1`,
			[destinationId]
		);

		return res.status(200).json({
			success: true,
			message: 'Destination updated successfully',
			data: { destination: updatedRows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function deleteDestination(req, res, next) {
	try {
		const destinationId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(destinationId)) {
			throw createError('Invalid destination id', 400);
		}

		const [rows] = await pool.execute(
			`SELECT td.destination_id, td.trip_id
			 FROM trip_destinations td
			 INNER JOIN trips t ON t.trip_id = td.trip_id
			 WHERE td.destination_id = ? AND t.user_id = ?
			 LIMIT 1`,
			[destinationId, req.user.user_id]
		);

		if (!rows.length) {
			throw createError('Destination not found', 404);
		}

		const tripId = rows[0].trip_id;

		await pool.execute('DELETE FROM trip_destinations WHERE destination_id = ?', [destinationId]);

		const [remaining] = await pool.execute(
			`SELECT destination_id
			 FROM trip_destinations
			 WHERE trip_id = ?
			 ORDER BY stop_order ASC, destination_id ASC`,
			[tripId]
		);

		await Promise.all(
			remaining.map((row, index) =>
				pool.execute('UPDATE trip_destinations SET stop_order = ? WHERE destination_id = ?', [
					index + 1,
					row.destination_id,
				])
			)
		);

		return res.status(200).json({
			success: true,
			message: 'Destination deleted successfully',
			data: null,
		});
	} catch (error) {
		return next(error);
	}
}

async function reorderDestinations(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Invalid trip id', 400);
		}

		await getTripOrThrow(tripId, req.user.user_id);

		const { destinations } = req.body;
		if (!Array.isArray(destinations) || !destinations.length) {
			throw createError('destinations must be a non-empty array', 400);
		}

		const normalized = destinations.map((entry) => {
			const destinationId = Number.parseInt(entry.destination_id, 10);
			const stopOrder = Number.parseInt(entry.stop_order, 10);
			if (Number.isNaN(destinationId) || Number.isNaN(stopOrder) || stopOrder < 1) {
				throw createError('Each destination must include valid destination_id and stop_order', 400);
			}
			return { destinationId, stopOrder };
		});

		const destinationIds = normalized.map((item) => item.destinationId);
		const placeholders = destinationIds.map(() => '?').join(',');
		const [existing] = await pool.execute(
			`SELECT destination_id FROM trip_destinations
			 WHERE trip_id = ? AND destination_id IN (${placeholders})`,
			[tripId, ...destinationIds]
		);

		if (existing.length !== destinationIds.length) {
			throw createError('Some destinations do not belong to this trip', 400);
		}

		await Promise.all(
			normalized.map((entry) =>
				pool.execute('UPDATE trip_destinations SET stop_order = ? WHERE destination_id = ?', [
					entry.stopOrder,
					entry.destinationId,
				])
			)
		);

		const [updatedDestinations] = await pool.execute(
			`SELECT destination_id, trip_id, city_name, stop_order
			 FROM trip_destinations
			 WHERE trip_id = ?
			 ORDER BY stop_order ASC, destination_id ASC`,
			[tripId]
		);

		return res.status(200).json({
			success: true,
			message: 'Destinations reordered successfully',
			data: { destinations: updatedDestinations },
		});
	} catch (error) {
		return next(error);
	}
}

async function addPackingItem(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id || req.body.trip_id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Valid trip_id is required', 400);
		}

		await getTripOrThrow(tripId, req.user.user_id);

		const { item_name, category, weather_suggested } = req.body;
		if (!item_name || !String(item_name).trim()) {
			throw createError('item_name is required', 400);
		}

		const finalCategory = category || 'other';
		if (!ALLOWED_PACKING_CATEGORIES.has(finalCategory)) {
			throw createError('Invalid packing item category', 400);
		}

		const [result] = await pool.execute(
			`INSERT INTO packing_items (trip_id, item_name, category, weather_suggested)
			 VALUES (?, ?, ?, ?)`,
			[tripId, String(item_name).trim(), finalCategory, Boolean(weather_suggested)]
		);

		const [rows] = await pool.execute(
			`SELECT item_id, trip_id, item_name, category, is_packed, weather_suggested
			 FROM packing_items WHERE item_id = ? LIMIT 1`,
			[result.insertId]
		);

		return res.status(201).json({
			success: true,
			message: 'Packing item added successfully',
			data: { item: rows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function togglePackingItem(req, res, next) {
	try {
		const itemId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(itemId)) {
			throw createError('Invalid packing item id', 400);
		}

		const [rows] = await pool.execute(
			`SELECT pi.item_id, pi.is_packed
			 FROM packing_items pi
			 INNER JOIN trips t ON t.trip_id = pi.trip_id
			 WHERE pi.item_id = ? AND t.user_id = ?
			 LIMIT 1`,
			[itemId, req.user.user_id]
		);

		if (!rows.length) {
			throw createError('Packing item not found', 404);
		}

		const nextValue = !Boolean(rows[0].is_packed);
		await pool.execute('UPDATE packing_items SET is_packed = ? WHERE item_id = ?', [nextValue, itemId]);

		const [updatedRows] = await pool.execute(
			`SELECT item_id, trip_id, item_name, category, is_packed, weather_suggested
			 FROM packing_items WHERE item_id = ? LIMIT 1`,
			[itemId]
		);

		return res.status(200).json({
			success: true,
			message: 'Packing item updated successfully',
			data: { item: updatedRows[0] || null },
		});
	} catch (error) {
		return next(error);
	}
}

async function deletePackingItem(req, res, next) {
	try {
		const itemId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(itemId)) {
			throw createError('Invalid packing item id', 400);
		}

		const [result] = await pool.execute(
			`DELETE pi FROM packing_items pi
			 INNER JOIN trips t ON t.trip_id = pi.trip_id
			 WHERE pi.item_id = ? AND t.user_id = ?`,
			[itemId, req.user.user_id]
		);

		if (result.affectedRows === 0) {
			throw createError('Packing item not found', 404);
		}

		return res.status(200).json({
			success: true,
			message: 'Packing item deleted successfully',
			data: null,
		});
	} catch (error) {
		return next(error);
	}
}

function generatePackingSuggestionsFromSnapshots(snapshots) {
	const suggestions = new Map();

	snapshots.forEach((snapshot) => {
		const condition = String(snapshot.condition_text || '').toLowerCase();
		const minTemp = snapshot.temp_min !== null ? Number(snapshot.temp_min) : null;
		const maxTemp = snapshot.temp_max !== null ? Number(snapshot.temp_max) : null;
		const wind = snapshot.wind_speed !== null ? Number(snapshot.wind_speed) : null;
		const rain = snapshot.precipitation_mm !== null ? Number(snapshot.precipitation_mm) : null;

		if (condition.includes('rain') || (rain !== null && rain > 0)) {
			suggestions.set('Umbrella', 'other');
			suggestions.set('Waterproof Jacket', 'clothing');
		}

		if (minTemp !== null && minTemp < 10) {
			suggestions.set('Warm Jacket', 'clothing');
			suggestions.set('Thermal Wear', 'clothing');
		}

		if (maxTemp !== null && maxTemp > 30) {
			suggestions.set('Sunscreen', 'toiletries');
			suggestions.set('Cap or Hat', 'clothing');
			suggestions.set('Water Bottle', 'other');
		}

		if (wind !== null && wind > 35) {
			suggestions.set('Windbreaker', 'clothing');
		}
	});

	return Array.from(suggestions.entries()).map(([item_name, category]) => ({ item_name, category }));
}

async function autoSuggestPackingItems(req, res, next) {
	try {
		const tripId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(tripId)) {
			throw createError('Invalid trip id', 400);
		}

		await getTripOrThrow(tripId, req.user.user_id);

		const [snapshots] = await pool.execute(
			`SELECT ws.snapshot_id, ws.condition_text, ws.temp_min, ws.temp_max, ws.wind_speed, ws.precipitation_mm
			 FROM weather_snapshots ws
			 INNER JOIN trip_destinations td ON td.destination_id = ws.destination_id
			 WHERE td.trip_id = ?`,
			[tripId]
		);

		if (!snapshots.length) {
			return res.status(200).json({
				success: true,
				message: 'No weather snapshots found for this trip',
				data: { suggestions: [], inserted_items: [] },
			});
		}

		const suggestions = generatePackingSuggestionsFromSnapshots(snapshots);

		const [existingRows] = await pool.execute(
			'SELECT item_name FROM packing_items WHERE trip_id = ?',
			[tripId]
		);
		const existing = new Set(existingRows.map((row) => String(row.item_name).toLowerCase()));

		const toInsert = suggestions.filter((suggestion) => !existing.has(suggestion.item_name.toLowerCase()));

		if (toInsert.length) {
			await Promise.all(
				toInsert.map((item) =>
					pool.execute(
						`INSERT INTO packing_items (trip_id, item_name, category, weather_suggested)
						 VALUES (?, ?, ?, TRUE)`,
						[tripId, item.item_name, item.category]
					)
				)
			);
		}

		return res.status(200).json({
			success: true,
			message: 'Packing suggestions generated successfully',
			data: {
				suggestions,
				inserted_items: toInsert,
			},
		});
	} catch (error) {
		return next(error);
	}
}

function severityRank(severity) {
	if (severity === 'critical') return 4;
	if (severity === 'high') return 3;
	if (severity === 'medium') return 2;
	return 1;
}

async function createWeatherAlert(req, res, next) {
	try {
		const [snapshotRows] = await pool.execute(
			`SELECT ws.snapshot_id, ws.temp_min, ws.temp_max, ws.wind_speed, ws.precipitation_mm,
							td.destination_id, td.city_name, t.trip_id
			 FROM trips t
			 INNER JOIN trip_destinations td ON td.trip_id = t.trip_id
			 INNER JOIN weather_snapshots ws ON ws.destination_id = td.destination_id
			 WHERE t.user_id = ?
				 AND t.status IN ('planned', 'ongoing')
				 AND t.end_date >= CURDATE()`,
			[req.user.user_id]
		);

		const alertsToCreate = [];

		snapshotRows.forEach((row) => {
			const rain = row.precipitation_mm !== null ? Number(row.precipitation_mm) : null;
			const wind = row.wind_speed !== null ? Number(row.wind_speed) : null;
			const minTemp = row.temp_min !== null ? Number(row.temp_min) : null;
			const maxTemp = row.temp_max !== null ? Number(row.temp_max) : null;

			if (rain !== null && rain > 10) {
				alertsToCreate.push({
					alert_type: 'rain',
					severity: 'medium',
					trip_id: row.trip_id,
					message: `Heavy rain expected in ${row.city_name} (${rain} mm).`,
				});
			}
			if (wind !== null && wind > 50) {
				alertsToCreate.push({
					alert_type: 'high_wind',
					severity: 'high',
					trip_id: row.trip_id,
					message: `High wind expected in ${row.city_name} (${wind} kph).`,
				});
			}
			if (minTemp !== null && minTemp < 5) {
				alertsToCreate.push({
					alert_type: 'cold_wave',
					severity: 'high',
					trip_id: row.trip_id,
					message: `Very low temperature expected in ${row.city_name} (${minTemp}C).`,
				});
			}
			if (maxTemp !== null && maxTemp > 40) {
				alertsToCreate.push({
					alert_type: 'extreme_heat',
					severity: 'critical',
					trip_id: row.trip_id,
					message: `Extreme heat expected in ${row.city_name} (${maxTemp}C).`,
				});
			}
		});

		if (!alertsToCreate.length) {
			return res.status(200).json({
				success: true,
				message: 'No severe weather alerts found',
				data: { alerts: [] },
			});
		}

		await Promise.all(
			alertsToCreate.map((alert) =>
				pool.execute(
					`INSERT INTO weather_alerts (user_id, trip_id, alert_type, alert_message, severity)
					 VALUES (?, ?, ?, ?, ?)`,
					[req.user.user_id, alert.trip_id, alert.alert_type, alert.message, alert.severity]
				)
			)
		);

		const [alertRows] = await pool.execute(
			`SELECT alert_id, user_id, trip_id, alert_type, alert_message, severity, is_read, created_at
			 FROM weather_alerts
			 WHERE user_id = ?
			 ORDER BY created_at DESC`,
			[req.user.user_id]
		);

		const alerts = alertRows.slice(0, alertsToCreate.length);
		alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

		return res.status(201).json({
			success: true,
			message: 'Weather alerts generated successfully',
			data: { alerts },
		});
	} catch (error) {
		return next(error);
	}
}

async function getUserAlerts(req, res, next) {
	try {
		const [rows] = await pool.execute(
			`SELECT alert_id, user_id, location_id, trip_id, alert_type, alert_message, severity, is_read, created_at
			 FROM weather_alerts
			 WHERE user_id = ? AND is_read = FALSE
			 ORDER BY FIELD(severity, 'critical', 'high', 'medium', 'low') ASC, created_at DESC`,
			[req.user.user_id]
		);

		return res.status(200).json({
			success: true,
			message: 'Alerts fetched successfully',
			data: { alerts: rows },
		});
	} catch (error) {
		return next(error);
	}
}

async function markAlertRead(req, res, next) {
	try {
		const alertId = Number.parseInt(req.params.id, 10);
		if (Number.isNaN(alertId)) {
			throw createError('Invalid alert id', 400);
		}

		const [result] = await pool.execute(
			'UPDATE weather_alerts SET is_read = TRUE WHERE alert_id = ? AND user_id = ?',
			[alertId, req.user.user_id]
		);

		if (result.affectedRows === 0) {
			throw createError('Alert not found', 404);
		}

		return res.status(200).json({
			success: true,
			message: 'Alert marked as read',
			data: null,
		});
	} catch (error) {
		return next(error);
	}
}

module.exports = {
	createTrip,
	getUserTrips,
	getTripById,
	updateTrip,
	deleteTrip,
	addDestination,
	updateDestination,
	deleteDestination,
	reorderDestinations,
	addPackingItem,
	togglePackingItem,
	deletePackingItem,
	autoSuggestPackingItems,
	createWeatherAlert,
	getUserAlerts,
	markAlertRead,
};
