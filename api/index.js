const express = require('express');
const router = express.Router();


router.get('/getRooms', (req, res) => {
    res.send('works');
});

module.exports = router;