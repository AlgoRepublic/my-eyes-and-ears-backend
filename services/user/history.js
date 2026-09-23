const mongoose = require("mongoose");
const HistoryItem = require("../../models/historyItem");
const { HISTORY_KINDS } = HistoryItem;
const { CustomError } = require("../../utils/error");
const {
  saveMagnifierImage,
  deleteMagnifierImage,
} = require("../../utils/historyImageStorage");

const TITLE_MAX_LENGTH = 60;
const MAGNIFIER_TITLE = "Magnifier capture";

const parsePositiveInteger = (value, name, defaultValue, maximum) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (!/^\d+$/.test(String(value))) {
    throw new CustomError(`${name} must be a positive integer`, [], 400);
  }

  const parsed = Number.parseInt(String(value), 10);
  if (parsed < 1 || parsed > maximum) {
    throw new CustomError(`${name} must be between 1 and ${maximum}`, [], 400);
  }

  return parsed;
};

const requireNonEmptyString = (value, fieldName) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new CustomError(`${fieldName} is required`, [], 400);
  }
  return normalized;
};

const buildTitleFromText = (text) => {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= TITLE_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, TITLE_MAX_LENGTH)}…`;
};

const parseNumberInRange = (value, fieldName, min, max) => {
  if (value === undefined || value === null || value === "") {
    throw new CustomError(`${fieldName} is required`, [], 400);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CustomError(`${fieldName} must be a number`, [], 400);
  }

  if (parsed < min || parsed > max) {
    throw new CustomError(
      `${fieldName} must be between ${min} and ${max}`,
      [],
      400,
    );
  }

  return parsed;
};

const mapHistoryItemToApi = (item) => {
  const mapped = {
    id: String(item._id),
    kind: item.kind,
    title: item.title || null,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
  };

  if (item.kind === "scan") {
    mapped.extractedText = item.extractedText ?? null;
  }

  if (item.kind === "translation") {
    mapped.sourceText = item.sourceText ?? null;
    mapped.translatedText = item.translatedText ?? null;
    mapped.sourceLanguage = item.sourceLanguage ?? null;
    mapped.targetLanguage = item.targetLanguage ?? null;
  }

  if (item.kind === "magnifier") {
    mapped.imageUrl = item.imageUrl ?? null;
    mapped.brightness = item.brightness ?? null;
    mapped.contrast = item.contrast ?? null;
    mapped.zoom = item.zoom ?? null;
  }

  return mapped;
};

const listHistoryService = async (currentUser, filters = {}) => {
  const page = parsePositiveInteger(
    filters.page,
    "page",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const limit = parsePositiveInteger(filters.limit, "limit", 20, 100);
  const query = { userId: currentUser._id };

  if (filters.kind !== undefined && filters.kind !== null && filters.kind !== "") {
    if (!HISTORY_KINDS.includes(filters.kind)) {
      throw new CustomError("Invalid kind filter", [], 400);
    }
    query.kind = filters.kind;
  }

  const [items, total] = await Promise.all([
    HistoryItem.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HistoryItem.countDocuments(query),
  ]);

  return {
    items: items.map(mapHistoryItemToApi),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

const createScanHistoryService = async (currentUser, payload = {}) => {
  const extractedText = requireNonEmptyString(
    payload.extractedText,
    "extractedText",
  );

  const item = await HistoryItem.create({
    userId: currentUser._id,
    kind: "scan",
    title: buildTitleFromText(extractedText),
    extractedText,
  });

  return { item: mapHistoryItemToApi(item.toObject()) };
};

const createTranslationHistoryService = async (currentUser, payload = {}) => {
  const sourceText = requireNonEmptyString(payload.sourceText, "sourceText");
  const translatedText = requireNonEmptyString(
    payload.translatedText,
    "translatedText",
  );
  const sourceLanguage = requireNonEmptyString(
    payload.sourceLanguage,
    "sourceLanguage",
  );
  const targetLanguage = requireNonEmptyString(
    payload.targetLanguage,
    "targetLanguage",
  );

  const item = await HistoryItem.create({
    userId: currentUser._id,
    kind: "translation",
    title: buildTitleFromText(sourceText),
    sourceText,
    translatedText,
    sourceLanguage,
    targetLanguage,
  });

  return { item: mapHistoryItemToApi(item.toObject()) };
};

const createMagnifierHistoryService = async (
  currentUser,
  payload = {},
  files = [],
) => {
  const imageFile = Array.isArray(files)
    ? files.find((file) => file.fieldname === "image")
    : null;

  const brightness = parseNumberInRange(payload.brightness, "brightness", 0.5, 1.6);
  const contrast = parseNumberInRange(payload.contrast, "contrast", 0.5, 2.0);
  const zoom = parseNumberInRange(payload.zoom, "zoom", 1.0, 12.0);
  const imageUrl = await saveMagnifierImage(imageFile, String(currentUser._id));

  const item = await HistoryItem.create({
    userId: currentUser._id,
    kind: "magnifier",
    title: MAGNIFIER_TITLE,
    imageUrl,
    brightness,
    contrast,
    zoom,
  });

  return { item: mapHistoryItemToApi(item.toObject()) };
};

const deleteHistoryItemService = async (currentUser, itemId) => {
  if (!mongoose.isValidObjectId(itemId)) {
    throw new CustomError("History item not found", [], 404);
  }

  const item = await HistoryItem.findOne({
    _id: itemId,
    userId: currentUser._id,
  }).lean();

  if (!item) {
    throw new CustomError("History item not found", [], 404);
  }

  await HistoryItem.deleteOne({ _id: item._id });

  if (item.kind === "magnifier" && item.imageUrl) {
    await deleteMagnifierImage(item.imageUrl);
  }
};

module.exports = {
  listHistoryService,
  createScanHistoryService,
  createTranslationHistoryService,
  createMagnifierHistoryService,
  deleteHistoryItemService,
  mapHistoryItemToApi,
  buildTitleFromText,
};
