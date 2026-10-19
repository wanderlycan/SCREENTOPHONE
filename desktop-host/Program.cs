using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace SmartToScreen;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new HostWindow());
    }
}

internal sealed class HostWindow : Form
{
    private readonly Label _status;
    private readonly System.Windows.Forms.Timer _timer;

    public HostWindow()
    {
        Text = "SmartToScreen — PC anfitrião";
        Width = 680;
        Height = 590;
        MinimumSize = new Size(640, 590);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(16, 21, 29);
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 10);

        var title = new Label
        {
            Text = "SmartToScreen",
            Font = new Font("Segoe UI", 24, FontStyle.Bold),
            ForeColor = Color.White,
            AutoSize = true,
            Location = new Point(28, 22)
        };
        var subtitle = new Label
        {
            Text = "Acesse o desktop do PC pelo Android, na rede local ou remotamente",
            ForeColor = Color.FromArgb(184, 193, 207),
            AutoSize = true,
            Location = new Point(31, 69),
            Size = new Size(610, 28)
        };
        _status = new Label
        {
            Text = "Verificando o serviço de transmissão…",
            ForeColor = Color.FromArgb(184, 193, 207),
            AutoSize = false,
            Location = new Point(31, 118),
            Size = new Size(610, 48)
        };

        var open = MakeButton("Abrir painel do PC", 31, 178, 285, OpenHostPanel);
        var help = MakeButton("Guia SmartToScreen", 331, 178, 285, OpenProjectPage);
        var instructions = new Label
        {
            Text = "MESMA REDE\n" +
                   "Conecte o Android ao mesmo Wi‑Fi. O PC aparece na lista do app; faça o pareamento e aprove o PIN neste painel.\n\n" +
                   "FORA DE CASA\n" +
                   "Instale e conecte Tailscale neste PC e no Android usando sua conta. Depois, adicione no Moonlight o IP Tailscale mostrado abaixo.\n\n" +
                   "SEGUNDA TELA\n" +
                   "Instale um driver de monitor virtual confiável, escolha uma tela em retrato nas Configurações do Windows e configure o Sunshine para transmitir essa tela. Veja o guia para os passos e limites.",
            ForeColor = Color.FromArgb(205, 213, 224),
            AutoSize = false,
            Location = new Point(31, 240),
            Size = new Size(610, 215)
        };

        var localAddress = new Label
        {
            Text = "IP local: verificando…",
            ForeColor = Color.FromArgb(184, 193, 207),
            AutoSize = false,
            Location = new Point(31, 470),
            Size = new Size(610, 25)
        };
        var remoteAddress = new Label
        {
            Text = "IP Tailscale: verificando…",
            ForeColor = Color.FromArgb(184, 193, 207),
            AutoSize = false,
            Location = new Point(31, 500),
            Size = new Size(475, 25)
        };
        var copyRemoteAddress = MakeButton("Copiar IP", 516, 493, 100, () =>
        {
            var address = remoteAddress.Text.Split(' ', '·')
                .FirstOrDefault(value => IPAddress.TryParse(value, out var parsed) &&
                                         parsed.AddressFamily == AddressFamily.InterNetwork);
            if (address is null) return;
            try
            {
                Clipboard.SetText(address);
                remoteAddress.Text = $"IP Tailscale: {address} (copiado)";
            }
            catch (System.Runtime.InteropServices.ExternalException)
            {
                MessageBox.Show("Não foi possível copiar o endereço agora.", "SmartToScreen");
            }
        });
        var displaySettings = MakeButton("Configurações de tela do Windows", 31, 535, 285,
            () => OpenUrl("ms-settings:display"));
        var virtualDisplayGuide = MakeButton("Guia de monitor virtual e acesso remoto", 331, 535, 285,
            OpenProjectPage);

