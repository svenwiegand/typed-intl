import { LanguageTag, languageTag } from './LanguageTag';

/**
 * Messages are defined as simple JavaScript objects where the property key is the message key and the value is the
 * message. Messages should either be simple `string`s or functions returning a `string`.
 */
export type Messages = {}

/**
 * Sometimes you may need the current language when defining [[Messages]], for example to define language dependent
 * formatting. Instead of directly providing a [[Messages]] object you may provide a function of this type then.
 */
export type LocalizedMessages<M extends Messages> = (language: LanguageTag) => M;

/**
 * Some functions allow you to either directly specify a [[Messages]] object or a [[LocalizedMessages]] function.
 */
export type MessagesParameter<M extends Messages> = M | LocalizedMessages<M>;

function localizedMessages<M extends Messages>(messages: MessagesParameter<M>): LocalizedMessages<M> {
    if (typeof messages === 'function') {
        return messages;
    } else {
        return (language: LanguageTag) => messages;
    }
}

/**
 * Either a [[LanguageTag]] or a `string` which can be provided to [[languageTag]]().
 */
export type Language = LanguageTag | string;

function tag(language: Language): LanguageTag {
    return (typeof language === 'string') ? languageTag(language) : language;
}

/**
 * An object that provides messages for a specified language.
 */
export interface MessageProvider<M extends Messages> {
    /**
     * Provides messages for a specified language.
     *
     * Subsequent calls to this method with the same `language` parameter will provide the same object.
     * Thus calling this method multiple times with the same `language` parameter is a fast operation.
     *
     * @param language the language to return the best matching translation for.
     * @returns a message object for the specified language.
     *  Missing identifiers will be filled up with those from parent languages (see [[LanguageTag.parent]]) or the
     *     default language.
     */
    messagesFor(language: LanguageTag): Readonly<M>;

    /**
     * Like [[messagesFor]] but uses [[preferredLanguage]] as language.
     */
    messages(): Readonly<M>;
}

/**
 * Typesafe builder for a [[MessageProvider]].
 */
export interface Translator<M extends Messages> extends MessageProvider<M> {
    /**
     * Provides a new translator additionally partially supporting the specified language. Partially supporting a
     * language means that not for all keys messages are defined. When retrieving translations using
     * [[MessageProvider.messagesFor]] these missing keys will be filled up with the parent and default languages.
     *
     * @param language
     * @param translation
     *  messages object which may not provide all of the keys available in the default translation.
     * @returns A new translator supporting the specified language.
     */
    partiallySupporting(language: Language, translation: MessagesParameter<Partial<M>>): Translator<M>

    /**
     * Provides a new translator additionally supporting a translation of the specified language.
     * The provided [[Messages} object must specify all keys already defined for the default language of this
     * translator.
     *
     * @param language
     * @param translation
     *  messages object which must provide all of the keys available in the default translation.
     * @returns A new translator supporting the specified language.
     */
    supporting(language: string, translation: MessagesParameter<M>): Translator<M>

    /**
     * Provides a [[MessageProvider]] supporting the keys from `base` and the keys from this translator.
     * Messages from this translator will override messages with the same keys in `base`.
     * @param base provider of base messages.
     * @returns the combined [[MessageProvider]]
     */
    extending<B extends Messages>(base: MessageProvider<B>): MessageProvider<B & M>
}

class MessageCache<M extends Messages> {
    constructor(readonly language: LanguageTag, readonly messages: Readonly<M>) {}
}

/**
 * A [[MessageProvider]] which caches messages for the last queried language.
 */
abstract class CachedMessageProvider<M extends Messages> implements MessageProvider<M> {
    private messageCache?: MessageCache<M> = undefined;

    messagesFor(language: LanguageTag): Readonly<M> {
        if (this.messageCache && this.messageCache.language === language) {
            return this.messageCache.messages;
        } else {
            const messages = this.buildMessages(language);
            this.messageCache = new MessageCache(language, messages);
            return messages;
        }
    }

    messages(): Readonly<M> {
        return this.messagesFor(preferredLanguage()!);
    }

    /**
     * Called by [[messagesFor]] if no cached messages are available for the requested language.
     * @param language
     * @returns a message object for the specified language.
     *  Missing identifiers will be filled up with the parent or default language.
     */
    protected abstract buildMessages(language: LanguageTag): M
}

/**
 * A [[MessageProvider]] which provides merged messages from two [[MessageProvider]]s.
 */
class ExtendingMessageProvider<B extends Messages, M extends Messages> extends CachedMessageProvider<B & M> {
    /**
     * @param base messages which will be used for keys not available in `extension`.
     * @param extension messages which override keys already available in `base`.
     */
    constructor(private readonly base: MessageProvider<B>, private readonly extension: MessageProvider<M>) {
        super();
    }

