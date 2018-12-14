require('dotenv').config();
const fs = require('fs');
const util = require('util');
util.inspect.defaultOptions = {compact:false,breakLength:Infinity};

const Discord = require('discord.js');
const DBL = require("dblapi.js");
var request = require('request');

const isDebug = ( process.argv[2] == 'debug' ? true : false );

var client = new Discord.Client( {disableEveryone:true} );
const dbl = new DBL(process.env.dbltoken);

var i18n = require('./i18n.json');

var pause = {};
var stop = false;
var access = {'PRIVATE-TOKEN': process.env.access};
var defaultPermissions = new Discord.Permissions(268954688).toArray();

var ready = {
	settings: true
}

var defaultSettings = {
	"default": {
		"lang": "en",
		"wiki": [
			"community",
			""
		]
	}
}
var settings = defaultSettings;

function getSettings(callback) {
	ready.settings = true;
	request( {
		uri: process.env.read + process.env.file + process.env.raw,
		headers: access,
		json: true
	}, function( error, response, body ) {
		if ( error || !response || response.statusCode != 200 || !body || body.message || body.error ) {
			console.log( '- Fehler beim Erhalten der Einstellungen' + ( error ? ': ' + error : ( body ? ( body.message ? ': ' + body.message : ( body.error ? ': ' + body.error : '.' ) ) : '.' ) ) );
			ready.settings = false;
		}
		else {
			console.log( '- Einstellungen erfolgreich ausgelesen.' );
			settings = Object.assign({}, body);
		}
		callback();
	} );
}

function setStatus() {
	if ( settings == defaultSettings ) client.user.setStatus('invisible').catch(log_error);
	else {
		client.user.setStatus('online').catch(log_error);
		client.user.setActivity( process.env.prefix + ' help' ).catch(log_error);
	}
}

client.on( 'ready', () => {
	console.log( '- Erfolgreich als ' + client.user.username + ' angemeldet!' );
	getSettings(setStatus);
	
	if ( !isDebug ) client.setInterval( () => {
		console.log( '- Anzahl der Server: ' + client.guilds.size );
		dbl.postStats(client.guilds.size).catch( () => {} );
		request.post( {
			uri: 'https://discord.bots.gg/api/v1/bots/' + client.user.id + '/stats',
			headers: {Authorization: process.env.dbggtoken},
			body: {guildCount: client.guilds.size},
			json: true
		} );
	}, 10800000);
} );


var timeoptions = {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'UTC',
	timeZoneName: 'short'
}
	
	
var cmdmap = {
	help: cmd_help,
	test: cmd_test,
	invite: cmd_invite,
	say: cmd_multiline,
	delete: cmd_multiline,
	poll: cmd_multiline,
	voice: cmd_voice,
	settings: cmd_settings,
	info: cmd_info
}

var multilinecmdmap = {
	say: cmd_say,
	delete: cmd_delete,
	poll: cmd_umfrage
}

var ownercmdmap = {
	stop: cmd_stop,
	pause: cmd_pause,
	eval: cmd_eval,
	get: cmd_get
}

var pausecmdmap = {
	test: cmd_test,
	say: cmd_multiline,
	delete: cmd_multiline,
	settings: cmd_settings
}

function cmd_settings(lang, msg, args, line) {
	if ( msg.isAdmin() ) {
		if ( msg.guild.id in settings ) {
			var text = lang.settings.current.replace( '%1$s', '- `' + process.env.prefix + ' settings lang`' ).replace( '%2$s', 'https://' + settings[msg.guild.id].wiki[0] + '.fandom.com/wiki/ - `' + process.env.prefix + ' settings wiki`' ) + ' - `' + process.env.prefix + ' settings channel`\n';
			if ( settings[msg.guild.id].channels ) {
				Object.keys(settings[msg.guild.id].channels).forEach( function(channel) {
					text += '<#' + channel + '>: <https://' + settings[msg.guild.id].channels[channel][0] + '.fandom.com/wiki/>\n';
				} );
			} else text += lang.settings.nochannels;
		} else {
			var text = lang.settings.missing.replace( '%1$s', '`' + process.env.prefix + ' settings lang`' ).replace( '%2$s', '`' + process.env.prefix + ' settings wiki`' );
		}
		if ( args.length ) {
			if ( args[0] ) args[0] = args[0].toLowerCase();
			if ( args[1] ) args[1] = args.slice(1).join(' ').toLowerCase();
			var langs = '\n' + lang.settings.langhelp.replace( '%s', process.env.prefix + ' settings lang' ) + ' `' + i18n.allLangs[1].join(', ') + '`';
			var wikis = '\n' + lang.settings.wikihelp.replace( '%s', process.env.prefix + ' settings wiki' );
			var channels = '\n' + lang.settings.wikihelp.replace( '%s', process.env.prefix + ' settings channel' );
			var nolangs = lang.settings.langinvalid + langs;
			var nowikis = lang.settings.wikiinvalid + wikis;
			var nochannels = lang.settings.wikiinvalid + channels;
			var regex = args[1].match( /^(?:(?:https?:)?\/\/)?([a-z\d-]{1,30})\.fandom\.com/ );
			if ( msg.guild.id in settings ) {
				var current	= args[0] + ( line == 'changed' ? line : '' );
				if ( args[0] == 'lang' ) {
					if ( args[1] ) {
						if ( args[1] in i18n.allLangs[0] ) edit_settings(lang, msg, 'lang', i18n.allLangs[0][args[1]]);
						else msg.replyMsg( nolangs );
					} else msg.replyMsg( lang.settings[current] + langs );
				} else if ( args[0] == 'wiki' ) {
					if ( args[1] ) {
						if ( regex !== null ) edit_settings(lang, msg, 'wiki', [regex[1], '']);
						else msg.replyMsg( nowikis );
					} else msg.replyMsg( lang.settings[current] + ' https://' + settings[msg.guild.id].wiki[0] + '.fandom.com/wiki/' + wikis );
				} else if ( args[0] == 'channel' ) {
					if ( args[1] ) {
						if ( regex !== null ) edit_settings(lang, msg, 'channel', [regex[1], '']);
						else msg.replyMsg( nochannels );
					} else if ( settings[msg.guild.id].channels && msg.channel.id in settings[msg.guild.id].channels ) {
						msg.replyMsg( lang.settings[current] + ' https://' + settings[msg.guild.id].channels[msg.channel.id][0] + '.fandom.com/wiki/' + channels );
					} else msg.replyMsg( lang.settings[current] + ' https://' + settings[msg.guild.id].wiki[0] + '.fandom.com/wiki/' + channels );
				} else msg.replyMsg( text );
			} else {
				if ( args[0] == 'lang' ) {
					if ( args[1] ) {
						if ( args[1] in i18n.allLangs[0] ) edit_settings(lang, msg, 'lang', i18n.allLangs[0][args[1]]);
						else msg.replyMsg( nolangs );
					} else msg.replyMsg( lang.settings.lang + langs );
				} else if ( args[0] == 'wiki' || args[0] == 'channel' ) {
					if ( args[1] ) {
						if ( regex !== null ) edit_settings(lang, msg, 'wiki', [regex[1], '']);
						else msg.replyMsg( nowikis );
					} else msg.replyMsg( lang.settings.wikimissing + wikis );
				} else msg.replyMsg( text );
			}
		} else msg.replyMsg( text );
	} else {
		msg.reactEmoji('❌');
	}
}

