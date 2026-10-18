# SmartToScreen (SCREENTOPHONE)

Site beta independente para conectar um computador e um celular Android em uma sala P2P. O repositório novo é `wanderlycan/SCREENTOPHONE`; este projeto não modifica nem substitui `wanderlycan/screencasting`.

## O que funciona nesta versão

- Criação de sala e entrada por código, com senha escolhida pelo anfitrião e indicador de força.
- Verificação de senha por desafio HMAC com chave derivada via PBKDF2; a senha digitada não é enviada ao outro dispositivo.
- Transmissão da tela do PC ao Android por WebRTC/PeerJS.
- Controles touch e leitura de controles compatíveis com a Gamepad API no celular; os comandos são enviados no canal de dados P2P após autenticação.
- Interface adaptável para desktop e celular.

## Limite de controle no Windows

Uma página web não pode injetar comandos em qualquer jogo instalado no Windows. Nesta beta, os comandos chegam à página do anfitrião; para aplicá-los globalmente a jogos de PC, é necessário um auxiliar SmartToScreen para Windows, ainda não incluído. Alguns jogos e sistemas anticheat também podem bloquear entrada virtual.

## Hospedagem

É um site estático e pode ser hospedado no GitHub Pages. A comunicação WebRTC usa PeerJS Cloud para descoberta/sinalização e tenta enviar mídia e comandos diretamente entre os dispositivos. A captura de tela exige HTTPS, e algumas redes podem bloquear conexões P2P diretas sem um servidor TURN.

## Arquivos

- `index.html` — interface do site.
- `styles.css` — identidade visual e layout responsivo.
- `app.js` — salas, autenticação da senha, vídeo e controles P2P.
