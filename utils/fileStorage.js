const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { CustomError } = require("./error");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "profiles");
const PUBLIC_PREFIX = "/storage/profiles";
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ensureUploadDir = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

const getExtension = (mimetype) => {
  if (mimetype === "image/jpeg") return "jpg";
  return mimetype.split("/")[1];
};

const saveProfileImage = async (file, userId) => {
  if (!file?.buffer) {
    throw new CustomError("Invalid image file", [], 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new CustomError(
      "Only JPEG, PNG, GIF, and WebP images are allowed",
      [],
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new CustomError("Image must be 5MB or smaller", [], 400);
  }

  await ensureUploadDir();

  const extension = getExtension(file.mimetype);
  const filename = `${userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(filepath, file.buffer);

  return `${PUBLIC_PREFIX}/${filename}`;
};

const deleteStoredFile = async (publicPath) => {
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
  saveProfileImage,
  deleteStoredFile,
};