function edit_settings(lang, msg, key, value) {
	msg.reactEmoji('⏳').then( function( reaction ) {
		if ( settings == defaultSettings ) {
			console.log( '- Fehler beim Erhalten bestehender Einstellungen.' );
			msg.replyMsg( lang.settings.save_failed );
			if ( reaction ) reaction.removeEmoji();
		}
		else {
			var temp_settings = Object.assign({}, settings);
			if ( !( msg.guild.id in temp_settings ) ) temp_settings[msg.guild.id] = Object.assign({}, defaultSettings['default']);
			if ( key == 'channel' ) {
				if ( !temp_settings[msg.guild.id].channels ) temp_settings[msg.guild.id].channels = {};
				temp_settings[msg.guild.id].channels[msg.channel.id] = value;
			} else temp_settings[msg.guild.id][key] = value;
			Object.keys(temp_settings).forEach( function(guild) {
				if ( !client.guilds.has(guild) && guild != 'default' ) {
					delete temp_settings[guild];
				} else {
					var channels = temp_settings[guild].channels;
					if ( channels ) {
						Object.keys(channels).forEach( function(channel) {
							if ( channels[channel].join() == temp_settings[guild].wiki.join() || !client.guilds.get(guild).channels.has(channel) ) delete channels[channel];
						} );
						if ( !Object.keys(channels).length ) delete temp_settings[guild].channels;
					}
				}
			} );
			request.post( {
				uri: process.env.save,
				headers: access,
				body: {
					branch: 'master',
					commit_message: client.user.username + ': Einstellungen aktualisiert.',
					actions: [
						{
							action: 'update',
							file_path: process.env.file,
							content: JSON.stringify( temp_settings, null, '\t' )
						}
					]
				},
				json: true
			}, function( error, response, body ) {
				if ( error || !response || response.statusCode != 201 || !body || body.error ) {
					console.log( '- Fehler beim Bearbeiten' + ( error ? ': ' + error : ( body ? ( body.message ? ': ' + body.message : ( body.error ? ': ' + body.error : '.' ) ) : '.' ) ) );
					msg.replyMsg( lang.settings.save_failed );
				}
				else {
					settings = Object.assign({}, temp_settings);
					if ( key == 'lang' ) lang = i18n[value];
					cmd_settings(lang, msg, [key], 'changed');
					console.log( '- Einstellungen erfolgreich aktualisiert.' );
				}
				
				if ( reaction ) reaction.removeEmoji();
			} );
		}
	} );
}

function cmd_info(lang, msg, args, line) {
	if ( args.length ) cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	else {
		var owner = '*MarkusRost*';
		if ( msg.channel.type == 'text' && msg.guild.members.has(process.env.owner) ) owner = '<@' + process.env.owner + '>';
		msg.channel.sendMsg( lang.disclaimer.replace( '%s', owner ) );
		cmd_helpserver(lang, msg);
		cmd_invite(lang, msg, args, line);
	}
}

function cmd_helpserver(lang, msg) {
	msg.channel.sendMsg( lang.helpserver + '\n' + process.env.invite );
}

function cmd_help(lang, msg, args, line) {
	if ( msg.isAdmin() && !( msg.guild.id in settings ) && settings != defaultSettings ) {
		cmd_settings(lang, msg, [], line);
		cmd_helpserver(lang, msg);
	}
	var cmds = lang.help.list;
	if ( args.length ) {
		if ( args.join(' ').isMention(msg.guild) ) cmd_helpserver(lang, msg);
		else if ( args[0].toLowerCase() == 'admin' ) {
			if ( msg.channel.type != 'text' || msg.isAdmin() ) {
				var cmdlist = lang.help.admin + '\n';
				for ( var i = 0; i < cmds.length; i++ ) {
					if ( cmds[i].admin && !cmds[i].hide ) {
						cmdlist += '🔹 `' + process.env.prefix + ' ' + cmds[i].cmd + '`\n\t' + cmds[i].desc + '\n';
					}
				}
				
				msg.channel.sendMsg( cmdlist, {split:true} );
			}
			else {
				msg.replyMsg( lang.help.noadmin );
			}
		}
		else {
			var cmdlist = ''
			for ( var i = 0; i < cmds.length; i++ ) {
				if ( cmds[i].cmd.split(' ')[0] === args[0].toLowerCase() && !cmds[i].unsearchable && ( msg.channel.type != 'text' || !cmds[i].admin || msg.isAdmin() ) ) {
					cmdlist += '🔹 `' + process.env.prefix + ' ' + cmds[i].cmd + '`\n\t' + cmds[i].desc + '\n';
				}
			}
			
			if ( cmdlist == '' ) msg.reactEmoji('❓');
			else msg.channel.sendMsg( cmdlist, {split:true} );
		}
	}
	else {
		var cmdlist = lang.help.all + '\n';
		for ( var i = 0; i < cmds.length; i++ ) {
			if ( !cmds[i].hide && !cmds[i].admin ) {
				cmdlist += '🔹 `' + process.env.prefix + ' ' + cmds[i].cmd + '`\n\t' + cmds[i].desc + '\n';
			}
		}
		
		msg.channel.sendMsg( cmdlist, {split:true} );
	}
}

function cmd_say(lang, msg, args, line) {
	args = args.toEmojis();
	var text = args.join(' ');
	if ( args[0] == 'alarm' ) text = '🚨 **' + args.slice(1).join(' ') + '** 🚨';
	var imgs = msg.attachments.map( function(img) {
		return {attachment:img.url,name:img.filename};
	} );
	if ( msg.isOwner() ) {
		try {
			text = eval( '`' + text + '`' );
		} catch ( error ) {
			log_error(error);
		}
	}
	if ( text || imgs.length ) {
		msg.channel.send( text, {disableEveryone:!msg.member.hasPermission(['MENTION_EVERYONE']),files:imgs} ).then( () => msg.deleteMsg(), error => {
			log_error(error);
			msg.reactEmoji('error');
		} );
	} else {
		args[0] = line.split(' ')[1];
		cmd_help(lang, msg, args, line);
	}
}

function cmd_test(lang, msg, args, line) {
	if ( args.length ) {
		if ( msg.channel.type != 'text' || !pause[msg.guild.id] ) cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	} else if ( msg.channel.type != 'text' || !pause[msg.guild.id] ) {
		var text = lang.test.default;
		var x = Math.floor(Math.random() * lang.test.random);
		if ( x < lang.test.text.length ) text = lang.test.text[x];
		console.log( '- Dies ist ein Test: Voll funktionsfähig!' );
		var now = Date.now();
		msg.replyMsg( text ).then( edit => {
			var then = Date.now();
			var embed = new Discord.RichEmbed().setTitle( lang.test.time ).addField( 'Discord', ( then - now ) + 'ms' );
			now = Date.now();
			request( {
				uri: 'https://' + lang.link + '.fandom.com/api.php?action=query&format=json',
				json: true
			}, function( error, response, body ) {
				then = Date.now();
				var ping = ( then - now ) + 'ms';
				if ( error || !response || response.statusCode != 200 || !body ) {
					if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + lang.link + '.fandom.com' ) {
						console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
						ping += ' <:unknown_wiki:505887262077353984>';
					}
					else {
						console.log( '- Fehler beim Erreichen des Wikis' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
						ping += ' <:error:505887261200613376>';
					}
				}
				embed.addField( lang.link + '.fandom.com', ping );
				edit.edit( edit.content, embed );
			} );
		} );
	} else {
		console.log( '- Dies ist ein Test: Pausiert!' );
		msg.replyMsg( lang.test.pause );
	}
}

function cmd_invite(lang, msg, args, line) {
	if ( args.length ) {
		cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	} else {
		client.generateInvite(defaultPermissions).then( invite => msg.channel.sendMsg( lang.invite.bot + '\n<' + invite + '>' ), log_error );
	}
}

