/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

var SC = require("sproutcore");
var bespin = require("bespin");

var util = require("bespin/util/util");
var canvas = require("bespin/util/canvas");
var cookie = require("bespin/util/cookie");
var keys = require("bespin/util/keys");

var settings = require("bespin/settings");
var clipboard = require("bespin/clipboard");
var editorEvents = require("bespin/events");
var cursor = require("bespin/cursor");
var model = require("bespin/model");
var history = require("bespin/history");
var view = require("bespin/editor/views/editor");


/**
 * bespin.editor.API is the root object, the API that others should be able to
 * use
 */
exports.EditorController = SC.Object.extend({
    opts: {},
    
    containerBinding: '.ui.layer',

    init: function() {
        // fixme: this stuff may not belong here
        this.debugMode = false;

        this.model = model.DocumentModel.create({ editor: this });

        var cursor = require("bespin/cursor");

        this.cursorManager = cursor.CursorManager.create({ editor: this });
        this.ui = view.EditorView.create({ editor: this, content: this.model });
        this.theme = require("bespin/theme")['default'];

        this.editorKeyListener = exports.DefaultEditorKeyListener.create({ editor: this });
        this.historyManager = history.HistoryManager.create({ editor: this });
        editorEvents.subscribe();

        this.ui.installKeyListener(this.editorKeyListener);

        this.model.insertCharacters({ row: 0, col: 0 }, " ");

        var self = this;
        // dojo.connect(this.canvas, "blur",  function(e) {
        //     self.setFocus(false);
        // });
        // dojo.connect(this.canvas, "focus", function(e) {
        //     self.setFocus(true);
        // });
        // TODO: We're repainting fairly often do we need to add this?
        dojo.connect(window, 'resize', function() {
            self.paint();
        });

        clipboard.setup(this);

        //this.paint();

        if (!this.opts.dontfocus) {
            this.setFocus(true);
        }

        this.sc_super();
    },

    /**
     * ensures that the start position is before the end position; reading
     * directly from the selection property makes no such guarantee
     */
    getSelection: function(selection) {
        selection = (selection != undefined) ? selection : this.selection;
        if (!selection) {
            return undefined;
        }

        var startPos = selection.startPos;
        var endPos = selection.endPos;

        // ensure that the start position is always before the end position
        if ((endPos.row < startPos.row) || ((endPos.row == startPos.row) && (endPos.col < startPos.col))) {
            var foo = startPos;
            startPos = endPos;
            endPos = foo;
        }

        return {
            startPos: cursor.copyPos(startPos),
            endPos: cursor.copyPos(endPos),
            startModelPos: this.getModelPos(startPos),
            endModelPos: this.getModelPos(endPos)
        };
    },

    /**
     *
     */
    getCursorPos: function(modelPos) {
        return this.cursorManager.getCursorPosition(modelPos);
    },

    /**
     *
     */
    getModelPos: function(pos) {
        return this.cursorManager.getModelPosition(pos);
    },

    /**
     *
     */
    moveCursor: function(pos) {
        this.cursorManager.moveCursor(pos);
    },

    /**
     * restore the state of the editor
     */
    resetView: function(data) {
        this.cursorManager.moveCursor(data.cursor);
        this.setSelection(data.selection);
        this.ui.yoffset = data.offset.y;
        this.ui.xoffset = data.offset.x;
    },

    basicView: function() {
        this.cursorManager.moveCursor({row: 0, col: 0});
        this.setSelection(undefined);
        this.ui.yoffset = 0;
        this.ui.xoffset = 0;
    },

    getCurrentView: function() {
        return {
            cursor: this.getCursorPos(),
            offset: {
                x: this.ui.xoffset,
                y: this.ui.yoffset
            },
            selection: this.selection
        };
    },

    getState: function() {
        return { cursor: this.getCursorPos(), selection: this.getSelection() };
    },

    setState: function(data) {
        this.cursorManager.moveCursor(data.cursor);
        this.setSelection(data.selection);
        this.ui.ensureCursorVisible();
        this.paint(false);
    },

    /**
     * Basic setting
     */
    defaultTabSize: 4,

    /**
     * be gentle trying to get the tabstop from settings
     */
    getTabSize: function() {
        var settings = bespin.get("settings");
        var size = this.defaultTabSize;
        if (settings) {
            var tabsize = parseInt(settings.get("tabsize"), 10);
            if (tabsize > 0) {
                size = tabsize;
            }
        }
        return size;
    },

    /**
     * helper to get text
     */
    getSelectionAsText: function() {
        var selectionText = '';
        var selectionObject = this.getSelection();
        if (selectionObject) {
            selectionText = this.model.getChunk(selectionObject);
        }
        return selectionText;
    },

    setSelection: function(selection) {
        this.selection = selection;
    },

    paint: function(fullRefresh) {
        var canvasElem = this.ui.get("canvas");
        if (!canvasElem) {
            return;
        }
        var ctx = canvas.fix(canvasElem.getContext("2d"));
        this.ui.paint(ctx, fullRefresh);
    },

    changeKeyListener: function(newKeyListener) {
        this.ui.installKeyListener(newKeyListener);
        this.editorKeyListener = newKeyListener;
    },

    /**
     * This does not set focus to the editor; it indicates that focus has been
     * set to the underlying canvas
     */
    setFocus: function(focus) {
        this.focus = focus;

        // force it if you have too
        if (focus) {
            //this.canvas.focus();
        }
    },

    /**
     * Prevent user edits
     */
    setReadOnly: function(readonly) {
        this.readonly = readonly;
    },

    /**
     * Anything that this editor creates should be gotten rid of.
     * Useful when you will be creating and destroying editors more than once.
     */
    dispose: function() {
        // TODO: Isn't bespin.editor == this?
        // clipboard.uninstall();
        this.ui.dispose();
    },

    /**
     * Add key listeners
     * e.g. bindkey('moveCursorLeft', 'ctrl b');
     */
    bindKey: function(action, keySpec, selectable) {
        console.warn("Use of editor.bindKey(", action, keySpec, selectable, ") seems doomed to fail");
        var keyObj = keys.fillArguments(keySpec);
        var key = keyObj.key;
        var modifiers = keyObj.modifiers;

        if (!key) {
            // TODO: shouldn't we complain or something?
            return;
        }

        var keyCode = keys.toKeyCode(key);

        // -- try an editor action first, else fire off a command
        var actionDescription = "Execute command: '" + action + "'";
        action = this.ui.actions[action] || function() {
            bespin.commandLine.executeCommand(command, true);
        };

        if (keyCode && action) {
            if (selectable) {
                // register the selectable binding too (e.g. SHIFT + what you passed in)
                this.editorKeyListener.bindKeyStringSelectable(modifiers, keyCode, action, actionDescription);
            } else {
                this.editorKeyListener.bindKeyString(modifiers, keyCode, action, actionDescription);
            }
        }
    },

    /**
     * Ensure that a given command is executed on each keypress
     */
    bindCommand: function(command, keySpec) {
        var keyObj = keys.fillArguments(keySpec);
        var keyCode = keys.toKeyCode(keyObj.key);
        var action = function() {
            bespin.getComponent("commandLine", function(cli) {
                cli.executeCommand(command, true);
            });
        };
        var actionDescription = "Execute command: '" + command + "'";

        this.editorKeyListener.bindKeyString(keyObj.modifiers, keyCode, action, actionDescription);
    },

    /**
     * Observe a request to move the editor to a given location and center it
     * TODO: There is probably a better location for this. Move it.
     */
    moveAndCenter: function(row) {
        if (!row) {
            return; // short circuit
        }

        var linenum = row - 1; // move it up a smidge

        this.cursorManager.moveCursor({ row: linenum, col: 0 });

        // If the line that we are moving to is off screen, center it, else just move in place
        if ((linenum < this.ui.firstVisibleRow) ||
            (linenum >= this.ui.firstVisibleRow + this.ui.visibleRows)) {
            this.ui.actions.moveCursorRowToCenter();
        }
    },

    /**
     * Observe a request for a new file to be created
     */
    newFile: function(project, path, content) {
        project = project || bespin.get('editSession').project;
        path = path || "new.txt";
        var self = this;

        var onSuccess = function() {
            // If collaboration is turned on, then session.js takes care of
            // updating the editor with contents, setting it here might break
            // the synchronization process.
            // See the note at the top of session.js:EditSession.startSession()
            if (bespin.get("settings").isSettingOff("collaborate")) {
                self.model.insertDocument(content || "");
                self.cursorManager.moveCursor({ row: 0, col: 0 });
                self.setFocus(true);
            }

            bespin.publish("editor:openfile:opensuccess", {
                project: project,
                file: {
                    name: path,
                    content: content || "",
                    timestamp: new Date().getTime()
                }
            });

            bespin.publish("editor:dirty");
        };

        bespin.get('files').newFile(project, path, onSuccess);
    },

    /**
     * Observe a request for a file to be saved and start the cycle:
     * <ul>
     * <li>Send event that you are about to save the file (savebefore)
     * <li>Get the last operation from the sync helper if it is up and running
     * <li>Ask the file system to save the file
     * <li>Change the page title to have the new filename
     * <li>Tell the command line to show the fact that the file is saved
     * </ul>
     */
    saveFile: function(project, filename, onSuccess, onFailure) {
        project = project || bespin.get('editSession').project;
        filename = filename || bespin.get('editSession').path; // default to what you have

        // saves the current state of the editor to a cookie
        var name = 'viewData_' + project + '_' + filename.split('/').join('_');
        var value = JSON.stringify(bespin.get('editor').getCurrentView());
        cookie.set(name, value, { expires: 7 });

        var file = {
            name: filename,
            content: this.model.getDocument(),
            timestamp: new Date().getTime()
        };

        var newOnSuccess = function() {
            document.title = filename + ' - editing with Bespin';

            var commandLine = bespin.get("commandLine");
            if (commandLine) {
                commandLine.showHint('Saved file: ' + file.name);
            }

            bespin.publish("editor:clean");

            if (util.isFunction(onSuccess)) {
                onSuccess();
            }
        };

        var newOnFailure = function(xhr) {
            var commandLine = bespin.get("commandLine");
            if (commandLine) {
                commandLine.showHint('Save failed: ' + xhr.responseText);
            }

            if (util.isFunction(onFailure)) {
                onFailure();
            }
        };

        bespin.publish("editor:savefile:before", { filename: filename });

        bespin.get('files').saveFile(project, file, newOnSuccess, newOnFailure);
    },

    /**
     * Observe a request for a file to be opened and start the cycle.
     * <ul>
     * <li>Send event that you are opening up something (openbefore)
     * <li>Ask the file system to load a file (editFile)
     * <li>If the file is loaded send an opensuccess event
     * <li>If the file fails to load, send an openfail event
     * </ul>
     * @param project The project that contains the file to open. null implies
     * the current project
     * @param filename The path to a file inside the given project
     * @param options Object that determines how the file is opened. Values
     * should be under one of the following keys:<ul>
     * <li>fromFileHistory: If a file is opened from the file history then it
     * will not be added to the history.
     * TODO: Surely it should be the job of the history mechanism to avoid
     * duplicates, and potentially promote recently opened files to the top of
     * the list however they were opened?
     * <li>reload: Normally a request to open the current file will be ignored
     * unless 'reload=true' is specified in the options
     * <li>line: The line number to place the cursor at
     * <li>force: If true, will open the file even if it does not exist
     * <li>content: if force===true and the file does not exist then the given
     * content will be used to populate the new file
     * </ul>
     * TODO: Should we have onSuccess and onFailure callbacks?
     */
    openFile: function(project, filename, options) {
        var onFailure, onSuccess;
        var session = bespin.get('editSession');
        var commandLine = bespin.get('commandLine');
        var self = this;

        project = project || session.project;
        filename = filename || session.path;
        options = options || {};
        var fromFileHistory = options.fromFileHistory || false;

        // Short circuit if we are already open at the requested file
        if (session.checkSameFile(project, filename) && !options.reload) {
            if (options.line) {
                commandLine.executeCommand('goto ' + options.line, true);
            }
            return;
        }

        // If the current buffer is dirty, for now, save it
        if (this.dirty && !session.shouldCollaborate()) {
            onFailure = function(xhr) {
                commandLine.showHint("Trying to save current file. Failed: " + xhr.responseText);
            };

            onSuccess = function() {
                self.openFile(project, filename, options);
            };

            this.saveFile(null, null, onSuccess, onFailure);
            return;
        }

        if (options.force) {
            bespin.get('files').whenFileDoesNotExist(project, filename, {
                execute: function() {
                    self.newFile(project, filename, options.content || "");
                },
                elseFailed: function() {
                    // TODO: clone options to avoid changing original
                    options.force = false;
                    self.openFile(project, filename, options);
                }
            });
            return;
        }

        onFailure = function() {
            bespin.publish("editor:openfile:openfail", {
                project: project,
                filename: filename
            });
        };

        onSuccess = function(file) {
            // TODO: We shouldn't need to to this but originally there was
            // no onFailure, and this is how failure was communicated
            if (!file) {
                onFailure();
                return;
            }

            // If collaboration is turned on, we won't know the file contents
            if (file.content !== undefined) {
                self.model.insertDocument(file.content);
                self.cursorManager.moveCursor({ row: 0, col: 0 });
                self.setFocus(true);
            }

            session.setProjectPath(project, filename);

            if (options.line) {
                commandLine.executeCommand('goto ' + options.line, true);
            }

            self._addHistoryItem(project, filename, fromFileHistory);

            bespin.publish("editor:openfile:opensuccess", { project: project, file: file });
        };

        bespin.publish("editor:openfile:openbefore", { project: project, filename: filename });

        bespin.get('files').editFile(project, filename, onSuccess, onFailure);
    },

    /**
     * Manage the file history.
     * TODO: The responsibility for managing history is split between here and
     * session. It's not totally clear where it should live. Refactor.
     */
    _addHistoryItem: function(project, filename, fromFileHistory) {
        var settings = bespin.get("settings");

        // Get the array of lastused files
        var lastUsed = settings.getObject("_lastused");
        if (!lastUsed) {
            lastUsed = [];
        }

        // We want to add this to the top
        var newItem = { project: project, filename: filename };

        if (!fromFileHistory) {
            bespin.get('editSession').addFileToHistory(newItem);
        }

        // Remove newItem from down in the list and place at top
        var cleanLastUsed = [];
        lastUsed.forEach(function(item) {
            if (item.project != newItem.project || item.filename != newItem.filename) {
                cleanLastUsed.unshift(item);
            }
        });
        cleanLastUsed.unshift(newItem);
        lastUsed = cleanLastUsed;

        // Trim to 10 members
        if (lastUsed.length > 10) {
            lastUsed = lastUsed.slice(0, 10);
        }

        // Maybe this should have a _ prefix: but then it does not persist??
        settings.setObject("_lastused", lastUsed);
    }
});
/**
 * Core key listener to decide which actions to run
 */
