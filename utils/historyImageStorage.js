const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { CustomError } = require("./error");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "history", "magnifier");
const PUBLIC_PREFIX = "/storage/history/magnifier";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ensureUploadDir = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

const saveMagnifierImage = async (file, userId) => {
  if (!file?.buffer) {
    throw new CustomError("Image file is required", [], 400);
  }

  const mimeType = String(file.mimetype || "").trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new CustomError("Only JPEG images are allowed", [], 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new CustomError("Image is too large", [], 413);
  }

  await ensureUploadDir();

  const filename = `${userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(filepath, file.buffer);

  return `${PUBLIC_PREFIX}/${filename}`;
};

const deleteMagnifierImage = async (publicPath) => {
  if (!publicPath || typeof publicPath !== "string") return;
  if (!publicPath.startsWith(`${PUBLIC_PREFIX}/`)) return;

  const filename = path.basename(publicPath);
  const filepath = path.join(UPLOAD_DIR, filename);

  if (!filepath.startsWith(UPLOAD_DIR)) return;

  try {
    await fs.unlink(filepath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

module.exports = {
  saveMagnifierImage,
  deleteMagnifierImage,
  PUBLIC_PREFIX,
};
