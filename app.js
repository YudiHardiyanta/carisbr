const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
require('dotenv').config();
const PORT = process.env.PORT
const isNumber = (val) => /^[0-9]+$/.test(val);
// MySQL connection pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: 10
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API search endpoint (FULLTEXT)
app.get(`/api/search`, (req, res) => {
    const keyword = req.query.q || '';
    const lat = req.query.lat || '';
    const long = req.query.long || '';

    //const kabupaten = req.query.kabupaten || '';
    if (isNumber(keyword)) {
        let sql = `
            SELECT idsbr,nama_usaha,alamat_usaha,nama_kabupaten,latitude,longitude
            FROM prelist_search
            WHERE idsbr = ?
            `
            ;
        if (lat != '' && long != '') {
            sql = `
            SELECT idsbr,nama_usaha,alamat_usaha,nama_kabupaten,latitude,longitude,
            (
                6371 * ACOS(
                COS(RADIANS(${lat})) *
                COS(RADIANS(latitude)) *
                COS(RADIANS(longitude) - RADIANS(${long})) +
                SIN(RADIANS(${lat})) *
                SIN(RADIANS(latitude))
            )
            ) AS distance
            FROM prelist_search
            WHERE idsbr = ?
            `
                ;
        }
        const params = [];
        params.push(keyword);
        sql += `LIMIT 10`;
        db.query(sql, params, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });

    } else {
        let sql = `
            SELECT idsbr,nama_usaha,alamat_usaha,nama_kabupaten,latitude,longitude,
            ${keyword ? 'MATCH(nama_usaha) AGAINST(? IN NATURAL LANGUAGE MODE) AS score' : '0 AS score'}
            FROM prelist_search
            WHERE 1=1
        `;
        if (lat != '' && long != '') {
            sql = `
            SELECT idsbr,nama_usaha,alamat_usaha,nama_kabupaten,latitude,longitude,
            (
                6371 * ACOS(
                COS(RADIANS(${lat})) *
                COS(RADIANS(latitude)) *
                COS(RADIANS(longitude) - RADIANS(${long})) +
                SIN(RADIANS(${lat})) *
                SIN(RADIANS(latitude))
            )
            ) AS distance,
            ${keyword ? 'MATCH(nama_usaha) AGAINST(? IN NATURAL LANGUAGE MODE) AS score' : '0 AS score'}
            FROM prelist_search
            WHERE 1=1
        `;
        }

        const params = [];

        // FULLTEXT hanya kalau ada keyword
        if (keyword) {
            sql += ` AND MATCH(nama_usaha) AGAINST(? IN NATURAL LANGUAGE MODE)`;
            params.push(keyword, keyword); // 2x karena dipakai di SELECT & WHERE
        }

        // Filter kabupaten
        //if (kabupaten) {
        //    sql += ` AND kode_kabupaten = ?`;
        //    params.push(kabupaten);
        //}

        if (lat != '' && long != '') {
            sql += ` ORDER BY (1/distance + score) DESC LIMIT 10`;
        }else{
            sql += ` ORDER BY score DESC LIMIT 10`;
        }


        

        db.query(sql, params, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
    }

});

// Serve frontend
app.get(`/`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));