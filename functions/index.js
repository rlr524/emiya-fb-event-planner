"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
require("dotenv").config();

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: process.env.API_KEY,
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

const db = admin.firestore();
const eventsCollection = "events";
const express = require("express");
const app = express();

// const authenticate = async (req, res, next) => {
// 	if (
// 		!req.headers.authorization ||
// 		!req.headers.authorization.startsWith("Bearer ")
// 	) {
// 		res.status(403).send("Unauthorized");
// 		return;
// 	}
// 	const idToken = req.headers.authorization.split("Bearer ")[1];
// 	try {
// 		const decodedIdToken = await admin.auth().verifyIdToken(idToken);
// 		req.user = decodedIdToken;
// 		next();
// 		return;
// 	} catch (error) {
// 		res.status(403).send("Unauthorized");
// 		return;
// 	}
// };

// app.use(authenticate);

app.get("/events", async (req, res) => {
	try {
		const eventQuerySnap = await db.collection(eventsCollection).get();
		const events = [];
		eventQuerySnap.forEach((doc) => {
			events.push({
				id: doc.id,
				data: doc.data(),
			});
		});
		res.status(200).json(events);
	} catch (error) {
		res.status(500).send(error);
	}
});

// Expose the API as a function
exports.api = functions.https.onRequest(app);
