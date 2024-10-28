const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize the Firebase Admin SDK if it's not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.logoutAllDevices = functions.https.onRequest((req, res) => {
  // Use cors middleware to handle the request
  cors(req, res, async () => {
    const { userId } = req.body;

    // Ensure the userId is provided
    if (!userId) {
      console.log('No userId provided');
      return res.status(400).send('User ID is required');
    }

    try {
      // Revoke refresh tokens for the user
      await admin.auth().revokeRefreshTokens(userId);
      console.log(`Tokens revoked for user: ${userId}`);
      return res.status(200).send('Successfully logged out from all devices');
    } catch (error) {
      console.error('Error revoking tokens:', error);
      return res.status(500).send('An error occurred while logging out from all devices');
    }
  });
});
