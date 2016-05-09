/*jslint node: true, sub:true */
"use strict";

var fs = require("fs");

var dfltLog = {
    error: console.log.bind(console),
    info: console.log.bind(console)
};

function genericCallback(log,res,err,data){
  log = log || dfltLog;
  if(!err && data !== undefined){
    if(typeof data == "number") return res.status(200).send(""+data); // No error and data returned
    return res.status(200).send(data); // No error and data returned
  }
  if(!err && !data) return res.status(200).send('ok'); // No error but no data returned
  // error management
  var code = 500;
  var body = data || "";
  if(typeof err == "number") code = err; // Error is a number => error code in err and explanation in data
  else if(typeof err == "string") body = err; // Error is a string => explanation in err
  else if(typeof err != "object") body = "unknow error"; // Error is not an object => unknow
  else if(err.message) body = err.message; // Error has a field message => explanation in err.message
  else{
    code = err.code || code;
    body = JSON.stringify(err);
  }
  log.error("generic cb fct send an error ("+code+"): " + body);
  return res.status(code).send(body);
}

function buildGenericCallback(log, res){
  return genericCallback.bind(null, log, res);
}

exports.buildGenericCallbackFactory = function(log){
  return buildGenericCallback.bind(null, log);
};

exports.noImpl = function(req, cb){
  return cb(500, 'Not implemented');
};

exports.copyFile = function(source, target, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = fs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
};
