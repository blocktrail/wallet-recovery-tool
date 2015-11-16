'use strict';
angular.module('wallet-recovery.services', [])
    .service('FormHelper', function() {
        //a service that handles extra functionality on an ngForm

        this.setAllDirty = function(form){
            //sets form and all form controls to dirty state
            form.$setDirty();
            angular.forEach(form.$error, function(value, index){
                angular.forEach(value, function(value, index){
                    value.$dirty = true;
                    value.$pristine = false;
                });
            });
        };
        this.setAllPristine = function(form){
            //sets form and all form controls to pristine state
            form.$setPristine();
            angular.forEach(form.$error.required, function(value, index){
                value.$setPristine();
            });
        };
    })
;

angular.module('wallet-recovery.services')
    .service('RecoveryBackend', function($http, $q) {
        var self = this;

        var BASE_URL = window.APPCONFIG.RECOVERY_BACKEND;

        self.requestBlocktrailPublicKey = function(passwordEncryptedSecretMnemonic, keyIndex) {
            if (isNaN(keyIndex)) {
                keyIndex = 0;
            }
            return $http.post(BASE_URL + "/blocktrail-publickey", {encrypted_secret: passwordEncryptedSecretMnemonic, keyIndex: keyIndex});
        };

        self.requestRecoverySecret = function(email, identifier) {
            return $http.post(BASE_URL + "/recovery-secret", {email: email, identifier: identifier});
        };
    })
;
