'use strict';
var request = require('sync-request'); 
var fs=require('fs');
var express = require('express'); 
var app = express(); 

var st_d = "2018-07-11T00:00:00";
var end_d = "2018-07-31T00:00:00";

var site1 = {
	url: 'https://api.meetup.com/find/upcoming_events',
	method: 'GET',
	name: 'meetup',
	qs: {
		key: '7340545d7c7370a2878a13614f173c',
		text: 'cloud',
		start_date_range: st_d,
		end_date_range: end_d,
		radius: '3',
		lon: '-74.01',
		lat: '40.71',
		page: '1000'
	}
};

var site2 = {
	url: 'https://www.eventbriteapi.com/v3/events/search',
	method: 'GET',
	name: 'eventbrite',
	qs: {
		token: 'VHNV7ZKVKBUUYF24TWMM',
		q: 'cloud',
		'start_date.range_start': st_d,
		'start_date.range_end': end_d,
		'location.within': '3km',
		'location.longitude': '-74.01',
		'location.latitude': '40.71',
		page: 1
	}
};

function getJSON(data){
	var req = request(data.method, data.url, data);
	var result = JSON.parse(req.getBody('utf8'));
	console.log('Загружено' + result.events.length + 'событий:' + data.name);
	return result.events;
}

var json_site1 = getJSON(site1);
var json_site2 = getJSON(site2);

function delete_duplicate(meetup_json, eventbrite_json) {
	var count = 0;
	for (var i = 0; i < meetup_json.length; i++) {
		for (var j = 0; j < eventbrite_json.length; j++) {
			if ( meetup_json[i].name == eventbrite_json[j].name.text ) {
				eventbrite_json.splice(j, 1);
				count++;
			}
		}
	}
	console.log('Удалено дубликатов: ' + count);
}
delete_duplicate(json_site1, json_site2)

function aggregate(json_meetup, json_eventbrite) {
	var merged_array = [];

	for (var i = 0; i < json_site1.length; i++) {
		if (json_site1[i].local_date && json_site1[i].local_time) { 
			var item = {
				'name': json_site1[i].name,
				'date_time': json_site1[i].local_date + 'T' + json_site1[i].local_time + ':00',
				'description': json_site1[i].description,
				'link': json_site1[i].link
			}
			merged_array = merged_array.concat(item);
		} 
	}

	for (var i = 0; i < json_site2.length; i++) {
		if (json_site2[i].start.local) { 
			var item = {
				'name': json_site2[i].name.text,
				'date_time': json_site2[i].start.local,
				'description': json_site2[i].description.html,
				'link': json_site2[i].url
			}
			merged_array = merged_array.concat(item);
		} 
	}

	return merged_array;
}

var merged_array = aggregate(json_site1, json_site2);

merged_array.sort(function(event1, event2) {
	return Date.parse(event1.date_time) - Date.parse(event2.date_time);
});
 
function html() {
	for (var i=0; i < merged_array.length; i++) {
			merged_array[i].date = new Date(Date.parse(merged_array[i].date_time)).toLocaleString("en-US", {year: 'numeric', month: 'long', day: 'numeric'});
	}	
	var currentDate = merged_array[0].date;

 	fs.writeFileSync('out.html', 
 		'<!DOCTYPE html>' + 
		'<html lang="en">' + 
		'<head><meta charset="UTF-8"><title>Meetups</title>' +
		'<link rel="stylesheet" href="/public/css/main.css">' + 
		'</head>' + 
		'<body>' +
		'<div class="wrap"><h1>Events for you in New York, NY, USA</h1><h2 class="date">' + currentDate + '</h2>');

 	for (var i = 0; i < merged_array.length; i++) {
 		if (merged_array[i].date == currentDate) {
 			fs.appendFileSync('out.html',
 				'<h3 class="title"><a href=' + merged_array[i].link + ' target=blank>' + merged_array[i].name + '</a></h2><br>' + 
 				'<div class="date_time"><strong>Date: </strong> ' + merged_array[i].date + "<strong>Time: </strong>" + merged_array[i].date_time.substr(11) + '</div><br>' +
 				'<div class="desc"><strong>Description:</strong> ' + merged_array[i].description + '</div><br><br>'
 			)
 		} else { 
 			currentDate = merged_array[i].date;
 			fs.appendFileSync('out.html', '<h2 class="date">' + currentDate + '</h2>');
 		}
		
 	}

 	fs.appendFileSync('out.html', '</body></html>');
 	console.log('html файл создан. Добавлено событий: ' + merged_array.length);
 }

html();

app.use('/public', express.static('public'));

app.get('/', function(req, res) {
	res.sendFile(__dirname + "/out.html");
});

app.listen(3000); 
console.log('Локальный сервер запущен: http://127.0.0.1:3000/');