/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import {TPromise} from 'vs/base/common/winjs.base';
import {CommonEditorRegistry, ContextKey, EditorActionDescriptor} from 'vs/editor/common/editorCommonExtensions';
import {EditorAction} from 'vs/editor/common/editorAction';
import EditorCommon = require('vs/editor/common/editorCommon');
import Modes = require('vs/editor/common/modes');
import InPlaceReplaceCommand = require('./inPlaceReplaceCommand');
import {Range} from 'vs/editor/common/core/range';
import {KeyMod, KeyCode} from 'vs/base/common/keyCodes';
import {IEditorWorkerService} from 'vs/editor/common/services/editorWorkerService';

class InPlaceReplace extends EditorAction {

	private static DECORATION = {
		className: 'valueSetReplacement'
	};

	private up:boolean;
	private requestIdPool:number;
	private currentRequest:TPromise<Modes.IInplaceReplaceSupportResult>;
	private decorationRemover:TPromise<void>;
	private decorationIds:string[];
	private editorWorkerService:IEditorWorkerService;

	constructor(
		descriptor:EditorCommon.IEditorActionDescriptorData,
		editor:EditorCommon.ICommonCodeEditor,
		up:boolean,
		@IEditorWorkerService editorWorkerService:IEditorWorkerService
	) {
		super(descriptor, editor);
		this.editorWorkerService = editorWorkerService;
		this.up = up;
		this.requestIdPool = 0;
		this.currentRequest = TPromise.as(<Modes.IInplaceReplaceSupportResult>null);
		this.decorationRemover = TPromise.as(<void>null);
		this.decorationIds = [];
	}

	public run():TPromise<boolean> {

		// cancel any pending request
		this.currentRequest.cancel();

		var selection = this.editor.getSelection(),
			model = this.editor.getModel(),
			support = model.getMode().inplaceReplaceSupport,
			modelURI = model.getAssociatedResource();

		if(selection.startLineNumber !== selection.endLineNumber) {
			// Can't accept multiline selection
			return null;
		}

		var state = this.editor.captureState(EditorCommon.CodeEditorStateFlag.Value, EditorCommon.CodeEditorStateFlag.Position);

		this.currentRequest = this.editorWorkerService.navigateValueSet(modelURI, selection, this.up);
		this.currentRequest = this.currentRequest.then((basicResult) => {
			if (basicResult && basicResult.range && basicResult.value) {
				return basicResult;
			}

			if (support) {
				return support.navigateValueSet(modelURI, selection, this.up);
			}

			return null;
		});

		return this.currentRequest.then((result:Modes.IInplaceReplaceSupportResult) => {

			if(!result || !result.range || !result.value) {
				// No proper result
				return;
			}

			if(!state.validate(this.editor)) {
				// state has changed
				return;
			}

			// Selection
			var editRange = Range.lift(result.range),
				highlightRange = result.range,
				diff = result.value.length - (selection.endColumn - selection.startColumn);

			// highlight
			highlightRange.endColumn = highlightRange.startColumn + result.value.length;
			selection.endColumn += diff > 1 ? (diff - 1) : 0;

			// Insert new text
			var command = new InPlaceReplaceCommand.InPlaceReplaceCommand(editRange, selection, result.value);
			this.editor.executeCommand(this.id, command);

			// add decoration
			this.decorationIds = this.editor.deltaDecorations(this.decorationIds, [{
				range: highlightRange,
				options: InPlaceReplace.DECORATION
			}]);

			// remove decoration after delay
			this.decorationRemover.cancel();
			this.decorationRemover = TPromise.timeout(350);
			this.decorationRemover.then(() => {
				this.editor.changeDecorations((accessor:EditorCommon.IModelDecorationsChangeAccessor) => {
					this.decorationIds = accessor.deltaDecorations(this.decorationIds, []);
				});
			});

			return true;
		});
	}
}

class InPlaceReplaceUp extends InPlaceReplace {

	public static ID = 'editor.action.inPlaceReplace.up';

	constructor(
		descriptor:EditorCommon.IEditorActionDescriptorData,
		editor:EditorCommon.ICommonCodeEditor,
		@IEditorWorkerService editorWorkerService:IEditorWorkerService
	) {
		super(descriptor, editor, true, editorWorkerService);
	}
}

class InPlaceReplaceDown extends InPlaceReplace {

	public static ID = 'editor.action.inPlaceReplace.down';

	constructor(
		descriptor:EditorCommon.IEditorActionDescriptorData,
		editor:EditorCommon.ICommonCodeEditor,
		@IEditorWorkerService editorWorkerService:IEditorWorkerService
	) {
		super(descriptor, editor, false, editorWorkerService);
	}
}

// register actions
CommonEditorRegistry.registerEditorAction(new EditorActionDescriptor(InPlaceReplaceUp, InPlaceReplaceUp.ID, nls.localize('InPlaceReplaceAction.previous.label', "Replace with Previous Value"), {
	context: ContextKey.EditorTextFocus,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.US_COMMA
}));
CommonEditorRegistry.registerEditorAction(new EditorActionDescriptor(InPlaceReplaceDown, InPlaceReplaceDown.ID, nls.localize('InPlaceReplaceAction.next.label', "Replace with Next Value"), {
	context: ContextKey.EditorTextFocus,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.US_DOT
}));
