/* global requirejs cprequire cpdefine chilipeppr THREE */
// Defining the globals above helps Cloud9 not show warnings for those variables

// ChiliPeppr Widget/Element Javascript

requirejs.config({
    /*
    Dependencies can be defined here. ChiliPeppr uses require.js so
    please refer to http://requirejs.org/docs/api.html for info.
    
    Most widgets will not need to define Javascript dependencies.
    
    Make sure all URLs are https and http accessible. Try to use URLs
    that start with // rather than http:// or https:// so they simply
    use whatever method the main page uses.
    
    Also, please make sure you are not loading dependencies from different
    URLs that other widgets may already load like jquery, bootstrap,
    three.js, etc.
    
    You may slingshot content through ChiliPeppr's proxy URL if you desire
    to enable SSL for non-SSL URL's. ChiliPeppr's SSL URL is
    https://i2dcui.appspot.com which is the SSL equivalent for
    http://chilipeppr.com
    */
    paths: {
        // Example of how to define the key (you make up the key) and the URL
        // Make sure you DO NOT put the .js at the end of the URL
        // SmoothieCharts: '//smoothiecharts.org/smoothie',
    },
    shim: {
        // See require.js docs for how to define dependencies that
        // should be loaded before your script/widget.
    }
});

// Test this element. This code is auto-removed by the chilipeppr.load()
cprequire_test(["inline:com-chilipeppr-widget-recvtext"], function (zipwhip) {
    console.log("test running of " + zipwhip.id);
    
    $('body').css("padding", "20px");
    
    // this makes it so we don't poll, so that we don't handle the response while the main workspace does
    //zipwhip.noPollingWhileTesting = true;
    
    zipwhip.init();
    
    var testPubSub = function() {
        chilipeppr.publish("/com-chilipeppr-widget-gcode/done", "param1", "p2");
    }
    setTimeout(testPubSub, 10000);
    
    setTimeout(zipwhip.activateWidget.bind(zipwhip), 1000);
    setTimeout(zipwhip.activateWidget.bind(zipwhip), 5000);
    setTimeout(zipwhip.unactivateWidget.bind(zipwhip), 7000);
    setTimeout(zipwhip.activateWidget.bind(zipwhip), 9000);

        
} /*end_test*/ );

