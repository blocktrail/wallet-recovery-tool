'use strict';
var app = angular.module('wallet-recovery', [
    'ui.bootstrap',
    'wallet-recovery.services'
]);
app.run(function($rootScope, $window, $log, $timeout) {
    $rootScope.logs = [];

    $rootScope.clearLogs = function() {
        $rootScope.logs = [];
    };

    //hijack the console to get output messages from the recovery script
    $window.console.log = function(message, extra) {
        $rootScope.$evalAsync(function() {
            $rootScope.logs.push(message);
        });
        $log.info(message);
    };
});
app.controller('walletRecoveryCtrl', function($scope, $modal, $rootScope, $log, $timeout, FormHelper) {
    $scope.templateList = {
        "welcome": "templates/welcome.html",
        "recover": "templates/wallet.recovery.html",
        "step_1": "templates/wallet.recovery.step-1.html",
        "step_2": "templates/wallet.recovery.step-2.html",
        "step_3": "templates/wallet.recovery.step-3.html",
        "step_4": "templates/wallet.recovery.step-4.html",
        "finish": "templates/wallet.recovery.finish.html"
    };
    $scope.mainTemplate = $scope.templateList['welcome'];
    $scope.subTemplate = "";
    $scope.networks = [
        {name: "Bitcoin", value: "btc", testnet: false},
        {name: "Bitcoin Testnet", value: "tbtc", testnet: true}
    ];
    $scope.dataServices = [
        {
            name: "BlockTrail.com",
            value: "blocktrail_bitcoin_service",
            apiKeyRequired: true,
            apiSecretRequired: false
        },
        {
            name: "Chain.so API",
            value: "sochain_bitcoin_service",
            apiKeyRequired: true,
            apiSecretRequired: false
        },
        {
            name: "BlockChain.info",
            value: "blockchain_bitcoin_service",
            apiKeyRequired: true,
            apiSecretRequired: false
        },
        {
            name: "Chain.com",
            value: "chain_bitcoin_service",
            apiKeyRequired: true,
            apiSecretRequired: false
        },
    ];

    $scope.backupData = {
        primaryMnemonic: null,
        backupMnemonic: null,
        passphrase: null,
        btPubkeys: [
            {pubkey: null, keyIndex: 0}
        ],
        destinationAddress: null
    };
    $scope.recoverySettings = {
        selectedNetwork: $scope.networks[0],
        network:    "btc",
        testnet:    false,
        sweepBatchSize: 100,
        dataService: null,
        apiKey: null,
        apiSecret: null
    };

    $scope.currentStep = 0;
    $scope.result = {};

    $scope.goHome = function(noPrompt) {
        if ($scope.result.working) {
            return false;
        }
        if (noPrompt) {
            $scope.resetAll();
            $scope.currentStep = 0;
            $scope.mainTemplate = $scope.templateList['welcome'];
            $scope.subTemplate = "";
            return;
        }
        //prompt user if they want to start again
        $modal.open({
            templateUrl: "templates/modal.confirm.html",
            controller: "confirmGoToHomeCtrl",
            size: 'sm'
        }).result.then(
            function() {
                //clear the input and go to welcome page
                $scope.resetAll();
                $scope.currentStep = 0;
                $scope.mainTemplate = $scope.templateList['welcome'];
                $scope.subTemplate = "";
            },
            function() {}
        );
    };
    $scope.prevStep = function(step, setStep) {
        if ($scope.result.working) {
            return false;
        }
        $scope.mainTemplate = $scope.templateList['recover'];
        $scope.subTemplate = $scope.templateList[step];
        if (setStep) {
            $scope.currentStep = setStep;
        } else {
            $scope.currentStep--;
        }
    };
    $scope.nextStep = function(step, inputForm) {
        if ($scope.result.working) {
            return false;
        }

        //validate input form
        if (inputForm && inputForm.$invalid) {
            FormHelper.setAllDirty(inputForm);
            //invalidate inner forms
            $scope.$broadcast('validateForms');
            return false;
        }

        //complete any secondary actions related to the current step
        switch ($scope.currentStep) {
            case 2:
                $scope.foundFunds = null;
                $scope.result = {};
                if (!$scope.initWalletSweeper()) {
                    return false;
                }
                break;
            case 3:
                $scope.signedTransaction = null;
                $scope.result = {};
                break;
            case 4:
                break;
            default:
                break;
        }

        //navigate to next step
        $scope.mainTemplate = $scope.templateList['recover'];
        $scope.subTemplate = $scope.templateList[step];
        $scope.currentStep++;
    };

    /**
     * displays an alert popup - much nicer than native alert()
     * @param messageData
     */
    $scope.alert = function(messageData) {
        $modal.open({
            templateUrl: "templates/modal.alert.html",
            controller: "alertMessageCtrl",
            resolve: {
                messageData: function() {return messageData;}
            },
            size: 'sm'
        });
    };

    /**
     * reset input
     */
    $scope.resetAll = function() {
        $scope.result = {};
        $scope.walletSweeper = null;
        $scope.foundFunds = null;
        $scope.signedTransaction = null;
        $scope.backupData = {
            primaryMnemonic: null,
            backupMnemonic: null,
            passphrase: null,
            btPubkeys: [
                {pubkey: null, keyIndex: 0}
            ],
            destinationAddress: null
        };
    };

    /**
     * add an aditional BlockTrail pubkey
     */
    $scope.addPubKey = function() {
        $scope.backupData.btPubkeys.push({pubkey: null, keyIndex: null});
    };

    $scope.scanPubKeyQR = function(btPubkey) {
        $modal.open({
            templateUrl: "templates/modal.qr-scan.html",
            controller: "scanQRCtrl",
            size: 'md'
        }).result.then(
            function(result) {
                angular.element('#QRScanner').html5_qrcode_stop();
                btPubkey.pubkey = result;
            },
            function(result) {
                angular.element('#QRScanner').html5_qrcode_stop();
            }
        );
    };

    /**
     * initialise an instance of the wallet sweeper
     * @returns {boolean}
     */
    $scope.initWalletSweeper = function() {
        $scope.result = {working: true};
        try {
            //cleanup input
            angular.forEach($scope.backupData.btPubkeys, function(btPubkey, index) {
                if (!btPubkey.pubkey) {
                    $scope.backupData.btPubkeys.splice(index, 1);
                }
            });

            //create an instance of the chosen bitcoin data service
            switch ($scope.recoverySettings.dataService.value) {
                case "blocktrail_bitcoin_service":
                    var bitcoinDataClient = new blocktrail.BlocktrailBitcoinService({
                        apiKey: $scope.recoverySettings.apiKey,
                        apiSecret: $scope.recoverySettings.apiSecret,
                        network: $scope.recoverySettings.network,
                        testnet: $scope.recoverySettings.testnet
                    });
                    break;
                default:
                    $scope.alert({subtitle: "Invalid bitcoin data service", message: "Only BlockTrail is currently supported"});
                    $scope.result = {working: false};
                    return false;
            }

            //create an instance of the wallet sweeper
            var sweeperOptions = {
                network: $scope.recoverySettings.network,
                testnet: $scope.recoverySettings.testnet,
                sweepBatchSize: $scope.recoverySettings.sweepBatchSize,
                logging: true
            };

            $scope.walletSweeper = new blocktrail.WalletSweeper(
                $scope.backupData.primaryMnemonic,
                $scope.backupData.passphrase,
                $scope.backupData.backupMnemonic,
                $scope.backupData.btPubkeys,
                bitcoinDataClient,
                sweeperOptions
            );
            $scope.result = {};
            return true;
        } catch (err) {
            $scope.result = {errors: [err.message]};
            $scope.alert({subtitle: "Please check your settings", message: "Error: " + err.message});
            $log.error("error encountered: ", err);
            return false;
        }
    };

    /**
     * begin fund discovering
     * @returns {boolean}
     */
    $scope.discoverFunds = function() {
        if ($scope.result.working) {
            return false;
        }

        $rootScope.clearLogs();
        console.log('Generating addresses. Please wait...');
        $log.debug($rootScope.logs[0]);
        $scope.result = {working: true, message: "discovering funds..."};
        //delay to allow UI to update
        $timeout(function() {
            $scope.walletSweeper.discoverWalletFunds().done(function(result) {
                $scope.$apply(function() {
                    $scope.result = {working: false, message: "Fund discovery complete"};
                    $scope.foundFunds = result;
                    $rootScope.clearLogs();
                    $log.debug(result);
                });
            }, function(err) {
                $scope.$apply(function() {
                    $scope.result = {working: false, message: "Fund discovery failed", errors: [err.message]};
                    $rootScope.clearLogs();
                    $log.error(err);
                });
            });
        }, 200);
    };

    /**
     * recover found funds into a destination address (just creates the signed transaction)
     * @param destinationAddress
     * @param inputForm
     * @returns {boolean}
     */
    $scope.recoverFunds = function(destinationAddress, inputForm) {
        if ($scope.result.working) {
            return false;
        }
        //validate input form
        if (inputForm && inputForm.$invalid) {
            FormHelper.setAllDirty(inputForm);
            return false;
        }

        $rootScope.clearLogs();
        $scope.result = {working: true, message: "generating transaction..."};
        try {
            $scope.walletSweeper.sweepWallet(destinationAddress).done(function(transaction) {
                $scope.$apply(function() {
                    $scope.result = {working: false, complete: true, message: "Transaction ready to send"};
                    $scope.signedTransaction = transaction;
                    $log.debug(transaction);

                    $scope.nextStep('finish');
                });
            }, function(err) {
                $scope.$apply(function() {
                    $scope.result = {working: false, complete: true, message: "Failed creating transaction", errors: [err.message]};
                    $log.error(err);
                });
            });
        } catch (err) {
            $scope.result = {working: false, complete: true, message: "Failed creating transaction", errors: [err.message]};
            $log.debug("error encountered: ", err);
        }
    };
});


