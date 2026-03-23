const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/travel');

const router = express.Router();

router.use(authMiddleware);

router.post('/trips', createTrip);
router.get('/trips', getUserTrips);
router.get('/trips/:id', getTripById);
router.put('/trips/:id', updateTrip);
router.delete('/trips/:id', deleteTrip);

router.post('/trips/:id/destinations', addDestination);
router.put('/destinations/:id', updateDestination);
router.delete('/destinations/:id', deleteDestination);
router.put('/trips/:id/reorder', reorderDestinations);

router.post('/trips/:id/packing', addPackingItem);
router.put('/packing/:id/toggle', togglePackingItem);
router.delete('/packing/:id', deletePackingItem);
router.post('/trips/:id/packing/suggest', autoSuggestPackingItems);

router.post('/alerts/check', createWeatherAlert);
router.get('/alerts', getUserAlerts);
router.put('/alerts/:id/read', markAlertRead);

module.exports = router;