async function cmd_eval(lang, msg, args, line) {
	try {
		var text = util.inspect( await eval( args.join(' ') ) );
	} catch ( error ) {
		var text = error.name + ': ' + error.message;
	}
	if ( text.length > 2000 ) msg.reactEmoji('✅');
	else msg.channel.sendMsg( '```js\n' + text + '\n```', {split:{prepend:'```js\n',append:'\n```'}} );
	if ( isDebug ) console.log( '--- EVAL START ---\n\u200b' + text.replace( /\n/g, '\n\u200b' ) + '\n--- EVAL END ---' );
}

async function cmd_stop(lang, msg, args, line) {
	if ( args.join(' ').split('\n')[0].isMention(msg.guild) ) {
		await msg.replyMsg( 'I\'ll destroy myself now!' );
		await client.destroy();
		console.log( '- Ich schalte mich nun aus!' );
		setTimeout( async () => {
			console.log( '- Ich brauche zu lange zum Beenden, terminieren!' );
			process.exit(1);
		}, 1000 ).unref();
	} else if ( msg.channel.type != 'text' || !pause[msg.guild.id] ) {
		cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	}
}

function cmd_pause(lang, msg, args, line) {
	if ( msg.channel.type == 'text' && args.join(' ').split('\n')[0].isMention(msg.guild) ) {
		if ( pause[msg.guild.id] ) {
			delete pause[msg.guild.id];
			console.log( '- Ich bin wieder wach!' );
			msg.replyMsg( 'I\'m up again!' );
		} else {
			msg.replyMsg( 'I\'m going to sleep now!' );
			console.log( '- Ich lege mich nun schlafen!' );
			pause[msg.guild.id] = true;
		}
	} else if ( msg.channel.type != 'text' || !pause[msg.guild.id] ) {
		cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
	}
}

function cmd_delete(lang, msg, args, line) {
	if ( /^\d+$/.test(args[0]) && parseInt(args[0], 10) + 1 > 0 ) {
		if ( parseInt(args[0], 10) > 99 ) {
			msg.replyMsg( lang.delete.big.replace( '%s', '`99`' ) );
		}
		else {
			msg.channel.bulkDelete(parseInt(args[0], 10) + 1, true).then( messages => {
				msg.reply( lang.delete.success.replace( '%s', messages.size - 1 ) ).then( antwort => antwort.deleteMsg(3000), log_error );
				console.log( '- Die letzten ' + ( messages.size - 1 ) + ' Nachrichten in #' + msg.channel.name + ' wurden von @' + msg.member.displayName + ' gelöscht!' );
			}, log_error );
		}
	}
	else {
		msg.replyMsg( lang.delete.invalid );
	}
}

function cmd_link(lang, msg, title, wiki = lang.link, cmd = ' ', querystring = '', fragment = '', selfcall = 0) {
	if ( cmd == ' ' && msg.isAdmin() && !( msg.guild.id in settings ) && settings != defaultSettings ) {
		cmd_settings(lang, msg, [], '');
	}
	if ( title.includes( '#' ) ) {
		fragment = title.split('#').slice(1).join('#');
		title = title.split('#')[0];
	}
	if ( /\?[a-z]+=/.test(title) ) {
		var querystart = title.search(/\?[a-z]+=/);
		querystring = title.substr(querystart + 1);
		title = title.substr(0, querystart);
	}
	var linksuffix = ( querystring ? '?' + querystring.toTitle() : '' ) + ( fragment ? '#' + fragment.toSection() : '' );
	if ( title.length > 300 ) {
		title = title.substr(0, 300);
		msg.reactEmoji('⚠');
	}
	var invoke = title.split(' ')[0].toLowerCase();
	var args = title.split(' ').slice(1);
	
	if ( ( invoke == 'random' || invoke == '🎲' ) && !args.join('') && !linksuffix ) cmd_random(lang, msg, wiki);
	else if ( invoke == 'page' || invoke == lang.search.page ) msg.channel.sendMsg( '<https://' + wiki + '.fandom.com/wiki/' + args.join('_').toTitle() + linksuffix + '>' );
	else if ( invoke == 'search' || invoke == lang.search.search ) msg.channel.sendMsg( '<https://' + wiki + '.fandom.com/wiki/Special:Search/' + args.join('_').toTitle() + linksuffix + '>' );
	else if ( invoke == 'diff' && args.length ) cmd_diff(lang, msg, args, wiki);
	else {
		msg.reactEmoji('⏳').then( function( reaction ) {
			request( {
				uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&meta=siteinfo&siprop=general&iwurl=true' + ( /(?:^|&)redirect=no(?:&|$)/.test( querystring ) ? '' : '&redirects=true' ) + '&titles=' + encodeURIComponent( title ),
				json: true
			}, function( error, response, body ) {
				if ( error || !response || response.statusCode != 200 || !body || !body.query ) {
					if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + wiki + '.fandom.com' ) {
						console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
						msg.reactEmoji('nowiki');
					}
					else {
						console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
						msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/' + ( linksuffix ? title.toTitle() + linksuffix : 'Special:Search/' + title.toTitle() ) + '>' );
					}
					
					if ( reaction ) reaction.removeEmoji();
				}
				else {
					if ( body.query.pages ) {
						var querypage = Object.values(body.query.pages)[0];
						if ( querypage.ns == 2 && ( !querypage.title.includes( '/' ) || /^[^:]+:[\d\.]+\/\d\d$/.test(querypage.title) ) ) {
							var userparts = querypage.title.split(':');
							cmd_user(lang, msg, userparts[0].toTitle() + ':', userparts.slice(1).join(':'), wiki, linksuffix, reaction);
						}
						else if ( body.query.pages['-1'] && ( ( body.query.pages['-1'].missing != undefined && body.query.pages['-1'].known == undefined ) || body.query.pages['-1'].invalid != undefined ) ) {
							request( {
								uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&generator=search&gsrnamespace=0|4|12|14|10000|10002|10004|10006|10008|10010&gsrlimit=1&gsrsearch=' + encodeURIComponent( title ),
								json: true
							}, function( srerror, srresponse, srbody ) {
								if ( srerror || !srresponse || srresponse.statusCode != 200 || !srbody ) {
									console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( srerror ? ': ' + srerror : ( srbody ? ( srbody.error ? ': ' + srbody.error.info : '.' ) : '.' ) ) );
									msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/Special:Search/' + title.toTitle() + '>' );
								}
								else {
									if ( !srbody.query ) {
										msg.reactEmoji('🤷');
									}
									else {
										var pagelink = 'https://' + wiki + '.fandom.com/wiki/' + Object.values(srbody.query.pages)[0].title.toTitle() + linksuffix;
										if ( title.replace( /\-/g, ' ' ).toTitle().toLowerCase() == querypage.title.replace( /\-/g, ' ' ).toTitle().toLowerCase() ) {
											msg.channel.sendMsg( pagelink );
										}
										else if ( !srbody.continue ) {
											msg.channel.sendMsg( pagelink + '\n' + lang.search.infopage.replace( '%s', '`' + process.env.prefix + cmd + lang.search.page + ' ' + title + '`' ) );
										}
										else {
											msg.channel.sendMsg( pagelink + '\n' + lang.search.infosearch.replace( '%1$s', '`' + process.env.prefix + cmd + lang.search.page + ' ' + title + '`' ).replace( '%2$s', '`' + process.env.prefix + cmd + lang.search.search + ' ' + title + '`' ) );
										}
									}
								}
								
								if ( reaction ) reaction.removeEmoji();
							} );
						}
						else {
							msg.channel.sendMsg( 'https://' + wiki + '.fandom.com/wiki/' + querypage.title.toTitle() + ( querystring ? '?' + querystring.toTitle() : '' ) + ( body.query.redirects && body.query.redirects[0].tofragment ? '#' + body.query.redirects[0].tofragment.toSection() : ( fragment ? '#' + fragment.toSection() : '' ) ) );
							
							if ( reaction ) reaction.removeEmoji();
						}
					}
					else if ( body.query.interwiki ) {
						var inter = body.query.interwiki[0];
						var intertitle = inter.title.substr(inter.iw.length + 1);
						var regex = inter.url.match( /^(?:https?:)?\/\/(.*)\.fandom\.com\/wiki\// );
						if ( regex !== null && selfcall < 3 ) {
							var iwtitle = decodeURIComponent( inter.url.replace( regex[0], '' ) ).replace( /\_/g, ' ' ).replace( intertitle.replace( /\_/g, ' ' ), intertitle );
							selfcall++;
							cmd_link(lang, msg, iwtitle, regex[1], ' !' + regex[1] + ' ', querystring, fragment, selfcall);
						} else {
							msg.channel.sendMsg( inter.url + linksuffix ).then( message => {
								if ( message && selfcall == 3 ) message.reactEmoji('⚠');
							} );
							if ( reaction ) reaction.removeEmoji();
						}
					}
					else {
						msg.channel.sendMsg( 'https://' + wiki + '.fandom.com/wiki/' + body.query.general.mainpage.toTitle() + linksuffix );
						
						if ( reaction ) reaction.removeEmoji();
					}
				}
			} );
		} );
	}
}

