var __ = window.__ = require('underscore'),
    Backbone = require('backbone'),
    $ = require('jquery');
Backbone.$ = $;
//add to global scope for non-modular libraries
window.Backbone = Backbone;
window.$ = $;
window.jQuery = $;
window.Backbone.$ = $;
window.focused = true;

// we need to know this for notifications
window.onfocus = function() {
  window.focused = true;
};

window.onblur = function() {
  window.focused = false;
};

var Polyglot = require('node-polyglot'),
    getBTPrice = require('./utils/getBitcoinPrice'),
    router = require('./router'),
    newRouter,
    userModel = require('./models/userMd'),
    userProfileModel = require('./models/userProfileMd'),
    languagesModel = require('./models/languagesMd'),
    mouseWheel = require('jquery-mousewheel'),
    mCustomScrollbar = require('./utils/jquery.mCustomScrollbar.js'),
    setTheme = require('./utils/setTheme.js'),
    pageNavView = require('./views/pageNavVw'),
    chatAppView = require('./views/chatAppVw'),
    newPageNavView,
    newSocketView,
    newChatAppView,
    user = new userModel(),
    userProfile = new userProfileModel(),
    languages = new languagesModel(),
    socketView = require('./views/socketVw'),
    cCode = "",
    serverUrlLocal = "",
    loadProfileCount = 1,
    loadProfileCountdownInterval,
    loadProfileCountdown = 5;

serverUrlLocal = localStorage.getItem("serverUrl") || "http://localhost:18469/api/v1/";

//set the urlRoot of the user model. Defaults to local host if not found
user.urlRoot = serverUrlLocal + "settings";

//set the urlRoot of the user model. Defaults to local host if not found
userProfile.urlRoot = serverUrlLocal + "profile";

//put language in the window so all templates and models can reach it. It's especially important in formatting currency.
window.lang = user.get("language");

//put polyglot in the window so all templates can reach it
window.polyglot = new Polyglot({locale: window.lang});

//retrieve the object that has a matching language code
window.polyglot.extend(__.where(languages.get('languages'), {langCode: window.lang})[0]);

//put the event bus into the window so it's available everywhere
window.obEventBus =  __.extend({}, Backbone.Events);

// fix zoom issue on Linux hiDPI
var platform = process.platform;

if(platform === "linux") {
  var scaleFactor = require('screen').getPrimaryDisplay().scaleFactor;
  if (scaleFactor === 0) {
      scaleFactor = 1;
  }
  $("body").css("zoom", 1 / scaleFactor);
}

//record changes to the app state
$(window).bind('hashchange', function(){
  "use strict";
  localStorage.setItem('route', Backbone.history.getFragment());
});

//prevent dragging a file to the window from loading that file
window.addEventListener("dragover",function(e){
  e = e || event;
  e.preventDefault();
},false);
window.addEventListener("drop",function(e){
  e = e || event;
  e.preventDefault();
},false);

var setCurrentBitCoin = function(cCode, userModel, callback) {
  "use strict";
  getBTPrice(cCode, function (btAve, currencyList) {
    //put the current bitcoin price in the window so it doesn't have to be passed to models
    if (!btAve){
      currencyList = currencyList.join("\n");
      alert("Bitcoin prices for your selected currency are not available. Your currency has been set to BTC. " +
          "You can change this in the settings console. \n\n The following currencies are available: \n\n" + currencyList);
      window.currentBitcoin = 1;
      userModel.set('currency_code', 'BTC');
    }
    window.currentBitcoin = btAve;
    typeof callback === 'function' && callback();
  });
};

// var isValidUrl = function(url) {
//   var regexp = /(https?:\/\/)+[\w-]+(\.[\w-]+)*(:\d+)+(\/\S*)?/;
//   return regexp.test(url);
// };

// var loadDefaultServer = function(){
//   "use strict";
//   $('.js-loadingMessageModal').removeClass('hide').find('.js-closeIndexModal').addClass('hide');
//   $('.js-indexLoadingMsg1').text("Information for your user profile could not be loaded.");
//   $('.js-indexLoadingMsg2').text(serverUrlLocal + " could not be reached.");
//   $('.js-indexLoadingMsg3').text("You can enter a different server below.");
//   loadProfileCount = 3;
// };

