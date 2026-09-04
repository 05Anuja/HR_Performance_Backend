// middleware/errorHandler.js
const multer = require("multer");

function errorHandler(err, req, res, next) {
  // Multer-specific errors (file too large, too many files, etc.)
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Resume file is too large. Max size is 5MB." });
    }
    return res.status(400).json({ message: err.message });
  }

  // Our custom fileFilter error (wrong file type)
  if (err.message === "Only PDF files are allowed for the resume.") {
    return res.status(400).json({ message: err.message });
  }

  // Fallback for anything else that reaches here
  console.error(err);
  return res.status(500).json({ message: "Something went wrong." });
}

module.exports = errorHandler;