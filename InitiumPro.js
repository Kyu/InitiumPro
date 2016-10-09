// ==UserScript==
// @name         InitiumPro
// @namespace    https://github.com/spfiredrake/InitiumPro
// @version      0.7.5
// @updateURL    https://raw.githubusercontent.com/spfiredrake/InitiumPro/master/InitiumPro.js
// @downloadURL  https://raw.githubusercontent.com/spfiredrake/InitiumPro/master/InitiumPro.js
// @supportURL   https://github.com/spfiredrake/InitiumPro
// @match        https://www.playinitium.com/*
// @match        http://www.playinitium.com/*
// @grant        none
// @require     https://gist.githubusercontent.com/arantius/3123124/raw/grant-none-shim.js
// ==/UserScript==
/* jshint -W097 */

'use strict';
var $=window.jQuery,loc={},player={};

/*** INITIUM PRO OPTIONS ***/
var IPOptions = ({
              AUTO_GOLD: GM_getValue("ipAUTO_GOLD", true)+"" == "true",  //auto get gold after battles and when entering a room
              AUTO_REST: GM_getValue("ipAUTO_REST", true)+"" == "true",  //auto rest if injured and in restable area
             AUTO_SWING: GM_getValue("ipAUTO_SWING", true)+"" == "true", //repeats attack after your initial attack
   AUTO_SWING_THRESHOLD: +GM_getValue("ipAUTO_SWING_THRESHOLD", 70), //percent of health at which to pause auto-swing   
      AUTO_LEAVE_FORGET: GM_getValue("ipAUTO_LEAVE_FORGET", false)+"" == "true", //automatically clicks 'Leave and Forget' after a battle
              AUTO_FLEE: +GM_getValue("ipAUTO_FLEE", 0),    //percent of health to flee automatically. 0 turns it off
    AUTO_CONFIRM_POPUPS: GM_getValue("ipAUTO_CONFIRM_POPUPS", false)+"" == "true", //confirms popups like camp name so you can keep your fingers to the metal!
           HIDE_VERSION: GM_getValue("ipHIDE_VERSION", true)+"" == "true", //this will hide pro icon with the version number (you jerk)
            HIDE_NEARBY: GM_getValue("ipHIDE_NEARBY", true)+"" == "true", //this hides and prevents nearby items list from pulling every request
           COMBAT_DELAY: +GM_getValue("ipCOMBAT_DELAY", 500), //this delays combat
         INSTANCE_DELAY: +GM_getValue("ipINSTANCE_DELAY", 1000), //this hides and prevents nearby items list from pulling every request
      PRELOAD_MERCHANTS: +GM_getValue("ipPRELOAD_MERCHANTS", 5), //this auto-loads the first specified number of merchants when pulling up the nearby stores list

    // ChangeSetting function. Sets the underlying property value and stores it in browser storage DB
    ChangeSetting: function(settingName, newValue)
    {
        this[settingName] = newValue;
        GM_setValue("ip"+settingName, newValue);
        return newValue;
    },
    
    DefaultSettings: function()
    {
        this.ChangeSetting("AUTO_GOLD", true);
        this.ChangeSetting("AUTO_REST", true);
        this.ChangeSetting("AUTO_SWING", true);
        this.ChangeSetting("AUTO_SWING_THRESHOLD", 70);
        this.ChangeSetting("AUTO_LEAVE_FORGET", false);
        this.ChangeSetting("AUTO_FLEE", 0);
        this.ChangeSetting("AUTO_CONFIRM_POPUPS", false);
        this.ChangeSetting("HIDE_VERSION", true);
        this.ChangeSetting("HIDE_NEARBY", true);
        this.ChangeSetting("COMBAT_DELAY", 500);
        this.ChangeSetting("INSTANCE_DELAY", 1000);
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
})($);

window.MERCHANT_CACHE = {};
window.ITEM_CACHE = {};
var krill=getThisPartyStarted();

//EXTRA HOTKEYS: C for create campsite, H for show hidden paths
document.addEventListener('keydown', function(e) {
    if(e.srcElement.nodeName!='INPUT') {
        if(e.key==="c") window.createCampsite();
        if(e.key==="h")window.location.replace("/main.jsp?showHiddenPaths=true"); }}, false);

//add shop item stats to shop view
function loadShopItemDetails() {
    window.FLAG_LOADSHOPITEMS=true;
    var itemsLoaded = setInterval(function() {
        var saleItems = $(".saleItem").length;
        if(saleItems == 0) return;
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
                $.ajax({
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

function keepPunching() {
    //for a more CircleMUD feel
    if(IPOptions.AUTO_SWING) {
        if((loc.type==="in combat!" || loc.type==="in a fight!") && player.health>IPOptions.AUTO_FLEE)
        {
            if(player.health<IPOptions.AUTO_SWING_THRESHOLD)
            {
                combatMessage("Your health is below the auto-swing threshold", "AUTO-SWING");
                return;
            }
            var toDelay = loc.type==="in combat!" ? IPOptions.COMBAT_DELAY : IPOptions.INSTANCE_DELAY;
            setTimeout(function() {
                if(window.urlParams.hand==="RightHand")  window.combatAttackWithRightHand();  else  window.combatAttackWithLeftHand();
                combatMessage("Attacking with "+window.urlParams.hand,"AUTO-SWING");
            }, toDelay);
        }
    }
    if(IPOptions.AUTO_FLEE>0) {
        if((loc.type==="in combat!" || loc.type==="in a fight!") && player.health<=IPOptions.AUTO_FLEE) {
            combatMessage("Your health is below "+IPOptions.AUTO_FLEE+"%, trying to gtfo!","AUTO-FLEE");
            window.combatEscape();
        }
    }
    if(IPOptions.AUTO_REST && loc.rest===true && player.health<100) window.doRest();
    if(IPOptions.AUTO_LEAVE_FORGET && loc.type==="combat site") {
        if(IPOptions.AUTO_GOLD) {
            setTimeout(function() {
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

    $.ajaxQueue({
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
        $("#mainGoldIndicator").text(Number(player.gold+dogeCollected).toLocaleString('en'));
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
    if(IPOptions.HIDE_NEARBY) return;
    $("#reload-inline-items").html("<img src='javascript/images/wait.gif'>");
    window.localItems={};//clear the obj
    $.ajax({ url: localItemsURL, type: "GET",
            success: function(data) {
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
            }
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
    var loc={name:$(".header-location").text()};
    if(loc.name.indexOf("Combat site:")!==-1) { loc.type=($(".character-display-box").length>1)?"in combat!":"combat site"; } //if we're in a combat site, are we in combat or not? 
    else if(loc.name.indexOf("Camp:")!==-1) { loc.type="camp"; } //if we ain't fighting, are are we in a camp?
    else { loc.type=(window.biome)?window.biome.toLowerCase():"in a fight!"; } //if all else fails, i guess we're outside
    loc.campable=($("a[onclick^=createCampsite]").length>0)?true:false;
    loc.rest=($("a[onclick^=doRest]").length>0)?true:false;
    return loc;
}

//get player stats and details
function getPlayerStats() {
    var hp=$("#hitpointsBar").text().split("/");
    return { charachterId:window.characterId,
            verifyCode:window.verifyCode,
            name:$("a[rel^=#profile]:eq(0)").text(),
            maxhp:parseInt(hp[1]),
            hp:parseInt(hp[0]),
            health:+((hp[0]/hp[1])*100).toFixed(2),
            gold:parseInt($("#mainGoldIndicator").text().replace(/,/g, ""))};
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
            (typeof sVal === "boolean" ? ("checkbox" + (sVal ? "' checked='checked" : "")) : "text' value='" + sVal) + "'></div>" +
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
    $.ajaxQueue({
        url: $(".character-display-box:eq(0)").children().first().attr("rel"),
    }).done(function(data) {
        var stats = $(data).find('.main-item-subnote');
        $(".character-display-box:eq(0) > div:eq(1)").append("<div id='pro-stats' class='buff-pane'>"+
                                                             "<img src='"+window.IMG_STAT_SWORD+"'><span>"+$( stats[0] ).text().split(" ")[0]+"</span>"+//str
                                                             "<img src='"+window.IMG_STAT_SHIELD+"'><span>"+$( stats[1] ).text().split(" ")[0]+"</span>"+//def
                                                             "<img src='"+window.IMG_STAT_POTION+"'><span>"+$( stats[2] ).text().split(" ")[0]+"</span>"+//int
                                                             "</a></div>");
        $('.header-stats a:nth-child(2)').children().html("Inv<span style=\"color:#AAA;margin-left:4px;margin-right:-5px;\">("+$( stats[3] ).text().split(" ")[0]+")</span> ");//carry

    });
}
//utility stuff
function getThisPartyStarted() {
    //flags
    window.FLAG_LOADSHOPS=false;
    window.FLAG_LOADSHOPITEMS=false;
    window.gotGold=false;
    window.localItems={};
    window.urlParams=getUrlParams();
    //init stuff
    updateCSS();
    statDisplay();
    getLocalGold();
    getLocalStuff();
    //mutation observer watches the dom
    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    //setting up observers
    observe(["#instanceRespawnWarning",".popup_confirm_yes","#popups","#page-popup-root"],{childList:true,characterData:true,attributes:true,subtree:true});
    //finish up when page ready
    $(document).ready(function () {
        $("#page-popup-root").on("click", ".page-popup-Reload", function(event){
            var reloadPopup = $(event.target).parent().find(".page-popup:last");
            console.log(reloadPopup);
            if(reloadPopup.find("div[src^='/odp/ajax_viewstore.jsp']").length > 0)
            {
                console.log("Reloading store items...");
                window.ITEM_CACHE = {};
                var contentUrlParams = getUrlParams(reloadPopup.find("div[src^='/odp/ajax_viewstore.jsp']").attr("src"));
                if(contentUrlParams["characterId"]) delete window.MERCHANT_CACHE[contentUrlParams["characterId"]];
                setTimeout(loadShopItemDetails, 500);
            }
            else if(reloadPopup.find("div[src^='locationmerchantlist.jsp']").length > 0){
                console.log("Reloading merchant list...");
                window.MERCHANT_CACHE = {};
                setTimeout(loadLocalMerchantDetails, 500);
            }
        });
        player=getPlayerStats();
        loc=getLocation();
        updateLayouts();
        putHotkeysOnMap();
        keepPunching();
    });
    return true;
}

//do stuff when dom changes!
function mutationHandler (mutationRecords) {
    mutationRecords.forEach ( function (mutation) {
        if (typeof mutation.removedNodes == "object") {
            var removed = $(mutation.removedNodes);
            var added = $(mutation.addedNodes);
            if(IPOptions.AUTO_CONFIRM_POPUPS) $(added).find(".popup_confirm_yes").click();//auto-click confirm yes button
            //instance countdown
            var countDown=removed.text().split("arrive")[1];
            if(countDown) {
                var tm=countDown.split(" ");
                if(tm[2]=="less")tm[2]="< 1";
                tm[2].replace("seconds.","sec").replace("minutes.","min");
                var header_location="<div class='header-location above-page-popup'><a onclick=''>"+loc.name+":</a> <span style='color:red;'>"+tm[2]+" "+tm[3]+"</span></div>";
                $(".header-location").replaceWith(header_location);
            }
            //local merchants
            if($('.main-merchant-container').length===0 && added.html() && window.FLAG_LOADSHOPS===false) {
                loadLocalMerchantDetails();
            }
            //store item details
            if($('.saleItem').length===0 && added.html() && window.FLAG_LOADSHOPITEMS===false) {
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
    $(".main-buttonbox").find("br").remove().appendTo(".main-page-banner-image");
    $(".main-button").removeClass("main-button").each(function(i,e){
        var curButton = $(e);
        curButton.add(curButton.prev(".main-forgetPath")).add(curButton.prev(".main-button-icon")).wrapAll("<div class='main-button-half action-button'></div>");
    });
    // Party box.
    $(".main-splitScreen").has("h4:contains('Your party')").addClass("party-box").find(".main-splitScreen-2columns").addClass("party-row");
    $(".party-box > .boldbox > a").css("float", "").insertAfter(".party-box h4").after("<hr/>");
    $(".main-buttonbox > center").wrap("<div class='main-button-half action-button'></div>");
    $(".main-button-icon").each(function (i, e) { $(e).next(".action-button").append($(e)); });
    //$("a[shortcut='69']").parent().append($([shortcut=87]"));
    $(".main-button-icon[shortcut=87]").clone().addClass("search-nearby").removeClass("main-button-icon").appendTo(".main-banner");
    // Combat text comes after the main buttonbox. Problem is that there were floated elements before, so the text
    // can possibly occupy the space after the buttonbox. Do not allow that. Throw an empty div that clears floats after it.
    if(/combat.jsp/g.test(window.location.href))
        $(".main-buttonbox").append("<div style='clear:both;'></div>");
    //Add loc type to header
    if(loc.type)$(".header-location").append("<span style='margin-left:12px;color:red;'>("+loc.type+")</span>");
    //show 'em that pro is active!
    if(!IPOptions.HIDE_VERSION)$(".header").append("<div id='initium-pro-version'><a href='https://github.com/hey-nails/InitiumPro' target='_blank'><img src='"+window.IMG_PRO+"'><span>v "+GM_info.script.version+"</span></a></div>");
    //the candle
    $(".header").append("<div id='light'><a onclick='$(\".banner-shadowbox\").toggleClass(\"torched\");'><img src='"+window.IMG_CANDLE+"'></a></div>");
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
                     "#pro-stats { width:160px; height:17px; font-size:10.5px; text-align:left; margin:-1px 0px 0px -5px; font-family:sans-serif; text-shadow:1px 1px 2px rgba(0, 0, 0, 1); } #pro-stats img { width:9px;height:9px;margin:3px 3px 0px 3px;vertical-align:sub; border:1px solid #AAAAAA;background:rgba(0,0,0,.5);border-radius:4px;padding:2px;/*-webkit-filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));*/} #pro-stats span { padding:0px 4px 0px 0px; }"+
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
}
String.prototype.decode=function() { return decodeURIComponent(this).replace("%27","'"); };
String.prototype.encode=function() { return encodeURIComponent(this).replace(/'/g, "%27"); };
function removeElement(el) {$(el).fadeOut(300, function() { $(this).remove(); });}
function showMessage(msg,color) { $(".show-message").remove();$(".main-dynamic-content-box").first().append("<div class='show-message' style=\"color:"+(color||"white")+";padding-top:15px;\">"+msg+"</div>");}
function combatMessage(msg,type) { return $(".main-page:eq(1) > p:eq(0)").append("<div style='margin:10px 0px;'><span style='color:orange;'>["+(type||"INFO")+"]</span>&nbsp;"+msg+"</div>"); }
function pulse(elName,color) { $(elName).css({"background-color":color}).fadeTo(400, 0.5, function() { $(elName).fadeTo(300, 1).css({"background-color":""}); }); }
function getUrlParams(urlString) { var params={};urlString=urlString||window.location.search;urlString.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str,key,value) { params[key] = value; });return params;}