function cmd_umfrage(lang, msg, args, line) {
	var imgs = msg.attachments.map( function(img) {
		return {attachment:img.url,name:img.filename};
	} );
	if ( args.length || imgs.length ) {
		var reactions = [];
		args = args.toEmojis();
		for ( var i = 0; ( i < args.length || imgs.length ); i++ ) {
			var reaction = args[i];
			var custom = /^<a?:/;
			var pattern = /^[\w\säÄöÖüÜßẞ!"#$%&'()*+,./:;<=>?@^`{|}~–[\]\-\\]{2,}/;
			if ( !custom.test(reaction) && pattern.test(reaction) ) {
				cmd_sendumfrage(lang, msg, args, reactions, imgs, i);
				break;
			} else if ( reaction == '' ) {
			} else {
				if ( custom.test(reaction) ) {
					reaction = reaction.substring(reaction.lastIndexOf(':') + 1, reaction.length - 1);
				}
				reactions[i] = reaction;
				if ( i == args.length - 1 ) {
					cmd_sendumfrage(lang, msg, args, reactions, imgs, i + 1);
					break;
				}
			}
		}
	} else {
		args[0] = line.split(' ')[1];
		cmd_help(lang, msg, args, line);
	}
}

function cmd_sendumfrage(lang, msg, args, reactions, imgs, i) {
	msg.channel.send( lang.poll.title + args.slice(i).join(' '), {disableEveryone:!msg.member.hasPermission(['MENTION_EVERYONE']),files:imgs} ).then( poll => {
		msg.deleteMsg();
		if ( reactions.length ) {
			reactions.forEach( function(entry) {
				poll.react(entry).catch( error => {
					log_error(error);
					poll.reactEmoji('error');
				} );
			} );
		} else {
			poll.reactEmoji('support');
			poll.reactEmoji('oppose');
		}
	}, error => {
		log_error(error);
		msg.reactEmoji('error');
	} );
}

function cmd_user(lang, msg, namespace, username, wiki, linksuffix, reaction) {
	if ( /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d\d)?$/.test(username) ) {
		request( {
			uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&list=blocks&bkprop=user|by|timestamp|expiry|reason&bkip=' + encodeURIComponent( username ),
			json: true
		}, function( error, response, body ) {
			if ( error || !response || response.statusCode != 200 || !body || !body.query || !body.query.blocks ) {
				if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + wiki + '.fandom.com' ) {
					console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
					msg.reactEmoji('nowiki');
				}
				else if ( body && body.error && ( body.error.code == 'param_ip' || body.error.code == 'cidrtoobroad' ) ) {
					msg.reactEmoji('error');
				}
				else {
					console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
					msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/Special:Contributions/' + username.toTitle() + '>' );
				}
				
				if ( reaction ) reaction.removeEmoji();
			}
			else {
				var blocks = body.query.blocks.map( function(block) {
					var isBlocked = false;
					var blockedtimestamp = (new Date(block.timestamp)).toLocaleString(lang.user.dateformat, timeoptions);
					var blockexpiry = block.expiry;
					if ( blockexpiry == 'infinity' ) {
						blockexpiry = lang.user.block.until_infinity;
						isBlocked = true;
					} else if ( blockexpiry ) {
						if ( Date.parse(blockexpiry) > Date.now() ) isBlocked = true;
						blockexpiry = (new Date(blockexpiry)).toLocaleString(lang.user.dateformat, timeoptions);
					}
					if ( isBlocked ) return [lang.user.block.header.replace( '%s', block.user ), lang.user.block.text.replace( '%1$s', blockedtimestamp ).replace( '%2$s', blockexpiry ).replace( '%3$s', '[[User:' + block.by + '|' + block.by + ']]' ).replace( '%4$s', block.reason )];
				} ).filter( block => block != undefined );
				if ( username.includes( '/' ) ) {
					var rangeprefix = username;
					var range = parseInt(username.substr(-2, 2), 10);
					if ( range >= 32 ) username = username.replace( /^(.+)\/\d\d$/, '$1' );
					else if ( range >= 24 ) rangeprefix = username.replace( /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.).+$/, '$1' );
					else if ( range >= 16 ) rangeprefix = username.replace( /^(\d{1,3}\.\d{1,3}\.).+$/, '$1' );
				}
				request( {
					uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&list=usercontribs&ucprop=&ucuser=' + encodeURIComponent( username ),
					json: true
				}, function( ucerror, ucresponse, ucbody ) {
					if ( ucerror || !ucresponse || ucresponse.statusCode != 200 || !ucbody || !ucbody.query || !ucbody.query.usercontribs ) {
						if ( ucbody && ucbody.error && ucbody.error.code == 'baduser_ucuser' ) {
							msg.reactEmoji('error');
						}
						else {
							console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( ucerror ? ': ' + ucerror : ( ucbody ? ( ucbody.error ? ': ' + ucbody.error.info : '.' ) : '.' ) ) );
							msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/Special:Contributions/' + username.toTitle() + '>' );
						}
					}
					else {
						var editcount = [lang.user.info.editcount, ( username.includes( '/' ) && range != 24 && range != 16 ? '~' : '' ) + ucbody.query.usercontribs.length + ( ucbody.continue ? '+' : '' )];
						
						var text = '<https://' + wiki + '.fandom.com/wiki/Special:Contributions/' + username.toTitle() + '>\n\n' + editcount.join(' ');
						if ( blocks.length ) blocks.forEach( block => text += '\n\n**' + block[0] + '**\n' + block[1].toPlaintext() );
						
						msg.channel.sendMsg( text );
					}
					
					if ( reaction ) reaction.removeEmoji();
				} );
			}
		} );
	} else {
		request( {
			uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&list=users&usprop=blockinfo|groups|editcount|registration|gender&ususers=' + encodeURIComponent( username ),
			json: true
		}, function( error, response, body ) {
			if ( error || !response || response.statusCode != 200 || !body || !body.query || !body.query.users[0] ) {
				if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + wiki + '.fandom.com' ) {
					console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
					msg.reactEmoji('nowiki');
				}
				else {
					console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
					msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/' + namespace + username.toTitle() + linksuffix + '>' );
				}
			}
			else {
				if ( body.query.users[0].missing == "" || body.query.users[0].invalid == "" ) {
					msg.reactEmoji('🤷');
				}
				else {
					username = body.query.users[0].name;
					var gender = [lang.user.info.gender];
					switch (body.query.users[0].gender) {
						case 'male':
							gender.push(lang.user.gender.male);
							break;
						case 'female':
							gender.push(lang.user.gender.female);
							break;
						default: 
							gender.push(lang.user.gender.unknown);
					}
					var registration = [lang.user.info.registration, (new Date(body.query.users[0].registration)).toLocaleString(lang.user.dateformat, timeoptions)];
					var editcount = [lang.user.info.editcount, body.query.users[0].editcount];
					var groups = body.query.users[0].groups;
					var group = [lang.user.info.group];
					for ( var i = 0; i < lang.user.groups.length; i++ ) {
						if ( groups.includes( lang.user.groups[i][0] ) ) {
							group.push(lang.user.groups[i][1]);
							break;
						}
					}
					var isBlocked = false;
					var blockedtimestamp = (new Date(body.query.users[0].blockedtimestamp)).toLocaleString(lang.user.dateformat, timeoptions);
					var blockexpiry = body.query.users[0].blockexpiry;
					if ( blockexpiry == 'infinity' ) {
						blockexpiry = lang.user.block.until_infinity;
						isBlocked = true;
					} else if ( blockexpiry ) {
						var blockexpirydate = blockexpiry.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2,3})/, '$1-$2-$3T$4:$5:$6Z');
						blockexpiry = (new Date(blockexpirydate)).toLocaleString(lang.user.dateformat, timeoptions);
						if ( Date.parse(blockexpirydate) > Date.now() ) isBlocked = true;
					}
					var blockedby = '[[User:' + body.query.users[0].blockedby + '|' + body.query.users[0].blockedby + ']]';
					var blockreason = body.query.users[0].blockreason;
					var block = [lang.user.block.header.replace( '%s', username ), lang.user.block.text.replace( '%1$s', blockedtimestamp ).replace( '%2$s', blockexpiry ).replace( '%3$s', blockedby ).replace( '%4$s', blockreason )];
					
					msg.channel.sendMsg( '<https://' + wiki + '.fandom.com/wiki/' + namespace + username.toTitle() + linksuffix + '>\n\n' + gender.join(' ') + '\n' + registration.join(' ') + '\n' + editcount.join(' ') + '\n' + group.join(' ') + ( isBlocked ? '\n\n**' + block[0] + '**\n' + block[1].toPlaintext() : '' ) );
				}
			}
			
			if ( reaction ) reaction.removeEmoji();
		} );
	}
}

