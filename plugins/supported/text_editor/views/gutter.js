/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an 'AS IS' basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is
 * Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var util = require('bespin:util/util');

var CanvasView = require('views/canvas').CanvasView;

// TODO need to implement this behavior
// _frameChanged: function() {
//     // We have to be more aggressive than the canvas view alone would be,
//     // because of the possibility that we will have to draw additional line
//     // numbers in the gutter when the height of the text changes.
//     this.setNeedsDisplay();
// }.observes('frame')

/*
 * A view that renders the gutter for the editor.
 *
 * The domNode attribute contains the domNode for this view that should be
 * added to the document appropriately.
 */
exports.GutterView = function(container, editor) {
    CanvasView.call(this, container);

    this.editor = editor;
    this.layoutManager = editor.layoutManager;

    this.padding = { left: 5, right: 10 };
};

exports.GutterView.prototype = new CanvasView();

util.mixin(exports.GutterView.prototype, {
    drawRect: function(rect, context) {
        var theme = this._theme;

        context.fillStyle = theme.backgroundColor;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);

        context.save();

        var padding = this.padding;
        context.translate(padding.left, 0);

        var layoutManager = this.layoutManager;
        var range = layoutManager.characterRangeForBoundingRect(rect);
        var endRow = Math.min(range.end.row,
            layoutManager.textLines.length - 1);
        var lineAscent = layoutManager.lineAscent;

        context.fillStyle = theme.color;
        context.font = this.editor.font;

        for (var row = range.start.row; row <= endRow; row++) {
            // TODO: breakpoints
            context.fillText('' + (row + 1), -0.5,
                layoutManager.lineRectForRow(row).y + lineAscent - 0.5);
        }

        context.restore();
    },

    computeWidth: function() {
        var padding = this.padding;
        var paddingWidth = padding.left + padding.right;

        var lineNumberFont = this.editor.font;

        var layoutManager = this.layoutManager;
        var lineCount = layoutManager.textLines.length;
        var lineCountStr = '' + lineCount;

        var characterWidth = layoutManager.characterWidth;
        var strWidth = characterWidth * lineCountStr.length;

        return strWidth + paddingWidth;
    },
});
