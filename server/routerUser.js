/*jslint node: true, sub:true */
"use strict";

var path = require('path');
var util = require('util');
var fs = require('fs');
var moment = require('moment');
var async = require('async');
var users = require('./modules/users.js');
var routerUtil = require('./util.js');

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

var errorsList = {
  'parameter-missing':              {code:400,codeTxt:'parameter-missing',              msg:'the request has a missing parameter'},
  'parameter-invalid':              {code:400,codeTxt:'parameter-invalid',              msg:'the request has an invalid parameter'},
  'need-admin':                     {code:403,codeTxt:'need-admin',                     msg:'the request require admin privilege'},
  'token-missing':                  {code:400,codeTxt:'token-missing',                  msg:'the token is missing'},
  'token-invalid':                  {code:401,codeTxt:'token-invalid',                  msg:'the token is invalid'},
  'server-error':                   {code:500,codeTxt:'server-error',                   msg:'the server has experienced an unknown error'},
};

var buildGenCb = routerUtil.buildGenericCallbackFactory(log);
var noImpl = routerUtil.noImpl;

/** /user/signup
name: name
email: email
pass: pass
return: 200,'ok'
*/
function userSignup(req, cb){
  var email = req.body['email'];
  log.info("user signup: " + email);
  var name  = req.body['name'];
  var pass  = req.body['pass'];
  if(!email || !name || !pass) return cb(errorsList['parameter-missing']);
  email = email.toLowerCase();
  var logindata = {
    email : email,
    pass : pass,
    name : name
  };
  users.addNewAccount(logindata, function(err,data){
    log.info("account signup "  + (err?"failed":"succeed") + ": " + email);
    cb(err,data);
  });
}

/** /user/login
email: email
pass: password
return: 200, {token,email,name,isAdmin}
*/
function userLogin(req, cb){
  var email = req.body['email'];
  log.info("user login: " + email);
  var pass = req.body['pass'];
  if(!email || !pass) return cb(errorsList['parameter-missing']);
  if(typeof email != "string" || typeof pass != "string") return cb(errorsList['parameter-invalid']);
  email = email.toLowerCase();

  users.getToken(email, pass, function(err, token){
    log.info("user login " + (err?"failed":"succeed") + ": " + email);
    cb(err, token);
  });
}

/** /user/read
token: token
email: user to get info about (admin)
return: 200, {email,name,isAdmin}
*/
function userInfo(req, cb){
  var email = req.body['email'] || req.user.email;
  log.info("user info: " + email + (email != req.user.email?"(from: "+req.user.email+")":""));
  if(email != req.user.email && !req.user.isAdmin) return cb(errorsList['need-admin']);
  users.getUserFromEmail(email , cb);
}

/** /user/logout
token: token
return: 200,'ok'
*/
function userLogout(req,cb){
  log.info("user logout: " + req.user.email);
  users.destroyToken(req.body['token'], cb);
}

/** /user/delete
token: token
email: user to delete (admin)
return: 200,'ok'
*/
function userDelete(req, cb){
  var email = req.body['email'] || req.user.email;
  log.info("user delete: " + email + (email != req.user.email?"(from: "+req.user.email+")":""));
  if(email != req.user.email && !req.user.isAdmin) return cb(errorsList['need-admin']);
  users.deleteAccount(email , cb);
}

/** /user/updatePassword
token: token
email: email
pass: pass
return: 200,'ok'
*/
function userUpdatePassword(req, cb){
  var email = req.body['email'] || req.user.email;
  var pass  = req.body['pass'];
  log.info("user change password: " + email + (email != req.user.email?"(from: "+req.user.email+")":""));
  if(email != req.user.email && !req.user.isAdmin) return cb(errorsList['need-admin']);
  if(!pass) return cb(errorsList['parameter-missing']);
  users.updatePassword(email, pass, cb);
}

/** helper: check if the token exist
*/
function checkToken(fct){
  return function(req, cb){
    if(!req.user) return cb(errorsList['token-missing']);
    return fct(req, cb);
  };
}

exports.tokenUser = function(req, res, next){
  var token = req.body['token'];
  if(!token) token = req.query['token'];
  if(!token) return next();
  users.getUserFromToken(token,function(err, user){
    if(err) return buildGenCb(res)(err);
    if(!user) return buildGenCb(res)(errorsList['token-invalid']);
    req.user = user;
    next();
  });
};

exports.route = function(app) {
  function addPost(url, fct){
    app.post(url, function(req, res){
      try{
        fct(req,buildGenCb(res));
      }catch(err){
        log.error(err.stack?err.stack:err);
        return buildGenCb(res)(errorsList['server-error']);
      }
    });
  }

  addPost('/user/signup', userSignup); // email, password, name -> token
  addPost('/user/delete', checkToken(userDelete)); // token -> Ok
  addPost('/user/login', userLogin); // email, password -> token
  addPost('/user/logout', checkToken(userLogout)); // token -> Ok
  addPost('/user/info', checkToken(userInfo)); // token -> Ok
  addPost('/user/updatePassword', checkToken(userUpdatePassword)); // token, newPasswd -> Ok
};
