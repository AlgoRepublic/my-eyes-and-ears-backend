const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBytes = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
]);

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MESSAGE_TYPES = ["text", "image", "video", "audio", "file"];

const MIME_TO_MESSAGE_TYPE = [
  { types: IMAGE_MIME_TYPES, messageType: "image" },
  { types: VIDEO_MIME_TYPES, messageType: "video" },
  { types: AUDIO_MIME_TYPES, messageType: "audio" },
  { types: DOCUMENT_MIME_TYPES, messageType: "file" },
];

module.exports = {
  defaultMessagePageSize: toInt(process.env.CHAT_MESSAGE_PAGE_SIZE, 30),
  maxMessagePageSize: toInt(process.env.CHAT_MESSAGE_PAGE_SIZE_MAX, 50),
  historyDays: toInt(process.env.CHAT_HISTORY_DAYS, 7),
  uploadSignatureExpiryMs: toInt(process.env.CHAT_UPLOAD_SIGNATURE_EXPIRY_MS, 15 * 60 * 1000),
  maxImageSizeBytes: toBytes(process.env.CHAT_MAX_IMAGE_SIZE_BYTES, 10 * 1024 * 1024),
  maxVideoSizeBytes: toBytes(process.env.CHAT_MAX_VIDEO_SIZE_BYTES, 50 * 1024 * 1024),
  maxAudioSizeBytes: toBytes(process.env.CHAT_MAX_AUDIO_SIZE_BYTES, 15 * 1024 * 1024),
  maxFileSizeBytes: toBytes(process.env.CHAT_MAX_FILE_SIZE_BYTES, 20 * 1024 * 1024),
  MESSAGE_TYPES,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  AUDIO_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  MIME_TO_MESSAGE_TYPE,
};
