"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const os_1 = require("os");
let currentProcess = null;
let statusBarItem = null;
function stopSpeech() {
    if (currentProcess) {
        try {
            currentProcess.kill();
        }
        catch {
            // ignore
        }
        currentProcess = null;
    }
    if (statusBarItem) {
        statusBarItem.hide();
    }
}
function speak(text) {
    return new Promise((resolve, reject) => {
        const config = vscode.workspace.getConfiguration('vscode-speech');
        const voice = config.get('voice', null);
        const speed = config.get('speed', 1);
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
        const currentPlatform = (0, os_1.platform)();
        if (currentPlatform === 'darwin') {
            const voiceArg = voice ? `-v "${voice.replace(/"/g, '\\"')}"` : '';
            const rateArg = `-r ${Math.round(speed * 180)}`;
            const escapedText = text.replace(/"/g, '\\"');
            const cmd = `say ${voiceArg} ${rateArg} "${escapedText}"`;
            currentProcess = (0, child_process_1.exec)(cmd, (error) => {
                if (statusBarItem) {
                    statusBarItem.hide();
                }
                currentProcess = null;
                if (error) {
                    reject(new Error(`macOS speech failed: ${error.message}`));
                }
                else {
                    resolve();
                }
            });
        }
        else if (currentPlatform === 'win32') {
            const escapedText = text.replace(/'/g, "''");
            const rate = Math.max(-10, Math.min(10, Math.round((speed - 1) * 5)));
            let psScript = `\$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;`;
            if (voice) {
                psScript += ` \$speak.SelectVoice('${voice.replace(/'/g, "''")}');`;
            }
            psScript += ` \$speak.Rate = ${rate}; \$speak.Speak('${escapedText}');`;
            currentProcess = (0, child_process_1.spawn)('powershell.exe', ['-Command', psScript], {
                windowsHide: true
            });
            currentProcess.on('exit', () => {
                if (statusBarItem) {
                    statusBarItem.hide();
                }
                currentProcess = null;
                resolve();
            });
            currentProcess.on('error', (err) => {
                if (statusBarItem) {
                    statusBarItem.hide();
                }
                currentProcess = null;
                reject(new Error(`Windows speech failed: ${err.message}`));
            });
        }
        else {
            const rateArg = `-s ${Math.round(speed * 160)}`;
            const escapedText = text.replace(/"/g, '\\"');
            const cmd = `espeak ${rateArg} "${escapedText}"`;
            currentProcess = (0, child_process_1.exec)(cmd, (error) => {
                if (statusBarItem) {
                    statusBarItem.hide();
                }
                currentProcess = null;
                if (error) {
                    reject(new Error(`Linux speech failed: ${error.message}`));
                }
                else {
                    resolve();
                }
            });
        }
    });
}
function activate(context) {
    console.log('VSCode Speech is now active!');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'speech.stop';
    const readDocumentDisposable = vscode.commands.registerCommand('speech.readDocument', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor found.');
            return;
        }
        const text = editor.document.getText();
        try {
            await speak(text);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Speech error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    });
    const readSelectionDisposable = vscode.commands.registerCommand('speech.readSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor found.');
            return;
        }
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        try {
            await speak(text);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Speech error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    });
    const stopDisposable = vscode.commands.registerCommand('speech.stop', () => {
        stopSpeech();
        vscode.window.showInformationMessage('Speech stopped.');
    });
    context.subscriptions.push(readDocumentDisposable, readSelectionDisposable, stopDisposable, statusBarItem);
}
function deactivate() {
    stopSpeech();
}
//# sourceMappingURL=extension.js.map