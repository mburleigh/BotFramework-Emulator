//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
import * as path from 'path';
import * as fs from 'fs-extra';
import * as Electron from 'electron';
import { app, Menu } from 'electron';
import { mainWindow } from '../main';
import { showOpenDialog, showSaveDialog } from '../utils';
import { AppMenuBuilder } from '../appMenuBuilder';
import { ContextMenuService } from '../services/contextMenuService';
import { getStore } from '../botData/store';
import { CommandRegistryImpl } from '@bfemulator/sdk-shared';
import { SharedConstants } from '@bfemulator/app-shared';

const { shell } = Electron;

const store = getStore();

/** Registers electron commands */
export function registerCommands(commandRegistry: CommandRegistryImpl) {
  const Commands = SharedConstants.Commands.Electron;

  // ---------------------------------------------------------------------------
  // Show OS-native messsage box
  commandRegistry.registerCommand(Commands.ShowMessageBox, (modal: boolean, options: Electron.MessageBoxOptions) => {
    options = {
      message: '',
      title: app.getName(),
      ...options
    };
    const args = modal ? [mainWindow.browserWindow, options] : [options];
    return Electron.dialog.showMessageBox.apply(Electron.dialog, args);
  });

  // ---------------------------------------------------------------------------
  // Shows an open dialog and returns a path
  commandRegistry.registerCommand(Commands.ShowOpenDialog,
    (dialogOptions: Electron.OpenDialogOptions = {}): false | string => {
    return showOpenDialog(mainWindow.browserWindow, dialogOptions);
  });

  // ---------------------------------------------------------------------------
  // Shows a save dialog and returns a path + filename
  commandRegistry.registerCommand(
    Commands.ShowSaveDialog,
    (dialogOptions: Electron.SaveDialogOptions = {}): string => {
      return showSaveDialog(mainWindow.browserWindow, dialogOptions);
    });

  // ---------------------------------------------------------------------------
  // Builds a new app menu to reflect the updated recent bots list
  commandRegistry.registerCommand(Commands.UpdateFileMenu, (): void => {
    // get previous app menu template
    let menu = AppMenuBuilder.menuTemplate;

    // get a file menu template with recent bots added
    const state = store.getState();
    const recentBots = state.bot && state.bot.botFiles ? state.bot.botFiles : [];
    const newFileMenu = AppMenuBuilder.getFileMenu(recentBots);

    // update the app menu to use the new file menu and build the template into a menu
    menu = AppMenuBuilder.setFileMenu(newFileMenu, menu);
    // update stored menu state
    AppMenuBuilder.menuTemplate = menu;
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  });

  // ---------------------------------------------------------------------------
  // Toggles app fullscreen mode
  commandRegistry.registerCommand(Commands.SetFullscreen, (fullscreen: boolean): void => {
    mainWindow.browserWindow.setFullScreen(fullscreen);
    if (fullscreen) {
      Menu.setApplicationMenu(null);
    } else {
      Menu.setApplicationMenu(Menu.buildFromTemplate(AppMenuBuilder.menuTemplate));
    }
  });

  // ---------------------------------------------------------------------------
  // Sets the app's title bar
  commandRegistry.registerCommand(Commands.SetTitleBar, (text: string) => {
    if (text && text.length) {
      mainWindow.browserWindow.setTitle(`${app.getName()} - ${text}`);
    } else {
      mainWindow.browserWindow.setTitle(app.getName());
    }
  });

  // ---------------------------------------------------------------------------
  // Displays the context menu for a given element
  commandRegistry.registerCommand(Commands.DisplayContextMenu, ContextMenuService.showMenuAndWaitForInput);

  // ---------------------------------------------------------------------------
  // Opens an external link
  commandRegistry.registerCommand(Commands.OpenExternal, (url: string) => {
    shell.openExternal(url, { activate: true });
  });

  // ---------------------------------------------------------------------------
  // Opens and item on the disk in Explorer (win) or Finder (mac)
  commandRegistry.registerCommand(Commands.OpenFileLocation, (filePath: string): boolean => {
    const parts = path.parse(filePath);
    return shell.openItem(path.resolve(parts.dir));
  });

  // ---------------------------------------------------------------------------
  // Moves an item to the trash
  commandRegistry.registerCommand(Commands.UnlinkFile, (filePath: string): boolean => {
    return shell.moveItemToTrash(path.resolve(filePath));
  });

  // ---------------------------------------------------------------------------
  // Renames a file - the payload must contain the property "path" and "name"
  // This will also rename the file extension if one is provided in the "name" field
  commandRegistry.registerCommand(Commands.RenameFile,
    async (info: { path: string, newPath: string, name: string }) => {
    const { path: existingPath, newPath } = info;
    let { name } = info;
    const exists = await fs.pathExists(existingPath);
    if (!exists) {
      throw new ReferenceError(`Cannot rename File: ${existingPath} does not exist`);
    }
    const parts = path.parse((newPath || existingPath));
    if (!name) {
      name = parts.base;
    }
    const nameHasExt = path.extname(name);
    let fullPath = `${parts.dir}/${name}`;
    if (!nameHasExt) {
      fullPath += parts.ext;
    }
    return fs.rename(existingPath, fullPath); // let any errors propagate up the stack
  });
}
