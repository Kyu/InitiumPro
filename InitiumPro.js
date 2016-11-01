// ==UserScript==
// @name         InitiumPro
// @namespace    https://github.com/spfiredrake/InitiumPro
// @version      0.7.9
// @updateURL    https://raw.githubusercontent.com/spfiredrake/InitiumPro/master/InitiumPro.js
// @downloadURL  https://raw.githubusercontent.com/spfiredrake/InitiumPro/master/InitiumPro.js
// @supportURL   https://github.com/spfiredrake/InitiumPro
// @match        https://www.playinitium.com/*
// @match        http://www.playinitium.com/*
// @exclude      https://www.playinitium.com/admin/*
// @exclude      http://www.playinitium.com/admin/*
// @grant        none
// @require     https://raw.githubusercontent.com/SPFiredrake/InitiumPro/master/grant-none-shim.js
// ==/UserScript==
/* jshint -W097 */

'use strict';
var $=window.jQuery;
window.loc={};
window.player={};
/*** INITIUM PRO OPTIONS ***/
var IPOptions = ({
    /*** AUTO ACTION SETTINGS ***/
              AUTO_GOLD: GM_getValue("ipAUTO_GOLD", true)+"" == "true",  //auto get gold after battles and when entering a room
              AUTO_FLEE: +GM_getValue("ipAUTO_FLEE", 0),    //percent of health to flee automatically. 0 turns it off
             AUTO_SWING: GM_getValue("ipAUTO_SWING", true)+"" == "true", //repeats attack after your initial attack
   AUTO_SWING_THRESHOLD: +GM_getValue("ipAUTO_SWING_THRESHOLD", 70), //percent of health at which to pause auto-swing
           COMBAT_DELAY: +GM_getValue("ipCOMBAT_DELAY", 500), //this delays combat site combat
         INSTANCE_DELAY: +GM_getValue("ipINSTANCE_DELAY", 1000), //this delays instance combat
              AUTO_REST: GM_getValue("ipAUTO_REST", true)+"" == "true",  //auto rest if injured and in restable area
      AUTO_LEAVE_FORGET: GM_getValue("ipAUTO_LEAVE_FORGET", false)+"" == "true", //automatically clicks 'Leave and Forget' after a battle
    AUTO_CONFIRM_POPUPS: GM_getValue("ipAUTO_CONFIRM_POPUPS", false)+"" == "true", //confirms popups like camp name so you can keep your fingers to the metal!
    AUTO_CONFIRM_PROMPT: GM_getValue("ipAUTO_CONFIRM_PROMPT", false)+"" == "true", //confirms popups like camp name so you can keep your fingers to the metal!
    /*** CUSTOM UI SETTINGS ***/
        ANCHOR_PARTYBOX: GM_getValue("ipANCHOR_PARTYBOX", true)+"" == "true", //indicates whether to reposition the party box to top-left corner
           HIDE_COUNTER: GM_getValue("ipHIDE_COUNTER", false)+"" == "true", //this will hide the attack counter
           HIDE_VERSION: GM_getValue("ipHIDE_VERSION", true)+"" == "true", //this will hide pro icon with the version number (you jerk)
            HIDE_NEARBY: GM_getValue("ipHIDE_NEARBY", true)+"" == "true", //this hides and prevents nearby items list from pulling every request
      PRELOAD_MERCHANTS: +GM_getValue("ipPRELOAD_MERCHANTS", 5), //this auto-loads the first specified number of merchants when pulling up the nearby stores list
    
    // ChangeSetting function. Sets the underlying property value and stores it in browser storage DB
    ChangeSetting: function(settingName, newValue)
    {
        this[settingName] = newValue;
        GM_setValue("ip"+settingName, newValue);
        return newValue;
    },
    
    // DefaultSettings function. Resets all the options to default values.
    DefaultSettings: function()
    {
        this.ChangeSetting("AUTO_GOLD", true);
        this.ChangeSetting("AUTO_REST", true);
        this.ChangeSetting("AUTO_SWING", true);
        this.ChangeSetting("AUTO_SWING_THRESHOLD", 70);
        this.ChangeSetting("AUTO_LEAVE_FORGET", false);
        this.ChangeSetting("AUTO_FLEE", 0);
        this.ChangeSetting("AUTO_CONFIRM_POPUPS", false);
        this.ChangeSetting("AUTO_CONFIRM_PROMPT", false);
        this.ChangeSetting("HIDE_VERSION", true);
        this.ChangeSetting("HIDE_NEARBY", true);
        this.ChangeSetting("COMBAT_DELAY", 500);
        this.ChangeSetting("INSTANCE_DELAY", 1000);
        this.ChangeSetting("ANCHOR_PARTYBOX", true);
    },
    
    // GetCacheObject function. Gets values from cache. Values are stored as JSON strings, and parsed when pulled. Try/catch to ignore errors and return default vals.
    GetCacheObject: function(keyName, defaultVal)
    {
        var cacheObject = GM_getValue("ip_Cache"+keyName);
        if(typeof cacheObject === "undefined" || cacheObject === null || cacheObject === "") return defaultVal;
        try{
            return JSON.parse(cacheObject);
        }
        catch (ex){
            console.log("Error encountered parsing object from cache! " + ex);
            return defaultVal;
        }
    },
    
    // SaveCacheObject function. Saves the object to cache as a JSON string, given the specified key
    SaveCacheObject: function(keyName, saveObj)
    {
        if(typeof saveObj === "undefined" || saveObj === null) return;
        GM_setValue("ip_Cache"+keyName, JSON.stringify(saveObj));
    }
});

var Counter = function(id, storeVals){
    var _obj = {};
    function init(){
        _obj = JSON.parse(GM_getValue("ipCnt" + id) || 0);
        if(typeof _obj === "number") _obj = ({counter:_obj, data:storeVals});
        if(typeof _obj.data === "undefined") _obj.data = storeVals;
    }
    init();
    
    this.increment = function(){
        _obj.counter++;
        GM_setValue("ipCnt" + id, JSON.stringify(_obj));
        return _obj.counter;
    };
    
    this.decrement = function()
    {
        _obj.counter--;
        GM_setValue("ipCnt" + id, JSON.stringify(_obj));
        return _obj.counter;
    };
    
    this.reset = function() {
        _obj.counter = 0; _obj.data = storeVals;
        GM_setValue("ipCnt" + id, JSON.stringify(_obj));
        return _obj.counter;
    };
    
    this.current = function()
    {
        return _obj.counter;
    };
    
    this.getData = function()
    {
        return _obj.data;
    };
    
    return this;
};

var StatCalc = ({
    str:({mod:0.0009954,max:11,modmax:0.0012947,minmax:9,modin:0.0000014965}),
    dex:({mod:0.00057334,max:10,modmax:0.00072171,minmax:8,modin:0.0000007418493}),
    int:({mod:0.0001414791,max:10,modmax:0.000199425,minmax:8,modin:0.0000002897295}),
    GetMax: function(stat, initial, current, count)
    {
        var evalMax = function(statVals){
            var i, j, g, stats, thisInitial;
            j=statVals.mod;
			for (g=statVals.max; g>=statVals.minmax; g=g-0.01) {
                thisInitial=initial;
                for (i=1; i<=count; i++) {
                    stats=thisInitial+(g-thisInitial)*j;
                    thisInitial=stats;

                    if (((Math.round(stats*100))/100)==current && i==count) {
                        return g;
                    }
                }
                j=j+statVals.modin;
			}
            return NaN;
        };
        var evalMin = function(statVals){
            var i, j, g, stats, initStat;
            j=statVals.modmax;
			for (g=statVals.minmax; g<=statVals.max; g=g+0.01) {
                initStat=initial;
                for (i=1; i<=count; i++) {
                    stats=initStat+(g-initStat)*j;
                    initStat=stats;

                    if (((Math.round(stats*100))/100)==current && i==count) {
                        return g;
                    }
                }
                j=j-statVals.modin;
            }
            return NaN;
        };
        
        if(typeof stat === "string") stat = this[stat];
        if(stat && stat.mod && stat.max && stat.modmax && stat.minmax && stat.modin)
        {
            var max = (evalMax(stat)+evalMin(stat))/2;
            return max.toFixed(2);
        }
        return NaN;
    }
});

function resetDefaultSettings()
{
    IPOptions.DefaultSettings();
    $("#InitiumProSettings input").each(function(i, e){
        var elem = $(e);
        var settingId = e.id;
        if(elem.is(":checkbox"))
            elem.prop("checked", IPOptions[settingId]);
        else
            elem.val(IPOptions[settingId]);
    });
}
/***************************/

//ajax queue
(function($) {
    var ajaxQueue = $({}); // jQuery on an empty object, we are going to use this as our Queue
    $.ajaxQueue = function( ajaxOpts ) {
        var jqXHR,dfd = $.Deferred(),promise = dfd.promise();
        ajaxQueue.queue( doRequest ); // queue our ajax request
        promise.abort = function( statusText ) { // add the abort method
            if ( jqXHR ) return jqXHR.abort( statusText ); // proxy abort to the jqXHR if it is active
            var queue = ajaxQueue.queue(),index = $.inArray( doRequest, queue ); // if there wasn't already a jqXHR we need to remove from queue
            if ( index > -1 ) queue.splice( index, 1 );
            dfd.rejectWith( ajaxOpts.context || ajaxOpts, [ promise, statusText, "" ] );// and then reject the deferred
            return promise;
        };
        function doRequest( next ) { jqXHR = $.ajax( ajaxOpts ).done( dfd.resolve ).fail( dfd.reject ).then( next, next );} // run the actual query
        return promise;
    };
    
    $.doDelay = function(time) {
        var defer = $.Deferred();
        setTimeout(function () { defer.resolve(); }, time || 0);
        return defer.promise();
    };
})($);

