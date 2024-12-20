const express = require("express");
const router = express.Router();
const customerQueryController = require("../controllers/customPackageController");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRole = require("../middlewares/authorizeRole");

router.post(
  "/",
  authMiddleware,
  customerQueryController.createCustomPackage
);
router.get(
  "/",
  authMiddleware,

  customerQueryController.getPackages
);

module.exports = router;
