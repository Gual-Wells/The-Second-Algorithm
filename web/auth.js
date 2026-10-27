const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0));
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function serialize(credential) {
  if (typeof credential.toJSON === 'function') return credential.toJSON();
  const response = {};
  for (const key of ['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle']) {
    if (credential.response[key] != null) response[key] = encode(credential.response[key]);
  }
  if (credential.response.getTransports) response.transports = credential.response.getTransports();
  return { id: credential.id, rawId: encode(credential.rawId), type: credential.type, response,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults() };
}

export async function passkey(method, api, setupKey) {
  if (!navigator.credentials || !window.PublicKeyCredential) throw Error('当前浏览器不支持通行密钥，请使用Safari或新版浏览器。');
  const enrolled = method === 'enroll';
  const { options, ticket } = await api(`/auth/${method}/options`, { method: 'POST', body: { setupKey } });
  options.challenge = decode(options.challenge);
  if (enrolled) {
    options.user.id = decode(options.user.id);
    for (const item of options.excludeCredentials || []) item.id = decode(item.id);
  } else for (const item of options.allowCredentials || []) item.id = decode(item.id);
  const credential = enrolled ? await navigator.credentials.create({ publicKey: options })
    : await navigator.credentials.get({ publicKey: options });
  if (!credential) throw Error('未完成通行密钥验证。');
  return api(`/auth/${method}/verify`, { method: 'POST', body: { setupKey, ticket, response: serialize(credential) } });
}
