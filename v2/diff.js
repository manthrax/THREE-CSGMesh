// <syntaxhighlight lang="JavaScript">

// ==UserScript==
// @name        wikEd diff
// @version     1.2.4
// @date        October 23, 2014
// @description improved word-based diff library with block move detection
// @homepage    https://en.wikipedia.org/wiki/User:Cacycle/diff
// @source      https://en.wikipedia.org/wiki/User:Cacycle/diff.js
// @author      Cacycle (https://en.wikipedia.org/wiki/User:Cacycle)
// @license     released into the public domain
// ==/UserScript==

/**
 * wikEd diff: inline-style difference engine with block move support
 *
 * Improved JavaScript diff library that returns html/css-formatted new text version with
 * highlighted deletions, insertions, and block moves. It is compatible with all browsers and is
 * not dependent on external libraries.
 *
 * WikEdDiff.php and the JavaScript library wikEd diff are synced one-to-one ports. Changes and
 * fixes are to be applied to both versions.
 *
 * JavaScript library (mirror): https://en.wikipedia.org/wiki/User:Cacycle/diff
 * JavaScript online tool: http://cacycle.altervista.org/wikEd-diff-tool.html
 * MediaWiki extension: https://www.mediawiki.org/wiki/Extension:wikEdDiff
 *
 * This difference engine applies a word-based algorithm that uses unique words as anchor points
 * to identify matching text and moved blocks (Paul Heckel: A technique for isolating differences
 * between files. Communications of the ACM 21(4):264 (1978)).
 *
 * Additional features:
 *
 * - Visual inline style, changes are shown in a single output text
 * - Block move detection and highlighting
 * - Resolution down to characters level
 * - Unicode and multilingual support
 * - Stepwise split (paragraphs, lines, sentences, words, characters)
 * - Recursive diff
 * - Optimized code for resolving unmatched sequences
 * - Minimization of length of moved blocks
 * - Alignment of ambiguous unmatched sequences to next line break or word border
 * - Clipping of unchanged irrelevant parts from the output (optional)
 * - Fully customizable
 * - Text split optimized for MediaWiki source texts
 * - Well commented and documented code
 *
 * Datastructures (abbreviations from publication):
 *
 * class WikEdDiffText:  diff text object (new or old version)
 *   .text                 text of version
 *   .words[]              word count table
 *   .first                index of first token in tokens list
 *   .last                 index of last token in tokens list
 *
 *   .tokens[]:          token list for new or old string (doubly-linked list) (N and O)
 *     .prev               previous list item
 *     .next               next list item
 *     .token              token string
 *     .link               index of corresponding token in new or old text (OA and NA)
 *     .number             list enumeration number
 *     .unique             token is unique word in text
 *
 * class WikEdDiff:      diff object
 *   .config[]:            configuration settings, see top of code for customization options
 *      .regExp[]:            all regular expressions
 *          .split             regular expressions used for splitting text into tokens
 *      .htmlCode            HTML code fragments used for creating the output
 *      .msg                 output messages
 *   .newText              new text
 *   .oldText              old text
 *   .maxWords             word count of longest linked block
 *   .html                 diff html
 *   .error                flag: result has not passed unit tests
 *   .bordersDown[]        linked region borders downwards, [new index, old index]
 *   .bordersUp[]          linked region borders upwards, [new index, old index]
 *   .symbols:             symbols table for whole text at all refinement levels
 *     .token[]              hash table of parsed tokens for passes 1 - 3, points to symbol[i]
 *     .symbol[]:            array of objects that hold token counters and pointers:
 *       .newCount             new text token counter (NC)
 *       .oldCount             old text token counter (OC)
 *       .newToken             token index in text.newText.tokens
 *       .oldToken             token index in text.oldText.tokens
 *     .linked               flag: at least one unique token pair has been linked
 *
 *   .blocks[]:            array, block data (consecutive text tokens) in new text order
 *     .oldBlock             number of block in old text order
 *     .newBlock             number of block in new text order
 *     .oldNumber            old text token number of first token
 *     .newNumber            new text token number of first token
 *     .oldStart             old text token index of first token
 *     .count                number of tokens
 *     .unique               contains unique linked token
 *     .words                word count
 *     .chars                char length
 *     .type                 '=', '-', '+', '|' (same, deletion, insertion, mark)
 *     .section              section number
 *     .group                group number of block
 *     .fixed                belongs to a fixed (not moved) group
 *     .moved                moved block group number corresponding with mark block
 *     .text                 text of block tokens
 *
 *   .sections[]:          array, block sections with no block move crosses outside a section
 *     .blockStart           first block in section
 *     .blockEnd             last block in section

 *   .groups[]:            array, section blocks that are consecutive in old text order
 *     .oldNumber            first block oldNumber
 *     .blockStart           first block index
 *     .blockEnd             last block index
 *     .unique               contains unique linked token
 *     .maxWords             word count of longest linked block
 *     .words                word count
 *     .chars                char count
 *     .fixed                not moved from original position
 *     .movedFrom            group position this group has been moved from
 *     .color                color number of moved group
 *
 *   .fragments[]:         diff fragment list ready for markup, abstraction layer for customization
 *     .text                 block or mark text
 *     .color                moved block or mark color number
 *     .type                 '=', '-', '+'   same, deletion, insertion
 *                           '<', '>'        mark left, mark right
 *                           '(<', '(>', ')' block start and end
 *                           '~', ' ~', '~ ' omission indicators
 *                           '[', ']', ','   fragment start and end, fragment separator
 *                           '{', '}'        container start and end
 *
 */

// JSHint options
/* jshint -W004, -W100, newcap: true, browser: true, jquery: true, sub: true, bitwise: true,
	curly: true, evil: true, forin: true, freeze: true, globalstrict: true, immed: true,
	latedef: true, loopfunc: true, quotmark: single, strict: true, undef: true */
/* global console */

// Turn on ECMAScript 5 strict mode
'use strict';

/** Define global objects. */
var wikEdDiffConfig;
var WED;


/**
 * wikEd diff main class.
 *
 * @class WikEdDiff
 */