    /** @inheritDoc */
    protected buildMessages(language: LanguageTag): B & M {
        return {
            ...(this.base.messagesFor(language) as object),
            ...this.extension.messagesFor(language) as object
        } as B & M;
    }
}

class TranslatorImpl<M extends Messages> extends CachedMessageProvider<M> implements Translator<M> {
    private readonly supportedLanguages: LanguageTag[];

    constructor(private readonly defaultMessages: LocalizedMessages<M>,
                private readonly translations: Map<LanguageTag, LocalizedMessages<Partial<M>>> = new Map()) {
        super();
        this.supportedLanguages = Array.from(translations.keys());
    }

    /** @inheritDoc */
    partiallySupporting(language: Language, translation: MessagesParameter<Partial<M>>): Translator<M> {
        const translations = new Map(this.translations.entries());
        const lang = tag(language);
        translations.set(lang, localizedMessages(translation));
        return new TranslatorImpl(this.defaultMessages, translations);
    }

    /** @inheritDoc */
    supporting(language: string, translation: MessagesParameter<M>): Translator<M> {
        return this.partiallySupporting(language, translation);
    }

    /** @inheritDoc */
    extending<B extends Messages>(base: MessageProvider<B>): MessageProvider<B & M> {
        return new ExtendingMessageProvider(base, this);
    }

    /** @inheritDoc */
    protected buildMessages(language: LanguageTag): M {
        const bestMatchingLanguage = language.pickBestMatching(this.supportedLanguages);
        return this.buildRecursive(this.defaultMessages(language), language, bestMatchingLanguage);
    }

    private buildRecursive(base: M, requestedLanguage: LanguageTag, translationLanguage?: LanguageTag): M {
        const translation = translationLanguage ? this.translations.get(translationLanguage) : undefined;
        if (translation) {
            const mergedBase = this.buildRecursive(base, requestedLanguage, translationLanguage.parent());
            return { ...mergedBase as object, ...translation(requestedLanguage) as object } as M;
        } else if (translationLanguage) {
            return this.buildRecursive(base, requestedLanguage, translationLanguage.parent());
        } else {
            return base;
        }
    }
}

/**
 * Create a [[Translator]] with the specified default messages.
 * @param defaultMessages messages to be used if no messages for a selected translation are available.
 * @returns translator with the specified default messages.
 */
export function translate<M>(defaultMessages: MessagesParameter<M>): Translator<M> {
    return new TranslatorImpl(localizedMessages(defaultMessages));
}

/**
 * Picks the best supported language based on the user's preferred languages.
 *
 * @param availableTranslations the translations provided by this application
 * @param usersPreferredLanguages the user's preferred languages ordered by preference (most preferred first)
 * @returns the best matching language from `usersPreferredLanguages` or the first if no one matches.
 */
export function pickPreferredLanguage(availableTranslations: LanguageTag[],
                                      usersPreferredLanguages: LanguageTag[]): LanguageTag {
    const bestLanguagePreference = usersPreferredLanguages
        .find(navLang => navLang.matchesOneOf(availableTranslations));
    return bestLanguagePreference || usersPreferredLanguages[0];
}

let _preferredLanguage: LanguageTag | undefined = navigator.language ?
    languageTag(navigator.language) :
    /* istanbul ignore next: not reachable in test */ undefined;

/**
 * The preferred language to be used when calling [[MessageProvider.messages]].
 *
 * By default this is set to `navigator.language`.
 * Adjust it using [[setPreferredLanguage]] or [[selectPreferredLanguage]].
 */
export function preferredLanguage(): LanguageTag | undefined {
    return _preferredLanguage;
}

/**
 * Sets the preferred language to be used when calling [[MessageProvider.messages]].
 *
 * @param language language to be used for retrieving messages with [[MessageProvider.messages]].
 */
export function setPreferredLanguage(language: LanguageTag): void {
    _preferredLanguage = language;
}

/**
 * Polyfill for `navigator.languages`.
 */
const navigatorLanguages = navigator.languages ?
    navigator.languages :
    /* istanbul ignore next: not reachable in test */ (navigator.language ? [navigator.language] : ['en']);

/**
 * Sets the [[preferredLanguage]] based on the translations supported by this application and the user's
 * language preferences.
 *
 * @see [[pickPreferredLanguage]]
 * @see [[setPreferredLanguage]]
 *
 * @param availableTranslations the languages this app provides translations for
 * @param usersPreferredLanguages the user's preferred languages ordered by preference (most preferred first).
 */
export function selectPreferredLanguage(availableTranslations: string[],
                                        usersPreferredLanguages: string[] = navigatorLanguages): void {
    const translations = availableTranslations.map(l => languageTag(l));
    const navLanguages = usersPreferredLanguages.map(l => languageTag(l));
    const pick = pickPreferredLanguage(translations, navLanguages);
    setPreferredLanguage(pick);
}