var express = require('express');
var path = require('path');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

var lumen_state = {
	"first_visit" : true,
	"twitter" : false,
	"mail" : false,
	"preset" : 1
}

var user_id = '';

//if prev state is not saved twitter stream and mail stream doesnt stop if multiple successive yes's or no's are sent by the client
var requests = {
	"prev_twitter_req" : "no",
	"prev_mail_req": "no",
}

var mailInterval;

var mailSend = function(){
	mailInterval = setInterval(function(){
		console.log("received mail");
		io.emit('mails','yes');
	},7000);
}

var clearMailInterval = function(){
	clearInterval(mailInterval);
}


///////////// TWITTER /////////////////

var Twit = require('twit');

var tweet_count = 0;

var client = new Twit({
	consumer_key: 'OSH9zEYe90ew8QSy0RcchedIx',
	consumer_secret: 'XIqSRziiAut6RNgkhEdskf0SFTeKpDaA4fehWaREXn7FkbsPOZ',
	access_token: '1319028200-zkM399rPAjx8MIn7HmMGqAYD1Ym6aNYCUUlsUrp',
	access_token_secret: '5QHtfe2T2N1hoEVJ4Cl4EsSR22OfCFVdxa8AxJ2OcpmHd'
});


var stream = client.stream('statuses/filter', {track: 'bieber', language: 'en'});

stream.on('tweet', function(tweet){
	tweet_count++;
	if(tweet_count%10 == 0 && lumen_state.twitter == true){
		console.log("15 bieber tweets");
		io.emit('tweets','yes');
	}
});

///////////// SOCKET /////////////////

io.on('connection', function(socket){
	console.log('lumen connected');
	
	

	//set initial state of notification when client connects
	if(lumen_state.twitter == true){
		console.log("twitter notification is on");
		stream.start();
	} else if(lumen_state.twitter == false){
		console.log("twitter notification is off");
		stream.stop();
	}

	if(lumen_state.mail == true){
		console.log("mail notification is on");
		mailSend();
	} else if(lumen_state.mail == false){
		console.log("mail notification is off");
		clearMailInterval();
	}

	//save whether user has visited before or not. will reset if server is restarted
	socket.on('user_id', function(id){
		if(id == user_id){
			console.log("returning user");
			io.emit('first_visit','no');
			lumen_state.first_visit = false;
		} else {
			console.log("new user");
			io.emit('first_visit','yes');
			user_id = id;
			lumen_state.first_visit = true;
		}

		//send copy of lumen state to client
		console.log("sending data copy to client");
		io.emit('lumen_state',lumen_state);
	})


	//switch twitter stream on or off based on client selection
	socket.on('connect_to_twitter', function(msg){
		if(msg == 'yes' && requests.prev_twitter_req != msg){
			console.log("start twitter stream");
			requests.prev_twitter_req = msg;   // saving previous request state otherwise if you send yes twice it breaks it and never stops streaming
			lumen_state.twitter = true;
			stream.start();	
		} else if(msg == 'no' && requests.prev_twitter_req != msg) {
			console.log("stop twitter stream");
			requests.prev_twitter_req = msg;
			lumen_state.twitter = false;
			stream.stop();
		}
	});

	// connect to mail on or off
	socket.on('connect_to_mail', function(msg){
		if(msg == 'yes' && requests.prev_mail_req != msg){
			console.log("connect to mail");
			requests.prev_mail_req = msg;
			lumen_state.mail = true;
			mailSend();
		} else if(msg == 'no' && requests.prev_mail_req != msg){
			console.log("disconnect from mail");
			requests.prev_mail_req = msg;
			lumen_state.mail = false;
			clearMailInterval();
		}
	});

	socket.on('preset', function(msg){
		console.log("Set preset number: " + msg);
		lumen_state.preset = msg;
	});

	socket.on('disconnect', function(){
		console.log("stop twitter and mail as lumen disconnected");
		stream.stop();
		clearMailInterval();
	});
});

//////// HTTP LISTEN ///////////

http.listen(3000, function(){
	console.log('listening on port 3000');
	console.log("Twitter: " + lumen_state.twitter);
	console.log("Email: " + lumen_state.mail);
	console.log("Preset: " + lumen_state.preset);
});