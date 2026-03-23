const express = require('express');

const {
	getCurrentWeather,
	getForecast,
	getCurrentWeatherByCoords,
	getForecastByCoords,
	saveLocation,
	getSavedLocations,
	deleteLocation,
	getWeatherForSavedLocations,
} = require('../controllers/weather');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/current', getCurrentWeather);
router.get('/forecast', getForecast);
router.get('/current/coords', getCurrentWeatherByCoords);
router.get('/forecast/coords', getForecastByCoords);
router.post('/locations', authMiddleware, saveLocation);
router.get('/locations', authMiddleware, getSavedLocations);
router.delete('/locations/:id', authMiddleware, deleteLocation);
router.get('/locations/all', authMiddleware, getWeatherForSavedLocations);

module.exports = router;
