const express = require('express');
const { createClient } = require('@clickhouse/client');
const path = require('path');

const app = express();
require('dotenv').config();

const PORT = process.env.PORT;

const client = createClient({
    host: `http://${process.env.DB_HOST}:8123`,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

const isNumber = (val) => /^[0-9]+$/.test(val);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/search', async (req, res) => {
    try {
        const keyword = (req.query.q || '').replace(/'/g, "");
        const lat = req.query.lat;
        const long = req.query.long;

        const latNum = lat ? parseFloat(lat) : null;
        const longNum = long ? parseFloat(long) : null;

        const hasGeo = (
            latNum !== null &&
            longNum !== null &&
            !isNaN(latNum) &&
            !isNaN(longNum)
        );

        let sql = '';

        // =========================
        // CASE 1: ID NUMBER SEARCH
        // =========================
        if (isNumber(keyword)) {

            sql = `
                SELECT 
                    idsbr,
                    nama_usaha,
                    alamat_usaha,
                    nama_kabupaten,
                    latitude,
                    longitude
                    ${hasGeo ? `,
                    (
                        6371 * acos(
                            cos(radians(${latNum})) *
                            cos(radians(latitude)) *
                            cos(radians(longitude) - radians(${longNum})) +
                            sin(radians(${latNum})) *
                            sin(radians(latitude))
                        )
                    ) AS distance` : ''}
                FROM prelist_search
                WHERE idsbr = '${keyword}'
                LIMIT 15
            `;

        } 
        // =========================
        // CASE 2: TEXT SEARCH
        // =========================
        else {

            sql = `
                SELECT 
                    idsbr,
                    nama_usaha,
                    alamat_usaha,
                    nama_kabupaten,
                    latitude,
                    longitude
                    ${hasGeo ? `,
                    (
                        6371 * acos(
                            cos(radians(${latNum})) *
                            cos(radians(latitude)) *
                            cos(radians(longitude) - radians(${longNum})) +
                            sin(radians(${latNum})) *
                            sin(radians(latitude))
                        )
                    ) AS distance` : ''}
                    , position(lower(nama_usaha), lower('${keyword}')) AS score
                FROM prelist_search
                WHERE 1=1
            `;

            if (keyword) {
                sql += ` AND lower(nama_usaha) LIKE '%${keyword.toLowerCase()}%'`;
            }

            if (hasGeo) {
                sql += ` ORDER BY distance ASC, score ASC LIMIT 15`;
            } else {
                sql += ` ORDER BY score ASC LIMIT 15`;
            }
        }

        const result = await client.query({
            query: sql,
            format: 'JSONEachRow'
        });

        const data = await result.json();
        res.json(data);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
