import admin from "firebase-admin";

// Initialise once — safe to call multiple times (guards internally)
let initialised = false;

function getApp(): admin.app.App {
  if (!initialised) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Newlines escaped in env var
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    initialised = true;
  }
  return admin.app();
}

export type NotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

// Send to a single FCM token
export async function sendToToken(token: string, payload: NotificationPayload): Promise<void> {
  try {
    await getApp().messaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: { priority: "high" },
      apns: { payload: { aps: { sound: "default" } } },
    });
  } catch (err) {
    // Log but don't throw — a bad token shouldn't fail the business operation
    console.error("[FCM] sendToToken failed:", err);
  }
}

// Send to multiple tokens (batched — FCM limit 500/batch)
export async function sendToTokens(tokens: string[], payload: NotificationPayload): Promise<void> {
  if (tokens.length === 0) return;
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  for (const chunk of chunks) {
    try {
      await getApp().messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });
    } catch (err) {
      console.error("[FCM] sendEachForMulticast failed:", err);
    }
  }
}
