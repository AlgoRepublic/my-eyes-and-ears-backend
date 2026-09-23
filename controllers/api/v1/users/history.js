const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  listHistoryService,
  createScanHistoryService,
  createTranslationHistoryService,
  createMagnifierHistoryService,
  deleteHistoryItemService,
} = require("../../../../services/user/history");

const listHistory = asyncMiddleware(async (req, res, next) => {
  const data = await listHistoryService(req.user, {
    page: req.query.page,
    limit: req.query.limit,
    kind: req.query.kind,
  });

  next({
    success: true,
    message: "History fetched",
    statusCode: 200,
    data,
  });
});

const createScanHistory = asyncMiddleware(async (req, res, next) => {
  const data = await createScanHistoryService(req.user, req.body);

  next({
    success: true,
    message: "Scan saved",
    statusCode: 201,
    data,
  });
});

const createTranslationHistory = asyncMiddleware(async (req, res, next) => {
  const data = await createTranslationHistoryService(req.user, req.body);

  next({
    success: true,
    message: "Translation saved",
    statusCode: 201,
    data,
  });
});

const createMagnifierHistory = asyncMiddleware(async (req, res, next) => {
  const data = await createMagnifierHistoryService(
    req.user,
    req.body,
    req.files,
  );

  next({
    success: true,
    message: "Magnifier capture saved",
    statusCode: 201,
    data,
  });
});

const deleteHistoryItem = asyncMiddleware(async (req, res, next) => {
  await deleteHistoryItemService(req.user, req.params.id);

  next({
    success: true,
    message: "History item deleted",
    statusCode: 200,
    data: null,
  });
});

module.exports = {
  listHistory,
  createScanHistory,
  createTranslationHistory,
  createMagnifierHistory,
  deleteHistoryItem,
};