cpdefine("inline:com-chilipeppr-widget-recvtext", ["chilipeppr_ready"], function () {
    return {
        id: "com-chilipeppr-widget-recvtext",
        name: "Widget / Zipwhip Receive Text",
        desc: "Let people send inbound texts to trigger actions inside ChiliPeppr.",
        url: "(auto fill by runme.js)",       // The final URL of the working widget as a single HTML file with CSS and Javascript inlined. You can let runme.js auto fill this if you are using Cloud9.
        fiddleurl: "(auto fill by runme.js)", // The edit URL. This can be auto-filled by runme.js in Cloud9 if you'd like, or just define it on your own to help people know where they can edit/fork your widget
        githuburl: "(auto fill by runme.js)", // The backing github repo
        testurl: "(auto fill by runme.js)",   // The standalone working widget so can view it working by itself
        publish: {
            '/recv' : 'This signal is sent when an incoming text comes in. You can subscribe to it ' + 
            'and you will get a signal that contains the payload of the message including ' +
            'the body of the text and the sender\'s phone number.',
        },
        subscribe: {
            '/send' : 'You can publish this signal and this widget will send a text message. The payload should look like ' +
            '{body: "my text msg body", to: "313-555-1212"} and the text will be sent to the to phone number from the account ' + 
            'you are logged into. Make sure to ' +
            'send less than 160 characters or multiple concatenated texts will be sent.',
            '/getSessionKey' : "You can ask for the sessionkey back and phone number of the logged in account. This lets you make your own direct calls to Zipwhip. You must pass in {callback:mymethod} and that method will get called back immediately with the sessionkey and phone number of the logged in account."
        },
        foreignSubscribe: {
            "/com-chilipeppr-widget-gcode/done" : "When we see this signal, we know we can queue up the next trigger.",
            "/com-chilipeppr-widget-gcode/onpause" : "When we see this signal, we know the operator is having a problem and is pausing.",
            "/com-chilipeppr-widget-gcode/onplay" : "When we see this signal, we know that the gcode is in play mode so we can reject incoming texts.",
            "/com-chilipeppr-widget-gcode/onstop" : "When we see this signal, we know the operator is having a problem and is stopping."
        },
        /**
         * The sessionkey is the main value needed for all Zipwhip cloud calls. This
         * value is set from localStorage after you login.
         */
        sessionkey: null,
        //sessionkey: "535752b5-0766-47d7-99ee-c59a2975cdce:301551902",
        sessionPhone: null,
        //sessionkey: null,
        vending: false,
        isTimerMode: true,
        timeOut: 5000,
        noPollingWhileTesting: false,
        isInitted: false,
        init: function () {

            if (this.isInitted) {
                console.warn("You are initting the Zipwhip Recv Text widget again. why? returning...");
                return;
            }
            
            // this method will see if we have a stored login
            // if we do, we move forward to show UI elements and start polling
            // if no login, we show login form
            this.setupLogin();
            
            this.setupBtns();
            
            //this.injectDiv();
            this.setupPubSub();
            
            this.subscribeSetup();
            this.btnSetup();
            this.setupUiFromLocalStorage();
            this.forkSetup();

            this.isInitted = true;
            
            console.log(this.name + " done loading.");
        },
        activateWidget: function() {
            // turn on short polling if we are authenticated
            console.log("got activateWidget for " + this.name);
            this.turnOnShortPoll();
        },
        unactivateWidget: function() {
            // turn off short polling
            console.log("got unactivateWidget for " + this.name);
            this.turnOffShortPoll();
        },
        setupPubSub: function() {
            chilipeppr.subscribe("/" + this.id + "/send", this, this.sendTextFromPubSubSignal);    
            chilipeppr.subscribe("/" + this.id + "/getSessionKey", this, this.publishSessionKey);    
        },
        publishSessionKey: function(payload) {
            if (payload && 'callback' in payload) {
                payload.callback({sessionkey: this.sessionkey, phone:this.sessionPhone});
            }
        },
        setupLogin: function() {
        
            var that = this;
            
            // see if we are logged in
            var skey = localStorage.getItem(this.id + "-sessionkey");
            if (skey && skey.length > 10) {
                // we have a sessionkey
                this.sessionkey = skey;
                this.doPostLogin();
            } else {
                // show login box
                //com-chilipeppr-widget-zipwhiploginform-instance
                chilipeppr.load(
                    "#com-chilipeppr-widget-zipwhiploginform-instance",
                    "https://fiddle.jshell.net/zipwhip/b3qgw2bp/show/light",
                    function() {
                        // we get here once loaded
                        $('#com-chilipeppr-widget-zipwhiploginform-instance').removeClass("hidden");
                        
                        // make the login btn look like a bootstrap button
                        $('.zw-loginform-submit-btn').addClass("btn btn-primary");
                        
                        cprequire(["inline:com-zipwhip-loginform"], function(zwlogin) {
                            // get here after finding the instance object
                            zwlogin.init();
                            zwlogin.addCallbackAfterLogin(that.afterLogin.bind(that));
                        })
                    }
                );
            }
        },
        afterLogin: function(info) {
            console.log("got callback in ChiliPeppr Receive Text widget after login. info:", info);
            if (info.success == true) {
                // store it
                this.sessionkey = info.response;
                localStorage.setItem(this.id + "-sessionkey", this.sessionkey);
                this.doPostLogin();
            }
        },
        /**
         * This method should be called after verifying there is a legitimate sessionkey
         * and we are good to go to start running short polling and show UI items that
         * we want after having a good login.
         */
        doPostLogin: function() {
            $('#' + this.id + " .post-login-region").removeClass("hidden");
            $('#com-chilipeppr-widget-zipwhiploginform-instance').addClass("hidden");
            
            // show logout button
            $('#' + this.id + " .recvtext-logout-btn").removeClass("hidden");
            
            var that = this;    
            this.loadIdentityCard(function(obj) {
                
                console.log("done loading info for this logged in acct. info:", obj);
                that.sessionPhone = obj.phone;
                
                // this makes it so we don't poll, so that we don't handle the response while the main workspace does
                if (that.noPollingWhileTesting == false) 
                    //that.setupIntervalToShortPoll();
                    that.turnOnShortPoll();
                
            });
        },
        logout: function() {
            // wipe sessionkey
            this.turnOffShortPoll();
            this.sessionkey = null;
            this.sessionPhone = null;
            localStorage.removeItem(this.id + "-sessionkey");
            $('#' + this.id + " .recvtext-logout-btn").addClass("hidden");
            $('#' + this.id + " .post-login-region").addClass("hidden");
            $('#com-chilipeppr-widget-zipwhiploginform-instance').removeClass("hidden");
            this.setupLogin();
        },
        injectDiv: function() {
            setTimeout(function() {
                console.log("injecting background for ice luge");
                var el = $('<div class="recvtext-bg">BG</div>');
                $('#com-chilipeppr-widget-3dviewer-renderArea').prepend(el);
                //$('#com-chilipeppr-serialport-log').addClass("hidden");
                //$('#com-chilipeppr-gcode-list').addClass("hidden");
                //$('#com-chilipeppr-widget-gcodeviewer').addClass("hidden");
                
                
            }, 10000);
            
        },
        subscribeSetup: function() {
            //chilipeppr.subscribe("/com-chilipeppr-widget-gcode/done", this, this.onDone);
            chilipeppr.subscribe("/com-chilipeppr-widget-gcode/onpause", this, this.onPause);
            chilipeppr.subscribe("/com-chilipeppr-widget-gcode/onplay", this, this.onPlay);
            chilipeppr.subscribe("/com-chilipeppr-widget-gcode/onstop", this, this.onStop);
        },
        /**
         * Holds the pointer to the interval setTimeout so we can turn it off
         */
        intervalPtr: null,
        toggleShortPoll: function() {
            if (this.intervalPtr) {
                this.turnOffShortPoll();
            } else {
                this.turnOnShortPoll();
            }
        },
        turnOffShortPoll: function() {
            
            if (this.intervalPtr) {
                console.log("turning off short polling");
                clearInterval(this.intervalPtr);
                this.intervalPtr = null;
                $('#' + this.id + " .panel-footer").text("Short polling off.");
                $('#' + this.id + " .recvtext-toggleshortpoll-txt").text("Off");
            } else {
                console.log("asked to turn off short polling but it wasn't on");
            }
        },
        turnOnShortPoll: function() {
            if (this.intervalPtr) {
                console.log("being asked to turn on short poll, but it is already on");
            } else {
                console.log("being asked to turn on short poll, it was not on, so turning on");
                if (this.sessionkey && this.sessionkey.length > 10) {
                    this.setupIntervalToShortPoll();
                } else {
                    console.log("there is no sessionkey so not actually turning on short polling");
                }
            }
        },
        setupIntervalToShortPoll: function() {
            // Setup an interval to query on
            var interval = 10; // seconds
            console.log("setting up interval to query zipwhip for inbound texts. seconds:", interval);
            this.intervalPtr = setInterval(this.checkForInboundMsgs.bind(this), interval * 1000);
            $('#' + this.id + " .panel-footer").text("Started short polling. Every " + interval + " secs.");
            $('#' + this.id + " .recvtext-toggleshortpoll-txt").text("On");

        },
        setupBtns: function() {
            $('.recvtext-run').click(this.onStartVending.bind(this));
            $('#com-chilipeppr-widget-recvtext .panel-footer').click(this.checkForInboundMsgs.bind(this));
            $('#' + this.id + " .recvtext-toggleshortpoll").click(this.toggleShortPoll.bind(this));
            $('#' + this.id + " .recvtext-logout-btn").click(this.logout.bind(this));
            $('#' + this.id + " .btn").popover();
        },
        loadContactCard: function() {
            var that = this;
            // load contact card
            chilipeppr.load(
                "#recvtext-identity-instantiation",
                "http://fiddle.jshell.net/zipwhip/z85knmtj/show/light/",
                function() {
                    cprequire(["inline:com-zipwhip-contactcard"], function (ccard) {
                        console.log("test running of " + ccard.id);
                        
                        that.elemContactCard = ccard;
                        
                        var sessionkey = that.sessionkey;
                        if (sessionkey && sessionkey.length > 0) {
                            ccard.createViaSessionkey(sessionkey, function(el, obj) {
                                //$('.recvtext-identity').replaceWith(el);
                                el.find('.zw-contactcard-menu').addClass("hidden");
                                $('.recvtext-identity').append(el);
                                console.log("just appended real ID card with name/phone. obj:", obj);
                            });
                        }
                        
                        console.log("Loaded Identity Card.");
                    });
                }
            );

        },
        loadIdentityCard: function(callback) {
            
            var that = this;

            // load an identity card using dashboard card
            chilipeppr.load(
                "#recvtext-identity-instantiation",
                "http://fiddle.jshell.net/zipwhip/xet57Lbr/show/light/",
                function() {
                    cprequire(["inline:com-zipwhip-dashboardcard"], function (dashboardcard) {
                        console.log("actual running of " + dashboardcard.id);
                        
                        that.elemDashboardCard = dashboardcard;
                        
                        dashboardcard.init(function() {
                            
                            console.log("got callback from dashboardcard init, so ready to go.");
                        
                            that.elemConversationCard = dashboardcard.conversationCard;
                            that.elemContactCard = dashboardcard.conversationCard.contactCard;

                            // remove any previous dashcard
                            $(".recvtext-identity .zw-dashboardcard")
                                .not(".zw-dashboardcard-template")
                                .remove();
                            //$(".recvtext-identity .zw-dashboardcard").addClass("hidden");

                            dashboardcard.create(
                                that.sessionkey,
                                function(d, sessionkey, phone, response) {
                                    console.log("got a dashboard card for a sessionkey. d:", d);
                                    d.find('.zw-contactcard-menu').remove();
                                    $(".recvtext-identity").append(d);
                                    //that.sessionPhone = phone;
                                    if (callback) {
                                        callback( { 
                                            sessionkey: sessionkey, 
                                            phone: phone
                                        });
                                    }
                                }
                            ); 
                        });
                        
                    });
                }
            );
            
        },
        checkForInboundMsgs: function() {
            console.log("checking for inbound msgs");
            
            var that = this;
            
            this.shortPoll(function(data) {
                console.log("got callback from short poll. data:", data);
                
                if (data && 'success' in data && data.success && 'sessions' in data && data.sessions.length > 0 && 'message' in data.sessions[0]) {
                    
                    // awesome. we have messages.
                    var msgs = data.sessions[0].message;
                    console.log("we have msgs:", msgs);
                    
                    // get our main msg
                    for (var indx in msgs) {
                    
                        var msg = msgs[indx];
                        
                        // clean up phone number
                        msg.srcAddr = msg.address.replace("ptn:/", "");
                        
                        console.log("msg we're working on:", msg);
                    
                        // see if we have an inbound msg
                        if (msg.type.match(/MO/i) && msg.isRead != true) {
                            
                            // publish that we got a text
                            that.onRecvText(msg);
                            
                            /*
                            // check that it's our vend keyword
                            if (msg.body.match(/^\s*go/i)) {
                                
                                // see if we are vending
                                if (that.isVending()) {

                                    console.log("rejecting request for msg:", msg);

                                    // so we don't get into a loop
                                    //if (msg.srcAddr != "8445646528") {
                                    if (msg.srcAddr != that.sessionPhone) {
                                        that.sendText(msg.srcAddr, 
                                        "Sorry. The Zipwhip Receive Text widget is busy handling somebody else's request right now. Please wait a bit and text back in.");
                                        that.onBusyMsg(msg);
                                    }

                                } else {

                                    // we are good to vend

                                    // so we don't get into a loop
                                    if (msg.srcAddr != that.sessionPhone) {
                                        // send vending response back
                                        that.sendText(msg.srcAddr, 
                                            "The Zipwhip Receive Text action is triggering " + 
                                            "for you right now." +
                                            "");
                                        that.onStartVending(msg.srcAddr, msg);
                                    }
                                }

                            } else {
                                console.log("a keyword was texted in that we didn't understand, so just ignoring.");
                            }
                            */
                            
                        } else if (msg.type.match(/MO/i) && msg.isRead == true) {
                            console.log("got copy of marking MO msg as read, so ignore");
                        } else {
                             // this message is a copy of our outbound MT, so ignore 
                            console.log("got copy of MT outbound msg, so ignore");
                        }
                        
                    }
                } else {
                    //console.log("did short poll, but got nothing back");    
                }
            });
        },
        onRecvText: function(msg) {
            console.log("got onRecvText. msg:", msg);
            
            chilipeppr.publish("/" + this.id + "/recv", msg);
            
            this.addInboundMsgBubble(msg);
        },
        addInboundMsgBubble: function(msg) {
            // check for run without phone
            var phone = msg.srcAddr;
            if (phone == null || phone.length == 0 || typeof phone == "object") {
                console.log("being run manually");
                phone = "0000000000";
            }
            
            var body = "(No body of msg)";
            if (msg && 'body' in msg) body = msg.body;
            
            // show who we're vending for
            this.vendingForEl = $('<div class="recvtext-vendingfor-item recvtext-runnng">' + phone + '</div>');
            var ccardEl = this.elemContactCard.create({phone:this.formatPhone(phone)});
            this.vendingForEl.empty().append(ccardEl);
            this.vendingForEl.append('<div class="recvtext-vendingfor-msg">' + body + '</div>');
            var now = new Date();
            this.vendingForEl.append('<div class="recvtext-vendingfor-now">' + now.toLocaleString() + ' <span class="recvtext-vendingfor-done"></span></div>');
            
            $('.recvtext-vendingfor').prepend(this.vendingForEl);
            $(window).trigger('resize');
        },
        onBusyMsg: function(msg) {
            
            console.log("onBusyMsg");
            
            var phone = msg.sourceAddress;

            // show err msg
            var el = $('<div class="recvtext-vendingfor-item recvtext-busy">' + phone + '</div>');
            var ccardEl = this.elemContactCard.create({phone:this.formatPhone(phone)});
            el.empty().append(ccardEl);
            el.append('<div class="recvtext-vendingfor-msg">' + msg.body + ' (Sent a busy msg back)</div>');
            var now = new Date();
            el.append('<div class="recvtext-vendingfor-now">' + now.toLocaleString() + '<span class="recvtext-vendingfor-done"></span></div>');
            
            $('.recvtext-vendingfor').prepend(el);
        },
        onStartVending: function(phone, msg) {
            
            console.log("onStartVending");

            // check for run without phone
            if (phone == null || phone.length == 0 || typeof phone == "object") {
                console.log("being run manually");
                phone = "0000000000";
            }

            this.vending = true;
            this.vendingFor = phone;
            this.vendingForEl = null;
            
            chilipeppr.publish("/com-chilipeppr-widget-gcode/stop");
            chilipeppr.publish("/com-chilipeppr-widget-gcode/play");
            
            var body = "(No body of msg)";
            if (msg && 'body' in msg) body = msg.body;
            
            // show who we're vending for
            this.vendingForEl = $('<div class="recvtext-vendingfor-item recvtext-runnng">' + phone + '</div>');
            var ccardEl = this.elemContactCard.create({phone:this.formatPhone(phone)});
            this.vendingForEl.empty().append(ccardEl);
            this.vendingForEl.append('<div class="recvtext-vendingfor-msg">' + body + '</div>');
            var now = new Date();
            this.vendingForEl.append('<div class="recvtext-vendingfor-now">' + now.toLocaleString() + ' <span class="recvtext-vendingfor-done"></span></div>');
            
            $('.recvtext-vendingfor').prepend(this.vendingForEl);
            
            // make a clone and make it huge and absolute position
            var that = this;
            setTimeout(function() {
                var hugeEl = that.vendingForEl.clone();
                hugeEl.addClass("recvtext-huge");
                that.hugeEl = hugeEl;
                //$('body').append(hugeEl);
            }, 2000);
            
            // show green state
            $('#com-chilipeppr-widget-recvtext .panel-heading').addClass("recvtext-runnng");
            
            // disable run button
            $('.recvtext-run').prop('disabled', true);
            
            // for now do fake callback in about 7 seconds
            if (this.isTimerMode) setTimeout(this.onEndVending.bind(this), this.timeOut);
            
            $(window).trigger('resize');
        },
        isVending: function() {
            console.log("are we vending? this.vending:", this.vending);
            return this.vending;
        },
        onEndVending: function() {
            console.log("onEndVending");
            
            this.vending = false;

            if (this.hugeEl) {
                this.hugeEl.remove();
            }
            
            if (this.vendingForEl) {
                // mark vendingFor as complete
                this.vendingForEl.removeClass("recvtext-runnng").find('.recvtext-vendingfor-done').text('Done');
            }
            
            // put hdr back to normal
            $('#com-chilipeppr-widget-recvtext .panel-heading').removeClass("recvtext-runnng");
            
            // enable run button
            $('.recvtext-run').prop('disabled', false);
            
        },
        shortPoll: function(callback) {
            
            var sessionkey = this.sessionkey;
            
            var url = "http://api.zipwhip.com/session/update?sessions=" + sessionkey;
            
            console.log("about to call url:", url);
            
            $.ajax({
                url: url,
                // The name of the callback parameter, as specified by the YQL service
                jsonp: "callback",
                // Tell jQuery we're expecting JSONP
                dataType: "jsonp",
                jsonpCallback: "callbackForJsonPForSessionUpdate",
                context: this,
            }).done(function(response) {
                //console.log("got back info from session update. response:", response);
                // we will get back json of success or error
                var obj = null;
                if (typeof response == 'object') {
                    // good to go
                    obj = response;
                    //console.log("jquery ajax gave data to us as real object:", obj);
                } else {
                    //console.log("we got data as text, so parse");
                    obj = $.parseJSON(response);
                    //console.log("parsed obj val:", obj);
                }
                
                var now = new Date();
                $('#com-chilipeppr-widget-recvtext .panel-footer').text("Last query " + now.toLocaleString()).removeClass("alert-danger alert");
                
                if (callback) callback(obj);
                
                
            }).fail(function(response) {
                console.log("got err from format phone. response:", response);
                
                var now = new Date();
                $('#com-chilipeppr-widget-recvtext .panel-footer').text("Last query " + now.toLocaleString() + " Error").addClass("alert-danger alert");

                var errmsg;
                if ('responseJSON' in response)
                    errmsg = response.responseJSON.error + " " + response.responseJSON.message;
                else
                    errmsg = "Error accessing the Zipwhip /session/update short polling API call.";
                
                if (callback) callback({success: false, error: errmsg});
            });
        },
        formatPhone: function(phone) {
            var cleanphone = phone.replace(/\D/g, "");
            var re = /(\d\d\d)(\d\d\d)(.*)/;
            re.exec(cleanphone);
            var fmt = "(" + RegExp.$1 + ") " + RegExp.$2 + "-" + RegExp.$3;
            
            return fmt;
        },
        /**
         * Pass in the payload {body: "your body", to: "313-414-1234"} to send your text.
         */
        sendTextFromPubSubSignal: function(payload) {
            this.sendText(payload.to, payload.body);
        },
        sendText: function(destAddr, body) {
            // this method uses the Zipwhip api documented at zipwhip.com/api
            // we do GET methods into Zipwhip and proxy them thru ChiliPeppr so that
            // ChiliPeppr swaps in the sessionid for security
            // We get back direct ajax from Zipwhip but via ChiliPeppr proxy
            
            // format the phone number to ptn:/ format
            var pn = destAddr;
            pn = pn.replace(/\D/g, ""); // remove anything but digits
            pn = "ptn:/" + pn;
            var url = "http://api.zipwhip.com/message/send";
            var data = {
                //session: "-fill-from-server-session-",
                session: this.sessionkey,
                contacts: pn,
                body: body,
                //fromAddress:4
            };
            var urlget = url + "?" + $.param(data);
            console.log("going to use chilipeppr geturl. here's our getstr:", urlget);
            //urlget = encodeURIComponent(urlget);
            console.log("after encoding:", urlget);
            //console.log("sending test msg. data:", data);
            
            $.ajax({
                url: "http://chilipeppr.com/zipwhip",
                //url: "http://chilipeppr.com/geturl",
                //url: "http://localhost:8080/zipwhip",
                type: "GET",
                data: {url: urlget}
            })
            .done(function( data ) {
                console.log("data back", data);
                //chilipeppr.publish("/com-chilipeppr-elem-flashmsg/flashmsg", "Zipwhip Text Message Sent", body);
            })
            .fail(function() {
                console.log( "error" );
                chilipeppr.publish("/com-chilipeppr-elem-flashmsg/flashmsg", "Zipwhip Text Message Error", "An error occurred sending text.");
            });
        },
        onTest: function() {
            
            $('#com-chilipeppr-elem-zipwhip-testBtn').prop('disabled', true);
            this.sendText("Test message.\n\nTexts courtesy of Zipwhip.com landline texting. Hope ur enjoying ChiliPeppr.");
            $('#com-chilipeppr-elem-zipwhip-body .test-send-status').text('Test Sent');
            setTimeout(function() {
                $('#com-chilipeppr-elem-zipwhip-testBtn').prop('disabled', false);
                $('#com-chilipeppr-elem-zipwhip-body .test-send-status').text('');
            }, 5000);
        },
        onDone: function(msg) {
            console.log("got onDone signal. send text.");
            // see if they have a phone and that they want an alert
            $('#com-chilipeppr-widget-recvtext .panel-title-status').text("onDone");
            this.onEndVending();
        },
        onPlay: function(param1, param2) {
            console.log("zipwhip texting. got onPlay signal. param1:", param1, "param2:", param2);
            $('#com-chilipeppr-widget-recvtext .panel-title-status').text("onPlay");
        },
        onPause: function(param1, param2) {
            console.log("zipwhip texting. got onPause signal. param1:", param1, "param2:", param2);
            $('#com-chilipeppr-widget-recvtext .panel-title-status').text("onPause");
        },
        onStop: function(param1, param2) {
            console.log("zipwhip texting. got onStop signal. param1:", param1, "param2:", param2);
            $('#com-chilipeppr-widget-recvtext .panel-title-status').text("onStop");
        },
        /**
         * Call this method from init to setup all the buttons when this widget
         * is first loaded. This basically attaches click events to your 
         * buttons. It also turns on all the bootstrap popovers by scanning
         * the entire DOM of the widget.
         */
        btnSetup: function() {

            // Chevron hide/show body
            var that = this;
            $('#' + this.id + ' .hidebody').click(function(evt) {
                console.log("hide/unhide body");
                if ($('#' + that.id + ' .panel-body').hasClass('hidden')) {
                    // it's hidden, unhide
                    that.showBody(evt);
                }
                else {
                    // hide
                    that.hideBody(evt);
                }
            });

            // Ask bootstrap to scan all the buttons in the widget to turn
            // on popover menus
            $('#' + this.id + ' .btn').popover({
                delay: 1000,
                animation: true,
                placement: "auto",
                trigger: "hover",
                container: 'body'
            });

        },
        /**
         * User options are available in this property for reference by your
         * methods. If any change is made on these options, please call
         * saveOptionsLocalStorage()
         */
        options: null,
        /**
         * Call this method on init to setup the UI by reading the user's
         * stored settings from localStorage and then adjust the UI to reflect
         * what the user wants.
         */
        setupUiFromLocalStorage: function() {

            // Read vals from localStorage. Make sure to use a unique
            // key specific to this widget so as not to overwrite other
            // widgets' options. By using this.id as the prefix of the
            // key we're safe that this will be unique.

            // Feel free to add your own keys inside the options 
            // object for your own items

            var options = localStorage.getItem(this.id + '-options');

            if (options) {
                options = $.parseJSON(options);
                console.log("just evaled options: ", options);
            }
            else {
                options = {
                    showBody: true,
                    tabShowing: 1,
                    customParam1: null,
                    customParam2: 1.0
                };
            }

            this.options = options;
            console.log("options:", options);

            // show/hide body
            if (options.showBody) {
                this.showBody();
            }
            else {
                this.hideBody();
            }

        },
        /**
         * When a user changes a value that is stored as an option setting, you
         * should call this method immediately so that on next load the value
         * is correctly set.
         */
        saveOptionsLocalStorage: function() {
            // You can add your own values to this.options to store them
            // along with some of the normal stuff like showBody
            var options = this.options;

            var optionsStr = JSON.stringify(options);
            console.log("saving options:", options, "json.stringify:", optionsStr);
            // store settings to localStorage
            localStorage.setItem(this.id + '-options', optionsStr);
        },
        /**
         * Show the body of the panel.
         * @param {jquery_event} evt - If you pass the event parameter in, we 
         * know it was clicked by the user and thus we store it for the next 
         * load so we can reset the user's preference. If you don't pass this 
         * value in we don't store the preference because it was likely code 
         * that sent in the param.
         */
        showBody: function(evt) {
            $('#' + this.id + ' .panel-body').removeClass('hidden');
            $('#' + this.id + ' .panel-footer').removeClass('hidden');
            $('#' + this.id + ' .hidebody span').addClass('glyphicon-chevron-up');
            $('#' + this.id + ' .hidebody span').removeClass('glyphicon-chevron-down');
            if (!(evt == null)) {
                this.options.showBody = true;
                this.saveOptionsLocalStorage();
            }
            $(window).trigger("resize");
        },
        /**
         * Hide the body of the panel.
         * @param {jquery_event} evt - If you pass the event parameter in, we 
         * know it was clicked by the user and thus we store it for the next 
         * load so we can reset the user's preference. If you don't pass this 
         * value in we don't store the preference because it was likely code 
         * that sent in the param.
         */
        hideBody: function(evt) {
            $('#' + this.id + ' .panel-body').addClass('hidden');
            $('#' + this.id + ' .panel-footer').addClass('hidden');
            $('#' + this.id + ' .hidebody span').removeClass('glyphicon-chevron-up');
            $('#' + this.id + ' .hidebody span').addClass('glyphicon-chevron-down');
            if (!(evt == null)) {
                this.options.showBody = false;
                this.saveOptionsLocalStorage();
            }
            $(window).trigger("resize");
        },
        forkSetup: function () {
            var topCssSelector = '#' + this.id; //com-chilipeppr-widget-tinyg';

            //$(topCssSelector + ' .fork').prop('href', this.fiddleurl);
            //$(topCssSelector + ' .standalone').prop('href', this.url);
            //$(topCssSelector + ' .fork-name').html(this.id);
            $(topCssSelector + ' .panel-title').popover({
                title: this.name,
                content: this.desc,
                html: true,
                delay: 200,
                animation: true,
                trigger: 'hover',
                placement: 'auto'
            });

            var that = this;
            chilipeppr.load("http://fiddle.jshell.net/chilipeppr/zMbL9/show/light/", function () {
                require(['inline:com-chilipeppr-elem-pubsubviewer'], function (pubsubviewer) {
                    pubsubviewer.attachTo($(topCssSelector + ' .panel-heading .dropdown-menu'), that);
                });
            });

        },
    }
});