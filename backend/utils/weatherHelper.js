const axios = require('axios');

const WEATHER_BASE_URL = process.env.WEATHER_BASE_URL || 'http://api.weatherapi.com/v1';
const OPEN_METEO_AQI_BASE_URL = process.env.OPEN_METEO_AQI_BASE_URL || 'https://air-quality-api.open-meteo.com/v1';

function createError(message, statusCode = 500) {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
}

function sanitizeDays(days) {
	const parsed = Number.parseInt(days, 10);
	if (Number.isNaN(parsed)) {
		return 1;
	}

	return Math.min(14, Math.max(1, parsed));
}

function isFiniteNumber(value) {
	return Number.isFinite(value);
}

function mapUsAqiToEpaIndex(usAqi) {
	if (!isFiniteNumber(usAqi)) return null;
	if (usAqi <= 50) return 1;
	if (usAqi <= 100) return 2;
	if (usAqi <= 150) return 3;
	if (usAqi <= 200) return 4;
	if (usAqi <= 300) return 5;
	return 6;
}

function hasAirQualityValues(airQuality) {
	if (!airQuality || typeof airQuality !== 'object') {
		return false;
	}

	const keys = ['co', 'no2', 'o3', 'so2', 'pm2_5', 'pm10', 'us_epa_index', 'us_aqi'];
	return keys.some((key) => isFiniteNumber(airQuality[key]));
}

async function fetchOpenMeteoAirQuality(lat, lon) {
	if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
		return null;
	}

	try {
		const response = await axios.get(`${OPEN_METEO_AQI_BASE_URL}/air-quality`, {
			params: {
				latitude: lat,
				longitude: lon,
				current: 'pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,us_aqi,european_aqi',
				timezone: 'auto',
			},
			timeout: 8000,
		});

		const current = response.data?.current || {};
		const usAqi = current.us_aqi ?? null;

		return {
			co: current.carbon_monoxide ?? null,
			no2: current.nitrogen_dioxide ?? null,
			o3: current.ozone ?? null,
			so2: current.sulphur_dioxide ?? null,
			pm2_5: current.pm2_5 ?? null,
			pm10: current.pm10 ?? null,
			us_aqi: usAqi,
			us_epa_index: mapUsAqiToEpaIndex(usAqi),
			gb_defra_index: current.european_aqi ?? null,
		};
	} catch (error) {
		return null;
	}
}

async function enrichAirQualityIfMissing(normalizedWeather) {
	if (!normalizedWeather || typeof normalizedWeather !== 'object') {
		return normalizedWeather;
	}

	if (hasAirQualityValues(normalizedWeather.air_quality)) {
		return normalizedWeather;
	}

	const lat = Number.parseFloat(normalizedWeather.latitude);
	const lon = Number.parseFloat(normalizedWeather.longitude);
	const fallbackAqi = await fetchOpenMeteoAirQuality(lat, lon);

	if (!fallbackAqi || !hasAirQualityValues(fallbackAqi)) {
		return normalizedWeather;
	}

	return {
		...normalizedWeather,
		air_quality: {
			...normalizedWeather.air_quality,
			...fallbackAqi,
		},
	};
}

function normalizeHourly(hour) {
	return {
		time: hour.time,
		temp_c: hour.temp_c,
		temp_f: hour.temp_f,
		condition: {
			text: hour.condition?.text || null,
			icon: hour.condition?.icon || null,
		},
		humidity: hour.humidity,
		wind_kph: hour.wind_kph,
		pressure_mb: hour.pressure_mb,
		precip_mm: hour.precip_mm,
		visibility_km: hour.vis_km,
		uv_index: hour.uv,
		is_day: hour.is_day,
		chance_of_rain: hour.chance_of_rain,
		chance_of_snow: hour.chance_of_snow,
	};
}

