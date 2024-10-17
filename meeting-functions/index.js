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
  const { roomName } = req.query;

  if (!roomName) {
    return res.status(400).send("Room name is required.");
  }

  try {
    const privateKey = await getSecret(); // Fetch the secret key from Secret Manager

    // JWT Payload
    const payload = {
      aud: "jitsi", // Audience: "jitsi"
      iss: "chat", // Issuer
      sub: "vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765", // Subject (AppID)
      room: roomName, // Room name from query params
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // Expiry time (1 hour)
      context: {
        user: {
          moderator: true, // User is a moderator
        },
        features: {
          livestreaming: "false",
        //   outboundCall: "false",
          transcription: "false",
          recording: "true"
        },
      },
    };

    // JWT Signing with RS256
    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256",
      header: {
        alg: 'RS256',
        kid: "vpaas-magic-cookie-ef5ce88c523d41a599c8b1dc5b3ab765/ab9a6e",
      typ: 'JWT'
    }, // Replace with the actual `kid`
    });

    res.json({ token }); // Return the JWT token
  } catch (err) {
    console.error("Error generating JWT:", err);
    res.status(500).send("Failed to generate JWT");
  }
});

exports.api = functions.https.onRequest(app);
