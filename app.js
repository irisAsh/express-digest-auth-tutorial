var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require("express-session");
var md5 = require('blueimp-md5');
var uuidv4 = require('uuid/v4');

var indexRouter = require('./routes/index');
var tutorialRouter = require('./routes/tutorial');
var aboutRouter = require('./routes/about');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: "secret word",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 1000
  }
}));

// 登録ユーザー
var allowedUsers = {
  'Express': 'good'
};

// authorization のパラメータを分解
var parseAuthorization = function(authorization) {
  // 始めの'Digest 'を省き、', 'で分割
  var arr = authorization.substr(7).split(', ');
  var result = {};
  arr.forEach(function(param) {
    if (param.indexOf("=") < 0) {
      return;
    }
    var [key, value] = param.split("=");
    result[key] = value.replace(/"/g, '');
  });
  return result;
};

app.use('/*', function (req, res, next) {
  var session = req.session;
  // リクエスト数をカウントしセッションに残す
  if (!!session.nc) {
    session.nc += 1;
  } else {
    session.nc = 1;
  }
  if (req.originalUrl === '/about' || req.originalUrl === '/') {
    next();
  } else {
    var realm = 'tutorial';
    var method = 'GET';
    var qop = 'auth';
    var judgement = false;
    var authorization = req.get('authorization');
    if (!!authorization && !!session.nonce && !!session.nc) {
      var authParams = parseAuthorization(authorization);
      // リクエスト数が一致しているかチェック
      if (session.nc === parseInt(authParams.nc, 16)) {
        // responseを算出
        var a1 = authParams.username + ':' + realm + ':' + allowedUsers[authParams.username];
        var a2 = method + ':' + authParams.uri;
        var a1_md5 = md5(a1);
        var a2_md5 = md5(a2);
        var code = a1_md5 + ':' + session.nonce + ':' + authParams.nc + ':' + authParams.cnonce + ':' + qop + ':' + a2_md5;
        var code_md5 = md5(code);
        judgement = code_md5 === authParams.response;
      }
    }
    if (judgement) {
      // 認証OK
      next();
    } else {
      // 認証NG
      session.nonce = uuidv4();
      session.nc = 0;
      res.set({
        'WWW-Authenticate': 'Digest realm="' + realm + '", nonce="' + session.nonce + '", algorithm=MD5, qop="' + qop + '"'
      });
      next(createError(401));
    }
  }
});

app.use('/', indexRouter);
app.use('/tutorial', tutorialRouter);
app.use('/about', aboutRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
