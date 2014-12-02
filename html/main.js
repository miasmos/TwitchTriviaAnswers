/* socket handlers */
var socket = io();
socket.on('init', function(data) {
	for (var i in data) {
		newMonitor(data[i]);
	}
});

socket.on('addmonitor', function(data){newMonitor(data)});

socket.on('removemonitor', function(data) {
	$('#'+data.streamer).remove();
});

socket.on('know', function(data) {questionUpdate(data, 0)});
socket.on('dontknow', function(data) {questionUpdate(data, 1)});
socket.on('answered', function(data) {questionUpdate(data, 2)});
socket.on('won', function(data) {questionUpdate(data, 3)});
socket.on('lost', function(data) {questionUpdate(data, 4)});
socket.on('disconnectmonitor', function(data) {toggleRowActivity(data, 0)});
socket.on('connectmonitor', function(data) {toggleRowActivity(data, 1)});
socket.on('enterraffle', function(data) {raffleUpdate(data, 0)});
socket.on('wonraffle', function(data) {raffleUpdate(data, 1)});
socket.on('lostraffle', function(data) {raffleUpdate(data, 2)});
/* end socket handlers */

/* ui */
$(document).on('click', '.add', function(){
	if ($('#addform').is(':hidden')) {
		$('#addform').show();
	} else {
		$('#addform').hide();
		var data = {
			streamer: $('#i_streamer').val(),
			triviabot: $('#i_triviabot').val(),
			questionPrefix: $('#i_qPrefix').val(),
			questionSuffix: $('#i_qSuffix').val(),
			answerPrefix: $('#i_aPrefix').val(),
			answerSuffix: $('#i_aSuffix').val(),
			noanswerPrefix: $('#i_naPrefix').val(),
			noanswerSuffix: $('#i_naSuffix').val(),
			rafflePrefix: $('#i_rPrefix').val(),
			raffleSuffix: $('#i_rSuffix').val(),
			wonrafflePrefix: $('#i_wrPrefix').val(),
			wonraffleSuffix: $('#i_wrSuffix').val()
		};
		socket.emit('addmonitor', data);
	}
});

$(document).on('click', '#i_close', function(){
	$('#addform').hide();
});

$(document).on('click', '.disconnect button', function(){
	socket.emit('disconnectmonitor', {streamer: $(this).parent().parent().attr('id')});
});

$(document).on('click', '.connect button', function(){
	socket.emit('connectmonitor', {streamer: $(this).parent().parent().attr('id')});
});

$(document).on('click', '.remove button', function(){
	socket.emit('removemonitor', {streamer: $(this).parent().parent().attr('id')});
});

$(document).on('click', '.disconnectall', function(){
	socket.emit('disconnectallmonitors');
});

$(document).on('click', '.connectall', function(){
	socket.emit('connectallmonitors');
});

$(document).on('keypress', '.message input', function(e) {
	if (e.which == 13 && $(this).val().trim() != '') {
		socket.emit('message', {streamer: $(this).parent().parent().attr('id'), message: $(this).val()});
		$(this).val('');
	}
});
/* end ui */

/* helpers */
function newMonitor(data) {
	if ($('#'+data.streamer).length) {return}
	$('#streamers').append('\
		<tr id="'+data.streamer+'">\
			<td class="streamer">'+data.streamer+'</td>\
			<td class="triviabot">'+data.triviabot+'</td>\
			<td class="question"></td>\
			<td class="raffle"></td>\
			<td class="message"><input/></td>\
			<td class="disconnect"><button>Disconnect</button>\
			<td class="remove"><button>Remove</button></td>\
			<td class="openstream"><a href="http://twitch.tv/'+data.streamer+'" target="_blank"><button>Open Stream</button></a></td>\
		</tr>');

	if (!data.status) {toggleRowActivity(data, 0)}
}

function questionUpdate(data, status) {
	//0 - known answer
	//1 - unknown answer
	//2 - answer verified
	//3 - got it right
	//4 - got it wrong
	$('#'+data.streamer+' .question').text(data.question);

	switch(status) {
		case 3:
			$('#'+data.streamer+' .question').css('background-color', '6cde7f');
			setTimeout(resetBackground($('#'+data.streamer+' .question')), 1000);
			break;
		case 4:
			$('#'+data.streamer+' .question').css('background-color', 'de6c6c');
			setTimeout(resetBackground($('#'+data.streamer+' .question')), 1000);
			break;
		default:
			$('#'+data.streamer+' .question').css('background-color', 'ddde6c');
			break;
	}
}

function raffleUpdate(data, status) {
	//0 - entered raffle
	//1 - won raffle
	//2 - lost raffle
	switch(status) {
		case 0:
			$('#'+data.streamer+' .raffle').css('background-color', '6cde7f');
			break;
		case 1:
			$('#'+data.streamer+' .raffle').css('background-color', '199f2f');
			setTimeout(resetBackground($('#'+data.streamer+' .raffle')), 10000);
			break;
		case 2:
			$('#'+data.streamer+' .raffle').css('background-color', 'de6c6c');
			setTimeout(resetBackground($('#'+data.streamer+' .raffle')), 10000);
			break; 
	}
}

function toggleRowActivity(data, toggle) {
	if (toggle) {
		var a = 'Connect', b = 'Disconnect';
		$('#'+data.streamer).css('color', '#000');
		$('#'+data.streamer+' input').removeAttr('disabled');
	} else {
		var a = 'Disconnect', b = 'Connect';
		$('#'+data.streamer).css('color', '#BBB');
		$('#'+data.streamer+' input').attr('disabled','disabled');
	}

	$('#'+data.streamer+' .'+a.toLowerCase()).removeClass(a.toLowerCase()).addClass(b.toLowerCase());
	$('#'+data.streamer+' .'+b.toLowerCase()+' button').text(b);
}

function resetBackground(target) {
	$(target).css('background-color', 'FFF');
}
/* endhelpers */