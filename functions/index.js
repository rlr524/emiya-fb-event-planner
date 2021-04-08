"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyBsW6uczsHN7KKR5-_o5aQq4-HxI8f3KpY",
	authDomain: "emiya-fb-event-planner.firebaseapp.com",
	databaseURL: "https://emiya-fb-event-planner-default-rtdb.firebaseio.com",
	projectId: "emiya-fb-event-planner",
	storageBucket: "emiya-fb-event-planner.appspot.com",
	messagingSenderId: "824041129774",
	appId: "1:824041129774:web:f9b80b28ea1f9037ee5cbf",
	measurementId: "G-B7C2M48WRV",
};

admin.initializeApp({
	credential: admin.credential.applicationDefault(),
	databaseURL: firebaseConfig.databaseURL,
});

const language = require("@google-cloud/language");
const client = new language.LanguageServiceClient();
const express = require("express");
const app = express();

const authenticate = async (req, res, next) => {
	if (
		!req.headers.authorization ||
		!req.headers.authorization.startsWith("Bearer ")
	) {
		res.status(403).send("Unauthorized");
		return;
	}
	const idToken = req.headers.authorization.split("Bearer ")[1];
	try {
		const decodedIdToken = await admin.auth().verifyIdToken(idToken);
		req.user = decodedIdToken;
		next();
		return;
	} catch (error) {
		res.status(403).send("Unauthorized");
		return;
	}
};

app.use(authenticate);

// POST /api/messages
// Create a new message, get its sentiment using Google Cloud NLP,
// and categorize the sentiment before saving.
app.post("/api/messages", async (req, res) => {
	const message = req.body.message;

	functions.logger.log(`ANALYZING MESSAGE: "${message}"`);

	try {
		const results = await client.analyzeSentiment({
			document: { content: message, type: "PLAIN_TEXT" },
		});

		const category = categorizeScore(results[0].documentSentiment.score);
		const data = {
			message: message,
			sentiment: results[0],
			category: category,
		};

		// @ts-ignore
		const uid = req.user.uid;
		await admin.database().ref(`/users/${uid}/messages`).push(data);

		res.status(201).json({ message, category });
	} catch (error) {
		functions.logger.log(
			"Error detecting sentiment or saving message",
			error.message
		);
		res.sendStatus(500);
	}
});

// GET /api/messages?category={category}
// Get all messages, optionally specifying a category to filter on
app.get("/api/messages", async (req, res) => {
	// @ts-ignore
	const uid = req.user.uid;
	const category = `${req.query.category}`;

	/** @type admin.database.Query */
	let query = admin.database().ref(`/users/${uid}/messages`);

	if (
		category &&
		["positive", "negative", "neutral"].indexOf(category) > -1
	) {
		// Update the query with the valid category
		query = query.orderByChild("category").equalTo(category);
	} else if (category) {
		res.status(404).json({
			errorCode: 404,
			errorMessage: `category '${category}' not found`,
		});
		return;
	}
	try {
		const snapshot = await query.once("value");
		let messages = [];
		snapshot.forEach((childSnapshot) => {
			messages.push({
				key: childSnapshot.key,
				message: childSnapshot.val().message,
			});
		});

		res.status(200).json(messages);
	} catch (error) {
		functions.logger.log("Error getting messages", error.message);
		res.sendStatus(500);
	}
});

// GET /api/message/{messageId}
// Get details about a message
app.get("/api/message/:messageId", async (req, res) => {
	const messageId = req.params.messageId;

	functions.logger.log(`LOOKING UP MESSAGE "${messageId}"`);

	try {
		// @ts-ignore
		const uid = req.user.uid;
		const snapshot = await admin
			.database()
			.ref(`/users/${uid}/messages/${messageId}`)
			.once("value");

		if (!snapshot.exists()) {
			return res
				.status(404)
				.json({
					errorCode: 404,
					errorMessage: `message '${messageId}' not found`,
				});
		}
		res.set("Cache-Control", "private, max-age=300");
		return res.status(200).json(snapshot.val());
	} catch (error) {
		functions.logger.log(
			"Error getting message details",
			messageId,
			error.message
		);
		return res.sendStatus(500);
	}
});

// Expose the API as a function
exports.api = functions.https.onRequest(app);

// Helper function to categorize a sentiment score as positive, negative, or neutral
const categorizeScore = (score) => {
	if (score > 0.25) {
		return "positive";
	} else if (score < -0.25) {
		return "negative";
	}
	return "neutral";
};

// exports.addMessage = functions.https.onRequest(async (req, res) => {
// 	const original = req.query.text;
// 	const writeResult = await admin
// 		.firestore()
// 		.collection("messages")
// 		.add({ original: original });
// 	res.json({ result: `Message with ID: ${writeResult.id} added.` });
// });

// exports.makesUppercase = functions.firestore
// 	.document("/messages/{documentId}")
// 	.onCreate((snap, context) => {
// 		const original = snap.data().original;
// 		functions.logger.log(
// 			"Uppercasing",
// 			context.params.documentId,
// 			original
// 		);
// 		const uppercase = original.toUpperCase();
// 		return snap.ref.set({ uppercase }, { merge: true });
// 	});
