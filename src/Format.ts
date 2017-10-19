import { LanguageTag } from './LanguageTag';
import IntlMessageFormat from 'intl-messageformat';
import NumberFormatOptions = Intl.NumberFormatOptions;
import DateTimeFormatOptions = Intl.DateTimeFormatOptions;

/**
 * Describes additional formats that can be referenced in formatting strings.
 *
 * See [Format.JS documentation](https://formatjs.io/guides/message-syntax/) for details.
 */
export interface FormatOptions {
    number?: { [key: string]: NumberFormatOptions };
    date?: { [key: string]: DateTimeFormatOptions };
    time?: { [key: string]: DateTimeFormatOptions };
}

function numberFormat(fractionDigits: number): NumberFormatOptions {
    return {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    }
}

const defaultFormats: FormatOptions = {
    number: {
        '#': numberFormat(0),
        '#.#': numberFormat(1),
        '#.##': numberFormat(2),
        '#.###': numberFormat(3),
        '#.####': numberFormat(4),
        '#.#####': numberFormat(5),
    }
};

let _formats: FormatOptions = defaultFormats;

/**
 * Global [[FormatOptions]] used by the [[format]] and [[formatObject]] function if nothing else is
 * specified there. You can use [[setFormats]] and [[addFormats]] to register custom formats.
 *
 * By default the number formats `#`, `#.#`, `#.##` to `#.#####` are defined.
 * You can use them in a message string like eg. `{1, number, #.##}` to format a number with the specified number of
 * fraction digits.
 */
export function formats(): FormatOptions {
    return _formats as FormatOptions;
}

/**
 * Replaces the current global [[formats]].
 */
export function setFormats(formatOptions: FormatOptions): void {
    _formats = formatOptions;
}

/**
 * Merges the specified formats into the global [[formats]].
 */
export function addFormats(formatOptions: FormatOptions): void {
    for (let key in formatOptions) {
        if (_formats.hasOwnProperty(key)) {
            _formats[key] = { ... _formats[key] as object, ... formatOptions[key] as object };
        } else {
            _formats[key] = formatOptions[key];
        }
    }
}

/**
 * Format message using [ICU message syntax]{@link https://formatjs.io/guides/message-syntax/}.
 *
 * **Example:**
 * ```typescript
 * const msg = formatObject<{msgCount: number}>(languageTag('en'),
 *                                              'Current message count is {msgCount, number}');
 * msg({msgCount: 3}); // 'Current message count is 3'
 * ```
 *
 * @param language the locale to be used for message formatting (e.g. for numbers and [[plural]]s)
 * @param msgFormat the message using [ICU message syntax]{@link https://formatjs.io/guides/message-syntax/}.
 * @param formatOptions custom format options used by the message.
 *  Defaults to the globally registered [[formats]].
 * @returns a function accepting the parameter object.
 */
export function formatObject<P>(language: LanguageTag,
                                msgFormat: string,
                                formatOptions: FormatOptions = formats()): (parameters: P) => string {
    return new IntlMessageFormat(msgFormat, language.tag, formatOptions).format;
}

/**
 * Format messages using [ICU message syntax]{@link https://formatjs.io/guides/message-syntax/}.
 * Instead of using an object as parameter like [[formatObject]] this function accepts up to five parameters,
 * which are then available by the names `1` to `5` inside the message string.
 *
 * **Example:**
 * ```typescript
 * format<number>(languageTag('en'), 'Current message count is {1, number}')(3);
 * ```
 *
 * @param language the language to be used for message formatting (e.g. for numbers and [[plural]]s)
 * @param msgFormat the message using [ICU message syntax]{@link https://formatjs.io/guides/message-syntax/}.
 * @param formatOptions custom format options used by the message.
 *  Defaults to the globally registered [[formats]].
 * @returns a function accepting the specified number of parameters.
 */
export function format<P1, P2 = undefined, P3 = undefined, P4 = undefined, P5 = undefined>(
    language: LanguageTag,
    msgFormat: string,
    formatOptions: FormatOptions = formats()): (p1: P1, p2?: P2, p3?: P3, p4?: P4, p5?: P5) => string {
    return (p1: P1, p2?: P2, p3?: P3, p4?: P4, p5?: P5) =>
        new IntlMessageFormat(msgFormat, language.tag, formatOptions).format({1: p1, 2: p2, 3: p3, 4: p4, 5: p5});
}

