/*jslint node: true, sub:true */
"use strict";

var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var path = require('path');
var routerUser = require('./server/routerUser');

var app = express();
app.set('port', process.env.PORT || 8080);
app.use(bodyParser.json());
app.use(routerUser.tokenUser);
app.use(express.static(path.join(__dirname, 'public')));

routerUser.route(app);
require('./server/router')(app);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
