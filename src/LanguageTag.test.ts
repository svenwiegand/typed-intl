import { languageTag } from './LanguageTag';

describe('LanguageTag', () => {
    it('must only provide the language for a language tag without subtags', () => {
        const tag = languageTag('en');
        expect(tag.tag).toBe('en');
        expect(tag.language).toBe('en');
        expect(tag.region).toBeUndefined();

        const longtag = languageTag('ast');
        expect(longtag.language).toBe('ast');
        expect(longtag.region).toBeUndefined();
    });

    it('must support language extension', () => {
        const tag = languageTag('zh-gan');
        expect(tag.tag).toBe('zh-gan');
        expect(tag.language).toBe('zh');
        expect(tag.extendedLanguage).toBe('gan');
        expect(tag.region).toBeUndefined();
    });

    it('must support script subtag', () => {
        const tag = languageTag('zh-Hans');
        expect(tag.tag).toBe('zh-Hans');
        expect(tag.language).toBe('zh');
        expect(tag.script).toBe('Hans');
        expect(tag.region).toBeUndefined();
    });

    it('must support region subtag', () => {
        const tag = languageTag('en-US');
        expect(tag.tag).toBe('en-US');
        expect(tag.language).toBe('en');
        expect(tag.region).toBe('US');
    });

    it('must support variant subtag', () => {
        const tag = languageTag('de-CH-1901');
        expect(tag.tag).toBe('de-CH-1901');
        expect(tag.language).toBe('de');
        expect(tag.region).toBe('CH');
        expect(tag.variant).toBe('1901');

        const tag2 = languageTag('sl-IT-nedis');
        expect(tag2.variant).toBe('nedis');
    });

    it('must support extension subtag', () => {
        const tag = languageTag('de-DE-u-co-phonebk');
        expect(tag.tag).toBe('de-DE-u-co-phonebk');
        expect(tag.language).toBe('de');
        expect(tag.region).toBe('DE');
        expect(tag.extension).toBe('u-co-phonebk');
    });

    it('must provide the correct casing for language and region if specified', () => {
        const tag = languageTag('ZH-GAN-hANS-us-NEDIS-X-TWAIN');
        expect(tag.tag).toBe('zh-gan-Hans-US-nedis-x-twain');
        expect(tag.language).toBe('zh');
        expect(tag.extendedLanguage).toBe('gan');
        expect(tag.script).toBe('Hans');
        expect(tag.region).toBe('US');
        expect(tag.variant).toBe('nedis');
        expect(tag.extension).toBe('x-twain');
    });

    it('must be a singleton for each exact language definition', () => {
        expect(languageTag('zh-gan-Hans-US-nedis-x-twain')).toBe(languageTag('ZH-GAN-hANS-us-NEDIS-X-TWAIN'));
        expect(languageTag('en')).not.toBe('en-us');
    });

    it('must match other languages with same language subtag', () => {
        expect(languageTag('de-CH').matches(languageTag('de-AT'))).toBe(true);
        expect(languageTag('de').matches(languageTag('de-AT'))).toBe(true);
        expect(languageTag('de-CH').matches(languageTag('de'))).toBe(true);
        expect(languageTag('sp').matches(languageTag('de'))).toBe(false);

        const others = [
            languageTag('fr'),
            languageTag('de')
        ];
        expect(languageTag('de-CH').matchesOneOf(others)).toBe(true);
        expect(languageTag('sp').matchesOneOf(others)).toBe(false);
    });

    it('must provide it\'s parent', () => {
        const tag = languageTag('ZH-GAN-hANS-us-NEDIS-X-TWAIN');

        const withoutExtension = tag.parent()!;
        expect(withoutExtension.tag).toEqual('zh-gan-Hans-US-nedis');

        const withoutVariant = withoutExtension.parent()!;
        expect(withoutVariant.tag).toEqual('zh-gan-Hans-US');

        const withoutRegion = withoutVariant.parent()!;
        expect(withoutRegion.tag).toEqual('zh-gan-Hans');

        const withoutScript = withoutRegion.parent()!;
        expect(withoutScript.tag).toEqual('zh-gan');

        const withoutExtendedLanguage = withoutScript.parent()!;
        expect(withoutExtendedLanguage.tag).toEqual('zh');

        expect(withoutExtendedLanguage.parent()).toBeUndefined();

        expect(languageTag('de-CH').parent()!.tag).toEqual('de');
    });

    it('must calculate the equality with other language tags', () => {
        const tag = languageTag('zh-gan-Hans-US-nedis-x-twain');

        const fullEquality = tag.equality(languageTag('zh-gan-Hans-US-nedis-x-twain'));
        expect(fullEquality).toBe(1.0);

        const equalityWithoutExtension = tag.equality(languageTag('zh-gan-Hans-US-nedis'));
        expect(equalityWithoutExtension).toBeGreaterThan(0);
        expect(equalityWithoutExtension).toBeLessThan(fullEquality);

        const equalityWithoutVariant = tag.equality(languageTag('zh-gan-Hans-US'));
        expect(equalityWithoutVariant).toBeGreaterThan(0);
        expect(equalityWithoutVariant).toBeLessThan(equalityWithoutExtension);

        const equalityWithoutRegion = tag.equality(languageTag('zh-gan-Hans'));
        expect(equalityWithoutRegion).toBeGreaterThan(0);
        expect(equalityWithoutRegion).toBeLessThan(equalityWithoutVariant);

        const equalityWithoutScript = tag.equality(languageTag('zh-gan'));
        expect(equalityWithoutScript).toBeGreaterThan(0);
        expect(equalityWithoutScript).toBeLessThan(equalityWithoutRegion);

        const equalityWithoutExtendedLanguage = tag.equality(languageTag('zh'));
        expect(equalityWithoutExtendedLanguage).toBeGreaterThan(0);
        expect(equalityWithoutExtendedLanguage).toBeLessThan(equalityWithoutScript);

        const noEquality = tag.equality(languageTag('de-gan-Hans-US-nedis-x-twain'));
        expect(noEquality).toBe(0);

        // some more random samples
        expect(tag.equality(languageTag('zh-US'))).toBeGreaterThan(tag.equality(languageTag('zh')));
    });

    it('must throw an error when an invalid string is provided', () => {
        expect(() => languageTag('-abc')).toThrowError();
    });
});