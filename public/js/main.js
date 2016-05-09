$(function(){
  "use strict";

  $("#btn-logout").click(function(){
    ajaxUserLogout(localStorage.token,function(err,res){
      localStorage.token = "";
      login();
    });
  });
  $("#btn-delete").click(function(){
    ajaxUserDelete(localStorage.token,function(err,res){
      localStorage.token = "";
      login();
    });
  });

  var signup = (function(){
    var prevColor;
    var alert = $("#signup-alert");

    function refreshAlert(text,color){
      if(!text) alert.hide();
      else alert.show();
      if(prevColor) alert.removeClass("alert-"+prevColor);
      color = color || "info";
      prevColor = color;
      alert.addClass("alert-"+color);
      alert.text(text);
    }

    $("#signup-btn-signup").click(function(){
      refreshAlert("Registration...","info");
      var email = $("#signup-email").val();
      var name = $("#signup-name").val();
      var password = $("#signup-password").val();
      ajaxUserSignup(email,password,name,function(err,res){
        if(err) return refreshAlert(err, "danger");
        refreshAlert("Registration successful","success");
        $("#signup").modal("hide");
        login();
      });
    });

    $("#signup-btn-login").click(function(){
      $("#signup").modal("hide");
      login();
    });

    return function(){
      refreshAlert();
      $("#signup-email").val("");
      $("#signup-name").val("");
      $("#signup-password").val("");
      $("#signup").modal({backdrop:'static'});
    };
  })();

  var login = (function(){
    var prevColor;
    var cbFct = null;
    var alert = $("#login-alert");

    function refreshAlert(text,color){
      if(!text) alert.hide();
      else alert.show();
      if(prevColor) alert.removeClass("alert-"+prevColor);
      color = color || "info";
      prevColor = color;
      alert.addClass("alert-"+color);
      alert.text(text);
    }

    $("#login-btn-login").click(function(){
      refreshAlert("Authorization...","info");
      var email = $("#login-email").val();
      var password = $("#login-password").val();
      ajaxUserLogin(email,password,function(err,res){
        if(err) return refreshAlert(err, "danger");
        localStorage.email = email;
        localStorage.password = password;
        refreshAlert("Authorized","success");
        localStorage.token = res.token;
        $("#login").modal("hide");
        if(cbFct) return cbFct();
      });
    });

    $("#login-btn-signup").click(function(){
      $("#login").modal("hide");
      signup();
    });

    return function(cb){
      var val = localStorage;

      if(val.token){
        return ajaxUserInfo(val.token, function(err,res){
          if(err){
              val.token = "";
              return login(cb);
          }
          return cb();
        });
      }
      refreshAlert();
      if(cb){
        $("#login-email").val(val.email || "");
        $("#login-password").val(val.password || "");
        cbFct = cb;
      }
      $("#login").modal({backdrop:'static'});
    };
  })();

  login(function(){
    console.log("logged in");
  });
});
