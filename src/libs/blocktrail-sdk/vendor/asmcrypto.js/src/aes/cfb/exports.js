/**
 * AES-CFB exports
 */

function AES_CFB_encrypt_bytes ( data, key, iv ) {
    if ( data === undefined ) throw new SyntaxError("data required");
    if ( key === undefined ) throw new SyntaxError("key required");
    return new AES_CFB( { heap: _AES_heap_instance, asm: _AES_asm_instance, key: key, iv: iv } ).encrypt(data).result;
}

function AES_CFB_decrypt_bytes ( data, key, iv ) {
    if ( data === undefined ) throw new SyntaxError("data required");
    if ( key === undefined ) throw new SyntaxError("key required");
    return new AES_CFB( { heap: _AES_heap_instance, asm: _AES_asm_instance, key: key, iv: iv } ).decrypt(data).result;
}

exports.AES_CFB = AES_CFB;
exports.AES_CFB.encrypt = AES_CFB_encrypt_bytes;
exports.AES_CFB.decrypt = AES_CFB_decrypt_bytes;

exports.AES_CFB.Encrypt = AES_CFB_Encrypt;
exports.AES_CFB.Decrypt = AES_CFB_Decrypt;
