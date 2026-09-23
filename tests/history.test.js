const test = require("node:test");
const assert = require("node:assert/strict");
const HistoryItem = require("../models/historyItem");
const {
  listHistoryService,
  createScanHistoryService,
  createTranslationHistoryService,
  deleteHistoryItemService,
  buildTitleFromText,
  mapHistoryItemToApi,
} = require("../services/user/history");
const { CustomError } = require("../utils/error");

test("buildTitleFromText truncates long text with ellipsis", () => {
  const longText = "A".repeat(80);
  const title = buildTitleFromText(longText);
  assert.equal(title.length, 61);
  assert.ok(title.endsWith("…"));
});

test("mapHistoryItemToApi exposes kind-specific fields", () => {
  const createdAt = new Date("2026-09-01T09:14:00.000Z");
  const scanItem = mapHistoryItemToApi({
    _id: "507f1f77bcf86cd799439011",
    kind: "scan",
    title: "Hello",
    createdAt,
    extractedText: "Hello world",
  });

  assert.equal(scanItem.id, "507f1f77bcf86cd799439011");
  assert.equal(scanItem.extractedText, "Hello world");
  assert.equal(scanItem.sourceText, undefined);

  const magnifierItem = mapHistoryItemToApi({
    _id: "507f1f77bcf86cd799439012",
    kind: "magnifier",
    title: "Magnifier capture",
    createdAt,
    imageUrl: "/storage/history/magnifier/test.jpg",
    brightness: 1.2,
    contrast: 1.4,
    zoom: 4,
  });

  assert.equal(magnifierItem.imageUrl, "/storage/history/magnifier/test.jpg");
  assert.equal(magnifierItem.brightness, 1.2);
});

test("list history is scoped to authenticated user and paginated", async (t) => {
  const currentUserId = "507f1f77bcf86cd799439011";
  let receivedQuery;
  let receivedSkip;
  let receivedLimit;
  let receivedSort;
  const originalFind = HistoryItem.find;
  const originalCountDocuments = HistoryItem.countDocuments;

  t.after(() => {
    HistoryItem.find = originalFind;
    HistoryItem.countDocuments = originalCountDocuments;
  });

  HistoryItem.find = (query) => {
    receivedQuery = query;
    return {
      sort(sort) {
        receivedSort = sort;
        return this;
      },
      skip(value) {
        receivedSkip = value;
        return this;
      },
      limit(value) {
        receivedLimit = value;
        return this;
      },
      lean() {
        return Promise.resolve([
          {
            _id: "507f1f77bcf86cd799439021",
            kind: "scan",
            title: "Sample",
            createdAt: new Date("2026-09-01T09:14:00.000Z"),
            extractedText: "Sample text",
          },
        ]);
      },
    };
  };

  HistoryItem.countDocuments = () => Promise.resolve(1);

  const result = await listHistoryService(
    { _id: currentUserId },
    { page: "2", limit: "10", kind: "scan" },
  );

  assert.deepEqual(receivedQuery, {
    userId: currentUserId,
    kind: "scan",
  });
  assert.deepEqual(receivedSort, { createdAt: -1 });
  assert.equal(receivedSkip, 10);
  assert.equal(receivedLimit, 10);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 10,
    total: 1,
    totalPages: 1,
  });
});

test("create scan history requires extractedText", async () => {
  await assert.rejects(
    () => createScanHistoryService({ _id: "507f1f77bcf86cd799439011" }, {}),
    (error) => {
      assert.ok(error instanceof CustomError);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test("create scan history persists item", async (t) => {
  const originalCreate = HistoryItem.create;
  let receivedPayload;

  t.after(() => {
    HistoryItem.create = originalCreate;
  });

  HistoryItem.create = async (payload) => {
    receivedPayload = payload;
    return {
      toObject() {
        return {
          _id: "507f1f77bcf86cd799439031",
          ...payload,
          createdAt: new Date("2026-09-01T09:14:00.000Z"),
        };
      },
    };
  };

  const result = await createScanHistoryService(
    { _id: "507f1f77bcf86cd799439011" },
    { extractedText: "Take one tablet by mouth twice daily with food." },
  );

  assert.equal(receivedPayload.kind, "scan");
  assert.equal(
    receivedPayload.extractedText,
    "Take one tablet by mouth twice daily with food.",
  );
  assert.equal(result.item.kind, "scan");
  assert.equal(result.item.id, "507f1f77bcf86cd799439031");
});

test("create translation history requires all fields", async () => {
  await assert.rejects(
    () =>
      createTranslationHistoryService(
        { _id: "507f1f77bcf86cd799439011" },
        {
          sourceText: "Hello",
          translatedText: "Hola",
        },
      ),
    (error) => {
      assert.ok(error instanceof CustomError);
      assert.match(error.message, /sourceLanguage/);
      return true;
    },
  );
});

test("delete history item returns 404 when not owned by user", async (t) => {
  const originalFindOne = HistoryItem.findOne;

  t.after(() => {
    HistoryItem.findOne = originalFindOne;
  });

  HistoryItem.findOne = () => ({
    lean() {
      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    () =>
      deleteHistoryItemService(
        { _id: "507f1f77bcf86cd799439011" },
        "507f1f77bcf86cd799439099",
      ),
    (error) => {
      assert.ok(error instanceof CustomError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});