window.CANCEL_ACTION = false;
window.MERCHANT_CACHE = {};
window.ITEM_CACHE = {};
var krill=getThisPartyStarted();

//EXTRA HOTKEYS: C for create campsite, H for show hidden paths, Escape to cancel auto-actions
document.addEventListener('keyup', function(e) {
    if(e.srcElement.nodeName!='INPUT' && !e.ctrlKey) {
        if(e.key==="Escape") window.CANCEL_ACTION = true;
        if(e.key==="c" && loc.campable) window.createCampsite();
        if(e.key==="h") window.location.replace("/main.jsp?showHiddenPaths=true"); 
        if(e.code==="NumpadSubtract") window.deleteAndRecreateCharacter($("a[rel^=#profile]:eq(0)").text());
        if(e.code==="Slash" && e.shiftKey && $("#page-popup-root .main-item").length){
            window.promptPopup("Search Inventory", "Please input the inventory item", "", function(input){
                if(!input) return;
                var groups = {}; 
                // ContainsI is a custom selector specified in Initium's script.js.
                // Does a case insensitive "contains" search.
                $("#page-popup-root .page-popup:last .main-item")
                    .has(".main-item-name:ContainsI('"+input+"')")
                    .each(function(i,e) { 
                        var key = $(e).find(".main-item-name").text(); 
                        if(!groups[key]) groups[key] = 0; 
                        groups[key]++; 
                    }); 
                var cnt = 0; 
                $("#chat_input")
                    .val($(Object.getOwnPropertyNames(groups))
                         .map(function(i, key) { cnt+= groups[key]; return key + ": " + groups[key]; }).get().join("; ") + "; TOTAL: " + cnt);
            });
        }
    }}, false);

//add shop item stats to shop view
function loadShopItemDetails() {
    window.FLAG_LOADSHOPITEMS=true;
    var itemsLoaded = setInterval(function() {
        var saleItems = $(".saleItem").length;
        if(saleItems === 0) return;
        var numSold=$(".saleItem-sold").length;
        if (numSold) {
            //hide sold toggle
            if($("#soldItems-minimize").length) $("#soldItems-minimize").replaceWith("<a id='toggle-sold-items'>Hide "+numSold+" sold items</a>");
            else $(".main-item-filter").append("<div style='padding:15px 1px;float:right;'><a id='toggle-sold-items'>Hide "+numSold+" sold items</a></div>");
            
            $("#toggle-sold-items").bind("click",function() {
                var doHide = $(this).text().substring(0,4) === "Hide";
                $(this).text(doHide ? "Show "+numSold+" sold items":"Hide "+numSold+" sold items");
                $(".saleItem-sold").parents(".saleItem").toggleClass("hidden", doHide);
            });
        }

        var shopItems=$(".saleItem");
        for(var i=0;i<shopItems.length;i++) {
            var itemId=$(shopItems[i]).find(".clue").attr("rel").split("=")[1],
                itemImg=$(shopItems[i]).find(".clue").find("img").attr("src"),
                itemCost=$(shopItems[i]).find(".main-item > span:eq(0)").text(),
                itemBuyLink=$(shopItems[i]).find("a:eq(1)").attr("onclick");
            $(shopItems[i]).append("<div class='shop-item-stats table' id='shop-item-container"+itemId+"'><div class='loading'>Loading item stats... <img src='/javascript/images/wait.gif'></div></div>");

            if(window.ITEM_CACHE[itemId])
            {
                $("#shop-item-container"+itemId).html(window.ITEM_CACHE[itemId]);
            }
            else
            {
                $.ajaxQueue({
                    url: "viewitemmini.jsp?itemId="+itemId, type: "GET",
                    itemId: itemId,
                    itemImg: itemImg,
                    itemCost: itemCost,
                    itemBuyLink: itemBuyLink
                }).done(function(data) {
                    var itemStatLines=$(data).find("div:not(#item-comparisons) .item-popup-field");
                    var itemStats={};
                    for(var t=0;t<itemStatLines.length && $(itemStatLines[t]).text().indexOf(":")!=-1;t++) {
                        var att=$(itemStatLines[t]).text().split(":");
                        if(att[1]) itemStats[formatItemStats(att[0])]=att[1].substring(1).replace(/(\r\n|\n|\r)/gm,"");
                    }
                    $("#shop-item-container"+this.itemId).html("<div class='row' id='shop-item-row-"+this.itemId+"'>"+
                                                               "<div class='cell'><img src='"+this.itemImg+"'></div>"+
                                                               "<div class='cell' id='shop-item-"+this.itemId+"'></div>"+
                                                               (this.itemBuyLink ? 
                                                                ("<div class='cell shop-buy-button' onclick='"+this.itemBuyLink+"'>BUY<br/><span style='font-size:12px;'><img src='images/dogecoin-18px.png' class='small-dogecoin-icon' border='0/'>&nbsp;"+this.itemCost+"</span></div>") 
                                                                : "") +
                                                               "</div>");
                    for(var i=0;i<Object.keys(itemStats).length;i++) {
                        var statName=Object.keys(itemStats)[i];
                        var statValue=itemStats[Object.keys(itemStats)[i]];
                        $("#shop-item-"+this.itemId).append("<div><span>"+statName+":</span> <span>"+statValue+"</span></div>");
                    }
                    window.ITEM_CACHE[this.itemId] = $("#shop-item-container"+this.itemId).html();
                    return true;
                });
            }
        }
        window.FLAG_LOADSHOPITEMS=false;
        clearInterval(itemsLoaded);
    }, 1000);
}

//add list of carried products to shops overview
function loadLocalMerchantDetails() {
    window.FLAG_LOADSHOPS=true;
    var shopsLoaded = setInterval(function() {
        if ($('.main-merchant-container').length) {
            $(".main-merchant-container").on("click", "a.load-shop", function(event){
                var shopId = $(event.currentTarget).attr("ref");
                $(event.currentTarget).replaceWith("Loading store overview... <img src='/javascript/images/wait.gif'>");
                $.ajaxQueue({
                    url: "/odp/ajax_viewstore.jsp?characterId="+shopId+"&ajax=true",
                    shopId: shopId,
                }).done(function(data) {
                    var shopItemSummary="<hr>",items={},itemData=$(data).find(".clue");
                    for(var i=0;i<itemData.length;i++) { //get uniques
                        var itemName=$(itemData[i]).text(),itemPic=$(itemData[i]).find("img");
                        if(!items[itemName]) { items[itemName]=[{name:itemName,img:itemPic.attr("src")}]; }
                        else { items[itemName].push({name:itemName,img:itemPic.attr("src")});}
                    }
                    for(var item in items) { shopItemSummary+="<div class='shop-overview-item'><img src='"+items[item][0].img+"' width='18px'> ("+items[item].length+"x) <span style='color:#DDD;'>"+items[item][0].name+"</span></div>"; }
                    $("#store-overview-"+this.shopId+" .shop-overview").html(shopItemSummary);
                    window.MERCHANT_CACHE[this.shopId] = shopItemSummary;
                });
            });
            var localMerchants=$(".main-merchant-container");
            for(var i=0;i<localMerchants.length;i++) {
                var charId=$(localMerchants[i]).find("a").attr("onclick").slice(10,-1);
                $(localMerchants[i]).append("<div class='merchant-inline-overview' id='store-overview-"+charId+"'><div class='shop-overview'><a class='load-shop' ref="+charId+">🔍</a></div></div>");
                
                if(window.MERCHANT_CACHE[charId])
                {
                    $("#store-overview-"+charId+" .shop-overview").html(window.MERCHANT_CACHE[charId]);
                }
                else
                {
                     if(i<IPOptions.PRELOAD_MERCHANTS)
                         $(".main-merchant-container a.load-shop[ref="+charId+"]").click();
                }
            }
            window.FLAG_LOADSHOPS=false;
            clearInterval(shopsLoaded);
        }
    }, 500);
}

