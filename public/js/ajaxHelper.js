/* global $, console, setTimeout */
"use strict";

var reqPost = function(){
  var serverurl = "/";
  return function(url,data,cb){
    cb = cb || function(){};
    $.ajax(
      {
        type: "POST",
        url: serverurl+url,
        data: JSON.stringify(data),
        contentType: "application/json; charset=UTF-8",
        processData: false
      }
    ).done(function(ret){ cb(null,ret); })
     .fail(function(err){
       try{ err = JSON.parse(err.responseText).msg || "unknown error"; }catch(ex){}
       cb(err,null);
     });
	};
}();

// User

function ajaxUserLogin(email,pass,cb){
  if(!email) return cb("Email is empty");
  if(!pass) return cb("Password is empty");
  reqPost("user/login",{email:email,pass:pass},cb);
}

function ajaxUserInfo(token,cb){
  reqPost("user/info",{token:token},cb);
}

function ajaxUserLogout(token,cb){
  reqPost("user/logout",{token:token},cb);
}

function ajaxUserDelete(token,cb){
  reqPost("user/delete",{token:token},cb);
}

function ajaxUserSignup(email,pass,name,cb){
  var req = {pass:pass,email:email,name:name};
  if(!email) return cb("Email is empty");
  if(!pass) return cb("Password is empty");
  if(!name) return cb("Name is empty");
  reqPost("user/signup",req,cb);
}
