"use strict";

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const passport = require("passport");
const SamlStrategy = require("passport-saml").Strategy;
const { createProxyMiddleware } = require("http-proxy-middleware");

// Setup express
const app = express();

// SAML認証で取得するユーザ情報をシリアライズしてセッションに書き込む
passport.serializeUser(function (user, done) {
  done(null, user);
});

// SAMLリクエストにあるユーザ情報をデシリアライズ
passport.deserializeUser(function (user, done) {
  done(null, user);
});

// passport-samlの設定
// entryPoint: SSOログイン時にアクセスするIdPのURL
// issuer: IdPに提供される本アプリケーション(SP)の識別子
// path: IdPでのSSOログインが行われた場合にコールバックされるURL
// cert: SP initiated SSO（SP起点のSSO）に必要なSAML証明書情報
passport.use(
  new SamlStrategy(
    {
      entryPoint: process.env.ENTRYPOINT,
      issuer: process.env.ISSUER,
      path: "/auth/saml/callback",
      protocol: "https://",
      cert: process.env.CERT,
    },
    function (profile, done) {
      return done(null, {
        email: profile.email,
      });
    }
  )
);

// Expressでセッションを使用するための設定
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 60 * 1000,
    },
  })
);

// passportを使用するための設定
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

// 認証が通れば `/` にリダイレクト
// 認証NGの場合は `/login` にリダイレクト
app.get(
  "/login",
  passport.authenticate("saml", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

// Accept callback from IdP
app.post(
  "/auth/saml/callback",
  passport.authenticate("saml", {
    successRedirect: "/",
    failureFlash: true,
  }),
  function (req, res) {
    res.redirect("/login");
  }
);

// Health Check for ALB
app.get("/healthcheck", function (req, res) {
  console.log("Health Check");
  res.send("OK");
});

// Redirect to SSO if not authenticated
app.all("*", function (req, res, next) {
  console.log(req.isAuthenticated());
  if (req.isAuthenticated() || req.path == "/login") {
    next();
  } else {
    res.redirect("/login");
  }
});

// Proxy all request after auth
const proxy = createProxyMiddleware({
  target: "https://<YOUR ORIGIN DOMAIN>",
  changeOrigin: true,
});
app.use(proxy);

app.listen(80);
console.log("Started. Listening...");

module.exports = app;
