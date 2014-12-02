var http = require('http');
var irc = require('irc');
var events = require('events');

function ircworker(opts, db) {
	var self = this;
	this.db = db;
	this.events = new events.EventEmitter();
	this.opts = opts;
	this.currentQuestion = null;
	this.currentAnswer = null;
	this.answerQue = [];
	this.recordAnswers = false;
	this.answered = false;
}

ircworker.prototype.start = function() {
	var self = this;
	this.db.getPrefixes(this.opts.streamer, function(err, data) {
		if (!err && data != null) {
			if (data.questionP != null) {self.opts.questionPrefix = data.questionP;}
			if (data.answerP != null) {self.opts.answerPrefix = data.answerP;}
			if (data.questionS != null) {self.opts.questionSuffix = data.questionS;}
			if (data.answerS != null) {self.opts.answerSuffix = data.answerS;}
			if (data.noanswerP != null) {self.opts.noanswerPrefix = data.noanswerP;}
			if (data.noanswerS != null) {self.opts.noanswerSuffix = data.noanswerS;}
			if (data.raffleP != null) {self.opts.rafflePrefix = data.raffleP;}
			if (data.raffleS != null) {self.opts.raffleSuffix = data.raffleS;}
			if (data.wonraffleP != null) {self.opts.wonrafflePrefix = data.wonraffleP;}
			if (data.wonraffleS != null) {self.opts.wonraffleSuffix = data.wonraffleS;}
			self.instance();
		} else {
			self.log('error: prefixes weren\'t supplied and none are in the db for this streamer, exiting');
		}
	});
}

ircworker.prototype.instance = function() {
	this.bot = new irc.Client('irc.twitch.tv', this.opts.me, {
		debug: false,
		channels: ['#'+this.opts.streamer.toLowerCase()],
		realName: this.opts.me.toLowerCase(),
		userName: this.opts.me,
		password: this.opts.password
	});
	this.main();
}

ircworker.prototype.stop = function() {
	this.bot.removeAllListeners('error');
	this.bot.removeAllListeners('message');
	this.events.removeAllListeners();
}

