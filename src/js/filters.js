'use strict';
angular.module('wallet-recovery.filters', [])
    .filter('toBtc', function() {
        return function(input) {
            input = parseInt(input);
            if (isNaN(input)) {
                input = 0;
            }
            return blocktrailSDK.toBTC(input);
        };
    })
    .filter('toSatoshi', function() {
        return function(input) {
            return blocktrailSDK.toSatoshi(input);
        };
    });
