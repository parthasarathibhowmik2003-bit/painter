/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Tool = 'pencil' | 'brush' | 'eraser' | 'rect' | 'circle' | 'line';

export interface DrawingState {
  tool: Tool;
  color: string;
  size: number;
}

export const COLORS = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'
];
