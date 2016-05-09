/*jslint node: true, sub:true */
"use strict";

var path = require('path');
var util = require('util');
var crypto = require('crypto');
var moment = require('moment');
var async = require('async');
var assert = require('assert');
var redis = require('redis');
var client = redis.createClient();

var moduleName = path.basename(module.filename,".js");
function logFactory(level){
  var moduleAndLevel = " "+moduleName + "[" + level + "]:";
  return function(str){
    if(typeof str == "object") str = util.inspect(str);
    console.log((new Date()) + moduleAndLevel + str);
  };
}
var log = {
    fatal: logFactory("FATAL"),
    error: logFactory("ERROR"),
    warn: logFactory("WARN"),
    info: logFactory("INFO"),
    debug: logFactory("DEBUG"),
};

client.on("error", function(err){ log.error(err); });

var errorsList = {
  'user-invalid-token':             {code:400,codeTxt:'user-invalid-token',             msg:'the token is invalid'},
  'user-invalid-verification-token':{code:400,codeTxt:'user-invalid-verification-token',msg:'the verification token is invalid'},
  'user-invalid-reset-token':       {code:400,codeTxt:'user-invalid-reset-token',       msg:'the reset token is invalid'},
  'user-email-not-found':           {code:400,codeTxt:'user-email-not-found',           msg:'cannot found a user with this email'},
  'user-email-taken':               {code:400,codeTxt:'user-email-taken',               msg:'email already taken'},
  'user-email-incorrect':           {code:400,codeTxt:'user-email-incorrect',           msg:'the format of the email is incorrect'},
  'user-invalid-password':          {code:400,codeTxt:'user-invalid-password',          msg:'the password is incorrect'},
  'user-db-empty':                  {code:400,codeTxt:'user-db-empty',                  msg:'the database is empty'},
  'user-not-found':                 {code:400,codeTxt:'user-not-found',                 msg:'cannot found the user'},
  'user-already-verified':          {code:400,codeTxt:'user-already-verified',          msg:'the user has already been verified'},
  'user-invalid-id':                {code:400,codeTxt:'user-invalid-id',                msg:'the id is not valid'},
  'user-cannot-generate-token':     {code:500,codeTxt:'user-cannot-generate-token',     msg:'the server is unable to generate a new token'},
  'user-db-error':                  {code:500,codeTxt:'user-db-error',                  msg:'the server is unable to communicate with the database'},
};

exports.getToken = function(email, pass, cb){
  assert(email); assert(pass); assert(typeof cb == 'function');
  email = email.toLowerCase();

  function generateNewToken(nbTry,cb){
    if(!nbTry) return cb(errorsList['user-cannot-generate-token']);
    var token = generateSalt();
    client.setnx("token:" + token, email, function(err,res){
      if(err) return cb(errorsList['db-error']);
      if(res === 0) return generateNewToken(nbTry-1,cb);
      client.expire("token:" + token, 24*60*60, function(err){
        if(err) return cb(errorsList['db-error']);
        return cb(null, token);
      });
    });
  }

  client.get("password:"+email, function(err, hashedPass){
    if(err) return cb(errorsList['db-error']);
    if(!hashedPass) return cb(errorsList['user-email-not-found']);
    if(!isCorrectPassword(pass, hashedPass))
      return cb(errorsList['user-invalid-password']);
    generateNewToken(25, function(err,token){
      if(err) return cb(err);
      client.hgetall("user:"+email, function(err, user){
        if(err) return cb(errorsList['db-error']);
        if(!user) return cb(errorsList["user-not-found"]);
        user.token = token;
        return cb(null, user);
      });
    });
  });
};

exports.destroyToken = function(token, cb){
  assert(token); assert(typeof cb == 'function');
  client.del("token:"+token, function(err){
    if(err) return cb(errorsList['db-error']);
    return cb(null, true);
  });
};

exports.getUserFromToken = function(token, cb){
  assert(token); assert(typeof cb == 'function');
  client.get("token:"+token, function(err, email) {
    if(err) return cb(errorsList['db-error']);
    if(!email) return cb(errorsList["user-invalid-token"]);
    return exports.getUserFromEmail(email, cb);
  });
};

exports.getUserFromEmail = function(email, cb){
  assert(email); assert(typeof cb == 'function');
  client.hgetall("user:"+email, function(err, user) {
    if(err) return cb(errorsList['db-error']);
    if(!user) return cb(errorsList["user-not-found"]);
    return cb(null, user);
  });
};

function checkEmail(email) {
  var regex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  return regex.test(email);
}

exports.addNewAccount = function(newData, opt, cb){
  if(!cb){
    cb = opt;
    opt = {};
  }
  assert(newData); assert(newData.email); assert(typeof cb == 'function');
  var email = newData.email = newData.email.toLowerCase();
  if(!checkEmail(email)) return cb(errorsList['user-email-incorrect']);
  assert(newData.pass);
  var pass = saltAndHash(newData.pass);
  delete newData.pass;

  client.setnx("password:"+email, pass, function(err, isNew) {
    if(err) return cb(errorsList['db-error']);
    if(!isNew) return cb(errorsList['user-email-taken']);
    client.hmset("user:"+email, newData, function(err){
      if(err) return cb(errorsList['db-error']);
      return cb();
    });
  });
};

exports.updatePassword = function(email, newPass, cb){
  assert(email); assert(newPass); assert(typeof cb == 'function');
  client.set("password:"+email,saltAndHash(newPass),function(err){
    if(err) return cb(errorsList['db-error']);
    return cb();
  });
};

exports.deleteAccount = function(email, cb){
  assert(email); assert(typeof cb == 'function');
  client.del("user:"+email,"password:"+email,function(err){
    if(err) return cb(errorsList['db-error']);
    return cb();
  });
};

/* private encryption & validation methods */

var generateSalt = function(){
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  var salt = '';
  for (var i = 0; i < 10; i++) {
    var p = Math.floor(Math.random() * set.length);
    salt += set[p];
  }
  return salt;
};

var md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

var saltAndHash = function(pass){
  var salt = generateSalt();
  return salt + md5(pass + salt);
};

var isCorrectPassword = function(plainPass, hashedPass){
  var salt = hashedPass.substr(0, 10);
  var validHash = salt + md5(plainPass + salt);
  return (hashedPass == validHash);
};
