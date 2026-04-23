// Shim de isomorphic-webcrypto para React Native (Hermes)
// lib0 llama ensureSecure() para verificar contexto seguro.
// En React Native nativo, el contexto siempre es seguro.
const crypto = globalThis.crypto;

const shimCrypto = {
    getRandomValues: (array) => crypto.getRandomValues(array),
    subtle: crypto.subtle,
    randomUUID: crypto.randomUUID?.bind(crypto),
    // ensureSecure() verifica HTTPS en web; en RN es siempre seguro
    ensureSecure: () => Promise.resolve(),
};

module.exports = shimCrypto;
module.exports.default = shimCrypto;