ircworker.prototype.main = function() {
	var self = this;
	
	this.bot.addListener('error', function _error(message) {
		console.error('ERROR: %s: %s', message.command, message.args.join(' '));
		self.events.emit('stop', self.opts.streamer);
		self.stop();
		return;
	});

	this.bot.addListener('message', function _message(from, to, message) {
		if ( to.match(/^[#&]/) ) {
			// channel message
			if ( self.isRelevantUser(from) ) {
				if ( self.messageContainsQuestion(message) ) {
					self.recordAnswers = false;
					self.answerQue = [];
					self.answered = false;
					self.currentQuestion = self.getQuestionFromMessage(message);
					self.log('New question detected: "'+self.currentQuestion+'"');
					
					self.db.getAnswer(self.currentQuestion, function(err, data) {
						if (!err && data !== null && typeof(data.answer) !== 'undefined') {
							self.log('I know this one: "'+data.answer+'"');
							self.events.emit('know', {streamer: self.opts.streamer, question: self.currentQuestion, answer: data.answer});
							self.bot.say(to, data.answer.toLowerCase());
						} else {
							self.log('I don\'t know the answer, waiting for it...');
							self.events.emit('dontknow', {streamer: self.opts.streamer, question: self.currentQuestion, answer: ''});
						}
						self.recordAnswers = true;
					});
				} else if ( self.messageWasAnswered(message) ) {
					self.recordAnswers = false;
					
					if (!self.answered) {
						self.answered = true;
						self.currentAnswer = self.getAnswerFromMessage(message);
						self.answerQue = [];
						
						if (self.currentAnswer != -1) {
							if (self.checkIfWon(message)) {
								self.events.emit('won', {streamer: self.opts.streamer});
							} else {
								self.events.emit('lost', {streamer: self.opts.streamer});
								self.db.saveQuestion(self.streamer, self.currentQuestion, self.currentAnswer, function(err){
									if (err) {
										self.log('db error: '+err);
										self.stop();
										self.events.emit('stop', self.opts.streamer);
										return;
									}
								});
							}

							self.log('Question answered: "'+self.currentAnswer+'"');
							self.events.emit('answered', {streamer: self.opts.streamer, question: self.currentQuestion, answer: self.currentAnswer});
						}
					}
				} else if ( self.messageContainsRaffle(message) ) {
					self.currentRaffle = self.getRaffleFromMessage(message);
					self.log('Entering Raffle');
					self.events.emit('enterraffle', {streamer: self.opts.streamer});
					self.intervalCnt = 3;
					self.interval = setInterval(function() {
						self.bot.say(to, self.currentRaffle);
						self.intervalCnt--;
						if (self.intervalCnt <= 0) {clearInterval(self.interval);}
					}, 7000);
				} else if ( self.raffleWasCompleted(message) ) {
					self.raffleWinner = self.getRaffleWinnerFromMessage(message);
					if (self.raffleWinner.toLowerCase() == self.opts.me.toLowerCase()) {
						self.log('Won the raffle');
						self.events.emit('wonraffle', {streamer: self.opts.streamer});
						setTimeout(function(){
							self.bot.say(to, self.opts.celebrate);
							self.bot.say(self.opts.streamer, self.opts.email);
						}, 5000);
					} else {
						if (self.raffleWinner != -1) {
							self.log('Lost the raffle');
							self.events.emit('lostraffle', {streamer: self.opts.streamer});
						}
					}
				}
			} 
			
			if ( self.recordAnswers ) {
				self.answerQue.push([from,message]);
			}
		}
	});
}

ircworker.prototype.getAnswerFromMessage = function(msg) {
	if (msg.indexOf(this.opts.noanswerPrefix) > -1 && typeof this.opts.noanswerPrefix !== 'undefined') {
		//if question wasn't answered, get the answer from the current message
		var answer = msg.split(this.opts.noanswerPrefix);
		answer = answer[answer.length-1];
		
		if (this.opts.noanswerSuffix != '' && typeof this.opts.noanswerSuffix !== 'undefined') {
			answer = answer.split(this.opts.noanswerSuffix)[0];
		}
		return answer.trim();
	} else if (msg.indexOf(this.opts.answerPrefix) > -1) {
		//if it was, look for it in the recent message log
		var user = msg.split(this.opts.answerPrefix);
		user = user[user.length-1];
		user = user.split(this.opts.answerSuffix)[0];
		
		for (var i in this.answerQue) {
			if (this.answerQue[i][0].toLowerCase() == user.toLowerCase()) {
				return this.answerQue[i][1].trim();
			}
		}
	}
	return -1;
}

ircworker.prototype.checkIfWon = function(msg) {
	return msg.indexOf(this.opts.me) > -1;
}

ircworker.prototype.getQuestionFromMessage = function(msg) {
	var spl = msg.split(this.opts.questionPrefix);
	spl = spl[spl.length-1];
	if (this.opts.questionSuffix != '' && typeof this.opts.questionSuffix !== 'undefined') {
		spl = spl.split(this.opts.questionSuffix)[0];
	}
	return spl.trim();
}

ircworker.prototype.getRaffleFromMessage = function(msg) {
	var spl = msg.split(this.opts.rafflePrefix);
	spl = spl[spl.length-1];
	if (this.opts.raffleSuffix != '' && typeof this.opts.raffleSuffix !== 'undefined') {
		spl = spl.split(this.opts.raffleSuffix)[0];
	}
	return spl.trim();
}

ircworker.prototype.messageContainsQuestion = function(msg) {
	var re = new RegExp(this.opts.questionPrefix, "g");
	return msg.match(re) && typeof this.opts.questionPrefix !== 'undefined' && this.opts.questionPrefix != '';
}

ircworker.prototype.raffleWasCompleted = function(msg) {
	var re = new RegExp(this.opts.wonrafflePrefix, "g");
	return msg.match(re) && typeof this.opts.rafflePrefix !== 'undefined' && this.opts.rafflePrefix != '';
}

ircworker.prototype.messageContainsRaffle = function(msg) {
	var re = new RegExp(this.opts.rafflePrefix, "g");
	return msg.match(re) && typeof this.opts.rafflePrefix !== 'undefined' && this.opts.rafflePrefix != '';
}

ircworker.prototype.messageWasAnswered = function(msg) {
	var re = new RegExp(this.opts.answerPrefix, "g");
	var ree = new RegExp(this.opts.noanswerPrefix, "g");
	return (msg.match(re) || msg.match(ree)) && this.opts.answerPrefix != '' && this.opts.answerSuffix != '';
}

ircworker.prototype.getRaffleWinnerFromMessage = function(msg) {
	var spl = msg.split(this.opts.wonrafflePrefix);
	spl = spl[spl.length-1];
	if (this.opts.wonraffleSuffix != '' && typeof this.opts.wonraffleSuffix !== 'undefined') {
		spl = spl.split(this.opts.wonraffleSuffix)[0];
	}
	return spl.trim();
}

ircworker.prototype.isRelevantUser = function(from) {
	return from.toLowerCase() == this.opts.triviabot;
}

ircworker.prototype.log = function(msg) {
	console.log(this.opts.streamer+': '+msg);
}

ircworker.prototype.say = function(msg) {
	this.bot.say('#'+this.opts.streamer.toLowerCase(), msg);
}

module.exports = ircworker;