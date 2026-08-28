const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const chatController = require("../controllers/api/v1/chat");

const router = express.Router();

router.use(protect);

router.get("/conversations", chatController.listConversations);
router.post("/conversations/individual", chatController.createIndividualConversation);
router.get("/conversations/:conversationId", chatController.getConversation);
router.get("/conversations/:conversationId/messages", chatController.listMessages);
router.post("/conversations/:conversationId/messages", chatController.sendMessage);
router.post("/conversations/:conversationId/read", chatController.markConversationRead);
router.get("/unread-count", chatController.getUnreadCount);
router.patch("/messages/:messageId", chatController.editMessage);
router.delete("/messages/:messageId", chatController.deleteMessage);

module.exports = router;
