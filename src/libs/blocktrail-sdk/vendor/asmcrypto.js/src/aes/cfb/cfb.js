/**
 * Cipher Feedback Mode (CFB)
 */

function AES_CFB ( options ) {
    this.iv = null;

    AES.call( this, options );

    this.mode = 'CFB';
}

var AES_CFB_prototype = AES_CFB.prototype;
AES_CFB_prototype.BLOCK_SIZE = 16;
AES_CFB_prototype.reset = AES_reset;
AES_CFB_prototype.encrypt = AES_Encrypt_finish;
AES_CFB_prototype.decrypt = AES_Decrypt_finish;

function AES_CFB_Encrypt ( options ) {
    AES_CFB.call( this, options );
}

var AES_CFB_Encrypt_prototype = AES_CFB_Encrypt.prototype;
AES_CFB_Encrypt_prototype.BLOCK_SIZE = 16;
AES_CFB_Encrypt_prototype.reset = AES_reset;
AES_CFB_Encrypt_prototype.process = AES_Encrypt_process;
AES_CFB_Encrypt_prototype.finish = AES_Encrypt_finish;

function AES_CFB_Decrypt ( options ) {
    AES_CFB.call( this, options );
}

var AES_CFB_Decrypt_prototype = AES_CFB_Decrypt.prototype;
AES_CFB_Decrypt_prototype.BLOCK_SIZE = 16;
AES_CFB_Decrypt_prototype.reset = AES_reset;
AES_CFB_Decrypt_prototype.process = AES_Decrypt_process;
AES_CFB_Decrypt_prototype.finish = AES_Decrypt_finish;