function cmd_diff(lang, msg, args, wiki) {
	if ( args[0] ) {
		var error = false;
		var title = '';
		var revision = 0;
		var diff = 'prev';
		if ( /^\d+$/.test(args[0]) ) {
			revision = args[0];
			if ( args[1] ) {
				if ( /^\d+$/.test(args[1]) ) {
					diff = args[1];
				}
				else if ( args[1] == 'prev' || args[1] == 'next' ) {
					diff = args[1];
				}
				else error = true;
			}
		}
		else if ( args[0] == 'prev' || args[0] == 'next' ) {
			diff = args[0];
			if ( args[1] ) {
				if ( /^\d+$/.test(args[1]) ) {
					revision = args[1];
				}
				else error = true;
			}
			else error = true;
		}
		else title = args.join('_').replace( /\?/g, '%3F' );
		
		if ( error ) msg.reactEmoji('error');
		else if ( /^\d+$/.test(diff) ) {
			var argids = [];
			if ( parseInt(revision, 10) > parseInt(diff, 10) ) argids = [revision, diff];
			else if ( parseInt(revision, 10) == parseInt(diff, 10) ) argids = [revision];
			else argids = [diff, revision];
			msg.reactEmoji('⏳').then( function( reaction ) {
				cmd_diffsend(lang, msg, argids, wiki, reaction);
			} );
		}
		else {
			msg.reactEmoji('⏳').then( function( reaction ) {
				request( {
					uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&prop=revisions&rvprop=' + ( title ? '&titles=' + title : '&revids=' + revision ) + '&rvdiffto=' + diff,
					json: true
				}, function( error, response, body ) {
					if ( error || !response || response.statusCode != 200 || !body || !body.query ) {
						if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + wiki + '.fandom.com' ) {
							console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
							msg.reactEmoji('nowiki');
						}
						else {
							console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
							msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/' + title + '?diff=' + diff + ( title ? '' : '&oldid=' + revision ) + '>' );
						}
						
						if ( reaction ) reaction.removeEmoji();
					}
					else {
						if ( body.query.badrevids ) {
							msg.replyMsg( lang.diff.badrev );
							
							if ( reaction ) reaction.removeEmoji();
						} else if ( body.query.pages && !body.query.pages[-1] ) {
							var argids = [];
							var ids = Object.values(body.query.pages)[0].revisions[0].diff;
							if ( ids.from ) {
								if ( ids.from > ids.to ) argids = [ids.from, ids.to];
								else if ( ids.from == ids.to ) argids = [ids.to];
								else argids = [ids.to, ids.from];
							}
							else argids = [ids.to];
							cmd_diffsend(lang, msg, argids, wiki);
						} else {
							msg.reactEmoji('error');
							
							if ( reaction ) reaction.removeEmoji();
						}
					}
				} );
			} );
		}
	}
	else msg.reactEmoji('error');
}

function cmd_diffsend(lang, msg, args, wiki, reaction) {
	request( {
		uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&list=tags&tglimit=500&tgprop=displayname&prop=revisions&rvprop=ids|timestamp|flags|user|size|comment|tags&revids=' + args.join('|'),
		json: true
	}, function( error, response, body ) {
		if ( error || !response || response.statusCode != 200 || !body || !body.query ) {
			if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + wiki + '.fandom.com' ) {
				console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
				msg.reactEmoji('nowiki');
			}
			else {
				console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
				msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/?diff=' + args[0] + ( args[1] ? '&oldid=' + args[1] : '' ) + '>' );
			}
		}
		else {
			if ( body.query.badrevids ) msg.replyMsg( lang.diff.badrev );
			else if ( body.query.pages && !body.query.pages['-1'] ) {
				var pages = Object.values(body.query.pages);
				if ( pages.length != 1 ) msg.channel.sendMsg( '<https://' + wiki + '.fandom.com/wiki/?diff=' + args[0] + ( args[1] ? '&oldid=' + args[1] : '' ) + '>' );
				else {
					var title = pages[0].title;
					var revisions = [];
					if ( pages[0].revisions[1] ) revisions = [pages[0].revisions[1], pages[0].revisions[0]];
					else revisions = [pages[0].revisions[0]];
					var diff = revisions[0].revid;
					var oldid = ( revisions[1] ? revisions[1].revid : 0 );
					var editor = [lang.diff.info.editor, ( revisions[0].userhidden != undefined ? lang.diff.hidden : revisions[0].user )];
					var timestamp = [lang.diff.info.timestamp, (new Date(revisions[0].timestamp)).toLocaleString(lang.user.dateformat, timeoptions)];
					var difference = revisions[0].size - ( revisions[1] ? revisions[1].size : 0 );
					var size = [lang.diff.info.size, lang.diff.info.bytes.replace( '%s', ( difference > 0 ? '+' : '' ) + difference )];
					var comment = [lang.diff.info.comment, ( revisions[0].commenthidden != undefined ? lang.diff.hidden : ( revisions[0].comment ? revisions[0].comment : lang.diff.nocomment ) )];
					if ( revisions[0].tags.length ) {
						var tags = [lang.diff.info.tags, body.query.tags.filter( tag => revisions[0].tags.includes( tag.name ) ).map( tag => tag.displayname ).join(', ')];
						var tagregex = /<a [^>]*title="([^"]+)"[^>]*>(.+)<\/a>/g;
					}
					
					var pagelink = 'https://' + wiki + '.fandom.com/wiki/' + title.toTitle() + '?diff=' + diff + '&oldid=' + oldid;
					comment[1] = comment[1].toPlaintext();
					var text = '<' + pagelink + '>\n\n' + editor.join(' ') + '\n' + timestamp.join(' ') + '\n' + size.join(' ') + '\n' + comment.join(' ') + ( tags ? '\n' + tags.join(' ').replace( tagregex, '$2' ) : '' );
					
					msg.channel.sendMsg( text );
				}
			}
			else msg.reactEmoji('error');
		}
		
		if ( reaction ) reaction.removeEmoji();
	} );
}

