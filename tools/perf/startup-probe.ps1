param(
  [int]$Runs = 3,
  [int]$MaxMs = 4000,
  [int]$StepMs = 30,
  [string]$Exe = (Join-Path $PSScriptRoot "..\..\src-tauri\target\release\pokestats.exe"),
  [string]$FramesDir = ""
)
Add-Type -AssemblyName System.Drawing
$src = @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class PsProbe {
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; }
  public static string Measure(IntPtr h, string savePath) {
    RECT rc; GetClientRect(h, out rc); POINT p = new POINT(); ClientToScreen(h, ref p);
    int w = rc.R - rc.L, hh = rc.B - rc.T; if (w<=0||hh<=0) return "nosize";
    using (var bmp = new Bitmap(w, hh, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(p.X, p.Y, 0, 0, new Size(w, hh));
      var d = bmp.LockBits(new Rectangle(0,0,w,hh), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = d.Stride; byte[] buf = new byte[stride*hh]; Marshal.Copy(d.Scan0, buf, 0, buf.Length); bmp.UnlockBits(d);
      long lightSide=0, nHead=0, darkSide=0, nSide=0, colorContent=0, nContent=0, nonBlack=0, nTotal=0;
      for (int y=0;y<hh;y+=2) for (int x=0;x<w;x+=2) {
        int i=y*stride+x*4; int b=buf[i],gg=buf[i+1],r=buf[i+2];
        int max=Math.Max(r,Math.Max(gg,b)), min=Math.Min(r,Math.Min(gg,b));
        nTotal++; if (max>20) nonBlack++;
        if (x<200 && y<48) { nHead++; if (max>180) lightSide++; }
        if (x<200 && y>=48 && y<420) { nSide++; if (max<=12) darkSide++; }
        if (x>230 && y>170) { nContent++; if (max-min>60 && max>90) colorContent++; }
      }
      if (!string.IsNullOrEmpty(savePath)) bmp.Save(savePath, ImageFormat.Png);
      return string.Format("nonBlack={0:F4} sideLight={1:F4} sideDark={2:F3} contentColor={3:F4}",
        (double)nonBlack/nTotal, (double)lightSide/Math.Max(1,nHead), (double)darkSide/Math.Max(1,nSide), (double)colorContent/Math.Max(1,nContent));
    }
  }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'PsProbe').Type) { Add-Type -TypeDefinition $src -ReferencedAssemblies System.Drawing }
if ($FramesDir) { New-Item -ItemType Directory -Force -Path $FramesDir | Out-Null }
Get-Process pokestats -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800
for ($run = 1; $run -le $Runs; $run++) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $Exe -PassThru
  $shell = $null; $ui = $null; $black = 0; $firstBlack = $null
  "RUN $run pid=$($p.Id)"
  while ($sw.ElapsedMilliseconds -lt $MaxMs) {
    $p.Refresh()
    $h = $p.MainWindowHandle
    $t = $sw.ElapsedMilliseconds
    if ($h -ne 0 -and [PsProbe]::IsWindowVisible($h)) {
      $save = ""
      if ($FramesDir) { $save = Join-Path $FramesDir ("run{0}-t{1:D4}.png" -f $run, $t) }
      $m = [PsProbe]::Measure($h, $save)
      "  t=$t $m"
      $nonBlack = [double]([regex]::Match($m, 'nonBlack=([\d.]+)').Groups[1].Value)
      $sideLight = [double]([regex]::Match($m, 'sideLight=([\d.]+)').Groups[1].Value)
      $sideDark = [double]([regex]::Match($m, 'sideDark=([\d.]+)').Groups[1].Value)
      $color = [double]([regex]::Match($m, 'contentColor=([\d.]+)').Groups[1].Value)
      if ($null -eq $shell -and $sideDark -ge 0.7 -and $sideLight -gt 0.01) { $shell = $t }
      if ($null -ne $shell -and $nonBlack -lt 0.005) { $black++; if ($null -eq $firstBlack) { $firstBlack = $t } }
      if ($null -eq $ui -and $color -gt 0.004 -and $sideDark -ge 0.7) { $ui = $t }
      if ($null -ne $ui -and $t -gt $ui + 400) { break }
    }
    Start-Sleep -Milliseconds $StepMs
  }
  $fb = if ($null -eq $firstBlack) { "-" } else { $firstBlack }
  "SUMMARY run=$run shell=$shell ui=$ui blackFrames=$black firstBlackAt=$fb"
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 1500
}