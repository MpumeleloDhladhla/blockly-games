/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Decide when a dragged block is really over a delete area.
 *
 * Blockly's flyout and trashcan delete a block when the pointer is inside
 * their recorded rectangle. The flyout rectangle covers the whole toolbox
 * and everything to its left. A maze block is wider than the distance from
 * a typical grab point to that edge, so the block sits on the white workspace
 * while the pointer is still over the grey toolbox. Releasing there used to
 * throw the block away. Maze level 2 is the first level that needs a second
 * block, so that is where it showed up.
 *
 * The block's own center is the signal: the toolbox still deletes a block
 * that was dragged back onto it, and the trashcan still deletes a block
 * dropped on the can. A block whose center is on the workspace is kept.
 */
'use strict';

goog.provide('BlocklyGames.DeleteArea');


/**
 * True when the center of a dragged block lies inside a delete rectangle.
 * Coordinates are viewport pixels, the same space as getBoundingClientRect
 * and Blockly's drag-target rects.
 * @param {?{left: number, right: number, top: number, bottom: number}} blockBox
 *     The dragged block's border box.
 * @param {?{left: number, right: number, top: number, bottom: number}} area
 *     The delete area's rectangle.
 * @returns {boolean} True if the block center is inside the area.
 */
BlocklyGames.DeleteArea.blockCenterInside = function(blockBox, area) {
  if (!blockBox || !area) {
    return false;
  }
  if (!(blockBox.right > blockBox.left) || !(blockBox.bottom > blockBox.top)) {
    return false;
  }
  const cx = (blockBox.left + blockBox.right) / 2;
  const cy = (blockBox.top + blockBox.bottom) / 2;
  return cx >= area.left && cx <= area.right &&
      cy >= area.top && cy <= area.bottom;
};

/**
 * True when a dragged block's center is outside a delete area.
 * containsFn is Rect.contains bound to that area. The game calls it this
 * way so the compiled bundle can keep using Blockly's rectangle fields,
 * which advanced compilation renames, while the block's border box is a
 * DOMRect whose left/top stay under those names.
 * @param {number} left Block border-box left, in viewport pixels.
 * @param {number} right Block border-box right.
 * @param {number} top Block border-box top.
 * @param {number} bottom Block border-box bottom.
 * @param {?function(number, number): boolean} containsFn Hit test for the
 *     delete area, in the same pixel space.
 * @returns {boolean} True if the block center is outside the area.
 */
BlocklyGames.DeleteArea.centerOutside = function(
    left, right, top, bottom, containsFn) {
  if (!(right > left) || !(bottom > top) || !containsFn) {
    return false;
  }
  return !containsFn((left + right) / 2, (top + bottom) / 2);
};
