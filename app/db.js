var mongo = require('mongojs');

function db() {
	this.opts = {
		url: '127.0.0.1',
		collections: [
			'trivia',
			'prefixes',
			'status'
		]
	}
	this.db = mongo(this.opts.url+'/trivia', this.opts.collections);
}

db.prototype.saveQuestion = function(streamer, question, answer, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err){}};
	this.db.trivia.update({'streamer': streamer, 'question': question}, { $set: {'answer': answer} }, {upsert: true}, function(err) {
		callback(err);
	});
}

db.prototype.getAnswer = function(question, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err, doc){}};
	this.db.trivia.findOne({'question': question}, function(err, doc) {
		callback(err, doc);
	});
}

db.prototype.savePrefixes = function(streamer, questionP, answerP, noanswerP, raffleP, wonraffleP, questionS, answerS, noanswerS, raffleS, wonraffleS, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err){}};
	this.db.prefixes.update({'streamer': streamer}, { $set: {'questionP': questionP, 'answerP': answerP, 'questionS': questionS, 'answerS': answerS, 'noanswerP': noanswerP, 'noanswerS': noanswerS, 'raffleS': raffleS, 'raffleP': raffleP, 'wonraffleS': wonraffleS, 'wonraffleP': wonraffleP} }, {upsert: true}, function(err) {
		callback(err);
	});
}

db.prototype.getPrefixes = function(streamer, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err, doc){}};
	this.db.prefixes.findOne({'streamer': streamer}, function(err, doc) {
		callback(err, doc);
	});
}

db.prototype.saveStatus = function(streamer, triviabot, status, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err){}};
	if (triviabot == null) {
		this.db.status.update({'streamer': streamer }, { $set: { 'status': status } }, {upsert: true}, function(err) {
			callback(err);
		});
	} else {
		this.db.status.update({'streamer': streamer, 'triviabot': triviabot }, { $set: { 'status': status } }, {upsert: true}, function(err) {
			callback(err);
		});
	}
}

db.prototype.getStatus = function(streamer, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err, doc){}};
	this.db.status.findOne({'streamer': streamer}, function(err, doc) {
		callback(err, doc);
	});
}

db.prototype.getAllStatus = function(callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err, doc){}};
	this.db.status.find({}, function(err, doc) {
		callback(err, doc);
	});
}

db.prototype.resetStatus = function(callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err, doc){}};
	this.db.status.update( {}, { $set: { 'status': 0 } }, {multi:true}, function(err, doc) {
		callback(err, doc);
	});
}

db.prototype.removeStatus = function(streamer, callback) {
	if (callback == null || typeof callback === 'undefined') {callback = function(err, doc){}};
	this.db.status.remove( { 'streamer': streamer }, function(err, doc) {
		callback(err, doc);
	});	
}
module.exports = db;