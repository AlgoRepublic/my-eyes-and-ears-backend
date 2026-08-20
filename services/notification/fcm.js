let firebaseAdmin = null;
let firebaseApp = null;

const path = require("path");
const fs = require("fs");

const DEFAULT_SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  "../../config/firebase-service-account.json",
);

const getServiceAccountPath = () =>
  process.env.FCM_SERVICE_ACCOUNT_PATH || DEFAULT_SERVICE_ACCOUNT_PATH;

const getFirebaseAdmin = () => {
  if (!firebaseAdmin) {
    try {
      firebaseAdmin = require("firebase-admin");
    } catch (error) {
      throw new Error(
        "firebase-admin is not installed. Run: npm install firebase-admin",
      );
    }
  }

  return firebaseAdmin;
};

const parseServiceAccount = () => {
  if (process.env.FCM_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new Error("Invalid FCM_SERVICE_ACCOUNT_JSON value");
    }
  }

  const serviceAccountPath = getServiceAccountPath();
  if (fs.existsSync(serviceAccountPath)) {
    try {
      return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    } catch (error) {
      throw new Error(
        `Invalid Firebase service account file at ${serviceAccountPath}`,
      );
    }
  }

  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY
    ? process.env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n")
    : null;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
};

const initFcm = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const admin = getFirebaseAdmin();
  const existingApp =
    admin.apps && admin.apps.length > 0 ? admin.apps[0] : null;

  if (existingApp) {
    firebaseApp = existingApp;
    return firebaseApp;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      "Missing FCM credentials. Add config/firebase-service-account.json or set FCM_SERVICE_ACCOUNT_JSON / FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY",
    );
  }

  const options = {
    credential: admin.credential.cert(serviceAccount),
  };

  if (process.env.FCM_DATABASE_URL) {
    options.databaseURL = process.env.FCM_DATABASE_URL;
  }

  firebaseApp = admin.initializeApp(options);
  return firebaseApp;
};

const getMessaging = () => {
  const admin = getFirebaseAdmin();
  initFcm();
  return admin.messaging();
};

const buildMessage = ({
  token,
  topic,
  title,
  body,
  data,
  android,
  apns,
  webpush,
}) => {
  const message = {
    notification:
      title || body ? { title: title || "", body: body || "" } : undefined,
    data: data || undefined,
    android: android || undefined,
    apns: apns || undefined,
    webpush: webpush || undefined,
  };

  if (token) {
    message.token = token;
  }

  if (topic) {
    message.topic = topic;
  }

  return message;
};

const sendToToken = async ({
  token,
  title,
  body,
  data,
  android,
  apns,
  webpush,
}) => {
  if (!token) {
    throw new Error("token is required");
  }

  const messaging = getMessaging();
  const message = buildMessage({
    token,
    title,
    body,
    data,
    android,
    apns,
    webpush,
  });
  return messaging.send(message);
};

const sendToTopic = async ({
  topic,
  title,
  body,
  data,
  android,
  apns,
  webpush,
}) => {
  if (!topic) {
    throw new Error("topic is required");
  }

  const messaging = getMessaging();
  const message = buildMessage({
    topic,
    title,
    body,
    data,
    android,
    apns,
    webpush,
  });
  return messaging.send(message);
};

const sendMulticast = async ({
  tokens,
  title,
  body,
  data,
  android,
  apns,
  webpush,
}) => {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("tokens must be a non-empty array");
  }

  const messaging = getMessaging();
  const message = {
    tokens,
    notification:
      title || body ? { title: title || "", body: body || "" } : undefined,
    data: data || undefined,
    android: android || undefined,
    apns: apns || undefined,
    webpush: webpush || undefined,
  };

  return messaging.sendEachForMulticast(message);
};

module.exports = {
  initFcm,
  sendToToken,
  sendToTopic,
  sendMulticast,
};
