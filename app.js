(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const rtcConfig = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
  let peer = null;
  let localStream = null;
  let connection = null;
  let mediaCall = null;
  let sessionRole = null;
  let roomKey = null;
  let roomSalt = null;
  let pendingNonce = null;
  let authenticated = false;
  let commandCount = 0;
  let toastTimer = null;

  function setStatus(message, error = false) {
    const el = $('status-message');
    el.textContent = message;
    el.classList.toggle('error', error);
  }
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2100);
  }
  function randomBytes(size) {
    const result = new Uint8Array(size);
    crypto.getRandomValues(result);
    return result;
  }
  function toHex(bytes) {
    return [...new Uint8Array(bytes)].map((n) => n.toString(16).padStart(2, '0')).join('');
  }
  function fromHex(text) {
    const out = new Uint8Array(text.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  async function derivePasswordKey(password, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256));
  }
  async function signChallenge(keyBytes, challenge) {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return toHex(await crypto.subtle.sign('HMAC', key, challenge));
  }
  function equalHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let different = 0;
    for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return different === 0;
  }
  function strength(password) {
    if (!password) return { level: 0, label: 'Digite uma senha' };
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) => pattern.test(password)).length;
    let score = 1;
    if (password.length >= 8 && variety >= 2) score = 2;
    if (password.length >= 12 && variety >= 3) score = 3;
    if (password.length >= 16 && variety >= 3) score = 4;
    const labels = ['Digite uma senha', 'Fraca', 'Razoável', 'Forte', 'Muito forte'];
    return { level: Math.min(4, Math.max(1, score)), label: labels[Math.min(4, Math.max(1, score))] };
  }
  function updateStrength() {
    const value = $('room-password').value;
    const result = strength(value);
    const meter = document.querySelector('.strength');
    meter.dataset.level = String(result.level);
    $('strength-label').textContent = result.label;
  }
  function activateTab(tabName) {
    const create = tabName === 'create';
    $('tab-create').classList.toggle('active', create);
    $('tab-join').classList.toggle('active', !create);
    $('tab-create').setAttribute('aria-selected', String(create));
    $('tab-join').setAttribute('aria-selected', String(!create));
    $('create-panel').hidden = !create;
    $('join-panel').hidden = create;
    setStatus('');
  }
  function setPeerStatus(text) {
    $('room-status').textContent = text;
  }
  function showRoom(role, roomId) {
    sessionRole = role;
    $('create-panel').hidden = true;
    $('join-panel').hidden = true;
    $('tab-create').hidden = true;
    $('tab-join').hidden = true;
    $('room-state').hidden = false;
    $('room-code-display').textContent = roomId;
    const invite = new URL(location.href);
    invite.searchParams.set('room', roomId);
    $('room-link-display').textContent = invite.toString();
    $('host-controls').hidden = role !== 'host';
    $('viewer-area').hidden = role !== 'viewer';
    $('host-command-log').hidden = role !== 'host';
  }
  function clearSession() {
    if (connection) connection.close();
    if (mediaCall) mediaCall.close();
    if (peer && !peer.destroyed) peer.destroy();
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    peer = connection = mediaCall = localStream = roomKey = roomSalt = pendingNonce = null;
    authenticated = false;
    sessionRole = null;
    $('room-state').hidden = true;
    $('create-panel').hidden = false;
    $('join-panel').hidden = true;
    $('tab-create').hidden = false;
    $('tab-join').hidden = false;
    $('host-controls').hidden = true;
    $('viewer-area').hidden = true;
    $('host-command-log').hidden = true;
    $('remote-video').srcObject = null;
    $('viewer-placeholder').hidden = false;
    $('create-room').disabled = false;
    $('join-room').disabled = false;
    const clean = new URL(location.href);
    clean.searchParams.delete('room');
    history.replaceState({}, '', clean.toString());
  }
  function sendControl(control, pressed) {
    if (!connection || !connection.open || !authenticated || sessionRole !== 'viewer') return;
    connection.send({ type: 'control', control, pressed, at: performance.now() });
    commandCount++;
    $('commands-count').textContent = String(commandCount);
  }
  function installControls() {
    document.querySelectorAll('[data-control]').forEach((button) => {
      const control = button.dataset.control;
      const down = (event) => { event.preventDefault(); button.classList.add('pressed'); button.setPointerCapture?.(event.pointerId); sendControl(control, true); };
      const up = (event) => { event.preventDefault(); button.classList.remove('pressed'); sendControl(control, false); };
      button.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => button.addEventListener(name, up));
      button.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    let previous = new Set();
    setInterval(() => {
      if (sessionRole !== 'viewer' || !navigator.getGamepads) return;
      const gamepad = [...navigator.getGamepads()].find(Boolean);
      if (!gamepad) { previous.forEach((name) => sendControl(name, false)); previous.clear(); return; }
      const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'L3', 'R3'];
      const current = new Set(gamepad.buttons.flatMap((button, index) => button.pressed && names[index] ? [names[index]] : []));
      if (gamepad.axes[0] < -0.55) current.add('left');
      if (gamepad.axes[0] > 0.55) current.add('right');
      if (gamepad.axes[1] < -0.55) current.add('up');
      if (gamepad.axes[1] > 0.55) current.add('down');
      current.forEach((name) => { if (!previous.has(name)) sendControl(name, true); });
      previous.forEach((name) => { if (!current.has(name)) sendControl(name, false); });
      previous = current;
    }, 75);
  }
  function connectHostData() {
    peer.on('connection', (incoming) => {
      if (sessionRole !== 'host') { incoming.close(); return; }
      if (connection && connection.open) { incoming.close(); toast('Esta sala já está conectada a um dispositivo.'); return; }
      connection = incoming;
      const issueChallenge = () => {
        if (pendingNonce || !incoming.open) return;
        const challenge = randomBytes(32);
        pendingNonce = toHex(challenge);
        incoming.send({ type: 'challenge', salt: toHex(roomSalt), iterations: 180000, nonce: pendingNonce });
      };
      incoming.on('open', issueChallenge);
      issueChallenge();
      incoming.on('data', async (message) => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'proof' && pendingNonce) {
          const expected = await signChallenge(roomKey, fromHex(pendingNonce)).catch(() => null);
          if (!expected || !equalHex(expected, message.signature)) {
            incoming.send({ type: 'auth-failed' });
            setPeerStatus('Senha incorreta');
            setStatus('A senha não confere. Peça o código e a senha corretos.', true);
            setTimeout(() => incoming.close(), 700);
            return;
          }
          incoming.send({ type: 'auth-ok' });
          pendingNonce = null;
          authenticated = true;
          setPeerStatus('Celular conectado');
          setStatus('Celular conectado à sala.');
          if (localStream) sendStream(incoming.peer);
          return;
        }
        if (message.type === 'control' && sessionRole === 'host' && authenticated) {
          const label = message.pressed ? `${message.control} pressionado` : `${message.control} solto`;
          $('host-command-log').dataset.lastCommand = label;
          $('last-command').textContent = label;
        }
      });
      incoming.on('close', () => {
        if (connection === incoming) connection = null;
        authenticated = false;
        setPeerStatus('Aguardando o celular');
      });
    });
  }
  async function createRoom() {
    const password = $('room-password').value;
    if (!password) { setStatus('Crie uma senha para proteger a sala.', true); $('room-password').focus(); return; }
    if (!window.Peer) { setStatus('O serviço P2P não carregou. Atualize a página e tente novamente.', true); return; }
    $('create-room').disabled = true;
    setStatus('Preparando conexão P2P…');
    roomSalt = randomBytes(16);
    roomKey = await derivePasswordKey(password, roomSalt, 180000);
    peer = new Peer(undefined, rtcConfig);
    peer.on('open', (id) => {
      showRoom('host', id);
      connectHostData();
      setStatus('Sala criada. Abra o link no Android e informe a senha.');
    });
    peer.on('error', (error) => { setStatus(`Não foi possível criar a sala: ${error.type || error.message}`, true); $('create-room').disabled = false; });
  }
  function sendStream(remoteId) {
    if (!peer || !localStream || !remoteId) return;
    if (mediaCall) mediaCall.close();
    mediaCall = peer.call(remoteId, localStream, { metadata: { app: 'smarttoscreen' } });
    mediaCall.on('error', () => setStatus('A sala está ativa, mas a transmissão não conectou. Verifique a rede e tente novamente.', true));
    setPeerStatus('Transmitindo para o celular');
  }
  async function shareScreen() {
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60, max: 60 } }, audio: true });
    } catch (error) {
      if (error.name === 'NotAllowedError') { setStatus('Compartilhamento cancelado. Clique novamente para escolher a tela.', true); return; }
      setStatus(`Não foi possível compartilhar a tela: ${error.message}`, true); return;
    }
    localStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      localStream = null;
      if (mediaCall) mediaCall.close();
      mediaCall = null;
      setPeerStatus(connection?.open ? 'Celular conectado' : 'Aguardando o celular');
    });
    if (connection?.open) sendStream(connection.peer);
    setStatus('Compartilhamento iniciado. Mantenha esta página aberta.');
  }
  async function joinRoom() {
    const roomId = $('join-code').value.trim();
    const password = $('join-password').value;
    if (!roomId || !password) { setStatus('Informe o código e a senha da sala.', true); return; }
    if (!window.Peer) { setStatus('O serviço P2P não carregou. Atualize a página e tente novamente.', true); return; }
    $('join-room').disabled = true;
    setStatus('Conectando à sala…');
    peer = new Peer(undefined, rtcConfig);
    peer.on('open', () => {
      connection = peer.connect(roomId, { reliable: true });
      connection.on('open', () => { showRoom('viewer', roomId); setPeerStatus('Verificando a senha'); });
      connection.on('data', async (message) => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'challenge') {
          try {
            const key = await derivePasswordKey(password, fromHex(message.salt), message.iterations);
            const signature = await signChallenge(key, fromHex(message.nonce));
            connection.send({ type: 'proof', signature });
          } catch { setStatus('Não foi possível verificar a senha neste navegador.', true); }
        }
        if (message.type === 'auth-ok') { authenticated = true; setPeerStatus('Conectado ao PC'); setStatus('Conectado! Aguardando o anfitrião compartilhar a tela.'); }
        if (message.type === 'auth-failed') { setPeerStatus('Senha incorreta'); setStatus('Senha incorreta. Confira os dados e tente novamente.', true); }
      });
      connection.on('error', (error) => { setStatus(`Falha na conexão: ${error.type || error.message}`, true); $('join-room').disabled = false; });
      connection.on('close', () => { authenticated = false; if (sessionRole) setPeerStatus('Conexão encerrada'); });
    });
    peer.on('call', (call) => {
      mediaCall = call;
      call.answer();
      call.on('stream', (stream) => {
        $('remote-video').srcObject = stream;
        $('viewer-placeholder').hidden = true;
        setPeerStatus('Transmitindo ao vivo');
      });
      call.on('close', () => { $('remote-video').srcObject = null; $('viewer-placeholder').hidden = false; });
      call.on('error', () => setStatus('O vídeo foi interrompido. Aguarde o anfitrião reiniciar a transmissão.', true));
    });
    peer.on('error', (error) => { setStatus(`Não foi possível entrar: ${error.type || error.message}`, true); $('join-room').disabled = false; });
  }
  $('tab-create').addEventListener('click', () => activateTab('create'));
  $('tab-join').addEventListener('click', () => activateTab('join'));
  $('room-password').addEventListener('input', updateStrength);
  document.querySelectorAll('.reveal').forEach((button) => button.addEventListener('click', () => {
    const input = $(button.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    button.setAttribute('aria-label', input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
  }));
  $('create-room').addEventListener('click', createRoom);
  $('join-room').addEventListener('click', joinRoom);
  $('share-screen').addEventListener('click', shareScreen);
  $('close-room').addEventListener('click', clearSession);
  $('copy-code').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('room-code-display').textContent); toast('Código copiado!'); } catch { toast('Selecione e copie o código manualmente.'); } });
  $('copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('room-link-display').textContent); toast('Link copiado!'); } catch { toast('Selecione e copie o link manualmente.'); } });
  $('fullscreen-btn').addEventListener('click', () => $('remote-video').requestFullscreen?.());
  $('join-code').addEventListener('input', (event) => { event.target.value = event.target.value.replace(/[^a-zA-Z0-9_-]/g, ''); });
  $('join-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('join-password').focus(); });
  $('join-password').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('join-room').click(); });
  installControls();

  const roomFromLink = new URL(location.href).searchParams.get('room');
  if (roomFromLink) {
    $('join-code').value = roomFromLink.replace(/[^a-zA-Z0-9_-]/g, '');
    activateTab('join');
    $('join-password').focus({ preventScroll: true });
  }
  window.addEventListener('beforeunload', () => {
    if (connection) connection.close();
    if (mediaCall) mediaCall.close();
    if (peer && !peer.destroyed) peer.destroy();
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
  });
})();