/**
 * Defines the different messages for a [[plural]]ized message.
 */
export interface Plural {
    zero?: string;
    one?: string;
    two?: string;
    few?: (n: number) => string;
    many?: (n: number) => string;
    other: (n: number) => string;
}

/**
 * Creates a pluralized message which will return the adequate message based on the provided number and language.
 *
 * **Example:**
 * ```typescript
 * const msg = plural(languageTag('en'), {
 *   zero: 'You have no new messages',
 *   one: 'You have one new message',
 *   other: n => format<number>(languageTag('en'), 'You have {1, number} new messages')(n)
 * });
 * msg(5); // 'You have 5 new messages'
 * ```
 *
 * @see [Format.JS message syntax](https://formatjs.io/guides/message-syntax/#plural-format) for details
 *
 * @param language the language to be used for decision which of the plural forms to choose.
 * @param p the messages for the different cases.
 * @returns a function accepting a numeral argument used to pick the right message.
 */
export function plural(language: LanguageTag, p: Plural): (n: number) => string {
    const msgFormat = '{1, plural, ' +
        (p.zero ? '=0 {zero} ' : '') +
        (p.one ? 'one {one} ' : '') +
        (p.two ? 'two {two} ' : '') +
        (p.few ? 'few {few} ' : '') +
        (p.many ? 'many {many} ' : '') +
        'other {other}}';
    const selection = format<number>(language, msgFormat);
    return (n: number) => {
        switch (selection(n)) {
            case 'zero':
                return p.zero!;
            case 'one':
                return p.one!;
            case 'two':
                return p.two!;
            case 'few':
                return p.few!(n);
            case 'many':
                return p.many!(n);
            default:
                return p.other(n);
        }
    };
}

/**
 * Definition of possible cases for [[select]] and [[selectObject]].
 *
 * The `other` case is chosen if non of the more specific cases are matching.
 */
export interface SelectOptions {
    [key: string]: string | undefined;
    other?: string;
}

/**
 * Selects a message from [[SelectOptions]] based on the provided selection parameter.
 *
 * @see [[selectObject]] for an example and if you need further formatting capabilities inside the messages
 *
 * @param language
 * @param options the possible cases
 * @returns a function expecting a selection string to pick the correct message from the provided options.
 */
export function select(language: LanguageTag, options: SelectOptions): (selection: string) => string {
    return selectObject<string>(language, selection => selection, options);
}

/**
 * Selects and formats a message from [[SelectOptions]] based on the provided parameter object.
 *
 * **Example:**
 * ```typescript
 * const msg = selectObject<Person>(languageTag('en'), p => p.gender, {
 *     female: 'Dear Mrs. {name}',
 *     male: 'Dear Mr. {name}',
 *     other: 'Dear {name}'
 * });
 * msg({gender: 'female', name: 'Granger'}); // 'Dear Mrs. Granger'
 * ```
 *
 * @see [[select]] if you don't need the additional formatting options inside the messages.
 *
 * @param language
 * @param selector a function that extracts the selection key from the provided parameter object.
 * @param options the possible cases where each message will be formatted using
 *     [[formatObject]] based on the `parameters` object.
 * @returns a function expecting a single parameter object containing the selector and
 *     the values referenced by the messages.
 */
export function selectObject<P>(language: LanguageTag, selector: (parameters: P) => string,
                                options: SelectOptions): (parameters: P) => string {
    const optionsFormat: {[key: string]: (parameters: P) => string} = {};
    for (const option of Object.keys(options)) {
        const optionMsg = options[option];
        if (optionMsg) {
            optionsFormat[option] = formatObject(language, optionMsg);
        }
    }
    return parameters => {
        const s = selector(parameters);
        const match = optionsFormat[s];
        const result = match ? match : optionsFormat.other;
        if (!result) {
            throw `Selection "${s}" does not match any of the available options`;
        } else {
            return result(parameters);
        }
    }
}