function normalizeWeatherResponse(apiData, includeForecast = true) {
	const location = apiData.location || {};
	const current = apiData.current || {};
	const forecastDays = includeForecast ? apiData.forecast?.forecastday || [] : [];

	return {
		city: location.name || null,
		country: location.country || null,
		latitude: location.lat ?? null,
		longitude: location.lon ?? null,
		temp_c: current.temp_c ?? null,
		temp_f: current.temp_f ?? null,
		feels_like_c: current.feelslike_c ?? null,
		pressure_mb: current.pressure_mb ?? null,
		condition: {
			text: current.condition?.text || null,
			icon: current.condition?.icon || null,
		},
		humidity: current.humidity ?? null,
		wind_kph: current.wind_kph ?? null,
		visibility_km: current.vis_km ?? null,
		uv_index: current.uv ?? null,
		is_day: current.is_day ?? null,
		air_quality: {
			co: current.air_quality?.co ?? null,
			no2: current.air_quality?.no2 ?? null,
			o3: current.air_quality?.o3 ?? null,
			so2: current.air_quality?.so2 ?? null,
			pm2_5: current.air_quality?.pm2_5 ?? null,
			pm10: current.air_quality?.pm10 ?? null,
			us_aqi: null,
			us_epa_index: current.air_quality?.['us-epa-index'] ?? null,
			gb_defra_index: current.air_quality?.['gb-defra-index'] ?? null,
		},
		forecast: forecastDays.map((day) => ({
			date: day.date,
			max_c: day.day?.maxtemp_c ?? null,
			min_c: day.day?.mintemp_c ?? null,
			sunrise: day.astro?.sunrise || null,
			sunset: day.astro?.sunset || null,
			max_wind_kph: day.day?.maxwind_kph ?? null,
			avg_humidity: day.day?.avghumidity ?? null,
			total_precip_mm: day.day?.totalprecip_mm ?? null,
			daily_chance_of_rain: day.day?.daily_chance_of_rain ?? null,
			daily_chance_of_snow: day.day?.daily_chance_of_snow ?? null,
			uv_index: day.day?.uv ?? null,
			condition: {
				text: day.day?.condition?.text || null,
				icon: day.day?.condition?.icon || null,
			},
			hourly: (day.hour || []).map(normalizeHourly),
		})),
	};
}

async function makeWeatherRequest(endpoint, params) {
	if (!process.env.WEATHER_API_KEY) {
		throw createError('WEATHER_API_KEY is not configured', 500);
	}

	try {
		const response = await axios.get(`${WEATHER_BASE_URL}${endpoint}`, {
			params: {
				key: process.env.WEATHER_API_KEY,
				...params,
			},
			timeout: 10000,
		});

		return response.data;
	} catch (error) {
		if (error.response) {
			const apiMessage = error.response.data?.error?.message || 'Weather service error';
			const statusCode = error.response.status === 400 ? 400 : 502;
			throw createError(apiMessage, statusCode);
		}

		throw createError('Failed to connect to weather service', 502);
	}
}

async function fetchCurrentWeather(cityName) {
	if (!cityName || !String(cityName).trim()) {
		throw createError('City name is required', 400);
	}

	const data = await makeWeatherRequest('/current.json', {
		q: String(cityName).trim(),
		aqi: 'yes',
	});

	const normalized = normalizeWeatherResponse(data, false);
	return enrichAirQualityIfMissing(normalized);
}

async function fetchForecast(cityName, days = 1) {
	if (!cityName || !String(cityName).trim()) {
		throw createError('City name is required', 400);
	}

	const normalizedDays = sanitizeDays(days);
	const data = await makeWeatherRequest('/forecast.json', {
		q: String(cityName).trim(),
		days: normalizedDays,
		alerts: 'yes',
		aqi: 'yes',
	});

	const normalized = normalizeWeatherResponse(data, true);
	return enrichAirQualityIfMissing(normalized);
}

async function fetchWeatherByCoords(lat, lon, days = 1) {
	const latitude = Number.parseFloat(lat);
	const longitude = Number.parseFloat(lon);

	if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
		throw createError('Valid latitude and longitude are required', 400);
	}

	const normalizedDays = sanitizeDays(days);
	const data = await makeWeatherRequest('/forecast.json', {
		q: `${latitude},${longitude}`,
		days: normalizedDays,
		alerts: 'yes',
		aqi: 'yes',
	});

	const normalized = normalizeWeatherResponse(data, true);
	return enrichAirQualityIfMissing(normalized);
}

module.exports = {
	fetchCurrentWeather,
	fetchForecast,
	fetchWeatherByCoords,
	normalizeWeatherResponse,
};
