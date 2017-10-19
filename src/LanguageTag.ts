/**
 * A language tag as defined in [BCP-47](http://www.ietf.org/rfc/bcp/bcp47.txt).
 *
 * The only possibility to create a `LanguageTag` is using the [[languageTag]] function which guarantees,
 * that there is only one single instance for each exact language specification. Thus it is save to use
 * strict equality (`===`) when comparing to language tags.
 */
export interface LanguageTag {
    /**
     * The text representation of the full tag (e.g. `en-US`).
     */
    readonly tag: string;

    /**
     * The language of the tag (e.g. `en`).
     */
    readonly language: string;

    /**
     * The extended language subtag (e.g. `yue` in `zh-yue`).
     */
    readonly extendedLanguage?: string;

    /**
     * The script subtag (e.g. `Latn` in `az-Latn`).
     */
    readonly script?: string;

    /**
     * The region subtag (e.g. `US` in `en-US`).
     */
    readonly region?: string;

    /**
     * The variant subtag (e.g. `nedis` in `sl-nedis` or `sl-IT-nedis`).
     */
    readonly variant?: string;

    /**
     * The extension subtag (e.g. `u-co-phonebk` in `de-DE-u-co-phonebk`).
     */
    readonly extension?: string;

    /**
     * Checks whether this language matches the other one. Effectively only the [[language]] subtags are compared.
     *
     * @param other the language to check against.
     * @returns `true` if both tags specify the same language.
     */
    matches(other: LanguageTag): boolean

    /**
     * Checks whether this language matches one of the specified languages. Effectively only the [[language]] subtags
     * are compared.
     * @param others the languages to check against.
     * @returns `true` if at least one of the specified tags specifies the same language.
     */
    matchesOneOf(others: LanguageTag[]): boolean

    /**
     * Returns the next more generic language tag by omitting the most specific subtag.
     * @returns The next more generic language tag or `undefined` if this language tag has only a [[language]] subtag.
     */
    parent(): LanguageTag | undefined

    /**
     * Calculates the equality among this and the provided language tag.
     *
     * You should not depend on the absolute value returned, instead the value is meant for picking the best matching
     * language tag from a list.
     *
     * @param other the tag to check equality against
     * @returns equality between this and the other tag expressed as a value between `0` (language does not match) and
     *     `1` (all subtags match).
     */
    equality(other: LanguageTag): number

    /**
     * Returns the language tag from the list that best matches this language tag.
     * @param others the language tags to test.
     * @returns the best matching language tag or `undefined` if no one matches.
     */
    pickBestMatching(others: LanguageTag[]): LanguageTag | undefined
}

/**
 * Provides a [[LanguageTag]] for the specified string representation of a language tag.
 *
 * It is guaranteed, that this function returns the same [[LanguageTag]] instance for the same string
 * (ignoring case). Thus it is save to use strict equality (`===`) when comparing [[LanguageTag]]s.
 *
 * @param tag a language tag string as defined in [BCP-47](http://www.ietf.org/rfc/bcp/bcp47.txt)
 * @returns the resulting language tag
 * @throws an exception if the provided string is not a valid language tag.
 */
export function languageTag(tag: string): LanguageTag {
    return languageTags.fromString(tag);
}

/* tslint:disable */
const pattern = new RegExp('^' +
    '([a-z]{2,3})' + // language
    '(-[a-z]{3})?' + // extended language
    '(-[a-z]{4})?' + // script
    '(-[a-z]{2}|[0-9]{3})?' + // region
    '((?:-[a-z]{5,8})|(?:-[0-9][a-z0-9]{3}))?' + // variant
    '(-[0-9a-z](?:-[a-z0-9]{1,8})+)?' + // extension
    '$', 'i');
/* tslint:enable */

const languageTags = new class LanguageTags {
    private readonly instances: Map<string, LanguageTag> = new Map();

    fromString(tag: string): LanguageTag {
        const unifiedTag = tag.toLowerCase();
        const existing = this.instances.get(unifiedTag);
        return existing ? existing : this.createFromString(unifiedTag);
    }

    fromSubTags(
        language: string,
        extendedLanguage?: string,
        script?: string,
        region?: string,
        variant?: string,
        extension?: string
    ): LanguageTag {

        function unifiedSubtag(t: string | undefined): string {
            return t ? `-${t.toLowerCase()}` : '';
        }

        const unifiedTag = language.toLowerCase() +
            unifiedSubtag(extendedLanguage) +
            unifiedSubtag(script) +
            unifiedSubtag(region) +
            unifiedSubtag(variant) +
            unifiedSubtag(extension);
        const existing = this.instances.get(unifiedTag);
        if (existing) {
            return existing
        } else {
            const tag = new LanguageTagImpl(language, extendedLanguage, script, region, variant, extension);
            this.instances.set(unifiedTag, tag);
            return tag;
        }
    }

    private createFromString(unifiedTag: string): LanguageTag {
        const match = pattern.exec(unifiedTag);
        if (!match) {
            throw `Invalid language tag ${unifiedTag}`;
        }

        function group(m: Array<string>, n: number): string|undefined {
            return m[n] ? m[n].substr(1) : undefined;
        }

        const language = match[1];
        const extendedLanguage = group(match, 2);
        const script = group(match, 3);
        const region = group(match, 4);
        const variant = group(match, 5);
        const extension = group(match, 6);
        const instance =  new LanguageTagImpl(language, extendedLanguage, script, region, variant, extension);
        this.instances.set(unifiedTag, instance);
        return instance;
    }
};

