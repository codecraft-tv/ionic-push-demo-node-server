var Firebase = require("firebase");
var $http = require('http');
var request = require('request');
var btoa = require('btoa');
var _ = require('lodash-node');

var ROOM_TO_DEVICE_TOKENS_MAP = {};
var ref = new Firebase("https://tvchat-prod.firebaseio.com/");

var PRIVATE_API_KEY = '75aa8799c8eff4d5af4f305ff6ccb0492bd144c1060228e0';
var APP_ID = 'ea3f5ce9';
var AUTH_TOKEN = 'bKUli0nYyLdwasqZInHgOhzGlN56doAp2665laPr';

//
// Create a map of the roomID to a list of device tokens for users who
// have favorited that room.
//
function parseUsers(users) {
	console.log("Parsing Users");

	// Empty out the map
	ROOM_TO_DEVICE_TOKENS_MAP = {};
	// For each user
	_.each(users, function (user) {
		// Get their device token
		var deviceToken = user.deviceToken;
		// For each room the user has favorited
		_.each(user.favorites, function (room) {
			// Add their device token to the room_map
			var room_id = room.showid;
			if (!ROOM_TO_DEVICE_TOKENS_MAP[room_id]) {
				ROOM_TO_DEVICE_TOKENS_MAP[room_id] = [];
			}
			if (deviceToken) {
				console.log("Adding token to room", room_id, deviceToken);
				ROOM_TO_DEVICE_TOKENS_MAP[room_id].push(deviceToken);
			}
		})
	});
}

//
// Actually send a push notification to a set of users
// based on a message posted in a room
//
function sendPush(message) {
	// Get a list of device tokens for users who have favorited this room.
	var tokens = ROOM_TO_DEVICE_TOKENS_MAP[message.showId];

	// Send the message
	if (tokens.length) {
		request({
			url: "https://push.ionic.io/api/v1/push",
			method: "POST",
			json: true,
			body: {
				"tokens":tokens,
				"notification": {
					"alert": message.username + " posted '" + message.text + "' in show " + message.showName
				}
			},
			headers: {
				'Authorization': 'Basic ' + btoa(PRIVATE_API_KEY + ":"),
				'X-Ionic-Application-Id': APP_ID
			}
		}, function (error, response, body) {
			console.log(body);
		});
	}
}

//
// Listen for new messages in rooms and send a push to users who
// have favorited the room.
//
function listenToMessages() {
	console.log("Listening to firebase for new messages");
	var ignoreMessage = true;
	ref.child("messages").limitToLast(1).on("child_added", function (snapshot) {
		// Ignore first message
		if (ignoreMessage) {
			ignoreMessage = false;
		} else {
			console.log("Found a new message");
			sendPush(snapshot.val());
		}
	});
}

//
// Authenticate with firebase so we get read access to the
// database.
//
function authenticate () {
	ref.authWithCustomToken(AUTH_TOKEN, function(error, result) {
	  if (error) {
	    console.log("Authentication Failed!", error);
	  } else {
	    console.log("Authenticated successfully with payload:", result.auth);
	    console.log("Auth expires at:", new Date(result.expires * 1000));
		  listenToMessages()
	  }
	});
}

//
// Load all users from firebase so we know who to send
// push notifications to.
//
function loadAllUsers() {
	ref.child("users").on("value", function (snapshot) {
		parseUsers(snapshot.val());
	});
}

//
// Main
//
loadAllUsers();
authenticate();
