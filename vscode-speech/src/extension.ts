import * as vscode from 'vscode';
import { spawn, exec, ChildProcess } from 'child_process';
import { platform } from 'os';

let currentProcess: ChildProcess | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

function stopSpeech(): void {
  if (currentProcess) {
    try {
      currentProcess.kill();
    } catch {
      // ignore
    }
    currentProcess = null;
  }
  if (statusBarItem) {
    statusBarItem.hide();
  }
}

function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = vscode.workspace.getConfiguration('vscode-speech');
    const voice: string | null = config.get('voice', null) as string | null;
    const speed: number = config.get('speed', 1) as number;

    if (!text || text.trim().length === 0) {
      resolve();
      return;
    }

    stopSpeech();

    if (statusBarItem) {
      statusBarItem.text = '$(megaphone) Reading...';
      statusBarItem.tooltip = 'Click to stop reading';
      statusBarItem.command = 'speech.stop';
      statusBarItem.show();
    }

    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      const voiceArg = voice ? `-v "${voice.replace(/"/g, '\\"')}"` : '';
      const rateArg = `-r ${Math.round(speed * 180)}`;
      const escapedText = text.replace(/"/g, '\\"');
      const cmd = `say ${voiceArg} ${rateArg} "${escapedText}"`;

      currentProcess = exec(cmd, (error) => {
        if (statusBarItem) {
          statusBarItem.hide();
        }
        currentProcess = null;
        if (error) {
          reject(new Error(`macOS speech failed: ${error.message}`));
        } else {
          resolve();
        }
      });
    } else if (currentPlatform === 'win32') {
      const escapedText = text.replace(/'/g, "''");
      const rate = Math.max(-10, Math.min(10, Math.round((speed - 1) * 5)));
      let psScript = `\$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;`;

      if (voice) {
        psScript += ` \$speak.SelectVoice('${voice.replace(/'/g, "''")}');`;
      }

      psScript += ` \$speak.Rate = ${rate}; \$speak.Speak('${escapedText}');`;

      currentProcess = spawn('powershell.exe', ['-Command', psScript], {
        windowsHide: true
      });

      currentProcess.on('exit', () => {
        if (statusBarItem) {
          statusBarItem.hide();
        }
        currentProcess = null;
        resolve();
      });

      currentProcess.on('error', (err: Error) => {
        if (statusBarItem) {
          statusBarItem.hide();
        }
        currentProcess = null;
        reject(new Error(`Windows speech failed: ${err.message}`));
      });
    } else {
      const rateArg = `-s ${Math.round(speed * 160)}`;
      const escapedText = text.replace(/"/g, '\\"');
      const cmd = `espeak ${rateArg} "${escapedText}"`;

      currentProcess = exec(cmd, (error) => {
        if (statusBarItem) {
          statusBarItem.hide();
        }
        currentProcess = null;
        if (error) {
          reject(new Error(`Linux speech failed: ${error.message}`));
        } else {
          resolve();
        }
      });
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  console.log('VSCode Speech is now active!');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'speech.stop';

  const readDocumentDisposable = vscode.commands.registerCommand(
    'speech.readDocument',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active text editor found.');
        return;
      }
      const text = editor.document.getText();
      try {
        await speak(text);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Speech error: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }
  );

  const readSelectionDisposable = vscode.commands.registerCommand(
    'speech.readSelection',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active text editor found.');
        return;
      }
      const selection = editor.selection;
      const text = editor.document.getText(selection);
      try {
        await speak(text);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Speech error: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }
  );

  const stopDisposable = vscode.commands.registerCommand(
    'speech.stop',
    () => {
      stopSpeech();
      vscode.window.showInformationMessage('Speech stopped.');
    }
  );

  context.subscriptions.push(
    readDocumentDisposable,
    readSelectionDisposable,
    stopDisposable,
    statusBarItem
  );
}

export function deactivate() {
  stopSpeech();
}
