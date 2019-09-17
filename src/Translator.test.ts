import {
    LanguageTag,
    languageTag,
    pickPreferredLanguage,
    preferredLanguage,
    selectPreferredLanguage,
    translate
} from '.';

const en = languageTag('en');
const de = languageTag('de');

const enMessages = {
    welcome: 'Hi there!',
    cancel: 'Cancel',
    ok: 'OK'
};
const deMessages = {
    welcome: 'Hallo Du!',
    cancel: 'Abbrechen'
};
const deChMessages = {
    welcome: 'Grüezi!'
};
const translator = translate(enMessages)
    .partiallySupporting(de, deMessages)
    .partiallySupporting('de-Latn-CH', deChMessages);

const enMessageOverrides = {
    welcome: 'Welcome to the overrides',
    newValue: 'New value'
};
const deMessageOverrides = {
    welcome: 'Willkommen zu den Überschreibungen',
    newValue: 'Neuer Wert'
};
const messageOverridesTranslator = translate(enMessageOverrides).
    supporting('de', deMessageOverrides).
    extending(translator);

const enFormattedMessages = (language: LanguageTag) => ({
    selectedLanguage: `language is ${language.tag}`
});
const deFormattedMessages = (language: LanguageTag) => ({
    selectedLanguage: `Sprache ist ${language.tag}`
});
const formattedMessagesTranslator = translate(enFormattedMessages).
    supporting('de', deFormattedMessages).
    extending(messageOverridesTranslator);

describe('Translator', () => {
    it('Provides the translations for the specified language', () => {
        const msg = translator.messagesFor(de);
        expect(msg.welcome).toBe(deMessages.welcome);
    });

    it('Must fallback to base language for unspecified keys', () => {
        const msg = translator.messagesFor(de);
        expect(msg.ok).toBe(enMessages.ok);
    });

    it('must pick the best matching translation even if there is no exact one', () => {
        const msg = translator.messagesFor(languageTag('de-Latn-CH-1901'));
        expect(msg.welcome).toBe(deChMessages.welcome);
    });

    it('must fallback to the next more generic language for partial translations', () => {
        const msg = translator.messagesFor(languageTag('de-CH'));
        expect(msg.cancel).toBe(deMessages.cancel);
    });

    it('Must provide base and extended tests', () => {
        const msg = messageOverridesTranslator.messagesFor(de);
        expect(msg.welcome).toBe(deMessageOverrides.welcome);
        expect(msg.newValue).toBe(deMessageOverrides.newValue);
        expect(msg.ok).toBe(enMessages.ok);
    });

    it('Must cache the messages for subsequent requests for the same language', () => {
        const tag = languageTag('de-Latn-CH-1901');
        const chMsgA = translator.messagesFor(tag);
        const chMsgB = translator.messagesFor(tag);
        expect(chMsgA).toBe(chMsgB);

        // ensure that we're not always using the cache
        const enMsg = translator.messagesFor(en);
        expect(enMsg.welcome).toBe(enMessages.welcome);
    });

    it('Must provide the requested language to the message generators', () => {
        const tag = languageTag('de-Latn-CH-1901');
        const msg = formattedMessagesTranslator.messagesFor(tag);
        expect(msg.selectedLanguage).toBe('Sprache ist de-Latn-CH-1901');
    });

    it('must pick the best supported language from the user\'s language preferences', () => {
        const translations = [
            languageTag('de'),
            languageTag('fr-CH'),
            languageTag('sp')
        ];
        const browserLanguages = [
            languageTag('it-CH'),
            languageTag('de-CH-1901'),
            languageTag('fr-CH'),
            languageTag('en')
        ];
        const picked = pickPreferredLanguage(translations, browserLanguages);
        expect(picked.tag).toBe('de-CH-1901');

        const pickedFallback = pickPreferredLanguage([languageTag('sp')], browserLanguages);
        expect(pickedFallback.tag).toBe('it-CH');
    });

    it('must init the global preferred translation value', () => {
        selectPreferredLanguage(['en', 'de', 'de-CH'], ['fr-CH', 'de-Latn-CH-1901', 'en']);
        expect(preferredLanguage()!.tag).toEqual('de-Latn-CH-1901');

        const msg = translator.messages();
        expect(msg.welcome).toBe(deChMessages.welcome);
    });

    it('must init the global preferred translation value from navigator.languages', () => {
        expect(navigator.languages).toEqual(['en-US', 'en']);
        selectPreferredLanguage(['de']);
        expect(preferredLanguage()!.tag).toEqual('en-US');
    });
});