exports.DefaultEditorKeyListener = SC.Object.extend({
    editor: null,
    skipKeypress: false,
    defaultKeyMap: {},

    // Allow for multiple key maps to be defined
    keyMapDescriptions: { },

    init: function() {
        this.keyMap = this.defaultKeyMap;
    },

    bindKey: function(keyCode, metaKey, ctrlKey, altKey, shiftKey, action, name) {
        this.defaultKeyMap[[keyCode, metaKey, ctrlKey, altKey, shiftKey]] =
            (typeof action == "string") ?
                function() {
                    var toFire = toFire(action);
                    bespin.publish(toFire.name, toFire.args);
                } : action.bind(this.editor.ui.actions);
        if (name) {
            this.keyMapDescriptions[[keyCode, metaKey, ctrlKey, altKey, shiftKey]] = name;
        }
    },

    bindKeyForPlatform: function(keysForPlatforms, action, name, isSelectable) {
        var platform = util.getOS();

        // default to Windows (e.g. Linux often the same)
        var platformKeys = keysForPlatforms[platform] || keysForPlatforms.WINDOWS;
        if (!platformKeys) {
            return;
        }

        var args = keys.fillArguments(platformKeys);
        var bindFunction = (isSelectable) ? "bindKeyStringSelectable" : "bindKeyString";

        this[bindFunction](args.modifiers, keys.toKeyCode(args.key), action, name);
    },

    bindKeyString: function(modifiers, keyCode, action, name) {
        var ctrlKey = (modifiers.toUpperCase().indexOf("CTRL") != -1);
        var altKey = (modifiers.toUpperCase().indexOf("ALT") != -1);
        var metaKey = (modifiers.toUpperCase().indexOf("META") != -1) || (modifiers.toUpperCase().indexOf("APPLE") != -1);
        var shiftKey = (modifiers.toUpperCase().indexOf("SHIFT") != -1);

        // Check for the platform specific key type
        // The magic "CMD" means metaKey for Mac (the APPLE or COMMAND key)
        // and ctrlKey for Windows (CONTROL)
        if (modifiers.toUpperCase().indexOf("CMD") != -1) {
            if (util.isMac) {
                metaKey = true;
            } else {
                ctrlKey = true;
            }
        }
        return this.bindKey(keyCode, metaKey, ctrlKey, altKey, shiftKey, action, name);
    },

    bindKeyStringSelectable: function(modifiers, keyCode, action, name) {
        this.bindKeyString(modifiers, keyCode, action, name);
        this.bindKeyString("SHIFT " + modifiers, keyCode, action);
    },

    /*
     * This is taken from th.KeyHelpers
     */
    getPrintableChar: function(e) {
        if (e.charCode > 255) {
            return false;
        }
        if (e.charCode < 32) {
            return false;
        }
        if ((e.altKey || e.metaKey || e.ctrlKey) && (e.charCode > 65 && e.charCode < 123)) {
            return false;
        }
        return String.fromCharCode(e.charCode);
    },

    onkeydown: function(e) {
        // handle keys only if editor has the focus!
        if (!this.editor.focus) {
            return;
        }

        var args = {
            event: e,
            pos: cursor.copyPos(this.editor.cursorManager.getCursorPosition())
        };
        this.skipKeypress = false;
        this.returnValue = false;

        var action = this.keyMap[[e.keyCode, e.metaKey, e.ctrlKey, e.altKey, e.shiftKey]];

        var hasAction = false;

        if (util.isFunction(action)) {
            hasAction = true;
            try {
                action(args);
            } catch (ex) {
                console.log("Action caused an error! ", ex);
            }
            this.lastAction = action;
        }

        // If a special key is pressed OR if an action is assigned to a given key (e.g. TAB or BACKSPACE)
        if (e.metaKey || e.ctrlKey || e.altKey) {
            this.skipKeypress = true;
            this.returnValue = true;
        }

        // stop going, but allow special strokes to get to the browser
        if (hasAction || !keys.passThroughToBrowser(e)) {
            util.stopEvent(e);
        }
    },

    onkeypress: function(e) {
        // handle keys only if editor has the focus!
        if (!this.editor.focus) {
            return;
        }

        if ( (e.metaKey || e.ctrlKey) && e.charCode >= 48 /*0*/ && e.charCode <= 57 /*9*/) {
            return; // let APPLE || CTRL 0 through 9 get through to the browser
        }

        var charToPrint = this.getPrintableChar(e);

        if (charToPrint) {
            this.skipKeypress = false;
        } else if (this.skipKeypress) {
            if (!keys.passThroughToBrowser(e)) {
                util.stopEvent(e);
            }
            return this.returnValue;
        }

        var args = {
            event: e,
            pos: cursor.copyPos(this.editor.cursorManager.getCursorPosition())
        };
        var actions = this.editor.ui.actions;

        if (charToPrint) {
            args.newchar = String.fromCharCode(e.charCode);
            actions.insertCharacter(args);
        } else { // Allow user to move with the arrow continuously
            var action = this.keyMap[[e.keyCode, e.metaKey, e.ctrlKey, e.altKey, e.shiftKey]];

            if (this.lastAction == action) {
                delete this.lastAction;
            } else if (typeof action == "function") {
               action(args);
            }
        }

        util.stopEvent(e);
    }
});
/**
 * Given an <code>eventString</code> parse out the arguments and configure an
 * event object.
 * <p>For example:<ul>
 * <li><code>command:execute;name=ls,args=bespin</code>
 * <li><code>command:execute</code>
 * </ul>
 */
var toFire = function(eventString) {
    var event = {};
    if (eventString.indexOf(';') < 0) { // just a plain command with no args
        event.name = eventString;
    } else { // split up the args
        var pieces = eventString.split(';');
        event.name = pieces[0];
        event.args = util.queryToObject(pieces[1], ',');
    }
    return event;
};