// Alter the nearby list to match the rest of inventory screens
function loadNearby(selectPopupId)
{
    window.FLAG_LOADNEARBY=true;
    var nearbyLoaded = setInterval(function(){
        var popupRoot = $("#"+selectPopupId);
        if(popupRoot.length === 0) return;
        var left = popupRoot.find("#left");
        var right = popupRoot.find("#right");
        if(left.length === 0 || right.length === 0) return;
        if(left.find(".main-item").length === 0 && right.find(".main-item") === 0)
        {
            window.FLAG_LOADNEARBY=false;
            clearInterval(nearbyLoaded);
            return;
        }
        
        if(left.find(".main-item").length && popupRoot.is("[src*='ajax_moveitems.jsp?preset=location']"))
        {
            window.LocationID = left.find("a.move-left:first").map(function(i,e) { return $(e).attr("onclick").match(/moveItem\(event, (\d*), \"(\w*)\", (\d*)\)/)[3]; }).get(0);
        }
        
        displayBreadcrumb();
        left.addClass("selection-root").children().wrapAll("<div class='selection-list'></div>");
        right.addClass("selection-root").children().wrapAll("<div class='selection-list'></div>");
        
        popupRoot.find("h1").html("Transfer Items");
        left.find("a.move-left").html("&rarr;").removeClass("move-left").addClass("large-arrows").each(function(i, e) { $(e).next("div.main-item").addClass("left-items").append($(e)).wrapInner("<div class='main-item-container'></div>").prepend("<input type='checkbox'>"); });
        right.find("a.move-right").html("&larr;").removeClass("move-right").addClass("large-arrows").each(function(i, e) { $(e).next("div.main-item").addClass("right-items").append($(e)).wrapInner("<div class='main-item-container'></div>").prepend("<input type='checkbox'>"); });
        
        left.prepend("<div class='inventory-main-header'><h4>Your Inventory</h4>"+
                     "<div class='main-item-filter'><input class='main-item-filter-input' id='filter_left-items' type='text' placeholder='Filter inventory...'></div>"+
                     "<div class='inventory-main-commands'><div class='command-row'>"+
                     "<label class='command-cell' title='Marks all inventory items for batch operations.'><input type='checkbox' class='check-all'>Select All</label>"+
                     "<a class='command-cell right take-command' title='Moves all the items into the right location'>Move Selected</a>"+
                     "</div></div></div>");
        right.prepend("<div class='inventory-main-header'><h4>"+popupRoot.find(".header-bar .header-cell:last h5").text()+" Items</h4>"+
                     "<div class='main-item-filter'><input class='main-item-filter-input' id='filter_right-items' type='text' placeholder='Filter location...'></div>"+
                     "<div class='inventory-main-commands'><div class='command-row'>"+
                     "<label class='command-cell' title='Marks all inventory items for batch operations.'><input type='checkbox' class='check-all'>Select All</label>"+
                     "<a class='command-cell right take-command' title='Moves all the items into the right location'>Take Selected</a>"+
                     "</div></div></div>");
        
        popupRoot.on("click", ".take-command", function(event) {
            var selected = $(this).parents(".selection-root").find(".main-item").has("input:checkbox:visible:checked");
            $(this).html("<img src='javascript/images/wait.gif'>");
            if(selected.length)
            {
                var lastTake;
                selected.each(function(i,e){
                    var moveUrl = $(e).find("a.large-arrows").attr("onclick");
                    var matches = moveUrl.match(/moveItem\(event, (\d*), \"(\w*)\", (\d*)\)/);
                    var itemId = matches[1], entityType = matches[2], entityId = matches[3];
                    var url = "/ServletCharacterControl?type=moveItem&itemId="+itemId+
                        "&destinationKey="+entityType+"_"+entityId+
                        "&v="+window.verifyCode+"&ajax=true&v="+window.verifyCode+"&_="+window.clientTime;
                    lastTake = $.ajaxQueue({url: url}).done($.doDelay(150));
                });
                if(lastTake)
                    lastTake.done(function() { $(".page-popup-Reload").click(); });
            }
        });
        
        window.FLAG_LOADNEARBY=false;
        clearInterval(nearbyLoaded);
    }, 500);
}

function keepPunching() {
    //for a more CircleMUD feel
    if(IPOptions.AUTO_CONFIRM_POPUPS) $(".popup_message_okay").click();
    
    if(IPOptions.AUTO_SWING) {
        if(loc.inCombat && window.urlParams.type==="attack" && window.player.health>IPOptions.AUTO_FLEE)
        {
            if(window.player.health<IPOptions.AUTO_SWING_THRESHOLD)
            {
                combatMessage("Your health is below the auto-swing threshold", "AUTO-SWING");
                return;
            }
            var toDelay = loc.type==="in combat!" ? IPOptions.COMBAT_DELAY : IPOptions.INSTANCE_DELAY;
            setTimeout(function() {
                if(window.CANCEL_ACTION) { showMessage("User cancelled auto swing.", "blue"); return; }
                if(window.urlParams.hand==="RightHand")  window.combatAttackWithRightHand();  else  window.combatAttackWithLeftHand();
                combatMessage("Attacking with "+window.urlParams.hand,"AUTO-SWING");
            }, toDelay);
        }
    }
    if(IPOptions.AUTO_FLEE>0) {
        if(loc.inCombat && window.player.health<=IPOptions.AUTO_FLEE) {
            combatMessage("Your health is below "+IPOptions.AUTO_FLEE+"%, trying to gtfo!","AUTO-FLEE");
            window.combatEscape();
        }
    }
    if(IPOptions.AUTO_REST && loc.rest===true && window.player.health<100) window.doRest();
    if(IPOptions.AUTO_LEAVE_FORGET && loc.type==="combat site") {
        if(IPOptions.AUTO_GOLD) {
            setTimeout(function() {
                if(window.CANCEL_ACTION) { showMessage("User cancelled auto leave/forget.", "blue"); return; }
                if(window.gotGold===true) {
                    $('a[onclick^="leaveAndForgetCombatSite"]').click();
                } else {
                    location.reload();//we didn't get gold, reload and try again.
                }
            }, 7000); //reload after a wait to make sure we got gold
        } else {
            $('a[onclick^="leaveAndForgetCombatSite"]').click();
        }
    }
}
//get hotkeys from buttons and put 'em on the map overlay
function putHotkeysOnMap() {
    var i=0,keys={},otherExits={},mapOverlayDirs=[],
        directions=$('body').find('a[onclick^="doGoto"]').not(".main-button-icon");
    for(i=0;i<directions.length;i++) {
        var shortcut=$(directions[i]).find(".shortcut-key").text(),
            path=$(directions[i]).attr("onclick").split(",")[1].replace(")","");
        if(shortcut) { //get all the dirs
            keys[parseInt(path)]=shortcut;
            otherExits[parseInt(path)]="&nbsp;<a onclick='"+$(directions[i]).attr("onclick")+"'>"+directions[i].text.replace("(","<span style='color:white;'>(").replace(")",")</span> ").replace("Head towards ","").replace("Go to ","")+"</a>&nbsp;";
        } else {
            mapOverlayDirs.push({path:parseInt(path),dir:directions[i]});
        }
    }
    for(i=0;i<mapOverlayDirs.length;i++) { //update dirs on map overlay
        $(mapOverlayDirs[i].dir).text((keys[mapOverlayDirs[i].path]||"")+" "+$(mapOverlayDirs[i].dir).text());
        delete otherExits[mapOverlayDirs[i].path]; //exit is on overlay, delete from otherExits
    }
    if(!$.isEmptyObject(otherExits)){
        $(".main-banner").append("<div id='other-exits'>"+((mapOverlayDirs.length>0)?"Other exits:":"Exits:")+"</div>");
        for(var exit in otherExits) $("#other-exits").append(otherExits[exit]);
    }
}

function getLocalGold() {
    var localCharsURL="/locationcharacterlist.jsp";

    window.player.gold = +$("#mainGoldIndicator").text().replace(/,/g, "");
    return $.ajaxQueue({
        url: localCharsURL,
    }).done(function(data) {
        var goldLinks = $(data).find("[onclick*='Doge']:not(:contains(' 0 gold'))");
        var dogeCollected=0,confirmedDoge=0,foundDoge;
        var battleGoldLink=$(".main-item-container").find('a[onclick*="collectDogecoin"]');
        if(goldLinks.length===0)return showMessage("No gold laying around.","gray");
        showMessage("<img src='"+window.IMG_GOLDCOIN+"' class='coin-tiny'>&nbsp;<span id='picking-gold-status'>Found gold! Picking it up.</span>","yellow");
        goldLinks.each(function(index) {
            var getGoldURL=$(this).attr("onclick").split('"')[1]+"&ajax=true&v="+window.verifyCode;
            var foundDoge=parseInt($(this).text().split(" ")[1]);
            dogeCollected+=foundDoge;
            $.ajaxQueue({url: getGoldURL,doge:this,foundDoge:foundDoge}).done(function(data) {
                confirmedDoge+=parseInt($(this.doge).text().split(" ")[1]);
                $(this.doge).html("Collected "+ foundDoge+" gold!");
                $(battleGoldLink).text("Collected "+ foundDoge+" gold!").css({"color":"yellow"});
                $("#picking-gold-status").text((confirmedDoge!==dogeCollected)?"Picking up "+confirmedDoge+" of "+dogeCollected+" gold found!":"Picked up "+dogeCollected+" gold!");
                console.info("Confirmed "+confirmedDoge+" of "+dogeCollected+" doge!");
                window.gotGold=true;
            });
        });
        //inform the user of our sweet gains!
        $("#mainGoldIndicator").text(Number(window.player.gold+dogeCollected).toLocaleString('en'));
        pulse("#mainGoldIndicator","yellow");
    });
}

function getLocalStuff() {
    var localItemsList,localItemsURL="/ajax_moveitems.jsp?preset=location";
    if($("#local-item-summary-container").length===0) 
    {
        $("#buttonbar-main").first().append("<div id='local-item-summary-container'><div id='local-item-summary-container'><h4 style='margin-top:20px;'>Items in area:&nbsp;<div id='reload-local-items-container'><a id='hide-inline-items'>↓</a><a id='reload-inline-items'>↻</a></div></h4><div class='blue-box-full-top'></div><div id='local-item-summary' class='div-table'><div><br/><br/><center><img src='javascript/images/wait.gif'></center><br/><br/></div></div><div class='blue-box-full-bottom'></div></div></div>"); //add summary box if not exists
        $("#hide-inline-items").html(IPOptions.HIDE_NEARBY ? "↓" : "↑");
        $("#local-item-summary").toggle(!IPOptions.HIDE_NEARBY);
        $("#hide-inline-items").bind("click", function() { 
            var hideNearby = IPOptions.ChangeSetting("HIDE_NEARBY", !IPOptions.HIDE_NEARBY); 
            $("#hide-inline-items").html(hideNearby ? "↓" : "↑");
            $("#local-item-summary").toggle(!hideNearby);
            if(Object.getOwnPropertyNames(window.localItems).length === 0) getLocalStuff();
        });
        $("#reload-inline-items").bind('click',function(){getLocalStuff();});
    }
    
    if(IPOptions.HIDE_NEARBY) return $.when("Done");
        $("#reload-inline-items").html("<img src='javascript/images/wait.gif'>");
    window.localItems={};//clear the obj
    return $.ajaxQueue({ url: localItemsURL })
        .done(function(data) {
        window.LocationID = $(data).find("#left a.move-left:first").map(function(i,e) { return $(e).attr("onclick").match(/moveItem\(event, (\d*), \"(\w*)\", (\d*)\)/)[3]; }).get(0);
        displayBreadcrump();
                var itemLines="",itemSubLines="",localItemSummary="",
                    locationName=$(data).find(".header-cell:nth-child(2) h5").text(),
                    localItemsList=$(data).find("#right a.clue"),
                    pickupLinks=$(data).find("#right a.move-right"),
                    items=localItemsList.map(function(index) {
                        var itemClass=$(localItemsList[index]).attr("class"),
                            rarity=itemClass.replace("clue","").replace("item-","").replace(" ",""),
                            viewLink=$(localItemsList[index]).attr("rel"),
                            item={id:viewLink.split("=")[1],
                                  name:$(localItemsList[index]).text(),
                                  image:$(localItemsList[index]).find("img").attr("src"),
                                  viewLink:viewLink,
                                  pickupLink:$(pickupLinks[index]).attr("onclick"),
                                  element:$(pickupLinks[index]),
                                  updateLocalCount:function(count) { $(".cell[item-name='"+this.name.encode()+"']:eq(0)").parent().find(".cell:eq(1) span").text(count);},
                                  class:itemClass,
                                  rarity:(rarity==="")?rarity="common":rarity=rarity,
                                  stats:{},
                                  statLine:"",
                                  delete:function() { return delete window.localItems[this.name][this.id]; },
                                  pickup:function(elem,remElem,countElem,last) {
                                      $(elem).html("<img src='/javascript/images/wait.gif'>");
                                      $.ajaxQueue({
                                          item:this.id,
                                          name:this.name,
                                          elem:elem, //element to update
                                          remElem:remElem, //element to remove on complete
                                          countElem:countElem, //to update the visible item count
                                          url: "/ServletCharacterControl?type=moveItem&itemId="+this.id+"&destinationKey=Character_"+window.characterId+"&v="+window.verifyCode+"&ajax=true&v="+window.verifyCode+"&_="+window.clientTime,
                                      }).done(function(data) {
                                          var resultMessage=$(data)[2]||null;
                                          if(resultMessage) {
                                              showMessage(resultMessage.innerText.split("', '")[1].replace("');",""),"orange");
                                          } else {
                                              var remaining = Object.keys(window.localItems[this.name]).length-1;
                                              window.localItems[this.name][this.item].updateLocalCount(remaining);
                                              window.localItems[this.name][this.item].delete();
                                              if(this.remElem && last) {
                                                  removeElement($(this.remElem));
                                                  getLocalStuff();
                                              }
                                          }
                                      });
                                  }
                                 };
                        if(!window.localItems[item.name]) window.localItems[item.name]={}; //create item
                        window.localItems[item.name][item.id]=item;
                        return item;
                    });

                //item overview list (one row per item type)
                for(var item in window.localItems) {//summary row for display on under main-dynamic-content-box
                    var firstItem=window.localItems[item][Object.keys(window.localItems[item])[0]]; //first item in obj
                    localItemSummary+=
                        "<div class='row'>"+
                        "<div class='cell localitem-summary-image'><img src='"+firstItem.image+ "'></div>"+
                        "<div class='cell localitem-summary-count'>(x <span>"+Object.keys(window.localItems[item]).length+"</span>) &nbsp;<img src='"+window.IMG_ARROW+"' style='width:11px;'>&nbsp;</div>"+
                        "<div class='cell localitem-summary-name show-item-sublist'><div class='main-item-name'><a onclick=''>"+firstItem.name+"</a></div></div>"+
                        "<div class='cell localitem-summary-view show-item-sublist' item-name='"+firstItem.name.encode()+"'><a onclick=''>(View all)</a></div>"+
                        "<div class='cell localitem-summary-take' item-name='"+firstItem.name.encode()+"'><a onclick=''>(Take all)</a></div>"+
                        "</div>";
                }
                //display items in area summary when user enters
                $("#local-item-summary").html(localItemSummary);
                $("#local-item-summary").css({"background-size":"100% "+((Object.keys(window.localItems).length*28)+100)+"px"});
                $('.show-item-sublist').bind('click',function(){ //bind the actions
                    var itemName=$(this).attr('item-name').decode(),firstItem=window.localItems[itemName][Object.keys(window.localItems[itemName])[0]], //first item in obj
                        itemSublist="<div style='font-size:20px;'><img src='"+firstItem.image+ "'> <span style='color:#DDD;'>x"+Object.keys(window.localItems[firstItem.name]).length+"</span> <span>"+firstItem.name+":</span><span style='float:right;font-size:27px;'><a class='close-item-sublist' onclick=''>X</a></span></div><hr>";
                    $(".itemSublist").remove();//remove all other item sublists
                    for(var item in window.localItems[firstItem.name]) { //item sublist popup
                        var itemData,subItem=window.localItems[firstItem.name][item];
                        itemSublist+="<div class='row'>"+
                            "<div class='cell "+subItem.class+" localitem-popup-image'><img src='"+subItem.image+ "'>&nbsp;</div>"+
                            "<div class='cell'><a class='"+subItem.class+" localitem-popup-name' rel='"+subItem.viewLink+"'>"+subItem.name+"</a><br/>"+
                            "<div class='inline-stats' id='inline-stats-"+item+"'>Loading item stats...<br/><img src='/javascript/images/wait.gif'></div></div>"+
                            "<div class='cell localitem-summary-view' style='vertical-align:middle;'>&nbsp;<a class='take-item' itemName='"+encodeURIComponent(subItem.name)+"' itemId='"+item+"'>(Take)</a></div></div>";
                    }
                    var itemSublistPopup='<div class="itemSublist table cluetip ui-widget ui-widget-content ui-cluetip clue-right-rounded cluetip-rounded ui-corner-all" style="position: absolute; margin-bottom:20px; width: 450px; left: '+($(this).position().left)+'px; z-index: 2000000; top: '+($(this).position().top+5)+'px; box-shadow: rgba(0, 0, 0, 0.498039) 1px 1px 6px;"><div class="cluetip-outer" style="position: relative; z-index: 2000000; overflow: visible; height: auto;"><div class="cluetip-inner ui-widget-content ui-cluetip-content">'+itemSublist+'</div></div><div class="cluetip-extra"></div><div class="cluetip-arrows ui-state-default" style="z-index: 2000001; top: -4px; display: block;"></div></div>';
                    $("body").append(itemSublistPopup);
                    $('.close-item-sublist').bind('click',function(){ $(".itemSublist").remove(); }); //close item sublist button closes all item sublists
                    $('.take-item').bind('click',function(){
                        window.localItems[$(this).attr("itemName").decode()][$(this).attr("itemId")].pickup(this,$(this).parent().parent(),null,true);
                    });
                    for(var itemId in window.localItems[firstItem.name]) ajaxItemStats(firstItem.name,itemId); //load stats in popup
                });
                $('.localitem-summary-take').bind('click',function(){ //take all
                    var z=Object.keys(window.localItems[$(this).attr('item-name').decode()]).length;
                    var itemName=$(this).attr('item-name').decode();
                    var itemCountDisplay=$(".cell[item-name='"+itemName.encode()+"']:eq(0)").parent().find(".cell:eq(1) span");
                    while(z--)  {
                        var itemId=Object.keys(window.localItems[$(this).attr('item-name').decode()])[z];
                        window.localItems[itemName][itemId].pickup(this,this,itemCountDisplay,(z===0)?true:false);
                    }
                });
                $("#reload-inline-items").html("↻");
           });
}

function ajaxItemStats(itemName,itemId) {
    $.ajax({itemName:itemName,
            itemId:itemId,
            url: window.localItems[itemName][itemId].viewLink, type: "GET",
            success: function(data) {
                var itemStatLines=$(data).find("div:not(#item-comparisons) .item-popup-field");
                for(var t=0;t<itemStatLines.length && $(itemStatLines[t]).text().indexOf(":")!=-1;t++) {
                    var att=$(itemStatLines[t]).text().split(":");
                    if(att[1]) window.localItems[this.itemName][this.itemId].stats[formatItemStats(att[0])]=att[1].substring(1).replace(/(\r\n|\n|\r)/gm,"");
                }
                var itemStats=window.localItems[this.itemName][this.itemId].stats;
                $("#inline-stats-"+this.itemId).html("<div class='inline-stats' id='inline-stats-"+this.itemId+"'></div>");
                for(var i=0;i<Object.keys(itemStats).length;i++) {
                    var statName=Object.keys(window.localItems[this.itemName][this.itemId].stats)[i];
                    var statValue=window.localItems[this.itemName][this.itemId].stats[statName];
                    $("#inline-stats-"+this.itemId).append("<div style='margin-left:10px;float:left;'><span style='color:orange;'>"+statName+":</span> <span style='color:white;'>"+statValue+"</span></div>");
                }
                return true;
            },
            error: function(e) {
                return false;
            }
           });
    return null;
}
function formatItemStats(thang) {
    return thang.replace(" - ","")
        .replace("Dexterity penalty","Dex")
        .replace("Strength requirement","Str")
        .replace("Weapon damage","Dmg")
        .replace("Critical chance","Crit")
        .replace("Critical hit multiplier","Crit mult")
        .replace("Damage Type","Dmg type")
        .replace("Block chance","Blk")
        .replace("Damage reduction","Dmg red")
        .replace("Block bludgeoning","Blk bldg")
        .replace("Block piercing","Blk prc")
        .replace("Block slashing","Blk slsh")
        .replace("Weight","Wt")
        .replace("Space","Spc")
        .replace("Durability","Dur");
}
//get location data
function getLocation() {
    if(typeof window.loc === "undefined") window.loc = {};
    window.loc.name=$(".header-location").text();
    window.loc.inCombat = $("title:contains('Combat')").length > 0;
    if(window.loc.inCombat) window.loc.mob = $(".header .header-location a").text().substring("Combat site: ".length);
    if(window.loc.name.indexOf("Combat site:")!==-1) { loc.type=loc.inCombat?"in combat!":"combat site"; } //if we're in a combat site, are we in combat or not? 
    else if(window.loc.name.indexOf("Camp:")!==-1) { loc.type="camp"; } //if we ain't fighting, are are we in a camp?
    else { window.loc.type=(window.biome)?window.biome.toLowerCase():"in a fight!"; } //if all else fails, i guess we're outside
    window.loc.campable=($("a[onclick^=createCampsite]").length>0)?true:false;
    window.loc.rest=($("a[onclick^=doRest]").length>0)?true:false;
    window.loc.breadcrumbs = IPOptions.GetCacheObject("breadcrumbs", {});
    return window.loc;
}

//get player stats and details
function getPlayerStats() {
    var hp=$("#hitpointsBar").text().split("/");
    var stats={}; $("#pro-stats span").each(function(i,e) { stats[$(e).parent().attr("rel")]=parseFloat($(e).text()); });
    if(typeof window.player === "undefined") window.player = {};
    window.window.player.characterId = window.characterId;
    window.player.verifyCode=window.verifyCode;
    window.player.name=$("a[rel^=#profile]:eq(0)").text();
    window.player.maxhp=parseInt(hp[1]);
    window.player.hp=parseInt(hp[0]);
    window.player.health=+((hp[0]/hp[1])*100).toFixed(2);
    window.player.stats=stats;
    window.player.gold=parseInt($("#mainGoldIndicator").text().replace(/,/g, ""));
    return window.player;
}

//display stats
function statDisplay() {
    var settingKeys = Object.keys(IPOptions);
    var settingsHtml = $(settingKeys).map(function(idx, name) {
        if(typeof IPOptions[name] === "function") return "";
        var sVal = IPOptions[name];
        // Sanitize the setting value by checking if it's a checkbox, and converting value to a boolean.
        var cb = sVal === "true" || sVal === "false";
        if(cb) sVal = sVal === "true";
        return "<div class='row'>" + 
            "<div class='cell'>" + name + "</div>" +
            "<div class='cell value'><input id='" + name + "' type='" + 
            (typeof sVal === "boolean" ? ("checkbox" + (sVal ? "' checked='checked" : "")) : "number' value='" + sVal) + "'></div>" +
            "</div>";
    }).get().join("");
    $(".header-stats a:last").before("<span class='hint' rel='#InitiumProSettings'><img id='gear_icon' src='"+window.IMG_GEAR+"' border='0'></span>");
    $(".header-stats").append(
        "<div class='hiddenTooltip' id='InitiumProSettings'>" + 
        "<div class='header'><h5>InitiumPro Settings</h5></div>" +
        "<div class='table'>" +
        settingsHtml +
        "</div><br/><center><a id='resetSettings'>Default Settings</a><center></div>");
    $("#resetSettings").on("click", resetDefaultSettings);
    // Have to attach at the body, since cluetip functionality is done after load.
    $("body").on("change", "#cluetip #InitiumProSettings input", function(event) {
        var element = $(event.currentTarget);
        var settingId = element.attr("id");
        // We have to modify the original hidden cluetip div as well, otherwise our UI settings won't stick
        if(element.is(":checkbox"))
        {
            // prop returns the correctly typed value of whatever property we're dealing with (in this case, bool)
            $("#InitiumProSettings #"+settingId).not(element).prop("checked", element.prop("checked"));
            IPOptions.ChangeSetting(settingId, element.prop("checked"));
        }
        else
        {
            // Only update the value if it's a valid number. Use + prefix to convert to number, which results in NaN if
            // it's not a valid integer value. Textboxes only "change" when focus is lost.
            if(!isNaN(+element.val()))
            {
                $("#InitiumProSettings #"+settingId).not(element).val(+element.val());
                IPOptions.ChangeSetting(settingId, +element.val());
            }
        }
    });
    var url = $(".main-banner .character-display-box:eq(0)").children().first().attr("rel");
    return $.ajaxQueue({url:url})
        .done(function(data) {
        //stat calculations
        var stats = $(data).find('.main-item-subnote');
        window.player.characterId = getUrlParams(url).characterId;
        window.player.equip = {};
        $(data).find(".main-item").each(function(i,e) {
            var slot = e.innerText.substring(0, e.innerText.indexOf(":")).toLowerCase();
            window.player.equip[slot] = $(e).find(".main-item-name").text();
        });
        window.player.maxStats = {};
        window.player.stats = {str:parseFloat($( stats[0] ).text().split(" ")[0]),dex:parseFloat($( stats[1] ).text().split(" ")[0]),int:parseFloat($( stats[2] ).text().split(" ")[0])};
        window.HITCOUNTER = new Counter(window.player.characterId, window.player.stats);
        $(".character-display-box:eq(0) > div:eq(1)").append("<div id='pro-stats' class='buff-pane'>"+
                                                             "<img src='"+window.IMG_STAT_SWORD+"'><div rel='str'><span class='stat'>"+window.player.stats.str+"</span></div>"+//str
                                                             "<img src='"+window.IMG_STAT_SHIELD+"'><div rel='dex'><span class='stat'>"+window.player.stats.dex+"</span></div>"+//def
                                                             "<img src='"+window.IMG_STAT_POTION+"'><div rel='int'><span class='stat'>"+window.player.stats.int+"</span></div>"+//int
                                                             "</a></div>");
        $('.header-stats a:nth-child(2)').children().html("Inv<span style=\"color:#AAA;margin-left:4px;margin-right:-5px;\">("+$( stats[3] ).text().split(" ")[0]+")</span> ");//carry
        $("#pro-stats").on("click", ".stat", function(event){
            $("#pro-stats").off("click", ".stat");
            var initStats = window.HITCOUNTER.getData();
            var curCount = window.HITCOUNTER.current();
            $("#pro-stats div").each(function(i,e){
                var statBlock = $(e); var stat = statBlock.attr("rel");
                window.player.maxStats[stat] = StatCalc.GetMax(stat, initStats[stat], window.player.stats[stat], curCount);
                if(statBlock.find(".max").length)
                    statBlock.find(".max").text("["+(isNaN(window.player.maxStats[stat]) ? window.player.stats[stat] : window.player.maxStats[stat]) +"]");
                else
                    statBlock.append("<span class='max'>["+(isNaN(window.player.maxStats[stat]) ? window.player.stats[stat] : window.player.maxStats[stat]) +"]</span>");
            });
        });
        
        //hit counter
        if(!IPOptions.HIDE_COUNTER){
            $(".main-banner").append("<div id='hitCounter'><span id='hitAmount'>Attacks: " + window.HITCOUNTER.current() + "</span><br/><span><a title='Decrement counter' id='decrement'>⊖</a>/<a title='Reset counter' id='reset'>⊗</a>/<a title='Increment counter' id='increment'>⊕</a></span></div>");
            $("#hitCounter").on("click", "a", function() { $("#hitAmount").html("Attacks: " + window.HITCOUNTER[this.id]()); });
        }
    });
}
//utility stuff
function getThisPartyStarted() {
    //flags
    window.FLAG_LOADSHOPS=false;
    window.FLAG_LOADSHOPITEMS=false;
    window.FLAG_LOADNEARBY=false;
    window.gotGold=false;
    window.localItems={};
    window.urlParams=getUrlParams();
    //init stuff
    updateCSS();
    var aj1 = statDisplay();
    var aj2 = getLocalGold();
    var aj3 = getLocalStuff();
    //mutation observer watches the dom
    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    //setting up observers
    observe(["#instanceRespawnWarning",".popup_confirm_yes","#popups","#page-popup-root"],{childList:true,characterData:true,attributes:true,subtree:true});
    //finish up when page ready
    $(document).ready(function () {
        $("body").on("click", "#cluetip #copyItemId", function(event) { 
            if($("#popupItemId").length)
            {
                var itemId = $("#popupItemId").val();
                var input = $("<input id='spCopy' style='left:50%;margin-left:-100px;position:fixed;top:48%;width:200px;z-index:-10000000;' value='"+itemId+"'>");
                $("body").append(input);
                var hiddenInput = $("#spCopy").get(0);
                hiddenInput.focus();
                hiddenInput.setSelectionRange(0, hiddenInput.value.length);
                document.execCommand("copy");
                input.remove();
            }
        });
        $("#page-popup-root").on("click", ".page-popup-Reload", function(event){
            var reloadPopup = $(event.target).parent().find(".page-popup:last");
            if(reloadPopup.find("div[src^='/odp/ajax_viewstore.jsp']").length > 0)
            {
                console.log("Reloading store items...");
                window.ITEM_CACHE = {};
                var contentUrlParams = getUrlParams(reloadPopup.find("div[src^='/odp/ajax_viewstore.jsp']").attr("src"));
                if(contentUrlParams.characterId) delete window.MERCHANT_CACHE[contentUrlParams.characterId];
                setTimeout(loadShopItemDetails, 500);
            }
            else if(reloadPopup.find("div[src^='locationmerchantlist.jsp']").length > 0){
                console.log("Reloading merchant list...");
                window.MERCHANT_CACHE = {};
                setTimeout(loadLocalMerchantDetails, 500);
            }
        });
        $.when(aj1, aj2, aj3).done(function(){
            window.player=getPlayerStats();
            (function() { var oldVersion = window.combatAttackWithLeftHand; window.combatAttackWithLeftHand = function() { if(typeof window.HITCOUNTER === "undefined") window.HITCOUNTER = new Counter(window.player.characterId, window.player.stats); window.HITCOUNTER.increment(); var result = oldVersion.apply(this, arguments); return result; };})();
            (function() { var oldVersion = window.combatAttackWithRightHand; window.combatAttackWithRightHand = function() { if(typeof window.HITCOUNTER === "undefined") window.HITCOUNTER = new Counter(window.player.characterId, window.player.stats); window.HITCOUNTER.increment(); var result = oldVersion.apply(this, arguments); return result; };})();
            (function() { var oldVersion = window.doExplore; window.doExplore = function() { IPOptions.SaveCacheObject("ExploreType", arguments[0] || true); var result = oldVersion.apply(this, arguments); return result; };})();
        loc=getLocation();
        updateLayouts();
        putHotkeysOnMap();
            setTimeout(keepPunching, 500);
        });
    });
    return true;
}

//do stuff when dom changes!
function mutationHandler (mutationRecords) {
    mutationRecords.forEach ( function (mutation) {
        if (typeof mutation.removedNodes == "object") {
            var removed = $(mutation.removedNodes);
            var added = $(mutation.addedNodes);
            if(IPOptions.AUTO_CONFIRM_PROMPT) $(added).find(".popup_confirm_yes").click();//auto-click confirm yes button
            //instance countdown
            var countDown=removed.text().split("arrive")[1];
            if(countDown) {
                var tm=countDown.split(" ");
                if(tm[2]=="less")tm[2]="< 1";
                tm[2].replace("seconds.","sec").replace("minutes.","min");
                var header_location="<div class='header-location above-page-popup'><a onclick=''>"+loc.name+":</a> <span style='color:red;'>"+tm[2]+" "+tm[3]+"</span></div>";
                $(".header-location").replaceWith(header_location);
            }
            // Item popups
            if($(mutation.target).is("a.cluetip-clicked[rel^='viewitemmini.jsp']") && $("#cluetip #copyItemId").length === 0)
            {
                // Give the popup time to load, since it doesn't seem to fire any other mutations other than the attribute on the clicked element
                var copyId = setInterval(function() {
                    if($("a.cluetip-clicked").length === 0  // They either closed the tooltip by clicking elsewhere
                       || $("#cluetip #copyItemId").length === 1) // Or we've already added it.
                    {
                        // Clear the interval and break out.
                        clearInterval(copyId);
                        return;
                    }
                    // If the popup hasn't finished loading, let it spin.
                    if($("#cluetip #popupItemId").length === 0) return;
                    var item = $("#cluetip #popupItemId");
                    var newElement = $("<a id='copyItemId' style='float:right;'>Copy ID</a>");
                    item.parent().find("a:contains('Share')").next("br").after(newElement);
                    clearInterval(copyId);
                }, 250);
            }
            if($(mutation.target).is("[src^='ajax_moveitems.jsp']") && added.length && window.FLAG_LOADNEARBY===false)
            {
                loadNearby(mutation.target.id);
            }
            //local merchants
            if($(mutation.target).is("[src^='locationmerchantlist.jsp']") && added.length && window.FLAG_LOADSHOPS===false) {
                loadLocalMerchantDetails();
            }
            //store item details
            if($(mutation.target).is("[src^='odp/ajax_managestore.jsp'],[src^='odp/ajax_viewstore.jsp']") && added.length && window.FLAG_LOADSHOPITEMS===false) {
                loadShopItemDetails();
            }
        }
    });
}
function observe(els,config) {
    window.myObserver = new MutationObserver (mutationHandler);
    return els.forEach(function(el) { $(el).each ( function () { window.myObserver.observe (this, config); }); } );
}
function updateLayouts() {
    //Class updates
    $("title").text($("title").text().replace("Initium", window.player.hp+"/"+window.player.maxhp));
    $(".main-buttonbox").find("br").remove().appendTo(".main-page-banner-image");
    $(".main-button").removeClass("main-button").each(function(i,e){
        var curButton = $(e);
        curButton.add(curButton.prev(".main-forgetPath")).add(curButton.prev(".main-button-icon")).wrapAll("<div class='main-button-half action-button'></div>");
    });
    // Party box.
    if(IPOptions.ANCHOR_PARTYBOX)
    {
        $(".main-splitScreen").has("h4:contains('Your party')").addClass("party-box").find(".main-splitScreen-2columns").addClass("party-row");
        $(".party-box > .boldbox > a").css("float", "").insertAfter(".party-box h4").after("<hr/>");
    }
    $(".main-buttonbox > center").wrap("<div class='main-button-half action-button'></div>");
    $(".main-button-icon").each(function (i, e) { $(e).next(".action-button").append($(e)); });
    // Add the W shortcut icon to the banner, above other exits.
    $(".main-button-icon[shortcut=87]").clone().addClass("search-nearby").removeClass("main-button-icon").appendTo(".main-banner");
    // Combat text comes after the main buttonbox. Problem is that there were floated elements before, so the text
    // can possibly occupy the space after the buttonbox. Do not allow that. Throw an empty div that clears floats after it.
    if(/combat.jsp/g.test(window.location.href))
        $(".main-buttonbox").append("<div style='clear:both;'></div>");
    //Add loc type to header. Set position absolute to let the rest of the header content overlap
    if(loc.type)$(".header-location").css("position","absolute").append("<span style='margin-left:12px;color:red;'>("+loc.type+")</span>");
    //show 'em that pro is active!
    if(!IPOptions.HIDE_VERSION)$(".header").append("<div id='initium-pro-version'><a href='https://github.com/SPFiredrake/InitiumPro' target='_blank'><img src='"+window.IMG_PRO+"'><span>v "+GM_info.script.version+"</span></a></div>");
    //the candle
    $(".header").append("<div id='light'><a onclick='$(\".banner-shadowbox\").toggleClass(\"torched\");'><img src='"+window.IMG_CANDLE+"'></a></div>");
    setTimeout(displayBreadcrumb, 1500);
    $("body").on("click", "a#ipBreadcrumb", function(event) {
        var bcLink = $(event.target);
        window.promptPopup("Set Breadcrumb", "Set breadcrumb text for location", bcLink.text(), function(newBC) { 
            newBC = newBC || "[None]";
            bcLink.html(newBC);
            loc.breadcrumbs[bcLink.attr("rel")]=newBC; 
            IPOptions.SaveCacheObject("breadcrumbs", loc.breadcrumbs);
        });
    });
}

function displayBreadcrumb()
{
    if(window.LocationID){
        var bc = loc.breadcrumbs[window.LocationID];
        showMessage("Breadcrumb: <a id='ipBreadcrumb' rel="+window.LocationID+">" + (bc || "[None]") + "</a>", "yellow", "crumb");
    }
    else{
        showMessage("Unable to determine LocationID. Make sure an item is on the ground and view nearby items again.", "yellow", "crumb");
    }
}

function updateCSS() {
    $("head").append("<style>"+
                     //style overrides
                     "#initium-pro-version { position:absolute;top:239px;margin-left:666px;z-index:99999999; } #initium-pro-version img { width:38%;filter:brightness(.75);transition:.5s ease; } #initium-pro-version img:hover { filter:brightness(1); } #initium-pro-version span { font-size:9px;margin-left:-21px;padding-top:5px; }"+
                     ".main-page p { margin-top:10px; }"+
                     "img { image-rendering: pixelated; }"+
                     "#instanceRespawnWarning { display:none!important; }"+
                     ".character-display-box { padding: 5px!important; }"+
                     ".main-buttonbox { text-align: center; }"+
                     ".main-button-half.action-button { width: 33.3333%;float:left;font-size:15px;display:inline-block }"+
                     ".main-button-half.action-button .main-forgetPath { margin-top:inherit; margin-right:inherit; }"+
                     ".main-button-half.action-button .main-button-icon { margin-top:0px; }"+
                     ".main-button-half.action-button .main-button-icon > img { max-width:80%; }"+
                     ".main-dynamic-content-box { padding-left:10px; }"+
                     "#instanceRespawnWarning { padding:10px; }"+
                     "#banner-loading-icon { opacity: 0.7; }"+
                     "#hide-inline-items { margin-right:30px; }"+
                     ".saleItem { margin-top:25px; }"+
                     ".saleItem .clue { margin-left:20px; }"+
                     ".saleItem .clue img { display:none; }"+
                     ".banner-shadowbox { transition:1s ease; }"+
                     "div[src]>div>br { display:none!important; }"+
                     ".search-nearby { position: absolute;top: 145px;left: 15px;text-shadow: 1px 1px 3px rgba(0, 0, 0, 1); }"+
                     ".chest-nearby { position: absolute;top: 100px;left: -5px;text-shadow: 1px 1px 3px rgba(0, 0, 0, .75); }"+
                     ".chest-nearby input[type=checkbox] { width:20px;height:20px; }"+
                     //InitiumPro custom elements
                     "div.main-splitScreen.party-box { position: absolute;top: 0px;left: 0px;width: 190px; }"+
                     "div.main-splitScreen.party-box .party-row { margin: 5px auto; }"+
                     "#gear_icon { min-width:18px;margin-right:6px; }" +
                     "#InitiumProSettings .header { margin-top:-15px;margin-bottom:15px; }" +
                     "#InitiumProSettings .footer .cell { vertical-align:bottom; }" +
                     "#InitiumProSettings .cell { width:45%; text-align:right;padding:3px;vertical-align:middle; }" +
                     "#InitiumProSettings .row { height:26px; }" +
                     "#InitiumProSettings .cell.value { text-align:left;padding-left:15px; }" +
                     "#InitiumProSettings input { width:50%; }" +
                     "#InitiumProSettings input[type=checkbox] { height:20px; }" +
                     ".hidden { display:none!important; }"+
                     ".torched { filter:brightness(2); }"+
                     "#light { transition:.2s ease;filter:brightness(.3);position:absolute;top:115px;margin-left:710px;z-index:99999999; }"+
                     "#light:hover { filter:brightness(1); }"+
                     "#toggle-sold-items { padding:15px 1px; }" +
                     ".merchant-inline-overview { padding:5px 0px 10px 5px; }"+
                     ".main-merchant-container .main-item { margin-top:25px; }"+
                     ".shop-overview { color:#999;margin-bottom:20px; }"+
                     ".shop-overview-item { float:left;font-size:13px;width:300px; }"+
                     "#other-exits { position:absolute;top:185px;left:15px;text-shadow:1px 1px 3px rgba(0, 0, 0, 1); }"+
                     ".inline-stats {font-size:11px;padding:0px 0px 5px 2px;width:300px; }"+
                     ".coin-tiny { width:12px; }"+
                     ".large-arrows { font-size: 32px; position: relative; right: 20px; float: right; }"+
                     ".table { display:table; } .row { display:table-row; } .cell { display:table-cell; }"+
                     "#local-item-summary { margin: 0px 0px 0px 10px;background:url(/images/ui/large-popup-middle.jpg);background-position-y:-50px;overflow:hidden; }"+
                     "#local-item-summary .cell { vertical-align:middle; }"+
                     "#local-item-summary .cell:first-of-type { text-align:center;padding:0px 13px 0px 3px; }"+
                     "#local-item-summary .cell:first-of-type img { height:24px;width:24px;transition: .2s ease; }"+
                     "#local-item-summary .cell:first-of-type img:hover { filter:brightness(1.2); }"+
                     "#local-item-summary .cell:nth-of-type(2) { color:#ddd;padding-right:10px;text-align:right;}"+
                     "#local-item-summary .cell:nth-of-type(3) { padding-right:18px;color:#FFF; }"+
                     "#local-item-summary .cell:nth-of-type(4) a { padding-right:13px;color:#e69500; }"+
                     "#local-item-summary .cell:nth-of-type(5) a { color:#666666; }"+
                     "#hitCounter { position:absolute; top:0px; right:300px;text-align:center; } #hitCounter > * { position:relative; display:inline-block; padding-right:4px; }"+
                     ".blue-box-full-top { margin: 15px 0px 0px 10px;height:10px;background:url(/images/ui/large-popup-top.jpg);background-position-y:-5px; }"+
                     ".blue-box-full-bottom { margin: 0px 0px 20px 10px;height:10px;background:url(/images/ui/large-popup-bottom.jpg); background-position-y:-5px; }"+
                     "#reload-local-items-container { height:25px;float:right;padding-right:5px; }"+
                     ".shop-item-stats { transition:.2s ease;border:1px solid #404040;min-height:70px;padding:10px;margin:1px;width:inherit;border-radius:10px;background:rgba(0,0,0,.2); }"+
                     ".shop-item-stats:hover { background:rgba(0,0,0,.15); }"+
                     ".shop-item-stats .cell { vertical-align:middle; }"+
                     ".shop-item-stats .cell > div { height:18px;margin-left:10px;float:left;color:white; }"+
                     ".shop-item-stats .cell > div > span:nth-child(odd) { color:orange; }"+
                     ".shop-item-stats .loading { width:100%;height:100%;vertical-align:middle;padding-top:27px;text-align:center; }"+
                     ".shop-item-stats .row > .cell:first-of-type) { width:80px;padding-right:5px; }"+
                     ".shop-item-stats .cell:not(.shop-buy-button) img { transition:.2s ease;filter:drop-shadow(4px 4px 6px rgba(0,0,0,.85));width:50px;padding:0px 10px; }"+
                     ".shop-item-stats .cell:not(.shop-buy-button) img:hover { filter:brightness(1.2) drop-shadow(1px 2px 8px rgba(0,0,0,1));transform: rotate(-5deg); }"+
                     ".shop-buy-button { transition: .2s ease;width:85px;text-align:center;border:1px solid rgba(173,173,173,0.1);border-radius:10px;background:rgba(255,255,255,0.1);cursor:pointer;}"+
                     ".shop-buy-button:hover { background:rgba(173,173,173,0.2); }"+
                     //stat box icons
                     "#pro-stats { width:160px; height:17px; font-size:10.5px; text-align:left; margin:-1px 0px 0px -5px; font-family:sans-serif; text-shadow:1px 1px 2px rgba(0, 0, 0, 1); }"+ 
                     "#pro-stats img { width:9px;height:9px;margin:3px 3px 0px 3px;vertical-align:top; border:1px solid #AAAAAA;background:rgba(0,0,0,.5);border-radius:4px;padding:2px;/*-webkit-filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));*/}"+
                     "#pro-stats span { padding:0px 4px 0px 0px; display:block; } #pro-stats div { display:inline-block;width:30px;vertical-align:middle; }"+
                     "</style>");
    //base64 images
    window.IMG_PRO="data:image/gif;base64,R0lGODlhZABDALMAAP+VRaqqp8zMzK2baezGXoB/eIx0M9/PpMmnR/9mAGaZmaCGQIXa+P///wAAAAAAACH5BAEAAA0ALAAAAABkAEMAAAT/sMlJq7046ybM/mAojqMQFGSqriwXCGgrz7T5xnSuh/a9/0BLrwALGn89U/HIlCWVuKa0FKgqfdMsKGnFar+Xq6lA9ILPrmvBUF6iwUrBeDBoR9/TuLwwINSheFpPAX1+doF5VS8mhYaAiEyDjQh/ZpBIiowDBwQECJQvlpc5XHycnggGiqKjTpknm52fC69ErTqljZ6qXba3NbW6CLS9Ar/AasILcqG+xy1isJ2oy2rGz9CLc9OzcszO2Cp6MJPD3mPX4eLa5Nyp7ODqVOeE7sSL8fI87PWy71Yw0ukTYcMboVOzMgV8JmAAC0kI/zUTeOsApXUAD/q7hy6cRT8k/7holMVrorqPIPf1iiWL4wmKregMWIBgmsMPuU55WnCgWLgBs2pOW6Yh17SdzNAlWMq0aVMAFZxKbYphqtMJHYYJtQlTglFu1UxanRp17FULAMwupSBgAc2jsmB+bUnPl1MAePOmXUvhrl68TKFW2Ps371LBXg1sPTpA4Fyk55w9vbCXb4OzgydfpnpBcwOUcD1dm9stskDPFConmIA5tebWfQNPAB26MWlzpssepsx5M1Pesn1b1p0AMe3aBVbagwcT9QTVrHu7Dg47+m4JBwxo387drapt/nh5yycc8XTL1RuoFpy+fAXFw7hrJ0NoDdBPwxSSd4+2N+yp7EkX2/91EyxgkwELIJggHQvcN5NEe3QlgXMSQDehgABe+FtnwWFlIH4IhrgTfsO4tJ+GVlVG3FMdDjici+Z5ZeAuIRrQCU0g1iKhdWqt5mKKHG5oAYUc4KiddzfiOICOH/hVGF4rAkZke0RyoJh8blEik09NtrjBWaoJiaKPQ3pZwQDaHaVVTQuUcSJxMWoAJlk/VmVmBQcYqF1N8OWn3Y5lEtilmMK1GGZgdwphYAEM6MldAQ0CCqcI/0ll3qFSbTETAWw4eqRbfkj6nF4i/DVYYWg9SeoGB/RhIzcKKjgjAqIOZEEANSEQQILbueUdqJ00ZqsIAcQVnwDZ+RrijHEN+0GDsZ4Um8o1QJEELFfOCnFAqzU11g0F1c7CLDe1HkPIffHdZwBM4Q4TWqjZNsASrG5JWC0B46pZbkz4bkcjoPfly9i+l/DJAAMK8AkCg++SO6zBCCscApZY3jQQnwooUIDEJChrsbOF4BftCjQ1GK+8n4B1AAtufTwssmhqF8DKLZgcbwQAOw==";
    window.IMG_GOLDCOIN="data:image/gif;base64,R0lGODlhDgAQAPIAAAAAAJRjAMaUAP/OAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJDAAFACH+FlJlc2l6ZWQgd2l0aCBlemdpZi5jb20ALAAAAAAOABAAAANEWFrQvsuRKUSLYI69K1AZp3VfQ2znEHRWiA7CSrrDGXNtWsMybIo83O91m+lsvZYrUJF5GLpA8sOg4SwYwPUCqTqoigQAIfkECQwABQAsAAAAAA4AEAAAAzdYqtCwkBEyxIsF0MEt1gMRVNcChiMJnWJXZlurmnHq0Zx8S7n9sr5VzRUBBUY7HGdWnDA/jkgCACH5BAUMAAEALAAAAAAOABAAAAIpjA9wuzCjWBsiygCpu9jVwWVf6G2XaEooeJas6pLay6xcUN64puPWUQAAIfkEBQwABQAsAgAAAAoAEAAAAy1YCqsOgxTBViRk0Ibzhh02AWA4lt15pRQqtutLxhIc1gzTaRXKP5Gfo9BzJAAAOw==";
    window.IMG_STAT_SWORD="data:image/gif;base64,R0lGODlhEAAQAKIHAO2dBJmpsMPN0Uxjb/vJYuSvT2h9hv///yH5BAEAAAcALAAAAAAQABAAAAM2eLrMAC2qByUh80lFQNebUlChIhiGV57GMBYbOwhHgUUyHQboXPKtwK8n3BFXx+GgWELpSocEADs=";
    window.IMG_STAT_SHIELD="data:image/gif;base64,R0lGODlhEAAQAKIEAJmZmf+NAP+fAP+PAP///wAAAAAAAAAAACH5BAEAAAQALAAAAAAQABAAAANDSLrQsNA5MWRTQOgdwtgPkW3aYJpBOJLnqZJlm2Iw1VY0fAuv3vKYVQx1yW1OnlCQNUgql6VOESIaOamRTOWJrU4XCQA7";
    window.IMG_STAT_POTION="data:image/gif;base64,R0lGODlhEAAQAKIFALvEyAOW3Sq49imd1GN6hf///wAAAAAAACH5BAEAAAUALAAAAAAQABAAAAM6WKpATmDJ1V6csrqL2YOdIgwkGQwdKaxB22LDyroBLAt0PcVybve038wlxAV3Nx8SSFwOX7vSQFlIAAA7";
    window.IMG_ARROW="data:image/gif;base64,R0lGODlhFAASAIABAPv+/v///yH5BAEAAAEALAAAAAAUABIAAAInjH+ggO2x1JtRTlfZbXnz6iEdlJXmiaYlqYLh6MGbfNGU+0ZhsjwFADs=";
    window.IMG_CANDLE="data:image/gif;base64,R0lGODlhHgA8AKIHAEEyMdmgZu7Fl99xJopvMP///6wyMv///yH5BAEAAAcALAAAAAAeADwAAAP/eLq8Zi3KqR69OOvNu3cfBoXSM5KNiUbq6gzD6RqwvNK1HRqCEOsfns8y6/1cCtgAuVAyGYBVbxoI4EjTXhUAw/oGhV6h6uwYwWJy91MdBwQFdyBUFdTjePr7ji/o7W9xU398g2x7gWE9hImGHnWFi4eAcIoCjFmSj4iZlx9Ub5mYdZodkJylHKeUqRugrJ4er6SxZlqotRyzobmumachncCfv4jBxYB/oFVzk8tVyresm6HMzK0Y14DW2A1kCtrW1hnfB+Hi0BEE6wQAdettcehkW+wK7OtcA+1TAP7t+gDgI7BgIAEYAqe0W6jPYIR/+Pzp2zfQHwaJGDNm1KCxCCPGDh4lUkgAADs=";
    window.IMG_BOXBUTTON="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAAB1CAYAAACGYelhAAAB20lEQVR4nO3UsW3CUBRG4Vu4dIUsKGKLBZAyQArGyAreALmlZgFKqtRMQJFBUqTIGE6RiALsSOg5MuacX/pKF0/3yBHOOeecc879sUVEnDQJzz03TNoyIlpNwrrnhkkzgOkwADgDgEsOYBE/Bz/LsuylKIpW92U+n1/J8/z18n4R8XRLAKfLqoqiaA+Hg+7M8Xi8slqtuv4KHwbwgAwAzgDgDABu9AC2261GtNlsrlRVZQAUBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAZwBwBgBnAHAGAGcAcAYAN3oA+/0+SdM0SjB6AKm6HqA0BgBnAHAGADdEAG+/H5zNZrPP3W7XDq2uaw2sLMuvy/tFxPstAXRt2VGV7tO654ZJM4DpMAA4A4AzALh/CcA555xzzj3IvgGv+knN2J8eTwAAAABJRU5ErkJggg==";
    window.IMG_GEAR="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAS9QTFRFAAAA////AAAAenx+AAAAAAAAAAAAAAAARkdIODk6dnh6b3Fydnh6iYuNiYuNh4mLiYuNfoCCbW9xaWpsa21vaWpsaWttgYOFdnh6iIqMbG5wcXN1fX+BfX+CcHJ0bnBycnV2gYOFbW9xb3FzcXN1dHZ4eHp8fH6AfX+BgIKEgoSGhYeJh4mLiYuNi42PjI6QjY+SjpCSjpGUj5GTj5GUkJKTkpSUl5iamZudmpyem52fnZ+hoKKkqKqsrK6vr7GysLKzs7O3tLa4tre6t7i7t7m8t7q8ubu+ury+vr/Cv8DDwsTFwsTGwsXGw8XHxMbIyMnMyszOzM7QztDSz8/Rz9DS0NHT0tTW1NXX1NbY19ja19nb2Nna2Nnb2Nrc293f3t/h3+Hj4ePk5+fp6+zuz42tNgAAACJ0Uk5TAAAHIiMkLzM9Tpytr6+wsrK6vb+/wMHr7e3v7+/v8f7+/jvKobsAAADfSURBVBgZBcE/T8JAHIDh93d3paHWlqgQkAQkcdBJFxa/v3FwchRNRBIHkrZgMMDR++PzCAA8RHkDQBT0zsHPPYwKQFM+Do/T3IYyn422VgzKT4qBbWbZulwp0Divsuov7H/T9bIJonDZ1Mqm2jp7c+ZA31+W3VC9V3Uvj6d8UJn45DdJ608dm7R3+gXD88WQRIlKRC8ahfkijkM/ONMXVa/AWNrmKi8gSLW3iGJ4PalTLTqtJ9McDE4W38vu/PXgj9IBw/bD72RsDj/Eww4Ekui4jfJJJzhEACAFC4D8A1YAXZU/EmOtAAAAAElFTkSuQmCC";
    window.IMG_CHEST="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAADAFBMVEUBAAD//sv//pn//mX//jP9/QD/y/7/y8v/y5n/y2X/zDP9ywD/mf7/mcv/mZn/mGX/mDP9mAD/Zf7/Zcv/ZZj/ZWX/ZTP9ZQD/M/7/M8v/M5j/M2X/MzP9MgD9AP39AMv9AJj9AGX9ADL9AADL///L/8vM/5nL/2XM/zPL/QDLy//MzMzLy5jMy2bLyzLMywDLmf/LmMvLmJjMmGbLmDLMmQDLZf/MZsvMZpjMZmbLZTLMZQDLM//LMsvLMpjLMmXLMjLMMgDLAP3MAMvMAJjMAGXMADLMAACZ//+Z/8uZ/5mY/2WZ/zOY/QCZzP+Yy8uYy5iZzGaYyzKZzACZmf+YmMuZmZmYmGWZmDOYlwCYZf+YZsyYZZiYZWWZZTOYZQCYM/+YMsuZM5iZM2WZMzOYMgCYAP2YAMyYAJeYAGWYADKYAABl//9l/8tl/5hl/2Vm/zNl/QBly/9mzMxmzJhmzGZlyzJmzABlmP9mmcxlmJhlmGVmmTNlmABlZf9mZsxlZZhmZmZlZTJmZQBlM/9lMstlM5llMmVlMjJmMgBlAP1lAMxlAJhmAGVmADJmAAAz//8z/8wz/5gz/2Yz/zMy/QAzzP8yy8syy5gyy2UyyzIzzAAzmf8ymMszmZkzmWUzmTMymAAzZv8yZcszZpkyZWUyZTIzZgAzM/8yMsszM5kyMmUzMzMyMQAyAP0yAMwyAJgyAGYyADEyAAAA/f0A/csA/ZgA/WUA/TIA/QAAy/0AzMwAzJkAzGUAzDMAzAAAmP0AmcwAmJgAmGUAmDIAmAAAZf0AZswAZZgAZmYAZjIAZgAAMv0AM8wAMpgAM2YAMjIAMgAAAP0AAMwAAJgAAGYAADLuAADcAAC6AACqAACIAAB2AABUAABEAAAiAAAQAAAA7gAA3AAAugAAqgAAiAAAdgAAVAAARAAAIgAAEAAAAO4AANwAALoAAKoAAIgAAHYAAFQAAEQAACIAABDu7u7d3d27u7uqqqqIiIh3d3dVVVVEREQiIiIREREAAAARpvBFAAAAAXRSTlMAQObYZgAAAPJJREFUOMuN0tEVwyAIBdD+OBLzMA/zZJ4eJ8mh+EDQpOkpv+9KEPN6/VeK+hETd6sno83itxXM9/ztxSxyI5UT8RBXoi3yZnH32sgEjWOS6yzaGpH155wkyHJJZqK25DQmWQRINUA8Zt1XNbp4Pq6hXTehKpPYecVOewFVHHJCI0dNkLETFo4KYLfEREkkawJutJGquUi+ERE8mwOyecZ0RTxewNhskYxXgKcIEnHuIUF0QYxliZ4OOAA+5D/MBKcRfNMBZhnNe4HTN2kXjcdEBCATTLIDkePQyJMUQKwZr8Sb3+Ii0fweJ3mOg/yKnVziD5Zc6DHlokWIAAAAAElFTkSuQmCC";
}
String.prototype.decode=function() { return decodeURIComponent(this).replace("%27","'"); };
String.prototype.encode=function() { return encodeURIComponent(this).replace(/'/g, "%27"); };
function removeElement(el) {$(el).fadeOut(300, function() { $(this).remove(); });}
function showMessage(msg,color,addClass) { addClass = addClass || ""; $(".show-message"+addClass).remove();$(".main-dynamic-content-box").first().append("<div class='show-message"+addClass+"' style=\"color:"+(color||"white")+";padding-top:15px;\">"+msg+"</div>");}
function combatMessage(msg,type) { return $(".main-page:eq(1) > p:eq(0)").append("<div style='margin:10px 0px;'><span style='color:orange;'>["+(type||"INFO")+"]</span>&nbsp;"+msg+"</div>"); }
function pulse(elName,color) { $(elName).css({"background-color":color}).fadeTo(400, 0.5, function() { $(elName).fadeTo(300, 1).css({"background-color":""}); }); }
function getUrlParams(urlString) { var params={};urlString=urlString||window.location.search;urlString.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str,key,value) { params[key] = value; });return params;}