var loadProfile = function() {

  var reloadProfile = function(){
    "use strict";
    $('.js-loadingMessageModal').removeClass('hide').find('.js-closeIndexModal').addClass('hide');
    loadProfileCountdown=5;

    if(loadProfileCount <= 3){
      loadProfileCountdownInterval = setInterval(function(){
        if(loadProfileCountdown > 0){
          $('.js-indexLoadingMsg4').text(loadProfileCountdown);
          loadProfileCountdown--;
        } else {
          $('.js-indexLoadingMsg4').text("");
          clearInterval(loadProfileCountdownInterval);
          loadProfileCount++;
          loadProfile();
        }
      }, 3000);
    } else {
      loadDefaultServer();
    }
  };

  //get the guid from the user profile to put in the user model
  userProfile.fetch({
    timeout: 4000,
    success: function (model, response) {
      $('.js-loadingModal').addClass('hide');
      "use strict";
      //clear the interval
      clearInterval(loadProfileCountdownInterval);
      //make sure profile is not blank
      if (response.profile){
        setTheme(model.get('profile').primary_color, model.get('profile').secondary_color, model.get('profile').background_color, model.get('profile').text_color);
        //get the user
        user.fetch({
          success: function (model, response) {
            user.set('serverUrl', serverUrlLocal);
            cCode = model.get('currency_code');

            //get user bitcoin price before loading pages
            setCurrentBitCoin(cCode, user, function() {
              $('.js-loadingMessageModal').addClass('hide');
              newSocketView = new socketView({model: user});
              newPageNavView = new pageNavView({model: user, socketView: newSocketView, userProfile: userProfile});
              newChatAppView = new chatAppView({model: user, socketView: newSocketView});
              newRouter = new router({userModel: user, userProfile: userProfile, socketView: newSocketView, chatAppView: newChatAppView});
              Backbone.history.start();
            });

            //every 15 minutes update the bitcoin price for the currently selected currency
            window.bitCoinPriceChecker = setInterval(function () {
              setCurrentBitCoin(model.get('currency_code'), user);
            }, 54000000);
          },
          error: function (model, response) {
            loadDefaultServer();
          }
        });
      }else{
        $('.js-indexLoadingMsg1').text("User profile did not load.");
        $('.js-indexLoadingMsg2').text("Attempting to reach " + serverUrlLocal);
        $('.js-indexLoadingMsg3').text("Reload attempt " + loadProfileCount + " of 3");
        reloadProfile();
      }
    },
    error: function (model, response) {
      $('.js-loadingModal').addClass('hide');
      $('.js-indexLoadingMsg1').text("Information for your user profile could not be loaded: " + response.statusText);
      $('.js-indexLoadingMsg2').text("Attempting to reach " + serverUrlLocal);
      $('.js-indexLoadingMsg3').text("Reload attempt " + loadProfileCount + " of 3");
      reloadProfile();
    }
  });
};

// this.loadNewServer = function(newServer) {
//   "use strict";
//   if(isValidUrl(newServer)){
//     newServer = newServer.replace(/((\/)?(api)?(\/)?(v1)?(\/)?)$/, '/api/v1/'); //add trailing slash if missing
//     localStorage.setItem("serverUrl", newServer);
//     serverUrlLocal = newServer;
//     user.urlRoot = newServer + "settings";
//     userProfile.urlRoot = newServer + "profile";
//     loadProfileCount=3;//end any loops
//     loadProfile();
//   } else {
//     alert(newServer + " is not a valid URL. It must start with http:// or https:// and have a port number. ':18469' is the normal port number.");
//   }
// };

// if(isValidUrl(serverUrlLocal)){
//   loadProfile();
// } else {
//   loadDefaultServer();
// }

// $(document).bind("ajaxSend", function(s, req){
//   console.log('slick willy');
//   window.slick = arguments;

//   req.abort();
// });

// loadProfile();

// var serverConfigMd = require('./models/serverConfigMd');
// var serverConfig = new serverConfigMd({ id: 1 });
// serverConfig.fetch();
// serverConfig.set('rest_api_port', 18469);
// window.mooMod = serverConfig;

// window.guidCheck = $.get(serverConfig.getServerBaseUrl() + '/profile').always(function() {
//   console.log('always and forever');
//   window.always = arguments;
// });

// // todo: register child
// var serverConnectModal = require('./views/serverConnectModal');
// var mooModal = new serverConnectModal({
//   model: serverConfig
// });
// // mooModal.render().open();

// fire off guid check req
// window.guidCheck = $.get('http://localhost:18470/api/v1/guid_generation');

// setTimeout(function() {
//   if (guidCheck.state() === 'pending') {
//     // guid create in progress
//     // launch onboarding modal passing in guid check req
//   } else {
//     // guid check either finished or server is down
//     guidCheck.complete(function() {
//       if (data.success) {
//         // guid gen complete
//          // launch onboarding modal passing in guid check req
//       } else {
//         // guid gen failed
//         // ????
//       }
//     }).fail(function() {
//       // either server is down or guid had already been generated
//       var profileCheck = $.get(serverConfig.getServerBaseUrl() + '/profile').done(function() {
//         console.log('profDone');
//         window.profDone = arguments;

//         // guid was previously generated
//         if (localStorage.onboardingComplete) {
//           // launch the app
//         }
//       }).fail(function() {
//         console.log('profFail');
//         window.profFail = arguments;

//         // server is indeed down
//         // show serverConnectModal;
//       });
//     });
//   }
// }, 1000);




// var onboardingModal = require('./views/onboardingModal');
// var pickleModal = new onboardingModal({
//   model: user,
//   userProfile: userProfile
// });
// pickleModal.render().open();
// pickleModal.on('onboarding-complete', function() {
//   var newRouter = new router({userModel: user, userProfile: userProfile, socketView: newSocketView, chatAppView: newChatAppView});
//   Backbone.history.start();
//   pickleModal.remove();
// });

// // var serverConnector = function(options) {
// //   options = options || {};
// //   this.options = options;

// //   if (!options.serverConfigModel || !(options.serverConfigModel instanceof serverConfigMd)) {
// //     throw new Error('Please provide a serverConfigMd instance.')
// //   }

// //   // this.url = options.serverConfigModel.getServerBaseUrl() + '/guid_generation'
// //   this.connectAttempts = 0;
// // }

// // serverConnector.prototype.connect = function() {
// //   this.connectAttempts += 1;
// //   this.connectRequest = $.ajax({
// //     type: 'GET',
// //     url: this.options.serverConfigModel.getServerBaseUrl() + '/guid_generation',
// //     // contentType: false,
// //     // processData: false,
// //     // data: formData,
// //     dataType: "json"
// //   }).complete(function() {

// //   });
// // }