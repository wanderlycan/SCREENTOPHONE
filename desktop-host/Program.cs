using System.Diagnostics;
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
        Width = 620;
        Height = 420;
        MinimumSize = new Size(560, 380);
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
            Text = "Seu PC pronto para jogar pela rede local",
            ForeColor = Color.FromArgb(184, 193, 207),
            AutoSize = true,
            Location = new Point(31, 69)
        };
        _status = new Label
        {
            Text = "Verificando o serviço de transmissão…",
            ForeColor = Color.FromArgb(184, 193, 207),
            AutoSize = false,
            Location = new Point(31, 118),
            Size = new Size(535, 56)
        };

        var open = MakeButton("Abrir painel do PC", 31, 190, 250, OpenHostPanel);
        var help = MakeButton("Como conectar o Android", 299, 190, 250, OpenProjectPage);
        var instructions = new Label
        {
            Text = "1. Deixe este PC conectado ao mesmo Wi‑Fi do Android.\n" +
                   "2. No SmartToScreen do celular, toque no PC encontrado e inicie o pareamento.\n" +
                   "3. Confirme o PIN mostrado no celular neste painel do PC.\n\n" +
                   "Depois do pareamento, a conexão de jogo usa a rede local. Para menor atraso, " +
                   "use Wi‑Fi de 5 GHz ou cabo no PC.",
            ForeColor = Color.FromArgb(205, 213, 224),
            AutoSize = false,
            Location = new Point(31, 254),
            Size = new Size(535, 112)
        };

        Controls.AddRange([title, subtitle, _status, open, help, instructions]);
        _timer = new System.Windows.Forms.Timer { Interval = 1800 };
        _timer.Tick += async (_, _) => await RefreshServiceStatus();
        _timer.Start();
        Shown += async (_, _) => await RefreshServiceStatus();
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
            ? "PC disponível. O Android pode localizar este computador quando ambos estiverem na mesma rede Wi‑Fi."
            : "O serviço do PC ainda está iniciando. Se continuar assim, abra a instalação do Sunshine pelo menu Iniciar.";
        _status.ForeColor = running ? Color.FromArgb(122, 231, 180) : Color.FromArgb(255, 202, 120);
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
    private static void OpenProjectPage() => OpenUrl("https://github.com/wanderlycan/SCREENTOPHONE#smarttoscreen");

    private static void OpenUrl(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception ex) { MessageBox.Show($"Não foi possível abrir o navegador.\n\n{ex.Message}", "SmartToScreen"); }
    }
}

