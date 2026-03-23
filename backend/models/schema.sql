CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_pic VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_locations (
  location_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  city_name VARCHAR(100) NOT NULL,
  country_code CHAR(2),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trips (
  trip_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  trip_name VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('planned','ongoing','completed','cancelled') DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trip_destinations (
  destination_id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  city_name VARCHAR(100) NOT NULL,
  country_code CHAR(2),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  arrival_date DATE,
  departure_date DATE,
  stop_order INT NOT NULL,
  notes TEXT,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
  destination_id INT NOT NULL,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  temp_min DECIMAL(5,2),
  temp_max DECIMAL(5,2),
  condition_text VARCHAR(100),
  condition_icon VARCHAR(255),
  humidity INT,
  wind_speed DECIMAL(6,2),
  precipitation_mm DECIMAL(6,2),
  forecast_json JSON,
  FOREIGN KEY (destination_id) REFERENCES trip_destinations(destination_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packing_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  trip_id INT NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  category ENUM('clothing','documents','electronics','toiletries','medicine','other'),
  is_packed BOOLEAN DEFAULT FALSE,
  weather_suggested BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_alerts (
  alert_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  location_id INT,
  trip_id INT,
  alert_type ENUM('rain','storm','extreme_heat','cold_wave','high_wind','general'),
  alert_message TEXT,
  severity ENUM('low','medium','high','critical'),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
