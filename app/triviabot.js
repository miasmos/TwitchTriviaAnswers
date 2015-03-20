var irc = require('./irc.js');
var dbInclude = require('./db.js');
var events = require('events').EventEmitter;
var db = new dbInclude();

function triviabot(opts) {
	var self = this;
	this.events = new events();
	if (typeof opts.me === 'undefined' || typeof opts.password === 'undefined') {
		console.log('error: must supply login credentials');
		return;
	}
	this.opts = opts;
	this.monitors = [];
	this.refs = [];
	
	db.getAllStatus(function(err, data) {
		if (!err && data != null) {
			self.monitors = data;

			for (var i in self.monitors) {
				self.opts.streamer = self.monitors[i]['streamer'];
				self.opts.triviabot = self.monitors[i]['triviabot'];

				var test = new irc(self.opts, db);
				self.refs.push(test);	
				if (self.monitors[i]['status'] == 1) {
					self.connectMonitor(self.opts);
				}
			}
			console.log('app started');
		}
	});
}

triviabot.prototype.addMonitor = function(opts) {
	var self = this;
	db.savePrefixes(opts.streamer, opts.questionPrefix, opts.answerPrefix, opts.noanswerPrefix, opts.rafflePrefix, opts.wonrafflePrefix, opts.questionSuffix, opts.answerSuffix, opts.noanswerSuffix, opts.raffleSuffix, opts.wonraffleSuffix, false, function(err){
		opts.me = self.opts.me;
		opts.password = self.opts.password;

		var test = new irc(opts, db);
		self.monitors.push({
			streamer:opts.streamer,
			triviabot:opts.triviabot
		});
		self.refs.push(test);
		console.log('added monitor: '+opts.streamer);
		self.events.emit('addmonitor', {streamer:opts.streamer, triviabot:opts.triviabot});
		db.saveStatus(opts.streamer, opts.triviabot, 0, function(err){});
		self.connectMonitor(opts);
	});
}

triviabot.prototype.disconnectMonitor = function(opts) {
	var streamer = opts.streamer;
	var index = this.getMonitorIndex(streamer);
	if (index > -1) {
		this.refs[index].stop();
		this.refs[index].stopSpam();
		this.monitors[index]['status'] = 0;
		this.events.emit('disconnectmonitor', {streamer:streamer});
		console.log('disconnected monitor: '+streamer);
		db.saveStatus(opts.streamer, null, 0, function(err){});
	}
}

triviabot.prototype.connectMonitor = function(opts) {
	var self = this;
	var streamer = opts.streamer;
	var index = this.getMonitorIndex(streamer);
	var test = this.refs[index];

	test.events.on('know', function(data) {self.events.emit('know',data)});
	test.events.on('dontknow', function(data) {self.events.emit('dontknow',data)});
	test.events.on('answered', function(data) {self.events.emit('answered',data)});
	test.events.on('won', function(data) {self.events.emit('won',data)});
	test.events.on('lost', function(data) {self.events.emit('lost',data)});
	test.events.on('enterraffle', function(data) {self.events.emit('enterraffle',data)});
	test.events.on('lostraffle', function(data) {self.events.emit('lostraffle',data)});
	test.events.on('wonraffle', function(data) {self.events.emit('wonraffle',data)});
	test.events.on('spam', function(data) {self.events.emit('spam', data)});
	test.events.on('stopspam', function(data) {self.events.emit('stopspam', data)});
	
	test.start();
	this.monitors[index]['status'] = 1;
	this.events.emit('connectmonitor', {streamer:streamer});
	console.log('connected monitor: '+streamer);
	db.saveStatus(opts.streamer, null, 1, function(err){});
}

triviabot.prototype.removeMonitor = function(opts) {
	this.disconnectMonitor(opts);

	var streamer = opts.streamer;
	var index = this.getMonitorIndex(streamer);
	if (index > -1) {
		this.monitors.splice(index,1);
		this.refs.splice(index,1);
	}
	db.removeStatus(streamer, function(){});
	this.events.emit('removemonitor', {streamer:streamer});
	console.log('removed monitor: '+streamer);
}

triviabot.prototype.connectAllMonitors = function() {
	for (var i in this.monitors) {
		if (this.monitors[i]['status'] == 0) {
			this.connectMonitor({streamer: this.monitors[i]['streamer']});
		}
	}
}

triviabot.prototype.disconnectAllMonitors = function() {
	for (var i in this.monitors) {
		if (this.monitors[i]['status'] == 1) {
			this.disconnectMonitor({streamer: this.monitors[i]['streamer']});
		}
	}
}

triviabot.prototype.getMonitors = function() {
	return this.monitors;
}

triviabot.prototype.getMonitorIndex = function(streamer) {
	for (var i in this.monitors) {
		if (this.monitors[i]['streamer'] == streamer) {
			return i;
		}
	}
	return -1;
}

triviabot.prototype.sendMessage = function(streamer, message) {
	var index = this.getMonitorIndex(streamer);
	if (index > -1) {
		this.refs[index].say(message);
	}
}

triviabot.prototype.kappa = function(streamer) {
	var index = this.getMonitorIndex(streamer);
	if (index > -1) {
		this.refs[index].spam('Kappa', 30);
		this.events.emit('kappa', {streamer:streamer});
	}
}

triviabot.prototype.nokappa = function(streamer) {
	var index = this.getMonitorIndex(streamer);
	if (index > -1) {
		this.refs[index].stopSpam();
		this.events.emit('nokappa', {streamer:streamer});
	}
}
module.exports = triviabot;