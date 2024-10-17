const functions = require("firebase-functions");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors({ origin: true }));

const secretManagerClient = new SecretManagerServiceClient();

// Fetch private key from Secret Manager
async function getSecret() {
  try {
    const [version] = await secretManagerClient.accessSecretVersion({
      name: "projects/610288789461/secrets/PRIVATE_KEY/versions/latest",
    });
    const privateKey = version.payload.data.toString("utf8");
    console.log("Private key retrieved successfully.");
    return privateKey;
  } catch (error) {
    console.error("Error retrieving private key from Secret Manager:", error);
    throw new Error("Failed to access private key.");
  }
}

app.get("/generate-jwt", async (req, res) => {
  const { roomName, isModerator } = req.query;

  if (!roomName) {
    return res.status(400).send("Room name is required.");
  }

  try {
    const privateKey = await getSecret(); // Fetch the secret key from Secret Manager

    // Determine if the user is a moderator based on query parameter
    const moderator = isModerator === 'true';

    // JWT Payload
    const payload = {
      aud: "jitsi", // Audience: "jitsi"
      iss: "chat", // Issuer
      sub: "vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765", // Subject (AppID)
      room: roomName, // Room name from query params
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2, // Expiry time (2 hours)
      context: {
        user: {
          moderator: moderator, // Set user role (moderator or participant)
        },
        features: {
          livestreaming: "false",
          transcription: "false",
          recording: moderator ? "true" : "false", // Only allow recording for moderators
        },
      },
    };

    // JWT Signing with RS256
    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      header: {
        alg: 'RS256',
        kid: "vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/ab9a6e",
        typ: 'JWT',
      },
    });

    res.json({ token }); // Return the JWT token
  } catch (err) {
    console.error("Error generating JWT:", err);
    res.status(500).send("Failed to generate JWT");
  }
});

exports.api = functions.https.onRequest(app);
