const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  listConversationsService,
  getConversationDetailService,
  getOrCreateIndividualConversationService,
  getTotalUnreadCountService,
} = require("../../../../services/chat/conversations");
const {
  listMessagesService,
  sendMessageService,
  markConversationReadService,
  editMessageService,
  deleteMessageService,
} = require("../../../../services/chat/messages");

const listConversations = asyncMiddleware(async (req, res, next) => {
  const data = await listConversationsService(req.user);
  next({
    success: true,
    message: "Conversations fetched successfully",
    statusCode: 200,
    data: {
      conversations: data,
    },
  });
});

const getConversation = asyncMiddleware(async (req, res, next) => {
  const data = await getConversationDetailService(
    req.user,
    req.params.conversationId,
  );
  next({
    success: true,
    message: "Conversation fetched successfully",
    statusCode: 200,
    data,
  });
});

const createIndividualConversation = asyncMiddleware(async (req, res, next) => {
  const data = await getOrCreateIndividualConversationService(
    req.user,
    req.body.userId,
  );
  next({
    success: true,
    message: "Conversation ready",
    statusCode: 200,
    data,
  });
});

const listMessages = asyncMiddleware(async (req, res, next) => {
  const data = await listMessagesService(req.user, req.params.conversationId, {
    limit: req.query.limit,
    before: req.query.before,
  });
  next({
    success: true,
    message: "Messages fetched successfully",
    statusCode: 200,
    data,
  });
});

const sendMessage = asyncMiddleware(async (req, res, next) => {
  const io = req.app.locals.io;
  const data = await sendMessageService(
    req.user,
    req.params.conversationId,
    req.body,
    { io, files: req.files },
  );
  next({
    success: true,
    message: "Message sent successfully",
    statusCode: 200,
    data,
  });
});

const markConversationRead = asyncMiddleware(async (req, res, next) => {
  const io = req.app.locals.io;
  const data = await markConversationReadService(
    req.user,
    req.params.conversationId,
    req.body?.messageId,
    { io },
  );
  next({
    success: true,
    message: "Conversation marked as read",
    statusCode: 200,
    data,
  });
});

const getUnreadCount = asyncMiddleware(async (req, res, next) => {
  const data = await getTotalUnreadCountService(req.user);
  next({
    success: true,
    message: "Unread count fetched successfully",
    statusCode: 200,
    data,
  });
});

const editMessage = asyncMiddleware(async (req, res, next) => {
  const data = await editMessageService(
    req.user,
    req.params.messageId,
    req.body,
  );
  next({
    success: true,
    message: "Message updated successfully",
    statusCode: 200,
    data,
  });
});

const deleteMessage = asyncMiddleware(async (req, res, next) => {
  const io = req.app.locals.io;
  const data = await deleteMessageService(req.user, req.params.messageId, {
    io,
  });
  next({
    success: true,
    message: "Message deleted successfully",
    statusCode: 200,
    data,
  });
});

module.exports = {
  listConversations,
  getConversation,
  createIndividualConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  editMessage,
  deleteMessage,
};
