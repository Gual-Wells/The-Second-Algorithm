using System;
using System.Diagnostics;
using System.IO;
using System.Text;
// Same WindowsApplication / CreateNoWindow mechanism as the Second Language launcher.
// Run Node directly: no PowerShell console and no model during rest checks.
internal static class BackgroundTask {
  private static readonly object Lock = new object();
  private static string LogFile;
  private static string Quote(string value) {
    var r=new StringBuilder("\""); int slashes=0;
    foreach(char c in value) {
      if(c=='\\'){slashes++;continue;}
      r.Append('\\',c=='"'?slashes*2+1:slashes).Append(c);slashes=0;
    }
    return r.Append('\\',slashes*2).Append('"').ToString();
  }
  private static void Log(string line) { if(line==null)return; lock(Lock)File.AppendAllText(LogFile,DateTimeOffset.Now.ToString("o")+" "+line+Environment.NewLine,new UTF8Encoding(false)); }
  private static int Main(string[] args) {
    try {
      if(args.Length!=3)return 2;
      var node=Path.GetFullPath(args[0]);var script=Path.GetFullPath(args[1]);var logs=Path.GetFullPath(args[2]);
      if(!File.Exists(node)||!File.Exists(script)||!String.Equals(Path.GetExtension(script),".mjs",StringComparison.OrdinalIgnoreCase))return 2;
      Directory.CreateDirectory(logs);LogFile=Path.Combine(logs,"background-"+DateTime.Now.ToString("yyyy-MM-dd")+".log");
      var start=new ProcessStartInfo { FileName=node,Arguments=Quote(script),WorkingDirectory=Path.GetDirectoryName(script),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=new UTF8Encoding(false),StandardErrorEncoding=new UTF8Encoding(false) };
      start.EnvironmentVariables["TEMP"]=logs;start.EnvironmentVariables["TMP"]=logs;start.EnvironmentVariables["TMPDIR"]=logs;
      using(var child=new Process{StartInfo=start}){
        child.OutputDataReceived+=(sender,e)=>Log(e.Data);child.ErrorDataReceived+=(sender,e)=>Log(e.Data);
        child.Start();child.BeginOutputReadLine();child.BeginErrorReadLine();child.WaitForExit();return child.ExitCode;
      }
    }catch(Exception error){if(LogFile!=null){try{Log(error.GetType().Name);}catch{}}return 2;}
  }
}
