import {
    addFormats,
    format,
    formatObject,
    FormatOptions,
    formats,
    plural,
    Plural,
    select,
    selectObject,
    setFormats
} from '.';
import { languageTag } from './LanguageTag';
import IntlPolyfill = require('intl');
import areIntlLocalesSupported = require('intl-locales-supported');

if (!areIntlLocalesSupported(['en', 'de'])) {
    Intl.NumberFormat = IntlPolyfill.NumberFormat;
    Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat;
}

const en = languageTag('en');
const de = languageTag('de');

const pi = 3.14159265359;

const customFormat: FormatOptions = {
    number: {
        scientific: <Intl.NumberFormatOptions> {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    },
    date: {
        custom: <Intl.DateTimeFormatOptions> {
        }
    }
};

describe('formatted', () => {
    it('must provide a string based on the specific format', () => {
        const f = format<number, string, number, string, number>(en, 'p1={1} p2={2} p3={3} p4={4} p5={5}');
        expect(f(1, 'a', 3, 'b', 5)).toBe('p1=1 p2=a p3=3 p4=b p5=5');
    });

    it('must support less than the maximum number of parameters', () => {
        const f = format<number, number>(en, 'I have {1, number} cats. Almost {2, number, percent} of them are black.');
        expect(f(12, 0.3)).toBe('I have 12 cats. Almost 30% of them are black.');
    });

    it('must support default number formats', () => {
        expect(format(en, '{1, number, #}')(pi)).toBe('3');
        expect(format(en, '{1, number, #.#}')(pi)).toBe('3.1');
        expect(format(en, '{1, number, #.##}')(pi)).toBe('3.14');
        expect(format(en, '{1, number, #.###}')(pi)).toBe('3.142');
        expect(format(en, '{1, number, #.####}')(pi)).toBe('3.1416');
        expect(format(en, '{1, number, #.#####}')(pi)).toBe('3.14159');

        expect(format(de, '{1, number, #.##}')(pi)).toBe('3,14');
    });

    it('must support custom formats', () => {
        expect(format(en, '{1, number, #}', customFormat)(pi)).toBe('3.142');
        expect(format(en, '{1, number, scientific}', customFormat)(pi)).toBe('3.14');
    });
});

describe('formattedObject', () => {
    it('must provide a string based on the specified format', () => {
        const f = formatObject<{ cats: number, blackRatio: number }>(
            en, 'I have {cats, number} cats. Almost {blackRatio, number, percent} of them are black.');
        expect(f({cats: 12, blackRatio: 0.3})).toBe('I have 12 cats. Almost 30% of them are black.');
    });

    it('must support default number formats', () => {
        expect(formatObject(en, '{pi, number, #.##}')({pi: pi})).toBe('3.14');
    });

    it('must support custom formats', () => {
        expect(formatObject(en, '{pi, number, #}', customFormat)({pi: pi})).toBe('3.142');
        expect(formatObject(en, '{pi, number, scientific}', customFormat)({pi: pi})).toBe('3.14');
    });
});

describe('formats', () => {
    it('must be possible to completely replace the existing default formats', () => {
        const defaultFormats = formats();

        setFormats(customFormat);
        expect(formats()).toEqual(customFormat);

        expect(format(en, '{1, number, #.##}')(pi)).toBe('3.142');
        expect(format(en, '{1, number, scientific}')(pi)).toBe('3.14');

        setFormats(defaultFormats);
        expect(format(en, '{1, number, #.##}')(pi)).toBe('3.14');
        expect(format(en, '{1, number, scientific}')(pi)).toBe('3.142');
    });

    it('must be possible to extend the existing default formats', () => {
        const defaultFormats = formats();

        addFormats(customFormat);
        expect(formats().number!.scientific).toEqual(customFormat.number!.scientific);
        expect(formats().number!['#.##']).toEqual(defaultFormats.number!['#.##']);
        expect(formats().date).toEqual(customFormat.date);

        expect(format(en, '{1, number, #.##}')(pi)).toBe('3.14');
        expect(format(en, '{1, number, scientific}')(pi)).toBe('3.14');

        setFormats(defaultFormats);
    });
});

describe('plural', () => {
    const msgs: Plural = {
        zero: 'You have no new messages',
        one: 'You have one new message',
        two: 'You have two new messages',
        few: n => formatObject(en, 'You have a few ({n, number}) new messages')({n: n}),
        many: n => formatObject(en, 'You have many ({n, number}) new messages')({n: n}),
        other: n => formatObject(en, 'You have ({n, number}) new messages')({n: n})
    };

    it('must correctly handle all specific cases', () => {
        const f = plural(languageTag('ar'), msgs);
        expect(f(0)).toBe(msgs.zero);
        expect(f(1)).toBe(msgs.one);
        expect(f(2)).toBe(msgs.two);
        expect(f(3)).toBe(msgs.few!(3));
        expect(f(21)).toBe(msgs.many!(21));
        expect(f(100)).toBe(msgs.other(100));
    });

    it('must fallback correctly if optional plural cases are omitted', () => {
        const f = plural(languageTag('ar'), {other: msgs.other});
        expect(f(0)).toBe(msgs.other(0));
        expect(f(1)).toBe(msgs.other(1));
        expect(f(2)).toBe(msgs.other(2));
        expect(f(3)).toBe(msgs.other(3));
        expect(f(21)).toBe(msgs.other(21));
        expect(f(100)).toBe(msgs.other(100));
    });
});

describe('select', () => {
    const outputTypeOptions = {
        error: 'An error occurred',
        warning: 'A warning occured',
        nop: undefined
    };
    const outputType = select(en, outputTypeOptions);

    it('must work for simple string selection', () => {
        expect(outputType('error')).toBe(outputTypeOptions.error);
        expect(outputType('warning')).toBe(outputTypeOptions.warning);
    });

    it('must fallback to "other" if no selection option matches', () => {
        const options = {...outputTypeOptions, ...{other: 'unknown'}};
        expect(select(en, options)('unknown')).toBe('unknown');
    });

    it('must throw an error if no selection option matches and "other" isn\'t specified', () => {
        expect(() => outputType('unknown')).toThrow();
    });
});

describe('selectObject', () => {
    interface Person {
        gender: 'female' | 'male' | 'unknown',
        name: string
    }
    const salutationOptions = {
        female: 'Dear Mrs. {name}',
        male: 'Dear Mr. {name}',
        other: 'Dear {name}'
    };
    const salutation = selectObject<Person>(en, p => p.gender, salutationOptions);

    it('must provide the fully formatted option', () => {
        expect(salutation({gender: 'female', name: 'Granger'})).toBe('Dear Mrs. Granger');
        expect(salutation({gender: 'male', name: 'Potter'})).toBe('Dear Mr. Potter');
    });

    it('must fallback to "other" if no selection option matches', () => {
        expect(salutation({gender: 'unknown', name: 'Dobby'})).toBe('Dear Dobby');
    });
});