        Controls.AddRange([title, subtitle, _status, open, help, instructions, localAddress,
            remoteAddress, copyRemoteAddress, displaySettings, virtualDisplayGuide]);
        _timer = new System.Windows.Forms.Timer { Interval = 1800 };
        _timer.Tick += async (_, _) => await RefreshServiceStatus();
        _timer.Start();
        Shown += async (_, _) => await RefreshServiceStatus();
        Shown += async (_, _) => await RefreshAddresses(localAddress, remoteAddress);
        var networkTimer = new System.Windows.Forms.Timer { Interval = 6000 };
        networkTimer.Tick += async (_, _) => await RefreshAddresses(localAddress, remoteAddress);
        networkTimer.Start();
    }

    private static Button MakeButton(string text, int x, int y, int width, Action action)
    {
        var button = new Button
        {
            Text = text,
            Location = new Point(x, y),
            Size = new Size(width, 44),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(124, 92, 255),
            ForeColor = Color.White,
            Cursor = Cursors.Hand
        };
        button.FlatAppearance.BorderSize = 0;
        button.Click += (_, _) => action();
        return button;
    }

    private async Task RefreshServiceStatus()
    {
        var running = await CanReachSunshine();
        _status.Text = running
            ? "Serviço ativo. O Android pode encontrar o PC na mesma rede ou conectar pelo IP Tailscale."
            : "O serviço do PC ainda está iniciando. Se continuar assim, abra a instalação do Sunshine pelo menu Iniciar.";
        _status.ForeColor = running ? Color.FromArgb(122, 231, 180) : Color.FromArgb(255, 202, 120);
    }

    private static async Task RefreshAddresses(Label localAddress, Label remoteAddress)
    {
        var local = NetworkInterface.GetAllNetworkInterfaces()
            .Where(network => network.OperationalStatus == OperationalStatus.Up &&
                              network.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .SelectMany(network => network.GetIPProperties().UnicastAddresses)
            .Where(address => address.Address.AddressFamily == AddressFamily.InterNetwork &&
                              !IPAddress.IsLoopback(address.Address))
            .Select(address => address.Address.ToString())
            .Distinct()
            .ToArray();

        localAddress.Text = local.Length == 0
            ? "IP local: não encontrado (verifique se o PC está conectado à rede)."
            : $"IP local: {string.Join("   ·   ", local)}";

        var tailscale = await GetTailscaleAddress();
        remoteAddress.Text = tailscale is null
            ? "IP Tailscale: não detectado — instale e conecte Tailscale neste PC para acesso remoto."
            : $"IP Tailscale: {tailscale}   ·   informe este endereço no Moonlight do Android.";
    }

    private static async Task<string?> GetTailscaleAddress()
    {
        var candidates = new[]
        {
            "tailscale",
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "Tailscale", "tailscale.exe")
        };

        foreach (var executable in candidates)
        {
            try
            {
                using var process = Process.Start(new ProcessStartInfo
                {
                    FileName = executable,
                    Arguments = "ip -4",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                });
                if (process is null) continue;

                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                await process.WaitForExitAsync(timeout.Token);
                if (process.ExitCode != 0) continue;

                var address = (await process.StandardOutput.ReadToEndAsync()).Trim();
                if (IPAddress.TryParse(address, out var parsed) &&
                    parsed.AddressFamily == AddressFamily.InterNetwork)
                    return address;
            }
            catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or
                                       OperationCanceledException or InvalidOperationException)
            {
                // Tailscale is optional; keep the local-network workflow available.
            }
        }

        return null;
    }

    private static async Task<bool> CanReachSunshine()
    {
        try
        {
            using var client = new TcpClient();
            using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(600));
            await client.ConnectAsync("127.0.0.1", 47990, timeout.Token);
            return client.Connected;
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException)
        {
            return false;
        }
    }

    private static void OpenHostPanel() => OpenUrl("https://localhost:47990");
    private static void OpenProjectPage() => OpenUrl("https://github.com/wanderlycan/SCREENTOPHONE#monitor-virtual-e-acesso-remoto");

    private static void OpenUrl(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception ex) { MessageBox.Show($"Não foi possível abrir o navegador.\n\n{ex.Message}", "SmartToScreen"); }
    }
}

