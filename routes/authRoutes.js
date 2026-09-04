const express = require("express");

const router = express.Router();

const { register, login } = require("../contollers/authController");

router.post("/register", register);

router.post("/login", login);

module.exports = router;
