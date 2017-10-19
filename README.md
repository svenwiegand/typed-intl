[![npm version](https://badge.fury.io/js/typed-intl.svg)](https://badge.fury.io/js/typed-intl)

# typed-intl - Typesafe internationalization for TypeScript/JavaScript Apps
typed-intl is an internationlization (intl/i18n) library for TypeScript/JavaScript apps.

## Motivation
I've tried out quite a few internationalization libraries, but none of them made me happy. Some of them only concentrated on picking the right translations but did not provide formatting or plural stuff. Others provided the whole stuff required, but where quite verbose in usage (e.g. [Format.js](https://formatjs.io) and its React integration [react-intl](https://github.com/yahoo/react-intl)).

And finally none of them provided (type)safe message access and formatting options, so that the compiler would point me towards access to non existing messages or (accidentially) left out translation strings. But as I have a strong [Scala](http://scala-lang.org) background an amm using TypeScript for my React apps which has a powerful type system, I wanted to have a solution that does exactly this.

## Design Goals & Features
Thus these where my design goals:

- Easy and clean definition of translation messages including
  - Defining keys and messages as plain JavaScript objects
  - Possibility to place component specific translations near the component's code
  - Possibility to define translation objects based on others
  - The compiler should remind me if I miss a message for one language
- Simple and checked access to messages, so that the compiler will report an error if I try to reference a non exiting message
- Extensive formatting capabilities based on [ICU message syntax](https://formatjs.io/guides/message-syntax/)
  - to define messages with placeholders for strings, numbers, dates and times
  - to define pluralized messages
  - typesafe format functions, so that the compiler ensures I'm passing in the right message parameters.
- Unopinionated regarding the used UI framework. In my opinion, if accessing translation messages is easy an clean now specific React (or whatever) integration is required.  
- Automatic language selection based on `navigator.languages`.
- Do the heavy lifting (message formatting) based on well proven libraries. _typed-intl_ uses Yahoos's well proven [intl-messageformat](https://github.com/yahoo/intl-messageformat) here which is a part of the [Format.JS](https://formatjs.io) stack.
- 100% test coverage.

## Installation
To add _typed-intl_ to your project install it with:
```bash
npm install typed-intl
```

Depending on which browsers you target, be sure to install the required polyfills for [intl-messageformat](https://github.com/yahoo/intl-messageformat) as described in [it's documentation](https://formatjs.io/github/#polyfills).

## Introduction
Assume the following file structure:
```
src
 ├ common
 │ └ Base.msg.ts
 ├ tasklist
 │ ├ TaskList.msg.ts
 │ └ TaskList.tsx
 ├ App.tsx
 └ index.tsx
```

### Defining Messages
In `common/Base.msg.ts` we have some common basic translations defined:
```typescript
import { translate } from 'typed-intl';

export default translate({        // 1.
    ok: 'OK',
    cancel: 'Cancel'
    welcome: 'Welcome',           
}).supporting('de', {             // 2.
    ok: 'OK',
    cancel: 'Abbrechen'
    welcome: 'Willkommen',
}).partiallySupporting('de-CH', { // 3.
    welcome: 'Grüezi'  
});
```
Lets see what we have here:

1. We are defining default messages in English. As we specify them without a language tag, these are the messages that will be used as fallback.
2. We provide a German translation. If we would leave off one of the keys for the German translation created using `supporting('de', {...}` the compiler/IDE would report an error.
3. We define a partial translation for Switzerland using `partiallySupporting('de-CH', {...})`. This states, that only specifying a subset of the messages is okay. But it is _not_ okay to sepcify new translation keys.

Now lets look at `tasklist/TaskList.msg.ts`:
```typescript
import { format, plural, translate } from 'typed-intl';
import base from 'common/Base.msg';

export default translate(lang => {
    taskStatus: plural(lang, {                                            // 1
        zero: 'You have no tasks',
        one: 'You have one task',
        other: n => format<number>(lang, 'You have {1, number} tasks')(n) // 2
    });
}).supporting('de', lang => {
    taskStatus: plural(lang, {                                            // 3
        zero: 'Du hast keine Aufgaben',
        one: 'Du hast eine Aufgabe',
        other: n => format<number>(lang, 'Du hast {1, number} Aufgaben')(n)
    });    
}).extending(base);                                                       // 4
```
We want a message here, that displays the current status of our tasklist and we want different messages depending on the number of tasks on our list.

1. To achieve this we use the `plural()` function and specify different messages for zero, one and any other number of tasks.

   Plurals depend on the locale. For example in Arabic there are further distinctions for `two`, `few` and `many` items. Thus we need to pass in the user's language to `plural()`. Note that we should not simply pass in `'en'` here, because we want the full locale as specified in the user's language preferences. We can retrieve the current language by providing a function of type `(lang: LanguageTag) => {}` to `translate()`, `supporting()` and `partiallySupporting()` instead of simply the translation object as we did it in `Base.msg.ts`.
2. For any case where there is more than one task we use a formatted message to include the number of tasks into the message. We are using the `format()` function here expecting one `number` parameter ans using [ICU message syntax](https://formatjs.io/guides/message-syntax/).
3. We specify a full German translation. If we would forget to define the `taskStatus` message or misspell the key, again the compiler/IDE will remind use here.

   Further on also the type of a message is checked. In the first example all messages were simply of type `string`, but the result of `plural` is of type `(n: number) => string`. Thus for the `taskStatus` key in every language we must specify something resulting in the same type or the compiler will complain.
4. We define the `TaskList` messages to extend the `Base` messages. As a result the `TaskList` messages will also contain our `ok`, `cancel` and `welcome` keys.

**Note:** `extending` messages is _typed-intl_'s solution for structuring messages in a large application. In contrast _typed-intl_ currently does _not_ support nested messages.

### Consuming Messages
Now that we have our messages defined we can use them in our `tasklist/TaskList.tsx` component:
```tsx
import * as React from 'react';
import translations from './TaskList.msg'          // 1

const msg = translations.messages();               // 2

...

export class TaskList extends React.PureComponent<...> {
  ...

  render() {
    return (
      <div>
        {msg.taskStatus(this.props.tasks.count())} // 3
      </div>
      ...
      <Button ...>{msg.ok}</Button>                // 4
    );
  }
}
```
We define a React component here, but this will work for every other framework too.

1. We import our messages.
2. We retrieve the correct messages for the user's preferred language. See how we initalize this in `index.tsx` below.

   If you don't want to use the global language mechanism, e.g. because you want allow the user to dynamically switch the language, then you need to explicitly specify the user's language and retrieve the best matching translation using `translations.messagesFor(language: LanguageTag)`.
3. We format the task status by passing the task count to our `taskStatus` message formatter. Note that the compiler/IDE will complain if we mistype the message's key or pass something else than a `number` to it.
4. As our `TaskList` messages are `extending()` our `Base` messages we can easily access the `ok` text here.

### Initialization
You can use _typed-intl_ without any initialization if you explicitly specify the language you want to retrieve messages for using `messagesFor(lang: LanguageTag)` on a `MessageProvider`. Actually you will have to do this if you want some kind of dynamic language switching without reloading the page.

But if you simply want to set the user's language for the whole app based on the user's language preferences, then you can use _typed-intl_'s global language handling.

This is what we do in our example in `index.tsx`:
```tsx
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './App';
import { selectPreferredLanguage } from 'typed-intl';

selectPreferredLanguage(['en', 'de', 'de-CH']); // 1
ReactDOM.render(
  <App />,
  document.getElementById('root') as HTMLElement
);
```
1. All we need to do here is calling the `selectPreferredLanguage()` function with the list of languages we are providing translations for. The second parameter to this function is the list of language preferences of the current user and defaults to `navigator.languages` -- thus you will have to specify them manually if you want to target browsers not supporting this property or if your server delivers the language preferences.

This is how `selectPreferredLanguage()` works:

 1. It will go through the list of the user's preferred languages and pick the first one we have a translation for. A matching algorithm is used here to match even complex language tags to the best available translation.
 2. If no translations match, the users most preferred language will be chosen which will result in the fallback messages being used.
 3. The chosen language will be set as global language calling `setPreferredLanguage()`.

You can always query the current language using the `preferredLanguage()` function. This language will be used when calling the parameterless `messages()` function on a `MessageProvider` and it will be passed through to your message definitions as shown for `TaskList.msg.ts` above.

Lets look at an example:

- Lets assume we have Translations for `en`, `de`, `fr`, `fr-CH` and `sp`.
- The users language preferences are `it-CH`, `de-CH`, `fr-CH` and `en`.
- Then `selectPreferredLanguage()` will set `preferredLanguage()` to `de-CH`.

**Explanation:** Preferred languages are checked in the specified order as the first one is expected to be the most preferred. As we do not have a translation for `it-CH` nor for `it`, we need to look at `de-CH` next. We do not have an exact match for `de-CH`, but at least the language `de` is supported and thus `de-CH` is chosen. `fr-CH` would have an exact match but comes later in the list of preferred languages.