function cmd_random(lang, msg, wiki) {
	msg.reactEmoji('⏳').then( function( reaction ) {
		request( {
			uri: 'https://' + wiki + '.fandom.com/api.php?action=query&format=json&generator=random&grnnamespace=0',
			json: true
		}, function( error, response, body ) {
			if ( error || !response || response.statusCode != 200 || !body || !body.query || !body.query.pages ) {
				if ( response && response.request && response.request.uri && response.request.uri.href == 'http://community.wikia.com/wiki/Community_Central:Not_a_valid_community?from=' + wiki + '.fandom.com' ) {
					console.log( '- Dieses Wiki existiert nicht! ' + ( error ? error.message : ( body ? ( body.error ? body.error.info : '' ) : '' ) ) );
					msg.reactEmoji('nowiki');
				}
				else {
					console.log( '- Fehler beim Erhalten der Suchergebnisse' + ( error ? ': ' + error : ( body ? ( body.error ? ': ' + body.error.info : '.' ) : '.' ) ) );
					msg.channel.sendErrorMsg( '<https://' + wiki + '.fandom.com/wiki/Special:Random>' );
				}
			}
			else msg.channel.sendMsg( '🎲 ' + 'https://' + wiki + '.fandom.com/wiki/' + Object.values(body.query.pages)[0].title.toTitle() );
			
			if ( reaction ) reaction.removeEmoji();
		} );
	} );
}

function cmd_multiline(lang, msg, args, line) {
	if ( msg.channel.type != 'text' || !pause[msg.guild.id] ) {
		if ( msg.isAdmin() ) msg.reactEmoji('error');
		else msg.reactEmoji('❌');
	}
}

function cmd_voice(lang, msg, args, line) {
	if ( msg.isAdmin() && !args.length ) msg.replyMsg( lang.voice.text + '\n`' + lang.voice.channel + ' – <' + lang.voice.name + '>`' );
	else cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
}