/*--- Modal Controllers ---*/
app.controller('confirmGoToHomeCtrl', function($scope, $modalInstance) {
    $scope.modalTitle = "";
    $scope.subtitle = "Return to the start?";

    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
    $scope.ok = function() {
        $modalInstance.close();
    };
});

app.controller('alertMessageCtrl', function($scope, $modalInstance, messageData) {
    var defaultData = {
        modalTitle: "",
        title: "",
        subtitle: "",
        message: ""
    };
    messageData = angular.extend(defaultData, messageData);
    $scope.modalTitle = messageData.modalTitle;
    $scope.title = messageData.title;
    $scope.subtitle = messageData.subtitle;
    $scope.message = messageData.message;

    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
    $scope.ok = function() {
        $modalInstance.close();
    };
});

app.controller('scanQRCtrl', function($scope, $modalInstance, $timeout, $log) {
    $timeout(function() {
        angular.element('#QRScanner').html5_qrcode(function(data, stream) {
                // do something when code is read
                $modalInstance.close(data);
            },
            function(error, stream) {
                //show read errors
            },
            function(videoError, stream) {
                //the video stream could not be opened
                $modalInstance.dismiss(videoError);
            }
        );
    }, 1800);

    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
    $scope.ok = function() {
        $modalInstance.close(null);
    };

    $scope.$on("$destroy", function() {
        angular.element('#QRScanner').html5_qrcode_stop();
    });
});



/*-----Helper Controllers-----*/
app.controller('innerFormCtrl', function($scope, FormHelper) {
    //used in conjunction with ng-repeat and ng-form. Listens out for a call to validated the inner form
    $scope.$on('validateForms', function(event, value) {
        if($scope.innerForm.$invalid){
            FormHelper.setAllDirty($scope.innerForm);
            return false;
        }
    });
});