var WikEdDiff = function () {

	/** @var array config Configuration and customization settings. */
	this.config = {

		/** Core diff settings (with default values). */

		/**
		 * @var bool config.fullDiff
		 *   Show complete un-clipped diff text (false)
		 */
		'fullDiff': false,

		/**
		 * @var bool config.showBlockMoves
		 *   Enable block move layout with highlighted blocks and marks at the original positions (true)
		 */
		'showBlockMoves': true,

		/**
		 * @var bool config.charDiff
		 *   Enable character-refined diff (true)
		 */
		'charDiff': true,

		/**
		 * @var bool config.repeatedDiff
		 *   Enable repeated diff to resolve problematic sequences (true)
		 */
		'repeatedDiff': true,

		/**
		 * @var bool config.recursiveDiff
		 *   Enable recursive diff to resolve problematic sequences (true)
		 */
		'recursiveDiff': true,

		/**
		 * @var int config.recursionMax
		 *   Maximum recursion depth (10)
		 */
		'recursionMax': 10,

		/**
		 * @var bool config.unlinkBlocks
		 *   Reject blocks if they are too short and their words are not unique,
		 *   prevents fragmentated diffs for very different versions (true)
		 */
		'unlinkBlocks': true,

		/**
		 * @var int config.unlinkMax
		 *   Maximum number of rejection cycles (5)
		 */
		'unlinkMax': 5,

		/**
		 * @var int config.blockMinLength
		 *   Reject blocks if shorter than this number of real words (3)
		 */
		'blockMinLength': 3,

		/**
		 * @var bool config.coloredBlocks
		 *   Display blocks in differing colors (rainbow color scheme) (false)
		 */
		'coloredBlocks': false,

		/**
		 * @var bool config.coloredBlocks
		 *   Do not use UniCode block move marks (legacy browsers) (false)
		 */
		'noUnicodeSymbols': false,

		/**
		 * @var bool config.stripTrailingNewline
		 *   Strip trailing newline off of texts (true in .js, false in .php)
		 */
		'stripTrailingNewline': true,

		/**
		 * @var bool config.debug
		 *   Show debug infos and stats (block, group, and fragment data) in debug console (false)
		 */
		'debug': false,

		/**
		 * @var bool config.timer
		 *   Show timing results in debug console (false)
		 */
		'timer': false,

		/**
		 * @var bool config.unitTesting
		 *   Run unit tests to prove correct working, display results in debug console (false)
		 */
		'unitTesting': false,

		/** RegExp character classes. */

		// UniCode letter support for regexps
		// From http://xregexp.com/addons/unicode/unicode-base.js v1.0.0
		'regExpLetters':
			'a-zA-Z0-9' + (
				'00AA00B500BA00C0-00D600D8-00F600F8-02C102C6-02D102E0-02E402EC02EE0370-037403760377037A-' +
				'037D03860388-038A038C038E-03A103A3-03F503F7-0481048A-05270531-055605590561-058705D0-05EA' +
				'05F0-05F20620-064A066E066F0671-06D306D506E506E606EE06EF06FA-06FC06FF07100712-072F074D-' +
				'07A507B107CA-07EA07F407F507FA0800-0815081A082408280840-085808A008A2-08AC0904-0939093D' +
				'09500958-09610971-09770979-097F0985-098C098F09900993-09A809AA-09B009B209B6-09B909BD09CE' +
				'09DC09DD09DF-09E109F009F10A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A39' +
				'0A59-0A5C0A5E0A72-0A740A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD0AD00AE0' +
				'0AE10B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D0B5C0B5D0B5F-0B610B710B83' +
				'0B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BD00C05-0C0C' +
				'0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D0C580C590C600C610C85-0C8C0C8E-0C900C92-0CA80CAA-' +
				'0CB30CB5-0CB90CBD0CDE0CE00CE10CF10CF20D05-0D0C0D0E-0D100D12-0D3A0D3D0D4E0D600D610D7A-' +
				'0D7F0D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60E01-0E300E320E330E40-0E460E810E820E840E87' +
				'0E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB00EB20EB30EBD0EC0-0EC4' +
				'0EC60EDC-0EDF0F000F40-0F470F49-0F6C0F88-0F8C1000-102A103F1050-1055105A-105D106110651066' +
				'106E-10701075-1081108E10A0-10C510C710CD10D0-10FA10FC-1248124A-124D1250-12561258125A-125D' +
				'1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-1315' +
				'1318-135A1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA1700-170C170E-17111720-' +
				'17311740-17511760-176C176E-17701780-17B317D717DC1820-18771880-18A818AA18B0-18F51900-191C' +
				'1950-196D1970-19741980-19AB19C1-19C71A00-1A161A20-1A541AA71B05-1B331B45-1B4B1B83-1BA0' +
				'1BAE1BAF1BBA-1BE51C00-1C231C4D-1C4F1C5A-1C7D1CE9-1CEC1CEE-1CF11CF51CF61D00-1DBF1E00-1F15' +
				'1F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FBC1FBE1FC2-1FC4' +
				'1FC6-1FCC1FD0-1FD31FD6-1FDB1FE0-1FEC1FF2-1FF41FF6-1FFC2071207F2090-209C21022107210A-2113' +
				'21152119-211D212421262128212A-212D212F-2139213C-213F2145-2149214E218321842C00-2C2E2C30-' +
				'2C5E2C60-2CE42CEB-2CEE2CF22CF32D00-2D252D272D2D2D30-2D672D6F2D80-2D962DA0-2DA62DA8-2DAE' +
				'2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE2E2F300530063031-3035303B303C3041-' +
				'3096309D-309F30A1-30FA30FC-30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCC' +
				'A000-A48CA4D0-A4FDA500-A60CA610-A61FA62AA62BA640-A66EA67F-A697A6A0-A6E5A717-A71FA722-' +
				'A788A78B-A78EA790-A793A7A0-A7AAA7F8-A801A803-A805A807-A80AA80C-A822A840-A873A882-A8B3' +
				'A8F2-A8F7A8FBA90A-A925A930-A946A960-A97CA984-A9B2A9CFAA00-AA28AA40-AA42AA44-AA4BAA60-' +
				'AA76AA7AAA80-AAAFAAB1AAB5AAB6AAB9-AABDAAC0AAC2AADB-AADDAAE0-AAEAAAF2-AAF4AB01-AB06AB09-' +
				'AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABE2AC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9' +
				'FB00-FB06FB13-FB17FB1DFB1F-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3D' +
				'FD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF21-FF3AFF41-FF5AFF66-FFBEFFC2-FFC7FFCA-' +
				'FFCFFFD2-FFD7FFDA-FFDC'
			).replace( /(\w{4})/g, '\\u$1' ),

		// New line characters without and with \n and \r
		'regExpNewLines': '\\u0085\\u2028',
		'regExpNewLinesAll': '\\n\\r\\u0085\\u2028',

		// Breaking white space characters without \n, \r, and \f
		'regExpBlanks': ' \\t\\x0b\\u2000-\\u200b\\u202f\\u205f\\u3000',

		// Full stops without '.'
		'regExpFullStops':
			'\\u0589\\u06D4\\u0701\\u0702\\u0964\\u0DF4\\u1362\\u166E\\u1803\\u1809' +
			'\\u2CF9\\u2CFE\\u2E3C\\u3002\\uA4FF\\uA60E\\uA6F3\\uFE52\\uFF0E\\uFF61',

		// New paragraph characters without \n and \r
		'regExpNewParagraph': '\\f\\u2029',

		// Exclamation marks without '!'
		'regExpExclamationMarks':
			'\\u01C3\\u01C3\\u01C3\\u055C\\u055C\\u07F9\\u1944\\u1944' +
			'\\u203C\\u203C\\u2048\\u2048\\uFE15\\uFE57\\uFF01',

		// Question marks without '?'
		'regExpQuestionMarks':
			'\\u037E\\u055E\\u061F\\u1367\\u1945\\u2047\\u2049' +
			'\\u2CFA\\u2CFB\\u2E2E\\uA60F\\uA6F7\\uFE56\\uFF1F',

		/** Clip settings. */

		// Find clip position: characters from right
		'clipHeadingLeft':      1500,
		'clipParagraphLeftMax': 1500,
		'clipParagraphLeftMin':  500,
		'clipLineLeftMax':      1000,
		'clipLineLeftMin':       500,
		'clipBlankLeftMax':     1000,
		'clipBlankLeftMin':      500,
		'clipCharsLeft':         500,

		// Find clip position: characters from right
		'clipHeadingRight':      1500,
		'clipParagraphRightMax': 1500,
		'clipParagraphRightMin':  500,
		'clipLineRightMax':      1000,
		'clipLineRightMin':       500,
		'clipBlankRightMax':     1000,
		'clipBlankRightMin':      500,
		'clipCharsRight':         500,

		// Maximum number of lines to search for clip position
		'clipLinesRightMax': 10,
		'clipLinesLeftMax': 10,

		// Skip clipping if ranges are too close
		'clipSkipLines': 5,
		'clipSkipChars': 1000,

		// Css stylesheet
		'cssMarkLeft': '◀',
		'cssMarkRight': '▶',
		'stylesheet':

			// Insert
			'.wikEdDiffInsert {' +
			'font-weight: bold; background-color: #bbddff; ' +
			'color: #222; border-radius: 0.25em; padding: 0.2em 1px; ' +
			'} ' +
			'.wikEdDiffInsertBlank { background-color: #66bbff; } ' +
			'.wikEdDiffFragment:hover .wikEdDiffInsertBlank { background-color: #bbddff; } ' +

			// Delete
			'.wikEdDiffDelete {' +
			'font-weight: bold; background-color: #ffe49c; ' +
			'color: #222; border-radius: 0.25em; padding: 0.2em 1px; ' +
			'} ' +
			'.wikEdDiffDeleteBlank { background-color: #ffd064; } ' +
			'.wikEdDiffFragment:hover .wikEdDiffDeleteBlank { background-color: #ffe49c; } ' +

			// Block
			'.wikEdDiffBlock {' +
			'font-weight: bold; background-color: #e8e8e8; ' +
			'border-radius: 0.25em; padding: 0.2em 1px; margin: 0 1px; ' +
			'} ' +
			'.wikEdDiffBlock { } ' +
			'.wikEdDiffBlock0 { background-color: #ffff80; } ' +
			'.wikEdDiffBlock1 { background-color: #d0ff80; } ' +
			'.wikEdDiffBlock2 { background-color: #ffd8f0; } ' +
			'.wikEdDiffBlock3 { background-color: #c0ffff; } ' +
			'.wikEdDiffBlock4 { background-color: #fff888; } ' +
			'.wikEdDiffBlock5 { background-color: #bbccff; } ' +
			'.wikEdDiffBlock6 { background-color: #e8c8ff; } ' +
			'.wikEdDiffBlock7 { background-color: #ffbbbb; } ' +
			'.wikEdDiffBlock8 { background-color: #a0e8a0; } ' +
			'.wikEdDiffBlockHighlight {' +
			'background-color: #777; color: #fff; ' +
			'border: solid #777; border-width: 1px 0; ' +
			'} ' +

			// Mark
			'.wikEdDiffMarkLeft, .wikEdDiffMarkRight {' +
			'font-weight: bold; background-color: #ffe49c; ' +
			'color: #666; border-radius: 0.25em; padding: 0.2em; margin: 0 1px; ' +
			'} ' +
			'.wikEdDiffMarkLeft:before { content: "{cssMarkLeft}"; } ' +
			'.wikEdDiffMarkRight:before { content: "{cssMarkRight}"; } ' +
			'.wikEdDiffMarkLeft.wikEdDiffNoUnicode:before { content: "<"; } ' +
			'.wikEdDiffMarkRight.wikEdDiffNoUnicode:before { content: ">"; } ' +
			'.wikEdDiffMark { background-color: #e8e8e8; color: #666; } ' +
			'.wikEdDiffMark0 { background-color: #ffff60; } ' +
			'.wikEdDiffMark1 { background-color: #c8f880; } ' +
			'.wikEdDiffMark2 { background-color: #ffd0f0; } ' +
			'.wikEdDiffMark3 { background-color: #a0ffff; } ' +
			'.wikEdDiffMark4 { background-color: #fff860; } ' +
			'.wikEdDiffMark5 { background-color: #b0c0ff; } ' +
			'.wikEdDiffMark6 { background-color: #e0c0ff; } ' +
			'.wikEdDiffMark7 { background-color: #ffa8a8; } ' +
			'.wikEdDiffMark8 { background-color: #98e898; } ' +
			'.wikEdDiffMarkHighlight { background-color: #777; color: #fff; } ' +

			// Wrappers
			'.wikEdDiffContainer { } ' +
			'.wikEdDiffFragment {' +
			'white-space: pre-wrap; background: #fff; border: #bbb solid; ' +
			'border-width: 1px 1px 1px 0.5em; border-radius: 0.5em; font-family: sans-serif; ' +
			'font-size: 88%; line-height: 1.6; box-shadow: 2px 2px 2px #ddd; padding: 1em; margin: 0; ' +
			'} ' +
			'.wikEdDiffNoChange { background: #f0f0f0; border: 1px #bbb solid; border-radius: 0.5em; ' +
			'line-height: 1.6; box-shadow: 2px 2px 2px #ddd; padding: 0.5em; margin: 1em 0; ' +
			'text-align: center; ' +
			'} ' +
			'.wikEdDiffSeparator { margin-bottom: 1em; } ' +
			'.wikEdDiffOmittedChars { } ' +

			// Newline
			'.wikEdDiffNewline:before { content: "¶"; color: transparent; } ' +
			'.wikEdDiffBlock:hover .wikEdDiffNewline:before { color: #aaa; } ' +
			'.wikEdDiffBlockHighlight .wikEdDiffNewline:before { color: transparent; } ' +
			'.wikEdDiffBlockHighlight:hover .wikEdDiffNewline:before { color: #ccc; } ' +
			'.wikEdDiffBlockHighlight:hover .wikEdDiffInsert .wikEdDiffNewline:before, ' +
			'.wikEdDiffInsert:hover .wikEdDiffNewline:before' +
			'{ color: #999; } ' +
			'.wikEdDiffBlockHighlight:hover .wikEdDiffDelete .wikEdDiffNewline:before, ' +
			'.wikEdDiffDelete:hover .wikEdDiffNewline:before' +
			'{ color: #aaa; } ' +

			// Tab
			'.wikEdDiffTab { position: relative; } ' +
			'.wikEdDiffTabSymbol { position: absolute; top: -0.2em; } ' +
			'.wikEdDiffTabSymbol:before { content: "→"; font-size: smaller; color: #ccc; } ' +
			'.wikEdDiffBlock .wikEdDiffTabSymbol:before { color: #aaa; } ' +
			'.wikEdDiffBlockHighlight .wikEdDiffTabSymbol:before { color: #aaa; } ' +
			'.wikEdDiffInsert .wikEdDiffTabSymbol:before { color: #aaa; } ' +
			'.wikEdDiffDelete .wikEdDiffTabSymbol:before { color: #bbb; } ' +

			// Space
			'.wikEdDiffSpace { position: relative; } ' +
			'.wikEdDiffSpaceSymbol { position: absolute; top: -0.2em; left: -0.05em; } ' +
			'.wikEdDiffSpaceSymbol:before { content: "·"; color: transparent; } ' +
			'.wikEdDiffBlock:hover .wikEdDiffSpaceSymbol:before { color: #999; } ' +
			'.wikEdDiffBlockHighlight .wikEdDiffSpaceSymbol:before { color: transparent; } ' +
			'.wikEdDiffBlockHighlight:hover .wikEdDiffSpaceSymbol:before { color: #ddd; } ' +
			'.wikEdDiffBlockHighlight:hover .wikEdDiffInsert .wikEdDiffSpaceSymbol:before,' +
			'.wikEdDiffInsert:hover .wikEdDiffSpaceSymbol:before ' +
			'{ color: #888; } ' +
			'.wikEdDiffBlockHighlight:hover .wikEdDiffDelete .wikEdDiffSpaceSymbol:before,' +
			'.wikEdDiffDelete:hover .wikEdDiffSpaceSymbol:before ' +
			'{ color: #999; } ' +

			// Error
			'.wikEdDiffError .wikEdDiffFragment,' +
			'.wikEdDiffError .wikEdDiffNoChange' +
			'{ background: #faa; }'
	};

	/** Add regular expressions to configuration settings. */

	this.config.regExp = {

		// RegExps for splitting text
		'split': {

			// Split into paragraphs, after double newlines
			'paragraph': new RegExp(
				'(\\r\\n|\\n|\\r){2,}|[' +
				this.config.regExpNewParagraph +
				']',
				'g'
			),

			// Split into lines
			'line': new RegExp(
				'\\r\\n|\\n|\\r|[' +
				this.config.regExpNewLinesAll +
				']',
				'g'
			),

			// Split into sentences /[^ ].*?[.!?:;]+(?= |$)/
			'sentence': new RegExp(
				'[^' +
				this.config.regExpBlanks +
				'].*?[.!?:;' +
				this.config.regExpFullStops +
				this.config.regExpExclamationMarks +
				this.config.regExpQuestionMarks +
				']+(?=[' +
				this.config.regExpBlanks +
				']|$)',
				'g'
			),

			// Split into inline chunks
			'chunk': new RegExp(
				'\\[\\[[^\\[\\]\\n]+\\]\\]|' +       // [[wiki link]]
				'\\{\\{[^\\{\\}\\n]+\\}\\}|' +       // {{template}}
				'\\[[^\\[\\]\\n]+\\]|' +             // [ext. link]
				'<\\/?[^<>\\[\\]\\{\\}\\n]+>|' +     // <html>
				'\\[\\[[^\\[\\]\\|\\n]+\\]\\]\\||' + // [[wiki link|
				'\\{\\{[^\\{\\}\\|\\n]+\\||' +       // {{template|
				'\\b((https?:|)\\/\\/)[^\\x00-\\x20\\s"\\[\\]\\x7f]+', // link
				'g'
			),

			// Split into words, multi-char markup, and chars
			// regExpLetters speed-up: \\w+
			'word': new RegExp(
				'(\\w+|[_' +
				this.config.regExpLetters +
				'])+([\'’][_' +
				this.config.regExpLetters +
				']*)*|\\[\\[|\\]\\]|\\{\\{|\\}\\}|&\\w+;|\'\'\'|\'\'|==+|\\{\\||\\|\\}|\\|-|.',
				'g'
			),

			// Split into chars
			'character': /./g
		},

		// RegExp to detect blank tokens
		'blankOnlyToken': new RegExp(
			'[^' +
			this.config.regExpBlanks +
			this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']'
		),

		// RegExps for sliding gaps: newlines and space/word breaks
		'slideStop': new RegExp(
			'[' +
			this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']$'
		),
		'slideBorder': new RegExp(
			'[' +
			this.config.regExpBlanks +
			']$'
		),

		// RegExps for counting words
		'countWords': new RegExp(
			'(\\w+|[_' +
			this.config.regExpLetters +
			'])+([\'’][_' +
			this.config.regExpLetters +
			']*)*',
			'g'
		),
		'countChunks': new RegExp(
			'\\[\\[[^\\[\\]\\n]+\\]\\]|' +       // [[wiki link]]
			'\\{\\{[^\\{\\}\\n]+\\}\\}|' +       // {{template}}
			'\\[[^\\[\\]\\n]+\\]|' +             // [ext. link]
			'<\\/?[^<>\\[\\]\\{\\}\\n]+>|' +     // <html>
			'\\[\\[[^\\[\\]\\|\\n]+\\]\\]\\||' + // [[wiki link|
			'\\{\\{[^\\{\\}\\|\\n]+\\||' +       // {{template|
			'\\b((https?:|)\\/\\/)[^\\x00-\\x20\\s"\\[\\]\\x7f]+', // link
			'g'
		),

		// RegExp detecting blank-only and single-char blocks
		'blankBlock': /^([^\t\S]+|[^\t])$/,

		// RegExps for clipping
		'clipLine': new RegExp(
			'[' + this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']+',
			'g'
		),
		'clipHeading': new RegExp(
			'( ^|\\n)(==+.+?==+|\\{\\||\\|\\}).*?(?=\\n|$)', 'g' ),
		'clipParagraph': new RegExp(
			'( (\\r\\n|\\n|\\r){2,}|[' +
			this.config.regExpNewParagraph +
			'])+',
			'g'
		),
		'clipBlank': new RegExp(
			'[' +
			this.config.regExpBlanks + ']+',
			'g'
		),
		'clipTrimNewLinesLeft': new RegExp(
			'[' +
			this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']+$',
			'g'
		),
		'clipTrimNewLinesRight': new RegExp(
			'^[' +
			this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']+',
			'g'
		),
		'clipTrimBlanksLeft': new RegExp(
			'[' +
			this.config.regExpBlanks +
			this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']+$',
			'g'
		),
		'clipTrimBlanksRight': new RegExp(
			'^[' +
			this.config.regExpBlanks +
			this.config.regExpNewLinesAll +
			this.config.regExpNewParagraph +
			']+',
			'g'
		)
	};

	/** Add messages to configuration settings. */

	this.config.msg = {
    'wiked-diff-empty': '(No difference)',
    'wiked-diff-same':  '=',
    'wiked-diff-ins':   '+',
    'wiked-diff-del':   '-',
    'wiked-diff-block-left':  '◀',
    'wiked-diff-block-right': '▶',
    'wiked-diff-block-left-nounicode':  '<',
    'wiked-diff-block-right-nounicode': '>',
		'wiked-diff-error': 'Error: diff not consistent with versions!'
	};

	/**
	 * Add output html fragments to configuration settings.
	 * Dynamic replacements:
	 *   {number}: class/color/block/mark/id number
	 *   {title}: title attribute (popup)
	 *   {nounicode}: noUnicodeSymbols fallback
	 */
	this.config.htmlCode = {
		'noChangeStart':
			'<div class="wikEdDiffNoChange" title="' +
			this.config.msg['wiked-diff-same'] +
			'">',
		'noChangeEnd': '</div>',

		'containerStart': '<div class="wikEdDiffContainer" id="wikEdDiffContainer">',
		'containerEnd': '</div>',

		'fragmentStart': '<pre class="wikEdDiffFragment" style="white-space: pre-wrap;">',
		'fragmentEnd': '</pre>',
		'separator': '<div class="wikEdDiffSeparator"></div>',

		'insertStart':
			'<span class="wikEdDiffInsert" title="' +
			this.config.msg['wiked-diff-ins'] +
			'">',
		'insertStartBlank':
			'<span class="wikEdDiffInsert wikEdDiffInsertBlank" title="' +
			this.config.msg['wiked-diff-ins'] +
			'">',
		'insertEnd': '</span>',

		'deleteStart':
			'<span class="wikEdDiffDelete" title="' +
			this.config.msg['wiked-diff-del'] +
			'">',
		'deleteStartBlank':
			'<span class="wikEdDiffDelete wikEdDiffDeleteBlank" title="' +
			this.config.msg['wiked-diff-del'] +
			'">',
		'deleteEnd': '</span>',

		'blockStart':
			'<span class="wikEdDiffBlock"' +
			'title="{title}" id="wikEdDiffBlock{number}"' +
			'onmouseover="wikEdDiffBlockHandler(undefined, this, \'mouseover\');">',
		'blockColoredStart':
			'<span class="wikEdDiffBlock wikEdDiffBlock wikEdDiffBlock{number}"' +
			'title="{title}" id="wikEdDiffBlock{number}"' +
			'onmouseover="wikEdDiffBlockHandler(undefined, this, \'mouseover\');">',
		'blockEnd': '</span>',

		'markLeft':
			'<span class="wikEdDiffMarkLeft{nounicode}"' +
			'title="{title}" id="wikEdDiffMark{number}"' +
			'onmouseover="wikEdDiffBlockHandler(undefined, this, \'mouseover\');"></span>',
		'markLeftColored':
			'<span class="wikEdDiffMarkLeft{nounicode} wikEdDiffMark wikEdDiffMark{number}"' +
			'title="{title}" id="wikEdDiffMark{number}"' +
			'onmouseover="wikEdDiffBlockHandler(undefined, this, \'mouseover\');"></span>',

		'markRight':
			'<span class="wikEdDiffMarkRight{nounicode}"' +
			'title="{title}" id="wikEdDiffMark{number}"' +
			'onmouseover="wikEdDiffBlockHandler(undefined, this, \'mouseover\');"></span>',
		'markRightColored':
			'<span class="wikEdDiffMarkRight{nounicode} wikEdDiffMark wikEdDiffMark{number}"' +
			'title="{title}" id="wikEdDiffMark{number}"' +
			'onmouseover="wikEdDiffBlockHandler(undefined, this, \'mouseover\');"></span>',

		'newline': '<span class="wikEdDiffNewline">\n</span>',
		'tab': '<span class="wikEdDiffTab"><span class="wikEdDiffTabSymbol"></span>\t</span>',
		'space': '<span class="wikEdDiffSpace"><span class="wikEdDiffSpaceSymbol"></span> </span>',

		'omittedChars': '<span class="wikEdDiffOmittedChars">…</span>',

		'errorStart': '<div class="wikEdDiffError" title="Error: diff not consistent with versions!">',
		'errorEnd': '</div>'
	};

	/*
	 * Add JavaScript event handler function to configuration settings
	 * Highlights corresponding block and mark elements on hover and jumps between them on click
	 * Code for use in non-jQuery environments and legacy browsers (at least IE 8 compatible)
	 *
	 * @option Event|undefined event Browser event if available
	 * @option element Node DOM node
	 * @option type string Event type
	 */
	this.config.blockHandler = function ( event, element, type ) {

		// IE compatibility
		if ( event === undefined && window.event !== undefined ) {
			event = window.event;
		}

		// Get mark/block elements
		var number = element.id.replace( /\D/g, '' );
		var block = document.getElementById( 'wikEdDiffBlock' + number );
		var mark = document.getElementById( 'wikEdDiffMark' + number );
		if ( block === null || mark === null ) {
			return;
		}

		// Highlight corresponding mark/block pairs
		if ( type === 'mouseover' ) {
			element.onmouseover = null;
			element.onmouseout = function ( event ) {
				window.wikEdDiffBlockHandler( event, element, 'mouseout' );
			};
			element.onclick = function ( event ) {
				window.wikEdDiffBlockHandler( event, element, 'click' );
			};
			block.className += ' wikEdDiffBlockHighlight';
			mark.className += ' wikEdDiffMarkHighlight';
		}

		// Remove mark/block highlighting
		if ( type === 'mouseout' || type === 'click' ) {
			element.onmouseout = null;
			element.onmouseover = function ( event ) {
				window.wikEdDiffBlockHandler( event, element, 'mouseover' );
			};

			// Reset, allow outside container (e.g. legend)
			if ( type !== 'click' ) {
				block.className = block.className.replace( / wikEdDiffBlockHighlight/g, '' );
				mark.className = mark.className.replace( / wikEdDiffMarkHighlight/g, '' );

				// GetElementsByClassName
				var container = document.getElementById( 'wikEdDiffContainer' );
				if ( container !== null ) {
					var spans = container.getElementsByTagName( 'span' );
					var spansLength = spans.length;
					for ( var i = 0; i < spansLength; i ++ ) {
						if ( spans[i] !== block && spans[i] !== mark ) {
							if ( spans[i].className.indexOf( ' wikEdDiffBlockHighlight' ) !== -1 ) {
								spans[i].className = spans[i].className.replace( / wikEdDiffBlockHighlight/g, '' );
							}
							else if ( spans[i].className.indexOf( ' wikEdDiffMarkHighlight') !== -1 ) {
								spans[i].className = spans[i].className.replace( / wikEdDiffMarkHighlight/g, '' );
							}
						}
					}
				}
			}
		}

		// Scroll to corresponding mark/block element
		if ( type === 'click' ) {

			// Get corresponding element
			var corrElement;
			if ( element === block ) {
				corrElement = mark;
			}
			else {
				corrElement = block;
			}

			// Get element height (getOffsetTop)
			var corrElementPos = 0;
			var node = corrElement;
			do {
				corrElementPos += node.offsetTop;
			} while ( ( node = node.offsetParent ) !== null );

			// Get scroll height
			var top;
			if ( window.pageYOffset !== undefined ) {
				top = window.pageYOffset;
			}
			else {
				top = document.documentElement.scrollTop;
			}

			// Get cursor pos
			var cursor;
			if ( event.pageY !== undefined ) {
				cursor = event.pageY;
			}
			else if ( event.clientY !== undefined ) {
				cursor = event.clientY + top;
			}

			// Get line height
			var line = 12;
			if ( window.getComputedStyle !== undefined ) {
				line = parseInt( window.getComputedStyle( corrElement ).getPropertyValue( 'line-height' ) );
			}

			// Scroll element under mouse cursor
			window.scroll( 0, corrElementPos + top - cursor + line / 2 );
		}
		return;
	};

	/** Internal data structures. */

	/** @var WikEdDiffText newText New text version object with text and token list */
	this.newText = null;

	/** @var WikEdDiffText oldText Old text version object with text and token list */
	this.oldText = null;

	/** @var object symbols Symbols table for whole text at all refinement levels */
	this.symbols = {
		token: [],
		hashTable: {},
		linked: false
	};

	/** @var array bordersDown Matched region borders downwards */
	this.bordersDown = [];

	/** @var array bordersUp Matched region borders upwards */
	this.bordersUp = [];

	/** @var array blocks Block data (consecutive text tokens) in new text order */
	this.blocks = [];

	/** @var int maxWords Maximal detected word count of all linked blocks */
	this.maxWords = 0;

	/** @var array groups Section blocks that are consecutive in old text order */
	this.groups = [];

	/** @var array sections Block sections with no block move crosses outside a section */
	this.sections = [];

	/** @var object timer Debug timer array: string 'label' => float milliseconds. */
	this.timer = {};

	/** @var array recursionTimer Count time spent in recursion level in milliseconds. */
	this.recursionTimer = [];

	/** Output data. */

	/** @var bool error Unit tests have detected a diff error */
	this.error = false;

	/** @var array fragments Diff fragment list for markup, abstraction layer for customization */
	this.fragments = [];

	/** @var string html Html code of diff */
	this.html = '';


	/**
	 * Constructor, initialize settings, load js and css.
	 *
	 * @param[in] object wikEdDiffConfig Custom customization settings
	 * @param[out] object config Settings
	 */

	this.init = function () {

		// Import customizations from wikEdDiffConfig{}
		if ( typeof wikEdDiffConfig === 'object' ) {
			this.deepCopy( wikEdDiffConfig, this.config );
		}

		// Add CSS stylescheet
		this.addStyleSheet( this.config.stylesheet );

		// Load block handler script
		if ( this.config.showBlockMoves === true ) {

			// Add block handler to head if running under Greasemonkey
			if ( typeof GM_info === 'object' ) {
				var script = 'var wikEdDiffBlockHandler = ' + this.config.blockHandler.toString() + ';';
				this.addScript( script );
			}
			else {
				window.wikEdDiffBlockHandler = this.config.blockHandler;
			}
		}
		return;
	};


	/**
	 * Main diff method.
	 *
	 * @param string oldString Old text version
	 * @param string newString New text version
	 * @param[out] array fragment
	 *   Diff fragment list ready for markup, abstraction layer for customized diffs
	 * @param[out] string html Html code of diff
	 * @return string Html code of diff
	 */
	this.diff = function ( oldString, newString ) {

		// Start total timer
		if ( this.config.timer === true ) {
			this.time( 'total' );
		}

		// Start diff timer
		if ( this.config.timer === true ) {
			this.time( 'diff' );
		}

		// Reset error flag
		this.error = false;

		// Strip trailing newline (.js only)
		if ( this.config.stripTrailingNewline === true ) {
			if ( newString.substr( -1 ) === '\n' && oldString.substr( -1 === '\n' ) ) {
				newString = newString.substr( 0, newString.length - 1 );
				oldString = oldString.substr( 0, oldString.length - 1 );
			}
		}

		// Load version strings into WikEdDiffText objects
		this.newText = new WikEdDiff.WikEdDiffText( newString, this );
		this.oldText = new WikEdDiff.WikEdDiffText( oldString, this );

		// Trap trivial changes: no change
		if ( this.newText.text === this.oldText.text ) {
			this.html =
				this.config.htmlCode.containerStart +
				this.config.htmlCode.noChangeStart +
				this.htmlEscape( this.config.msg['wiked-diff-empty'] ) +
				this.config.htmlCode.noChangeEnd +
				this.config.htmlCode.containerEnd;
			return this.html;
		}

		// Trap trivial changes: old text deleted
		if (
			this.oldText.text === '' || (
				this.oldText.text === '\n' &&
				( this.newText.text.charAt( this.newText.text.length - 1 ) === '\n' )
			)
		) {
			this.html =
				this.config.htmlCode.containerStart +
				this.config.htmlCode.fragmentStart +
				this.config.htmlCode.insertStart +
				this.htmlEscape( this.newText.text ) +
				this.config.htmlCode.insertEnd +
				this.config.htmlCode.fragmentEnd +
				this.config.htmlCode.containerEnd;
			return this.html;
		}

		// Trap trivial changes: new text deleted
		if (
			this.newText.text === '' || (
				this.newText.text === '\n' &&
				( this.oldText.text.charAt( this.oldText.text.length - 1 ) === '\n' )
			)
		) {
			this.html =
				this.config.htmlCode.containerStart +
				this.config.htmlCode.fragmentStart +
				this.config.htmlCode.deleteStart +
				this.htmlEscape( this.oldText.text ) +
				this.config.htmlCode.deleteEnd +
				this.config.htmlCode.fragmentEnd +
				this.config.htmlCode.containerEnd;
			return this.html;
		}

		// Split new and old text into paragraps
		if ( this.config.timer === true ) {
			this.time( 'paragraph split' );
		}
		this.newText.splitText( 'paragraph' );
		this.oldText.splitText( 'paragraph' );
		if ( this.config.timer === true ) {
			this.timeEnd( 'paragraph split' );
		}

		// Calculate diff
		this.calculateDiff( 'line' );

		// Refine different paragraphs into lines
		if ( this.config.timer === true ) {
			this.time( 'line split' );
		}
		this.newText.splitRefine( 'line' );
		this.oldText.splitRefine( 'line' );
		if ( this.config.timer === true ) {
			this.timeEnd( 'line split' );
		}

		// Calculate refined diff
		this.calculateDiff( 'line' );

		// Refine different lines into sentences
		if ( this.config.timer === true ) {
			this.time( 'sentence split' );
		}
		this.newText.splitRefine( 'sentence' );
		this.oldText.splitRefine( 'sentence' );
		if ( this.config.timer === true ) {
			this.timeEnd( 'sentence split' );
		}

		// Calculate refined diff
		this.calculateDiff( 'sentence' );

		// Refine different sentences into chunks
		if ( this.config.timer === true ) {
			this.time( 'chunk split' );
		}
		this.newText.splitRefine( 'chunk' );
		this.oldText.splitRefine( 'chunk' );
		if ( this.config.timer === true ) {
			this.timeEnd( 'chunk split' );
		}

		// Calculate refined diff
		this.calculateDiff( 'chunk' );

		// Refine different chunks into words
		if ( this.config.timer === true ) {
			this.time( 'word split' );
		}
		this.newText.splitRefine( 'word' );
		this.oldText.splitRefine( 'word' );
		if ( this.config.timer === true ) {
			this.timeEnd( 'word split' );
		}

		// Calculate refined diff information with recursion for unresolved gaps
		this.calculateDiff( 'word', true );

		// Slide gaps
		if ( this.config.timer === true ) {
			this.time( 'word slide' );
		}
		this.slideGaps( this.newText, this.oldText );
		this.slideGaps( this.oldText, this.newText );
		if ( this.config.timer === true ) {
			this.timeEnd( 'word slide' );
		}

		// Split tokens into chars
		if ( this.config.charDiff === true ) {

			// Split tokens into chars in selected unresolved gaps
			if ( this.config.timer === true ) {
				this.time( 'character split' );
			}
			this.splitRefineChars();
			if ( this.config.timer === true ) {
				this.timeEnd( 'character split' );
			}

			// Calculate refined diff information with recursion for unresolved gaps
			this.calculateDiff( 'character', true );

			// Slide gaps
			if ( this.config.timer === true ) {
				this.time( 'character slide' );
			}
			this.slideGaps( this.newText, this.oldText );
			this.slideGaps( this.oldText, this.newText );
			if ( this.config.timer === true ) {
				this.timeEnd( 'character slide' );
			}
		}

		// Free memory
		this.symbols = undefined;
		this.bordersDown = undefined;
		this.bordersUp = undefined;
		this.newText.words = undefined;
		this.oldText.words = undefined;

		// Enumerate token lists
		this.newText.enumerateTokens();
		this.oldText.enumerateTokens();

		// Detect moved blocks
		if ( this.config.timer === true ) {
			this.time( 'blocks' );
		}
		this.detectBlocks();
		if ( this.config.timer === true ) {
			this.timeEnd( 'blocks' );
		}

		// Free memory
		this.newText.tokens = undefined;
		this.oldText.tokens = undefined;

		// Assemble blocks into fragment table
		this.getDiffFragments();

		// Free memory
		this.blocks = undefined;
		this.groups = undefined;
		this.sections = undefined;

		// Stop diff timer
		if ( this.config.timer === true ) {
			this.timeEnd( 'diff' );
		}

		// Unit tests
		if ( this.config.unitTesting === true ) {

			// Test diff to test consistency between input and output
			if ( this.config.timer === true ) {
				this.time( 'unit tests' );
			}
			this.unitTests();
			if ( this.config.timer === true ) {
				this.timeEnd( 'unit tests' );
			}
		}

		// Clipping
		if ( this.config.fullDiff === false ) {

			// Clipping unchanged sections from unmoved block text
			if ( this.config.timer === true ) {
				this.time( 'clip' );
			}
			this.clipDiffFragments();
			if ( this.config.timer === true ) {
				this.timeEnd( 'clip' );
			}
		}

		// Create html formatted diff code from diff fragments
		if ( this.config.timer === true ) {
			this.time( 'html' );
		}
		this.getDiffHtml();
		if ( this.config.timer === true ) {
			this.timeEnd( 'html' );
		}

		// No change
		if ( this.html === '' ) {
			this.html =
				this.config.htmlCode.containerStart +
				this.config.htmlCode.noChangeStart +
				this.htmlEscape( this.config.msg['wiked-diff-empty'] ) +
				this.config.htmlCode.noChangeEnd +
				this.config.htmlCode.containerEnd;
		}

		// Add error indicator
		if ( this.error === true ) {
			this.html = this.config.htmlCode.errorStart + this.html + this.config.htmlCode.errorEnd;
		}

		// Stop total timer
		if ( this.config.timer === true ) {
			this.timeEnd( 'total' );
		}

		return this.html;
	};


	/**
	 * Split tokens into chars in the following unresolved regions (gaps):
	 *   - One token became connected or separated by space or dash (or any token)
	 *   - Same number of tokens in gap and strong similarity of all tokens:
	 *     - Addition or deletion of flanking strings in tokens
	 *     - Addition or deletion of internal string in tokens
	 *     - Same length and at least 50 % identity
	 *     - Same start or end, same text longer than different text
	 * Identical tokens including space separators will be linked,
	 *   resulting in word-wise char-level diffs
	 *
	 * @param[in/out] WikEdDiffText newText, oldText Text object tokens list
	 */
	this.splitRefineChars = function () {

		/** Find corresponding gaps. */

		// Cycle through new text tokens list
		var gaps = [];
		var gap = null;
		var i = this.newText.first;
		var j = this.oldText.first;
		while ( i !== null ) {

			// Get token links
			var newLink = this.newText.tokens[i].link;
			var oldLink = null;
			if ( j !== null ) {
				oldLink = this.oldText.tokens[j].link;
			}

			// Start of gap in new and old
			if ( gap === null && newLink === null && oldLink === null ) {
				gap = gaps.length;
				gaps.push( {
					newFirst:  i,
					newLast:   i,
					newTokens: 1,
					oldFirst:  j,
					oldLast:   j,
					oldTokens: null,
					charSplit: null
				} );
			}

			// Count chars and tokens in gap
			else if ( gap !== null && newLink === null ) {
				gaps[gap].newLast = i;
				gaps[gap].newTokens ++;
			}

			// Gap ended
			else if ( gap !== null && newLink !== null ) {
				gap = null;
			}

			// Next list elements
			if ( newLink !== null ) {
				j = this.oldText.tokens[newLink].next;
			}
			i = this.newText.tokens[i].next;
		}

		// Cycle through gaps and add old text gap data
		var gapsLength = gaps.length;
		for ( var gap = 0; gap < gapsLength; gap ++ ) {

			// Cycle through old text tokens list
			var j = gaps[gap].oldFirst;
			while (
				j !== null &&
				this.oldText.tokens[j] !== null &&
				this.oldText.tokens[j].link === null
			) {

				// Count old chars and tokens in gap
				gaps[gap].oldLast = j;
				gaps[gap].oldTokens ++;

				j = this.oldText.tokens[j].next;
			}
		}

		/** Select gaps of identical token number and strong similarity of all tokens. */

		var gapsLength = gaps.length;
		for ( var gap = 0; gap < gapsLength; gap ++ ) {
			var charSplit = true;

			// Not same gap length
			if ( gaps[gap].newTokens !== gaps[gap].oldTokens ) {

				// One word became separated by space, dash, or any string
				if ( gaps[gap].newTokens === 1 && gaps[gap].oldTokens === 3 ) {
					var token = this.newText.tokens[ gaps[gap].newFirst ].token;
					var tokenFirst = this.oldText.tokens[ gaps[gap].oldFirst ].token;
					var tokenLast = this.oldText.tokens[ gaps[gap].oldLast ].token;
					if (
						token.indexOf( tokenFirst ) !== 0 ||
						token.indexOf( tokenLast ) !== token.length - tokenLast.length
					) {
						continue;
					}
				}
				else if ( gaps[gap].oldTokens === 1 && gaps[gap].newTokens === 3 ) {
					var token = this.oldText.tokens[ gaps[gap].oldFirst ].token;
					var tokenFirst = this.newText.tokens[ gaps[gap].newFirst ].token;
					var tokenLast = this.newText.tokens[ gaps[gap].newLast ].token;
					if (
						token.indexOf( tokenFirst ) !== 0 ||
						token.indexOf( tokenLast ) !== token.length - tokenLast.length
					) {
						continue;
					}
				}
				else {
					continue;
				}
				gaps[gap].charSplit = true;
			}

			// Cycle through new text tokens list and set charSplit
			else {
				var i = gaps[gap].newFirst;
				var j = gaps[gap].oldFirst;
				while ( i !== null ) {
					var newToken = this.newText.tokens[i].token;
					var oldToken = this.oldText.tokens[j].token;

					// Get shorter and longer token
					var shorterToken;
					var longerToken;
					if ( newToken.length < oldToken.length ) {
						shorterToken = newToken;
						longerToken = oldToken;
					}
					else {
						shorterToken = oldToken;
						longerToken = newToken;
					}

					// Not same token length
					if ( newToken.length !== oldToken.length ) {

						// Test for addition or deletion of internal string in tokens

						// Find number of identical chars from left
						var left = 0;
						while ( left < shorterToken.length ) {
							if ( newToken.charAt( left ) !== oldToken.charAt( left ) ) {
								break;
							}
							left ++;
						}

						// Find number of identical chars from right
						var right = 0;
						while ( right < shorterToken.length ) {
							if (
								newToken.charAt( newToken.length - 1 - right ) !==
								oldToken.charAt( oldToken.length - 1 - right )
							) {
								break;
							}
							right ++;
						}

						// No simple insertion or deletion of internal string
						if ( left + right !== shorterToken.length ) {

							// Not addition or deletion of flanking strings in tokens
							// Smaller token not part of larger token
							if ( longerToken.indexOf( shorterToken ) === -1 ) {

								// Same text at start or end shorter than different text
								if ( left < shorterToken.length / 2 && (right < shorterToken.length / 2) ) {

									// Do not split into chars in this gap
									charSplit = false;
									break;
								}
							}
						}
					}

					// Same token length
					else if ( newToken !== oldToken ) {

						// Tokens less than 50 % identical
						var ident = 0;
						var tokenLength = shorterToken.length;
						for ( var pos = 0; pos < tokenLength; pos ++ ) {
							if ( shorterToken.charAt( pos ) === longerToken.charAt( pos ) ) {
								ident ++;
							}
						}
						if ( ident / shorterToken.length < 0.49 ) {

							// Do not split into chars this gap
							charSplit = false;
							break;
						}
					}

					// Next list elements
					if ( i === gaps[gap].newLast ) {
						break;
					}
					i = this.newText.tokens[i].next;
					j = this.oldText.tokens[j].next;
				}
				gaps[gap].charSplit = charSplit;
			}
		}

		/** Refine words into chars in selected gaps. */

		var gapsLength = gaps.length;
		for ( var gap = 0; gap < gapsLength; gap ++ ) {
			if ( gaps[gap].charSplit === true ) {

				// Cycle through new text tokens list, link spaces, and split into chars
				var i = gaps[gap].newFirst;
				var j = gaps[gap].oldFirst;
				var newGapLength = i - gaps[gap].newLast;
				var oldGapLength = j - gaps[gap].oldLast;
				while ( i !== null || j !== null ) {

					// Link identical tokens (spaces) to keep char refinement to words
					if (
						newGapLength === oldGapLength &&
						this.newText.tokens[i].token === this.oldText.tokens[j].token
					) {
						this.newText.tokens[i].link = j;
						this.oldText.tokens[j].link = i;
					}

					// Refine words into chars
					else {
						if ( i !== null ) {
							this.newText.splitText( 'character', i );
						}
						if ( j !== null ) {
							this.oldText.splitText( 'character', j );
						}
					}

					// Next list elements
					if ( i === gaps[gap].newLast ) {
						i = null;
					}
					if ( j === gaps[gap].oldLast ) {
						j = null;
					}
					if ( i !== null ) {
						i = this.newText.tokens[i].next;
					}
					if ( j !== null ) {
						j = this.oldText.tokens[j].next;
					}
				}
			}
		}
		return;
	};


	/**
	 * Move gaps with ambiguous identical fronts to last newline border or otherwise last word border.
	 *
	 * @param[in/out] wikEdDiffText text, textLinked These two are newText and oldText
	 */
	this.slideGaps = function ( text, textLinked ) {

		var regExpSlideBorder = this.config.regExp.slideBorder;
		var regExpSlideStop = this.config.regExp.slideStop;

		// Cycle through tokens list
		var i = text.first;
		var gapStart = null;
		while ( i !== null ) {

			// Remember gap start
			if ( gapStart === null && text.tokens[i].link === null ) {
				gapStart = i;
			}

			// Find gap end
			else if ( gapStart !== null && text.tokens[i].link !== null ) {
				var gapFront = gapStart;
				var gapBack = text.tokens[i].prev;

				// Slide down as deep as possible
				var front = gapFront;
				var back = text.tokens[gapBack].next;
				if (
					front !== null &&
					back !== null &&
					text.tokens[front].link === null &&
					text.tokens[back].link !== null &&
					text.tokens[front].token === text.tokens[back].token
				) {
					text.tokens[front].link = text.tokens[back].link;
					textLinked.tokens[ text.tokens[front].link ].link = front;
					text.tokens[back].link = null;

					gapFront = text.tokens[gapFront].next;
					gapBack = text.tokens[gapBack].next;

					front = text.tokens[front].next;
					back = text.tokens[back].next;
				}

				// Test slide up, remember last line break or word border
				var front = text.tokens[gapFront].prev;
				var back = gapBack;
				var gapFrontBlankTest = regExpSlideBorder.test( text.tokens[gapFront].token );
				var frontStop = front;
				if ( text.tokens[back].link === null ) {
					while (
						front !== null &&
						back !== null &&
						text.tokens[front].link !== null &&
						text.tokens[front].token === text.tokens[back].token
					) {
						if ( front !== null ) {

							// Stop at line break
							if ( regExpSlideStop.test( text.tokens[front].token ) === true ) {
								frontStop = front;
								break;
							}

							// Stop at first word border (blank/word or word/blank)
							if (
								regExpSlideBorder.test( text.tokens[front].token ) !== gapFrontBlankTest ) {
								frontStop = front;
							}
						}
						front = text.tokens[front].prev;
						back = text.tokens[back].prev;
					}
				}

				// Actually slide up to stop
				var front = text.tokens[gapFront].prev;
				var back = gapBack;
				while (
					front !== null &&
					back !== null &&
					front !== frontStop &&
					text.tokens[front].link !== null &&
					text.tokens[back].link === null &&
					text.tokens[front].token === text.tokens[back].token
				) {
					text.tokens[back].link = text.tokens[front].link;
					textLinked.tokens[ text.tokens[back].link ].link = back;
					text.tokens[front].link = null;

					front = text.tokens[front].prev;
					back = text.tokens[back].prev;
				}
				gapStart = null;
			}
			i = text.tokens[i].next;
		}
		return;
	};


	/**
	 * Calculate diff information, can be called repeatedly during refining.
	 * Links corresponding tokens from old and new text.
	 * Steps:
	 *   Pass 1: parse new text into symbol table
	 *   Pass 2: parse old text into symbol table
	 *   Pass 3: connect unique matching tokens
	 *   Pass 4: connect adjacent identical tokens downwards
	 *   Pass 5: connect adjacent identical tokens upwards
	 *   Repeat with empty symbol table (against crossed-over gaps)
	 *   Recursively diff still unresolved regions downwards with empty symbol table
	 *   Recursively diff still unresolved regions upwards with empty symbol table
	 *
	 * @param array symbols Symbol table object
	 * @param string level Split level: 'paragraph', 'line', 'sentence', 'chunk', 'word', 'character'
	 *
	 * Optionally for recursive or repeated calls:
	 * @param bool repeating Currently repeating with empty symbol table
	 * @param bool recurse Enable recursion
	 * @param int newStart, newEnd, oldStart, oldEnd Text object tokens indices
	 * @param int recursionLevel Recursion level
	 * @param[in/out] WikEdDiffText newText, oldText Text object, tokens list link property
	 */
	this.calculateDiff = function (
		level,
		recurse,
		repeating,
		newStart,
		oldStart,
		up,
		recursionLevel
	) {

		// Set defaults
		if ( repeating === undefined ) { repeating = false; }
		if ( recurse === undefined ) { recurse = false; }
		if ( newStart === undefined ) { newStart = this.newText.first; }
		if ( oldStart === undefined ) { oldStart = this.oldText.first; }
		if ( up === undefined ) { up = false; }
		if ( recursionLevel === undefined ) { recursionLevel = 0; }

		// Start timers
		if ( this.config.timer === true && repeating === false && recursionLevel === 0 ) {
			this.time( level );
		}
		if ( this.config.timer === true && repeating === false ) {
			this.time( level + recursionLevel );
		}

		// Get object symbols table and linked region borders
		var symbols;
		var bordersDown;
		var bordersUp;
		if ( recursionLevel === 0 && repeating === false ) {
			symbols = this.symbols;
			bordersDown = this.bordersDown;
			bordersUp = this.bordersUp;
		}

		// Create empty local symbols table and linked region borders arrays
		else {
			symbols = {
				token: [],
				hashTable: {},
				linked: false
			};
			bordersDown = [];
			bordersUp = [];
		}


		// Updated versions of linked region borders
		var bordersUpNext = [];
		var bordersDownNext = [];

		/**
		 * Pass 1: parse new text into symbol table.
		 */

		// Cycle through new text tokens list
		var i = newStart;
		while ( i !== null ) {
			if ( this.newText.tokens[i].link === null ) {

				// Add new entry to symbol table
				var token = this.newText.tokens[i].token;
				if ( Object.prototype.hasOwnProperty.call( symbols.hashTable, token ) === false ) {
					symbols.hashTable[token] = symbols.token.length;
					symbols.token.push( {
						newCount: 1,
						oldCount: 0,
						newToken: i,
						oldToken: null
					} );
				}

				// Or update existing entry
				else {

					// Increment token counter for new text
					var hashToArray = symbols.hashTable[token];
					symbols.token[hashToArray].newCount ++;
				}
			}

			// Stop after gap if recursing
			else if ( recursionLevel > 0 ) {
				break;
			}

			// Get next token
			if ( up === false ) {
				i = this.newText.tokens[i].next;
			}
			else {
				i = this.newText.tokens[i].prev;
			}
		}

		/**
		 * Pass 2: parse old text into symbol table.
		 */

		// Cycle through old text tokens list
		var j = oldStart;
		while ( j !== null ) {
			if ( this.oldText.tokens[j].link === null ) {

				// Add new entry to symbol table
				var token = this.oldText.tokens[j].token;
				if ( Object.prototype.hasOwnProperty.call( symbols.hashTable, token ) === false ) {
					symbols.hashTable[token] = symbols.token.length;
					symbols.token.push( {
						newCount: 0,
						oldCount: 1,
						newToken: null,
						oldToken: j
					} );
				}

				// Or update existing entry
				else {

					// Increment token counter for old text
					var hashToArray = symbols.hashTable[token];
					symbols.token[hashToArray].oldCount ++;

					// Add token number for old text
					symbols.token[hashToArray].oldToken = j;
				}
			}

			// Stop after gap if recursing
			else if ( recursionLevel > 0 ) {
				break;
			}

			// Get next token
			if ( up === false ) {
				j = this.oldText.tokens[j].next;
			}
			else {
				j = this.oldText.tokens[j].prev;
			}
		}

		/**
		 * Pass 3: connect unique tokens.
		 */

		// Cycle through symbol array
		var symbolsLength = symbols.token.length;
		for ( var i = 0; i < symbolsLength; i ++ ) {

			// Find tokens in the symbol table that occur only once in both versions
			if ( symbols.token[i].newCount === 1 && symbols.token[i].oldCount === 1 ) {
				var newToken = symbols.token[i].newToken;
				var oldToken = symbols.token[i].oldToken;
				var newTokenObj = this.newText.tokens[newToken];
				var oldTokenObj = this.oldText.tokens[oldToken];

				// Connect from new to old and from old to new
				if ( newTokenObj.link === null ) {

					// Do not use spaces as unique markers
					if (
						this.config.regExp.blankOnlyToken.test( newTokenObj.token ) === true
					) {

						// Link new and old tokens
						newTokenObj.link = oldToken;
						oldTokenObj.link = newToken;
						symbols.linked = true;

						// Save linked region borders
						bordersDown.push( [newToken, oldToken] );
						bordersUp.push( [newToken, oldToken] );

						// Check if token contains unique word
						if ( recursionLevel === 0 ) {
							var unique = false;
							if ( level === 'character' ) {
								unique = true;
							}
							else {
								var token = newTokenObj.token;
								var words =
									( token.match( this.config.regExp.countWords ) || [] ).concat(
										( token.match( this.config.regExp.countChunks ) || [] )
									);

								// Unique if longer than min block length
								var wordsLength = words.length;
								if ( wordsLength >= this.config.blockMinLength ) {
									unique = true;
								}

								// Unique if it contains at least one unique word
								else {
									for ( var i = 0;i < wordsLength; i ++ ) {
										var word = words[i];
										if (
											this.oldText.words[word] === 1 &&
											this.newText.words[word] === 1 &&
											Object.prototype.hasOwnProperty.call( this.oldText.words, word ) === true &&
											Object.prototype.hasOwnProperty.call( this.newText.words, word ) === true
										) {
											unique = true;
											break;
										}
									}
								}
							}

							// Set unique
							if ( unique === true ) {
								newTokenObj.unique = true;
								oldTokenObj.unique = true;
							}
						}
					}
				}
			}
		}

		// Continue passes only if unique tokens have been linked previously
		if ( symbols.linked === true ) {

			/**
			 * Pass 4: connect adjacent identical tokens downwards.
			 */

			// Cycle through list of linked new text tokens
			var bordersLength = bordersDown.length;
			for ( var match = 0; match < bordersLength; match ++ ) {
				var i = bordersDown[match][0];
				var j = bordersDown[match][1];

				// Next down
				var iMatch = i;
				var jMatch = j;
				i = this.newText.tokens[i].next;
				j = this.oldText.tokens[j].next;

				// Cycle through new text list gap region downwards
				while (
					i !== null &&
					j !== null &&
					this.newText.tokens[i].link === null &&
					this.oldText.tokens[j].link === null
				) {

					// Connect if same token
					if ( this.newText.tokens[i].token === this.oldText.tokens[j].token ) {
						this.newText.tokens[i].link = j;
						this.oldText.tokens[j].link = i;
					}

					// Not a match yet, maybe in next refinement level
					else {
						bordersDownNext.push( [iMatch, jMatch] );
						break;
					}

					// Next token down
					iMatch = i;
					jMatch = j;
					i = this.newText.tokens[i].next;
					j = this.oldText.tokens[j].next;
				}
			}

			/**
			 * Pass 5: connect adjacent identical tokens upwards.
			 */

			// Cycle through list of connected new text tokens
			var bordersLength = bordersUp.length;
			for ( var match = 0; match < bordersLength; match ++ ) {
				var i = bordersUp[match][0];
				var j = bordersUp[match][1];

				// Next up
				var iMatch = i;
				var jMatch = j;
				i = this.newText.tokens[i].prev;
				j = this.oldText.tokens[j].prev;

				// Cycle through new text gap region upwards
				while (
					i !== null &&
					j !== null &&
					this.newText.tokens[i].link === null &&
					this.oldText.tokens[j].link === null
				) {

					// Connect if same token
					if ( this.newText.tokens[i].token === this.oldText.tokens[j].token ) {
						this.newText.tokens[i].link = j;
						this.oldText.tokens[j].link = i;
					}

					// Not a match yet, maybe in next refinement level
					else {
						bordersUpNext.push( [iMatch, jMatch] );
						break;
					}

					// Next token up
					iMatch = i;
					jMatch = j;
					i = this.newText.tokens[i].prev;
					j = this.oldText.tokens[j].prev;
				}
			}

			/**
			 * Connect adjacent identical tokens downwards from text start.
			 * Treat boundary as connected, stop after first connected token.
			 */

			// Only for full text diff
			if ( recursionLevel === 0 && repeating === false ) {

				// From start
				var i = this.newText.first;
				var j = this.oldText.first;
				var iMatch = null;
				var jMatch = null;

				// Cycle through old text tokens down
				// Connect identical tokens, stop after first connected token
				while (
					i !== null &&
					j !== null &&
					this.newText.tokens[i].link === null &&
					this.oldText.tokens[j].link === null &&
					this.newText.tokens[i].token === this.oldText.tokens[j].token
				) {
					this.newText.tokens[i].link = j;
					this.oldText.tokens[j].link = i;
					iMatch = i;
					jMatch = j;
					i = this.newText.tokens[i].next;
					j = this.oldText.tokens[j].next;
				}
				if ( iMatch !== null ) {
					bordersDownNext.push( [iMatch, jMatch] );
				}

				// From end
				i = this.newText.last;
				j = this.oldText.last;
				iMatch = null;
				jMatch = null;

				// Cycle through old text tokens up
				// Connect identical tokens, stop after first connected token
				while (
					i !== null &&
					j !== null &&
					this.newText.tokens[i].link === null &&
					this.oldText.tokens[j].link === null &&
					this.newText.tokens[i].token === this.oldText.tokens[j].token
				) {
					this.newText.tokens[i].link = j;
					this.oldText.tokens[j].link = i;
					iMatch = i;
					jMatch = j;
					i = this.newText.tokens[i].prev;
					j = this.oldText.tokens[j].prev;
				}
				if ( iMatch !== null ) {
					bordersUpNext.push( [iMatch, jMatch] );
				}
			}

			// Save updated linked region borders to object
			if ( recursionLevel === 0 && repeating === false ) {
				this.bordersDown = bordersDownNext;
				this.bordersUp = bordersUpNext;
			}

			// Merge local updated linked region borders into object
			else {
				this.bordersDown = this.bordersDown.concat( bordersDownNext );
				this.bordersUp = this.bordersUp.concat( bordersUpNext );
			}


			/**
			 * Repeat once with empty symbol table to link hidden unresolved common tokens in cross-overs.
			 * ("and" in "and this a and b that" -> "and this a and b that")
			 */

			if ( repeating === false && this.config.repeatedDiff === true ) {
				var repeat = true;
				this.calculateDiff( level, recurse, repeat, newStart, oldStart, up, recursionLevel );
			}

			/**
			 * Refine by recursively diffing not linked regions with new symbol table.
			 * At word and character level only.
			 * Helps against gaps caused by addition of common tokens around sequences of common tokens.
			 */

			if (
				recurse === true &&
				this.config['recursiveDiff'] === true &&
				recursionLevel < this.config.recursionMax
			) {

				/**
				 * Recursively diff gap downwards.
				 */

				// Cycle through list of linked region borders
				var bordersLength = bordersDownNext.length;
				for ( match = 0; match < bordersLength; match ++ ) {
					var i = bordersDownNext[match][0];
					var j = bordersDownNext[match][1];

					// Next token down
					i = this.newText.tokens[i].next;
					j = this.oldText.tokens[j].next;

					// Start recursion at first gap token pair
					if (
						i !== null &&
						j !== null &&
						this.newText.tokens[i].link === null &&
						this.oldText.tokens[j].link === null
					) {
						var repeat = false;
						var dirUp = false;
						this.calculateDiff( level, recurse, repeat, i, j, dirUp, recursionLevel + 1 );
					}
				}

				/**
				 * Recursively diff gap upwards.
				 */

				// Cycle through list of linked region borders
				var bordersLength = bordersUpNext.length;
				for ( match = 0; match < bordersLength; match ++ ) {
					var i = bordersUpNext[match][0];
					var j = bordersUpNext[match][1];

					// Next token up
					i = this.newText.tokens[i].prev;
					j = this.oldText.tokens[j].prev;

					// Start recursion at first gap token pair
					if (
						i !== null &&
						j !== null &&
						this.newText.tokens[i].link === null &&
						this.oldText.tokens[j].link === null
					) {
						var repeat = false;
						var dirUp = true;
						this.calculateDiff( level, recurse, repeat, i, j, dirUp, recursionLevel + 1 );
					}
				}
			}
		}

		// Stop timers
		if ( this.config.timer === true && repeating === false ) {
			if ( this.recursionTimer[recursionLevel] === undefined ) {
				this.recursionTimer[recursionLevel] = 0;
			}
			this.recursionTimer[recursionLevel] += this.timeEnd( level + recursionLevel, true );
		}
		if ( this.config.timer === true && repeating === false && recursionLevel === 0 ) {
			this.timeRecursionEnd( level );
			this.timeEnd( level );
		}

		return;
	};


	/**
	 * Main method for processing raw diff data, extracting deleted, inserted, and moved blocks.
	 *
	 * Scheme of blocks, sections, and groups (old block numbers):
	 *   Old:      1    2 3D4   5E6    7   8 9 10  11
	 *             |    ‾/-/_    X     |    >|<     |
	 *   New:      1  I 3D4 2  E6 5  N 7  10 9  8  11
	 *   Section:       0 0 0   1 1       2 2  2
	 *   Group:    0 10 111 2  33 4 11 5   6 7  8   9
	 *   Fixed:    .    +++ -  ++ -    .   . -  -   +
	 *   Type:     =  . =-= =  -= =  . =   = =  =   =
	 *
	 * @param[out] array groups Groups table object
	 * @param[out] array blocks Blocks table object
	 * @param[in/out] WikEdDiffText newText, oldText Text object tokens list
	 */
	this.detectBlocks = function () {

		// Debug log
		if ( this.config.debug === true ) {
			this.oldText.debugText( 'Old text' );
			this.newText.debugText( 'New text' );
		}

		// Collect identical corresponding ('=') blocks from old text and sort by new text
		this.getSameBlocks();

		// Collect independent block sections with no block move crosses outside a section
		this.getSections();

		// Find groups of continuous old text blocks
		this.getGroups();

		// Set longest sequence of increasing groups in sections as fixed (not moved)
		this.setFixed();

		// Convert groups to insertions/deletions if maximum block length is too short
		// Only for more complex texts that actually have blocks of minimum block length
		var unlinkCount = 0;
		if (
			this.config.unlinkBlocks === true &&
			this.config.blockMinLength > 0 &&
			this.maxWords >= this.config.blockMinLength
		) {
			if ( this.config.timer === true ) {
				this.time( 'total unlinking' );
			}

			// Repeat as long as unlinking is possible
			var unlinked = true;
			while ( unlinked === true && unlinkCount < this.config.unlinkMax ) {

				// Convert '=' to '+'/'-' pairs
				unlinked = this.unlinkBlocks();

				// Start over after conversion
				if ( unlinked === true ) {
					unlinkCount ++;
					this.slideGaps( this.newText, this.oldText );
					this.slideGaps( this.oldText, this.newText );

					// Repeat block detection from start
					this.maxWords = 0;
					this.getSameBlocks();
					this.getSections();
					this.getGroups();
					this.setFixed();
				}
			}
			if ( this.config.timer === true ) {
				this.timeEnd( 'total unlinking' );
			}
		}

		// Collect deletion ('-') blocks from old text
		this.getDelBlocks();

		// Position '-' blocks into new text order
		this.positionDelBlocks();

		// Collect insertion ('+') blocks from new text
		this.getInsBlocks();

		// Set group numbers of '+' blocks
		this.setInsGroups();

		// Mark original positions of moved groups
		this.insertMarks();

		// Debug log
		if ( this.config.timer === true || this.config.debug === true ) {
			console.log( 'Unlink count: ', unlinkCount );
		}
		if ( this.config.debug === true ) {
			this.debugGroups( 'Groups' );
			this.debugBlocks( 'Blocks' );
		}
		return;
	};


	/**
	 * Collect identical corresponding matching ('=') blocks from old text and sort by new text.
	 *
	 * @param[in] WikEdDiffText newText, oldText Text objects
	 * @param[in/out] array blocks Blocks table object
	 */
	this.getSameBlocks = function () {

		if ( this.config.timer === true ) {
			this.time( 'getSameBlocks' );
		}

		var blocks = this.blocks;

		// Clear blocks array
		blocks.splice( 0 );

		// Cycle through old text to find connected (linked, matched) blocks
		var j = this.oldText.first;
		var i = null;
		while ( j !== null ) {

			// Skip '-' blocks
			while ( j !== null && this.oldText.tokens[j].link === null ) {
				j = this.oldText.tokens[j].next;
			}

			// Get '=' block
			if ( j !== null ) {
				i = this.oldText.tokens[j].link;
				var iStart = i;
				var jStart = j;

				// Detect matching blocks ('=')
				var count = 0;
				var unique = false;
				var text = '';
				while ( i !== null && j !== null && this.oldText.tokens[j].link === i ) {
					text += this.oldText.tokens[j].token;
					count ++;
					if ( this.newText.tokens[i].unique === true ) {
						unique = true;
					}
					i = this.newText.tokens[i].next;
					j = this.oldText.tokens[j].next;
				}

				// Save old text '=' block
				blocks.push( {
					oldBlock:  blocks.length,
					newBlock:  null,
					oldNumber: this.oldText.tokens[jStart].number,
					newNumber: this.newText.tokens[iStart].number,
					oldStart:  jStart,
					count:     count,
					unique:    unique,
					words:     this.wordCount( text ),
					chars:     text.length,
					type:      '=',
					section:   null,
					group:     null,
					fixed:     null,
					moved:     null,
					text:      text
				} );
			}
		}

		// Sort blocks by new text token number
		blocks.sort( function( a, b ) {
			return a.newNumber - b.newNumber;
		} );

		// Number blocks in new text order
		var blocksLength = blocks.length;
		for ( var block = 0; block < blocksLength; block ++ ) {
			blocks[block].newBlock = block;
		}

		if ( this.config.timer === true ) {
			this.timeEnd( 'getSameBlocks' );
		}
		return;
	};


	/**
	 * Collect independent block sections with no block move crosses
	 * outside a section for per-section determination of non-moving fixed groups.
	 *
	 * @param[out] array sections Sections table object
	 * @param[in/out] array blocks Blocks table object, section property
	 */
	this.getSections = function () {

		if ( this.config.timer === true ) {
			this.time( 'getSections' );
		}

		var blocks = this.blocks;
		var sections = this.sections;

		// Clear sections array
		sections.splice( 0 );

		// Cycle through blocks
		var blocksLength = blocks.length;
		for ( var block = 0; block < blocksLength; block ++ ) {

			var sectionStart = block;
			var sectionEnd = block;

			var oldMax = blocks[sectionStart].oldNumber;
			var sectionOldMax = oldMax;

			// Check right
			for ( var j = sectionStart + 1; j < blocksLength; j ++ ) {

				// Check for crossing over to the left
				if ( blocks[j].oldNumber > oldMax ) {
					oldMax = blocks[j].oldNumber;
				}
				else if ( blocks[j].oldNumber < sectionOldMax ) {
					sectionEnd = j;
					sectionOldMax = oldMax;
				}
			}

			// Save crossing sections
			if ( sectionEnd > sectionStart ) {

				// Save section to block
				for ( var i = sectionStart; i <= sectionEnd; i ++ ) {
					blocks[i].section = sections.length;
				}

				// Save section
				sections.push( {
					blockStart:  sectionStart,
					blockEnd:    sectionEnd
				} );
				block = sectionEnd;
			}
		}
		if ( this.config.timer === true ) {
			this.timeEnd( 'getSections' );
		}
		return;
	};


	/**
	 * Find groups of continuous old text blocks.
	 *
	 * @param[out] array groups Groups table object
	 * @param[in/out] array blocks Blocks table object, group property
	 */
	this.getGroups = function () {

		if ( this.config.timer === true ) {
			this.time( 'getGroups' );
		}

		var blocks = this.blocks;
		var groups = this.groups;

		// Clear groups array
		groups.splice( 0 );

		// Cycle through blocks
		var blocksLength = blocks.length;
		for ( var block = 0; block < blocksLength; block ++ ) {
			var groupStart = block;
			var groupEnd = block;
			var oldBlock = blocks[groupStart].oldBlock;

			// Get word and char count of block
			var words = this.wordCount( blocks[block].text );
			var maxWords = words;
			var unique = blocks[block].unique;
			var chars = blocks[block].chars;

			// Check right
			for ( var i = groupEnd + 1; i < blocksLength; i ++ ) {

				// Check for crossing over to the left
				if ( blocks[i].oldBlock !== oldBlock + 1 ) {
					break;
				}
				oldBlock = blocks[i].oldBlock;

				// Get word and char count of block
				if ( blocks[i].words > maxWords ) {
					maxWords = blocks[i].words;
				}
				if ( blocks[i].unique === true ) {
					unique = true;
				}
				words += blocks[i].words;
				chars += blocks[i].chars;
				groupEnd = i;
			}

			// Save crossing group
			if ( groupEnd >= groupStart ) {

				// Set groups outside sections as fixed
				var fixed = false;
				if ( blocks[groupStart].section === null ) {
					fixed = true;
				}

				// Save group to block
				for ( var i = groupStart; i <= groupEnd; i ++ ) {
					blocks[i].group = groups.length;
					blocks[i].fixed = fixed;
				}

				// Save group
				groups.push( {
					oldNumber:  blocks[groupStart].oldNumber,
					blockStart: groupStart,
					blockEnd:   groupEnd,
					unique:     unique,
					maxWords:   maxWords,
					words:      words,
					chars:      chars,
					fixed:      fixed,
					movedFrom:  null,
					color:      null
				} );
				block = groupEnd;

				// Set global word count of longest linked block
				if ( maxWords > this.maxWords ) {
					this.maxWords = maxWords;
				}
			}
		}
		if ( this.config.timer === true ) {
			this.timeEnd( 'getGroups' );
		}
		return;
	};


	/**
	 * Set longest sequence of increasing groups in sections as fixed (not moved).
	 *
	 * @param[in] array sections Sections table object
	 * @param[in/out] array groups Groups table object, fixed property
	 * @param[in/out] array blocks Blocks table object, fixed property
	 */
	this.setFixed = function () {

		if ( this.config.timer === true ) {
			this.time( 'setFixed' );
		}

		var blocks = this.blocks;
		var groups = this.groups;
		var sections = this.sections;

		// Cycle through sections
		var sectionsLength = sections.length;
		for ( var section = 0; section < sectionsLength; section ++ ) {
			var blockStart = sections[section].blockStart;
			var blockEnd = sections[section].blockEnd;

			var groupStart = blocks[blockStart].group;
			var groupEnd = blocks[blockEnd].group;

			// Recusively find path of groups in increasing old group order with longest char length
			var cache = [];
			var maxChars = 0;
			var maxPath = null;

			// Start at each group of section
			for ( var i = groupStart; i <= groupEnd; i ++ ) {
				var pathObj = this.findMaxPath( i, groupEnd, cache );
				if ( pathObj.chars > maxChars ) {
					maxPath = pathObj.path;
					maxChars = pathObj.chars;
				}
			}

			// Mark fixed groups
			var maxPathLength = maxPath.length;
			for ( var i = 0; i < maxPathLength; i ++ ) {
				var group = maxPath[i];
				groups[group].fixed = true;

				// Mark fixed blocks
				for ( var block = groups[group].blockStart; block <= groups[group].blockEnd; block ++ ) {
					blocks[block].fixed = true;
				}
			}
		}
		if ( this.config.timer === true ) {
			this.timeEnd( 'setFixed' );
		}
		return;
	};


	/**
	 * Recusively find path of groups in increasing old group order with longest char length.
	 *
	 * @param int start Path start group
	 * @param int groupEnd Path last group
	 * @param array cache Cache object, contains returnObj for start
	 * @return array returnObj Contains path and char length
	 */
	this.findMaxPath = function ( start, groupEnd, cache ) {

		var groups = this.groups;

		// Find longest sub-path
		var maxChars = 0;
		var oldNumber = groups[start].oldNumber;
		var returnObj = { path: [], chars: 0};
		for ( var i = start + 1; i <= groupEnd; i ++ ) {

			// Only in increasing old group order
			if ( groups[i].oldNumber < oldNumber ) {
				continue;
			}

			// Get longest sub-path from cache (deep copy)
			var pathObj;
			if ( cache[i] !== undefined ) {
				pathObj = { path: cache[i].path.slice(), chars: cache[i].chars };
			}

			// Get longest sub-path by recursion
			else {
				pathObj = this.findMaxPath( i, groupEnd, cache );
			}

			// Select longest sub-path
			if ( pathObj.chars > maxChars ) {
				maxChars = pathObj.chars;
				returnObj = pathObj;
			}
		}

		// Add current start to path
		returnObj.path.unshift( start );
		returnObj.chars += groups[start].chars;

		// Save path to cache (deep copy)
		if ( cache[start] === undefined ) {
			cache[start] = { path: returnObj.path.slice(), chars: returnObj.chars };
		}

		return returnObj;
	};


	/**
	 * Convert matching '=' blocks in groups into insertion/deletion ('+'/'-') pairs
	 * if too short and too common.
	 * Prevents fragmentated diffs for very different versions.
	 *
	 * @param[in] array blocks Blocks table object
	 * @param[in/out] WikEdDiffText newText, oldText Text object, linked property
	 * @param[in/out] array groups Groups table object
	 * @return bool True if text tokens were unlinked
	 */
	this.unlinkBlocks = function () {

		var blocks = this.blocks;
		var groups = this.groups;

		// Cycle through groups
		var unlinked = false;
		var groupsLength = groups.length;
		for ( var group = 0; group < groupsLength; group ++ ) {
			var blockStart = groups[group].blockStart;
			var blockEnd = groups[group].blockEnd;

			// Unlink whole group if no block is at least blockMinLength words long and unique
			if ( groups[group].maxWords < this.config.blockMinLength && groups[group].unique === false ) {
				for ( var block = blockStart; block <= blockEnd; block ++ ) {
					if ( blocks[block].type === '=' ) {
						this.unlinkSingleBlock( blocks[block] );
						unlinked = true;
					}
				}
			}

			// Otherwise unlink block flanks
			else {

				// Unlink blocks from start
				for ( var block = blockStart; block <= blockEnd; block ++ ) {
					if ( blocks[block].type === '=' ) {

						// Stop unlinking if more than one word or a unique word
						if ( blocks[block].words > 1 || blocks[block].unique === true ) {
							break;
						}
						this.unlinkSingleBlock( blocks[block] );
						unlinked = true;
						blockStart = block;
					}
				}

				// Unlink blocks from end
				for ( var block = blockEnd; block > blockStart; block -- ) {
					if ( blocks[block].type === '=' ) {

						// Stop unlinking if more than one word or a unique word
						if (
							blocks[block].words > 1 ||
							( blocks[block].words === 1 && blocks[block].unique === true )
						) {
							break;
						}
						this.unlinkSingleBlock( blocks[block] );
						unlinked = true;
					}
				}
			}
		}
		return unlinked;
	};


	/**
	 * Unlink text tokens of single block, convert them into into insertion/deletion ('+'/'-') pairs.
	 *
	 * @param[in] array blocks Blocks table object
	 * @param[out] WikEdDiffText newText, oldText Text objects, link property
	 */
	this.unlinkSingleBlock = function ( block ) {

		// Cycle through old text
		var j = block.oldStart;
		for ( var count = 0; count < block.count; count ++ ) {

			// Unlink tokens
			this.newText.tokens[ this.oldText.tokens[j].link ].link = null;
			this.oldText.tokens[j].link = null;
			j = this.oldText.tokens[j].next;
		}
		return;
	};


	/**
	 * Collect deletion ('-') blocks from old text.
	 *
	 * @param[in] WikEdDiffText oldText Old Text object
	 * @param[out] array blocks Blocks table object
	 */
	this.getDelBlocks = function () {

		if ( this.config.timer === true ) {
			this.time( 'getDelBlocks' );
		}

		var blocks = this.blocks;

		// Cycle through old text to find connected (linked, matched) blocks
		var j = this.oldText.first;
		var i = null;
		while ( j !== null ) {

			// Collect '-' blocks
			var oldStart = j;
			var count = 0;
			var text = '';
			while ( j !== null && this.oldText.tokens[j].link === null ) {
				count ++;
				text += this.oldText.tokens[j].token;
				j = this.oldText.tokens[j].next;
			}

			// Save old text '-' block
			if ( count !== 0 ) {
				blocks.push( {
					oldBlock:  null,
					newBlock:  null,
					oldNumber: this.oldText.tokens[oldStart].number,
					newNumber: null,
					oldStart:  oldStart,
					count:     count,
					unique:    false,
					words:     null,
					chars:     text.length,
					type:      '-',
					section:   null,
					group:     null,
					fixed:     null,
					moved:     null,
					text:      text
				} );
			}

			// Skip '=' blocks
			if ( j !== null ) {
				i = this.oldText.tokens[j].link;
				while ( i !== null && j !== null && this.oldText.tokens[j].link === i ) {
					i = this.newText.tokens[i].next;
					j = this.oldText.tokens[j].next;
				}
			}
		}
		if ( this.config.timer === true ) {
			this.timeEnd( 'getDelBlocks' );
		}
		return;
	};


	/**
	 * Position deletion '-' blocks into new text order.
	 * Deletion blocks move with fixed reference:
	 *   Old:          1 D 2      1 D 2
	 *                /     \    /   \ \
	 *   New:        1 D     2  1     D 2
	 *   Fixed:      *                  *
	 *   newNumber:  1 1              2 2
	 *
	 * Marks '|' and deletions '-' get newNumber of reference block
	 * and are sorted around it by old text number.
	 *
	 * @param[in/out] array blocks Blocks table, newNumber, section, group, and fixed properties
	 *
	 */
	this.positionDelBlocks = function () {

		if ( this.config.timer === true ) {
			this.time( 'positionDelBlocks' );
		}

		var blocks = this.blocks;
		var groups = this.groups;

		// Sort shallow copy of blocks by oldNumber
		var blocksOld = blocks.slice();
		blocksOld.sort( function( a, b ) {
			return a.oldNumber - b.oldNumber;
		} );

		// Cycle through blocks in old text order
		var blocksOldLength = blocksOld.length;
		for ( var block = 0; block < blocksOldLength; block ++ ) {
			var delBlock = blocksOld[block];

			// '-' block only
			if ( delBlock.type !== '-' ) {
				continue;
			}

			// Find fixed '=' reference block from original block position to position '-' block
			// Similar to position marks '|' code

			// Get old text prev block
			var prevBlockNumber = null;
			var prevBlock = null;
			if ( block > 0 ) {
				prevBlockNumber = blocksOld[block - 1].newBlock;
				prevBlock = blocks[prevBlockNumber];
			}

			// Get old text next block
			var nextBlockNumber = null;
			var nextBlock = null;
			if ( block < blocksOld.length - 1 ) {
				nextBlockNumber = blocksOld[block + 1].newBlock;
				nextBlock = blocks[nextBlockNumber];
			}

			// Move after prev block if fixed
			var refBlock = null;
			if ( prevBlock !== null && prevBlock.type === '=' && prevBlock.fixed === true ) {
				refBlock = prevBlock;
			}

			// Move before next block if fixed
			else if ( nextBlock !== null && nextBlock.type === '=' && nextBlock.fixed === true ) {
				refBlock = nextBlock;
			}

			// Move after prev block if not start of group
			else if (
				prevBlock !== null &&
				prevBlock.type === '=' &&
				prevBlockNumber !== groups[ prevBlock.group ].blockEnd
			) {
				refBlock = prevBlock;
			}

			// Move before next block if not start of group
			else if (
				nextBlock !== null &&
				nextBlock.type === '=' &&
				nextBlockNumber !== groups[ nextBlock.group ].blockStart
			) {
				refBlock = nextBlock;
			}

			// Move after closest previous fixed block
			else {
				for ( var fixed = block; fixed >= 0; fixed -- ) {
					if ( blocksOld[fixed].type === '=' && blocksOld[fixed].fixed === true ) {
						refBlock = blocksOld[fixed];
						break;
					}
				}
			}

			// Move before first block
			if ( refBlock === null ) {
				delBlock.newNumber =  -1;
			}

			// Update '-' block data
			else {
				delBlock.newNumber = refBlock.newNumber;
				delBlock.section = refBlock.section;
				delBlock.group = refBlock.group;
				delBlock.fixed = refBlock.fixed;
			}
		}

		// Sort '-' blocks in and update groups
		this.sortBlocks();

		if ( this.config.timer === true ) {
			this.timeEnd( 'positionDelBlocks' );
		}
		return;
	};


	/**
	 * Collect insertion ('+') blocks from new text.
	 *
	 * @param[in] WikEdDiffText newText New Text object
	 * @param[out] array blocks Blocks table object
	 */
	this.getInsBlocks = function () {

		if ( this.config.timer === true ) {
			this.time( 'getInsBlocks' );
		}

		var blocks = this.blocks;

		// Cycle through new text to find insertion blocks
		var i = this.newText.first;
		while ( i !== null ) {

			// Jump over linked (matched) block
			while ( i !== null && this.newText.tokens[i].link !== null ) {
				i = this.newText.tokens[i].next;
			}

			// Detect insertion blocks ('+')
			if ( i !== null ) {
				var iStart = i;
				var count = 0;
				var text = '';
				while ( i !== null && this.newText.tokens[i].link === null ) {
					count ++;
					text += this.newText.tokens[i].token;
					i = this.newText.tokens[i].next;
				}

				// Save new text '+' block
				blocks.push( {
					oldBlock:  null,
					newBlock:  null,
					oldNumber: null,
					newNumber: this.newText.tokens[iStart].number,
					oldStart:  null,
					count:     count,
					unique:    false,
					words:     null,
					chars:     text.length,
					type:      '+',
					section:   null,
					group:     null,
					fixed:     null,
					moved:     null,
					text:      text
				} );
			}
		}

		// Sort '+' blocks in and update groups
		this.sortBlocks();

		if ( this.config.timer === true ) {
			this.timeEnd( 'getInsBlocks' );
		}
		return;
	};


	/**
	 * Sort blocks by new text token number and update groups.
	 *
	 * @param[in/out] array groups Groups table object
	 * @param[in/out] array blocks Blocks table object
	 */
	this.sortBlocks = function () {

		var blocks = this.blocks;
		var groups = this.groups;

		// Sort by newNumber, then by old number
		blocks.sort( function( a, b ) {
			var comp = a.newNumber - b.newNumber;
			if ( comp === 0 ) {
				comp = a.oldNumber - b.oldNumber;
			}
			return comp;
		} );

		// Cycle through blocks and update groups with new block numbers
		var group = null;
		var blocksLength = blocks.length;
		for ( var block = 0; block < blocksLength; block ++ ) {
			var blockGroup = blocks[block].group;
			if ( blockGroup !== null ) {
				if ( blockGroup !== group ) {
					group = blocks[block].group;
					groups[group].blockStart = block;
					groups[group].oldNumber = blocks[block].oldNumber;
				}
				groups[blockGroup].blockEnd = block;
			}
		}
		return;
	};


	/**
	 * Set group numbers of insertion '+' blocks.
	 *
	 * @param[in/out] array groups Groups table object
	 * @param[in/out] array blocks Blocks table object, fixed and group properties
	 */
	this.setInsGroups = function () {

		if ( this.config.timer === true ) {
			this.time( 'setInsGroups' );
		}

		var blocks = this.blocks;
		var groups = this.groups;

		// Set group numbers of '+' blocks inside existing groups
		var groupsLength = groups.length;
		for ( var group = 0; group < groupsLength; group ++ ) {
			var fixed = groups[group].fixed;
			for ( var block = groups[group].blockStart; block <= groups[group].blockEnd; block ++ ) {
				if ( blocks[block].group === null ) {
					blocks[block].group = group;
					blocks[block].fixed = fixed;
				}
			}
		}

		// Add remaining '+' blocks to new groups

		// Cycle through blocks
		var blocksLength = blocks.length;
		for ( var block = 0; block < blocksLength; block ++ ) {

			// Skip existing groups
			if ( blocks[block].group === null ) {
				blocks[block].group = groups.length;

				// Save new single-block group
				groups.push( {
					oldNumber:  blocks[block].oldNumber,
					blockStart: block,
					blockEnd:   block,
					unique:     blocks[block].unique,
					maxWords:   blocks[block].words,
					words:      blocks[block].words,
					chars:      blocks[block].chars,
					fixed:      blocks[block].fixed,
					movedFrom:  null,
					color:      null
				} );
			}
		}
		if ( this.config.timer === true ) {
			this.timeEnd( 'setInsGroups' );
		}
		return;
	};


	/**
	 * Mark original positions of moved groups.
	 * Scheme: moved block marks at original positions relative to fixed groups:
	 *   Groups:    3       7
	 *           1 <|       |     (no next smaller fixed)
	 *           5  |<      |
	 *              |>  5   |
	 *              |   5  <|
	 *              |      >|   5
	 *              |       |>  9 (no next larger fixed)
	 *   Fixed:     *       *
	 *
	 * Mark direction: groups.movedGroup.blockStart < groups.group.blockStart
	 * Group side:     groups.movedGroup.oldNumber < groups.group.oldNumber
	 *
	 * Marks '|' and deletions '-' get newNumber of reference block
	 * and are sorted around it by old text number.
	 *
	 * @param[in/out] array groups Groups table object, movedFrom property
	 * @param[in/out] array blocks Blocks table object
	 */
	this.insertMarks = function () {

		if ( this.config.timer === true ) {
			this.time( 'insertMarks' );
		}

		var blocks = this.blocks;
		var groups = this.groups;
		var moved = [];
		var color = 1;

		// Make shallow copy of blocks
		var blocksOld = blocks.slice();

		// Enumerate copy
		var blocksOldLength = blocksOld.length;
		for ( var i = 0; i < blocksOldLength; i ++ ) {
			blocksOld[i].number = i;
		}

		// Sort copy by oldNumber
		blocksOld.sort( function( a, b ) {
			var comp = a.oldNumber - b.oldNumber;
			if ( comp === 0 ) {
				comp = a.newNumber - b.newNumber;
			}
			return comp;
		} );

		// Create lookup table: original to sorted
		var lookupSorted = [];
		for ( var i = 0; i < blocksOldLength; i ++ ) {
			lookupSorted[ blocksOld[i].number ] = i;
		}

		// Cycle through groups (moved group)
		var groupsLength = groups.length;
		for ( var moved = 0; moved < groupsLength; moved ++ ) {
			var movedGroup = groups[moved];
			if ( movedGroup.fixed !== false ) {
				continue;
			}
			var movedOldNumber = movedGroup.oldNumber;

			// Find fixed '=' reference block from original block position to position '|' block
			// Similar to position deletions '-' code

			// Get old text prev block
			var prevBlock = null;
			var block = lookupSorted[ movedGroup.blockStart ];
			if ( block > 0 ) {
				prevBlock = blocksOld[block - 1];
			}

			// Get old text next block
			var nextBlock = null;
			var block = lookupSorted[ movedGroup.blockEnd ];
			if ( block < blocksOld.length - 1 ) {
				nextBlock = blocksOld[block + 1];
			}

			// Move after prev block if fixed
			var refBlock = null;
			if ( prevBlock !== null && prevBlock.type === '=' && prevBlock.fixed === true ) {
				refBlock = prevBlock;
			}

			// Move before next block if fixed
			else if ( nextBlock !== null && nextBlock.type === '=' && nextBlock.fixed === true ) {
				refBlock = nextBlock;
			}

			// Find closest fixed block to the left
			else {
				for ( var fixed = lookupSorted[ movedGroup.blockStart ] - 1; fixed >= 0; fixed -- ) {
					if ( blocksOld[fixed].type === '=' && blocksOld[fixed].fixed === true ) {
						refBlock = blocksOld[fixed];
						break;
					}
				}
			}

			// Get position of new mark block
			var newNumber;
			var markGroup;

			// No smaller fixed block, moved right from before first block
			if ( refBlock === null ) {
				newNumber = -1;
				markGroup = groups.length;

				// Save new single-mark-block group
				groups.push( {
					oldNumber:  0,
					blockStart: blocks.length,
					blockEnd:   blocks.length,
					unique:     false,
					maxWords:   null,
					words:      null,
					chars:      0,
					fixed:      null,
					movedFrom:  null,
					color:      null
				} );
			}
			else {
				newNumber = refBlock.newNumber;
				markGroup = refBlock.group;
			}

			// Insert '|' block
			blocks.push( {
				oldBlock:  null,
				newBlock:  null,
				oldNumber: movedOldNumber,
				newNumber: newNumber,
				oldStart:  null,
				count:     null,
				unique:    null,
				words:     null,
				chars:     0,
				type:      '|',
				section:   null,
				group:     markGroup,
				fixed:     true,
				moved:     moved,
				text:      ''
			} );

			// Set group color
			movedGroup.color = color;
			movedGroup.movedFrom = markGroup;
			color ++;
		}

		// Sort '|' blocks in and update groups
		this.sortBlocks();

		if ( this.config.timer === true ) {
			this.timeEnd( 'insertMarks' );
		}
		return;
	};


	/**
	 * Collect diff fragment list for markup, create abstraction layer for customized diffs.
	 * Adds the following fagment types:
	 *   '=', '-', '+'   same, deletion, insertion
	 *   '<', '>'        mark left, mark right
	 *   '(<', '(>', ')' block start and end
	 *   '[', ']'        fragment start and end
	 *   '{', '}'        container start and end
	 *
	 * @param[in] array groups Groups table object
	 * @param[in] array blocks Blocks table object
	 * @param[out] array fragments Fragments array, abstraction layer for diff code
	 */
	this.getDiffFragments = function () {

		var blocks = this.blocks;
		var groups = this.groups;
		var fragments = this.fragments;

		// Make shallow copy of groups and sort by blockStart
		var groupsSort = groups.slice();
		groupsSort.sort( function( a, b ) {
			return a.blockStart - b.blockStart;
		} );

		// Cycle through groups
		var groupsSortLength = groupsSort.length;
		for ( var group = 0; group < groupsSortLength; group ++ ) {
			var blockStart = groupsSort[group].blockStart;
			var blockEnd = groupsSort[group].blockEnd;

			// Add moved block start
			var color = groupsSort[group].color;
			if ( color !== null ) {
				var type;
				if ( groupsSort[group].movedFrom < blocks[ blockStart ].group ) {
					type = '(<';
				}
				else {
					type = '(>';
				}
				fragments.push( {
					text:  '',
					type:  type,
					color: color
				} );
			}

			// Cycle through blocks
			for ( var block = blockStart; block <= blockEnd; block ++ ) {
				var type = blocks[block].type;

				// Add '=' unchanged text and moved block
				if ( type === '=' || type === '-' || type === '+' ) {
					fragments.push( {
						text:  blocks[block].text,
						type:  type,
						color: color
					} );
				}

				// Add '<' and '>' marks
				else if ( type === '|' ) {
					var movedGroup = groups[ blocks[block].moved ];

					// Get mark text
					var markText = '';
					for (
						var movedBlock = movedGroup.blockStart;
						movedBlock <= movedGroup.blockEnd;
						movedBlock ++
					) {
						if ( blocks[movedBlock].type === '=' || blocks[movedBlock].type === '-' ) {
							markText += blocks[movedBlock].text;
						}
					}

					// Get mark direction
					var markType;
					if ( movedGroup.blockStart < blockStart ) {
						markType = '<';
					}
					else {
						markType = '>';
					}

					// Add mark
					fragments.push( {
						text:  markText,
						type:  markType,
						color: movedGroup.color
					} );
				}
			}

			// Add moved block end
			if ( color !== null ) {
				fragments.push( {
					text:  '',
					type:  ' )',
					color: color
				} );
			}
		}

		// Cycle through fragments, join consecutive fragments of same type (i.e. '-' blocks)
		var fragmentsLength = fragments.length;
		for ( var fragment = 1; fragment < fragmentsLength; fragment ++ ) {

			// Check if joinable
			if (
				fragments[fragment].type === fragments[fragment - 1].type &&
				fragments[fragment].color === fragments[fragment - 1].color &&
				fragments[fragment].text !== '' && fragments[fragment - 1].text !== ''
			) {

				// Join and splice
				fragments[fragment - 1].text += fragments[fragment].text;
				fragments.splice( fragment, 1 );
				fragment --;
			}
		}

		// Enclose in containers
		fragments.unshift( { text: '', type: '{', color: null }, { text: '', type: '[', color: null } );
		fragments.push(    { text: '', type: ']', color: null }, { text: '', type: '}', color: null } );

		return;
	};


	/**
	 * Clip unchanged sections from unmoved block text.
	 * Adds the following fagment types:
	 *   '~', ' ~', '~ ' omission indicators
	 *   '[', ']', ','   fragment start and end, fragment separator
	 *
	 * @param[in/out] array fragments Fragments array, abstraction layer for diff code
	 */
	this.clipDiffFragments = function () {

		var fragments = this.fragments;

		// Skip if only one fragment in containers, no change
		if ( fragments.length === 5 ) {
			return;
		}

		// Min length for clipping right
		var minRight = this.config.clipHeadingRight;
		if ( this.config.clipParagraphRightMin < minRight ) {
			minRight = this.config.clipParagraphRightMin;
		}
		if ( this.config.clipLineRightMin < minRight ) {
			minRight = this.config.clipLineRightMin;
		}
		if ( this.config.clipBlankRightMin < minRight ) {
			minRight = this.config.clipBlankRightMin;
		}
		if ( this.config.clipCharsRight < minRight ) {
			minRight = this.config.clipCharsRight;
		}

		// Min length for clipping left
		var minLeft = this.config.clipHeadingLeft;
		if ( this.config.clipParagraphLeftMin < minLeft ) {
			minLeft = this.config.clipParagraphLeftMin;
		}
		if ( this.config.clipLineLeftMin < minLeft ) {
			minLeft = this.config.clipLineLeftMin;
		}
		if ( this.config.clipBlankLeftMin < minLeft ) {
			minLeft = this.config.clipBlankLeftMin;
		}
		if ( this.config.clipCharsLeft < minLeft ) {
			minLeft = this.config.clipCharsLeft;
		}

		// Cycle through fragments
		var fragmentsLength = fragments.length;
		for ( var fragment = 0; fragment < fragmentsLength; fragment ++ ) {

			// Skip if not an unmoved and unchanged block
			var type = fragments[fragment].type;
			var color = fragments[fragment].color;
			if ( type !== '=' || color !== null ) {
				continue;
			}

			// Skip if too short for clipping
			var text = fragments[fragment].text;
			var textLength = text.length;
			if ( textLength < minRight && textLength < minLeft ) {
				continue;
			}

			// Get line positions including start and end
			var lines = [];
			var lastIndex = null;
			var regExpMatch;
			while ( ( regExpMatch = this.config.regExp.clipLine.exec( text ) ) !== null ) {
				lines.push( regExpMatch.index );
				lastIndex = this.config.regExp.clipLine.lastIndex;
			}
			if ( lines[0] !== 0 ) {
				lines.unshift( 0 );
			}
			if ( lastIndex !== textLength ) {
				lines.push( textLength );
			}

			// Get heading positions
			var headings = [];
			var headingsEnd = [];
			while ( ( regExpMatch = this.config.regExp.clipHeading.exec( text ) ) !== null ) {
				headings.push( regExpMatch.index );
				headingsEnd.push( regExpMatch.index + regExpMatch[0].length );
			}

			// Get paragraph positions including start and end
			var paragraphs = [];
			var lastIndex = null;
			while ( ( regExpMatch = this.config.regExp.clipParagraph.exec( text ) ) !== null ) {
				paragraphs.push( regExpMatch.index );
				lastIndex = this.config.regExp.clipParagraph.lastIndex;
			}
			if ( paragraphs[0] !== 0 ) {
				paragraphs.unshift( 0 );
			}
			if ( lastIndex !== textLength ) {
				paragraphs.push( textLength );
			}

			// Determine ranges to keep on left and right side
			var rangeRight = null;
			var rangeLeft = null;
			var rangeRightType = '';
			var rangeLeftType = '';

			// Find clip pos from left, skip for first non-container block
			if ( fragment !== 2 ) {

				// Maximum lines to search from left
				var rangeLeftMax = textLength;
				if ( this.config.clipLinesLeftMax < lines.length ) {
					rangeLeftMax = lines[this.config.clipLinesLeftMax];
				}

				// Find first heading from left
				if ( rangeLeft === null ) {
					var headingsLength = headingsEnd.length;
					for ( var j = 0; j < headingsLength; j ++ ) {
						if ( headingsEnd[j] > this.config.clipHeadingLeft || headingsEnd[j] > rangeLeftMax ) {
							break;
						}
						rangeLeft = headingsEnd[j];
						rangeLeftType = 'heading';
						break;
					}
				}

				// Find first paragraph from left
				if ( rangeLeft === null ) {
					var paragraphsLength = paragraphs.length;
					for ( var j = 0; j < paragraphsLength; j ++ ) {
						if (
							paragraphs[j] > this.config.clipParagraphLeftMax ||
							paragraphs[j] > rangeLeftMax
						) {
							break;
						}
						if ( paragraphs[j] > this.config.clipParagraphLeftMin ) {
							rangeLeft = paragraphs[j];
							rangeLeftType = 'paragraph';
							break;
						}
					}
				}

				// Find first line break from left
				if ( rangeLeft === null ) {
					var linesLength = lines.length;
					for ( var j = 0; j < linesLength; j ++ ) {
						if ( lines[j] > this.config.clipLineLeftMax || lines[j] > rangeLeftMax ) {
							break;
						}
						if ( lines[j] > this.config.clipLineLeftMin ) {
							rangeLeft = lines[j];
							rangeLeftType = 'line';
							break;
						}
					}
				}

				// Find first blank from left
				if ( rangeLeft === null ) {
					this.config.regExp.clipBlank.lastIndex = this.config.clipBlankLeftMin;
					if ( ( regExpMatch = this.config.regExp.clipBlank.exec( text ) ) !== null ) {
						if (
							regExpMatch.index < this.config.clipBlankLeftMax &&
							regExpMatch.index < rangeLeftMax
						) {
							rangeLeft = regExpMatch.index;
							rangeLeftType = 'blank';
						}
					}
				}

				// Fixed number of chars from left
				if ( rangeLeft === null ) {
					if ( this.config.clipCharsLeft < rangeLeftMax ) {
						rangeLeft = this.config.clipCharsLeft;
						rangeLeftType = 'chars';
					}
				}

				// Fixed number of lines from left
				if ( rangeLeft === null ) {
					rangeLeft = rangeLeftMax;
					rangeLeftType = 'fixed';
				}
			}

			// Find clip pos from right, skip for last non-container block
			if ( fragment !== fragments.length - 3 ) {

				// Maximum lines to search from right
				var rangeRightMin = 0;
				if ( lines.length >= this.config.clipLinesRightMax ) {
					rangeRightMin = lines[lines.length - this.config.clipLinesRightMax];
				}

				// Find last heading from right
				if ( rangeRight === null ) {
					for ( var j = headings.length - 1; j >= 0; j -- ) {
						if (
							headings[j] < textLength - this.config.clipHeadingRight ||
							headings[j] < rangeRightMin
						) {
							break;
						}
						rangeRight = headings[j];
						rangeRightType = 'heading';
						break;
					}
				}

				// Find last paragraph from right
				if ( rangeRight === null ) {
					for ( var j = paragraphs.length - 1; j >= 0 ; j -- ) {
						if (
							paragraphs[j] < textLength - this.config.clipParagraphRightMax ||
							paragraphs[j] < rangeRightMin
						) {
							break;
						}
						if ( paragraphs[j] < textLength - this.config.clipParagraphRightMin ) {
							rangeRight = paragraphs[j];
							rangeRightType = 'paragraph';
							break;
						}
					}
				}

				// Find last line break from right
				if ( rangeRight === null ) {
					for ( var j = lines.length - 1; j >= 0; j -- ) {
						if (
							lines[j] < textLength - this.config.clipLineRightMax ||
							lines[j] < rangeRightMin
						) {
							break;
						}
						if ( lines[j] < textLength - this.config.clipLineRightMin ) {
							rangeRight = lines[j];
							rangeRightType = 'line';
							break;
						}
					}
				}

				// Find last blank from right
				if ( rangeRight === null ) {
					var startPos = textLength - this.config.clipBlankRightMax;
					if ( startPos < rangeRightMin ) {
						startPos = rangeRightMin;
					}
					this.config.regExp.clipBlank.lastIndex = startPos;
					var lastPos = null;
					while ( ( regExpMatch = this.config.regExp.clipBlank.exec( text ) ) !== null ) {
						if ( regExpMatch.index > textLength - this.config.clipBlankRightMin ) {
							if ( lastPos !== null ) {
								rangeRight = lastPos;
								rangeRightType = 'blank';
							}
							break;
						}
						lastPos = regExpMatch.index;
					}
				}

				// Fixed number of chars from right
				if ( rangeRight === null ) {
					if ( textLength - this.config.clipCharsRight > rangeRightMin ) {
						rangeRight = textLength - this.config.clipCharsRight;
						rangeRightType = 'chars';
					}
				}

				// Fixed number of lines from right
				if ( rangeRight === null ) {
					rangeRight = rangeRightMin;
					rangeRightType = 'fixed';
				}
			}

			// Check if we skip clipping if ranges are close together
			if ( rangeLeft !== null && rangeRight !== null ) {

				// Skip if overlapping ranges
				if ( rangeLeft > rangeRight ) {
					continue;
				}

				// Skip if chars too close
				var skipChars = rangeRight - rangeLeft;
				if ( skipChars < this.config.clipSkipChars ) {
					continue;
				}

				// Skip if lines too close
				var skipLines = 0;
				var linesLength = lines.length;
				for ( var j = 0; j < linesLength; j ++ ) {
					if ( lines[j] > rangeRight || skipLines > this.config.clipSkipLines ) {
						break;
					}
					if ( lines[j] > rangeLeft ) {
						skipLines ++;
					}
				}
				if ( skipLines < this.config.clipSkipLines ) {
					continue;
				}
			}

			// Skip if nothing to clip
			if ( rangeLeft === null && rangeRight === null ) {
				continue;
			}

			// Split left text
			var textLeft = null;
			var omittedLeft = null;
			if ( rangeLeft !== null ) {
				textLeft = text.slice( 0, rangeLeft );

				// Remove trailing empty lines
				textLeft = textLeft.replace( this.config.regExp.clipTrimNewLinesLeft, '' );

				// Get omission indicators, remove trailing blanks
				if ( rangeLeftType === 'chars' ) {
					omittedLeft = '~';
					textLeft = textLeft.replace( this.config.regExp.clipTrimBlanksLeft, '' );
				}
				else if ( rangeLeftType === 'blank' ) {
					omittedLeft = ' ~';
					textLeft = textLeft.replace( this.config.regExp.clipTrimBlanksLeft, '' );
				}
			}

			// Split right text
			var textRight = null;
			var omittedRight = null;
			if ( rangeRight !== null ) {
				textRight = text.slice( rangeRight );

				// Remove leading empty lines
				textRight = textRight.replace( this.config.regExp.clipTrimNewLinesRight, '' );

				// Get omission indicators, remove leading blanks
				if ( rangeRightType === 'chars' ) {
					omittedRight = '~';
					textRight = textRight.replace( this.config.regExp.clipTrimBlanksRight, '' );
				}
				else if ( rangeRightType === 'blank' ) {
					omittedRight = '~ ';
					textRight = textRight.replace( this.config.regExp.clipTrimBlanksRight, '' );
				}
			}

			// Remove split element
			fragments.splice( fragment, 1 );
			fragmentsLength --;

			// Add left text to fragments list
			if ( rangeLeft !== null ) {
				fragments.splice( fragment ++, 0, { text: textLeft, type: '=', color: null } );
				fragmentsLength ++;
				if ( omittedLeft !== null ) {
					fragments.splice( fragment ++, 0,	{ text: '', type: omittedLeft, color: null } );
					fragmentsLength ++;
				}
			}

			// Add fragment container and separator to list
			if ( rangeLeft !== null && rangeRight !== null ) {
				fragments.splice( fragment ++, 0, { text: '', type: ']', color: null } );
				fragments.splice( fragment ++, 0, { text: '', type: ',', color: null } );
				fragments.splice( fragment ++, 0, { text: '', type: '[', color: null } );
				fragmentsLength += 3;
			}

			// Add right text to fragments list
			if ( rangeRight !== null ) {
				if ( omittedRight !== null ) {
					fragments.splice( fragment ++, 0, { text: '', type: omittedRight, color: null } );
					fragmentsLength ++;
				}
				fragments.splice( fragment ++, 0, { text: textRight, type: '=', color: null } );
				fragmentsLength ++;
			}
		}

		// Debug log
		if ( this.config.debug === true ) {
			this.debugFragments( 'Fragments' );
		}

		return;
	};


	/**
	 * Create html formatted diff code from diff fragments.
	 *
	 * @param[in] array fragments Fragments array, abstraction layer for diff code
	 * @param string|undefined version
	 *   Output version: 'new' or 'old': only text from new or old version, used for unit tests
	 * @param[out] string html Html code of diff
	 */
	this.getDiffHtml = function ( version ) {

		var fragments = this.fragments;

		// No change, only one unchanged block in containers
		if ( fragments.length === 5 && fragments[2].type === '=' ) {
			this.html = '';
			return;
		}

		// Cycle through fragments
		var htmlFragments = [];
		var fragmentsLength = fragments.length;
		for ( var fragment = 0; fragment < fragmentsLength; fragment ++ ) {
			var text = fragments[fragment].text;
			var type = fragments[fragment].type;
			var color = fragments[fragment].color;
			var html = '';

			// Test if text is blanks-only or a single character
			var blank = false;
			if ( text !== '' ) {
				blank = this.config.regExp.blankBlock.test( text );
			}

			// Add container start markup
			if ( type === '{' ) {
				html = this.config.htmlCode.containerStart;
			}

			// Add container end markup
			else if ( type === '}' ) {
				html = this.config.htmlCode.containerEnd;
			}

			// Add fragment start markup
			if ( type === '[' ) {
				html = this.config.htmlCode.fragmentStart;
			}

			// Add fragment end markup
			else if ( type === ']' ) {
				html = this.config.htmlCode.fragmentEnd;
			}

			// Add fragment separator markup
			else if ( type === ',' ) {
				html = this.config.htmlCode.separator;
			}

			// Add omission markup
			if ( type === '~' ) {
				html = this.config.htmlCode.omittedChars;
			}

			// Add omission markup
			if ( type === ' ~' ) {
				html = ' ' + this.config.htmlCode.omittedChars;
			}

			// Add omission markup
			if ( type === '~ ' ) {
				html = this.config.htmlCode.omittedChars + ' ';
			}

			// Add colored left-pointing block start markup
			else if ( type === '(<' ) {
				if ( version !== 'old' ) {

					// Get title
					var title;
					if ( this.config.noUnicodeSymbols === true ) {
						title = this.config.msg['wiked-diff-block-left-nounicode'];
					}
					else {
						title = this.config.msg['wiked-diff-block-left'];
					}

					// Get html
					if ( this.config.coloredBlocks === true ) {
						html = this.config.htmlCode.blockColoredStart;
					}
					else {
						html = this.config.htmlCode.blockStart;
					}
					html = this.htmlCustomize( html, color, title );
				}
			}

			// Add colored right-pointing block start markup
			else if ( type === '(>' ) {
				if ( version !== 'old' ) {

					// Get title
					var title;
					if ( this.config.noUnicodeSymbols === true ) {
						title = this.config.msg['wiked-diff-block-right-nounicode'];
					}
					else {
						title = this.config.msg['wiked-diff-block-right'];
					}

					// Get html
					if ( this.config.coloredBlocks === true ) {
						html = this.config.htmlCode.blockColoredStart;
					}
					else {
						html = this.config.htmlCode.blockStart;
					}
					html = this.htmlCustomize( html, color, title );
				}
			}

			// Add colored block end markup
			else if ( type === ' )' ) {
				if ( version !== 'old' ) {
					html = this.config.htmlCode.blockEnd;
				}
			}

			// Add '=' (unchanged) text and moved block
			if ( type === '=' ) {
				text = this.htmlEscape( text );
				if ( color !== null ) {
					if ( version !== 'old' ) {
						html = this.markupBlanks( text, true );
					}
				}
				else {
					html = this.markupBlanks( text );
				}
			}

			// Add '-' text
			else if ( type === '-' ) {
				if ( version !== 'new' ) {

					// For old version skip '-' inside moved group
					if ( version !== 'old' || color === null ) {
						text = this.htmlEscape( text );
						text = this.markupBlanks( text, true );
						if ( blank === true ) {
							html = this.config.htmlCode.deleteStartBlank;
						}
						else {
							html = this.config.htmlCode.deleteStart;
						}
						html += text + this.config.htmlCode.deleteEnd;
					}
				}
			}

			// Add '+' text
			else if ( type === '+' ) {
				if ( version !== 'old' ) {
					text = this.htmlEscape( text );
					text = this.markupBlanks( text, true );
					if ( blank === true ) {
						html = this.config.htmlCode.insertStartBlank;
					}
					else {
						html = this.config.htmlCode.insertStart;
					}
					html += text + this.config.htmlCode.insertEnd;
				}
			}

			// Add '<' and '>' code
			else if ( type === '<' || type === '>' ) {
				if ( version !== 'new' ) {

					// Display as deletion at original position
					if ( this.config.showBlockMoves === false || version === 'old' ) {
						text = this.htmlEscape( text );
						text = this.markupBlanks( text, true );
						if ( version === 'old' ) {
							if ( this.config.coloredBlocks === true ) {
								html =
									this.htmlCustomize( this.config.htmlCode.blockColoredStart, color ) +
									text +
									this.config.htmlCode.blockEnd;
							}
							else {
								html =
									this.htmlCustomize( this.config.htmlCode.blockStart, color ) +
									text +
									this.config.htmlCode.blockEnd;
							}
						}
						else {
							if ( blank === true ) {
								html =
									this.config.htmlCode.deleteStartBlank +
									text +
									this.config.htmlCode.deleteEnd;
							}
							else {
								html = this.config.htmlCode.deleteStart + text + this.config.htmlCode.deleteEnd;
							}
						}
					}

					// Display as mark
					else {
						if ( type === '<' ) {
							if ( this.config.coloredBlocks === true ) {
								html = this.htmlCustomize( this.config.htmlCode.markLeftColored, color, text );
							}
							else {
								html = this.htmlCustomize( this.config.htmlCode.markLeft, color, text );
							}
						}
						else {
							if ( this.config.coloredBlocks === true ) {
								html = this.htmlCustomize( this.config.htmlCode.markRightColored, color, text );
							}
							else {
								html = this.htmlCustomize( this.config.htmlCode.markRight, color, text );
							}
						}
					}
				}
			}
			htmlFragments.push( html );
		}

		// Join fragments
		this.html = htmlFragments.join( '' );

		return;
	};


	/**
	 * Customize html code fragments.
	 * Replaces:
	 *   {number}:    class/color/block/mark/id number
	 *   {title}:     title attribute (popup)
	 *   {nounicode}: noUnicodeSymbols fallback
	 *   input: html, number: block number, title: title attribute (popup) text
	 *
	 * @param string html Html code to be customized
	 * @return string Customized html code
	 */
	this.htmlCustomize = function ( html, number, title ) {

		// Replace {number} with class/color/block/mark/id number
		html = html.replace( /\{number\}/g, number);

		// Replace {nounicode} with wikEdDiffNoUnicode class name
		if ( this.config.noUnicodeSymbols === true ) {
			html = html.replace( /\{nounicode\}/g, ' wikEdDiffNoUnicode');
		}
		else {
			html = html.replace( /\{nounicode\}/g, '');
		}

		// Shorten title text, replace {title}
		if ( title !== undefined ) {
			var max = 512;
			var end = 128;
			var gapMark = ' [...] ';
			if ( title.length > max ) {
				title =
					title.substr( 0, max - gapMark.length - end ) +
					gapMark +
					title.substr( title.length - end );
			}
			title = this.htmlEscape( title );
			title = title.replace( /\t/g, '&nbsp;&nbsp;');
			title = title.replace( /  /g, '&nbsp;&nbsp;');
			html = html.replace( /\{title\}/, title);
		}
		return html;
	};


	/**
	 * Replace html-sensitive characters in output text with character entities.
	 *
	 * @param string html Html code to be escaped
	 * @return string Escaped html code
	 */
	this.htmlEscape = function ( html ) {

		html = html.replace( /&/g, '&amp;');
		html = html.replace( /</g, '&lt;');
		html = html.replace( />/g, '&gt;');
		html = html.replace( /"/g, '&quot;');
		return html;
	};


	/**
	 * Markup tabs, newlines, and spaces in diff fragment text.
	 *
	 * @param bool highlight Highlight newlines and spaces in addition to tabs
	 * @param string html Text code to be marked-up
	 * @return string Marked-up text
	 */
	this.markupBlanks = function ( html, highlight ) {

		if ( highlight === true ) {
			html = html.replace( / /g, this.config.htmlCode.space);
			html = html.replace( /\n/g, this.config.htmlCode.newline);
		}
		html = html.replace( /\t/g, this.config.htmlCode.tab);
		return html;
	};


	/**
	 * Count real words in text.
	 *
	 * @param string text Text for word counting
	 * @return int Number of words in text
	 */
	this.wordCount = function ( text ) {

		return ( text.match( this.config.regExp.countWords ) || [] ).length;
	};


	/**
	 * Test diff code for consistency with input versions.
	 * Prints results to debug console.
	 *
	 * @param[in] WikEdDiffText newText, oldText Text objects
	 */
	this.unitTests = function () {

		// Check if output is consistent with new text
		this.getDiffHtml( 'new' );
		var diff = this.html.replace( /<[^>]*>/g, '');
		var text = this.htmlEscape( this.newText.text );
		if ( diff !== text ) {
			console.log(
				'Error: wikEdDiff unit test failure: diff not consistent with new text version!'
			);
			this.error = true;
			console.log( 'new text:\n', text );
			console.log( 'new diff:\n', diff );
		}
		else {
			console.log( 'OK: wikEdDiff unit test passed: diff consistent with new text.' );
		}

		// Check if output is consistent with old text
		this.getDiffHtml( 'old' );
		var diff = this.html.replace( /<[^>]*>/g, '');
		var text = this.htmlEscape( this.oldText.text );
		if ( diff !== text ) {
			console.log(
				'Error: wikEdDiff unit test failure: diff not consistent with old text version!'
			);
			this.error = true;
			console.log( 'old text:\n', text );
			console.log( 'old diff:\n', diff );
		}
		else {
			console.log( 'OK: wikEdDiff unit test passed: diff consistent with old text.' );
		}

		return;
	};


	/**
	 * Dump blocks object to browser console.
	 *
	 * @param string name Block name
	 * @param[in] array blocks Blocks table object
	 */
	this.debugBlocks = function ( name, blocks ) {

		if ( blocks === undefined ) {
			blocks = this.blocks;
		}
		var dump =
			'\ni \toldBl \tnewBl \toldNm \tnewNm \toldSt \tcount \tuniq' +
			'\twords \tchars \ttype \tsect \tgroup \tfixed \tmoved \ttext\n';
		var blocksLength = blocks.length;
		for ( var i = 0; i < blocksLength; i ++ ) {
			dump +=
				i + ' \t' + blocks[i].oldBlock + ' \t' + blocks[i].newBlock + ' \t' +
				blocks[i].oldNumber + ' \t' + blocks[i].newNumber + ' \t' + blocks[i].oldStart + ' \t' +
				blocks[i].count + ' \t' + blocks[i].unique + ' \t' + blocks[i].words + ' \t' +
				blocks[i].chars + ' \t' + blocks[i].type + ' \t' + blocks[i].section + ' \t' +
				blocks[i].group + ' \t' + blocks[i].fixed + ' \t' + blocks[i].moved + ' \t' +
				this.debugShortenText( blocks[i].text ) + '\n';
		}
		console.log( name + ':\n' + dump );
	};


	/**
	 * Dump groups object to browser console.
	 *
	 * @param string name Group name
	 * @param[in] array groups Groups table object
	 */
	this.debugGroups = function ( name, groups ) {

		if ( groups === undefined ) {
			groups = this.groups;
		}
		var dump =
			'\ni \toldNm \tblSta \tblEnd \tuniq \tmaxWo' +
			'\twords \tchars \tfixed \toldNm \tmFrom \tcolor\n';
		var groupsLength = groupsLength;
		for ( var i = 0; i < groups.length; i ++ ) {
			dump +=
				i + ' \t' + groups[i].oldNumber + ' \t' + groups[i].blockStart + ' \t' +
				groups[i].blockEnd + ' \t' + groups[i].unique + ' \t' + groups[i].maxWords + ' \t' +
				groups[i].words + ' \t' + groups[i].chars + ' \t' + groups[i].fixed + ' \t' +
				groups[i].oldNumber + ' \t' + groups[i].movedFrom + ' \t' + groups[i].color + '\n';
		}
		console.log( name + ':\n' + dump );
	};


	/**
	 * Dump fragments array to browser console.
	 *
	 * @param string name Fragments name
	 * @param[in] array fragments Fragments array
	 */
	this.debugFragments = function ( name ) {

		var fragments = this.fragments;
		var dump = '\ni \ttype \tcolor \ttext\n';
		var fragmentsLength = fragments.length;
		for ( var i = 0; i < fragmentsLength; i ++ ) {
			dump +=
				i + ' \t"' + fragments[i].type + '" \t' + fragments[i].color + ' \t' +
				this.debugShortenText( fragments[i].text, 120, 40 ) + '\n';
		}
		console.log( name + ':\n' + dump );
	};


	/**
	 * Dump borders array to browser console.
	 *
	 * @param string name Arrays name
	 * @param[in] array border Match border array
	 */
	this.debugBorders = function ( name, borders ) {

		var dump = '\ni \t[ new \told ]\n';
		var bordersLength = borders.length;
		for ( var i = 0; i < bordersLength; i ++ ) {
			dump += i + ' \t[ ' + borders[i][0] + ' \t' + borders[i][1] + ' ]\n';
		}
		console.log( name, dump );
	};


	/**
	 * Shorten text for dumping.
	 *
	 * @param string text Text to be shortened
	 * @param int max Max length of (shortened) text
	 * @param int end Length of trailing fragment of shortened text
	 * @return string Shortened text
	 */
	this.debugShortenText = function ( text, max, end ) {

		if ( typeof text !== 'string' ) {
			text = text.toString();
		}
		text = text.replace( /\n/g, '\\n');
		text = text.replace( /\t/g, '  ');
		if ( max === undefined ) {
			max = 50;
		}
		if ( end === undefined ) {
			end = 15;
		}
		if ( text.length > max ) {
			text = text.substr( 0, max - 1 - end ) + '…' + text.substr( text.length - end );
		}
		return '"' + text + '"';
	};


	/**
	 * Start timer 'label', analogous to JavaScript console timer.
	 * Usage: this.time( 'label' );
	 *
	 * @param string label Timer label
	 * @param[out] array timer Current time in milliseconds (float)
	 */
	this.time = function ( label ) {

		this.timer[label] = new Date().getTime();
		return;
	};


	/**
	 * Stop timer 'label', analogous to JavaScript console timer.
	 * Logs time in milliseconds since start to browser console.
	 * Usage: this.timeEnd( 'label' );
	 *
	 * @param string label Timer label
	 * @param bool noLog Do not log result
	 * @return float Time in milliseconds
	 */
	this.timeEnd = function ( label, noLog ) {

		var diff = 0;
		if ( this.timer[label] !== undefined ) {
			var start = this.timer[label];
			var stop = new Date().getTime();
			diff = stop - start;
			this.timer[label] = undefined;
			if ( noLog !== true ) {
				console.log( label + ': ' + diff.toFixed( 2 ) + ' ms' );
			}
		}
		return diff;
	};


	/**
	 * Log recursion timer results to browser console.
	 * Usage: this.timeRecursionEnd();
	 *
	 * @param string text Text label for output
	 * @param[in] array recursionTimer Accumulated recursion times
	 */
	this.timeRecursionEnd = function ( text ) {

		if ( this.recursionTimer.length > 1 ) {

			// Subtract times spent in deeper recursions
			var timerEnd = this.recursionTimer.length - 1;
			for ( var i = 0; i < timerEnd; i ++ ) {
				this.recursionTimer[i] -= this.recursionTimer[i + 1];
			}

			// Log recursion times
			var timerLength = this.recursionTimer.length;
			for ( var i = 0; i < timerLength; i ++ ) {
				console.log( text + ' recursion ' + i + ': ' + this.recursionTimer[i].toFixed( 2 ) + ' ms' );
			}
		}
		this.recursionTimer = [];
		return;
	};


	/**
	 * Log variable values to debug console.
	 * Usage: this.debug( 'var', var );
	 *
	 * @param string name Object identifier
	 * @param mixed|undefined name Object to be logged
	 */
	this.debug = function ( name, object ) {

		if ( object === undefined ) {
			console.log( name );
		}
		else {
			console.log( name + ': ' + object );
		}
		return;
	};


/**
 * Add script to document head.
 *
 * @param string code JavaScript code
 */
	this.addScript = function ( code ) {

		if ( document.getElementById( 'wikEdDiffBlockHandler' ) === null ) {
			var script = document.createElement( 'script' );
			script.id = 'wikEdDiffBlockHandler';
			if ( script.innerText !== undefined ) {
				script.innerText = code;
			}
			else {
				script.textContent = code;
			}
			document.getElementsByTagName( 'head' )[0].appendChild( script );
		}
		return;
	};


/**
 * Add stylesheet to document head, cross-browser >= IE6.
 *
 * @param string css CSS code
 */
	this.addStyleSheet = function ( css ) {

		if ( document.getElementById( 'wikEdDiffStyles' ) === null ) {

			// Replace mark symbols
			css = css.replace( /\{cssMarkLeft\}/g, this.config.cssMarkLeft);
			css = css.replace( /\{cssMarkRight\}/g, this.config.cssMarkRight);

			var style = document.createElement( 'style' );
			style.id = 'wikEdDiffStyles';
			style.type = 'text/css';
			if ( style.styleSheet !== undefined ) {
				style.styleSheet.cssText = css;
			}
			else {
				style.appendChild( document.createTextNode( css ) );
			}
			document.getElementsByTagName( 'head' )[0].appendChild( style );
		}
		return;
	};


/**
 * Recursive deep copy from target over source for customization import.
 *
 * @param object source Source object
 * @param object target Target object
 */
	this.deepCopy = function ( source, target ) {

		for ( var key in source ) {
			if ( Object.prototype.hasOwnProperty.call( source, key ) === true ) {
				if ( typeof source[key] === 'object' ) {
					this.deepCopy( source[key], target[key] );
				}
				else {
					target[key] = source[key];
				}
			}
		}
		return;
	};

	// Initialze WikEdDiff object
	this.init();
};


/**
 * Data and methods for single text version (old or new one).
 *
 * @class WikEdDiffText
 */
WikEdDiff.WikEdDiffText = function ( text, parent ) {

	/** @var WikEdDiff parent Parent object for configuration settings and debugging methods */
	this.parent = parent;

	/** @var string text Text of this version */
	this.text = null;

	/** @var array tokens Tokens list */
	this.tokens = [];

	/** @var int first, last First and last index of tokens list */
	this.first = null;
	this.last = null;

	/** @var array words Word counts for version text */
	this.words = {};


	/**
	 * Constructor, initialize text object.
	 *
	 * @param string text Text of version
	 * @param WikEdDiff parent Parent, for configuration settings and debugging methods
	 */
	this.init = function () {

		if ( typeof text !== 'string' ) {
			text = text.toString();
		}

		// IE / Mac fix
		this.text = text.replace( /\r\n?/g, '\n');

		// Parse and count words and chunks for identification of unique real words
		if ( this.parent.config.timer === true ) {
			this.parent.time( 'wordParse' );
		}
		this.wordParse( this.parent.config.regExp.countWords );
		this.wordParse( this.parent.config.regExp.countChunks );
		if ( this.parent.config.timer === true ) {
			this.parent.timeEnd( 'wordParse' );
		}
		return;
	};


	/**
	 * Parse and count words and chunks for identification of unique words.
	 *
	 * @param string regExp Regular expression for counting words
	 * @param[in] string text Text of version
	 * @param[out] array words Number of word occurrences
	 */
	this.wordParse = function ( regExp ) {

		var regExpMatch = this.text.match( regExp );
		if ( regExpMatch !== null ) {
			var matchLength = regExpMatch.length;
			for (var i = 0; i < matchLength; i ++) {
				var word = regExpMatch[i];
				if ( Object.prototype.hasOwnProperty.call( this.words, word ) === false ) {
					this.words[word] = 1;
				}
				else {
					this.words[word] ++;
				}
			}
		}
		return;
	};


	/**
	 * Split text into paragraph, line, sentence, chunk, word, or character tokens.
	 *
	 * @param string level Level of splitting: paragraph, line, sentence, chunk, word, or character
	 * @param int|null token Index of token to be split, otherwise uses full text
	 * @param[in] string text Full text to be split
	 * @param[out] array tokens Tokens list
	 * @param[out] int first, last First and last index of tokens list
	 */
	this.splitText = function ( level, token ) {

		var prev = null;
		var next = null;
		var current = this.tokens.length;
		var first = current;
		var text = '';

		// Split full text or specified token
		if ( token === undefined ) {
			text = this.text;
		}
		else {
			prev = this.tokens[token].prev;
			next = this.tokens[token].next;
			text = this.tokens[token].token;
		}

		// Split text into tokens, regExp match as separator
		var number = 0;
		var split = [];
		var regExpMatch;
		var lastIndex = 0;
		var regExp = this.parent.config.regExp.split[level];
		while ( ( regExpMatch = regExp.exec( text ) ) !== null ) {
			if ( regExpMatch.index > lastIndex ) {
				split.push( text.substring( lastIndex, regExpMatch.index ) );
			}
			split.push( regExpMatch[0] );
			lastIndex = regExp.lastIndex;
		}
		if ( lastIndex < text.length ) {
			split.push( text.substring( lastIndex ) );
		}

		// Cycle through new tokens
		var splitLength = split.length;
		for ( var i = 0; i < splitLength; i ++ ) {

			// Insert current item, link to previous
			this.tokens.push( {
				token:   split[i],
				prev:    prev,
				next:    null,
				link:    null,
				number:  null,
				unique:  false
			} );
			number ++;

			// Link previous item to current
			if ( prev !== null ) {
				this.tokens[prev].next = current;
			}
			prev = current;
			current ++;
		}

		// Connect last new item and existing next item
		if ( number > 0 && token !== undefined ) {
			if ( prev !== null ) {
				this.tokens[prev].next = next;
			}
			if ( next !== null ) {
				this.tokens[next].prev = prev;
			}
		}

		// Set text first and last token index
		if ( number > 0 ) {

			// Initial text split
			if ( token === undefined ) {
				this.first = 0;
				this.last = prev;
			}

			// First or last token has been split
			else {
				if ( token === this.first ) {
					this.first = first;
				}
				if ( token === this.last ) {
					this.last = prev;
				}
			}
		}
		return;
	};


	/**
	 * Split unique unmatched tokens into smaller tokens.
	 *
	 * @param string level Level of splitting: line, sentence, chunk, or word
	 * @param[in] array tokens Tokens list
	 */
	this.splitRefine = function ( regExp ) {

		// Cycle through tokens list
		var i = this.first;
		while ( i !== null ) {

			// Refine unique unmatched tokens into smaller tokens
			if ( this.tokens[i].link === null ) {
				this.splitText( regExp, i );
			}
			i = this.tokens[i].next;
		}
		return;
	};


	/**
	 * Enumerate text token list before detecting blocks.
	 *
	 * @param[out] array tokens Tokens list
	 */
	this.enumerateTokens = function () {

		// Enumerate tokens list
		var number = 0;
		var i = this.first;
		while ( i !== null ) {
			this.tokens[i].number = number;
			number ++;
			i = this.tokens[i].next;
		}
		return;
	};


	/**
	 * Dump tokens object to browser console.
	 *
	 * @param string name Text name
	 * @param[in] int first, last First and last index of tokens list
	 * @param[in] array tokens Tokens list
	 */
	this.debugText = function ( name ) {

		var tokens = this.tokens;
		var dump = 'first: ' + this.first + '\tlast: ' + this.last + '\n';
		dump += '\ni \tlink \t(prev \tnext) \tuniq \t#num \t"token"\n';
		var i = this.first;
		while ( i !== null ) {
			dump +=
				i + ' \t' + tokens[i].link + ' \t(' + tokens[i].prev + ' \t' + tokens[i].next + ') \t' +
				tokens[i].unique + ' \t#' + tokens[i].number + ' \t' +
				parent.debugShortenText( tokens[i].token ) + '\n';
			i = tokens[i].next;
		}
		console.log( name + ':\n' + dump );
		return;
	};


	// Initialize WikEdDiffText object
	this.init();
};

// </syntaxhighlight>