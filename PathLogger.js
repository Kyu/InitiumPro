// ==UserScript==
// @name         PathLogger
// @namespace    https://github.com/spfiredrake/InitiumPro
// @version      0.0.1
// @updateURL    https://raw.githubusercontent.com/spfiredrake/InitiumPro/master/PathLogger.js
// @downloadURL  https://raw.githubusercontent.com/spfiredrake/InitiumPro/master/PathLogger.js
// @supportURL   https://github.com/spfiredrake/InitiumPro
// @match        https://www.playinitium.com/*
// @match        http://www.playinitium.com/*
// @exclude      https://www.playinitium.com/admin/*
// @exclude      http://www.playinitium.com/admin/*
// @grant        none
// @require     https://raw.githubusercontent.com/SPFiredrake/InitiumPro/master/grant-none-shim.js
// ==/UserScript==

(function() {
	'use strict';
    $(document).ready(function() {
		var LocationName = $("#locationName").text();
		window.LastPaths = JSON.parse(GM_getValue("LastPaths", JSON.stringify([])));
		(function() { 
			var oldVersion = window.doGoto; 
			window.doGoto = function() { 
				var pathId = arguments[1];
				window.LastPaths.splice(0,0,({Location:LocationName,PathID:pathId});
				window.LastPaths.splice(10);
				GM_setValue("LastPaths", JSON.stringify(window.LastPaths));
				var result = oldVersion.apply(this, arguments); 
				return result; 
			};
		})();
    });
})();