function cmd_get(lang, msg, args, line) {
	var id = args.join().replace( /^\\?<(?:@!?|#)(\d+)>$/, '$1' );
	if ( /^\d+$/.test(id) ) {
		if ( client.guilds.has(id) ) {
			var guild = client.guilds.get(id);
			var guildname = ['Guild:', guild.name + ' `' + guild.id + '`'];
			var guildowner = ['Owner:', guild.owner.user.tag + ' `' + guild.ownerID + '` ' + guild.owner.toString()];
			var guildpermissions = ['Missing permissions:', ( guild.me.permissions.has(defaultPermissions) ? '*none*' : '`' + guild.me.permissions.missing(defaultPermissions).join('`, `') + '`' )];
			var guildsettings = ['Settings:', ( guild.id in settings ? '```json\n' + JSON.stringify( settings[guild.id], null, '\t' ) + '\n```' : '*default*' )];
			if ( msg.showEmbed() ) {
				var text = '';
				var embed = new Discord.RichEmbed().addField( guildname[0], guildname[1] ).addField( guildowner[0], guildowner[1] ).addField( guildpermissions[0], guildpermissions[1] ).addField( guildsettings[0], guildsettings[1] );
			}
			else {
				var embed = {};
				var text = guildname.join(' ') + '\n' + guildowner.join(' ') + '\n' + guildpermissions.join(' ') + '\n' + guildsettings.join(' ');
			}
			msg.channel.sendMsg( text, embed );
		} else if ( client.guilds.some( guild => guild.members.has(id) ) ) {
			var username = [];
			var guildlist = ['Guilds:'];
			var guilds = client.guilds.filter( guild => guild.members.has(id) )
			guildlist.push('\n' + guilds.map( function(guild) {
				var member = guild.members.get(id);
				if ( !username.length ) username.push('User:', member.user.tag + ' `' + member.id + '` ' + member.toString());
				return guild.name + ' `' + guild.id + '`' + ( member.permissions.has('MANAGE_GUILD') ? '\\*' : '' );
			} ).join('\n'));
			if ( guildlist[1].length > 1000 ) guildlist[1] = guilds.size;
			if ( msg.showEmbed() ) {
				var text = '';
				var embed = new Discord.RichEmbed().addField( username[0], username[1] ).addField( guildlist[0], guildlist[1] );
			}
			else {
				var embed = {};
				var text = username.join(' ') + '\n' + guildlist.join(' ');
			}
			msg.channel.sendMsg( text, embed );
		} else if ( client.guilds.some( guild => guild.channels.filter( chat => chat.type == 'text' ).has(id) ) ) {
			var channel = client.guilds.find( guild => guild.channels.filter( chat => chat.type == 'text' ).has(id) ).channels.get(id);
			var channelguild = ['Guild:', channel.guild.name + ' `' + channel.guild.id + '`'];
			var channelname = ['Channel:', '#' + channel.name + ' `' + channel.id + '` ' + channel.toString()];
			var channelpermissions = ['Missing permissions:', ( channel.memberPermissions(channel.guild.me).has(defaultPermissions) ? '*none*' : '`' + channel.memberPermissions(channel.guild.me).missing(defaultPermissions).join('`, `') + '`' )];
			var channelwiki = ['Default Wiki:', 'https://' + ( channel.guild.id in settings ? ( settings[channel.guild.id].channels && channel.id in settings[channel.guild.id].channels ? settings[channel.guild.id].channels[channel.id][0] : settings[channel.guild.id].wiki[0] ) : settings['default'].wiki[0] ) + '.fandom.com/'];
			if ( msg.showEmbed() ) {
				var text = '';
				var embed = new Discord.RichEmbed().addField( channelguild[0], channelguild[1] ).addField( channelname[0], channelname[1] ).addField( channelpermissions[0], channelpermissions[1] ).addField( channelwiki[0], channelwiki[1] );
			}
			else {
				var embed = {};
				var text = channelguild.join(' ') + '\n' + channelname.join(' ') + '\n' + channelpermissions.join(' ') + '\n' + channelwiki[0] + ' <' + channelwiki[1] + '>';
			}
			msg.channel.sendMsg( text, embed );
		} else msg.replyMsg( 'I couldn\'t find a result for `' + id + '`' );
	} else if ( msg.channel.type != 'text' || !pause[msg.guild.id] ) cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
}

String.prototype.isMention = function(guild) {
	var text = this.trim();
	if ( text == '@' + client.user.username || text.replace( /^<@!?(\d+)>$/, '$1' ) == client.user.id || ( guild && text == '@' + guild.me.displayName ) ) return true;
	else return false;
}

Discord.Message.prototype.isAdmin = function() {
	if ( this.channel.type == 'text' && this.member && this.member.permissions.has('MANAGE_GUILD') ) return true;
	else return false;
}

Discord.Message.prototype.isOwner = function() {
	if ( this.author.id == process.env.owner ) return true;
	else return false;
}

Discord.Message.prototype.showEmbed = function() {
	if ( this.channel.type != 'text' || this.channel.permissionsFor(client.user).has('EMBED_LINKS') ) return true;
	else return false;
}

Array.prototype.toEmojis = function() {
	var text = this.join(' ');
	var regex = /(<a?:)(\d+)(>)/g;
	if ( regex.test(text) ) {
		regex.lastIndex = 0;
		var emojis = client.emojis;
		var entry;
		while ( ( entry = regex.exec(text) ) !== null ) {
			if ( emojis.has(entry[2]) ) {
				text = text.replace(entry[0], emojis.get(entry[2]).toString());
			} else {
				text = text.replace(entry[0], entry[1] + 'unknown_emoji:' + entry[2] + entry[3]);
			}
		}
		return text.split(' ');
	}
	else return this;
}

String.prototype.toTitle = function(isMarkdown = false) {
	var title = this.replace( / /g, '_' ).replace( /\%/g, '%25' ).replace( /\?/g, '%3F' );
	if ( isMarkdown ) title = title.replace( /(\(|\))/g, '\\$1' );
	return title;
};

String.prototype.toSection = function() {
	return encodeURIComponent( this.replace( / /g, '_' ) ).replace( /\'/g, '%27' ).replace( /\(/g, '%28' ).replace( /\)/g, '%29' ).replace( /\%/g, '.' );
};

String.prototype.toMarkdown = function(wiki, title = '') {
	var text = this;
	while ( ( link = /\[\[(?:([^\|\]]+)\|)?([^\]]+)\]\]([a-z]*)/g.exec(text) ) !== null ) {
		if ( link[1] ) {
			var page = ( /^(#|\/)/.test(link[1]) ? title.toTitle(true) + ( /^#/.test(link[1]) ? '#' + link[1].substr(1).toSection() : link[1].toTitle(true) ) : link[1].toTitle(true) );
			text = text.replace( link[0], '[' + link[2] + link[3] + '](https://' + wiki + '.fandom.com/wiki/' + page + ')' );
		} else {
			var page = ( /^(#|\/)/.test(link[2]) ? title.toTitle(true) + ( /^#/.test(link[2]) ? '#' + link[2].substr(1).toSection() : link[2].toTitle(true) ) : link[2].toTitle(true) );
			text = text.replace( link[0], '[' + link[2] + link[3] + '](https://' + wiki + '.fandom.com/wiki/' + page + ')' );
		}
	}
	while ( title != '' && ( link = /\/\*\s*([^\*]+?)\s*\*\/\s*(.)?/g.exec(text) ) !== null ) {
		var page = title.toTitle(true) + '#' + link[1].toSection();
		text = text.replace( link[0], '[→](https://' + wiki + '.fandom.com/wiki/' + page + ')' + link[1] + ( link[2] ? ': ' + link[2] : '' ) );
	}
	return text.replace( /(`|_|\*|~|<|>)/g, '\\$1' );
};

String.prototype.toPlaintext = function() {
	return this.replace( /\[\[(?:[^\|\]]+\|)?([^\]]+)\]\]/g, '$1' ).replace( /\/\*\s*([^\*]+?)\s*\*\//g, '→$1:' ).replace( /(`|_|\*|~|<|>)/g, '\\$1' );
};

Discord.Message.prototype.reactEmoji = function(name) {
	var emoji = '440871715938238494';
	switch ( name ) {
		case 'nowiki':
			emoji = '505884572001763348';
			break;
		case 'error':
			emoji = '440871715938238494';
			break;
		case 'support':
			emoji = '448222377009086465';
			break;
		case 'oppose':
			emoji = '448222455425794059';
			break;
		default:
			emoji = name;
	}
	return this.react(emoji).catch(log_error);
};

Discord.MessageReaction.prototype.removeEmoji = function() {
	return this.remove().catch(log_error);
};

Discord.Channel.prototype.sendMsg = function(content, options) {
	return this.send(content, options).catch(log_error);
};

Discord.User.prototype.sendMsg = function(content, options) {
	return this.send(content, options).catch(log_error);
};

Discord.Channel.prototype.sendErrorMsg = function(content, options) {
	return this.send(content, options).then( message => message.reactEmoji('error'), log_error );
};

Discord.Message.prototype.replyMsg = function(content, options) {
	return this.reply(content, options).catch(log_error);
};

Discord.Message.prototype.deleteMsg = function(timeout = 0) {
	return this.delete(timeout).catch(log_error);
};

String.prototype.hasPrefix = function(flags = '') {
	if ( RegExp( '^' + process.env.prefix + '(?: |$)', flags).test(this.toLowerCase()) ) return true;
	else return false;
}

client.on( 'message', msg => {
	if ( stop ) return;
	
	var cont = msg.content;
	var author = msg.author;
	var channel = msg.channel;
	if ( channel.type == 'text' ) var permissions = channel.permissionsFor(client.user);
	
	if ( cont.hasPrefix('m') && !msg.webhookID && author.id != client.user.id ) {
		if ( !ready.settings && settings == defaultSettings ) getSettings(setStatus);
		var setting = Object.assign({}, settings['default']);
		if ( settings == defaultSettings ) {
			msg.channel.sendMsg( '⚠ **Limited Functionality** ⚠\nNo settings found, please contact the bot owner!\n' + process.env.invite );
		} else if ( channel.type == 'text' && msg.guild.id in settings ) setting = Object.assign({}, settings[msg.guild.id]);
		var lang = Object.assign({}, i18n[setting.lang]);
		lang.link = setting.wiki[0];
		if ( setting.channels && channel.id in setting.channels ) lang.link = setting.channels[channel.id];
		if ( channel.type != 'text' || permissions.has(['SEND_MESSAGES','ADD_REACTIONS','USE_EXTERNAL_EMOJIS']) ) {
			var invoke = cont.split(' ')[1] ? cont.split(' ')[1].split('\n')[0].toLowerCase() : '';
			var aliasInvoke = ( invoke in lang.aliase ) ? lang.aliase[invoke] : invoke;
			var ownercmd = msg.isOwner() && aliasInvoke in ownercmdmap;
			if ( cont.hasPrefix() && ( ( msg.isAdmin() && aliasInvoke in multilinecmdmap ) || ownercmd ) ) {
				if ( ownercmd || permissions.has('MANAGE_MESSAGES') ) {
					var args = cont.split(' ').slice(2);
					if ( cont.split(' ')[1].split('\n')[1] ) args.unshift( '', cont.split(' ')[1].split('\n')[1] );
					if ( !( ownercmd || aliasInvoke in pausecmdmap ) && pause[msg.guild.id] ) console.log( msg.guild.name + ': Pausiert' );
					else console.log( ( msg.guild ? msg.guild.name : '@' + author.username ) + ': ' + cont );
					if ( ownercmd ) ownercmdmap[aliasInvoke](lang, msg, args, cont);
					else if ( !pause[msg.guild.id] || aliasInvoke in pausecmdmap ) multilinecmdmap[aliasInvoke](lang, msg, args, cont);
				} else {
					console.log( msg.guild.name + ': Fehlende Berechtigungen - MANAGE_MESSAGES' );
					msg.replyMsg( lang.missingperm + ' `MANAGE_MESSAGES`' );
				}
			} else {
				var count = 0;
				msg.cleanContent.replace(/\u200b/g, '').split('\n').forEach( function(line) {
					if ( line.hasPrefix() && count < 10 ) {
						count++;
						invoke = line.split(' ')[1] ? line.split(' ')[1].toLowerCase() : '';
						var args = line.split(' ').slice(2);
						aliasInvoke = ( invoke in lang.aliase ) ? lang.aliase[invoke] : invoke;
						ownercmd = msg.isOwner() && aliasInvoke in ownercmdmap;
						if ( channel.type == 'text' && pause[msg.guild.id] && !( ( msg.isAdmin() && aliasInvoke in pausecmdmap ) || ownercmd ) ) console.log( msg.guild.name + ': Pausiert' );
						else console.log( ( msg.guild ? msg.guild.name : '@' + author.username ) + ': ' + line );
						if ( ownercmd ) ownercmdmap[aliasInvoke](lang, msg, args, line);
						else if ( channel.type != 'text' || !pause[msg.guild.id] || ( msg.isAdmin() && aliasInvoke in pausecmdmap ) ) {
							if ( aliasInvoke in cmdmap ) cmdmap[aliasInvoke](lang, msg, args, line);
							else if ( /^![a-z\d-]{1,30}$/.test(invoke) ) cmd_link(lang, msg, args.join(' '), invoke.substr(1), ' ' + invoke + ' ');
							else cmd_link(lang, msg, line.split(' ').slice(1).join(' '));
						}
					} else if ( line.hasPrefix() && count == 10 ) {
						count++;
						console.log( '- Nachricht enthält zu viele Befehle!' );
						msg.reactEmoji('⚠');
						channel.sendErrorMsg( lang.limit.replace( '%s', author.toString() ), {} );
					}
				} );
			}
		} else if ( msg.isAdmin() ) {
			console.log( msg.guild.name + ': Fehlende Berechtigungen - ' + permissions.missing(['SEND_MESSAGES','ADD_REACTIONS','USE_EXTERNAL_EMOJIS']) );
			if ( permissions.has(['SEND_MESSAGES']) ) msg.replyMsg( lang.missingperm + ' `' + permissions.missing(['ADD_REACTIONS','USE_EXTERNAL_EMOJIS']).join('`, `') + '`' );
		}
	}
} );


client.on( 'voiceStateUpdate', (oldm, newm) => {
	if ( stop ) return;
	
	if ( !ready.settings && settings == defaultSettings ) getSettings(setStatus);
	if ( oldm.guild.me.permissions.has('MANAGE_ROLES') && oldm.voiceChannelID != newm.voiceChannelID ) {
		var setting = Object.assign({}, settings['default']);
		if ( oldm.guild.id in settings ) setting = Object.assign({}, settings[oldm.guild.id]);
		var lang = i18n[setting.lang];
		if ( oldm.voiceChannel ) {
			var oldrole = oldm.roles.find( role => role.name == lang.voice.channel + ' – ' + oldm.voiceChannel.name );
			if ( oldrole && oldrole.comparePositionTo(oldm.guild.me.highestRole) < 0 ) {
				console.log( oldm.guild.name + ': ' + oldm.displayName + ' hat den Sprachkanal "' + oldm.voiceChannel.name + '" verlassen.' );
				oldm.removeRole( oldrole, lang.voice.left.replace( '%1$s', oldm.displayName ).replace( '%2$s', oldm.voiceChannel.name ) ).catch(log_error);
			}
		}
		if ( newm.voiceChannel ) {
			var newrole = newm.guild.roles.find( role => role.name == lang.voice.channel + ' – ' + newm.voiceChannel.name );
			if ( newrole && newrole.comparePositionTo(newm.guild.me.highestRole) < 0 ) {
				console.log( newm.guild.name + ': ' + newm.displayName + ' hat den Sprachkanal "' + newm.voiceChannel.name + '" betreten.' );
				newm.addRole( newrole, lang.voice.join.replace( '%1$s', newm.displayName ).replace( '%2$s', newm.voiceChannel.name ) ).catch(log_error);
			}
		}
	}
} );


client.on( 'guildCreate', guild => {
	console.log( '- Ich wurde zu einem Server hinzugefügt.' );
	client.fetchUser(process.env.owner).then( owner => owner.sendMsg( 'Ich wurde zu einem Server hinzugefügt:\n"' + guild.toString() + '" von ' + guild.owner.toString() + ' mit ' + guild.memberCount + ' Mitgliedern.\n(' + guild.id + ')' ), log_error );
} );

client.on( 'guildDelete', guild => {
	console.log( '- Ich wurde von einem Server entfernt.' );
	client.fetchUser(process.env.owner).then( owner => owner.sendMsg( 'Ich wurde von einem Server entfernt:\n"' + guild.toString() + '" von ' + guild.owner.toString() + ' mit ' + guild.memberCount + ' Mitgliedern.\n(' + guild.id + ')' ), log_error );
	
	if ( !guild.available ) {
		console.log( '- Dieser Server ist nicht erreichbar.' );
	}
	else if ( settings == defaultSettings ) {
		console.log( '- Fehler beim Erhalten bestehender Einstellungen.' );
	}
	else {
		var temp_settings = Object.assign({}, settings);
		Object.keys(temp_settings).forEach( function(guild) {
			if ( !client.guilds.has(guild) && guild != 'default' ) delete temp_settings[guild];
		} );
		request.post( {
			uri: process.env.save,
			headers: access,
			body: {
				branch: 'master',
				commit_message: 'Wiki-Bot: Einstellungen entfernt.',
				actions: [
					{
						action: 'update',
						file_path: process.env.file,
						content: JSON.stringify( temp_settings, null, '\t' )
					}
				]
			},
			json: true
		}, function( error, response, body ) {
			if ( error || !response || response.statusCode != 201 || !body || body.error ) {
				console.log( '- Fehler beim Bearbeiten' + ( error ? ': ' + error : ( body ? ( body.message ? ': ' + body.message : ( body.error ? ': ' + body.error : '.' ) ) : '.' ) ) );
			}
			else {
				settings = Object.assign({}, temp_settings);
				console.log( '- Einstellungen erfolgreich aktualisiert.' );
			}
		} );
	}
} );


client.login(process.env.token).catch( error => log_error(error, true, 'LOGIN-') );


client.on( 'error', error => log_error(error, true) );
client.on( 'warn', console.warn );


async function log_error(error, isBig = false, type = '') {
	var time = new Date(Date.now()).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' });
	if ( isDebug ) {
		console.log( '--- ' + type + 'ERROR START ' + time + ' ---' );
		console.error(error);
		console.log( '--- ' + type + 'ERROR END ' + time + ' ---' );
	} else {
		if ( isBig ) console.log( '--- ' + type + 'ERROR: ' + time + ' ---' );
		console.log( '- ' + error.name + ': ' + error.message );
	}
}

async function graceful(code = 1) {
	stop = true;
	console.log( '- SIGTERM: Beenden wird vorbereitet...' );
	setTimeout( async () => {
		console.log( '- SIGTERM: Client wird zerstört...' );
		await client.destroy();
		setTimeout( async () => {
			console.log( '- SIGTERM: Beenden dauert zu lange, terminieren!' );
			process.exit(code);
		}, 1000 ).unref();
	}, 10000 ).unref();
}

process.once( 'SIGINT', graceful );
process.once( 'SIGTERM', graceful );