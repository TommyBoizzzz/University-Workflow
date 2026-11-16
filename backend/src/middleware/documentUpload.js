import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
}).single("file");

export default function documentUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Documents must be 10 MB or smaller"
      });
    }
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: "Upload one PDF or Word (.docx) document"
      });
    }
    return next(error);
  });
}