class LanguageTagImpl implements LanguageTag {
    readonly tag: string;
    readonly language: string;
    readonly extendedLanguage?: string;
    readonly script?: string;
    readonly region?: string;
    readonly variant?: string;
    readonly extension?: string;

    constructor(
        language: string,
        extendedLanguage?: string,
        script?: string,
        region?: string,
        variant?: string,
        extension?: string
    ) {
        function transform(t: string | undefined, f: (x: string) => string): string | undefined {
            return t ? f(t) : undefined;
        }

        this.language = language.toLowerCase();
        this.extendedLanguage = transform(extendedLanguage, x => x.toLowerCase());
        this.script = transform(script, x => x[0].toUpperCase() + x.substr(1).toLowerCase());
        this.region = transform(region, x => x.toUpperCase());
        this.variant = transform(variant, x => x.toLowerCase());
        this.extension = transform(extension, x => x.toLowerCase());

        function subtag(t: string | undefined): string {
            return t ? `-${t}` : '';
        }

        this.tag = language.toLowerCase() +
            subtag(this.extendedLanguage) +
            subtag(this.script) +
            subtag(this.region) +
            subtag(this.variant) +
            subtag(this.extension);
    }

    /** @inheritDoc */
    matches(other: LanguageTag): boolean {
        return this.language === other.language;
    }

    /** @inheritDoc */
    matchesOneOf(others: LanguageTag[]): boolean {
        return others.find(other => this.matches(other)) !== undefined;
    }

    /** @inheritDoc */
    parent(): LanguageTag | undefined {
        if (this.extension) {
            return this.withoutExtension();
        } else if (this.variant) {
            return this.withoutVariant();
        } else if (this.region) {
            return this.withoutRegion();
        } else if (this.script) {
            return this.withoutScript();
        } else if (this.extendedLanguage) {
            return this.withoutExtendedLanguage();
        } else {
            return undefined;
        }
    }

    /** @inheritDoc */
    equality(other: LanguageTag): number {
        if (this.language !== other.language) {
            return 0;
        } else {
            const extensionPoints = 1;
            const variantPoints = 2;
            const regionPoints = 4;
            const scriptPoints = 8;
            const extendedLanguagePoints = 16;
            const languagePoints = 32;
            const possiblePoints =
                languagePoints +
                (this.extension || other.extension ? extensionPoints : 0) +
                (this.variant || other.variant ? variantPoints : 0 ) +
                (this.region || other.region ? regionPoints : 0) +
                (this.script || other.script ? scriptPoints : 0) +
                (this.extendedLanguage || other.extendedLanguage ? extendedLanguagePoints : 0);
            const points =
                languagePoints +
                (this.extension === other.extension ? extensionPoints : 0) +
                (this.variant === other.variant ? variantPoints : 0) +
                (this.region === other.region ? regionPoints : 0) +
                (this.script === other.script ? scriptPoints : 0) +
                (this.extendedLanguage === other.extendedLanguage ? extendedLanguagePoints : 0);
            return points / possiblePoints;
        }
    }

    /** @inheritDoc */
    pickBestMatching(others: LanguageTag[]): LanguageTag | undefined {
        interface Match { equality: number, other?: LanguageTag }
        let bestEquality: Match = {
            equality: 0
        };
        others.forEach(other => {
            const equality = this.equality(other);
            if (equality > bestEquality.equality) {
                bestEquality = {
                    equality: equality,
                    other: other
                };
            }
        });
        return bestEquality.other;
    }

    private withoutExtension(): LanguageTag {
        return languageTags.fromSubTags(this.language, this.extendedLanguage, this.script, this.region, this.variant);
    }

    private withoutVariant(): LanguageTag {
        return languageTags.fromSubTags(this.language, this.extendedLanguage, this.script, this.region);
    }

    private withoutRegion(): LanguageTag {
        return languageTags.fromSubTags(this.language, this.extendedLanguage, this.script);
    }

    private withoutScript(): LanguageTag {
        return languageTags.fromSubTags(this.language, this.extendedLanguage);
    }

    private withoutExtendedLanguage(): LanguageTag {
        return languageTags.fromSubTags(this.language);
    }
}