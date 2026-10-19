# SmartToScreen

SmartToScreen é um projeto novo, separado de `wanderlycan/screencasting`. Ele monta um par de apps para jogar do PC Windows 11 pelo Android na mesma rede local.

## Como funciona

- O instalador Windows cria o app `SmartToScreen.exe` e instala o Sunshine oficial como motor de captura, codificação de vídeo, descoberta local e envio dos comandos ao Windows.
- O APK Android usa o cliente Moonlight Android com a identidade SmartToScreen. Ele procura o PC na rede, mostra controles de toque e aceita controles compatíveis conectados ao telefone.
- A transmissão usa o protocolo GameStream/Moonlight por conexão direta na rede local. Sunshine tenta usar o codificador de vídeo por hardware disponível na GPU; o Android usa o decodificador por hardware quando o aparelho oferece suporte.
- No primeiro pareamento, o Android gera um PIN temporário e o mostra na tela. No PC, abra o painel pelo `SmartToScreen.exe` e informe esse PIN para aprovar o celular. Depois disso, o telefone permanece autorizado até ser removido no painel do Sunshine; a aprovação não é repetida a cada conexão.

O PIN é gerado pelo app no telefone e serve para confirmar o primeiro pareamento. Esta versão usa pareamento aprovado no PC em vez de uma senha de sala escolhida pelo usuário. O pareamento fica lembrado no PC e no celular; remova o dispositivo pareado para revogar o acesso.

## Downloads

Os instaladores do Windows e Android são publicados juntos na página [Releases](https://github.com/wanderlycan/SCREENTOPHONE/releases). A página web [SmartToScreen](https://wanderlycan.github.io/SCREENTOPHONE/) continua sendo a apresentação do projeto.

### Windows 11

1. Baixe e abra `SmartToScreen-Windows-Setup.exe`.
2. Autorize a instalação do Sunshine quando o Windows solicitar.
3. Abra SmartToScreen pelo atalho criado. Use **Abrir painel do PC** para a primeira configuração e para confirmar o PIN.
4. Permita o acesso de rede local no Firewall do Windows se o sistema perguntar.

### Android

1. Baixe `SmartToScreen-Android.apk` no Android e autorize a instalação dessa origem quando o sistema pedir.
2. Conecte o telefone ao mesmo Wi-Fi do PC.
3. Toque no PC descoberto e escolha **Parear**.
4. Digite no painel do PC o PIN temporário exibido no telefone. Depois, escolha a tela ou jogo no app para iniciar.

O APK de beta é compilado com assinatura de depuração e pacote separado (`app.smarttoscreen.client.debug`) para não substituir o Moonlight oficial. Como a chave de beta é temporária, remova a versão anterior do SmartToScreen antes de instalar um APK gerado por uma nova compilação.

## Latência e rede

Para reduzir atraso e engasgos:

- Conecte o PC ao roteador por cabo Ethernet sempre que possível.
- Use Wi-Fi de 5 GHz no Android e fique perto do roteador; evite redes de convidados, que muitas vezes isolam os aparelhos.
- Comece em 1080p e 60 FPS; aumente resolução ou FPS somente se a rede, GPU e tela do telefone sustentarem isso.
- Reduza a taxa de bits no app se houver quadros perdidos ou atraso variável.
- A latência final depende da rede, da captura/encodificação da GPU, do decodificador do telefone e do próprio jogo. Anticheat ou jogos específicos podem limitar entrada virtual.

As sessões na mesma rede usam conexão local. O pareamento inicial usa PIN, e a sessão de jogo não precisa do Bluetooth nem de código longo da página web. O uso fora de casa depende de configuração de rede adicional e não é o foco desta versão.

## Compilação

O ambiente do projeto publica os dois artefatos pelo GitHub Actions:

- Windows: publica o app .NET como executável x64 independente e inclui o instalador oficial do Sunshine dentro do instalador SmartToScreen.
- Android: baixa a versão marcada Moonlight Android v12.2, preserva os submódulos, altera nome e identificador do pacote e compila o flavor sem root em modo beta.
- Ao enviar alterações para `main`, a automação compila o instalador e o APK e publica os dois juntos em uma Release de beta.

O computador local não precisa ter Android Studio ou JDK; a compilação Android ocorre no runner do GitHub Actions.

## Componentes e licença

O app Windows de abertura do painel é código SmartToScreen. A captura, codificação e controle de entrada são fornecidos pelo Sunshine. O APK Android é derivado do Moonlight Android. Consulte [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) e os avisos do upstream antes de redistribuir ou modificar os pacotes.

O instalador não é assinado digitalmente nesta beta, então o Windows pode exibir o aviso de editor desconhecido. Distribua os arquivos somente pelos links oficiais deste repositório.



