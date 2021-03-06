/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {Range} from 'vs/editor/common/core/range';
import Position = require('vs/editor/common/core/position');
import EditorCommon = require('vs/editor/common/editorCommon');
import {testApplyEditsWithSyncedModels} from 'vs/editor/test/common/model/editableTextModelTestUtils';

const GENERATE_TESTS = false;

suite('EditorModel Auto Tests', () => {
	function editOp(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number, text:string[]): EditorCommon.IIdentifiedSingleEditOperation {
		return {
			identifier: null,
			range: new Range(startLineNumber, startColumn, endLineNumber, endColumn),
			text: text.join('\n'),
			forceMoveMarkers: false
		};
	}

	test('auto1', () => {
		testApplyEditsWithSyncedModels(
			[
					'ioe',
					'',
					'yjct',
					'',
					'',
			],
			[
				editOp(1, 2, 1, 2, ['b', 'r', 'fq']),
				editOp(1, 4, 2, 1, ['', '']),
			],
			[
					'ib',
					'r',
					'fqoe',
					'',
					'yjct',
					'',
					'',
			]
		);
	});

	test('auto2', () => {
		testApplyEditsWithSyncedModels(
			[
					'f',
					'littnhskrq',
					'utxvsizqnk',
					'lslqz',
					'jxn',
					'gmm',
			],
			[
					editOp(1, 2, 1, 2, ['', 'o']),
					editOp(2, 4, 2, 4, ['zaq', 'avb']),
					editOp(2, 5, 6, 2, ['jlr', 'zl', 'j']),
			],
			[
					'f',
					'o',
					'litzaq',
					'avbtjlr',
					'zl',
					'jmm',
			]
		);
	});

	test('auto3', () => {
		testApplyEditsWithSyncedModels(
			[
					'ofw',
					'qsxmziuvzw',
					'rp',
					'qsnymek',
					'elth',
					'wmgzbwudxz',
					'iwsdkndh',
					'bujlbwb',
					'asuouxfv',
					'xuccnb',
			],
			[
					editOp(4, 3, 4, 3, ['']),
			],
			[
					'ofw',
					'qsxmziuvzw',
					'rp',
					'qsnymek',
					'elth',
					'wmgzbwudxz',
					'iwsdkndh',
					'bujlbwb',
					'asuouxfv',
					'xuccnb',
			]
		);
	});
});

function getRandomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomString(minLength: number, maxLength: number): string {
	let length = getRandomInt(minLength, maxLength);
	let r = '';
	for (let i = 0; i < length; i++) {
		r += String.fromCharCode(getRandomInt('a'.charCodeAt(0), 'z'.charCodeAt(0)));
	}
	return r;
}

function generateFile(small:boolean): string {
	let lineCount = getRandomInt(1, small ? 3 : 10);
	let lines: string[] = [];
	for (let i = 0; i < lineCount; i++) {
		lines.push(getRandomString(0, small ? 3 : 10));
	}
	return lines.join('\n');
}

function generateEdits(content:string): ITestModelEdit[] {

	let result:ITestModelEdit[] = [];
	let cnt = getRandomInt(1, 5);

	let maxOffset = content.length;

	while (cnt > 0 && maxOffset > 0) {

		let offset = getRandomInt(0, maxOffset);
		let length = getRandomInt(0, maxOffset - offset);

		result.push({
			offset: offset,
			length: length,
			text: generateFile(true)
		});

		maxOffset = offset - 1;
		cnt--;
	}

	result.reverse();

	return result;
}

interface ITestModelEdit {
	offset: number;
	length: number;
	text: string;
}

class TestModel {

	public initialContent: string;
	public resultingContent: string;
	public edits: EditorCommon.IIdentifiedSingleEditOperation[];

	constructor() {
		this.initialContent = generateFile(false);

		let edits = generateEdits(this.initialContent);
		let currentEditIdx = 0;
		let lineNumber = 1;
		let column = 1;

		let editStartPosition: Position.Position = null;
		this.edits = [];
		for (let offset = 0, len = this.initialContent.length; currentEditIdx < edits.length && offset <= len; offset++) {
			let ch = this.initialContent.charAt(offset);

			if (!editStartPosition) {
				if (offset === edits[currentEditIdx].offset) {
					editStartPosition = new Position.Position(lineNumber, column);
				}
			}

			if (editStartPosition) {
				if (offset === edits[currentEditIdx].offset + edits[currentEditIdx].length) {
					this.edits.push({
						identifier: null,
						range: new Range(editStartPosition.lineNumber, editStartPosition.column, lineNumber, column),
						text: edits[currentEditIdx].text,
						forceMoveMarkers: false
					});
					currentEditIdx++;
					editStartPosition = null;
				}
			}

			if (ch === '\n') {
				lineNumber++;
				column = 1;
			} else {
				column++;
			}
		}

		this.resultingContent = this.initialContent;
		for (let i = edits.length - 1; i >= 0; i--) {
			this.resultingContent = (
				this.resultingContent.substring(0, edits[i].offset) +
				edits[i].text +
				this.resultingContent.substring(edits[i].offset + edits[i].length)
			);
		}
	}

	public print(): string {
		let r: string[] = [];
		r.push('testApplyEditsWithSyncedModels(');
		r.push('\t[');
		let initialLines = this.initialContent.split('\n');
		r = r.concat(initialLines.map((i) => `\t\t'${i}',`));
		r.push('\t],');
		r.push('\t[');
		r = r.concat(this.edits.map((i) => {
			let text = `['` + i.text.split('\n').join(`', '`) + `']`;
			return `\t\teditOp(${i.range.startLineNumber}, ${i.range.startColumn}, ${i.range.endLineNumber}, ${i.range.endColumn}, ${text}),`;
		}));
		r.push('\t],');
		r.push('\t[');
		let resultLines = this.resultingContent.split('\n');
		r = r.concat(resultLines.map((i) => `\t\t'${i}',`));
		r.push('\t]');
		r.push(');');

		return r.join('\n');
	}
}

if (GENERATE_TESTS) {
	let number = 1;
	while(true) {

		console.log('------BEGIN NEW TEST: ' + number);

		let testModel = new TestModel();

		console.log(testModel.print());

		console.log('------END NEW TEST: ' + (number++));

		try {
			testApplyEditsWithSyncedModels(
				testModel.initialContent.split('\n'),
				testModel.edits,
				testModel.resultingContent.split('\n')
			);
			// throw new Error('a');
		} catch(err) {
			console.log('bubu');
			console.log(testModel.print());
			break;
		}

		// break;
	}

}
