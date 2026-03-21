const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "shivtej",
    database: "Weather_app"
});

db.connect(err => {
    if (err) throw err;
    console.log("MySQL Connected");
});

app.post("/save-trip", (req, res) => {
    const { city, date } = req.body;

    const query = "INSERT INTO trips (location, travel_date) VALUES (?, ?)";
    db.query(query, [city, date], (err, result) => {
        if (err) throw err;
        res.send("Trip saved!");
    });
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});