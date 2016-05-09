/*jslint node: true, sub:true */
"use strict";

module.exports = function(app){
  app.get('*', function(req, res){ res.status(404).send({ title: 'Page Not Found'}); });
};
