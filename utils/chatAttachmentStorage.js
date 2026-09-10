const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const { CustomError } = require("../utils/error");
const chatConfig = require("../config/chat");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "chat");
const PUBLIC_PREFIX = "/storage/chat";

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

const ensureUploadDir = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

const normalizeMimeType = (mimeType) => String(mimeType || "").trim().toLowerCase();

const resolveAttachmentCategory = (mimeType) => {
  const normalized = normalizeMimeType(mimeType);
  for (const entry of chatConfig.MIME_TO_MESSAGE_TYPE) {
    if (entry.types.has(normalized)) {
      return entry.messageType;
    }
  }
  return null;
};

const getMaxSizeForCategory = (category) => {
  if (category === "image") return chatConfig.maxImageSizeBytes;
  if (category === "video") return chatConfig.maxVideoSizeBytes;
  if (category === "audio") return chatConfig.maxAudioSizeBytes;
  return chatConfig.maxFileSizeBytes;
};

const validateAttachmentFile = (file, messageType) => {
  if (!file?.buffer) {
    throw new CustomError("Attachment file is required", [], 400);
  }

  const normalizedMimeType = normalizeMimeType(file.mimetype);
  const category = resolveAttachmentCategory(normalizedMimeType);

  if (!category) {
    throw new CustomError("Unsupported file type", [], 400);
  }

  if (category !== messageType) {
    throw new CustomError(
      "Attachment file type does not match message type",
      [],
      400,
    );
  }

  const maxSize = getMaxSizeForCategory(category);
  if (file.size > maxSize) {
    throw new CustomError("Attachment exceeds allowed size limit", [], 400);
  }

  return {
    category,
    normalizedMimeType,
    fileName: String(file.originalname || "attachment").trim() || "attachment",
  };
};

const saveChatAttachment = async (file, userId, messageType) => {
  const { normalizedMimeType, fileName } = validateAttachmentFile(
    file,
    messageType,
  );

  await ensureUploadDir();

  const extension =
    EXTENSION_BY_MIME[normalizedMimeType] ||
    path.extname(fileName).replace(".", "") ||
    "bin";
  const filename = `${userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.writeFile(filepath, file.buffer);

  return {
    key: filename,
    url: `${PUBLIC_PREFIX}/${filename}`,
    fileName,
    mimeType: normalizedMimeType,
    size: file.size,
  };
};

const resolveAttachmentUrl = (keyOrUrl) => {
  if (!keyOrUrl) {
    return null;
  }

  const value = String(keyOrUrl);
  if (value.startsWith("/storage/")) {
    return value;
  }

  const appUrl = String(process.env.APP_URL || "http://localhost:5000").replace(
    /\/$/,
    "",
  );
  return `${appUrl}${PUBLIC_PREFIX}/${path.basename(value)}`;
};

const getAttachmentFilePath = (key) => {
  const filename = path.basename(String(key || ""));
  const filepath = path.join(UPLOAD_DIR, filename);
  if (!filepath.startsWith(UPLOAD_DIR)) {
    throw new CustomError("Invalid attachment key", [], 400);
  }
  return filepath;
};

module.exports = {
  saveChatAttachment,
  validateAttachmentFile,
  resolveAttachmentUrl,
  getAttachmentFilePath,
  resolveAttachmentCategory,
  PUBLIC_PREFIX,
};
