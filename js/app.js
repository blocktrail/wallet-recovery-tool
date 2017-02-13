'use strict';

var bip39 = blocktrailSDK.bip39;
var CryptoJS = blocktrailSDK.CryptoJS;

var app = angular.module('wallet-recovery', [
    'ui.bootstrap',
    'wallet-recovery.filters',
    'wallet-recovery.services'
]);
app.run(["$rootScope", "$window", "$log", "$timeout", function($rootScope, $window, $log, $timeout) {
    $rootScope.logs = [];

    $rootScope.clearLogs = function() {
        $rootScope.logs = [];
    };

    //hijack the console to get output messages from the recovery script
    /*
    $window.console.log = function(message, extra) {
        $rootScope.$evalAsync(function() {
            $rootScope.logs.push(message);
        });
        $log.info(message);
    };
    */
}]);

app.controller('walletRecoveryCtrl', ["$scope", "$modal", "$rootScope", "$log", "$timeout", "FormHelper", "$http", "RecoveryBackend", function($scope, $modal, $rootScope, $log, $timeout, FormHelper, $http, RecoveryBackend) {
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
    $scope.forms = {};          //forms are used in directives with isolated scopes. need to keep them on this scope
    $scope.networks = [
        {name: "Bitcoin", value: "btc", testnet: false},
        {name: "Bitcoin Testnet", value: "tbtc", testnet: true}
    ];
    $scope.dataServices = [
        {
            name: "Blocktrail.com",
            value: "blocktrail_bitcoin_service",
            apiKeyRequired: false,
            apiSecretRequired: false,
            defaultApiKey: "MY_APIKEY",
            defaultApiSecret: "MY_APISECRET"
        },
        {
            name: "Bitpay Insight",
            value: "insight_bitcoin_service",
            apiKeyRequired: false,
            apiSecretRequired: false
        },
    ];

    /**
     * backup data from a Wallet V1 Backup PDF (Developer wallets)
     *
     * walletVersion:       the version number of the created wallet
     * primaryMnemonic:     the primary mnemonic, obtained from our backup pdf
     * primaryPassphrase:   our wallet passphrase, as used to unlock the wallet when sending transactions
     * backupMnemonic:      the backup mnemonic, obtained from our backup pdf
     * blocktrailKeys:      an array of the blocktrail pubkeys objects as {keyIndex: keyIndex, path: path, pubkey: pubkey}
     *                          keyIndex:   key index printed below each pubkey QR code on the backup pdf
     *                          path:       path printed below each pubkey QR code on the backup pdf
     *                          pubkey:     the contents of the QR code
     */
    $scope.backupDataV1 = {
        walletVersion:      1,
        primaryMnemonic:    null,
        primaryPassphrase:  null,
        backupMnemonic:     null,
        blocktrailKeys: [
            {keyIndex: 0, pubkey: null}
        ]
    };

    /**
     * backup data from a Wallet V2 Backup PDF (Consumer web and mobile wallets)
     *
     * walletVersion:               the version number of the created wallet
     * encryptedPrimaryMnemonic:    the "Encrypted Primary Seed" mnemonic, obtained from our backup pdf (page 1)
     * backupMnemonic:              the "backup seed" mnemonic, obtained from our backup pdf (page 1)
     *
     * passwordEncryptedSecretMnemonic: the "password encrypted secret" mnemonic, obtained from our backup pdf (page 2)
     *
     * password:                    our wallet password, as used to unlock the wallet when sending transactions
     * blocktrailKeys:              an array of the blocktrail pubkeys objects as {keyIndex: keyIndex, path: path, pubkey: pubkey}
     *                                  keyIndex:   key index printed below each pubkey QR code on the backup pdf (page 1)
     *                                  path:       path printed below each pubkey QR code on the backup pdf (page 1)
     *                                  pubkey:     the contents of the QR code (page 1)
     */
    $scope.backupDataV2 = {
        walletVersion:      2,
        backupMnemonic:     null,
        password:           null,
        encryptedPrimaryMnemonic:        null,
        encryptedRecoverySecretMnemonic: null,
        passwordEncryptedSecretMnemonic: null,
        blocktrailKeys: [
            {keyIndex: 0, pubkey: null}
        ]
    };

    /*
    $scope.backupData = {
        primaryMnemonic: null,
        backupMnemonic: null,
        passphrase: null,
        btPubkeys: [
            {pubkey: null, keyIndex: 0}
        ]
    };
    */
    $scope.recoverySettings = {
        selectedNetwork: $scope.networks[0],

        // these 2 are set from selectedNetwork
        network: "btc",
        testnet: false,

        sweepBatchSize: 150,
        dataService: $scope.dataServices[0],
        apiKey: null,
        apiSecret: null,

        destinationAddress: null
    };

    $scope.activeWalletVersion = {
        v1: false,
        v2: true
    };
    $scope.currentStep = 0;
    $scope.result = {};


    /*--------------------debugging---------*/
    /*
    $scope.backupDataV1 = {
        walletVersion:      1,
        primaryMnemonic:    "plug employ detail flee ethics junior cover surround aspect slender venue faith devote ice sword camp pepper baby decrease mushroom feel endless cactus group deposit achieve cheese fire alone size enlist sail labor pulp venture wet gas object fruit dutch industry lend glad category between hidden april network",
        primaryPassphrase:  "test",
        backupMnemonic:     "disorder husband build smart also alley uncle buffalo scene club reduce fringe assault inquiry damage gravity receive champion coffee awesome conduct two mouse wisdom super lend dice toe emotion video analyst worry charge sleep bless pride motion oxygen congress jewel push bag ozone approve enroll valley picnic flight",
        blocktrailKeys: [
            {
                keyIndex: 0,
                path:     "M/0'",
                pubkey:   'tpubD8UrAbbGkiJUnZY91vYMX2rj7zJRGH7snQ1g9H1waU39U74vE8HAfMCZdBByRJhVHq2B9X6uZcA2VaCJwnPN3zXLAPjETsfPGwAgWgEFvVk'
            },
            {
                keyIndex: 9999,
                path:     "M/9999'",
                pubkey:   'tpubD9q6vq9zdP3gbhpjs7n2TRvT7h4PeBhxg1Kv9jEc1XAss7429VenxvQTsJaZhzTk54gnsHRpgeeNMbm1QTag4Wf1QpQ3gy221GDuUCxgfeZ'
            }
        ]
    };
    $scope.backupDataV2 = {
        walletVersion:                   2,
        encryptedPrimaryMnemonic:        "fat arena brown skull echo quiz diesel beach gift olympic riot orphan sketch chief exchange height danger nasty clutch dune wing run drastic roast exist super toddler combine vault salute salad trap spider tenant draw million insane alley pelican spot alpha cheese version clog arm tomorrow slush plunge",
        backupMnemonic:                  "aerobic breeze taste swear whip service bone siege tackle grow drip few tray clay crumble glass athlete bronze office roast learn tuition exist symptom",
        passwordEncryptedSecretMnemonic: "fat arena brown skull echo quick damage toe later above jewel life void despair outer model annual various original stool answer vessel tired fragile visa summer step dash inform unit member social liberty valve tonight ocean pretty dial ability special angry like ancient unit shiver safe hospital ocean around poet album split they random decide ginger guilt mix evolve click avoid oven sad gospel worry chaos another lonely essence lucky health view",
        password:                        "test",

        blocktrailKeys: [
            {
                keyIndex: 0,
                path:     "M/0'",
                pubkey:   'xpub687DeMmb3SM2WUySJREg6F2vvRCQE1uSHcm5DY6HKyJe5oCczqavKHWUS8e5hDdx5bU4EWzFq9vSRSbi2rEYShdw6ectgbxAqmBgg8ZaqtC'
            }
        ]
    };

    $scope.recoverySettings.apiKey = "MY_APIKEY";
    $scope.recoverySettings.apiSecret = "MY_APISECRET";
    $scope.recoverySettings.sweepBatchSize = 5;
    $scope.recoverySettings.dataService = $scope.dataServices[0];
    //*/
    /*---------------------------------------*/

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
            case 1:
                if ($scope.activeWalletVersion.v2 && $scope.backupDataV2.blocktrailKeys.length == 0) {
                    $scope.alert({subtitle: "Missing Blocktrail Public Key", message: "At least one Blocktrail pub key is required"});
                    return false;
                } else if ($scope.activeWalletVersion.v2 && $scope.backupDataV2.blocktrailKeys.length == 0) {
                    $scope.alert({subtitle: "Missing Blocktrail Public Key", message: "At least one Blocktrail pub key is required"});
                    return false;
                }

                try {
                    var btPubKey = blocktrailSDK.bitcoin.HDNode.fromBase58($scope.backupDataV2.blocktrailKeys[0].pubkey);
                    if (btPubKey.network === blocktrailSDK.bitcoin.networks.testnet) {
                        $scope.recoverySettings.selectedNetwork = $scope.networks[1];
                        $scope.recoverySettings.network = 'btc';
                        $scope.recoverySettings.testnet = true;
                    }
                } catch (e) {
                    console.log(e);
                    $scope.alert({subtitle: "Invalid Blocktrail Public Key", message: "The provided Blocktrail pub key is invalid"});
                }

                break;
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
    $scope.alert = function(messageData, modalSize) {
        if (typeof modalSize == "undefined") {
            modalSize = "sm";
        }
        $modal.open({
            templateUrl: "templates/modal.alert.html",
            controller: "alertMessageCtrl",
            resolve: {
                messageData: function() {return messageData;}
            },
            size: modalSize
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
        $scope.firstAddress = null;
        $scope.backupDataV1 = {
            walletVersion:      1,
            primaryMnemonic:    null,
            primaryPassphrase:  null,
            backupMnemonic:     null,
            blocktrailKeys: [
                {keyIndex: 0, pubkey: null}
            ]
        };
        $scope.backupDataV2 = {
            walletVersion:      2,
            backupMnemonic:     null,
            password:           null,
            encryptedPrimaryMnemonic:        null,
            encryptedRecoverySecretMnemonic: null,
            passwordEncryptedSecretMnemonic: null,
            blocktrailKeys: [
                {keyIndex: 0, pubkey: null}
            ]
        };
        $scope.activeWalletVersion = {
            v1: false,
            v2: true
        };
        $scope.recoverySettings.destinationAddress = null;
    };

    /**
     * import a backup document and parse to get backup data
     */
    $scope.importBackup = function() {

        $modal.open({
            templateUrl: "templates/modal.import-backup.html",
            controller: "importBackupCtrl",
            size: 'md'
        }).result.then(
            function(importedData) {
                if (importedData.walletVersion == 2 || importedData.walletVersion == 3) {
                    $scope.backupDataV2 = angular.extend({}, importedData);
                    $scope.activeWalletVersion = {
                        v1: false,
                        v2: true
                    };
                } else {
                    $scope.backupDataV1 = angular.extend({}, importedData);
                    $scope.activeWalletVersion = {
                        v1: true,
                        v2: false
                    };
                }
            },
            function(err) {
                //import canceled
            }
        );
    };

    /**
     * use password recovery feature for v2 wallets
     */
    $scope.lostPassword = function() {
        $modal.open({
            templateUrl: "templates/modal.recover-password.html",
            controller: "recoverPasswordCtrl",
            size: 'md',
            resolve: {
                walletData: function() {
                    return {
                        walletIdentifier: $scope.backupDataV2.walletIdentifier,
                        encryptedRecoverySecretMnemonic: $scope.backupDataV2.encryptedRecoverySecretMnemonic
                    };
                }
            }
        }).result.then(
            function(result) {
                if (result) {
                    $scope.backupDataV2.password = null;
                    $scope.backupDataV2.encryptedRecoverySecretMnemonic = result.encryptedRecoverySecretMnemonic;
                    $scope.backupDataV2.recoverySecretDecryptionKey = result.recoverySecretDecryptionKey;
                }
            },
            function(err) {
                //password recovery canceled
            }
        );
    };

    /**
     * add an aditional Blocktrail pubkey
     */
    $scope.addPubKey = function(pubKeysArray) {
        pubKeysArray.push({pubkey: null, keyIndex: null});
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
        $scope.firstAddress = null;

        $scope.result = {working: true};
        try {
            //cleanup input
            angular.forEach($scope.backupDataV1.blocktrailKeys, function(btPubkey, index) {
                if (!btPubkey.pubkey) {
                    $scope.backupDataV1.blocktrailKeys.splice(index, 1);
                }
            });
            angular.forEach($scope.backupDataV2.blocktrailKeys, function(btPubkey, index) {
                if (!btPubkey.pubkey) {
                    $scope.backupDataV2.blocktrailKeys.splice(index, 1);
                }
            });

            var bitcoinDataClient;
            //create an instance of the chosen bitcoin data service
            switch ($scope.recoverySettings.dataService.value) {
                case "blocktrail_bitcoin_service":
                    bitcoinDataClient = new blocktrailSDK.BlocktrailBitcoinService({
                        apiKey: $scope.recoverySettings.apiKey || $scope.recoverySettings.dataService.defaultApiKey,
                        apiSecret: $scope.recoverySettings.apiSecret || $scope.recoverySettings.dataService.defaultApiSecret,
                        network: $scope.recoverySettings.network,
                        testnet: $scope.recoverySettings.testnet
                    });
                    break;
                case "insight_bitcoin_service":
                    bitcoinDataClient = new blocktrailSDK.InsightBitcoinService({
                        testnet: $scope.recoverySettings.testnet
                    });
                    break;
                default:
                    $scope.alert({subtitle: "Invalid bitcoin data service", message: "Only Blocktrail and Bitpay Insight are currently supported"});
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


            if ($scope.activeWalletVersion.v2) {
                $scope.walletSweeper = new blocktrailSDK.WalletSweeper(
                    angular.extend({}, $scope.backupDataV2),
                    bitcoinDataClient,
                    sweeperOptions
                );
            } else {
                $scope.walletSweeper = new blocktrailSDK.WalletSweeper(
                    angular.extend({}, $scope.backupDataV1),
                    bitcoinDataClient,
                    sweeperOptions
                );
            }
            $scope.result = {};
            return true;
        } catch (err) {
            if (err.message.search(/malformed utf-8 data/i) !== -1) {
                err.message += " (check your password)";
            }
            if (err.message.search(/invalid checksum/i) !== -1) {
                err.message += ". Either your mnemonics or blocktrail public key(s) are incorrect";
            }
            $scope.result = {errors: [err.message]};
            $scope.alert({subtitle: "Please check your backup data and settings", message: "An error was encountered: " + err.message}, "md");
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
        console.log('Generating addresses (this may take a while). Please wait...');
        $log.debug($rootScope.logs[0]);
        $scope.result = {working: true, message: "discovering funds...", progress: {message: 'Generating addresses (this may take a while). Please wait...'}};
        //delay to allow UI to update
        $timeout(function() {
            // generate /0 address for reference
            var keyIndex = Object.keys($scope.walletSweeper.blocktrailPublicKeys)[0];
            var blocktrailPubKey = $scope.walletSweeper.blocktrailPublicKeys[keyIndex];
            var path =  "M/" + keyIndex + "'/0/0";
            var firstAddr = $scope.walletSweeper.createAddress(path);

            $scope.firstAddress = firstAddr.address;

            // start discovery
            $scope.walletSweeper.discoverWalletFunds()
                .progress(function(progress) {
                    $scope.$apply(function() {
                        $scope.result.progress = progress;
                    });
                    console.log(progress);
                })
                .then(function(result) {
                    $scope.$apply(function() {

                        $scope.result = {working: false, message: "Fund discovery complete"};
                        $scope.foundFunds = result;
                        $rootScope.clearLogs();
                        $log.debug(result);
                    });
                })
                .catch(function(err) {
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

        //validate destination address
        var addr, err;
        try {
            addr = blocktrailSDK.bitcoin.Address.fromBase58Check(destinationAddress);
            if (addr.version !== $scope.walletSweeper.network.pubKeyHash && addr.version !== $scope.walletSweeper.network.scriptHash) {
                err = new blocktrailSDK.InvalidAddressError("Invalid network");
            }
        } catch (_err) {
            err = _err;
        }

        if (!addr || err) {
            $scope.alert({subtitle: "Invalid Address", message: "The destination address is not valid for this network"}, "md");
            $log.error("Invalid address [" + destinationAddress + "]" + (err ? " (" + err.message + ")" : ""));
            return false;
        }


        $rootScope.clearLogs();
        $scope.result = {working: true, message: "generating transaction...", progress: {message: 'generating transaction. please wait...'}};
        try {
            $scope.walletSweeper.sweepWallet(destinationAddress)
                .progress(function(progress) {
                    $scope.$apply(function() {
                        $scope.result.progress = progress;
                    });
                    console.log(progress);
                })
                .then(function(transaction) {
                    $scope.$apply(function() {
                        $scope.result = {working: false, complete: true, message: "Transaction ready to send"};
                        $scope.signedTransaction = transaction;
                        $log.debug(transaction);

                        $scope.nextStep('finish');
                    });
                })
                .catch(function(err) {
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


    $scope.sendTx = function(service, txData) {
        if ($scope.result.working) {
            return false;
        }
        $scope.result.working = true;

        switch (service) {
            case 'blocktrail':
                var bitcoinDataClient = new blocktrailSDK.BlocktrailBitcoinService({
                    apiKey: $scope.recoverySettings.apiKey || $scope.recoverySettings.dataService.defaultApiKey,
                    apiSecret: $scope.recoverySettings.apiSecret || $scope.recoverySettings.dataService.defaultApiSecret,
                    network: $scope.recoverySettings.network,
                    testnet: $scope.recoverySettings.testnet
                });
                bitcoinDataClient.client.sendRawTransaction(txData.hex)
                    .then(function(result) {
                        console.log(result);
                        //$scope.alert({subtitle: "Success", message: "Transaction successfully relayed via Blocktrail: " + result.hash}, 'md');
                        $scope.alert({subtitle: "Success - Transaction relayed by Blocktrail", message: "Your transaction hash is " + result.hash}, 'md');
                        $scope.result.working = false;
                    })
                    .catch(function(err) {
                        $scope.alert({subtitle: "Failed to send Transaction", message: "An error was returned: " + err});
                        $scope.result.working = false;
                    });
                break;
            case 'insight':
                var apiUrl = 'https://' + ($scope.recoverySettings.testnet ? 'test-' : '') + 'insight.bitpay.com/api/tx/send';
                var data = {rawtx: txData.hex};
                $http.post(apiUrl, data)
                    .then(function(result) {
                        console.log(result);
                        $scope.alert({subtitle: "Success - Transaction relayed by Insight", message: "Your transaction hash is " + result.data.txid}, 'md');
                        $scope.result.working = false;
                    })
                    .catch(function(result) {
                        console.error(result);
                        $scope.alert({subtitle: "Failed to send Transaction", message: result.data});
                        $scope.result.working = false;
                    });
                break;
            default:
                break;
        }
    };
}]);


/*--- Modal Controllers ---*/
app.controller('confirmGoToHomeCtrl', ["$scope", "$modalInstance", function($scope, $modalInstance) {
    $scope.modalTitle = "";
    $scope.subtitle = "Return to the start?";

    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
    $scope.ok = function() {
        $modalInstance.close();
    };
}]);

app.controller('alertMessageCtrl', ["$scope", "$modalInstance", "messageData", function($scope, $modalInstance, messageData) {
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
}]);

app.controller('recoverPasswordCtrl', ["$scope", "$modalInstance", "$http", "walletData", "RecoveryBackend", "FormHelper", "$timeout", function($scope, $modalInstance, $http, walletData, RecoveryBackend, FormHelper, $timeout) {
    $scope.input = {
        email: null,
        walletIdentifier: walletData.walletIdentifier || "blocktrail-wallet",
        manually: false,
        encryptedRecoverySecretMnemonic: walletData.encryptedRecoverySecretMnemonic,
        recoverySecretDecryptionKey: null
    };
    $scope.result = {working: false, message: "", emailSent: false, emailReceived: false};

    $scope.requestSecret = function(inputForm) {
        if ($scope.result.working) {
            return false;
        }

        //validate input form
        if (inputForm && inputForm.$invalid) {
            FormHelper.setAllDirty(inputForm);
            return false;
        }

        $scope.result.working = true;
        RecoveryBackend.requestRecoverySecret($scope.input.email, $scope.input.walletIdentifier)
            .then(function(r) {
                console.log(/* null= */r.data);
                $scope.result = {working: false, message: "an email has been sent to you with your decryption key", emailSent: true};

            }, function(e) {
                console.error(e.status, e.data);
                $scope.result = {working: false, message: "Unable to retrieve your decryption key: " + e.data, emailSent: false};
            });
    };

    $scope.useDecryptionKey = function(inputForm) {
        if ($scope.result.working) {
            return false;
        }

        //validate input form
        if (inputForm && inputForm.$invalid) {
            FormHelper.setAllDirty(inputForm);
            return false;
        }

        //test the input by trying to decrypt the secret
        $scope.result.working = true;
        $scope.result.message = "Decrypting secret...";

        try {
            var encryptedRecoverySecretMnemonic = $scope.input.encryptedRecoverySecretMnemonic.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
            var encrptedRecoverySecret = blocktrailSDK.convert(bip39.mnemonicToEntropy(encryptedRecoverySecretMnemonic), 'hex', 'base64');
            var decryptionKey = $scope.input.recoverySecretDecryptionKey.trim();
            var secret = CryptoJS.AES.decrypt(encrptedRecoverySecret, decryptionKey).toString(CryptoJS.enc.Utf8);

            if (!secret) {
                throw new Error("please check your input");
            }
        } catch(e) {
            $scope.result.working = false;
            $scope.result.message = "Unable to decrypt the recovery secret: " + e;
            return false;
        }

        //all good, return the input
        $scope.result.message = "Secret decrypted successfully";
        $timeout(function() {
            $scope.result.working = false;
            $modalInstance.close($scope.input);
        }, 500);
    };

    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
}]);

app.controller('scanQRCtrl', ["$scope", "$modalInstance", "$timeout", "$log", function($scope, $modalInstance, $timeout, $log) {
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
}]);

app.controller('importBackupCtrl', ["$scope", "$modalInstance", "$timeout", "$log", "$q", "RecoveryBackend", function($scope, $modalInstance, $timeout, $log, $q, RecoveryBackend) {
    $scope.fileSelected = false;
    $scope.backupFile = null;
    $scope.result = {working: false, message: ""};


    $scope.uploadFile = function(input) {
        $scope.$evalAsync(function() {
            $scope.result = {working: false, message: ""};
            $scope.walletVersion = null;
            $scope.blocktrailKeys = [];
            $scope.dataV1 = {
                walletVersion:      1,
                walletIdentifier:   "",
                primaryMnemonic:    "",
                //primaryPassphrase:  null,
                backupMnemonic:     "",
                blocktrailKeys: []
            };
            $scope.dataV2 = {
                walletVersion:      2,
                walletIdentifier:   "",
                backupMnemonic:     "",
                //password:           null,
                encryptedPrimaryMnemonic:        "",
                encryptedRecoverySecretMnemonic: "",
                passwordEncryptedSecretMnemonic: "",
                blocktrailKeys: []
            };

            if (input.files.length > 0) {
                var deferred = $q.defer();

                //file has been selected, load it
                $scope.backupFile = input.files[0];
                $scope.fileSelected = true;

                $scope.result = {working: true, message: "reading file: " + $scope.backupFile.name};

                console.log('file selected', $scope.backupFile, input.files, $scope.backupPdf);

                var fileReader = new FileReader();
                fileReader.onloadstart = function(event) {
                    console.log('started reading file', fileReader.readyState);
                };
                fileReader.onload = function(event) {
                    console.log("file loaded", event);
                    deferred.resolve(fileReader.result);
                };
                fileReader.onerror = function(event) {
                    console.error("file read error", fileReader.error);
                    deferred.reject(fileReader.error);
                };

                //load the file
                fileReader.readAsDataURL($scope.backupFile);

                deferred.promise
                    .then(function(fileData) {
                        $scope.result = {working: true, message: "processing backup file..."};
                        console.log('reading pdf');
                        return PDFJS.getDocument(fileData);
                    })
                    .then(function(pdf) {
                        //process each page of the pdf for text data
                        var total = pdf.numPages;
                        var promises = [];
                        for (var i = 1; i<=total; i++) {
                            console.log('parsing text for page ' + i);
                            //text content
                            promises.push(pdf.getPage(i).then(function(page) {
                                return $scope.parsePageText(page);
                            }));
                        }
                        return $q.all(promises).then(function() {
                            //pass on the pdf for further processing
                            return pdf;
                        });
                    })
                    .then(function(pdf) {
                        //process each page of the pdf for pubkeys
                        var total = pdf.numPages;
                        var promises = [];
                        for (var i = 1; i<=total; i++) {
                            console.log('parsing images for page ' + i);
                            //image content
                            promises.push(pdf.getPage(i).then(function(page) {
                                return $scope.parsePageImage(page);
                            }));
                        }
                        return $q.all(promises);
                    })
                    .then(function(allPageImages) {
                        //set the pubkey data decoded from the images
                        var pubKeyIndex = 0;
                        var promises = [];
                        allPageImages.forEach(function(pageImages, index) {
                            //first image of each page is always the blocktrail logo, other indexes correspond to qrcode decode attempts
                            pageImages.forEach(function(decodedData, index) {
                                if (index > 0) {
                                    if ($scope.walletVersion == 2) {
                                        $scope.dataV2.blocktrailKeys[pubKeyIndex].pubkey = decodedData;
                                        if (decodedData === null) {
                                            //the qrcode couldn't be decoded...try and request it from the server
                                            console.log('requesting blocktrail pubkey for ' + $scope.dataV2.blocktrailKeys[pubKeyIndex].keyIndex);
                                            promises.push($scope.requestWalletPubKey($scope.dataV2.blocktrailKeys[pubKeyIndex]));
                                        }
                                    } else {
                                        $scope.dataV1.blocktrailKeys[pubKeyIndex].pubkey = decodedData;
                                    }
                                    pubKeyIndex++;
                                }
                            });
                        });

                        return $q.all(promises).then(function(){
                            return true;
                        }, function(err){
                            //there was an error requesting one of the blocktrail pubkeys....continue anyway, the user will need to scan manually
                            console.error("ERROR requesting bt pubkey: ", err);
                            return false;
                        });
                    })
                    .then(function() {
                        console.log('complete');
                        console.log("wallet version: " + $scope.walletVersion);
                        console.log($scope.dataV1);
                        console.log($scope.dataV2);

                        if ($scope.walletVersion) {
                            var data = $scope.walletVersion == 2 ? $scope.dataV2 : $scope.dataV1;
                            $scope.result = {working: false, success: true, message: "Backup data found", data: data};
                        } else {
                            $scope.result = {working: false, message: "No backup data found."};
                        }
                        //reset the input
                        input.value = null;
                    })
                    .catch(function(err) {
                        //reset the input
                        console.error("failed to parse file: ", err);
                        input.value = null;
                        $scope.result = {working: false, message: "Could not process file."};
                    });

            } else {
                console.log('no change');
                $scope.backupFile = null;
                $scope.fileSelected = false;
            }
        });
    };

    /**
     * loops over page items and places them in relevant data fields
     *
     * @param page
     */
    $scope.parsePageText = function (page) {
        var dataKey = null;         //obj key to fill with next line of data
        var deferred = $q.defer();

        page.getTextContent()
            .then(function(textContent) {
                //loop over text content and act according to key phrases
                console.log("---------------------------------------------------");
                textContent.items.forEach(function(item, index) {
                    console.log(item.str);

                    //current line handlers: determin what to do with current line if anything special
                    if (item.str.search(/Backup Seed/i) !== -1) {
                        //end of "Encrypted Primary Seed" (v2)
                        dataKey = null;
                    } else if (item.str.search(/Encrypted Recovery Secret/i) !== -1) {
                        //end of "Backup Seed" (v2)
                        dataKey = null;
                    } else if (item.str.search(/Wallet Recovery Instructions/i) !== -1) {
                        //end of "Password Encrypted Secret" (v2)
                        dataKey = null;
                    } else if (item.str.search(/Backup Mnemonic/i) !== -1) {
                        //end of "Primary Mnemonic" (v1)
                        dataKey = null;
                    } else if (item.str.search(/BlockTrail Public Keys/i) !== -1) {
                        //end of "Backup Mnemonic" (v1)
                        dataKey = null;
                    } else if (item.str.search(/KeyIndex:/i) !== -1) {
                        //blocktrail pub key  - get key index
                        var patt = new RegExp(/KeyIndex: ([0-9]*)/i);
                        var regexResult = patt.exec(item.str);
                        if (regexResult) {
                            var newPubKey = {keyIndex: parseInt(regexResult[1]), pubkey: null};
                            $scope.dataV1.blocktrailKeys.push(newPubKey);
                            $scope.dataV2.blocktrailKeys.push(newPubKey);
                        }
                    }

                    //store the current text according to previous line text
                    switch (dataKey) {
                        case "walletIdentifier":
                            $scope.dataV1.walletIdentifier += item.str;
                            $scope.dataV2.walletIdentifier += item.str;
                            //reset key indicator
                            dataKey = null;
                            break;
                        case "primaryMnemonic":
                            $scope.dataV1.primaryMnemonic += item.str + " ";
                            break;
                        case "backupMnemonic":
                            $scope.dataV1.backupMnemonic += item.str + " ";
                            $scope.dataV2.backupMnemonic += item.str + " ";
                            break;
                        case "encryptedPrimaryMnemonic":
                            $scope.dataV2.encryptedPrimaryMnemonic += item.str + " ";
                            console.log('**storing first value: encryptedPrimaryMnemonic: ' + item.str);
                            break;
                        case "encryptedRecoverySecretMnemonic":
                            $scope.dataV2.encryptedRecoverySecretMnemonic += item.str + " ";
                            break;
                        case "passwordEncryptedSecretMnemonic":
                            $scope.dataV2.passwordEncryptedSecretMnemonic += item.str + " ";
                            break;
                        default:
                            break;
                    }

                    // get wallet version from title
                    var m = item.str.match(/Wallet Identifier \(v(\d+)\)/i);
                    if (m) {
                        $scope.dataV2.walletVersion = parseInt(m[1], 10);
                    }

                    //according to the current line, determine what should happen with the next line of text
                    if (item.str.search(/Wallet Identifier/i) !== -1) {
                        //next item is wallet identifier
                        dataKey = "walletIdentifier";
                    } else if (item.str.search(/Encrypted Primary Seed/i) !== -1) {
                        //wallet v2 data
                        $scope.walletVersion = 2;
                        dataKey = "encryptedPrimaryMnemonic";
                        console.log('**setting first key: encryptedPrimaryMnemonic: ' + item.str);
                    } else if (item.str.search(/Backup Seed/i) !== -1) {
                        //wallet v2 data
                        dataKey = "backupMnemonic";
                    } else if (item.str.search(/Encrypted Recovery Secret/i) !== -1) {
                        //wallet v2 data - not used
                        dataKey = "encryptedRecoverySecretMnemonic";
                    } else if (item.str.search(/Password Encrypted Secret/i) !== -1) {
                        //wallet v2 data
                        dataKey = "passwordEncryptedSecretMnemonic";
                    } else if (item.str.search(/Primary Mnemonic/i) !== -1) {
                        //wallet v1 data
                        $scope.walletVersion = 1;
                        dataKey = "primaryMnemonic";
                    } else if (item.str.search(/Backup Mnemonic/i) !== -1) {
                        //wallet v1 data
                        dataKey = "backupMnemonic";
                    }
                });
                console.log("---------------------------------------------------");
                deferred.resolve();
            })
            .catch(function(err) {
                deferred.reject(err);
            });

        return deferred.promise;
    };

    $scope.parsePageImage = function(page) {
        return page.getOperatorList()
            .then(function (ops) {
                var imageListPromises = [];
                ops.fnArray.forEach(function(fn, idx) {
                    //check if this operator is for an image
                    if (fn === PDFJS.OPS.paintJpegXObject) {
                        var deferred = $q.defer();

                        //using the image info, get the raw image data from the page (imgInfo = [objId, width, height])
                        var imgInfo = ops.argsArray[idx];
                        page.objs.get(imgInfo[0], function(data) {
                            deferred.resolve(data);
                        });

                        imageListPromises.push(deferred.promise);
                    }
                });

                return $q.all(imageListPromises);
            })
            .then(function(imageList) {
                //foreach image, get the image data and try to decode as a qrcode
                var decodedImages = [];
                imageList.forEach(function(img, index) {
                    // get/create the canvas elm that qrcode uses internally
                    var canvas = document.getElementById("qr-canvas");
                    if (!canvas) {
                        canvas = document.createElement("canvas");
                        canvas.setAttribute('id', 'qr-canvas');
                        canvas.style.display = 'none';
                        document.body.appendChild(canvas);
                    }
                    canvas.width = img.width;
                    canvas.height = img.height;

                    // draw the image contents on the canvas
                    var ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);

                    try {
                        decodedImages[index] = qrcode.decode();
                    } catch (e) {
                        decodedImages[index] = null;
                        console.info('qrcode error: ', e);
                    }
                });

                return decodedImages;
            })
            .then(function(results) {
                return results;
            });
    };

    $scope.getBase64Image = function(img) {
        // Create an empty canvas element
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        // Copy the image contents to the canvas
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Get the data-URL formatted image
        // Firefox supports PNG and JPEG. You could check img.src to
        // guess the original format, but be aware the using "image/jpg"
        // will re-encode the image.
        return canvas.toDataURL("image/jpg");
    };

    /**
     * request a blocktrail pubkey for this wallet (called if the qr code can't be decoded)
     * @param {obj} pubkey      ref to the pubkey obj to update
     */
    $scope.requestWalletPubKey = function(pubkey) {
        //convert mnemonic to hex and then base64
        var passwordEncryptedSecretMnemonic = $scope.dataV2.passwordEncryptedSecretMnemonic.trim().replace(new RegExp("\r\n", 'g'), " ").replace(new RegExp("\n", 'g'), " ").replace(/\s+/g, " ");
        var encryptedSecret = blocktrailSDK.convert(bip39.mnemonicToEntropy(passwordEncryptedSecretMnemonic), 'hex', 'base64');

        return RecoveryBackend.requestBlocktrailPublicKey(encryptedSecret)
            .then(function(result) {
                pubkey.pubkey = result.data;
            });
    };

    $scope.cancel = function() {
        $modalInstance.dismiss();
    };
    $scope.ok = function(data) {
        $modalInstance.close(data);
    };
}]);



/*-----Helper Controllers-----*/
app.controller('innerFormCtrl', ["$scope", "FormHelper", function($scope, FormHelper) {
    //used in conjunction with ng-repeat and ng-form. Listens out for a call to validated the inner form
    $scope.$on('validateForms', function(event, value) {
        if($scope.innerForm.$invalid){
            FormHelper.setAllDirty($scope.innerForm);
            return false;
        }
    });
}]);


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
    .service('RecoveryBackend', ["$http", "$q", function($http, $q) {
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
    }])
;
